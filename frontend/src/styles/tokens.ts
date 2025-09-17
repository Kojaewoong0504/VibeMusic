/**
 * VibeMusic Design Tokens
 *
 * 감정 기반 AI 음악 생성 서비스를 위한 디자인 토큰 정의
 * 음악적이고 감정적인 사용자 경험을 위한 색상, 폰트, 간격 시스템
 */

// ============================================================================
// Color Tokens - 감정과 음악을 표현하는 색상 시스템
// ============================================================================

/**
 * Primary Colors - 주요 브랜드 색상
 * 음악의 리듬감과 창의성을 표현하는 보라-파랑 그라데이션
 */
export const colors = {
  primary: {
    50: '#f0f4ff',   // 매우 연한 파랑
    100: '#e0eaff',  // 연한 파랑
    200: '#c7d8ff',  // 옅은 파랑
    300: '#a5bbff',  // 중간 옅은 파랑
    400: '#8b94ff',  // 중간 파랑
    500: '#7c6dff',  // 메인 브랜드 (보라-파랑)
    600: '#6b46f5',  // 진한 브랜드
    700: '#5b38e0',  // 더 진한 보라
    800: '#4c2db8',  // 진한 보라
    900: '#3d2494',  // 가장 진한 보라
  },

  /**
   * Emotion Colors - 감정 상태를 나타내는 색상
   */
  emotion: {
    // 에너지 레벨 색상 (낮음 → 높음)
    energy: {
      low: '#6b7280',     // 회색 (낮은 에너지)
      medium: '#f59e0b',  // 주황 (보통 에너지)
      high: '#ef4444',    // 빨강 (높은 에너지)
    },

    // 감정 극성 색상 (부정 → 긍정)
    valence: {
      negative: '#8b5cf6', // 보라 (부정적)
      neutral: '#6b7280',  // 회색 (중성)
      positive: '#10b981', // 초록 (긍정적)
    },

    // 긴장도 색상
    tension: {
      relaxed: '#34d399',  // 연한 초록 (이완)
      moderate: '#fbbf24', // 노랑 (보통)
      tense: '#f87171',    // 연한 빨강 (긴장)
    },

    // 집중도 색상
    focus: {
      unfocused: '#9ca3af', // 회색 (집중 안됨)
      focused: '#3b82f6',   // 파랑 (집중)
      hyperfocus: '#1d4ed8', // 진한 파랑 (과도한 집중)
    },
  },

  /**
   * Semantic Colors - 의미별 색상
   */
  semantic: {
    success: '#10b981',   // 성공 (초록)
    warning: '#f59e0b',   // 경고 (주황)
    error: '#ef4444',     // 오류 (빨강)
    info: '#3b82f6',      // 정보 (파랑)
  },

  /**
   * Neutral Colors - 기본 회색 스케일
   */
  neutral: {
    0: '#ffffff',     // 순백
    50: '#f9fafb',    // 거의 흰색
    100: '#f3f4f6',   // 매우 연한 회색
    200: '#e5e7eb',   // 연한 회색
    300: '#d1d5db',   // 옅은 회색
    400: '#9ca3af',   // 중간 옅은 회색
    500: '#6b7280',   // 중간 회색
    600: '#4b5563',   // 진한 회색
    700: '#374151',   // 더 진한 회색
    800: '#1f2937',   // 매우 진한 회색
    900: '#111827',   // 거의 검정
    1000: '#000000',  // 순검정
  },

  /**
   * Music Visualization Colors - 음악 시각화용 색상
   */
  visualization: {
    waveform: {
      active: '#7c6dff',    // 활성 파형
      inactive: '#d1d5db',  // 비활성 파형
      background: '#f9fafb', // 배경
    },

    spectrum: {
      bass: '#ef4444',      // 저음 (빨강)
      mid: '#f59e0b',       // 중음 (주황)
      treble: '#10b981',    // 고음 (초록)
      gradient: 'linear-gradient(90deg, #ef4444 0%, #f59e0b 50%, #10b981 100%)',
    },
  },
} as const;

