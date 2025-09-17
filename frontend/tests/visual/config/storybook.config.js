/**
 * Storybook Configuration for Visual Testing
 *
 * VibeMusic 프로젝트의 시각적 테스트를 위한 Storybook 설정
 */

module.exports = {
  stories: [
    '../storybook/**/*.stories.@(js|jsx|ts|tsx)',
    '../../../src/**/*.stories.@(js|jsx|ts|tsx)'
  ],

  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',
    '@storybook/addon-viewport',
    '@storybook/addon-controls',
    '@storybook/addon-actions',
    '@storybook/addon-docs',
    '@storybook/addon-design-tokens',
    '@storybook/addon-measure',
    '@storybook/addon-outline'
  ],

  framework: {
    name: '@storybook/react-vite',
    options: {}
  },

  features: {
    buildStoriesJson: true,
    interactionsDebugger: true
  },

  // TypeScript 설정
  typescript: {
    check: false,
    checkOptions: {},
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      propFilter: (prop) => (prop.parent ? !/node_modules/.test(prop.parent.fileName) : true),
    },
  },

  // Vite 설정
  viteFinal: async (config) => {
    return {
      ...config,
      resolve: {
        ...config.resolve,
        alias: {
          ...config.resolve.alias,
          '@': path.resolve(__dirname, '../../../src'),
          '@shared': path.resolve(__dirname, '../../../shared')
        }
      },
      define: {
        ...config.define,
        global: 'globalThis'
      }
    };
  },

  // 문서화 설정
  docs: {
    autodocs: 'tag',
    defaultName: 'Documentation'
  },

  // 정적 파일 디렉토리
  staticDirs: ['../../../public'],

  // 개발 서버 설정
  core: {
    disableTelemetry: true
  }
};

// 미리보기 설정 (preview.js 내용)
export const parameters = {
  // 액션 로깅
  actions: { argTypesRegex: "^on[A-Z].*" },

  // 컨트롤 설정
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },

  // 접근성 테스트 설정
  a11y: {
    config: {
      rules: [
        {
          id: 'autocomplete-valid',
          enabled: false // 현재 비활성화, 필요시 개별 스토리에서 활성화
        },
        {
          id: 'color-contrast',
          enabled: true
        }
      ]
    },
    options: {
      checks: { 'color-contrast': { options: { noScroll: true } } },
      restoreScroll: true
    }
  },

  // 뷰포트 설정
  viewport: {
    viewports: {
      mobile: {
        name: 'Mobile',
        styles: {
          width: '375px',
          height: '667px'
        }
      },
      tablet: {
        name: 'Tablet',
        styles: {
          width: '768px',
          height: '1024px'
        }
      },
      desktop: {
        name: 'Desktop',
        styles: {
          width: '1200px',
          height: '800px'
        }
      },
      widescreen: {
        name: 'Widescreen',
        styles: {
          width: '1920px',
          height: '1080px'
        }
      }
    }
  },

  // 배경 설정
  backgrounds: {
    default: 'light',
    values: [
      {
        name: 'light',
        value: '#ffffff'
      },
      {
        name: 'dark',
        value: '#1a1a1a'
      },
      {
        name: 'gray',
        value: '#f5f5f5'
      }
    ]
  },

  // 레이아웃 설정
  layout: 'centered',

  // 문서화 설정
  docs: {
    theme: {
      colorPrimary: '#6366f1',
      colorSecondary: '#3b82f6',
      appBg: '#ffffff',
      appContentBg: '#ffffff',
      textColor: '#1f2937',
      barTextColor: '#6b7280',
      barSelectedColor: '#6366f1'
    }
  }
};

// 글로벌 데코레이터
export const decorators = [
  // CSS 스타일 로드
  (Story) => (
    <div className="storybook-wrapper">
      <link rel="stylesheet" href="/src/styles/globals.css" />
      <Story />
    </div>
  ),

  // 테마 제공자
  (Story, context) => {
    const theme = context.globals.theme || 'light';
    return (
      <div className={theme === 'dark' ? 'dark' : ''}>
        <Story />
      </div>
    );
  },

  // 반응형 컨테이너
  (Story, context) => {
    const viewport = context.globals.viewport;
    const isMobile = viewport === 'mobile';

    return (
      <div className={`storybook-container ${isMobile ? 'mobile' : 'desktop'}`}>
        <Story />
      </div>
    );
  }
];

// 글로벌 타입 정의
export const globalTypes = {
  theme: {
    name: 'Theme',
    description: 'Global theme for components',
    defaultValue: 'light',
    toolbar: {
      icon: 'paintbrush',
      items: [
        { value: 'light', title: 'Light' },
        { value: 'dark', title: 'Dark' }
      ],
      showName: true,
      dynamicTitle: true
    }
  },
  locale: {
    name: 'Locale',
    description: 'Internationalization locale',
    defaultValue: 'ko',
    toolbar: {
      icon: 'globe',
      items: [
        { value: 'ko', title: '한국어' },
        { value: 'en', title: 'English' }
      ],
      showName: true
    }
  }
};