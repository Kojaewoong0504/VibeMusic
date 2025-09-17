/**
 * E2E 테스트 헬퍼 함수들
 *
 * 공통으로 사용되는 테스트 유틸리티 함수들을 제공합니다.
 */
import { Page, Locator, expect } from '@playwright/test';

export class TestHelpers {
  constructor(private page: Page) {}

  /**
   * 세션 생성 및 메인 페이지 진입
   */
  async createSessionAndNavigate(): Promise<string> {
    await this.page.goto('/');

    // 메인 페이지에서 "시작하기" 버튼 클릭
    const startButton = this.page.getByRole('button', { name: /시작하기|시작|start/i });
    await expect(startButton).toBeVisible();
    await startButton.click();

    // 세션 생성 대기
    await this.page.waitForURL(/\/session\/.*/, { timeout: 10000 });

    // 세션 ID 추출
    const url = this.page.url();
    const sessionId = url.split('/session/')[1]?.split('/')[0];

    if (!sessionId) {
      throw new Error('세션 ID를 찾을 수 없습니다');
    }

    return sessionId;
  }

  /**
   * 타이핑 인터페이스에 텍스트 입력
   */
  async typeInMusicInput(text: string, options: { delay?: number } = {}): Promise<void> {
    const typingInput = this.page.getByTestId('typing-interface-input');
    await expect(typingInput).toBeVisible();

    // 기존 텍스트 클리어
    await typingInput.clear();

    // 텍스트 입력 (지연 시간을 두어 실제 타이핑 시뮬레이션)
    await typingInput.type(text, { delay: options.delay || 50 });
  }

  /**
   * 감정 분석 완료 대기
   */
  async waitForEmotionAnalysis(): Promise<void> {
    // 감정 시각화 컴포넌트가 표시될 때까지 대기
    const emotionVisualizer = this.page.getByTestId('emotion-visualizer');
    await expect(emotionVisualizer).toBeVisible({ timeout: 15000 });

    // 감정 데이터가 로드될 때까지 대기
    await expect(emotionVisualizer.getByTestId('emotion-data')).toBeVisible();
  }

  /**
   * 음악 생성 시작
   */
  async startMusicGeneration(): Promise<void> {
    const generateButton = this.page.getByRole('button', { name: /음악.*생성|generate/i });
    await expect(generateButton).toBeEnabled();
    await generateButton.click();

    // 생성 진행 상태 표시 확인
    const progressIndicator = this.page.getByTestId('generation-progress');
    await expect(progressIndicator).toBeVisible({ timeout: 5000 });
  }

  /**
   * 음악 생성 완료 대기
   */
  async waitForMusicGeneration(): Promise<void> {
    // 음악 플레이어가 나타날 때까지 대기 (최대 60초)
    const musicPlayer = this.page.getByTestId('music-player');
    await expect(musicPlayer).toBeVisible({ timeout: 60000 });

    // 재생 버튼이 활성화될 때까지 대기
    const playButton = musicPlayer.getByRole('button', { name: /재생|play/i });
    await expect(playButton).toBeEnabled();
  }

  /**
   * 음악 재생
   */
  async playGeneratedMusic(): Promise<void> {
    const musicPlayer = this.page.getByTestId('music-player');
    const playButton = musicPlayer.getByRole('button', { name: /재생|play/i });

    await playButton.click();

    // 재생 중 상태 확인
    const pauseButton = musicPlayer.getByRole('button', { name: /일시정지|pause/i });
    await expect(pauseButton).toBeVisible({ timeout: 5000 });
  }

  /**
   * 네트워크 응답 시간 측정
   */
  async measureNetworkLatency(url: string): Promise<number> {
    const startTime = Date.now();

    const response = await this.page.waitForResponse(
      response => response.url().includes(url),
      { timeout: 10000 }
    );

    const endTime = Date.now();
    return endTime - startTime;
  }