// ============================================================================
// Typography Tokens - 폰트 및 텍스트 스타일
// ============================================================================

/**
 * Font Families - 폰트 패밀리 정의
 */
export const fonts = {
  // 본문용 폰트 (가독성 중심)
  body: [
    'Inter',
    '-apple-system',
    'BlinkMacSystemFont',
    'Segoe UI',
    'Roboto',
    'Helvetica Neue',
    'Arial',
    'sans-serif',
  ].join(', '),

  // 제목용 폰트 (브랜드 개성)
  heading: [
    'Inter',
    '-apple-system',
    'BlinkMacSystemFont',
    'Segoe UI',
    'Roboto',
    'Helvetica Neue',
    'Arial',
    'sans-serif',
  ].join(', '),

  // 모노스페이스 폰트 (코드, 데이터)
  mono: [
    'JetBrains Mono',
    'Fira Code',
    'Monaco',
    'Menlo',
    'Ubuntu Mono',
    'monospace',
  ].join(', '),
} as const;

/**
 * Font Sizes - 폰트 크기 시스템
 */
export const fontSizes = {
  xs: '0.75rem',    // 12px - 라벨, 캡션
  sm: '0.875rem',   // 14px - 작은 텍스트
  base: '1rem',     // 16px - 기본 본문
  lg: '1.125rem',   // 18px - 큰 본문
  xl: '1.25rem',    // 20px - 작은 제목
  '2xl': '1.5rem',  // 24px - 중간 제목
  '3xl': '1.875rem', // 30px - 큰 제목
  '4xl': '2.25rem', // 36px - 매우 큰 제목
  '5xl': '3rem',    // 48px - 헤드라인
  '6xl': '3.75rem', // 60px - 대형 헤드라인
} as const;

/**
 * Font Weights - 폰트 두께
 */
export const fontWeights = {
  thin: 100,
  extralight: 200,
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
  black: 900,
} as const;

/**
 * Line Heights - 줄 높이
 */
export const lineHeights = {
  none: 1,
  tight: 1.25,
  snug: 1.375,
  normal: 1.5,
  relaxed: 1.625,
  loose: 2,
} as const;

/**
 * Letter Spacing - 자간
 */
export const letterSpacing = {
  tighter: '-0.05em',
  tight: '-0.025em',
  normal: '0',
  wide: '0.025em',
  wider: '0.05em',
  widest: '0.1em',
} as const;

// ============================================================================
// Spacing Tokens - 간격 시스템
// ============================================================================

/**
 * Spacing Scale - 8px 기반 간격 시스템
 */
export const spacing = {
  0: '0',
  px: '1px',
  0.5: '0.125rem',  // 2px
  1: '0.25rem',     // 4px
  1.5: '0.375rem',  // 6px
  2: '0.5rem',      // 8px
  2.5: '0.625rem',  // 10px
  3: '0.75rem',     // 12px
  3.5: '0.875rem',  // 14px
  4: '1rem',        // 16px
  5: '1.25rem',     // 20px
  6: '1.5rem',      // 24px
  7: '1.75rem',     // 28px
  8: '2rem',        // 32px
  9: '2.25rem',     // 36px
  10: '2.5rem',     // 40px
  11: '2.75rem',    // 44px
  12: '3rem',       // 48px
  14: '3.5rem',     // 56px
  16: '4rem',       // 64px
  20: '5rem',       // 80px
  24: '6rem',       // 96px
  28: '7rem',       // 112px
  32: '8rem',       // 128px
  36: '9rem',       // 144px
  40: '10rem',      // 160px
  44: '11rem',      // 176px
  48: '12rem',      // 192px
  52: '13rem',      // 208px
  56: '14rem',      // 224px
  60: '15rem',      // 240px
  64: '16rem',      // 256px
  72: '18rem',      // 288px
  80: '20rem',      // 320px
  96: '24rem',      // 384px
} as const;

// ============================================================================
// Border & Radius Tokens - 테두리 및 둥글기
// ============================================================================

