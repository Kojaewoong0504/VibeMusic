/**
 * Responsive Design System
 *
 * T096: 모바일 반응형 최적화
 * - 일관성 있는 브레이크포인트 정의
 * - 모바일 우선(Mobile-first) 접근법
 * - 터치 인터페이스 최적화
 * - CSS Grid와 Flexbox 기반 레이아웃
 */

// ============================================================================
// Breakpoints Configuration
// ============================================================================

/**
 * 표준 브레이크포인트 정의
 * 모바일 우선 설계 (Mobile-first approach)
 */
export const breakpoints = {
  // 모바일 (기본)
  mobile: {
    min: 0,
    max: 767,
  },
  // 태블릿
  tablet: {
    min: 768,
    max: 1023,
  },
  // 데스크톱
  desktop: {
    min: 1024,
    max: 1439,
  },
  // 대형 데스크톱
  wide: {
    min: 1440,
    max: Infinity,
  },
} as const;

/**
 * 미디어 쿼리 헬퍼
 */
export const mediaQuery = {
  // 최소 너비 (mobile-first)
  mobile: `@media (min-width: ${breakpoints.mobile.min}px)`,
  tablet: `@media (min-width: ${breakpoints.tablet.min}px)`,
  desktop: `@media (min-width: ${breakpoints.desktop.min}px)`,
  wide: `@media (min-width: ${breakpoints.wide.min}px)`,

  // 최대 너비 (desktop-first - 특수한 경우만 사용)
  mobileOnly: `@media (max-width: ${breakpoints.mobile.max}px)`,
  tabletOnly: `@media (min-width: ${breakpoints.tablet.min}px) and (max-width: ${breakpoints.tablet.max}px)`,
  desktopOnly: `@media (min-width: ${breakpoints.desktop.min}px) and (max-width: ${breakpoints.desktop.max}px)`,

  // 특수 쿼리
  landscape: '@media (orientation: landscape)',
  portrait: '@media (orientation: portrait)',
  retina: '@media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi)',

  // 터치 디바이스
  touch: '@media (hover: none) and (pointer: coarse)',
  mouse: '@media (hover: hover) and (pointer: fine)',
} as const;

// ============================================================================
// Responsive Spacing
// ============================================================================

/**
 * 반응형 스페이싱 시스템
 */
export const responsiveSpacing = {
  // 컨테이너 패딩
  containerPadding: {
    mobile: '16px',
    tablet: '24px',
    desktop: '32px',
    wide: '48px',
  },

  // 섹션 간격
  sectionGap: {
    mobile: '32px',
    tablet: '48px',
    desktop: '64px',
    wide: '80px',
  },

  // 컴포넌트 간격
  componentGap: {
    mobile: '16px',
    tablet: '20px',
    desktop: '24px',
    wide: '24px',
  },

  // 요소 간격
  elementGap: {
    mobile: '8px',
    tablet: '12px',
    desktop: '16px',
    wide: '16px',
  },
} as const;

// ============================================================================
// Responsive Typography
// ============================================================================

/**
 * 반응형 타이포그래피 스케일
 */
