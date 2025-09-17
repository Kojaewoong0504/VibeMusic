/**
 * VibeMusic MainPage Component
 *
 * 감정 기반 AI 음악 생성 서비스의 메인 랜딩 페이지
 * - 서비스 소개 및 브랜딩
 * - 사용 방법 안내
 * - 시작하기 CTA
 * - 반응형 레이아웃 최적화 (T096)
 */

import React from 'react';
import { Header, Footer, LoadingSpinner } from '../components';
import { colors, fonts, spacing, fontSizes, fontWeights, borderRadius, boxShadow } from '../styles/tokens';
import {
  responsiveSpacing,
  responsiveTypography,
  touchOptimization,
  mediaQuery,
  createMediaQuery
} from '../styles/responsive';
import { useResponsive, useMobileDetection } from '../hooks/useResponsive';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * MainPage Props
 */
export interface MainPageProps {
  /** 로딩 상태 */
  isLoading?: boolean;
  /** 시작하기 버튼 클릭 핸들러 */
  onGetStarted?: () => void;
  /** 데모 보기 버튼 클릭 핸들러 */
  onWatchDemo?: () => void;
  /** 추가 CSS 클래스명 */
  className?: string;
}

/**
 * 기능 아이템 타입
 */
interface FeatureItem {
  icon: string;
  title: string;
  description: string;
}

/**
 * 사용 단계 타입
 */
interface HowItWorksStep {
  step: number;
  title: string;
  description: string;
  icon: string;
}

// ============================================================================
// Configuration Data
// ============================================================================

/**
 * 핵심 기능들
 */
const features: FeatureItem[] = [
  {
    icon: '⌨️',
    title: '실시간 타이핑 분석',
    description: '키보드 입력 패턴을 실시간으로 분석하여 당신의 감정 상태를 파악합니다.',
  },
  {
    icon: '🎭',
    title: '감정 시각화',
    description: '에너지, 긴장도, 집중도 등 다차원 감정을 아름다운 비주얼로 표현합니다.',
  },
  {
    icon: '🎵',
    title: 'AI 음악 생성',
    description: '감정 데이터를 바탕으로 개인화된 음악을 AI가 실시간으로 생성합니다.',
  },
  {
    icon: '🎧',
    title: '즉시 재생 & 다운로드',
    description: '생성된 음악을 바로 듣고, 고품질 오디오 파일로 다운로드할 수 있습니다.',
  },
];

/**
 * 사용 방법 단계
 */
const howItWorksSteps: HowItWorksStep[] = [
  {
    step: 1,
    icon: '✏️',
    title: '자유롭게 타이핑하세요',
    description: '일기, 생각, 또는 어떤 텍스트든 자연스럽게 입력하세요.',
  },
  {
    step: 2,
    icon: '📊',
    title: '감정이 분석됩니다',
    description: '타이핑 리듬과 패턴에서 당신의 현재 감정 상태를 추출합니다.',
  },
  {
    step: 3,
    icon: '🎼',
    title: '음악이 생성됩니다',
    description: 'AI가 당신의 감정에 맞는 독특한 음악을 즉시 작곡합니다.',
  },
  {
    step: 4,
    icon: '🎉',
    title: '음악을 즐기세요',
    description: '완성된 음악을 감상하고 다운로드하여 소중히 간직하세요.',
  },
];

// ============================================================================
// Styled Components with Responsive System (T096)
// ============================================================================

