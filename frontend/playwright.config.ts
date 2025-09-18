import { defineConfig, devices } from '@playwright/test';

/**
 * VibeMusic E2E 테스트 설정
 *
 * 다양한 브라우저와 디바이스에서 음악 생성 플로우를 테스트하며,
 * 성능, 접근성, 반응형 디자인을 검증합니다.
 */
export default defineConfig({
  // 테스트 파일 경로
  testDir: './tests/e2e',

  // 테스트 파일 매칭 패턴
  testMatch: '**/*.spec.ts',

  // 병렬 실행 설정
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,

  // 실패 시 재시도
  retries: process.env.CI ? 2 : 0,

  // 리포터 설정
  reporter: [
    ['html', { outputFolder: 'test-results/html-report' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list']
  ],

  // 전역 설정
  use: {
    // 기본 URL
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    // 브라우저 컨텍스트 설정
    contextOptions: {
      // 권한 설정
      permissions: ['microphone'],

      // 지역 설정
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
    },

    // 스크린샷 설정
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',

    // 네트워크 설정
    extraHTTPHeaders: {
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8'
    },

    // 타임아웃 설정
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  // 테스트 프로젝트 설정
  projects: [
    // Setup project - 테스트 전 환경 준비
    {
      name: 'setup',
      testMatch: '**/setup.spec.ts',
      teardown: 'cleanup',
    },

    // Cleanup project - 테스트 후 정리
    {
      name: 'cleanup',
      testMatch: '**/cleanup.spec.ts',
    },

    // 데스크톱 브라우저
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 }
      },
      dependencies: ['setup'],
    },

    {
      name: 'firefox-desktop',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 }
      },
      dependencies: ['setup'],
    },

    {
      name: 'webkit-desktop',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 }
      },
      dependencies: ['setup'],
    },

    // 태블릿
    {
      name: 'tablet',
      use: {
        ...devices['iPad Pro'],
      },
      dependencies: ['setup'],
    },

    // 모바일
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
      },
      dependencies: ['setup'],
    },

    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 13'],
      },
      dependencies: ['setup'],
    },

    // 성능 테스트 전용 프로젝트
    {
      name: 'performance',
      testMatch: '**/performance.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        // 성능 측정을 위한 특별 설정
        viewport: { width: 1920, height: 1080 },
        launchOptions: {
          args: [
            '--enable-precise-memory-info',
            '--enable-automation',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
          ]
        }
      },
      dependencies: ['setup'],
    },

    // 접근성 테스트 전용 프로젝트
    {
      name: 'accessibility',
      testMatch: '**/accessibility.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        // 접근성 테스트를 위한 설정
        viewport: { width: 1920, height: 1080 },
        contextOptions: {
          reducedMotion: 'reduce', // 애니메이션 최소화
          forcedColors: 'none',    // 고대비 모드 테스트
        }
      },
      dependencies: ['setup'],
    },
  ],

  // 웹 서버 설정 (로컬 개발 시)
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120000, // 2분
  },

  // 글로벌 설정
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',

  // 출력 디렉토리
  outputDir: 'test-results/',

  // 타임아웃 설정
  timeout: 60000, // 1분
  expect: {
    timeout: 10000, // expect 타임아웃
  },

  // 메타데이터
  metadata: {
    'test-type': 'e2e',
    'app-name': 'VibeMusic',
    'app-version': '1.0.0',
  },
});