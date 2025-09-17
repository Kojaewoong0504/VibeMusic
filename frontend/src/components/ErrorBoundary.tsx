/**
 * VibeMusic ErrorBoundary Component
 *
 * 감정 기반 AI 음악 생성 서비스의 에러 경계
 * - React 에러 캐치 및 처리
 * - 사용자 친화적 에러 메시지 표시
 * - 에러 리포팅 및 로깅
 * - 복구 옵션 제공
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { colors, fonts, spacing, fontSizes, fontWeights, borderRadius, boxShadow } from '../styles/tokens';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * 에러 정보 타입
 */
export interface ErrorDetails {
  message: string;
  stack?: string;
  componentStack?: string;
  errorBoundary?: string;
  timestamp: Date;
  userAgent: string;
  url: string;
}

/**
 * ErrorBoundary Props
 */
export interface ErrorBoundaryProps {
  /** 자식 컴포넌트 */
  children: ReactNode;
  /** 폴백 UI 커스터마이징 */
  fallback?: (error: Error, errorInfo: ErrorInfo, retry: () => void) => ReactNode;
  /** 에러 발생 시 콜백 */
  onError?: (error: Error, errorInfo: ErrorInfo, errorDetails: ErrorDetails) => void;
  /** 개발 모드 여부 */
  isDevelopment?: boolean;
  /** 에러 리포팅 활성화 */
  enableReporting?: boolean;
  /** 추가 CSS 클래스명 */
  className?: string;
}

/**
 * ErrorBoundary State
 */
export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  retryCount: number;
}

// ============================================================================
// Error Reporting Service
// ============================================================================

/**
 * 에러 리포팅 서비스
 */
