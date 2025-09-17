/**
 * VibeMusic Theme System
 *
 * T095: 다크 모드 구현
 * - 라이트/다크 테마 토큰 정의
 * - 시맨틱 색상 시스템
 * - 사용자 선호도 기반 테마 전환
 * - 시스템 다크 모드 감지
 */
import { colors, fonts, fontSizes, fontWeights, spacing, borderRadius, boxShadow } from './tokens';

// 테마 타입 정의
export type ThemeMode = 'light' | 'dark' | 'auto';

// 시맨틱 색상 인터페이스
interface SemanticColors {
  // 배경색
  background: {
    primary: string;      // 메인 배경
    secondary: string;    // 카드, 패널 배경
    tertiary: string;     // 입력 필드, 버튼 배경
    accent: string;       // 강조 배경
    overlay: string;      // 모달 오버레이
  };

  // 텍스트 색상
  text: {
    primary: string;      // 기본 텍스트
    secondary: string;    // 보조 텍스트
    tertiary: string;     // 비활성 텍스트
    accent: string;       // 강조 텍스트
    inverse: string;      // 반전 텍스트 (다크 배경의 밝은 텍스트)
    error: string;        // 오류 텍스트
    success: string;      // 성공 텍스트
    warning: string;      // 경고 텍스트
  };

  // 테두리 색상
  border: {
    primary: string;      // 기본 테두리
    secondary: string;    // 보조 테두리
    accent: string;       // 강조 테두리
    error: string;        // 오류 테두리
    focus: string;        // 포커스 테두리
  };

  // 브랜드 색상 (라이트/다크에서 동일)
  brand: typeof colors.primary;

  // 감정 색상 (라이트/다크에서 동일)
  emotion: typeof colors.emotion;

  // 시각화 색상
  visualization: {
    waveform: {
      active: string;
      inactive: string;
      background: string;
    };
    spectrum: typeof colors.visualization.spectrum;
  };

  // 상태 색상
  state: {
    hover: string;        // 호버 상태
    active: string;       // 활성 상태
    disabled: string;     // 비활성 상태
    loading: string;      // 로딩 상태
  };
}

// 라이트 테마 정의
const lightTheme: SemanticColors = {
  background: {
    primary: colors.neutral[0],        // 순백
    secondary: colors.neutral[50],     // 거의 흰색
    tertiary: colors.neutral[100],     // 매우 연한 회색
    accent: colors.primary[50],        // 연한 브랜드 색상
    overlay: 'rgba(0, 0, 0, 0.5)',     // 반투명 검정
  },

  text: {
    primary: colors.neutral[900],      // 거의 검정
    secondary: colors.neutral[600],    // 진한 회색
    tertiary: colors.neutral[400],     // 중간 회색
    accent: colors.primary[600],       // 브랜드 색상
    inverse: colors.neutral[0],        // 순백
    error: colors.semantic.error,      // 빨강
    success: colors.semantic.success,  // 초록
    warning: colors.semantic.warning,  // 주황
  },

  border: {
    primary: colors.neutral[200],      // 연한 회색
    secondary: colors.neutral[300],    // 옅은 회색
    accent: colors.primary[300],       // 연한 브랜드
    error: colors.semantic.error,      // 빨강
    focus: colors.primary[500],        // 브랜드 메인
  },

  brand: colors.primary,
  emotion: colors.emotion,

  visualization: {
    waveform: {
      active: colors.primary[500],
      inactive: colors.neutral[300],
      background: colors.neutral[50],
    },
    spectrum: colors.visualization.spectrum,
  },

  state: {
    hover: colors.neutral[100],        // 호버 배경
    active: colors.primary[100],       // 활성 배경
    disabled: colors.neutral[300],     // 비활성 색상
    loading: colors.primary[400],      // 로딩 색상
  },
};

