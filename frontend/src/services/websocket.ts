// WebSocket 관리자 서비스 - 바이브뮤직
// 연결 상태 관리, 메시지 라우팅, 백프레셔 큐잉

import { WebSocketMessage } from '../hooks/types';

export type MessageHandler<T = any> = (data: T) => void | Promise<void>;
export type ErrorHandler = (error: Error) => void;
export type ConnectionHandler = () => void;

export interface MessageRoute {
  type: string;
  handler: MessageHandler;
  priority?: number; // 높을수록 우선순위 높음
}

export interface QueuedMessage {
  message: WebSocketMessage;
  timestamp: number;
  priority: number;
  retryCount: number;
}

export interface WebSocketManagerConfig {
  url: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  maxQueueSize: number;
  backpressureThreshold: number;
  messageTimeout: number;
  enableCompression?: boolean;
}

export interface ConnectionStats {
  connectedAt: Date | null;
  reconnectCount: number;
  messagesSent: number;
  messagesReceived: number;
  bytesTransferred: number;
  latency: number;
  errorCount: number;
}

export interface BackpressureInfo {
  isEnabled: boolean;
  queueLength: number;
  threshold: number;
  droppedMessages: number;
}

class WebSocketManager {
  private socket: WebSocket | null = null;
  private config: WebSocketManagerConfig;
  private routes: Map<string, MessageRoute[]> = new Map();
  private messageQueue: QueuedMessage[] = [];
  private isConnected = false;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  // 이벤트 핸들러
  private onConnectHandlers: ConnectionHandler[] = [];
  private onDisconnectHandlers: ConnectionHandler[] = [];
  private onErrorHandlers: ErrorHandler[] = [];

  // 통계 및 모니터링
  private stats: ConnectionStats = {
    connectedAt: null,
    reconnectCount: 0,
    messagesSent: 0,
    messagesReceived: 0,
    bytesTransferred: 0,
    latency: 0,
    errorCount: 0
  };

  private backpressure: BackpressureInfo = {
    isEnabled: false,
    queueLength: 0,
    threshold: 0,
    droppedMessages: 0
  };

  private latencyBuffer: number[] = [];
  private lastPingTime: number = 0;

  constructor(config: WebSocketManagerConfig) {
    this.config = config;
    this.backpressure.threshold = config.backpressureThreshold;
  }

