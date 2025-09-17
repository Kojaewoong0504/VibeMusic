/**
 * Responsive Design Hook
 *
 * T096: 모바일 반응형 최적화
 * - 반응형 상태 관리 및 감지
 * - 뷰포트 크기 추적
 * - 디바이스 타입 감지
 * - 성능 최적화된 리사이즈 핸들링
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  breakpoints,
  type Breakpoint,
  type ResponsiveValue,
  isMobileDevice,
  isTouchDevice,
} from '@/styles/responsive';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * 뷰포트 정보 타입
 */
export interface ViewportInfo {
  width: number;
  height: number;
  aspectRatio: number;
  currentBreakpoint: Breakpoint;
  isLandscape: boolean;
  isPortrait: boolean;
}

/**
 * 디바이스 정보 타입
 */
export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouch: boolean;
  isRetina: boolean;
  pixelRatio: number;
}

/**
 * useResponsive 반환 타입
 */
export interface UseResponsiveReturn {
  // 뷰포트 정보
  viewport: ViewportInfo;

  // 디바이스 정보
  device: DeviceInfo;

  // 브레이크포인트 체크
  isMobileBreakpoint: boolean;
  isTabletBreakpoint: boolean;
  isDesktopBreakpoint: boolean;
  isWideBreakpoint: boolean;

  // 브레이크포인트 매칭
  matches: (breakpoint: Breakpoint) => boolean;
  matchesAny: (breakpoints: Breakpoint[]) => boolean;
  matchesAll: (breakpoints: Breakpoint[]) => boolean;

  // 반응형 값 선택
  getValue: <T>(values: ResponsiveValue<T>) => T;
  getValueOrFallback: <T>(values: Partial<ResponsiveValue<T>>, fallback: T) => T;

  // 유틸리티
  isSSR: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * 반응형 디자인을 위한 Hook
 */
export function useResponsive(): UseResponsiveReturn {
  // State
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  const [isSSR, setIsSSR] = useState(typeof window === 'undefined');

  // 뷰포트 크기 업데이트 핸들러 (디바운싱 적용)
  const updateViewportSize = useCallback(() => {
    if (typeof window === 'undefined') return;

    setViewportSize({
      width: window.innerWidth,
      height: window.innerHeight,
    });
  }, []);

  // 디바운싱된 리사이즈 핸들러
  const debouncedUpdateSize = useMemo(() => {
    let timeoutId: NodeJS.Timeout;

    return () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(updateViewportSize, 150); // 150ms 디바운스
    };
  }, [updateViewportSize]);

  // 리사이즈 이벤트 리스너 등록
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // SSR 체크
    setIsSSR(false);

    // 초기 크기 설정
    updateViewportSize();

    // 리사이즈 이벤트 리스너
    window.addEventListener('resize', debouncedUpdateSize, { passive: true });
    window.addEventListener('orientationchange', debouncedUpdateSize, { passive: true });

