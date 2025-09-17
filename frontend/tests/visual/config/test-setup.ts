/**
 * Visual Testing Setup
 *
 * 시각적 테스트를 위한 전역 설정 및 헬퍼 함수들
 */

import { test as base, expect } from '@playwright/test';

// 커스텀 테스트 픽스처 타입
type VisualTestFixtures = {
  storybookPage: any;
  visualTestUtils: any;
};

// Storybook 페이지 픽스처
export const test = base.extend<VisualTestFixtures>({
  // Storybook 페이지 설정
  storybookPage: async ({ page }, use) => {
    // Storybook 특화 설정
    await page.addInitScript(() => {
      // 콘솔 에러 무시 (Storybook 내부 에러)
      window.console.error = () => {};

      // 애니메이션 비활성화
      window.matchMedia = (query) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => {},
      });
    });

    // 기본 CSS 추가 (일관된 렌더링을 위해)
    await page.addStyleTag({
      content: `
        /* 시각적 테스트를 위한 기본 스타일 */
        * {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        /* 애니메이션 제어 */
        *,
        *::before,
        *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }

        /* 포커스 outline 표준화 */
        *:focus {
          outline: 2px solid #4A90E2;
          outline-offset: 2px;
        }

        /* 시간 관련 요소 숨기기 */
        .timestamp,
        .current-time,
        .session-timer,
        .time-display {
          visibility: hidden !important;
        }

        /* 랜덤 요소 고정 */
        .random-element {
          opacity: 0.5 !important;
        }
      `
    });

    await use(page);
  },

  // 시각적 테스트 유틸리티
  visualTestUtils: async ({ page }, use) => {
    const utils = {
      // Storybook 스토리로 이동
      async navigateToStory(storyPath: string) {
        const url = `http://localhost:6006/iframe.html?path=/story/${storyPath}`;
        await page.goto(url);
        await page.waitForLoadState('networkidle');

        // Storybook 로딩 대기
        await page.waitForSelector('#root, [data-testid="story-root"], .sb-show-main', {
          timeout: 10000
        });

        // 추가 안정화 시간
        await page.waitForTimeout(500);
      },

      // 요소가 안정화될 때까지 대기
      async waitForStable(selector?: string) {
        if (selector) {
          await page.waitForSelector(selector);
        }

        // 모든 이미지 로딩 대기
        await page.waitForFunction(() => {
          const images = Array.from(document.images);
          return images.every(img => img.complete);
        });

        // 애니메이션 완료 대기
        await page.waitForTimeout(1000);
      },

      // 변동 요소 숨기기
      async hideVariableElements() {
        await page.addStyleTag({
          content: `
            .timestamp, .current-time, .session-timer,
            .random-element, .dynamic-content {
              visibility: hidden !important;
            }

            /* 현재 시간 고정 */
            [data-testid="current-time"]::after {
              content: "10:30:45" !important;
            }

            /* 세션 ID 고정 */
            [data-testid="session-id"]::after {
              content: "session-12345678" !important;
            }
          `
        });
      },

      // 사용자 상호작용 시뮬레이션
      async simulateTyping(selector: string, text: string, options = { delay: 50 }) {
        const element = page.locator(selector);
        await element.clear();
        await element.type(text, options);
        await page.waitForTimeout(500); // 입력 후 안정화
      },

      // 호버 상태 시뮬레이션
      async simulateHover(selector: string) {
        await page.locator(selector).hover();
        await page.waitForTimeout(300); // 호버 효과 안정화
      },

      // 포커스 상태 시뮬레이션
      async simulateFocus(selector: string) {
        await page.locator(selector).focus();
        await page.waitForTimeout(200); // 포커스 효과 안정화
      },

      // 에러 상태 주입
      async injectErrorState(errorMessage: string) {
        await page.evaluate((message) => {
          const errorDiv = document.createElement('div');
          errorDiv.className = 'test-error-state';
          errorDiv.style.cssText = `
            background: #fee2e2;
            border: 1px solid #fca5a5;
            color: #dc2626;
            padding: 12px;
            margin: 16px;
            border-radius: 8px;
            position: relative;
          `;
          errorDiv.textContent = `⚠️ ${message}`;
          document.body.insertBefore(errorDiv, document.body.firstChild);
        }, errorMessage);
      },

      // 로딩 상태 주입
      async injectLoadingState(selector?: string) {
        if (selector) {
          await page.evaluate((sel) => {
            const element = document.querySelector(sel);
            if (element) {
              element.classList.add('loading-state');
              const spinner = document.createElement('div');
              spinner.className = 'test-loading-spinner';
              spinner.style.cssText = `
                display: inline-block;
                width: 20px;
                height: 20px;
                border: 2px solid #e5e7eb;
                border-radius: 50%;
                border-top-color: #3b82f6;
                animation: spin 1s linear infinite;
              `;
              element.appendChild(spinner);
            }
          }, selector);
        }
      },

      // 감정 데이터 주입
      async injectEmotionData(emotionVector: Record<string, number>) {
        await page.evaluate((emotions) => {
          // 감정 바 업데이트
          const bars = document.querySelectorAll('.emotion-bar .h-full, .emotion-bar [style*="width"]');
          const values = Object.values(emotions);

          bars.forEach((bar, index) => {
            if (bar instanceof HTMLElement && values[index] !== undefined) {
              bar.style.width = `${Math.max(0, values[index] * 100)}%`;
            }
          });

          // 숫자 표시 업데이트
          const valueElements = document.querySelectorAll('.emotion-value, [data-testid*="emotion-value"]');
          valueElements.forEach((element, index) => {
            if (values[index] !== undefined) {
              element.textContent = `${Math.round(values[index] * 100)}${element.textContent?.includes('%') ? '%' : ''}`;
            }
          });
        }, emotionVector);

        await page.waitForTimeout(500); // 변경사항 안정화
      },

      // 반응형 테스트 헬퍼
      async setViewport(device: 'mobile' | 'tablet' | 'desktop' | 'widescreen') {
        const viewports = {
          mobile: { width: 375, height: 667 },
          tablet: { width: 768, height: 1024 },
          desktop: { width: 1200, height: 800 },
          widescreen: { width: 1920, height: 1080 }
        };

        await page.setViewportSize(viewports[device]);
        await page.waitForTimeout(500); // 리사이즈 안정화
      },

      // 테마 변경
      async setTheme(theme: 'light' | 'dark') {
        await page.evaluate((themeName) => {
          document.documentElement.classList.toggle('dark', themeName === 'dark');
          document.body.setAttribute('data-theme', themeName);
        }, theme);

        await page.waitForTimeout(300); // 테마 전환 안정화
      },

      // 접근성 테스트 헬퍼
      async enableHighContrast() {
        await page.addStyleTag({
          content: `
            * {
              filter: contrast(1.5) brightness(1.2) !important;
            }
          `
        });
      },

      async enableReducedMotion() {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.addStyleTag({
          content: `
            @media (prefers-reduced-motion: reduce) {
              *, *::before, *::after {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
              }
            }
          `
        });
      },

      // 성능 모니터링
      async measurePerformance() {
        return await page.evaluate(() => {
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          return {
            loadTime: navigation.loadEventEnd - navigation.loadEventStart,
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
            firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
            firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
          };
        });
      }
    };

    await use(utils);
  }
});

