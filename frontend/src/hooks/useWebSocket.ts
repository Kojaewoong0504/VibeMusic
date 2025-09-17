import { useState, useEffect, useCallback, useRef } from 'react';
import { WebSocketMessage, WebSocketConfig } from './types';

interface UseWebSocketOptions extends Partial<WebSocketConfig> {
  autoConnect?: boolean;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

interface UseWebSocketReturn {
  socket: WebSocket | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  sendMessage: (message: WebSocketMessage) => boolean;
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;
  messageQueue: WebSocketMessage[];
}

export function useWebSocket(url: string, options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    autoConnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    heartbeatInterval = 30000,
    onMessage,
    onConnect,
    onDisconnect,
    onError
  } = options;

  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageQueue, setMessageQueue] = useState<WebSocketMessage[]>([]);

  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const messageQueueRef = useRef<WebSocketMessage[]>([]);

  // 메시지 큐 동기화
  useEffect(() => {
    messageQueueRef.current = messageQueue;
  }, [messageQueue]);

  // 하트비트 전송
  const sendHeartbeat = useCallback(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      const heartbeatMessage: WebSocketMessage = {
        type: 'session',
        data: { action: 'ping' },
        timestamp: Date.now()
      };
      socket.send(JSON.stringify(heartbeatMessage));
    }
  }, [socket]);

  // 하트비트 인터벌 시작
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    if (heartbeatInterval > 0) {
      heartbeatIntervalRef.current = setInterval(sendHeartbeat, heartbeatInterval);
    }
  }, [sendHeartbeat, heartbeatInterval]);

  // 하트비트 인터벌 중지
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // 큐에 저장된 메시지 전송
  const flushMessageQueue = useCallback(() => {
    if (socket && socket.readyState === WebSocket.OPEN && messageQueueRef.current.length > 0) {
      messageQueueRef.current.forEach(message => {
        socket.send(JSON.stringify(message));
      });
      setMessageQueue([]);
      messageQueueRef.current = [];
    }
  }, [socket]);

  // 재연결 로직
  const scheduleReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current < maxReconnectAttempts) {
      reconnectAttemptsRef.current += 1;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      const delay = reconnectInterval * Math.pow(1.5, reconnectAttemptsRef.current - 1); // Exponential backoff
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);
    }
  }, [maxReconnectAttempts, reconnectInterval]);

  // WebSocket 연결
  const connect = useCallback(() => {
    if (socket && socket.readyState === WebSocket.CONNECTING) {
      return; // 이미 연결 시도 중
    }

    if (socket && socket.readyState === WebSocket.OPEN) {
      return; // 이미 연결됨
    }

    setIsConnecting(true);
    setError(null);

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        reconnectAttemptsRef.current = 0;

        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }

        startHeartbeat();
        flushMessageQueue();
        onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          onMessage?.(message);
        } catch (error) {
          console.error('WebSocket 메시지 파싱 오류:', error);
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        setIsConnecting(false);
        stopHeartbeat();

        if (!event.wasClean) {
          setError(`연결이 비정상적으로 종료됨: ${event.reason}`);
          scheduleReconnect();
        }

        onDisconnect?.();
      };

      ws.onerror = (event) => {
        setError('WebSocket 연결 오류');
        setIsConnecting(false);
        stopHeartbeat();
        onError?.(event);
      };

      setSocket(ws);

    } catch (error) {
      setError(`연결 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      setIsConnecting(false);
    }
  }, [url, onConnect, onMessage, onDisconnect, onError, startHeartbeat, flushMessageQueue, scheduleReconnect, stopHeartbeat]);

  // WebSocket 연결 해제
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    stopHeartbeat();

    if (socket) {
      socket.close(1000, '사용자가 연결을 종료함');
      setSocket(null);
    }

    setIsConnected(false);
    setIsConnecting(false);
    reconnectAttemptsRef.current = 0;
  }, [socket, stopHeartbeat]);

  // 재연결
  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(connect, 100); // 짧은 지연 후 재연결
  }, [disconnect, connect]);

  // 메시지 전송
  const sendMessage = useCallback((message: WebSocketMessage): boolean => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error('메시지 전송 실패:', error);
        return false;
      }
    } else {
      // 연결되지 않은 경우 큐에 저장
      setMessageQueue(prev => [...prev, message]);
      messageQueueRef.current = [...messageQueueRef.current, message];
      return false;
    }
  }, [socket]);

  // 자동 연결
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect]); // connect, disconnect 의존성 제거하여 무한 루프 방지

  // 컴포넌트 언마운트시 정리
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      stopHeartbeat();
      if (socket) {
        socket.close();
      }
    };
  }, []); // 빈 의존성 배열로 마운트/언마운트시에만 실행

  return {
    socket,
    isConnected,
    isConnecting,
    error,
    sendMessage,
    connect,
    disconnect,
    reconnect,
    messageQueue
  };
}