class ErrorReportingService {
  static async reportError(errorDetails: ErrorDetails): Promise<void> {
    try {
      // 실제 환경에서는 외부 에러 리포팅 서비스로 전송
      // (예: Sentry, LogRocket, Bugsnag 등)
      console.error('Error reported:', errorDetails);

      // 로컬 스토리지에 에러 로그 저장 (개발/디버깅용)
      const errorLogs = this.getStoredErrors();
      errorLogs.push(errorDetails);

      // 최대 50개까지만 저장
      if (errorLogs.length > 50) {
        errorLogs.shift();
      }

      localStorage.setItem('vibemusic_error_logs', JSON.stringify(errorLogs));
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  }

  static getStoredErrors(): ErrorDetails[] {
    try {
      const stored = localStorage.getItem('vibemusic_error_logs');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  static clearStoredErrors(): void {
    localStorage.removeItem('vibemusic_error_logs');
  }
}

// ============================================================================
// Styled Components (CSS-in-JS)
// ============================================================================

const containerStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: spacing[8],
  minHeight: '400px',
  backgroundColor: colors.neutral[50],
  borderRadius: borderRadius.lg,
  border: `2px solid ${colors.semantic.error}`,
  margin: spacing[4],
  textAlign: 'center',
};

const iconStyles: React.CSSProperties = {
  fontSize: '4rem',
  marginBottom: spacing[4],
  opacity: 0.7,
};

const titleStyles: React.CSSProperties = {
  fontSize: fontSizes['2xl'],
  fontWeight: fontWeights.bold,
  color: colors.neutral[900],
  marginBottom: spacing[2],
  fontFamily: fonts.heading,
};

const messageStyles: React.CSSProperties = {
  fontSize: fontSizes.base,
  color: colors.neutral[600],
  marginBottom: spacing[6],
  maxWidth: '500px',
  lineHeight: 1.6,
};

const buttonContainerStyles: React.CSSProperties = {
  display: 'flex',
  gap: spacing[3],
  flexWrap: 'wrap',
  justifyContent: 'center',
};

const buttonStyles: React.CSSProperties = {
  padding: `${spacing[3]} ${spacing[6]}`,
  borderRadius: borderRadius.md,
  fontSize: fontSizes.sm,
  fontWeight: fontWeights.medium,
  cursor: 'pointer',
  transition: 'all 200ms ease-out',
  border: 'none',
  minWidth: '120px',
};

const primaryButtonStyles: React.CSSProperties = {
  ...buttonStyles,
  backgroundColor: colors.primary[500],
  color: colors.neutral[0],
  boxShadow: boxShadow.sm,
};

const secondaryButtonStyles: React.CSSProperties = {
  ...buttonStyles,
  backgroundColor: colors.neutral[0],
  color: colors.neutral[700],
  border: `1px solid ${colors.neutral[300]}`,
};

const errorDetailsStyles: React.CSSProperties = {
  marginTop: spacing[6],
  padding: spacing[4],
  backgroundColor: colors.neutral[100],
  borderRadius: borderRadius.md,
  border: `1px solid ${colors.neutral[200]}`,
  maxWidth: '600px',
  width: '100%',
};

const errorDetailsToggleStyles: React.CSSProperties = {
  ...secondaryButtonStyles,
  marginTop: spacing[4],
  fontSize: fontSizes.xs,
  padding: `${spacing[2]} ${spacing[3]}`,
  minWidth: 'auto',
};

const codeStyles: React.CSSProperties = {
  fontSize: fontSizes.xs,
  fontFamily: fonts.mono,
  color: colors.neutral[700],
  whiteSpace: 'pre-wrap',
  textAlign: 'left',
  wordBreak: 'break-word',
  maxHeight: '200px',
  overflowY: 'auto',
};

// ============================================================================
// Error Boundary Component
// ============================================================================

/**
 * VibeMusic ErrorBoundary 컴포넌트
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private errorId: string = '';
  private retryTimeoutId: number | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.errorId = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const errorDetails: ErrorDetails = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorBoundary: 'ErrorBoundary',
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    this.setState({
      errorInfo,
      errorId: this.errorId,
    });

    // 에러 리포팅
    if (this.props.enableReporting !== false) {
      ErrorReportingService.reportError(errorDetails);
    }

    // 사용자 정의 에러 핸들러 호출
    if (this.props.onError) {
      this.props.onError(error, errorInfo, errorDetails);
    }
  }

  componentWillUnmount(): void {
    if (this.retryTimeoutId) {
      window.clearTimeout(this.retryTimeoutId);
    }
  }

  /**
   * 에러 상태 초기화 및 재시도
   */
  handleRetry = (): void => {
    const newRetryCount = this.state.retryCount + 1;

    // 연속 재시도 제한 (최대 3회)
    if (newRetryCount > 3) {
      alert('재시도 횟수를 초과했습니다. 페이지를 새로고침해 주세요.');
      return;
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: newRetryCount,
    });
  };

  /**
   * 페이지 새로고침
   */
  handleRefresh = (): void => {
    window.location.reload();
  };

  /**
   * 홈으로 이동
   */
  handleGoHome = (): void => {
    window.location.href = '/';
  };