const useMainPageStyles = () => {
  const { getValue, device, isMobileBreakpoint } = useResponsive();
  const { isMobile, shouldShowMobileUI } = useMobileDetection();

  const pageStyles: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: colors.neutral[0],
  };

  const heroSectionStyles: React.CSSProperties = {
    background: `linear-gradient(135deg, ${colors.primary[500]}20, ${colors.primary[300]}10)`,
    padding: getValue({
      mobile: `${responsiveSpacing.sectionGap.mobile} ${responsiveSpacing.containerPadding.mobile}`,
      tablet: `${responsiveSpacing.sectionGap.tablet} ${responsiveSpacing.containerPadding.tablet}`,
      desktop: `${responsiveSpacing.sectionGap.desktop} ${responsiveSpacing.containerPadding.desktop}`,
      wide: `${responsiveSpacing.sectionGap.wide} ${responsiveSpacing.containerPadding.wide}`,
    }),
    textAlign: 'center',
    position: 'relative',
    overflow: 'hidden',
    minHeight: getValue({
      mobile: '60vh',
      tablet: '70vh',
      desktop: '75vh',
      wide: '80vh',
    }),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const heroContentStyles: React.CSSProperties = {
    maxWidth: getValue({
      mobile: '100%',
      tablet: '640px',
      desktop: '800px',
      wide: '900px',
    }),
    position: 'relative',
    zIndex: 2,
    width: '100%',
  };

  const heroTitleStyles: React.CSSProperties = {
    fontSize: getValue({
      mobile: responsiveTypography.headings.h1.mobile,
      tablet: responsiveTypography.headings.h1.tablet,
      desktop: responsiveTypography.headings.h1.desktop,
      wide: responsiveTypography.headings.h1.wide,
    }),
    fontWeight: fontWeights.black,
    fontFamily: fonts.heading,
    background: `linear-gradient(135deg, ${colors.primary[600]}, ${colors.primary[400]})`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    marginBottom: getValue({
      mobile: spacing[3],
      tablet: spacing[4],
      desktop: spacing[4],
      wide: spacing[5],
    }),
    lineHeight: responsiveTypography.lineHeight.tight,
  };

  const heroSubtitleStyles: React.CSSProperties = {
    fontSize: getValue({
      mobile: responsiveTypography.body.large.mobile,
      tablet: responsiveTypography.body.large.tablet,
      desktop: responsiveTypography.body.large.desktop,
      wide: responsiveTypography.body.large.wide,
    }),
    color: colors.neutral[700],
    marginBottom: getValue({
      mobile: spacing[6],
      tablet: spacing[7],
      desktop: spacing[8],
      wide: spacing[8],
    }),
    lineHeight: responsiveTypography.lineHeight.relaxed,
    maxWidth: '100%',
  };

  const ctaContainerStyles: React.CSSProperties = {
    display: 'flex',
    gap: getValue({
      mobile: spacing[3],
      tablet: spacing[4],
      desktop: spacing[4],
      wide: spacing[4],
    }),
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: shouldShowMobileUI ? 'column' : 'row',
    flexWrap: shouldShowMobileUI ? 'nowrap' : 'wrap',
  };

  const baseCTAStyles: React.CSSProperties = {
    padding: getValue({
      mobile: `${touchOptimization.buttonSize.medium.mobile} ${spacing[6]}`,
      tablet: `${touchOptimization.buttonSize.medium.tablet} ${spacing[7]}`,
      desktop: `${touchOptimization.buttonSize.medium.desktop} ${spacing[8]}`,
      wide: `${touchOptimization.buttonSize.medium.desktop} ${spacing[8]}`,
    }),
    borderRadius: borderRadius.xl,
    fontSize: getValue({
      mobile: fontSizes.base,
      tablet: fontSizes.lg,
      desktop: fontSizes.lg,
      wide: fontSizes.lg,
    }),
    fontWeight: fontWeights.semibold,
    border: 'none',
    cursor: 'pointer',
    transition: 'all 200ms ease-out',
    minWidth: getValue({
      mobile: '100%',
      tablet: '200px',
      desktop: '180px',
      wide: '180px',
    }),
    minHeight: getValue({
      mobile: touchOptimization.minTouchTarget,
      tablet: touchOptimization.buttonSize.medium.tablet,
      desktop: touchOptimization.buttonSize.medium.desktop,
      wide: touchOptimization.buttonSize.medium.desktop,
    }),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    textDecoration: 'none',
    touchAction: 'manipulation', // 터치 최적화
  };

  const primaryCTAStyles: React.CSSProperties = {
    ...baseCTAStyles,
    backgroundColor: colors.primary[500],
    color: colors.neutral[0],
    boxShadow: boxShadow.lg,
  };

  const secondaryCTAStyles: React.CSSProperties = {
    ...baseCTAStyles,
    backgroundColor: colors.neutral[0],
    color: colors.neutral[700],
    border: `2px solid ${colors.neutral[300]}`,
  };

  const sectionStyles: React.CSSProperties = {
    padding: getValue({
      mobile: `${responsiveSpacing.sectionGap.mobile} ${responsiveSpacing.containerPadding.mobile}`,
      tablet: `${responsiveSpacing.sectionGap.tablet} ${responsiveSpacing.containerPadding.tablet}`,
      desktop: `${responsiveSpacing.sectionGap.desktop} ${responsiveSpacing.containerPadding.desktop}`,
      wide: `${responsiveSpacing.sectionGap.wide} ${responsiveSpacing.containerPadding.wide}`,
    }),
    maxWidth: getValue({
      mobile: '100%',
      tablet: '100%',
      desktop: '1200px',
      wide: '1400px',
    }),
    margin: '0 auto',
    width: '100%',
  };

  return {
    pageStyles,
    heroSectionStyles,
    heroContentStyles,
    heroTitleStyles,
    heroSubtitleStyles,
    ctaContainerStyles,
    primaryCTAStyles,
    secondaryCTAStyles,
    sectionStyles,
    isMobile,
    shouldShowMobileUI,
  };
};