// 다크 테마 정의
const darkTheme: SemanticColors = {
  background: {
    primary: colors.neutral[900],      // 거의 검정
    secondary: colors.neutral[800],    // 매우 진한 회색
    tertiary: colors.neutral[700],     // 진한 회색
    accent: colors.primary[900],       // 진한 브랜드
    overlay: 'rgba(0, 0, 0, 0.7)',     // 더 진한 오버레이
  },

  text: {
    primary: colors.neutral[100],      // 매우 연한 회색
    secondary: colors.neutral[300],    // 옅은 회색
    tertiary: colors.neutral[500],     // 중간 회색
    accent: colors.primary[400],       // 밝은 브랜드
    inverse: colors.neutral[900],      // 거의 검정
    error: '#ff6b6b',                  // 밝은 빨강
    success: '#51cf66',                // 밝은 초록
    warning: '#ffd43b',                // 밝은 노랑
  },

  border: {
    primary: colors.neutral[600],      // 진한 회색
    secondary: colors.neutral[500],    // 중간 회색
    accent: colors.primary[600],       // 진한 브랜드
    error: '#ff6b6b',                  // 밝은 빨강
    focus: colors.primary[400],        // 밝은 브랜드
  },

  brand: colors.primary,
  emotion: colors.emotion,

  visualization: {
    waveform: {
      active: colors.primary[400],
      inactive: colors.neutral[600],
      background: colors.neutral[800],
    },
    spectrum: colors.visualization.spectrum,
  },

  state: {
    hover: colors.neutral[700],        // 호버 배경
    active: colors.primary[800],       // 활성 배경
    disabled: colors.neutral[600],     // 비활성 색상
    loading: colors.primary[500],      // 로딩 색상
  },
};

// 테마 객체
export const themes = {
  light: lightTheme,
  dark: darkTheme,
} as const;

// 컴포넌트별 스타일 토큰
interface ComponentTokens {
  button: {
    primary: {
      background: string;
      backgroundHover: string;
      backgroundActive: string;
      backgroundDisabled: string;
      text: string;
      textDisabled: string;
      border: string;
      borderHover: string;
      borderFocus: string;
    };
    secondary: {
      background: string;
      backgroundHover: string;
      backgroundActive: string;
      text: string;
      border: string;
      borderHover: string;
    };
    ghost: {
      background: string;
      backgroundHover: string;
      text: string;
    };
  };

  input: {
    background: string;
    backgroundFocus: string;
    backgroundDisabled: string;
    text: string;
    textDisabled: string;
    placeholder: string;
    border: string;
    borderFocus: string;
    borderError: string;
  };

  card: {
    background: string;
    backgroundHover: string;
    border: string;
    shadow: string;
  };

  modal: {
    background: string;
    overlay: string;
    border: string;
    shadow: string;
  };

  toast: {
    success: {
      background: string;
      text: string;
      border: string;
    };
    error: {
      background: string;
      text: string;
      border: string;
    };
    warning: {
      background: string;
      text: string;
      border: string;
    };
    info: {
      background: string;
      text: string;
      border: string;
    };
  };
}