/**
 * Border Radius - 둥글기 시스템
 */
export const borderRadius = {
  none: '0',
  sm: '0.125rem',   // 2px
  base: '0.25rem',  // 4px
  md: '0.375rem',   // 6px
  lg: '0.5rem',     // 8px
  xl: '0.75rem',    // 12px
  '2xl': '1rem',    // 16px
  '3xl': '1.5rem',  // 24px
  full: '9999px',   // 완전한 원형
} as const;

/**
 * Border Width - 테두리 두께
 */
export const borderWidth = {
  0: '0',
  DEFAULT: '1px',
  2: '2px',
  4: '4px',
  8: '8px',
} as const;

// ============================================================================
// Shadow Tokens - 그림자 시스템
// ============================================================================

/**
 * Box Shadows - 그림자 스타일
 */
export const boxShadow = {
  none: 'none',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',

  // 감정적 그림자 (음악적 느낌)
  glow: '0 0 20px rgb(124 109 255 / 0.3)',
  'glow-sm': '0 0 10px rgb(124 109 255 / 0.2)',
  'glow-lg': '0 0 30px rgb(124 109 255 / 0.4)',
} as const;

// ============================================================================
// Animation & Transition Tokens - 애니메이션 및 전환
// ============================================================================

/**
 * Transition Duration - 전환 지속시간
 */
export const transitionDuration = {
  75: '75ms',
  100: '100ms',
  150: '150ms',
  200: '200ms',
  300: '300ms',
  500: '500ms',
  700: '700ms',
  1000: '1000ms',
} as const;

/**
 * Transition Timing Functions - 전환 타이밍 함수
 */
export const transitionTimingFunction = {
  linear: 'linear',
  in: 'cubic-bezier(0.4, 0, 1, 1)',
  out: 'cubic-bezier(0, 0, 0.2, 1)',
  'in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',

  // 음악적 리듬감을 위한 커스텀 easing
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  elastic: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
} as const;

// ============================================================================
// Z-Index Tokens - 레이어 순서
// ============================================================================

/**
 * Z-Index Scale - 레이어 관리
 */
export const zIndex = {
  auto: 'auto',
  base: 0,
  docked: 10,
  dropdown: 1000,
  sticky: 1100,
  banner: 1200,
  overlay: 1300,
  modal: 1400,
  popover: 1500,
  skipLink: 1600,
  toast: 1700,
  tooltip: 1800,
} as const;

// ============================================================================
// Component-Specific Tokens - 컴포넌트별 토큰
// ============================================================================

/**
 * Button Tokens - 버튼 관련 토큰
 */
export const button = {
  height: {
    sm: '2rem',      // 32px
    md: '2.5rem',    // 40px
    lg: '3rem',      // 48px
  },

  padding: {
    sm: `${spacing[2]} ${spacing[3]}`,    // 8px 12px
    md: `${spacing[2.5]} ${spacing[4]}`,  // 10px 16px
    lg: `${spacing[3]} ${spacing[6]}`,    // 12px 24px
  },
} as const;

/**
 * Input Tokens - 입력 필드 관련 토큰
 */
export const input = {
  height: {
    sm: '2rem',      // 32px
    md: '2.5rem',    // 40px
    lg: '3rem',      // 48px
  },

  padding: {
    sm: `${spacing[1.5]} ${spacing[3]}`,  // 6px 12px
    md: `${spacing[2]} ${spacing[3]}`,    // 8px 12px
    lg: `${spacing[2.5]} ${spacing[4]}`,  // 10px 16px
  },
} as const;

// ============================================================================
// Export All Tokens
// ============================================================================

/**
 * 모든 디자인 토큰을 하나의 객체로 내보내기
 */
export const tokens = {
  colors,
  fonts,
  fontSizes,
  fontWeights,
  lineHeights,
  letterSpacing,
  spacing,
  borderRadius,
  borderWidth,
  boxShadow,
  transitionDuration,
  transitionTimingFunction,
  zIndex,
  button,
  input,
} as const;

export default tokens;