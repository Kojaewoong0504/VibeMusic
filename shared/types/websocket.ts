/**
 * VibeMusic WebSocket Types
 *
 * AsyncAPI 스펙에서 생성된 TypeScript 타입 정의
 * 실시간 타이핑 패턴 캡처를 위한 WebSocket 메시지 타입들
 */

// ============================================================================
// WebSocket Message Payload Types
// ============================================================================

/**
 * 클라이언트 정보
 */
export interface ClientInfo {
  /** 사용자 에이전트 문자열 */
  user_agent?: string;
  /** 클라이언트 타임존 */
  timezone?: string;
  /** 화면 해상도 */
  screen_resolution?: string;
}

/**
 * WebSocket 연결 초기화 메시지 페이로드
 */
export interface ConnectPayload {
  /** 메시지 타입 식별자 */
  type: 'connect';
  /** 세션 인증 토큰 */
  session_token: string;
  /** 클라이언트 정보 */
  client_info?: ClientInfo;
}

/**
 * 키보드 입력 수정자 키 타입
 */
export type KeyModifier = 'ctrl' | 'alt' | 'shift' | 'meta';

/**
 * 키보드 이벤트 타입
 */
export type KeyEventType = 'keydown' | 'keyup';

/**
 * 개별 키스트로크 정보
 */
export interface WebSocketKeystroke {
  /** 입력된 키 */
  key: string;
  /** 키 입력 시점 (밀리초 타임스탬프) */
  timestamp: number;
  /** 키를 누른 지속 시간 (밀리초) - 선택적 */
  duration?: number;
  /** 키 이벤트 타입 */
  event_type: KeyEventType;
  /** 수정자 키 배열 */
  modifiers?: KeyModifier[];
}

/**
 * 간단한 키스트로크 타입 (호환성을 위해)
 */
export interface Keystroke {
  key: string;
  timestamp: number;
  event_type: 'keydown' | 'keyup';
}

/**
 * 실시간 타이핑 패턴 데이터 메시지 페이로드
 */
export interface TypingPatternPayload {
  /** 메시지 타입 식별자 */
  type: 'typing_pattern';
  /** 순차 ID (패킷 순서 보장용) */
  sequence_id: number;
  /** 클라이언트 타임스탬프 */
  timestamp: number;
  /** 키스트로크 배열 (1-100개) */
  keystrokes: WebSocketKeystroke[];
  /** 현재 타이핑된 텍스트 버퍼 (최대 100자) */
  text_buffer?: string;
}

/**
 * 패턴 수신 상태
 */
export type PatternStatus = 'received' | 'processed' | 'buffered';

/**
 * 서버의 패턴 데이터 수신 확인 메시지 페이로드
 */
export interface PatternAckPayload {
  /** 메시지 타입 식별자 */
  type: 'pattern_ack';
  /** 확인하는 패킷의 sequence_id */
  sequence_id: number;
  /** 서버 수신 시각 */
  server_timestamp: number;
  /** 네트워크 레이턴시 (밀리초) */
  latency_ms?: number;
  /** 처리 상태 */
  status: PatternStatus;
}

/**
 * WebSocket 오류 코드
 */
export type WebSocketErrorCode =
  | 'INVALID_TOKEN'
  | 'SESSION_EXPIRED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INVALID_DATA_FORMAT'
  | 'SERVER_ERROR';

/**
 * WebSocket 오류 메시지 페이로드
 */
export interface ErrorPayload {
  /** 메시지 타입 식별자 */
  type: 'error';
  /** 오류 코드 */
  error_code: WebSocketErrorCode;
  /** 사용자용 오류 메시지 */
  message: string;
  /** 개발자용 상세 정보 */
  details?: Record<string, any>;
  /** 재시도 가능 시간 (초) - 선택적 */
  retry_after?: number;
}

/**
 * 연결 종료 이유
 */
export type DisconnectReason =
  | 'CLIENT_REQUEST'
  | 'SESSION_TIMEOUT'
  | 'SERVER_SHUTDOWN'
  | 'ERROR';

/**
 * 연결 종료 메시지 페이로드
 */
export interface DisconnectPayload {
  /** 메시지 타입 식별자 */
  type: 'disconnect';
  /** 종료 이유 */
  reason: DisconnectReason;
  /** 종료 사유 설명 */
  message?: string;
}

// ============================================================================
// WebSocket Message Union Types
// ============================================================================

/**
 * 클라이언트에서 서버로 전송하는 모든 메시지 타입
 */