// 커스텀 expect 매처
expect.extend({
  // 스크린샷 비교 (확장된 옵션)
  async toMatchVisualSnapshot(page: any, name: string, options: any = {}) {
    const defaultOptions = {
      threshold: 0.2,
      maxDiffPixels: 100,
      animation: 'disabled' as const,
      caret: 'hide' as const,
      ...options
    };

    return expect(page).toHaveScreenshot(name, defaultOptions);
  },

  // 접근성 체크
  async toBeAccessible(page: any) {
    const violations = await page.evaluate(() => {
      // 간단한 접근성 체크
      const checks = [];

      // alt 속성 체크
      const images = document.querySelectorAll('img:not([alt])');
      if (images.length > 0) {
        checks.push(`${images.length} images missing alt attributes`);
      }

      // 버튼 라벨 체크
      const buttons = document.querySelectorAll('button:not([aria-label]):not([title])');
      const unlabeledButtons = Array.from(buttons).filter(btn => !btn.textContent?.trim());
      if (unlabeledButtons.length > 0) {
        checks.push(`${unlabeledButtons.length} buttons missing labels`);
      }

      return checks;
    });

    const pass = violations.length === 0;
    return {
      pass,
      message: () => pass
        ? 'Page passes basic accessibility checks'
        : `Accessibility violations found: ${violations.join(', ')}`
    };
  }
});

export { expect };

// 테스트 데이터 팩토리
export const testData = {
  // 감정 프로필 생성
  createEmotionProfile: (overrides = {}) => ({
    dominant_emotion: 'neutral',
    emotion_vector: {
      energy: 0.5,
      valence: 0.0,
      tension: 0.3,
      focus: 0.7
    },
    confidence_score: 0.8,
    tempo_score: 0.6,
    rhythm_consistency: 0.75,
    ...overrides
  }),

  // 세션 데이터 생성
  createSession: (overrides = {}) => ({
    id: 'session-test-123',
    start_time: '2024-01-15T10:00:00Z',
    auto_delete_at: '2024-01-15T11:00:00Z',
    is_active: true,
    ...overrides
  }),

  // 음악 데이터 생성
  createMusic: (overrides = {}) => ({
    id: 'music-test-456',
    format: 'wav',
    duration: 180,
    quality_score: 0.9,
    file_url: 'https://example.com/test-music.wav',
    ...overrides
  }),

  // 타이핑 통계 생성
  createTypingStats: (overrides = {}) => ({
    average_wpm: 60,
    keystroke_intervals: [150, 180, 120, 200],
    pause_patterns: [500, 1000, 300],
    rhythm_score: 0.8,
    focus_level: 0.7,
    session_duration: 120,
    ...overrides
  })
};

// 테스트 태그 및 그룹화
export const testTags = {
  component: 'component',
  integration: 'integration',
  responsive: 'responsive',
  accessibility: 'a11y',
  performance: 'performance',
  crossBrowser: 'cross-browser',
  darkMode: 'dark-mode',
  mobile: 'mobile',
  visual: 'visual-regression'
};