  /**
   * 키 입력 지연 시간 측정
   */
  async measureKeyInputLatency(inputSelector: string): Promise<number> {
    const input = this.page.locator(inputSelector);
    await expect(input).toBeVisible();

    // 이벤트 리스너 추가
    await this.page.evaluate(() => {
      (window as any).keyLatencyStart = 0;
      (window as any).keyLatencyEnd = 0;
    });

    await this.page.evaluate((selector) => {
      const element = document.querySelector(selector);
      if (element) {
        element.addEventListener('keydown', () => {
          (window as any).keyLatencyStart = performance.now();
        });
        element.addEventListener('input', () => {
          (window as any).keyLatencyEnd = performance.now();
        });
      }
    }, inputSelector);

    // 키 입력
    await input.press('a');

    // 지연 시간 계산
    const latency = await this.page.evaluate(() => {
      return (window as any).keyLatencyEnd - (window as any).keyLatencyStart;
    });

    return latency;
  }

  /**
   * 스크린샷 캡처 (테스트 실패 시 디버깅용)
   */
  async captureScreenshot(name: string): Promise<void> {
    await this.page.screenshot({
      path: `test-results/screenshots/${name}-${Date.now()}.png`,
      fullPage: true
    });
  }

  /**
   * 페이지 성능 메트릭 수집
   */
  async getPerformanceMetrics(): Promise<any> {
    return await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');

      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
        totalLoadTime: navigation.loadEventEnd - navigation.navigationStart,
      };
    });
  }

  /**
   * WebSocket 연결 상태 확인
   */
  async checkWebSocketConnection(): Promise<boolean> {
    return await this.page.evaluate(() => {
      // WebSocket 인스턴스 확인
      return (window as any).vibemusic?.websocket?.readyState === WebSocket.OPEN;
    });
  }

  /**
   * 로컬 스토리지에서 세션 정보 가져오기
   */
  async getSessionFromStorage(): Promise<any> {
    return await this.page.evaluate(() => {
      const sessionData = localStorage.getItem('vibemusic-session');
      return sessionData ? JSON.parse(sessionData) : null;
    });
  }

  /**
   * 에러 로그 수집
   */
  async collectConsoleLogs(): Promise<string[]> {
    return await this.page.evaluate(() => {
      return (window as any).testConsoleLogs || [];
    });
  }

  /**
   * 모바일 디바이스 시뮬레이션을 위한 터치 제스처
   */
  async performTouchGesture(element: Locator, gesture: 'tap' | 'swipe'): Promise<void> {
    const box = await element.boundingBox();
    if (!box) throw new Error('요소를 찾을 수 없습니다');

    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    if (gesture === 'tap') {
      await this.page.touchscreen.tap(x, y);
    } else if (gesture === 'swipe') {
      await this.page.touchscreen.tap(x, y);
      await this.page.touchscreen.tap(x + 100, y); // 오른쪽으로 스와이프
    }
  }

  /**
   * 접근성 위반 사항 확인
   */
  async checkAccessibilityViolations(): Promise<any[]> {
    // axe-core 접근성 검사 (실제 구현에서는 @axe-core/playwright 사용)
    return await this.page.evaluate(() => {
      const violations: any[] = [];

      // 기본적인 접근성 검사
      const images = document.querySelectorAll('img');
      images.forEach((img, index) => {
        if (!img.getAttribute('alt')) {
          violations.push({
            type: 'missing-alt-text',
            element: `img[${index}]`,
            description: 'Image missing alt text'
          });
        }
      });

      const buttons = document.querySelectorAll('button');
      buttons.forEach((button, index) => {
        if (!button.textContent?.trim() && !button.getAttribute('aria-label')) {
          violations.push({
            type: 'button-missing-label',
            element: `button[${index}]`,
            description: 'Button missing accessible label'
          });
        }
      });

      return violations;
    });
  }
}

export default TestHelpers;