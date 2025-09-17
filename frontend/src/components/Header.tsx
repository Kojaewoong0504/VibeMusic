/**
 * VibeMusic Header Component
 *
 * 감정 기반 AI 음악 생성 서비스의 메인 헤더
 * - 브랜드 로고 및 네비게이션
 * - 현재 세션 정보 표시
 * - 반응형 디자인 지원
 */

import React from 'react';
import { colors, fonts, spacing, fontSizes, fontWeights, zIndex } from '../styles/tokens';
import {
  responsiveSpacing,
  responsiveTypography,
  responsiveLayout,
  touchOptimization,
} from '../styles/responsive';
import { useResponsive, useMobileDetection } from '../hooks/useResponsive';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * 세션 정보 타입
 */
export interface SessionInfo {
  id: string;
  startTime: Date;
  isActive: boolean;
  musicCount: number;
}

/**
 * Header 컴포넌트 Props
 */
export interface HeaderProps {
  /** 현재 세션 정보 */
  sessionInfo?: SessionInfo;
  /** 로고 클릭 핸들러 */
  onLogoClick?: () => void;
  /** 새 세션 시작 핸들러 */
  onNewSession?: () => void;
  /** 도움말 페이지 이동 핸들러 */
  onHelpClick?: () => void;
  /** 추가 CSS 클래스명 */
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 경과 시간을 사람이 읽기 쉬운 형태로 변환
 */
const formatElapsedTime = (startTime: Date): string => {
  const now = new Date();
  const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);

  if (elapsed < 60) {
    return `${elapsed}초`;
  } else if (elapsed < 3600) {
    const minutes = Math.floor(elapsed / 60);
    return `${minutes}분`;
  } else {
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    return `${hours}시간 ${minutes}분`;
  }
};

// ============================================================================
// Responsive Styled Components (T096)
// ============================================================================

const useHeaderStyles = () => {
  const { getValue } = useResponsive();
  const { shouldShowMobileUI } = useMobileDetection();

  const headerStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: getValue({
      mobile: `${spacing[3]} ${responsiveSpacing.containerPadding.mobile}`,
      tablet: `${spacing[4]} ${responsiveSpacing.containerPadding.tablet}`,
      desktop: `${spacing[4]} ${responsiveSpacing.containerPadding.desktop}`,
      wide: `${spacing[4]} ${responsiveSpacing.containerPadding.wide}`,
    }),
    backgroundColor: colors.neutral[0],
    borderBottom: `1px solid ${colors.neutral[200]}`,
    position: 'sticky',
    top: 0,
    zIndex: zIndex.sticky,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    minHeight: getValue({
      mobile: responsiveLayout.headerHeight.mobile,
      tablet: responsiveLayout.headerHeight.tablet,
      desktop: responsiveLayout.headerHeight.desktop,
      wide: responsiveLayout.headerHeight.wide,
    }),
    flexWrap: shouldShowMobileUI ? 'wrap' : 'nowrap',
    gap: shouldShowMobileUI ? spacing[2] : 0,
  };

  return { headerStyles, shouldShowMobileUI };
};