export type ClientMessage =
  | ConnectPayload
  | TypingPatternPayload
  | DisconnectPayload;

/**
 * 서버에서 클라이언트로 전송하는 모든 메시지 타입
 */
export type ServerMessage =
  | PatternAckPayload
  | ErrorPayload;

/**
 * 양방향으로 전송 가능한 모든 WebSocket 메시지 타입
 */
export type WebSocketMessage = ClientMessage | ServerMessage;

// ============================================================================
// WebSocket Connection Types
// ============================================================================

/**
 * WebSocket 연결 상태
 */
export type ConnectionState =
  | 'connecting'
  | 'connected'
  | 'authenticated'
  | 'disconnecting'
  | 'disconnected'
  | 'error';

/**
 * WebSocket 연결 설정
 */
export interface WebSocketConfig {
  /** WebSocket 서버 URL */
  url: string;
  /** 세션 토큰 */
  session_token: string;
  /** 연결 타임아웃 (밀리초) */
  connection_timeout?: number;
  /** Keep-alive 간격 (밀리초) */
  keepalive_interval?: number;
  /** 최대 재연결 시도 횟수 */
  max_reconnect_attempts?: number;
  /** 재연결 지연 시간 (밀리초) */
  reconnect_delay?: number;
}

/**
 * WebSocket 연결 정보
 */
export interface ConnectionInfo {
  /** 세션 ID */
  session_id: string;
  /** 연결 상태 */
  state: ConnectionState;
  /** 연결 시작 시각 */
  connected_at?: Date;
  /** 마지막 활동 시각 */
  last_activity?: Date;
  /** 현재 레이턴시 (밀리초) */
  latency?: number;
  /** 전송된 메시지 수 */
  messages_sent: number;
  /** 수신된 메시지 수 */
  messages_received: number;
}

// ============================================================================
// Event Handler Types
// ============================================================================

/**
 * WebSocket 이벤트 핸들러 맵
 */
export interface WebSocketEventHandlers {
  /** 연결 성공 */
  onConnect?: (info: ConnectionInfo) => void;

  /** 연결 종료 */
  onDisconnect?: (reason: DisconnectReason, message?: string) => void;

  /** 오류 발생 */
  onError?: (error: ErrorPayload) => void;

  /** 패턴 확인 수신 */
  onPatternAck?: (ack: PatternAckPayload) => void;

  /** 메시지 수신 (모든 서버 메시지) */
  onMessage?: (message: ServerMessage) => void;

  /** 연결 상태 변경 */
  onStateChange?: (state: ConnectionState) => void;

  /** 레이턴시 업데이트 */
  onLatencyUpdate?: (latency: number) => void;
}

// ============================================================================
// Typing Pattern Processing Types
// ============================================================================

/**
 * 타이핑 패턴 버퍼 설정
 */
export interface PatternBufferConfig {
  /** 버퍼 크기 (키스트로크 수) */
  buffer_size: number;
  /** 전송 간격 (밀리초) */
  send_interval: number;
  /** 최대 대기 시간 (밀리초) */
  max_wait_time: number;
  /** 중복 제거 활성화 */
  deduplication_enabled: boolean;
}

/**
 * 타이핑 패턴 통계
 */
export interface TypingStatistics {
  /** 총 키스트로크 수 */
  total_keystrokes: number;
  /** 평균 타이핑 속도 (WPM) */
  average_wpm: number;
  /** 타이핑 세션 시작 시각 */
  session_start: Date;
  /** 마지막 키 입력 시각 */
  last_keystroke: Date;
  /** 일시정지 횟수 */
  pause_count: number;
  /** 총 일시정지 시간 (밀리초) */
  total_pause_time: number;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * 메시지 타입 추출 유틸리티
 */
export type MessageType<T> = T extends { type: infer U } ? U : never;

/**
 * 키스트로크 배치 타입
 */
export type KeystrokeBatch = WebSocketKeystroke[];

/**
 * 시퀀스 ID 타입 (순서 보장용)
 */
export type SequenceId = number;

/**
 * 타임스탬프 타입 (밀리초)
 */
export type TimestampMs = number;

/**
 * WebSocket 연결 URL 생성 함수 타입
 */
export type WebSocketUrlGenerator = (sessionId: string, token: string) => string;

/**
 * 메시지 직렬화 함수 타입
 */
export type MessageSerializer<T> = (message: T) => string;

/**
 * 메시지 역직렬화 함수 타입
 */
export type MessageDeserializer<T> = (data: string) => T;