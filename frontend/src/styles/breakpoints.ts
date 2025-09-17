/**
 * VibeMusic Responsive Breakpoints
 *
 * 감정 기반 AI 음악 생성 서비스를 위한 반응형 브레이크포인트 시스템
 * 모바일부터 데스크탑까지 최적화된 사용자 경험 제공
 */

// ============================================================================
// Breakpoint Definitions
// ============================================================================

/**
 * Breakpoint Values (모바일 퍼스트 접근법)
 */
export const breakpoints = {
  // 모바일 (기본, ~640px)
  xs: '0px',

  // 대형 모바일 (640px~)
  sm: '640px',

  // 태블릿 (768px~)
  md: '768px',

  // 데스크탑 (1024px~)
  lg: '1024px',

  // 대형 데스크탑 (1280px~)
  xl: '1280px',

  // 초대형 데스크탑 (1536px~)
  '2xl': '1536px',
} as const;

/**
 * Breakpoint Keys Type
 */
export type BreakpointKey = keyof typeof breakpoints;

// ============================================================================
// Media Query Helpers
// ============================================================================

/**
 * 최소 너비 미디어 쿼리 생성 (모바일 퍼스트)
 */
export const mediaQuery = {
  // 640px 이상 (대형 모바일)
  sm: `@media (min-width: ${breakpoints.sm})`,

  // 768px 이상 (태블릿)
  md: `@media (min-width: ${breakpoints.md})`,

  // 1024px 이상 (데스크탑)
  lg: `@media (min-width: ${breakpoints.lg})`,

  // 1280px 이상 (대형 데스크탑)
  xl: `@media (min-width: ${breakpoints.xl})`,

  // 1536px 이상 (초대형 데스크탑)
  '2xl': `@media (min-width: ${breakpoints['2xl']})`,
} as const;

/**
 * 최대 너비 미디어 쿼리 생성 (데스크탑 퍼스트)
 */
export const mediaQueryMax = {
  // ~639px (모바일만)
  xs: `@media (max-width: ${parseFloat(breakpoints.sm) - 0.02}px)`,

  // ~767px (모바일 + 대형 모바일)
  sm: `@media (max-width: ${parseFloat(breakpoints.md) - 0.02}px)`,

  // ~1023px (태블릿 이하)
  md: `@media (max-width: ${parseFloat(breakpoints.lg) - 0.02}px)`,

  // ~1279px (데스크탑 이하)
  lg: `@media (max-width: ${parseFloat(breakpoints.xl) - 0.02}px)`,

  // ~1535px (대형 데스크탑 이하)
  xl: `@media (max-width: ${parseFloat(breakpoints['2xl']) - 0.02}px)`,
} as const;

/**
 * 범위 미디어 쿼리 생성
 */
export const mediaQueryBetween = {
  // 640px ~ 767px (대형 모바일만)
  'sm-only': `@media (min-width: ${breakpoints.sm}) and (max-width: ${parseFloat(breakpoints.md) - 0.02}px)`,

  // 768px ~ 1023px (태블릿만)
  'md-only': `@media (min-width: ${breakpoints.md}) and (max-width: ${parseFloat(breakpoints.lg) - 0.02}px)`,

  // 1024px ~ 1279px (데스크탑만)
  'lg-only': `@media (min-width: ${breakpoints.lg}) and (max-width: ${parseFloat(breakpoints.xl) - 0.02}px)`,

  // 1280px ~ 1535px (대형 데스크탑만)
  'xl-only': `@media (min-width: ${breakpoints.xl}) and (max-width: ${parseFloat(breakpoints['2xl']) - 0.02}px)`,
} as const;

// ============================================================================
// Container Sizes
// ============================================================================

/**
 * 컨테이너 최대 너비 정의
 */