// 추가 반응형 스타일 생성 함수
const useAdditionalStyles = () => {
  const { getValue } = useResponsive();
  const { shouldShowMobileUI } = useMobileDetection();

  const sectionTitleStyles: React.CSSProperties = {
    fontSize: getValue({
      mobile: responsiveTypography.headings.h2.mobile,
      tablet: responsiveTypography.headings.h2.tablet,
      desktop: responsiveTypography.headings.h2.desktop,
      wide: responsiveTypography.headings.h2.wide,
    }),
    fontWeight: fontWeights.bold,
    fontFamily: fonts.heading,
    color: colors.neutral[900],
    textAlign: 'center',
    marginBottom: getValue({
      mobile: spacing[3],
      tablet: spacing[4],
      desktop: spacing[4],
      wide: spacing[5],
    }),
    lineHeight: responsiveTypography.lineHeight.tight,
  };

  const sectionSubtitleStyles: React.CSSProperties = {
    fontSize: getValue({
      mobile: responsiveTypography.body.large.mobile,
      tablet: responsiveTypography.body.large.tablet,
      desktop: responsiveTypography.body.large.desktop,
      wide: responsiveTypography.body.large.wide,
    }),
    color: colors.neutral[600],
    textAlign: 'center',
    marginBottom: getValue({
      mobile: spacing[8],
      tablet: spacing[10],
      desktop: spacing[12],
      wide: spacing[12],
    }),
    maxWidth: '100%',
    margin: `0 auto ${getValue({
      mobile: spacing[8],
      tablet: spacing[10],
      desktop: spacing[12],
      wide: spacing[12],
    })}`,
    lineHeight: responsiveTypography.lineHeight.normal,
  };

  const featuresGridStyles: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: getValue({
      mobile: '1fr',
      tablet: 'repeat(2, 1fr)',
      desktop: 'repeat(2, 1fr)',
      wide: 'repeat(4, 1fr)',
    }),
    gap: getValue({
      mobile: responsiveSpacing.componentGap.mobile,
      tablet: responsiveSpacing.componentGap.tablet,
      desktop: responsiveSpacing.componentGap.desktop,
      wide: responsiveSpacing.componentGap.wide,
    }),
    marginBottom: getValue({
      mobile: spacing[8],
      tablet: spacing[12],
      desktop: spacing[16],
      wide: spacing[16],
    }),
  };

  const featureCardStyles: React.CSSProperties = {
    backgroundColor: colors.neutral[50],
    padding: getValue({
      mobile: spacing[6],
      tablet: spacing[7],
      desktop: spacing[8],
      wide: spacing[8],
    }),
    borderRadius: borderRadius['2xl'],
    textAlign: 'center',
    border: `1px solid ${colors.neutral[100]}`,
    transition: 'all 200ms ease-out',
    cursor: 'default',
    minHeight: getValue({
      mobile: 'auto',
      tablet: '260px',
      desktop: '280px',
      wide: '280px',
    }),
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  };

  const featureIconStyles: React.CSSProperties = {
    fontSize: getValue({
      mobile: '2.5rem',
      tablet: '2.8rem',
      desktop: '3rem',
      wide: '3rem',
    }),
    marginBottom: getValue({
      mobile: spacing[3],
      tablet: spacing[4],
      desktop: spacing[4],
      wide: spacing[4],
    }),
    display: 'block',
    lineHeight: 1,
  };

  const featureTitleStyles: React.CSSProperties = {
    fontSize: getValue({
      mobile: responsiveTypography.headings.h4.mobile,
      tablet: responsiveTypography.headings.h4.tablet,
      desktop: responsiveTypography.headings.h3.desktop,
      wide: responsiveTypography.headings.h3.wide,
    }),
    fontWeight: fontWeights.semibold,
    color: colors.neutral[900],
    marginBottom: getValue({
      mobile: spacing[2],
      tablet: spacing[3],
      desktop: spacing[3],
      wide: spacing[3],
    }),
    lineHeight: responsiveTypography.lineHeight.tight,
  };

  const featureDescriptionStyles: React.CSSProperties = {
    fontSize: getValue({
      mobile: responsiveTypography.body.regular.mobile,
      tablet: responsiveTypography.body.regular.tablet,
      desktop: responsiveTypography.body.regular.desktop,
      wide: responsiveTypography.body.regular.wide,
    }),
    color: colors.neutral[600],
    lineHeight: responsiveTypography.lineHeight.normal,
    flex: 1,
  };

  const stepsGridStyles: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: getValue({
      mobile: '1fr',
      tablet: 'repeat(2, 1fr)',
      desktop: 'repeat(4, 1fr)',
      wide: 'repeat(4, 1fr)',
    }),
    gap: getValue({
      mobile: responsiveSpacing.componentGap.mobile,
      tablet: responsiveSpacing.componentGap.tablet,
      desktop: responsiveSpacing.componentGap.desktop,
      wide: responsiveSpacing.componentGap.wide,
    }),
  };

  const stepCardStyles: React.CSSProperties = {
    position: 'relative',
    padding: getValue({
      mobile: spacing[5],
      tablet: spacing[6],
      desktop: spacing[6],
      wide: spacing[6],
    }),
    textAlign: 'center',
    minHeight: getValue({
      mobile: 'auto',
      tablet: '200px',
      desktop: '220px',
      wide: '220px',
    }),
    paddingTop: getValue({
      mobile: `calc(${spacing[5]} + 20px)`, // 스텝 번호를 위한 여백
      tablet: `calc(${spacing[6]} + 20px)`,
      desktop: `calc(${spacing[6]} + 20px)`,
      wide: `calc(${spacing[6]} + 20px)`,
    }),
  };

  const stepNumberSize = getValue({
    mobile: '36px',
    tablet: '40px',
    desktop: '40px',
    wide: '40px',
  });

  const stepNumberStyles: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: stepNumberSize,
    height: stepNumberSize,
    backgroundColor: colors.primary[500],
    color: colors.neutral[0],
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: getValue({
      mobile: fontSizes.sm,
      tablet: fontSizes.sm,
      desktop: fontSizes.sm,
      wide: fontSizes.sm,
    }),
    fontWeight: fontWeights.bold,
    marginTop: `-${parseInt(stepNumberSize) / 2}px`,
    boxShadow: boxShadow.sm,
  };

  const stepIconStyles: React.CSSProperties = {
    fontSize: getValue({
      mobile: '2rem',
      tablet: '2.2rem',
      desktop: '2.5rem',
      wide: '2.5rem',
    }),
    marginBottom: getValue({
      mobile: spacing[3],
      tablet: spacing[4],
      desktop: spacing[4],
      wide: spacing[4],
    }),
    marginTop: getValue({
      mobile: spacing[3],
      tablet: spacing[4],
      desktop: spacing[4],
      wide: spacing[4],
    }),
    lineHeight: 1,
  };

  const stepTitleStyles: React.CSSProperties = {
    fontSize: getValue({
      mobile: responsiveTypography.headings.h4.mobile,
      tablet: responsiveTypography.headings.h4.tablet,
      desktop: responsiveTypography.headings.h4.desktop,
      wide: responsiveTypography.headings.h4.wide,
    }),
    fontWeight: fontWeights.semibold,
    color: colors.neutral[900],
    marginBottom: getValue({
      mobile: spacing[2],
      tablet: spacing[2],
      desktop: spacing[2],
      wide: spacing[2],
    }),
    lineHeight: responsiveTypography.lineHeight.tight,
  };

  const stepDescriptionStyles: React.CSSProperties = {
    fontSize: getValue({
      mobile: responsiveTypography.body.small.mobile,
      tablet: responsiveTypography.body.regular.tablet,
      desktop: responsiveTypography.body.regular.desktop,
      wide: responsiveTypography.body.regular.wide,
    }),
    color: colors.neutral[600],
    lineHeight: responsiveTypography.lineHeight.normal,
  };

  return {
    sectionTitleStyles,
    sectionSubtitleStyles,
    featuresGridStyles,
    featureCardStyles,
    featureIconStyles,
    featureTitleStyles,
    featureDescriptionStyles,
    stepsGridStyles,
    stepCardStyles,
    stepNumberStyles,
    stepIconStyles,
    stepTitleStyles,
    stepDescriptionStyles,
  };
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * VibeMusic MainPage 컴포넌트 (T096 반응형 최적화)
 */