export const responsiveTypography = {
  // 헤딩 크기
  headings: {
    h1: {
      mobile: '28px',
      tablet: '36px',
      desktop: '48px',
      wide: '56px',
    },
    h2: {
      mobile: '24px',
      tablet: '30px',
      desktop: '36px',
      wide: '42px',
    },
    h3: {
      mobile: '20px',
      tablet: '24px',
      desktop: '30px',
      wide: '32px',
    },
    h4: {
      mobile: '18px',
      tablet: '20px',
      desktop: '24px',
      wide: '24px',
    },
  },

  // 본문 텍스트
  body: {
    large: {
      mobile: '16px',
      tablet: '18px',
      desktop: '20px',
      wide: '20px',
    },
    regular: {
      mobile: '14px',
      tablet: '16px',
      desktop: '16px',
      wide: '16px',
    },
    small: {
      mobile: '12px',
      tablet: '14px',
      desktop: '14px',
      wide: '14px',
    },
  },

  // 라인 높이
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

// ============================================================================
// Responsive Layout
// ============================================================================

/**
 * 반응형 레이아웃 설정
 */
export const responsiveLayout = {
  // 컨테이너 최대 너비
  maxWidth: {
    mobile: '100%',
    tablet: '100%',
    desktop: '1200px',
    wide: '1400px',
  },

  // 그리드 컬럼
  gridColumns: {
    mobile: 1,
    tablet: 2,
    desktop: 3,
    wide: 4,
  },

  // 사이드바 너비
  sidebarWidth: {
    mobile: '100%', // 전체 너비 (스택 레이아웃)
    tablet: '280px',
    desktop: '320px',
    wide: '360px',
  },

  // 헤더 높이
  headerHeight: {
    mobile: '56px',
    tablet: '64px',
    desktop: '72px',
    wide: '72px',
  },
} as const;

// ============================================================================
// Touch Interface Optimization
// ============================================================================

/**
 * 터치 인터페이스 최적화 설정
 */
export const touchOptimization = {
  // 최소 터치 타겟 크기 (iOS 44px, Material 48px 기준)
  minTouchTarget: '48px',

  // 버튼 사이즈
  buttonSize: {
    small: {
      mobile: '40px',
      tablet: '36px',
      desktop: '32px',
    },
    medium: {
      mobile: '48px',
      tablet: '44px',
      desktop: '40px',
    },
    large: {
      mobile: '56px',
      tablet: '52px',
      desktop: '48px',
    },
  },

  // 인풋 사이즈
  inputHeight: {
    mobile: '48px',
    tablet: '44px',
    desktop: '40px',
  },

  // 터치 패딩 (터치 영역 확대)
  touchPadding: {
    mobile: '12px',
    tablet: '8px',
    desktop: '4px',
  },
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 현재 뷰포트 크기에 따른 값을 반환하는 유틸리티
 */
export function getResponsiveValue<T>(
  values: {
    mobile: T;
    tablet: T;
    desktop: T;
    wide: T;
  },
  viewport: 'mobile' | 'tablet' | 'desktop' | 'wide' = 'mobile'
): T {
  return values[viewport];
}

/**
 * CSS 미디어 쿼리를 생성하는 헬퍼
 */
export function createMediaQuery(
  styles: Partial<{
    mobile: React.CSSProperties;
    tablet: React.CSSProperties;
    desktop: React.CSSProperties;
    wide: React.CSSProperties;
  }>
): string {
  const queries: string[] = [];

  if (styles.mobile) {
    queries.push(`
      ${mediaQuery.mobile} {
        ${Object.entries(styles.mobile)
          .map(([key, value]) => `${camelToKebab(key)}: ${value};`)
          .join('\n        ')}
      }
    `);
  }

  if (styles.tablet) {
    queries.push(`
      ${mediaQuery.tablet} {
        ${Object.entries(styles.tablet)
          .map(([key, value]) => `${camelToKebab(key)}: ${value};`)
          .join('\n        ')}
      }
    `);
  }

  if (styles.desktop) {
    queries.push(`
      ${mediaQuery.desktop} {
        ${Object.entries(styles.desktop)
          .map(([key, value]) => `${camelToKebab(key)}: ${value};`)
          .join('\n        ')}
      }
    `);
  }

  if (styles.wide) {
    queries.push(`
      ${mediaQuery.wide} {
        ${Object.entries(styles.wide)
          .map(([key, value]) => `${camelToKebab(key)}: ${value};`)
          .join('\n        ')}
      }
    `);
  }

  return queries.join('\n');
}

/**
 * camelCase를 kebab-case로 변환
 */
function camelToKebab(str: string): string {
  return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * 뷰포트 크기 감지
 */
export function useViewportSize() {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0, viewport: 'mobile' as const };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;

  let viewport: 'mobile' | 'tablet' | 'desktop' | 'wide' = 'mobile';

  if (width >= breakpoints.wide.min) {
    viewport = 'wide';
  } else if (width >= breakpoints.desktop.min) {
    viewport = 'desktop';
  } else if (width >= breakpoints.tablet.min) {
    viewport = 'tablet';
  } else {
    viewport = 'mobile';
  }

  return { width, height, viewport };
}

/**
 * 모바일 디바이스 감지
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;

  const userAgent = navigator.userAgent || navigator.vendor;

  // iOS 디바이스
  if (/iPad|iPhone|iPod/.test(userAgent)) {
    return true;
  }

  // Android 디바이스
  if (/Android/.test(userAgent)) {
    return true;
  }

  // 기타 모바일 디바이스
  if (/Mobi|Opera Mini/i.test(userAgent)) {
    return true;
  }

  // 터치 지원 여부로 판단
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * 터치 디바이스 감지
 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;

  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia('(hover: none) and (pointer: coarse)').matches
  );
}

// ============================================================================
// Responsive Component Styles
// ============================================================================

/**
 * 공통 반응형 스타일
 */
export const responsiveStyles = {
  // 컨테이너 스타일
  container: {
    width: '100%',
    margin: '0 auto',
    padding: `0 ${responsiveSpacing.containerPadding.mobile}`,

    [`${mediaQuery.tablet}`]: {
      padding: `0 ${responsiveSpacing.containerPadding.tablet}`,
    },

    [`${mediaQuery.desktop}`]: {
      maxWidth: responsiveLayout.maxWidth.desktop,
      padding: `0 ${responsiveSpacing.containerPadding.desktop}`,
    },

    [`${mediaQuery.wide}`]: {
      maxWidth: responsiveLayout.maxWidth.wide,
      padding: `0 ${responsiveSpacing.containerPadding.wide}`,
    },
  },

  // 그리드 스타일
  grid: {
    display: 'grid',
    gap: responsiveSpacing.elementGap.mobile,
    gridTemplateColumns: `repeat(${responsiveLayout.gridColumns.mobile}, 1fr)`,

    [`${mediaQuery.tablet}`]: {
      gap: responsiveSpacing.elementGap.tablet,
      gridTemplateColumns: `repeat(${responsiveLayout.gridColumns.tablet}, 1fr)`,
    },

    [`${mediaQuery.desktop}`]: {
      gap: responsiveSpacing.elementGap.desktop,
      gridTemplateColumns: `repeat(${responsiveLayout.gridColumns.desktop}, 1fr)`,
    },

    [`${mediaQuery.wide}`]: {
      gap: responsiveSpacing.elementGap.wide,
      gridTemplateColumns: `repeat(${responsiveLayout.gridColumns.wide}, 1fr)`,
    },
  },

  // 플렉스 스타일
  flex: {
    display: 'flex',
    gap: responsiveSpacing.elementGap.mobile,

    [`${mediaQuery.tablet}`]: {
      gap: responsiveSpacing.elementGap.tablet,
    },

    [`${mediaQuery.desktop}`]: {
      gap: responsiveSpacing.elementGap.desktop,
    },

    [`${mediaQuery.wide}`]: {
      gap: responsiveSpacing.elementGap.wide,
    },
  },
} as const;

// ============================================================================
// Export Types
// ============================================================================

export type Breakpoint = keyof typeof breakpoints;
export type MediaQuery = keyof typeof mediaQuery;
export type ResponsiveSpacing = typeof responsiveSpacing;
export type ResponsiveTypography = typeof responsiveTypography;
export type ResponsiveLayout = typeof responsiveLayout;
export type TouchOptimization = typeof touchOptimization;

/**
 * 반응형 값 타입
 */
export type ResponsiveValue<T> = {
  mobile: T;
  tablet: T;
  desktop: T;
  wide: T;
};