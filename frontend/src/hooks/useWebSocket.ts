/**
 * T005: WebSocket 실시간 통신 구현
 * 타이핑 데이터 실시간 서버 전송 및 응답 처리
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  WebSocketMessage,
  WebSocketConfig,
  WebSocketConnectionState,
  TypingMessage,
  EmotionMessage,
  HeartbeatMessage,
  ConnectionMessage,
  ErrorMessage,
  ProcessedMessage
} from './types';

interface UseWebSocketOptions {
  sessionId: string;
  config?: Partial<WebSocketConfig>;
  onMessage?: (message: WebSocketMessage) => void;
  onConnectionChange?: (state: WebSocketConnectionState) => void;
  onError?: (error: Event) => void;
  autoConnect?: boolean;
}

interface UseWebSocketReturn {
  connectionState: WebSocketConnectionState;
  sendMessage: (message: WebSocketMessage) => boolean;
  sendTypingData: (data: TypingMessage['data']) => boolean;
  sendHeartbeat: () => boolean;
  connect: () => void;
  disconnect: () => void;
  isConnected: boolean;
  lastError: string | null;
  reconnectAttempts: number;
  messagesReceived: number;
  messagesSent: number;
}

const defaultConfig: WebSocketConfig = {
  url: process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws',
  reconnectInterval: 3000, // 3초
  maxReconnectAttempts: 10,
  heartbeatInterval: 30000, // 30초
  connectionTimeout: 10000 // 10초
};

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const {
    sessionId,
    config = {},
    onMessage,
    onConnectionChange,
    onError,
    autoConnect = true
  } = options;
  const finalConfig = { ...defaultConfig, ...config };

  // 상태 관리
  const [connectionState, setConnectionState] = useState<WebSocketConnectionState>(
    WebSocketConnectionState.DISCONNECTED
  );
  const [lastError, setLastError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [messagesReceived, setMessagesReceived] = useState(0);
  const [messagesSent, setMessagesSent] = useState(0);

  // 내부 레퍼런스
  const wsRef = useRef<WebSocket | null>(null);

  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManuallyClosedRef = useRef(false);

  // 연결 상태 변경 핸들러
  const updateConnectionState = useCallback((newState: WebSocketConnectionState) => {
    setConnectionState(newState);
    onConnectionChange?.(newState);
  }, [onConnectionChange]);

  // 하트비트 설정
  const setupHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const heartbeatMessage: HeartbeatMessage = {
          type: 'heartbeat',
          session_id: sessionId
        };

        try {
          wsRef.current.send(JSON.stringify(heartbeatMessage));
          console.log('💓 Heartbeat sent');
        } catch (error) {
          console.error('Heartbeat 전송 실패:', error);
        }
      }
    }, finalConfig.heartbeatInterval);
  }, [sessionId, finalConfig.heartbeatInterval]);

  // 하트비트 정리
  const clearHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // 연결 타임아웃 설정
  const setupConnectionTimeout = useCallback(() => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
    }

    connectionTimeoutRef.current = setTimeout(() => {
      if (connectionState === WebSocketConnectionState.CONNECTING) {
        console.error('WebSocket 연결 타임아웃');
        setLastError('연결 타임아웃');
        updateConnectionState(WebSocketConnectionState.ERROR);

        if (wsRef.current) {
          wsRef.current.close();
        }
      }
    }, finalConfig.connectionTimeout);
  }, [connectionState, finalConfig.connectionTimeout, updateConnectionState]);

  // 연결 타임아웃 정리
  const clearConnectionTimeout = useCallback(() => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
  }, []);

  // WebSocket 연결
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('이미 연결되어 있습니다');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      console.log('연결 중입니다');
      return;
    }

    console.log('🔌 WebSocket 연결 시작:', `${finalConfig.url}/typing/${sessionId}`);
    updateConnectionState(WebSocketConnectionState.CONNECTING);
    setupConnectionTimeout();
    isManuallyClosedRef.current = false;

    try {
      wsRef.current = new WebSocket(`${finalConfig.url}/typing/${sessionId}`);

      wsRef.current.onopen = (event) => {
        console.log('✅ WebSocket 연결 성공');
        clearConnectionTimeout();
        updateConnectionState(WebSocketConnectionState.CONNECTED);
        setLastError(null);
        setReconnectAttempts(0);
        setupHeartbeat();
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('📨 메시지 수신:', message.type, message);

          setMessagesReceived(prev => prev + 1);
          onMessage?.(message);

          // 특정 메시지 타입별 처리
          if (message.type === 'connection_established') {
            console.log('🎉 연결 확인:', (message as ConnectionMessage).message);
          } else if (message.type === 'error') {
            console.error('❌ 서버 에러:', (message as ErrorMessage).message);
            setLastError((message as ErrorMessage).message);
          }

        } catch (error) {
          console.error('메시지 파싱 실패:', error);
          setLastError('메시지 파싱 실패');
        }
      };

      wsRef.current.onerror = (event) => {
        console.error('❌ WebSocket 에러:', event);
        setLastError('WebSocket 연결 오류');
        updateConnectionState(WebSocketConnectionState.ERROR);
        onError?.(event);
      };

      wsRef.current.onclose = (event) => {
        console.log('🔌 WebSocket 연결 종료:', event.code, event.reason);
        clearHeartbeat();
        clearConnectionTimeout();

        if (isManuallyClosedRef.current) {
          updateConnectionState(WebSocketConnectionState.DISCONNECTED);
          return;
        }

        // 자동 재연결
        if (reconnectAttempts < finalConfig.maxReconnectAttempts) {
          console.log(`🔄 재연결 시도 ${reconnectAttempts + 1}/${finalConfig.maxReconnectAttempts}`);
          updateConnectionState(WebSocketConnectionState.RECONNECTING);
          setReconnectAttempts(prev => prev + 1);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, finalConfig.reconnectInterval);
        } else {
          console.error('최대 재연결 시도 횟수 초과');
          setLastError('최대 재연결 시도 횟수 초과');
          updateConnectionState(WebSocketConnectionState.ERROR);
        }
      };

    } catch (error) {
      console.error('WebSocket 생성 실패:', error);
      setLastError('WebSocket 생성 실패');
      updateConnectionState(WebSocketConnectionState.ERROR);
    }
  }, [
    sessionId,
    finalConfig,
    reconnectAttempts,
    updateConnectionState,
    setupHeartbeat,
    clearHeartbeat,
    setupConnectionTimeout,
    clearConnectionTimeout,
    onMessage,
    onError
  ]);

  // WebSocket 연결 해제
  const disconnect = useCallback(() => {
    console.log('🔌 WebSocket 연결 수동 해제');
    isManuallyClosedRef.current = true;

    // 타이머 정리
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    clearHeartbeat();
    clearConnectionTimeout();

    // WebSocket 연결 종료
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close(1000, '정상 종료');
      }
      wsRef.current = null;
    }

    updateConnectionState(WebSocketConnectionState.DISCONNECTED);
    setReconnectAttempts(0);
  }, [clearHeartbeat, clearConnectionTimeout, updateConnectionState]);

  // 메시지 전송
  const sendMessage = useCallback((message: WebSocketMessage): boolean => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket이 연결되지 않음');
      return false;
    }

    try {
      const messageString = JSON.stringify(message);
      wsRef.current.send(messageString);
      setMessagesSent(prev => prev + 1);
      console.log('📤 메시지 전송:', message.type, message);
      return true;
    } catch (error) {
      console.error('메시지 전송 실패:', error);
      setLastError('메시지 전송 실패');
      return false;
    }
  }, []);

  // 타이핑 데이터 전송
  const sendTypingData = useCallback((data: TypingMessage['data']): boolean => {
    const message: TypingMessage = {
      type: 'typing_data',
      session_id: sessionId,
      data
    };
    return sendMessage(message);
  }, [sessionId, sendMessage]);

  // 하트비트 전송
  const sendHeartbeat = useCallback((): boolean => {
    const message: HeartbeatMessage = {
      type: 'heartbeat',
      session_id: sessionId
    };
    return sendMessage(message);
  }, [sessionId, sendMessage]);

  // 컴포넌트 마운트 시 자동 연결
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [sessionId]); // sessionId가 변경될 때만 재연결

  // cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connectionState,
    sendMessage,
    sendTypingData,
    sendHeartbeat,
    connect,
    disconnect,
    isConnected: connectionState === WebSocketConnectionState.CONNECTED,
    lastError,
    reconnectAttempts,
    messagesReceived,
    messagesSent
  };
}