// 라이트 테마 컴포넌트 토큰
const lightComponentTokens: ComponentTokens = {
  button: {
    primary: {
      background: lightTheme.brand[500],
      backgroundHover: lightTheme.brand[600],
      backgroundActive: lightTheme.brand[700],
      backgroundDisabled: lightTheme.state.disabled,
      text: lightTheme.text.inverse,
      textDisabled: lightTheme.text.tertiary,
      border: lightTheme.brand[500],
      borderHover: lightTheme.brand[600],
      borderFocus: lightTheme.border.focus,
    },
    secondary: {
      background: 'transparent',
      backgroundHover: lightTheme.state.hover,
      backgroundActive: lightTheme.state.active,
      text: lightTheme.text.accent,
      border: lightTheme.border.accent,
      borderHover: lightTheme.brand[400],
    },
    ghost: {
      background: 'transparent',
      backgroundHover: lightTheme.state.hover,
      text: lightTheme.text.accent,
    },
  },

  input: {
    background: lightTheme.background.primary,
    backgroundFocus: lightTheme.background.primary,
    backgroundDisabled: lightTheme.background.tertiary,
    text: lightTheme.text.primary,
    textDisabled: lightTheme.text.tertiary,
    placeholder: lightTheme.text.tertiary,
    border: lightTheme.border.primary,
    borderFocus: lightTheme.border.focus,
    borderError: lightTheme.border.error,
  },

  card: {
    background: lightTheme.background.secondary,
    backgroundHover: lightTheme.background.tertiary,
    border: lightTheme.border.primary,
    shadow: boxShadow.sm,
  },

  modal: {
    background: lightTheme.background.primary,
    overlay: lightTheme.background.overlay,
    border: lightTheme.border.primary,
    shadow: boxShadow.xl,
  },

  toast: {
    success: {
      background: '#f0f9ff',
      text: '#166534',
      border: '#22c55e',
    },
    error: {
      background: '#fef2f2',
      text: '#dc2626',
      border: '#ef4444',
    },
    warning: {
      background: '#fffbeb',
      text: '#d97706',
      border: '#f59e0b',
    },
    info: {
      background: '#eff6ff',
      text: '#2563eb',
      border: '#3b82f6',
    },
  },
};

// 다크 테마 컴포넌트 토큰
const darkComponentTokens: ComponentTokens = {
  button: {
    primary: {
      background: darkTheme.brand[600],
      backgroundHover: darkTheme.brand[500],
      backgroundActive: darkTheme.brand[700],
      backgroundDisabled: darkTheme.state.disabled,
      text: darkTheme.text.inverse,
      textDisabled: darkTheme.text.tertiary,
      border: darkTheme.brand[600],
      borderHover: darkTheme.brand[500],
      borderFocus: darkTheme.border.focus,
    },
    secondary: {
      background: 'transparent',
      backgroundHover: darkTheme.state.hover,
      backgroundActive: darkTheme.state.active,
      text: darkTheme.text.accent,
      border: darkTheme.border.accent,
      borderHover: darkTheme.brand[400],
    },
    ghost: {
      background: 'transparent',
      backgroundHover: darkTheme.state.hover,
      text: darkTheme.text.accent,
    },
  },

  input: {
    background: darkTheme.background.tertiary,
    backgroundFocus: darkTheme.background.secondary,
    backgroundDisabled: darkTheme.state.disabled,
    text: darkTheme.text.primary,
    textDisabled: darkTheme.text.tertiary,
    placeholder: darkTheme.text.tertiary,
    border: darkTheme.border.primary,
    borderFocus: darkTheme.border.focus,
    borderError: darkTheme.border.error,
  },

  card: {
    background: darkTheme.background.secondary,
    backgroundHover: darkTheme.background.tertiary,
    border: darkTheme.border.primary,
    shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
  },

  modal: {
    background: darkTheme.background.primary,
    overlay: darkTheme.background.overlay,
    border: darkTheme.border.primary,
    shadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)',
  },

  toast: {
    success: {
      background: '#064e3b',
      text: '#6ee7b7',
      border: '#10b981',
    },
    error: {
      background: '#7f1d1d',
      text: '#fca5a5',
      border: '#ef4444',
    },
    warning: {
      background: '#78350f',
      text: '#fcd34d',
      border: '#f59e0b',
    },
    info: {
      background: '#1e3a8a',
      text: '#93c5fd',
      border: '#3b82f6',
    },
  },
};

// 테마별 컴포넌트 토큰
export const componentTokens = {
  light: lightComponentTokens,
  dark: darkComponentTokens,
} as const;