const MainPage: React.FC<MainPageProps> = ({
  isLoading = false,
  onGetStarted,
  onWatchDemo,
  className,
}) => {
  // 반응형 스타일 Hook 사용
  const mainStyles = useMainPageStyles();
  const additionalStyles = useAdditionalStyles();
  const { viewport, device } = useResponsive();

  // 로딩 중일 때
  if (isLoading) {
    return (
      <div style={mainStyles.pageStyles}>
        <LoadingSpinner
          size="lg"
          variant="music"
          message="VibeMusic을 준비하고 있어요..."
          overlay
        />
      </div>
    );
  }

  return (
    <>
      {/* 반응형 최적화된 CSS (T096) */}
      <style>
        {`
          /* 히어로 배경 애니메이션 */
          .hero-bg::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, ${colors.primary[200]}20 0%, transparent 70%);
            animation: floatAnimation 20s ease-in-out infinite;
            z-index: 1;
          }

          @keyframes floatAnimation {
            0%, 100% { transform: translate(0, 0) rotate(0deg); }
            33% { transform: translate(-30px, -50px) rotate(120deg); }
            66% { transform: translate(50px, -20px) rotate(240deg); }
          }

          /* 호버 효과 (터치 디바이스에서는 비활성화) */
          ${device.isTouch ? '' : `
            .primary-cta:hover {
              background-color: ${colors.primary[600]};
              transform: translateY(-2px);
              box-shadow: ${boxShadow.xl};
            }

            .secondary-cta:hover {
              background-color: ${colors.neutral[50]};
              border-color: ${colors.primary[400]};
              color: ${colors.primary[600]};
            }

            .feature-card:hover {
              background-color: ${colors.neutral[0]};
              border-color: ${colors.primary[200]};
              transform: translateY(-4px);
              box-shadow: ${boxShadow.lg};
            }
          `}

          /* 터치 디바이스 최적화 */
          ${device.isTouch ? `
            .primary-cta:active {
              background-color: ${colors.primary[700]};
              transform: scale(0.98);
            }

            .secondary-cta:active {
              background-color: ${colors.neutral[100]};
              border-color: ${colors.primary[500]};
              color: ${colors.primary[700]};
            }

            .feature-card:active {
              background-color: ${colors.neutral[25]};
              transform: scale(0.98);
            }

            /* 터치 영역 확대 */
            .primary-cta, .secondary-cta {
              -webkit-touch-callout: none;
              -webkit-user-select: none;
              -khtml-user-select: none;
              -moz-user-select: none;
              -ms-user-select: none;
              user-select: none;
              -webkit-tap-highlight-color: rgba(0,0,0,0);
            }
          ` : ''}

          /* 고해상도 디스플레이 최적화 */
          ${device.isRetina ? `
            .hero-title,
            .feature-card,
            .step-card {
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
            }
          ` : ''}

          /* 접근성 향상 */
          @media (prefers-reduced-motion: reduce) {
            .hero-bg::before {
              animation: none;
            }

            .primary-cta,
            .secondary-cta,
            .feature-card {
              transition: none;
            }
          }

          /* 고대비 모드 지원 */
          @media (prefers-contrast: high) {
            .hero-title {
              background: ${colors.neutral[900]};
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
            }

            .feature-card {
              border-width: 2px;
              border-color: ${colors.neutral[400]};
            }
          }

          /* 큰 텍스트 모드 지원 */
          @media (prefers-font-size: large) {
            .hero-title {
              font-size: calc(${viewport.currentBreakpoint === 'mobile' ? responsiveTypography.headings.h1.mobile : responsiveTypography.headings.h1.desktop} * 1.2);
            }

            .hero-subtitle,
            .feature-description,
            .step-description {
              font-size: calc(${viewport.currentBreakpoint === 'mobile' ? responsiveTypography.body.large.mobile : responsiveTypography.body.large.desktop} * 1.15);
            }
          }
        `}
      </style>

      <div className={`main-page ${className || ''}`} style={mainStyles.pageStyles}>
        {/* Header */}
        <Header
          onLogoClick={() => window.location.reload()}
          onNewSession={onGetStarted}
        />

        {/* Hero Section */}
        <section className="hero-section hero-bg" style={mainStyles.heroSectionStyles}>
          <div style={mainStyles.heroContentStyles}>
            <h1 className="hero-title" style={mainStyles.heroTitleStyles}>
              당신의 감정이
              {!mainStyles.shouldShowMobileUI && <br />}
              {mainStyles.shouldShowMobileUI ? ' ' : ''}음악이 됩니다
            </h1>
            <p className="hero-subtitle" style={mainStyles.heroSubtitleStyles}>
              키보드 타이핑 리듬으로 감정을 분석하고,
              {mainStyles.shouldShowMobileUI && <br />}
              AI가 개인화된 음악을 실시간으로 생성하는 혁신적인 서비스
            </p>
            <div className="cta-container" style={mainStyles.ctaContainerStyles}>
              <button
                className="primary-cta"
                style={mainStyles.primaryCTAStyles}
                onClick={onGetStarted}
                aria-label="VibeMusic 시작하기"
                type="button"
              >
                <span>🎵</span>
                <span>지금 시작하기</span>
              </button>
              <button
                className="secondary-cta"
                style={mainStyles.secondaryCTAStyles}
                onClick={onWatchDemo}
                aria-label="데모 영상 보기"
                type="button"
              >
                <span>▶️</span>
                <span>데모 보기</span>
              </button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="section" style={mainStyles.sectionStyles}>
          <h2 style={additionalStyles.sectionTitleStyles}>
            어떻게 작동하나요?
          </h2>
          <p style={additionalStyles.sectionSubtitleStyles}>
            첨단 AI 기술과 감정 분석을 통해 당신만의 특별한 음악을 만들어냅니다
          </p>

          <div className="features-grid" style={additionalStyles.featuresGridStyles}>
            {features.map((feature, index) => (
              <div
                key={index}
                className="feature-card"
                style={additionalStyles.featureCardStyles}
                role="article"
                aria-labelledby={`feature-title-${index}`}
              >
                <span
                  style={additionalStyles.featureIconStyles}
                  aria-hidden="true"
                >
                  {feature.icon}
                </span>
                <h3
                  id={`feature-title-${index}`}
                  style={additionalStyles.featureTitleStyles}
                >
                  {feature.title}
                </h3>
                <p style={additionalStyles.featureDescriptionStyles}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* How It Works Section */}
        <section
          className="section"
          style={{
            ...mainStyles.sectionStyles,
            backgroundColor: colors.neutral[25]
          }}
        >
          <h2 style={additionalStyles.sectionTitleStyles}>
            사용 방법
          </h2>
          <p style={additionalStyles.sectionSubtitleStyles}>
            간단한 4단계로 당신만의 감정 음악을 만들어보세요
          </p>

          <div className="steps-grid" style={additionalStyles.stepsGridStyles}>
            {howItWorksSteps.map((step, index) => (
              <div
                key={index}
                className="step-card"
                style={additionalStyles.stepCardStyles}
                role="article"
                aria-labelledby={`step-title-${index}`}
              >
                <div
                  style={additionalStyles.stepNumberStyles}
                  aria-label={`단계 ${step.step}`}
                >
                  {step.step}
                </div>
                <div
                  style={additionalStyles.stepIconStyles}
                  aria-hidden="true"
                >
                  {step.icon}
                </div>
                <h3
                  id={`step-title-${index}`}
                  style={additionalStyles.stepTitleStyles}
                >
                  {step.title}
                </h3>
                <p style={additionalStyles.stepDescriptionStyles}>
                  {step.description}
                </p>
              </div>
            ))}
          </div>

          {/* 추가 CTA */}
          <div style={{
            textAlign: 'center',
            marginTop: mainStyles.shouldShowMobileUI ? spacing[8] : spacing[12]
          }}>
            <button
              className="primary-cta"
              style={mainStyles.primaryCTAStyles}
              onClick={onGetStarted}
              aria-label="지금 체험해보기"
              type="button"
            >
              <span>지금 체험해보기</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </section>

        {/* Footer */}
        <Footer />
      </div>
    </>
  );
};

export default MainPage;
export type { MainPageProps };