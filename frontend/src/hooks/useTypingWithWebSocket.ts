/**
 * T005: 타이핑 캡처와 WebSocket 실시간 통신 통합 훅
 * 타이핑 이벤트를 캡처하고 실시간으로 서버에 전송
 */

import { useState, useEffect, useCallback } from 'react';
import { useEnhancedTypingCapture } from './useEnhancedTypingCapture';
import { useWebSocket } from './useWebSocket';
import {
  TypingEvent,
  TypingPattern,
  WebSocketMessage,
  WebSocketConnectionState,
  EmotionMessage,
  ProcessedMessage
} from './types';

interface UseTypingWithWebSocketOptions {
  sessionId: string;
  enabled?: boolean;
  autoConnect?: boolean;
  typingConfig?: {
    bufferSize?: number;
    analysisWindowMs?: number;
    performanceMode?: boolean;
  };
  websocketConfig?: {
    url?: string;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
    heartbeatInterval?: number;
  };
}

interface UseTypingWithWebSocketReturn {
  // 타이핑 캡처 상태
  events: TypingEvent[];
  pattern: TypingPattern | null;
  isCapturing: boolean;
  performanceMetrics: {
    processingTime: number;
    eventCount: number;
    averageProcessingTime: number;
  };

  // WebSocket 연결 상태
  connectionState: WebSocketConnectionState;
  isConnected: boolean;
  lastError: string | null;
  reconnectAttempts: number;

  // 서버 응답 데이터
  emotionData: EmotionMessage['data'] | null;
  processingStats: ProcessedMessage['data'] | null;

  // 제어 함수
  startCapture: () => void;
  stopCapture: () => void;
  clearBuffer: () => void;
  connect: () => void;
  disconnect: () => void;

  // 통계
  messagesReceived: number;
  messagesSent: number;
  totalTypingEvents: number;
}

export function useTypingWithWebSocket(
  options: UseTypingWithWebSocketOptions
): UseTypingWithWebSocketReturn {
  const {
    sessionId,
    enabled = false,
    autoConnect = true,
    typingConfig = {},
    websocketConfig = {}
  } = options;

  // 서버 응답 데이터 상태
  const [emotionData, setEmotionData] = useState<EmotionMessage['data'] | null>(null);
  const [processingStats, setProcessingStats] = useState<ProcessedMessage['data'] | null>(null);
  const [totalTypingEvents, setTotalTypingEvents] = useState(0);

  // WebSocket 메시지 핸들러
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    console.log('🎯 WebSocket 메시지 수신:', message.type, message);

    switch (message.type) {
      case 'emotion_update':
        const emotionMsg = message as EmotionMessage;
        setEmotionData(emotionMsg.data);
        console.log('💭 감정 데이터 업데이트:', emotionMsg.data);
        break;

      case 'typing_data_processed':
        const processedMsg = message as ProcessedMessage;
        setProcessingStats(processedMsg.data);
        console.log('📊 처리 통계 업데이트:', processedMsg.data);
        break;

      case 'connection_established':
        console.log('✅ WebSocket 연결 확인');
        break;

      case 'error':
        console.error('❌ 서버 에러:', message);
        break;

      default:
        console.log('🔍 알 수 없는 메시지 타입:', message.type);
    }
  }, []);

  // WebSocket 훅
  const {
    connectionState,
    sendTypingData,
    connect,
    disconnect,
    isConnected,
    lastError,
    reconnectAttempts,
    messagesReceived,
    messagesSent
  } = useWebSocket({
    sessionId,
    config: websocketConfig,
    onMessage: handleWebSocketMessage,
    autoConnect
  });

  // 타이핑 캡처 훅
  const {
    events,
    pattern,
    isCapturing,
    startCapture,
    stopCapture,
    clearBuffer,
    performanceMetrics
  } = useEnhancedTypingCapture({
    enabled,
    ...typingConfig
  });

  // 타이핑 이벤트를 WebSocket으로 전송
  useEffect(() => {
    if (!isConnected || events.length === 0) {
      return;
    }

    // 마지막 이벤트만 전송 (실시간)
    const lastEvent = events[events.length - 1];

    const success = sendTypingData({
      keystroke: lastEvent.key,
      timestamp: lastEvent.timestamp,
      duration: lastEvent.duration,
      interval: lastEvent.interval,
      isBackspace: lastEvent.isBackspace
    });

    if (success) {
      setTotalTypingEvents(prev => prev + 1);
      console.log('📤 타이핑 데이터 전송:', {
        key: lastEvent.key,
        timestamp: lastEvent.timestamp,
        duration: lastEvent.duration,
        interval: lastEvent.interval,
        isBackspace: lastEvent.isBackspace
      });
    }
  }, [events, isConnected, sendTypingData]);

  // 연결 상태 변화 로그
  useEffect(() => {
    console.log('🔗 WebSocket 연결 상태 변화:', connectionState);
  }, [connectionState]);

  // 감정 데이터 변화 로그
  useEffect(() => {
    if (emotionData) {
      console.log('💭 감정 데이터 업데이트:', emotionData);
    }
  }, [emotionData]);

  return {
    // 타이핑 캡처 상태
    events,
    pattern,
    isCapturing,
    performanceMetrics,

    // WebSocket 연결 상태
    connectionState,
    isConnected,
    lastError,
    reconnectAttempts,

    // 서버 응답 데이터
    emotionData,
    processingStats,

    // 제어 함수
    startCapture,
    stopCapture,
    clearBuffer,
    connect,
    disconnect,

    // 통계
    messagesReceived,
    messagesSent,
    totalTypingEvents
  };
}