// CSS 커스텀 프로퍼티 생성
export function generateCSSVariables(theme: SemanticColors, components: ComponentTokens): Record<string, string> {
  return {
    // 배경색 변수
    '--color-bg-primary': theme.background.primary,
    '--color-bg-secondary': theme.background.secondary,
    '--color-bg-tertiary': theme.background.tertiary,
    '--color-bg-accent': theme.background.accent,
    '--color-bg-overlay': theme.background.overlay,

    // 텍스트 색상 변수
    '--color-text-primary': theme.text.primary,
    '--color-text-secondary': theme.text.secondary,
    '--color-text-tertiary': theme.text.tertiary,
    '--color-text-accent': theme.text.accent,
    '--color-text-inverse': theme.text.inverse,
    '--color-text-error': theme.text.error,
    '--color-text-success': theme.text.success,
    '--color-text-warning': theme.text.warning,

    // 테두리 색상 변수
    '--color-border-primary': theme.border.primary,
    '--color-border-secondary': theme.border.secondary,
    '--color-border-accent': theme.border.accent,
    '--color-border-error': theme.border.error,
    '--color-border-focus': theme.border.focus,

    // 상태 색상 변수
    '--color-state-hover': theme.state.hover,
    '--color-state-active': theme.state.active,
    '--color-state-disabled': theme.state.disabled,
    '--color-state-loading': theme.state.loading,

    // 시각화 색상 변수
    '--color-viz-waveform-active': theme.visualization.waveform.active,
    '--color-viz-waveform-inactive': theme.visualization.waveform.inactive,
    '--color-viz-waveform-bg': theme.visualization.waveform.background,

    // 버튼 컴포넌트 변수
    '--btn-primary-bg': components.button.primary.background,
    '--btn-primary-bg-hover': components.button.primary.backgroundHover,
    '--btn-primary-bg-active': components.button.primary.backgroundActive,
    '--btn-primary-bg-disabled': components.button.primary.backgroundDisabled,
    '--btn-primary-text': components.button.primary.text,
    '--btn-primary-text-disabled': components.button.primary.textDisabled,
    '--btn-primary-border': components.button.primary.border,
    '--btn-primary-border-hover': components.button.primary.borderHover,
    '--btn-primary-border-focus': components.button.primary.borderFocus,

    // 입력 컴포넌트 변수
    '--input-bg': components.input.background,
    '--input-bg-focus': components.input.backgroundFocus,
    '--input-bg-disabled': components.input.backgroundDisabled,
    '--input-text': components.input.text,
    '--input-text-disabled': components.input.textDisabled,
    '--input-placeholder': components.input.placeholder,
    '--input-border': components.input.border,
    '--input-border-focus': components.input.borderFocus,
    '--input-border-error': components.input.borderError,

    // 카드 컴포넌트 변수
    '--card-bg': components.card.background,
    '--card-bg-hover': components.card.backgroundHover,
    '--card-border': components.card.border,
    '--card-shadow': components.card.shadow,

    // 모달 컴포넌트 변수
    '--modal-bg': components.modal.background,
    '--modal-overlay': components.modal.overlay,
    '--modal-border': components.modal.border,
    '--modal-shadow': components.modal.shadow,
  };
}

// 테마별 CSS 변수 생성
export const cssVariables = {
  light: generateCSSVariables(themes.light, componentTokens.light),
  dark: generateCSSVariables(themes.dark, componentTokens.dark),
} as const;

// 테마 전환 애니메이션을 위한 CSS
export const themeTransitionCSS = `
  * {
    transition:
      background-color 0.2s ease,
      border-color 0.2s ease,
      color 0.2s ease,
      fill 0.2s ease,
      stroke 0.2s ease,
      box-shadow 0.2s ease;
  }

  /* 애니메이션 제외 요소 */
  .no-theme-transition,
  .no-theme-transition * {
    transition: none !important;
  }
`;

// 다크 모드 미디어 쿼리
export const darkModeMediaQuery = '@media (prefers-color-scheme: dark)';

// 테마 타입 내보내기
export type Theme = SemanticColors;
export type ComponentTokens = ComponentTokens;

export default {
  themes,
  componentTokens,
  cssVariables,
  generateCSSVariables,
  themeTransitionCSS,
  darkModeMediaQuery,
};