  /**
   * 에러 리포트 전송
   */
  handleReportError = async (): Promise<void> => {
    if (!this.state.error || !this.state.errorInfo) return;

    const errorDetails: ErrorDetails = {
      message: this.state.error.message,
      stack: this.state.error.stack,
      componentStack: this.state.errorInfo.componentStack,
      errorBoundary: 'ErrorBoundary',
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    try {
      await ErrorReportingService.reportError(errorDetails);
      alert('에러 리포트가 전송되었습니다. 빠른 시일 내에 문제를 해결하겠습니다.');
    } catch (reportingError) {
      alert('에러 리포트 전송에 실패했습니다.');
    }
  };

  render(): ReactNode {
    const { children, fallback, isDevelopment = false, className } = this.props;
    const { hasError, error, errorInfo } = this.state;

    if (hasError && error) {
      // 커스텀 폴백 UI가 있는 경우
      if (fallback) {
        return fallback(error, errorInfo!, this.handleRetry);
      }

      // 기본 에러 UI
      return (
        <>
          {/* CSS 호버 효과 */}
          <style>
            {`
              .error-button-primary:hover {
                background-color: ${colors.primary[600]};
                transform: translateY(-1px);
              }

              .error-button-secondary:hover {
                background-color: ${colors.neutral[50]};
                border-color: ${colors.primary[300]};
                color: ${colors.primary[600]};
              }

              @media (max-width: 768px) {
                .error-container {
                  margin: ${spacing[2]};
                  padding: ${spacing[6]};
                  min-height: 300px;
                }

                .error-button-container {
                  flex-direction: column;
                  width: 100%;
                }

                .error-button-container button {
                  width: 100%;
                }
              }
            `}
          </style>

          <div
            className={`error-container ${className || ''}`}
            style={containerStyles}
            role="alert"
            aria-live="polite"
          >
            <div style={iconStyles}>🚨</div>

            <h2 style={titleStyles}>
              앗! 문제가 발생했어요
            </h2>

            <p style={messageStyles}>
              예상치 못한 오류가 발생했습니다.
              <br />
              아래 버튼을 눌러 다시 시도해보세요.
            </p>

            <div className="error-button-container" style={buttonContainerStyles}>
              <button
                className="error-button-primary"
                style={primaryButtonStyles}
                onClick={this.handleRetry}
                aria-label="다시 시도"
              >
                다시 시도
              </button>

              <button
                className="error-button-secondary"
                style={secondaryButtonStyles}
                onClick={this.handleRefresh}
                aria-label="페이지 새로고침"
              >
                새로고침
              </button>

              <button
                className="error-button-secondary"
                style={secondaryButtonStyles}
                onClick={this.handleGoHome}
                aria-label="홈으로 이동"
              >
                홈으로
              </button>
            </div>

            {/* 개발 모드에서만 에러 상세 정보 표시 */}
            {isDevelopment && (
              <ErrorDetails
                error={error}
                errorInfo={errorInfo}
                onReportError={this.handleReportError}
              />
            )}
          </div>
        </>
      );
    }

    return children;
  }
}

// ============================================================================
// Error Details Component
// ============================================================================

interface ErrorDetailsProps {
  error: Error;
  errorInfo: ErrorInfo | null;
  onReportError: () => void;
}

const ErrorDetails: React.FC<ErrorDetailsProps> = ({ error, errorInfo, onReportError }) => {
  const [showDetails, setShowDetails] = React.useState(false);

  return (
    <div style={errorDetailsStyles}>
      <button
        style={errorDetailsToggleStyles}
        onClick={() => setShowDetails(!showDetails)}
        aria-label={showDetails ? '에러 상세 정보 숨기기' : '에러 상세 정보 보기'}
      >
        {showDetails ? '상세 정보 숨기기 ▲' : '상세 정보 보기 ▼'}
      </button>

      {showDetails && (
        <div style={{ marginTop: spacing[3] }}>
          <h4 style={{
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.semibold,
            marginBottom: spacing[2],
            color: colors.neutral[800]
          }}>
            에러 메시지:
          </h4>
          <pre style={codeStyles}>
            {error.message}
          </pre>

          {error.stack && (
            <>
              <h4 style={{
                fontSize: fontSizes.sm,
                fontWeight: fontWeights.semibold,
                marginBottom: spacing[2],
                marginTop: spacing[4],
                color: colors.neutral[800]
              }}>
                스택 트레이스:
              </h4>
              <pre style={codeStyles}>
                {error.stack}
              </pre>
            </>
          )}

          {errorInfo?.componentStack && (
            <>
              <h4 style={{
                fontSize: fontSizes.sm,
                fontWeight: fontWeights.semibold,
                marginBottom: spacing[2],
                marginTop: spacing[4],
                color: colors.neutral[800]
              }}>
                컴포넌트 스택:
              </h4>
              <pre style={codeStyles}>
                {errorInfo.componentStack}
              </pre>
            </>
          )}

          <button
            style={{
              ...secondaryButtonStyles,
              marginTop: spacing[4],
              fontSize: fontSizes.xs,
            }}
            onClick={onReportError}
            aria-label="에러 리포트 전송"
          >
            문제 신고하기
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Exports
// ============================================================================

export default ErrorBoundary;
export type { ErrorBoundaryProps, ErrorDetails };
export { ErrorReportingService };