    return () => {
      window.removeEventListener('resize', debouncedUpdateSize);
      window.removeEventListener('orientationchange', debouncedUpdateSize);
    };
  }, [updateViewportSize, debouncedUpdateSize]);

  // 뷰포트 정보 계산
  const viewport = useMemo((): ViewportInfo => {
    const { width, height } = viewportSize;

    // 현재 브레이크포인트 결정
    let currentBreakpoint: Breakpoint = 'mobile';
    if (width >= breakpoints.wide.min) {
      currentBreakpoint = 'wide';
    } else if (width >= breakpoints.desktop.min) {
      currentBreakpoint = 'desktop';
    } else if (width >= breakpoints.tablet.min) {
      currentBreakpoint = 'tablet';
    }

    return {
      width,
      height,
      aspectRatio: width / height,
      currentBreakpoint,
      isLandscape: width > height,
      isPortrait: height >= width,
    };
  }, [viewportSize]);

  // 디바이스 정보 계산
  const device = useMemo((): DeviceInfo => {
    if (isSSR) {
      // SSR에서는 기본값 반환
      return {
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        isTouch: false,
        isRetina: false,
        pixelRatio: 1,
      };
    }

    const pixelRatio = window.devicePixelRatio || 1;
    const isMobile = isMobileDevice();
    const isTouch = isTouchDevice();

    return {
      isMobile,
      isTablet: viewport.currentBreakpoint === 'tablet' && !isMobile,
      isDesktop: viewport.currentBreakpoint !== 'mobile' && !isMobile,
      isTouch,
      isRetina: pixelRatio >= 2,
      pixelRatio,
    };
  }, [viewport.currentBreakpoint, isSSR]);

  // 브레이크포인트 체크
  const isMobileBreakpoint = viewport.currentBreakpoint === 'mobile';
  const isTabletBreakpoint = viewport.currentBreakpoint === 'tablet';
  const isDesktopBreakpoint = viewport.currentBreakpoint === 'desktop';
  const isWideBreakpoint = viewport.currentBreakpoint === 'wide';

  // 브레이크포인트 매칭 함수
  const matches = useCallback(
    (breakpoint: Breakpoint): boolean => {
      return viewport.currentBreakpoint === breakpoint;
    },
    [viewport.currentBreakpoint]
  );

  const matchesAny = useCallback(
    (breakpointsToMatch: Breakpoint[]): boolean => {
      return breakpointsToMatch.includes(viewport.currentBreakpoint);
    },
    [viewport.currentBreakpoint]
  );

  const matchesAll = useCallback(
    (breakpointsToMatch: Breakpoint[]): boolean => {
      // 논리적으로 하나의 breakpoint만 매칭 가능하므로,
      // 배열에 현재 breakpoint만 있는 경우만 true
      return breakpointsToMatch.length === 1 && breakpointsToMatch[0] === viewport.currentBreakpoint;
    },
    [viewport.currentBreakpoint]
  );

  // 반응형 값 선택 함수
  const getValue = useCallback(
    <T>(values: ResponsiveValue<T>): T => {
      return values[viewport.currentBreakpoint];
    },
    [viewport.currentBreakpoint]
  );

  const getValueOrFallback = useCallback(
    <T>(values: Partial<ResponsiveValue<T>>, fallback: T): T => {
      // 현재 브레이크포인트의 값이 있으면 반환
      if (values[viewport.currentBreakpoint] !== undefined) {
        return values[viewport.currentBreakpoint] as T;
      }

      // 폴백 순서: desktop -> tablet -> mobile
      if (viewport.currentBreakpoint === 'wide' && values.desktop !== undefined) {
        return values.desktop as T;
      }

      if (
        (viewport.currentBreakpoint === 'wide' || viewport.currentBreakpoint === 'desktop') &&
        values.tablet !== undefined
      ) {
        return values.tablet as T;
      }

      if (values.mobile !== undefined) {
        return values.mobile as T;
      }

      return fallback;
    },
    [viewport.currentBreakpoint]
  );

  return {
    viewport,
    device,
    isMobileBreakpoint,
    isTabletBreakpoint,
    isDesktopBreakpoint,
    isWideBreakpoint,
    matches,
    matchesAny,
    matchesAll,
    getValue,
    getValueOrFallback,
    isSSR,
  };
}

// ============================================================================
// 특화된 Hook들
// ============================================================================

/**
 * 모바일 디바이스 감지 Hook
 */
export function useMobileDetection() {
  const { device, isMobileBreakpoint } = useResponsive();

  return useMemo(
    () => ({
      isMobileDevice: device.isMobile,
      isMobileBreakpoint,
      isMobile: device.isMobile || isMobileBreakpoint,
      isTouch: device.isTouch,
      shouldShowMobileUI: device.isMobile || isMobileBreakpoint,
    }),
    [device.isMobile, device.isTouch, isMobileBreakpoint]
  );
}