export const containerSizes = {
  xs: '100%',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

/**
 * 컨테이너 패딩 정의
 */
export const containerPadding = {
  xs: '1rem',    // 16px
  sm: '1.5rem',  // 24px
  md: '2rem',    // 32px
  lg: '2rem',    // 32px
  xl: '2rem',    // 32px
  '2xl': '2rem', // 32px
} as const;

// ============================================================================
// Layout Grid System
// ============================================================================

/**
 * 그리드 컬럼 정의 (12 컬럼 시스템)
 */
export const gridColumns = {
  xs: 4,   // 모바일: 4컬럼
  sm: 8,   // 대형 모바일: 8컬럼
  md: 12,  // 태블릿: 12컬럼
  lg: 12,  // 데스크탑: 12컬럼
  xl: 12,  // 대형 데스크탑: 12컬럼
  '2xl': 12, // 초대형 데스크탑: 12컬럼
} as const;

/**
 * 그리드 갭 정의
 */
export const gridGap = {
  xs: '1rem',    // 16px
  sm: '1.5rem',  // 24px
  md: '2rem',    // 32px
  lg: '2rem',    // 32px
  xl: '2rem',    // 32px
  '2xl': '2rem', // 32px
} as const;

// ============================================================================
// VibeMusic-Specific Responsive Patterns
// ============================================================================

/**
 * 타이핑 인터페이스 레이아웃
 */
export const typingInterfaceLayout = {
  // 모바일: 세로 스택, 작은 높이
  xs: {
    direction: 'column',
    height: '200px',
    fontSize: '14px',
    padding: '1rem',
  },

  // 태블릿: 세로 스택, 중간 높이
  md: {
    direction: 'column',
    height: '250px',
    fontSize: '16px',
    padding: '1.5rem',
  },

  // 데스크탑: 가로 분할, 큰 높이
  lg: {
    direction: 'row',
    height: '300px',
    fontSize: '18px',
    padding: '2rem',
  },
} as const;

/**
 * 감정 시각화 크기
 */
export const emotionVisualizationSizes = {
  xs: {
    width: '100%',
    height: '150px',
    circleSize: '80px',
  },

  sm: {
    width: '100%',
    height: '200px',
    circleSize: '100px',
  },

  md: {
    width: '100%',
    height: '250px',
    circleSize: '120px',
  },

  lg: {
    width: '400px',
    height: '300px',
    circleSize: '150px',
  },
} as const;

/**
 * 음악 플레이어 레이아웃
 */
export const musicPlayerLayout = {
  xs: {
    orientation: 'vertical',
    controlSize: '48px',
    progressHeight: '4px',
  },

  md: {
    orientation: 'horizontal',
    controlSize: '56px',
    progressHeight: '6px',
  },

  lg: {
    orientation: 'horizontal',
    controlSize: '64px',
    progressHeight: '8px',
  },
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 브레이크포인트에서 픽셀 값 추출
 */
export function getBreakpointValue(breakpoint: BreakpointKey): number {
  return parseFloat(breakpoints[breakpoint]);
}

/**
 * 현재 화면이 특정 브레이크포인트보다 큰지 확인
 */
export function isAboveBreakpoint(width: number, breakpoint: BreakpointKey): boolean {
  return width >= getBreakpointValue(breakpoint);
}

/**
 * 현재 화면이 특정 브레이크포인트보다 작은지 확인
 */
export function isBelowBreakpoint(width: number, breakpoint: BreakpointKey): boolean {
  return width < getBreakpointValue(breakpoint);
}

/**
 * 현재 활성 브레이크포인트 감지
 */
export function getCurrentBreakpoint(width: number): BreakpointKey {
  if (width >= getBreakpointValue('2xl')) return '2xl';
  if (width >= getBreakpointValue('xl')) return 'xl';
  if (width >= getBreakpointValue('lg')) return 'lg';
  if (width >= getBreakpointValue('md')) return 'md';
  if (width >= getBreakpointValue('sm')) return 'sm';
  return 'xs';
}

/**
 * 브레이크포인트별 값 선택 유틸리티
 */
export function getResponsiveValue<T>(
  values: Partial<Record<BreakpointKey, T>>,
  currentBreakpoint: BreakpointKey
): T | undefined {
  const orderedBreakpoints: BreakpointKey[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];

  // 현재 브레이크포인트부터 역순으로 검색
  const currentIndex = orderedBreakpoints.indexOf(currentBreakpoint);

  for (let i = currentIndex; i >= 0; i--) {
    const bp = orderedBreakpoints[i];
    if (values[bp] !== undefined) {
      return values[bp];
    }
  }

  return undefined;
}

// ============================================================================
// CSS Custom Properties for Breakpoints
// ============================================================================

/**
 * CSS에서 사용할 수 있는 브레이크포인트 커스텀 프로퍼티
 */
export const cssBreakpoints = `
  :root {
    --breakpoint-xs: ${breakpoints.xs};
    --breakpoint-sm: ${breakpoints.sm};
    --breakpoint-md: ${breakpoints.md};
    --breakpoint-lg: ${breakpoints.lg};
    --breakpoint-xl: ${breakpoints.xl};
    --breakpoint-2xl: ${breakpoints['2xl']};

    --container-xs: ${containerSizes.xs};
    --container-sm: ${containerSizes.sm};
    --container-md: ${containerSizes.md};
    --container-lg: ${containerSizes.lg};
    --container-xl: ${containerSizes.xl};
    --container-2xl: ${containerSizes['2xl']};

    --container-padding-xs: ${containerPadding.xs};
    --container-padding-sm: ${containerPadding.sm};
    --container-padding-md: ${containerPadding.md};
    --container-padding-lg: ${containerPadding.lg};
    --container-padding-xl: ${containerPadding.xl};
    --container-padding-2xl: ${containerPadding['2xl']};
  }
`;

// ============================================================================
// Export All
// ============================================================================

export default {
  breakpoints,
  mediaQuery,
  mediaQueryMax,
  mediaQueryBetween,
  containerSizes,
  containerPadding,
  gridColumns,
  gridGap,
  typingInterfaceLayout,
  emotionVisualizationSizes,
  musicPlayerLayout,
  getBreakpointValue,
  isAboveBreakpoint,
  isBelowBreakpoint,
  getCurrentBreakpoint,
  getResponsiveValue,
  cssBreakpoints,
};