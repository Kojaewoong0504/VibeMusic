/**
 * VibeMusic API Types
 *
 * OpenAPI 스펙에서 생성된 TypeScript 타입 정의
 * 감정 기반 AI 음악 생성 서비스의 REST API 타입들
 */

// ============================================================================
// Core Domain Types
// ============================================================================

/**
 * 키보드 입력 이벤트 데이터
 */
export interface Keystroke {
  /** 입력된 키 */
  key: string;
  /** 타임스탬프 (밀리초) */
  timestamp: number;
  /** 키를 누른 지속 시간 (밀리초) - 선택적 */
  duration?: number;
  /** 키 이벤트 타입 */
  type: 'keydown' | 'keyup';
}

/**
 * 감정 벡터 정보
 */
export interface EmotionVector {
  /** 에너지 레벨 (0.0 - 1.0) */
  energy: number;
  /** 감정 극성 (-1.0 - 1.0, 음수: 부정, 양수: 긍정) */
  valence: number;
  /** 긴장도 (0.0 - 1.0) */
  tension: number;
  /** 집중도 (0.0 - 1.0) */
  focus: number;
}

/**
 * 타이핑 패턴 분석 결과 - 감정 프로필
 */
export interface EmotionProfile {
  /** 감정 프로필 ID */
  id: string;
  /** 타이핑 속도 점수 (0.0 - 1.0) */
  tempo_score: number;
  /** 타이핑 리듬 일관성 (0.0 - 1.0) */
  rhythm_consistency: number;
  /** 일시정지 강도 (0.0 - 1.0) */
  pause_intensity: number;
  /** 다차원 감정 벡터 */
  emotion_vector: EmotionVector;
  /** 분석 결과 신뢰도 (0.0 - 1.0) */
  confidence_score: number;
  /** 생성 시각 */
  created_at: string;
}

/**
 * 생성된 음악 메타데이터
 */
export interface GeneratedMusic {
  /** 음악 ID */
  id: string;
  /** 다운로드 URL */
  file_url: string;
  /** 파일 크기 (바이트) */
  file_size: number;
  /** 재생 시간 (초) */
  duration: number;
  /** 오디오 포맷 */
  format: 'wav' | 'mp3' | 'flac';
  /** 샘플링 레이트 */
  sample_rate: number;
  /** 생성에 소요된 시간 (초) */
  generation_time: number;
  /** AI 생성 품질 점수 (0.0 - 1.0) */
  quality_score: number;
  /** 생성 상태 */
  status: 'generating' | 'completed' | 'failed';
  /** 생성 시작 시각 */
  created_at: string;
  /** 생성 완료 시각 */
  completed_at: string | null;
}

/**
 * 사용자 세션 정보
 */
export interface UserSession {
  /** 세션 ID */
  id: string;
  /** 세션 상태 */
  status: 'active' | 'completed' | 'abandoned';
  /** 세션 시작 시각 */
  start_time: string;
  /** 총 타이핑 시간 (초) */
  total_typing_time: number;
  /** 생성된 음악 개수 */
  total_music_generated: number;
  /** 자동 삭제 예정 시각 */
  auto_delete_at: string;
}

/**
 * API 오류 응답
 */
export interface ApiError {
  /** 오류 코드 */
  error: string;
  /** 사용자용 오류 메시지 */
  message: string;
  /** 개발자용 추가 세부사항 */
  details?: Record<string, any>;
}

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * 새 세션 생성 요청
 */
export interface CreateSessionRequest {
  /** 데이터 수집 동의 여부 */
  consent_given: boolean;
  /** 자동 삭제까지의 시간 (시간 단위, 1-168) */
  auto_delete_hours?: number;
}

/**
 * 새 세션 생성 응답
 */
export interface CreateSessionResponse {
  /** 생성된 세션 ID */
  session_id: string;
  /** WebSocket 연결용 인증 토큰 */
  session_token: string;
  /** 자동 삭제 예정 시각 */
  auto_delete_at: string;
}

/**
 * 타이핑 패턴 분석 요청
 */
export interface AnalyzePatternRequest {
  /** 키스트로크 데이터 배열 (최소 10개) */
  keystrokes: Keystroke[];
  /** 타이핑된 텍스트 내용 (10-1000자) */
  text_content: string;
}

/**
 * 타이핑 패턴 분석 응답
 */
export interface AnalyzePatternResponse {
  /** 생성된 패턴 ID */
  pattern_id: string;
  /** 분석된 감정 프로필 */
  emotion_profile: EmotionProfile;
}

/**
 * AI 음악 생성 매개변수
 */
export interface GenerationParameters {
  /** 음악 길이 (초, 15-120) */
  duration?: number;
  /** 출력 포맷 */
  format?: 'wav' | 'mp3' | 'flac';
  /** 장르 힌트 (최대 50자) */
  genre_hint?: string;
}

/**
 * AI 음악 생성 요청
 */
export interface GenerateMusicRequest {
  /** 텍스트 프롬프트 (10-500자) */
  text_prompt: string;
  /** 감정 프로필 ID */
  emotion_profile_id: string;
  /** 생성 매개변수 */
  generation_parameters?: GenerationParameters;
}

/**
 * AI 음악 생성 요청 접수 응답
 */
export interface GenerateMusicResponse {
  /** 생성 작업 ID */
  music_id: string;
  /** 예상 완료 시간 (초) */
  estimated_completion_time: number;
}

/**
 * 음악 생성 진행 상태 응답
 */
export interface MusicGenerationStatus {
  /** 현재 상태 */
  status: 'generating';
  /** 진행률 (0-100) */
  progress: number;
}

// ============================================================================
// API Client Types
// ============================================================================

/**
 * API 응답의 공통 래퍼 타입
 */
export type ApiResponse<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: ApiError;
};

/**
 * HTTP 메서드 타입
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * API 엔드포인트 경로 매핑
 */
export interface ApiEndpoints {
  // 세션 관리
  createSession: '/sessions';
  getSession: '/sessions/{session_id}';

  // 패턴 분석
  analyzePattern: '/sessions/{session_id}/analyze';

  // 음악 생성
  generateMusic: '/sessions/{session_id}/generate';
  getMusicStatus: '/sessions/{session_id}/music/{music_id}';
  downloadMusic: '/sessions/{session_id}/music/{music_id}/download';
}

/**
 * 세션 인증 헤더 타입
 */
export interface SessionAuth {
  'Authorization': `Bearer ${string}`;
}

/**
 * API 요청 설정
 */
export interface ApiRequestConfig {
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  data?: any;
  params?: Record<string, string | number>;
  timeout?: number;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * UUID 문자열 타입 (타입 안전성을 위한 브랜딩)
 */
export type UUID = string & { readonly __brand: unique symbol };

/**
 * 날짜 시간 문자열 타입 (ISO 8601)
 */
export type DateTimeString = string & { readonly __dateTime: unique symbol };

/**
 * 오디오 MIME 타입
 */
export type AudioMimeType =
  | 'audio/wav'
  | 'audio/mpeg'  // MP3
  | 'audio/flac';

/**
 * 세션 상태 유니언 타입
 */
export type SessionStatus = UserSession['status'];

/**
 * 음악 생성 상태 유니언 타입
 */
export type MusicStatus = GeneratedMusic['status'];

/**
 * 키 이벤트 타입 유니언
 */
export type KeyEventType = Keystroke['type'];

/**
 * 오디오 포맷 유니언 타입
 */
export type AudioFormat = GeneratedMusic['format'];