/**
 * 브레이크포인트 변경 감지 Hook
 */
export function useBreakpointChange(
  callback: (currentBreakpoint: Breakpoint, previousBreakpoint: Breakpoint | null) => void
) {
  const { viewport } = useResponsive();
  const [previousBreakpoint, setPreviousBreakpoint] = useState<Breakpoint | null>(null);

  useEffect(() => {
    if (previousBreakpoint !== null && previousBreakpoint !== viewport.currentBreakpoint) {
      callback(viewport.currentBreakpoint, previousBreakpoint);
    }
    setPreviousBreakpoint(viewport.currentBreakpoint);
  }, [viewport.currentBreakpoint, callback, previousBreakpoint]);
}

/**
 * 뷰포트 크기 변경 감지 Hook
 */
export function useViewportChange(
  callback: (viewport: ViewportInfo, previous: ViewportInfo | null) => void,
  threshold = 50 // 최소 변경량 (픽셀)
) {
  const { viewport } = useResponsive();
  const [previousViewport, setPreviousViewport] = useState<ViewportInfo | null>(null);

  useEffect(() => {
    if (previousViewport !== null) {
      const widthDiff = Math.abs(viewport.width - previousViewport.width);
      const heightDiff = Math.abs(viewport.height - previousViewport.height);

      if (widthDiff >= threshold || heightDiff >= threshold) {
        callback(viewport, previousViewport);
      }
    }
    setPreviousViewport(viewport);
  }, [viewport, callback, threshold, previousViewport]);
}

/**
 * 방향 변경 감지 Hook
 */
export function useOrientationChange(callback: (isLandscape: boolean) => void) {
  const { viewport } = useResponsive();
  const [previousIsLandscape, setPreviousIsLandscape] = useState<boolean | null>(null);

  useEffect(() => {
    if (previousIsLandscape !== null && previousIsLandscape !== viewport.isLandscape) {
      callback(viewport.isLandscape);
    }
    setPreviousIsLandscape(viewport.isLandscape);
  }, [viewport.isLandscape, callback, previousIsLandscape]);
}

// ============================================================================
// 유틸리티 Hook들
// ============================================================================

/**
 * 조건부 반응형 클래스명 생성 Hook
 */
export function useResponsiveClasses(
  classes: Partial<Record<Breakpoint, string>>,
  baseClass = ''
): string {
  const { viewport } = useResponsive();

  return useMemo(() => {
    const currentClass = classes[viewport.currentBreakpoint] || '';
    return [baseClass, currentClass].filter(Boolean).join(' ');
  }, [viewport.currentBreakpoint, classes, baseClass]);
}

/**
 * 반응형 스타일 생성 Hook
 */
export function useResponsiveStyles<T extends React.CSSProperties>(
  styles: Partial<Record<Breakpoint, T>>,
  baseStyle: T = {} as T
): T {
  const { viewport } = useResponsive();

  return useMemo(() => {
    const currentStyle = styles[viewport.currentBreakpoint] || {};
    return { ...baseStyle, ...currentStyle };
  }, [viewport.currentBreakpoint, styles, baseStyle]);
}

// ============================================================================
// 성능 최적화된 Hook
// ============================================================================

/**
 * 메모화된 반응형 값 Hook
 */
export function useMemoizedResponsiveValue<T>(
  values: ResponsiveValue<T>,
  deps: React.DependencyList = []
): T {
  const { getValue } = useResponsive();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => getValue(values), [getValue, values, ...deps]);
}

/**
 * 지연된 브레이크포인트 변경 Hook (성능 최적화)
 */
export function useDeferredBreakpoint(delay = 300): Breakpoint {
  const { viewport } = useResponsive();
  const [deferredBreakpoint, setDeferredBreakpoint] = useState(viewport.currentBreakpoint);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDeferredBreakpoint(viewport.currentBreakpoint);
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [viewport.currentBreakpoint, delay]);

  return deferredBreakpoint;
}