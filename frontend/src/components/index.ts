/**
 * VibeMusic Components - Entry Point
 *
 * 감정 기반 AI 음악 생성 서비스의 모든 React 컴포넌트 내보내기
 * 편리한 import를 위한 통합 인덱스 파일
 */

// Core Components
export { default as TypingInterface } from './TypingInterface';
export { default as MusicPlayer } from './MusicPlayer';
export { default as EmotionVisualizer } from './EmotionVisualizer';
export { default as SessionStatus } from './SessionStatus';
export { default as GenerationProgress } from './GenerationProgress';

// Layout & UI Components (T057-T060)
export { default as Header } from './Header';
export { default as Footer } from './Footer';
export { default as LoadingSpinner } from './LoadingSpinner';
export { default as ErrorBoundary } from './ErrorBoundary';

// Type exports for component props
export type { default as TypingInterfaceProps } from './TypingInterface';
export type { default as MusicPlayerProps } from './MusicPlayer';
export type { default as EmotionVisualizerProps } from './EmotionVisualizer';
export type { default as SessionStatusProps } from './SessionStatus';
export type { default as GenerationProgressProps } from './GenerationProgress';

// Layout & UI Component Types (T057-T060)
export type { HeaderProps, SessionInfo } from './Header';
export type { FooterProps, FooterLink } from './Footer';
export type { LoadingSpinnerProps, SpinnerSize, SpinnerVariant } from './LoadingSpinner';
export type { ErrorBoundaryProps, ErrorDetails } from './ErrorBoundary';

// Error Reporting Service
export { ErrorReportingService } from './ErrorBoundary';