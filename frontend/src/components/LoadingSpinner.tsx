/**
 * VibeMusic LoadingSpinner Component
 *
 * 감정 기반 AI 음악 생성 서비스의 로딩 스피너
 * - 음악적 테마의 로딩 애니메이션
 * - 사용자 정의 메시지 지원
 * - 다양한 크기 지원 (sm, md, lg, xl)
 * - 접근성 지원
 */

import React from 'react';
import { colors, fonts, spacing, fontSizes, fontWeights } from '../styles/tokens';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * 스피너 크기 타입
 */
export type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * 스피너 변형 타입
 */
export type SpinnerVariant = 'default' | 'music' | 'pulse' | 'wave';

/**
 * LoadingSpinner 컴포넌트 Props
 */
export interface LoadingSpinnerProps {
  /** 스피너 크기 */
  size?: SpinnerSize;
  /** 스피너 변형 */
  variant?: SpinnerVariant;
  /** 로딩 메시지 */
  message?: string;
  /** 메시지 표시 여부 */
  showMessage?: boolean;
  /** 전체 화면 오버레이 여부 */
  overlay?: boolean;
  /** 커스텀 색상 */
  color?: string;
  /** 추가 CSS 클래스명 */
  className?: string;
  /** 접근성을 위한 라벨 */
  ariaLabel?: string;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * 크기별 스피너 설정
 */
const sizeConfig = {
  sm: {
    spinner: 20,
    stroke: 2,
    fontSize: fontSizes.xs,
    gap: spacing[2],
  },
  md: {
    spinner: 32,
    stroke: 3,
    fontSize: fontSizes.sm,
    gap: spacing[3],
  },
  lg: {
    spinner: 48,
    stroke: 4,
    fontSize: fontSizes.base,
    gap: spacing[4],
  },
  xl: {
    spinner: 64,
    stroke: 5,
    fontSize: fontSizes.lg,
    gap: spacing[5],
  },
} as const;

// ============================================================================
// Styled Components (CSS-in-JS)
// ============================================================================

const containerStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: spacing[3],
};

const overlayStyles: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(255, 255, 255, 0.8)',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1300, // Modal level
};

const messageStyles: React.CSSProperties = {
  color: colors.neutral[600],
  fontFamily: fonts.body,
  fontWeight: fontWeights.medium,
  textAlign: 'center',
  margin: 0,
};

// ============================================================================
// Animation Keyframes
// ============================================================================

const getAnimationStyles = () => `
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  @keyframes wave {
    0%, 100% {
      transform: scaleY(0.4);
    }
    50% {
      transform: scaleY(1);
    }
  }

  @keyframes musicBounce {
    0%, 20%, 50%, 80%, 100% {
      transform: translateY(0);
    }
    40% {
      transform: translateY(-8px);
    }
    60% {
      transform: translateY(-4px);
    }
  }

  .loading-spinner {
    animation: spin 1s linear infinite;
  }

  .loading-pulse {
    animation: pulse 1.5s ease-in-out infinite;
  }

  .loading-music {
    animation: musicBounce 1.2s ease-in-out infinite;
  }

  .loading-wave-bar {
    animation: wave 1s ease-in-out infinite;
  }
`;

// ============================================================================
// Spinner Components
// ============================================================================

/**
 * 기본 회전 스피너
 */
const DefaultSpinner: React.FC<{ size: SpinnerSize; color: string }> = ({ size, color }) => {
  const config = sizeConfig[size];

  return (
    <svg
      className="loading-spinner"
      width={config.spinner}
      height={config.spinner}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke={colors.neutral[200]}
        strokeWidth={config.stroke}
      />
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeWidth={config.stroke}
        strokeLinecap="round"
        strokeDasharray="31.416"
        strokeDashoffset="23.562"
      />
    </svg>
  );
};

/**
 * 음악 테마 스피너 (음표 아이콘)
 */
const MusicSpinner: React.FC<{ size: SpinnerSize; color: string }> = ({ size, color }) => {
  const config = sizeConfig[size];

  return (
    <div
      className="loading-music"
      style={{
        fontSize: config.spinner,
        color,
        lineHeight: 1,
      }}
    >
      🎵
    </div>
  );
};

/**
 * 펄스 스피너
 */
const PulseSpinner: React.FC<{ size: SpinnerSize; color: string }> = ({ size, color }) => {
  const config = sizeConfig[size];

  return (
    <div
      className="loading-pulse"
      style={{
        width: config.spinner,
        height: config.spinner,
        borderRadius: '50%',
        backgroundColor: color,
      }}
    />
  );
};

/**
 * 웨이브 스피너 (음성 파형 모양)
 */
const WaveSpinner: React.FC<{ size: SpinnerSize; color: string }> = ({ size, color }) => {
  const config = sizeConfig[size];
  const barWidth = Math.max(2, config.spinner / 10);
  const barCount = 5;
  const gap = barWidth / 2;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: `${gap}px`,
        height: config.spinner,
      }}
    >
      {Array.from({ length: barCount }).map((_, index) => (
        <div
          key={index}
          className="loading-wave-bar"
          style={{
            width: barWidth,
            height: '100%',
            backgroundColor: color,
            borderRadius: barWidth / 2,
            animationDelay: `${index * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * VibeMusic LoadingSpinner 컴포넌트
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  variant = 'default',
  message,
  showMessage = true,
  overlay = false,
  color = colors.primary[500],
  className,
  ariaLabel = '로딩 중',
}) => {
  const config = sizeConfig[size];

  // 스피너 컴포넌트 선택
  const renderSpinner = () => {
    switch (variant) {
      case 'music':
        return <MusicSpinner size={size} color={color} />;
      case 'pulse':
        return <PulseSpinner size={size} color={color} />;
      case 'wave':
        return <WaveSpinner size={size} color={color} />;
      default:
        return <DefaultSpinner size={size} color={color} />;
    }
  };

  // 기본 메시지 설정
  const displayMessage = message || (variant === 'music' ? '음악을 생성하고 있어요...' : '잠시만 기다려 주세요...');

  const content = (
    <div
      className={`loading-container ${className || ''}`}
      style={{
        ...containerStyles,
        gap: config.gap,
      }}
      role="status"
      aria-label={ariaLabel}
    >
      {renderSpinner()}

      {showMessage && displayMessage && (
        <p
          style={{
            ...messageStyles,
            fontSize: config.fontSize,
          }}
        >
          {displayMessage}
        </p>
      )}
    </div>
  );

  return (
    <>
      {/* CSS 애니메이션 추가 */}
      <style>{getAnimationStyles()}</style>

      {overlay ? (
        <div style={overlayStyles}>
          {content}
        </div>
      ) : (
        content
      )}
    </>
  );
};

export default LoadingSpinner;
export type { LoadingSpinnerProps, SpinnerSize, SpinnerVariant };