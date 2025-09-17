/**
 * Playwright Configuration for Visual Testing
 *
 * VibeMusic 프로젝트의 시각적 회귀 테스트를 위한 Playwright 설정
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // 테스트 디렉토리
  testDir: '../regression',

  // 병렬 실행 설정
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // 리포터 설정
  reporter: [
    ['html', { outputFolder: '../reports/playwright-report' }],
    ['json', { outputFile: '../reports/test-results.json' }],
    ['junit', { outputFile: '../reports/junit.xml' }]
  ],

  // 전역 설정
  use: {
    // 기본 URL (Storybook)
    baseURL: 'http://localhost:6006',

    // 스크린샷 설정
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',

    // 브라우저 설정
    actionTimeout: 10000,
    navigationTimeout: 30000,

    // 시각적 테스트 설정
    ignoreHTTPSErrors: true,
    colorScheme: 'light'
  },

  // 프로젝트별 설정
  projects: [
    // Desktop 브라우저
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1200, height: 800 }
      }
    },
    {
      name: 'firefox-desktop',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1200, height: 800 }
      }
    },
    {
      name: 'webkit-desktop',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1200, height: 800 }
      }
    },

    // 모바일 디바이스
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5']
      }
    },
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 12']
      }
    },

    // 태블릿
    {
      name: 'tablet-chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 1024 }
      }
    },

    // 다크 모드 테스트
    {
      name: 'dark-mode',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'dark',
        viewport: { width: 1200, height: 800 }
      }
    },

    // 고해상도 테스트
    {
      name: 'high-dpi',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 2
      }
    },

    // 접근성 테스트 (보조 기술 시뮬레이션)
    {
      name: 'accessibility',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1200, height: 800 },
        extraHTTPHeaders: {
          'prefers-reduced-motion': 'reduce'
        }
      }
    }
  ],

  // 시각적 비교 설정
  expect: {
    // 스크린샷 비교 허용 오차
    toHaveScreenshot: {
      threshold: 0.2,
      maxDiffPixels: 100,
      animation: 'disabled',
      caret: 'hide'
    },

    // 일반 비교 설정
    timeout: 10000
  },

  // 웹 서버 설정 (Storybook)
  webServer: {
    command: 'npm run storybook',
    url: 'http://localhost:6006',
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  },

  // 테스트 결과 디렉토리
  outputDir: '../reports/test-results',

  // 스크린샷 저장 경로
  snapshotDir: '../screenshots',

  // 테스트 매치 패턴
  testMatch: '**/*.visual.test.ts',

  // 글로벌 설정
  globalSetup: require.resolve('./global-setup.ts'),
  globalTeardown: require.resolve('./global-teardown.ts')
});