// 추가 반응형 스타일
const useAdditionalHeaderStyles = () => {
  const { getValue, device } = useResponsive();
  const { shouldShowMobileUI } = useMobileDetection();

  const logoContainerStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: getValue({
      mobile: spacing[2],
      tablet: spacing[3],
      desktop: spacing[3],
      wide: spacing[3],
    }),
    cursor: 'pointer',
    transition: device.isTouch ? 'none' : 'transform 150ms ease-out',
    order: shouldShowMobileUI ? 1 : 0,
    minHeight: getValue({
      mobile: touchOptimization.minTouchTarget,
      tablet: 'auto',
      desktop: 'auto',
      wide: 'auto',
    }),
  };

  const logoTextStyles: React.CSSProperties = {
    fontSize: getValue({
      mobile: fontSizes.lg,
      tablet: fontSizes.xl,
      desktop: fontSizes['2xl'],
      wide: fontSizes['2xl'],
    }),
    fontWeight: fontWeights.bold,
    fontFamily: fonts.heading,
    background: `linear-gradient(135deg, ${colors.primary[500]}, ${colors.primary[700]})`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    lineHeight: 1,
  };

  const logoIconSize = getValue({
    mobile: '28px',
    tablet: '32px',
    desktop: '32px',
    wide: '32px',
  });

  const logoIconStyles: React.CSSProperties = {
    width: logoIconSize,
    height: logoIconSize,
    borderRadius: '8px',
    background: `linear-gradient(135deg, ${colors.primary[500]}, ${colors.primary[700]})`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: colors.neutral[0],
    fontSize: getValue({
      mobile: fontSizes.base,
      tablet: fontSizes.lg,
      desktop: fontSizes.lg,
      wide: fontSizes.lg,
    }),
    fontWeight: fontWeights.bold,
    lineHeight: 1,
  };

  const navStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: getValue({
      mobile: spacing[2],
      tablet: spacing[4],
      desktop: spacing[6],
      wide: spacing[6],
    }),
    order: shouldShowMobileUI ? 2 : 1,
    width: shouldShowMobileUI ? '100%' : 'auto',
    justifyContent: shouldShowMobileUI ? 'space-between' : 'flex-end',
    flexWrap: shouldShowMobileUI ? 'wrap' : 'nowrap',
  };

  const sessionInfoStyles: React.CSSProperties = {
    display: shouldShowMobileUI ? 'none' : 'flex', // 모바일에서는 세션 정보 숨김
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: spacing[1],
    fontSize: getValue({
      mobile: fontSizes.xs,
      tablet: fontSizes.sm,
      desktop: fontSizes.sm,
      wide: fontSizes.sm,
    }),
    color: colors.neutral[600],
    minWidth: '120px', // 최소 너비 확보
  };

  const sessionStatusStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    fontSize: getValue({
      mobile: fontSizes.xs,
      tablet: fontSizes.sm,
      desktop: fontSizes.sm,
      wide: fontSizes.sm,
    }),
    fontWeight: fontWeights.medium,
  };

  const statusIndicatorStyles: React.CSSProperties = {
    width: getValue({
      mobile: '6px',
      tablet: '8px',
      desktop: '8px',
      wide: '8px',
    }),
    height: getValue({
      mobile: '6px',
      tablet: '8px',
      desktop: '8px',
      wide: '8px',
    }),
    borderRadius: '50%',
    backgroundColor: colors.semantic.success,
    animation: 'pulse 2s infinite',
    flexShrink: 0,
  };

  const buttonStyles: React.CSSProperties = {
    padding: getValue({
      mobile: `${spacing[2]} ${spacing[3]}`,
      tablet: `${spacing[2]} ${spacing[4]}`,
      desktop: `${spacing[2]} ${spacing[4]}`,
      wide: `${spacing[2]} ${spacing[4]}`,
    }),
    borderRadius: '8px',
    border: `1px solid ${colors.neutral[300]}`,
    backgroundColor: colors.neutral[0],
    color: colors.neutral[700],
    fontSize: getValue({
      mobile: fontSizes.xs,
      tablet: fontSizes.sm,
      desktop: fontSizes.sm,
      wide: fontSizes.sm,
    }),
    fontWeight: fontWeights.medium,
    cursor: 'pointer',
    transition: device.isTouch ? 'none' : 'all 150ms ease-out',
    textDecoration: 'none',
    minHeight: getValue({
      mobile: touchOptimization.buttonSize.small.mobile,
      tablet: touchOptimization.buttonSize.small.tablet,
      desktop: touchOptimization.buttonSize.small.desktop,
      wide: touchOptimization.buttonSize.small.desktop,
    }),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    touchAction: 'manipulation',
    whiteSpace: 'nowrap',
  };

  const primaryButtonStyles: React.CSSProperties = {
    ...buttonStyles,
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
    color: colors.neutral[0],
  };

  return {
    logoContainerStyles,
    logoTextStyles,
    logoIconStyles,
    navStyles,
    sessionInfoStyles,
    sessionStatusStyles,
    statusIndicatorStyles,
    buttonStyles,
    primaryButtonStyles,
    shouldShowMobileUI,
    device,
  };
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * VibeMusic Header 컴포넌트 (T096 반응형 최적화)
 */
