// 공통 타입 정의 - T004 요구사항에 맞게 개선
export interface TypingEvent {
  key: string;
  timestamp: number;
  duration: number;  // 키 누름 시간 (ms)
  interval: number;  // 이전 키와의 간격 (ms)
  isBackspace: boolean;
  keyCode?: number; // 하위 호환성을 위해 선택적으로 유지
  isKeyDown?: boolean; // 하위 호환성을 위해 선택적으로 유지
}

export interface TypingPattern {
  events: TypingEvent[]; // T004 요구사항: 이벤트 배열 포함
  averageSpeed: number;    // WPM (Words Per Minute) - T004 요구사항
  rhythmVariation: number; // 리듬 변화도 - T004 요구사항
  pausePattern: number[];  // 일시정지 패턴 - T004 요구사항
  // 기존 필드들도 유지 (하위 호환성)
  speed?: number;
  rhythm?: number;
  pauses?: number[];
  consistency?: number;
  pressure?: number;
}

export interface EmotionVector {
  energy: number; // 에너지 레벨 0-1
  tension: number; // 긴장도 0-1
  focus: number; // 집중도 0-1
  creativity: number; // 창의성 0-1
  calmness: number; // 차분함 0-1
}

export interface SessionData {
  id: string;
  startTime: Date;
  isActive: boolean;
  autoDeleteAt: Date;
  generatedMusicCount: number;
}

// WebSocket 메시지 프로토콜 정의 (T005 요구사항)
export interface TypingMessage {
  type: 'typing_data';
  session_id: string;
  data: {
    keystroke: string;
    timestamp: number;
    duration: number;
    interval: number;
    isBackspace: boolean;
  };
}

export interface EmotionMessage {
  type: 'emotion_update';
  session_id: string;
  data: {
    energy: number;
    valence: number;
    tension: number;
    focus: number;
  };
  timestamp?: string;
}

export interface HeartbeatMessage {
  type: 'heartbeat';
  session_id?: string;
}

export interface ConnectionMessage {
  type: 'connection_established';
  message: string;
  session_id: string;
  timestamp?: string;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
  session_id?: string;
  timestamp?: string;
}

export interface ProcessedMessage {
  type: 'typing_data_processed';
  data: {
    buffer_size: number;
    patterns_detected: string[];
    emotion_score?: any;
  };
  timestamp?: string;
}

// 모든 WebSocket 메시지 타입
export type WebSocketMessage =
  | TypingMessage
  | EmotionMessage
  | HeartbeatMessage
  | ConnectionMessage
  | ErrorMessage
  | ProcessedMessage;

// WebSocket 연결 상태
export enum WebSocketConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

export interface WebSocketConfig {
  url: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  connectionTimeout: number;
}

export interface EmotionAnalysisConfig {
  updateInterval: number; // ms
  windowSize: number; // 분석할 타이핑 이벤트 윈도우 크기
  animationDuration: number; // ms
  smoothingFactor: number; // 0-1, 감정 변화 부드러움
}