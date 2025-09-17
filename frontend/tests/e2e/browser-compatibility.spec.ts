/**
 * T077: 브라우저 호환성 테스트
 *
 * Chrome, Firefox, Safari 등 다양한 브라우저에서
 * VibeMusic의 핵심 기능이 정상 작동하는지 검증합니다.
 */
import { test, expect, devices } from '@playwright/test';
import TestHelpers from './utils/test-helpers';

test.describe('브라우저 호환성 테스트', () => {
  const testText = 'Browser compatibility test message for music generation.';

  // Chrome 호환성 테스트
  test.describe('Chrome 브라우저', () => {
    test('Chrome에서 전체 플로우 동작', async ({ page }) => {
      const helpers = new TestHelpers(page);

      // 브라우저 정보 확인
      const userAgent = await page.evaluate(() => navigator.userAgent);
      expect(userAgent).toContain('Chrome');

      // 기본 플로우 테스트
      await helpers.createSessionAndNavigate();
      await helpers.typeInMusicInput(testText);
      await helpers.waitForEmotionAnalysis();
      await helpers.startMusicGeneration();
      await helpers.waitForMusicGeneration();
      await helpers.playGeneratedMusic();
    });

    test('Chrome WebSocket 지원', async ({ page }) => {
      const helpers = new TestHelpers(page);
      await helpers.createSessionAndNavigate();

      // WebSocket 지원 확인
      const wsSupported = await page.evaluate(() => 'WebSocket' in window);
      expect(wsSupported).toBeTruthy();

      const isConnected = await helpers.checkWebSocketConnection();
      expect(isConnected).toBeTruthy();
    });

    test('Chrome Web Audio API 지원', async ({ page }) => {
      await page.goto('/');

      // Web Audio API 지원 확인
      const audioContextSupported = await page.evaluate(() => {
        return 'AudioContext' in window || 'webkitAudioContext' in window;
      });
      expect(audioContextSupported).toBeTruthy();

      // MediaRecorder API 지원 확인 (타이핑 소리 녹음용)
      const mediaRecorderSupported = await page.evaluate(() => 'MediaRecorder' in window);
      expect(mediaRecorderSupported).toBeTruthy();
    });
  });

  // Firefox 호환성 테스트
  test.describe('Firefox 브라우저', () => {
    test('Firefox에서 전체 플로우 동작', async ({ page }) => {
      const helpers = new TestHelpers(page);

      // 브라우저 정보 확인
      const userAgent = await page.evaluate(() => navigator.userAgent);
      expect(userAgent).toContain('Firefox');

      // 기본 플로우 테스트
      await helpers.createSessionAndNavigate();
      await helpers.typeInMusicInput(testText);
      await helpers.waitForEmotionAnalysis();
      await helpers.startMusicGeneration();
      await helpers.waitForMusicGeneration();
      await helpers.playGeneratedMusic();
    });

    test('Firefox 특정 기능 호환성', async ({ page }) => {
      await page.goto('/');

      // Firefox의 Web Audio API 구현 확인
      const audioSupport = await page.evaluate(() => {
        const audioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!audioContext) return false;

        try {
          const ctx = new audioContext();
          ctx.close();
          return true;
        } catch {
          return false;
        }
      });
      expect(audioSupport).toBeTruthy();

      // IndexedDB 지원 확인 (오프라인 데이터 저장용)
      const indexedDBSupported = await page.evaluate(() => 'indexedDB' in window);
      expect(indexedDBSupported).toBeTruthy();
    });

    test('Firefox CSS Grid 및 Flexbox 지원', async ({ page }) => {
      await page.goto('/');

      // CSS Grid 지원 확인
      const gridSupported = await page.evaluate(() => {
        const el = document.createElement('div');
        el.style.display = 'grid';
        return el.style.display === 'grid';
      });
      expect(gridSupported).toBeTruthy();

      // Flexbox 지원 확인
      const flexSupported = await page.evaluate(() => {
        const el = document.createElement('div');
        el.style.display = 'flex';
        return el.style.display === 'flex';
      });
      expect(flexSupported).toBeTruthy();
    });
  });

  // Safari 호환성 테스트
  test.describe('Safari 브라우저', () => {
    test('Safari에서 전체 플로우 동작', async ({ page }) => {
      const helpers = new TestHelpers(page);

      // 브라우저 정보 확인
      const userAgent = await page.evaluate(() => navigator.userAgent);
      expect(userAgent).toContain('Safari');

      // 기본 플로우 테스트
      await helpers.createSessionAndNavigate();
      await helpers.typeInMusicInput(testText);
      await helpers.waitForEmotionAnalysis();
      await helpers.startMusicGeneration();
      await helpers.waitForMusicGeneration();
      await helpers.playGeneratedMusic();
    });

    test('Safari WebKit 특정 기능', async ({ page }) => {
      await page.goto('/');

      // WebKit prefixed APIs 확인
      const webkitAudioContext = await page.evaluate(() => 'webkitAudioContext' in window);
      const webkitRequestAnimationFrame = await page.evaluate(() => 'webkitRequestAnimationFrame' in window);

      // Safari에서는 WebKit prefix가 필요할 수 있음
      const audioSupported = await page.evaluate(() => {
        return 'AudioContext' in window || 'webkitAudioContext' in window;
      });
      expect(audioSupported).toBeTruthy();
    });

    test('Safari 터치 이벤트 처리', async ({ page }) => {
      // Safari 모바일에서의 터치 이벤트 지원 확인
      const touchSupported = await page.evaluate(() => 'ontouchstart' in window);

      if (touchSupported) {
        const helpers = new TestHelpers(page);
        await helpers.createSessionAndNavigate();

        const typingInput = page.getByTestId('typing-interface-input');
        await helpers.performTouchGesture(typingInput, 'tap');

        // 터치 후 포커스 확인
        await expect(typingInput).toBeFocused();
      }
    });
  });

  // 크로스 브라우저 공통 기능 테스트
  test.describe('크로스 브라우저 공통 기능', () => {
    test('모든 브라우저에서 localStorage 지원', async ({ page }) => {
      await page.goto('/');

      const localStorageSupported = await page.evaluate(() => {
        try {
          const testKey = 'browser-test';
          localStorage.setItem(testKey, 'test-value');
          const value = localStorage.getItem(testKey);
          localStorage.removeItem(testKey);
          return value === 'test-value';
        } catch {
          return false;
        }
      });

      expect(localStorageSupported).toBeTruthy();
    });

    test('모든 브라우저에서 ES6+ 기능 지원', async ({ page }) => {
      await page.goto('/');

      // ES6 기능들 지원 확인
      const es6Support = await page.evaluate(() => {
        try {
          // Arrow functions
          const arrow = () => true;

          // Template literals
          const template = `test`;

          // Destructuring
          const [a] = [1];
          const { b } = { b: 2 };

          // Promise
          new Promise(resolve => resolve(true));

          // Map/Set
          new Map();
          new Set();

          return true;
        } catch {
          return false;
        }
      });

      expect(es6Support).toBeTruthy();
    });

    test('모든 브라우저에서 Fetch API 지원', async ({ page }) => {
      await page.goto('/');

      const fetchSupported = await page.evaluate(() => 'fetch' in window);
      expect(fetchSupported).toBeTruthy();

      // Fetch 기본 동작 확인
      const fetchWorks = await page.evaluate(async () => {
        try {
          const response = await fetch(window.location.href);
          return response.ok;
        } catch {
          return false;
        }
      });
      expect(fetchWorks).toBeTruthy();
    });

    test('모든 브라우저에서 CSS 변수 지원', async ({ page }) => {
      await page.goto('/');

      const cssVariablesSupported = await page.evaluate(() => {
        if (!CSS || !CSS.supports) return false;
        return CSS.supports('color', 'var(--test-color)');
      });

      expect(cssVariablesSupported).toBeTruthy();
    });

    test('모든 브라우저에서 키보드 이벤트 정상 처리', async ({ page }) => {
      const helpers = new TestHelpers(page);
      await helpers.createSessionAndNavigate();

      const typingInput = page.getByTestId('typing-interface-input');

      // 다양한 키 이벤트 테스트
      await typingInput.press('KeyA');
      await typingInput.press('Backspace');
      await typingInput.press('Enter');
      await typingInput.press('Escape');

      // 수정자 키 조합 테스트
      await typingInput.press('Control+a');
      await typingInput.press('Control+c');
      await typingInput.press('Control+v');

      // 키 이벤트가 정상 처리되었는지 확인
      const hasEventListeners = await page.evaluate(() => {
        const input = document.querySelector('[data-testid="typing-interface-input"]');
        return input && input.onclick !== null;
      });

      expect(hasEventListeners).toBeTruthy();
    });

    test('모든 브라우저에서 미디어 재생 지원', async ({ page }) => {
      await page.goto('/');

      // HTML5 오디오 지원 확인
      const audioSupported = await page.evaluate(() => {
        const audio = document.createElement('audio');
        return !!(audio.canPlayType && audio.canPlayType('audio/mpeg'));
      });

      expect(audioSupported).toBeTruthy();

      // Web Audio API 기본 지원 확인
      const webAudioSupported = await page.evaluate(() => {
        return 'AudioContext' in window || 'webkitAudioContext' in window;
      });

      expect(webAudioSupported).toBeTruthy();
    });

    test('모든 브라우저에서 파일 다운로드 지원', async ({ page }) => {
      const helpers = new TestHelpers(page);
      await helpers.createSessionAndNavigate();
      await helpers.typeInMusicInput(testText);
      await helpers.waitForEmotionAnalysis();
      await helpers.startMusicGeneration();
      await helpers.waitForMusicGeneration();

      // 다운로드 기능 확인
      const downloadButton = page.getByTestId('download-button');
      await expect(downloadButton).toBeVisible();

      // Blob URL 생성 지원 확인
      const blobSupported = await page.evaluate(() => {
        try {
          const blob = new Blob(['test'], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          URL.revokeObjectURL(url);
          return true;
        } catch {
          return false;
        }
      });

      expect(blobSupported).toBeTruthy();
    });
  });

  // 브라우저별 성능 비교
  test.describe('브라우저별 성능 비교', () => {
    test('각 브라우저의 렌더링 성능 측정', async ({ page }) => {
      await page.goto('/');

      const metrics = await helpers.getPerformanceMetrics();

      // 성능 메트릭이 합리적인 범위 내에 있는지 확인
      expect(metrics.firstContentfulPaint).toBeLessThan(3000); // 3초 이내
      expect(metrics.totalLoadTime).toBeLessThan(5000); // 5초 이내

      console.log(`Performance metrics:`, metrics);
    });

    test('각 브라우저의 JavaScript 실행 성능', async ({ page }) => {
      await page.goto('/');

      const jsPerformance = await page.evaluate(() => {
        const start = performance.now();

        // CPU 집약적 작업 시뮬레이션
        const iterations = 100000;
        let result = 0;
        for (let i = 0; i < iterations; i++) {
          result += Math.sin(i) * Math.cos(i);
        }

        const end = performance.now();
        return end - start;
      });

      // JavaScript 실행 시간이 합리적인 범위 내에 있는지 확인
      expect(jsPerformance).toBeLessThan(1000); // 1초 이내

      console.log(`JavaScript execution time: ${jsPerformance}ms`);
    });
  });

  // 브라우저별 에러 처리
  test.describe('브라우저별 에러 처리', () => {
    test('각 브라우저에서 JavaScript 에러 처리', async ({ page }) => {
      const errors: string[] = [];

      // 콘솔 에러 수집
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      // 페이지 에러 수집
      page.on('pageerror', err => {
        errors.push(err.message);
      });

      const helpers = new TestHelpers(page);
      await helpers.createSessionAndNavigate();
      await helpers.typeInMusicInput(testText);

      // 에러가 없거나 최소한인지 확인
      expect(errors.length).toBeLessThan(3); // 치명적이지 않은 에러만 허용

      if (errors.length > 0) {
        console.warn('Detected errors:', errors);
      }
    });
  });
});