const Header: React.FC<HeaderProps> = ({
  sessionInfo,
  onLogoClick,
  onNewSession,
  onHelpClick,
  className,
}) => {
  // 반응형 스타일 Hook 사용
  const { headerStyles } = useHeaderStyles();
  const headerAdditionalStyles = useAdditionalHeaderStyles();

  return (
    <>
      {/* 반응형 최적화된 CSS (T096) */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.5;
            }
          }

          /* 호버 효과 (터치 디바이스에서는 비활성화) */
          ${headerAdditionalStyles.device.isTouch ? '' : `
            .logo-container:hover {
              transform: scale(1.02);
            }

            .nav-button:hover {
              background-color: ${colors.neutral[50]};
              border-color: ${colors.primary[300]};
              color: ${colors.primary[600]};
            }

            .primary-button:hover {
              background-color: ${colors.primary[600]};
              transform: translateY(-1px);
            }
          `}

          /* 터치 디바이스 최적화 */
          ${headerAdditionalStyles.device.isTouch ? `
            .logo-container:active {
              transform: scale(0.98);
            }

            .nav-button:active {
              background-color: ${colors.neutral[100]};
              border-color: ${colors.primary[400]};
              color: ${colors.primary[700]};
              transform: scale(0.95);
            }

            .primary-button:active {
              background-color: ${colors.primary[700]};
              transform: scale(0.95);
            }

            .logo-container,
            .nav-button,
            .primary-button {
              -webkit-touch-callout: none;
              -webkit-user-select: none;
              user-select: none;
              -webkit-tap-highlight-color: rgba(0,0,0,0);
            }
          ` : ''}

          /* 접근성 향상 */
          @media (prefers-reduced-motion: reduce) {
            .logo-container,
            .nav-button,
            .primary-button {
              transition: none;
            }

            @keyframes pulse {
              0%, 100% {
                opacity: 1;
              }
            }
          }

          /* 고대비 모드 지원 */
          @media (prefers-contrast: high) {
            .header {
              border-bottom-width: 2px;
              border-color: ${colors.neutral[400]};
            }

            .nav-button,
            .primary-button {
              border-width: 2px;
            }
          }
        `}
      </style>

      <header
        className={`header ${className || ''}`}
        style={headerStyles}
        role="banner"
      >
        {/* 로고 영역 */}
        <div
          className="logo-container"
          style={headerAdditionalStyles.logoContainerStyles}
          onClick={onLogoClick}
          role="button"
          tabIndex={0}
          aria-label="VibeMusic 홈으로 이동"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onLogoClick?.();
            }
          }}
        >
          <div style={headerAdditionalStyles.logoIconStyles} aria-hidden="true">
            🎵
          </div>
          <h1 className="logo-text" style={headerAdditionalStyles.logoTextStyles}>
            VibeMusic
          </h1>
        </div>

        {/* 네비게이션 영역 */}
        <nav className="nav" style={headerAdditionalStyles.navStyles} role="navigation">
          {/* 세션 정보 */}
          {sessionInfo && (
            <div className="session-info" style={headerAdditionalStyles.sessionInfoStyles} role="status">
              <div style={headerAdditionalStyles.sessionStatusStyles}>
                <div
                  style={headerAdditionalStyles.statusIndicatorStyles}
                  aria-hidden="true"
                />
                <span>세션 활성</span>
              </div>
              <div>
                {formatElapsedTime(sessionInfo.startTime)} • 음악 {sessionInfo.musicCount}개
              </div>
            </div>
          )}

          {/* 액션 버튼들 */}
          <button
            className="nav-button"
            style={headerAdditionalStyles.buttonStyles}
            onClick={onHelpClick}
            aria-label="도움말 보기"
            type="button"
          >
            도움말
          </button>

          <button
            className="primary-button"
            style={headerAdditionalStyles.primaryButtonStyles}
            onClick={onNewSession}
            aria-label="새 세션 시작하기"
            type="button"
          >
            새 세션
          </button>
        </nav>
      </header>
    </>
  );
};

export default Header;
export type { HeaderProps, SessionInfo };