  // 연결 상태 확인
  get connectionState(): 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR' {
    if (this.isConnecting) return 'CONNECTING';
    if (this.isConnected && this.socket?.readyState === WebSocket.OPEN) return 'CONNECTED';
    if (this.socket?.readyState === WebSocket.CLOSED) return 'DISCONNECTED';
    return 'ERROR';
  }

  // 통계 정보 반환
  getStats(): ConnectionStats {
    return { ...this.stats };
  }

  // 백프레셔 정보 반환
  getBackpressureInfo(): BackpressureInfo {
    this.backpressure.queueLength = this.messageQueue.length;
    return { ...this.backpressure };
  }

  // 연결
  connect(): void {
    if (this.isConnecting || this.isConnected) {
      return;
    }

    this.isConnecting = true;
    this.clearReconnectTimeout();

    try {
      this.socket = new WebSocket(this.config.url);

      this.socket.onopen = this.handleOpen.bind(this);
      this.socket.onmessage = this.handleMessage.bind(this);
      this.socket.onclose = this.handleClose.bind(this);
      this.socket.onerror = this.handleError.bind(this);

    } catch (error) {
      this.isConnecting = false;
      this.handleError(new Error(`연결 실패: ${error}`));
    }
  }

  // 연결 해제
  disconnect(): void {
    this.clearReconnectTimeout();
    this.stopHeartbeat();

    if (this.socket) {
      this.socket.close(1000, '사용자가 연결을 종료함');
      this.socket = null;
    }

    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.messageQueue.length = 0;
  }

  // 메시지 라우트 등록
  addRoute(type: string, handler: MessageHandler, priority: number = 0): void {
    const route: MessageRoute = { type, handler, priority };

    if (!this.routes.has(type)) {
      this.routes.set(type, []);
    }

    const routes = this.routes.get(type)!;
    routes.push(route);

    // 우선순위 순으로 정렬 (높은 우선순위가 먼저)
    routes.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  // 메시지 라우트 제거
  removeRoute(type: string, handler: MessageHandler): void {
    const routes = this.routes.get(type);
    if (routes) {
      const index = routes.findIndex(route => route.handler === handler);
      if (index !== -1) {
        routes.splice(index, 1);

        if (routes.length === 0) {
          this.routes.delete(type);
        }
      }
    }
  }

  // 이벤트 핸들러 등록
  onConnect(handler: ConnectionHandler): void {
    this.onConnectHandlers.push(handler);
  }

  onDisconnect(handler: ConnectionHandler): void {
    this.onDisconnectHandlers.push(handler);
  }

  onError(handler: ErrorHandler): void {
    this.onErrorHandlers.push(handler);
  }

  // 메시지 전송
  sendMessage(message: WebSocketMessage, priority: number = 0): boolean {
    const queuedMessage: QueuedMessage = {
      message,
      timestamp: Date.now(),
      priority,
      retryCount: 0
    };

    // 백프레셔 확인
    if (this.messageQueue.length >= this.config.backpressureThreshold) {
      this.backpressure.isEnabled = true;

      // 낮은 우선순위 메시지 드롭
      if (priority < 5 && this.messageQueue.length >= this.config.maxQueueSize) {
        this.backpressure.droppedMessages++;
        return false;
      }
    } else {
      this.backpressure.isEnabled = false;
    }

    // 연결된 상태면 즉시 전송
    if (this.isConnected && this.socket?.readyState === WebSocket.OPEN) {
      return this.sendImmediately(queuedMessage);
    }

    // 큐에 추가
    this.addToQueue(queuedMessage);
    return true;
  }

  // 즉시 전송
  private sendImmediately(queuedMessage: QueuedMessage): boolean {
    try {
      const messageString = JSON.stringify(queuedMessage.message);
      this.socket!.send(messageString);

      this.stats.messagesSent++;
      this.stats.bytesTransferred += messageString.length;

      return true;
    } catch (error) {
      console.error('메시지 전송 실패:', error);
      this.addToQueue(queuedMessage);
      return false;
    }
  }

  // 큐에 메시지 추가
  private addToQueue(queuedMessage: QueuedMessage): void {
    this.messageQueue.push(queuedMessage);

    // 우선순위와 타임스탬프 기준으로 정렬
    this.messageQueue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority; // 높은 우선순위 먼저
      }
      return a.timestamp - b.timestamp; // 오래된 것 먼저
    });

    // 큐 크기 제한
    if (this.messageQueue.length > this.config.maxQueueSize) {
      const dropped = this.messageQueue.splice(this.config.maxQueueSize);
      this.backpressure.droppedMessages += dropped.length;
    }
  }

  // 큐에서 메시지 전송
  private flushQueue(): void {
    if (!this.isConnected || this.socket?.readyState !== WebSocket.OPEN) {
      return;
    }

    const now = Date.now();
    const toSend = [...this.messageQueue];
    this.messageQueue.length = 0;

    for (const queuedMessage of toSend) {
      // 메시지 타임아웃 확인
      if (now - queuedMessage.timestamp > this.config.messageTimeout) {
        continue; // 타임아웃된 메시지 스킵
      }

      if (!this.sendImmediately(queuedMessage)) {
        // 전송 실패시 재시도
        queuedMessage.retryCount++;
        if (queuedMessage.retryCount < 3) {
          this.messageQueue.push(queuedMessage);
        }
      }
    }
  }

  // WebSocket 이벤트 핸들러들
  private handleOpen(): void {
    this.isConnected = true;
    this.isConnecting = false;
    this.stats.connectedAt = new Date();
    this.reconnectAttempts = 0;

    this.startHeartbeat();
    this.flushQueue();

    this.onConnectHandlers.forEach(handler => {
      try {
        handler();
      } catch (error) {
        console.error('Connection handler error:', error);
      }
    });
  }

  private async handleMessage(event: MessageEvent): Promise<void> {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      this.stats.messagesReceived++;
      this.stats.bytesTransferred += event.data.length;

      // Pong 응답 처리 (레이턴시 계산)
      if (message.type === 'session' && message.data?.action === 'pong') {
        const latency = Date.now() - this.lastPingTime;
        this.updateLatency(latency);
        return;
      }

      // 라우팅
      await this.routeMessage(message);

    } catch (error) {
      console.error('메시지 처리 오류:', error);
      this.stats.errorCount++;
    }
  }

  private handleClose(event: CloseEvent): void {
    this.isConnected = false;
    this.stopHeartbeat();
    this.stats.connectedAt = null;

    this.onDisconnectHandlers.forEach(handler => {
      try {
        handler();
      } catch (error) {
        console.error('Disconnect handler error:', error);
      }
    });

    // 비정상 종료시 재연결 시도
    if (!event.wasClean && this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  private handleError(error: Event | Error): void {
    this.stats.errorCount++;

    const errorObj = error instanceof Error ? error : new Error('WebSocket error');

    this.onErrorHandlers.forEach(handler => {
      try {
        handler(errorObj);
      } catch (err) {
        console.error('Error handler error:', err);
      }
    });
  }

  // 메시지 라우팅
  private async routeMessage(message: WebSocketMessage): Promise<void> {
    const routes = this.routes.get(message.type);
    if (!routes || routes.length === 0) {
      console.warn(`처리할 수 없는 메시지 타입: ${message.type}`);
      return;
    }

    // 모든 핸들러 실행 (우선순위 순)
    const promises = routes.map(route => {
      try {
        return Promise.resolve(route.handler(message.data));
      } catch (error) {
        console.error(`Route handler error for type ${message.type}:`, error);
        return Promise.resolve();
      }
    });

    await Promise.allSettled(promises);
  }

  // 하트비트 시작
  private startHeartbeat(): void {
    this.stopHeartbeat();

    if (this.config.heartbeatInterval > 0) {
      this.heartbeatInterval = setInterval(() => {
        this.sendPing();
      }, this.config.heartbeatInterval);
    }
  }

  // 하트비트 중지
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Ping 전송
  private sendPing(): void {
    if (this.isConnected) {
      this.lastPingTime = Date.now();
      const pingMessage: WebSocketMessage = {
        type: 'session',
        data: { action: 'ping' },
        timestamp: this.lastPingTime
      };
      this.sendMessage(pingMessage, 10); // 높은 우선순위
    }
  }

  // 레이턴시 업데이트
  private updateLatency(latency: number): void {
    this.latencyBuffer.push(latency);

    // 최근 10개 레이턴시 평균 계산
    if (this.latencyBuffer.length > 10) {
      this.latencyBuffer.shift();
    }

    this.stats.latency = this.latencyBuffer.reduce((sum, l) => sum + l, 0) / this.latencyBuffer.length;
  }

  // 재연결 스케줄링
  private scheduleReconnect(): void {
    this.clearReconnectTimeout();
    this.reconnectAttempts++;
    this.stats.reconnectCount++;

    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      30000 // 최대 30초
    );

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  // 재연결 타이머 정리
  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
}

// 기본 WebSocket 관리자 인스턴스
const defaultConfig: WebSocketManagerConfig = {
  url: process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws',
  reconnectInterval: 3000,
  maxReconnectAttempts: 5,
  heartbeatInterval: 30000,
  maxQueueSize: 1000,
  backpressureThreshold: 100,
  messageTimeout: 60000, // 1분
  enableCompression: true
};

export const websocketManager = new WebSocketManager(defaultConfig);

// 바이브뮤직 특화 메시지 헬퍼
export const vibemusicWebSocket = {
  // 타이핑 이벤트 전송
  sendTypingEvent: (sessionId: string, typingData: any) => {
    const message: WebSocketMessage = {
      type: 'typing',
      data: { sessionId, ...typingData },
      timestamp: Date.now()
    };
    return websocketManager.sendMessage(message, 8); // 높은 우선순위
  },

  // 감정 데이터 전송
  sendEmotionData: (sessionId: string, emotionData: any) => {
    const message: WebSocketMessage = {
      type: 'emotion',
      data: { sessionId, ...emotionData },
      timestamp: Date.now()
    };
    return websocketManager.sendMessage(message, 7);
  },

  // 세션 상태 업데이트 전송
  sendSessionUpdate: (sessionId: string, updateData: any) => {
    const message: WebSocketMessage = {
      type: 'session',
      data: { sessionId, action: 'update', ...updateData },
      timestamp: Date.now()
    };
    return websocketManager.sendMessage(message, 6);
  },

  // 음악 생성 요청
  requestMusicGeneration: (sessionId: string, generationData: any) => {
    const message: WebSocketMessage = {
      type: 'music',
      data: { sessionId, action: 'generate', ...generationData },
      timestamp: Date.now()
    };
    return websocketManager.sendMessage(message, 5);
  }
};

export { WebSocketManager };