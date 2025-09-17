// 공통 타입 정의
export interface TypingEvent {
  key: string;
  timestamp: number;
  keyCode: number;
  isKeyDown: boolean;
}

export interface TypingPattern {
  speed: number; // WPM (Words Per Minute)
  rhythm: number; // 타이핑 리듬 점수 0-1
  pauses: number[]; // 일시정지 시간 배열 (ms)
  consistency: number; // 일관성 점수 0-1
  pressure: number; // 타이핑 강도 0-1
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

export interface WebSocketMessage {
  type: 'typing' | 'emotion' | 'session' | 'music' | 'error';
  data: any;
  timestamp: number;
}

export interface WebSocketConfig {
  url: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
}

export interface EmotionAnalysisConfig {
  updateInterval: number; // ms
  windowSize: number; // 분석할 타이핑 이벤트 윈도우 크기
  animationDuration: number; // ms
  smoothingFactor: number; // 0-1, 감정 변화 부드러움
}