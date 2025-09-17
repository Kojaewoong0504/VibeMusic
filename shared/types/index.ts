/**
 * VibeMusic Shared Types - Entry Point
 *
 * 프로젝트 전체에서 공유되는 TypeScript 타입 정의들의 메인 엔트리 포인트
 * 백엔드와 프론트엔드에서 공통으로 사용되는 타입들을 중앙 집중식으로 관리
 *
 * OpenAPI와 AsyncAPI 스펙을 기반으로 자동 생성된 정확한 타입 정의들을 제공
 */

// ============================================================================
// API 관련 타입들 (OpenAPI 스펙 기반)
// ============================================================================
export * from './api';

// ============================================================================
// WebSocket 관련 타입들 (AsyncAPI 스펙 기반)
// ============================================================================
export * from './websocket';

// ============================================================================
// 프론트엔드 전용 상태 관리 타입들
// ============================================================================

/**
 * 전체 애플리케이션 상태
 */
export interface AppState {
  /** 현재 활성 세션 */
  currentSession: UserSession | null;
  /** WebSocket 연결 상태 */
  isConnected: boolean;
  /** 현재 분석된 감정 프로필 */
  currentEmotion: EmotionProfile | null;
  /** 생성된 음악 정보 */
  generatedMusic: GeneratedMusic | null;
  /** 음악 생성 중 여부 */
  isGenerating: boolean;
  /** 연결 정보 */
  connectionInfo?: ConnectionInfo;
  /** 타이핑 통계 */
  typingStats?: TypingStatistics;
}

// Re-export commonly used types for convenience
export type {
  // From api.ts
  UUID,
  DateTimeString,
  UserSession,
  EmotionProfile,
  GeneratedMusic,
  ApiError,
  AudioFormat,
  SessionStatus,
  MusicStatus,

  // From websocket.ts
  TimestampMs,
  SequenceId,
  ConnectionState,
  WebSocketMessage,
  ClientMessage,
  ServerMessage,
  WebSocketEventHandlers,
  TypingStatistics,
  ConnectionInfo
} from './api';