/**
 * VibeMusic Pages - Entry Point
 *
 * 감정 기반 AI 음악 생성 서비스의 모든 페이지 컴포넌트 내보내기
 * 편리한 import를 위한 통합 인덱스 파일
 */

// Page Components (T061-T063)
export { default as MainPage } from './MainPage';
export { default as MusicGenerationPage } from './MusicGenerationPage';
export { default as ResultPage } from './ResultPage';

// Type exports for page props
export type { MainPageProps } from './MainPage';
export type {
  MusicGenerationPageProps,
  SessionState,
  EmotionData,
  TypingData,
  GenerationState,
} from './MusicGenerationPage';
export type {
  ResultPageProps,
  MusicMetadata,
  EmotionProfile,
  GenerationInfo,
  DownloadOptions,
} from './ResultPage';