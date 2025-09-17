/**
 * Theme Management Hook
 *
 * T095: 다크 모드 구현
 * - 라이트/다크/자동 테마 전환
 * - 시스템 선호도 감지
 * - 로컬 스토리지 상태 관리
 * - CSS 커스텀 프로퍼티 적용
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { ThemeMode, themes, cssVariables, themeTransitionCSS, darkModeMediaQuery } from '@/styles/themes';
import { useResponsive } from './useResponsive';

interface UseThemeReturn {
  // 현재 상태
  mode: ThemeMode;
  isDark: boolean;
  isLight: boolean;
  isAuto: boolean;
  effectiveTheme: 'light' | 'dark';
  systemPrefersDark: boolean;

  // 테마 변경
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;

  // 테마 데이터
  colors: typeof themes.light;
  cssVars: Record<string, string>;

  // 반응형 통합 (T096)
  isMobileTheme: boolean;
  responsiveColors: typeof themes.light & {
    mobile: typeof themes.light;
    tablet: typeof themes.light;
    desktop: typeof themes.light;
  };

  // 유틸리티
  isSystemDark: () => boolean;
  getStoredTheme: () => ThemeMode;
}

// 로컬 스토리지 키
const THEME_STORAGE_KEY = 'vibemusic-theme';

// 시스템 다크 모드 감지
function getSystemPreference(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// 저장된 테마 불러오기
function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'auto';

  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && ['light', 'dark', 'auto'].includes(stored)) {
      return stored as ThemeMode;
    }
  } catch (error) {
    console.warn('테마 설정을 불러올 수 없습니다:', error);
  }

  return 'auto';
}

// 테마 저장하기
function storeTheme(mode: ThemeMode): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch (error) {
    console.warn('테마 설정을 저장할 수 없습니다:', error);
  }
}

// CSS 변수 적용
function applyCSSVariables(variables: Record<string, string>): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  Object.entries(variables).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });
}

// 테마 전환 클래스 추가
function addThemeTransition(): void {
  if (typeof document === 'undefined') return;

  const style = document.createElement('style');
  style.textContent = themeTransitionCSS;
  style.id = 'theme-transition-styles';

  // 기존 스타일 제거
  const existing = document.getElementById('theme-transition-styles');
  if (existing) {
    existing.remove();
  }

  document.head.appendChild(style);
}

// HTML 클래스 관리
function updateHTMLClass(theme: 'light' | 'dark'): void {
  if (typeof document === 'undefined') return;

  const html = document.documentElement;

  // 기존 테마 클래스 제거
  html.classList.remove('light', 'dark');

  // 새 테마 클래스 추가
  html.classList.add(theme);

  // data 속성도 설정
  html.setAttribute('data-theme', theme);
}

export function useTheme(): UseThemeReturn {
  // 반응형 Hook 통합 (T096)
  const { isMobileBreakpoint } = useResponsive() || { isMobileBreakpoint: false };

  // 초기 테마 설정
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'auto';
    return getStoredTheme();
  });

  // 시스템 다크 모드 선호도 감지
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    return getSystemPreference();
  });

  // 효과적인 테마 (auto 모드일 때 실제 적용되는 테마)
  const effectiveTheme = useMemo((): 'light' | 'dark' => {
    if (mode === 'auto') {
      return systemPrefersDark ? 'dark' : 'light';
    }
    return mode;
  }, [mode, systemPrefersDark]);

  // 현재 테마 색상
  const colors = useMemo(() => {
    return themes[effectiveTheme];
  }, [effectiveTheme]);

  // CSS 변수
  const cssVars = useMemo(() => {
    return cssVariables[effectiveTheme];
  }, [effectiveTheme]);

  // 반응형 테마 색상 (T096)
  const responsiveColors = useMemo(() => {
    const baseColors = themes[effectiveTheme];
    return {
      ...baseColors,
      mobile: baseColors,
      tablet: baseColors,
      desktop: baseColors,
    };
  }, [effectiveTheme]);

  // 모바일 테마 여부
  const isMobileTheme = isMobileBreakpoint;

  // 시스템 선호도 변경 감지
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };

    // 이벤트 리스너 추가
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  // 테마 변경 시 DOM 업데이트
  useEffect(() => {
    // 전환 애니메이션 추가
    addThemeTransition();

    // HTML 클래스 업데이트
    updateHTMLClass(effectiveTheme);

    // CSS 변수 적용
    applyCSSVariables(cssVars);

    // 메타 테마 색상 업데이트
    updateMetaThemeColor(effectiveTheme);

    console.log(`🎨 테마 변경: ${mode} (effective: ${effectiveTheme})`);
  }, [effectiveTheme, cssVars, mode]);

  // 테마 설정 함수
  const setTheme = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    storeTheme(newMode);

    // 분석을 위한 이벤트 발송
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('themeChange', {
        detail: { mode: newMode, effectiveTheme: newMode === 'auto' ? (getSystemPreference() ? 'dark' : 'light') : newMode }
      }));
    }
  }, []);

  // 테마 토글
  const toggleTheme = useCallback(() => {
    const nextMode: ThemeMode = mode === 'light' ? 'dark' : mode === 'dark' ? 'auto' : 'light';
    setTheme(nextMode);
  }, [mode, setTheme]);

  // 유틸리티 함수들
  const isSystemDark = useCallback(() => {
    return getSystemPreference();
  }, []);

  const getStoredThemeMode = useCallback(() => {
    return getStoredTheme();
  }, []);

  return {
    // 현재 상태
    mode,
    isDark: effectiveTheme === 'dark',
    isLight: effectiveTheme === 'light',
    isAuto: mode === 'auto',
    effectiveTheme,
    systemPrefersDark,

    // 테마 변경
    setTheme,
    toggleTheme,

    // 테마 데이터
    colors,
    cssVars,

    // 반응형 통합 (T096)
    isMobileTheme,
    responsiveColors,

    // 유틸리티
    isSystemDark,
    getStoredTheme: getStoredThemeMode,
  };
}

// 메타 테마 색상 업데이트 (모바일 브라우저 UI)
function updateMetaThemeColor(theme: 'light' | 'dark'): void {
  if (typeof document === 'undefined') return;

  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  const msapplicationMeta = document.querySelector('meta[name="msapplication-navbutton-color"]');
  const appleMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');

  const color = theme === 'dark' ? themes.dark.background.primary : themes.light.background.primary;

  // Chrome, Firefox OS, Opera
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', color);
  } else {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = color;
    document.head.appendChild(meta);
  }

  // Windows Phone
  if (msapplicationMeta) {
    msapplicationMeta.setAttribute('content', color);
  } else {
    const meta = document.createElement('meta');
    meta.name = 'msapplication-navbutton-color';
    meta.content = color;
    document.head.appendChild(meta);
  }

  // iOS Safari
  if (appleMeta) {
    appleMeta.setAttribute('content', theme === 'dark' ? 'black-translucent' : 'default');
  } else {
    const meta = document.createElement('meta');
    meta.name = 'apple-mobile-web-app-status-bar-style';
    meta.content = theme === 'dark' ? 'black-translucent' : 'default';
    document.head.appendChild(meta);
  }
}

// 테마별 CSS 클래스 이름 유틸리티
export function themeClasses(lightClass: string, darkClass: string = ''): string {
  return `${lightClass} dark:${darkClass || lightClass}`;
}

// 조건부 클래스명 생성
export function createThemeClass(baseClass: string, darkVariant?: string): string {
  if (!darkVariant) return baseClass;
  return `${baseClass} dark:${darkVariant}`;
}

// 테마 감지 유틸리티
export function detectSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return getSystemPreference() ? 'dark' : 'light';
}

// 테마 변경 이벤트 리스너
export function onThemeChange(callback: (theme: { mode: ThemeMode; effectiveTheme: 'light' | 'dark' }) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleThemeChange = (event: CustomEvent) => {
    callback(event.detail);
  };

  window.addEventListener('themeChange', handleThemeChange as EventListener);

  return () => {
    window.removeEventListener('themeChange', handleThemeChange as EventListener);
  };
}

// 프리로드용 테마 감지
export function getInitialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';

  const stored = getStoredTheme();
  if (stored === 'auto') {
    return getSystemPreference() ? 'dark' : 'light';
  }
  return stored;
}