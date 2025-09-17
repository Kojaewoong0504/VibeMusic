/**
 * Visual Regression Tests
 *
 * 시각적 회귀 테스트를 통한 UI 컴포넌트 변경 사항 감지
 * Playwright + Storybook을 활용한 자동화된 시각적 테스트
 */

import { test, expect, Page } from '@playwright/test';

// 테스트 헬퍼 함수들
const storybookUrl = 'http://localhost:6006';

async function navigateToStory(page: Page, storyPath: string) {
  await page.goto(`${storybookUrl}/iframe.html?path=/story/${storyPath}`);
  await page.waitForLoadState('networkidle');

  // Storybook이 완전히 로드될 때까지 대기
  await page.waitForSelector('[data-testid="story-root"], #root, .sb-show-main', { timeout: 10000 });
}

async function waitForAnimations(page: Page) {
  // CSS 애니메이션과 전환이 완료될 때까지 대기
  await page.waitForTimeout(1000);

  // 모든 애니메이션 비활성화 (일관된 스크린샷을 위해)
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `
  });
}

async function hideVariableElements(page: Page) {
  // 시간, 날짜 등 변동 요소들 숨기기
  await page.addStyleTag({
    content: `
      .timestamp, .current-time, .session-timer, .random-element {
        visibility: hidden !important;
      }
    `
  });
}

// 반응형 테스트를 위한 뷰포트 설정
const viewports = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1200, height: 800 },
  widescreen: { width: 1920, height: 1080 }
};

// 메인 컴포넌트 시각적 회귀 테스트
test.describe('TypingInterface Visual Regression', () => {
  test('default state', async ({ page }) => {
    await navigateToStory(page, 'components-typinginterface--default');
    await waitForAnimations(page);
    await hideVariableElements(page);

    await expect(page).toHaveScreenshot('typing-interface-default.png');
  });

  test('interactive state', async ({ page }) => {
    await navigateToStory(page, 'components-typinginterface--interactive');
    await waitForAnimations(page);

    // 실제 입력 시뮬레이션
    const textarea = page.locator('textarea');
    await textarea.fill('테스트 입력 텍스트입니다');
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('typing-interface-interactive.png');
  });

  test('disconnected state', async ({ page }) => {
    await navigateToStory(page, 'components-typinginterface--disconnected');
    await waitForAnimations(page);

    await expect(page).toHaveScreenshot('typing-interface-disconnected.png');
  });

  test('near max length', async ({ page }) => {
    await navigateToStory(page, 'components-typinginterface--near-max-length');
    await waitForAnimations(page);

    await expect(page).toHaveScreenshot('typing-interface-near-max.png');
  });

  test('dark theme', async ({ page }) => {
    await navigateToStory(page, 'components-typinginterface--dark-theme');
    await waitForAnimations(page);

    await expect(page).toHaveScreenshot('typing-interface-dark.png');
  });

  // 반응형 테스트
  Object.entries(viewports).forEach(([deviceName, viewport]) => {
    test(`responsive - ${deviceName}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await navigateToStory(page, 'components-typinginterface--responsive-test');
      await waitForAnimations(page);

      await expect(page).toHaveScreenshot(`typing-interface-${deviceName}.png`);
    });
  });
});

test.describe('MusicPlayer Visual Regression', () => {
  test('default with music', async ({ page }) => {
    await navigateToStory(page, 'visual-tests-all-components--music-player-default');
    await waitForAnimations(page);

    await expect(page).toHaveScreenshot('music-player-default.png');
  });

  test('no music state', async ({ page }) => {
    await navigateToStory(page, 'visual-tests-all-components--music-player-no-music');
    await waitForAnimations(page);

    await expect(page).toHaveScreenshot('music-player-no-music.png');
  });

  test('compact version', async ({ page }) => {
    await navigateToStory(page, 'visual-tests-all-components--music-player-compact');
    await waitForAnimations(page);

    await expect(page).toHaveScreenshot('music-player-compact.png');
  });

  test('interactive controls', async ({ page }) => {
    await navigateToStory(page, 'visual-tests-all-components--music-player-default');
    await waitForAnimations(page);

    // 재생 버튼 호버 상태
    const playButton = page.locator('.play-button');
    await playButton.hover();
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot('music-player-play-hover.png');

    // 볼륨 슬라이더 조작
    const volumeBar = page.locator('.volume-bar');
    if (await volumeBar.isVisible()) {
      await volumeBar.click({ position: { x: 50, y: 5 } });
      await page.waitForTimeout(200);

      await expect(page).toHaveScreenshot('music-player-volume-change.png');
    }
  });
});

test.describe('EmotionVisualizer Visual Regression', () => {
  test('detailed mode', async ({ page }) => {
    await navigateToStory(page, 'visual-tests-all-components--emotion-visualizer-detailed');
    await waitForAnimations(page);

    await expect(page).toHaveScreenshot('emotion-visualizer-detailed.png');
  });

  test('compact mode', async ({ page }) => {
    await navigateToStory(page, 'visual-tests-all-components--emotion-visualizer-compact');
    await waitForAnimations(page);

    await expect(page).toHaveScreenshot('emotion-visualizer-compact.png');
  });

  test('minimal mode', async ({ page }) => {
    await navigateToStory(page, 'visual-tests-all-components--emotion-visualizer-minimal');
    await waitForAnimations(page);

    await expect(page).toHaveScreenshot('emotion-visualizer-minimal.png');
  });

  // 다양한 감정 상태 테스트
  const emotionStates = [
    { name: 'high-energy', energy: 0.9, valence: 0.7, tension: 0.3, focus: 0.8 },
    { name: 'low-energy', energy: 0.1, valence: -0.3, tension: 0.2, focus: 0.9 },
    { name: 'stressed', energy: 0.8, valence: -0.6, tension: 0.9, focus: 0.2 },
    { name: 'calm', energy: 0.3, valence: 0.4, tension: 0.1, focus: 0.7 }
  ];

  emotionStates.forEach(emotion => {
    test(`emotion state - ${emotion.name}`, async ({ page }) => {
      await navigateToStory(page, 'visual-tests-all-components--emotion-visualizer-detailed');
      await waitForAnimations(page);

      // 감정 상태를 동적으로 변경하는 스크립트 실행
      await page.evaluate((emotionData) => {
        const bars = document.querySelectorAll('.emotion-bar .h-full');
        const values = Object.values(emotionData).slice(1); // name 제외
        bars.forEach((bar, index) => {
          if (bar instanceof HTMLElement) {
            bar.style.width = `${Math.max(0, values[index] * 100)}%`;
          }
        });
      }, emotion);

      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot(`emotion-visualizer-${emotion.name}.png`);
    });
  });
});

test.describe('SessionStatus Visual Regression', () => {
  test('active session', async ({ page }) => {
    await navigateToStory(page, 'visual-tests-all-components--session-status-active');
    await waitForAnimations(page);
    await hideVariableElements(page);

    await expect(page).toHaveScreenshot('session-status-active.png');
  });

  test('disconnected session', async ({ page }) => {
    await navigateToStory(page, 'visual-tests-all-components--session-status-disconnected');
    await waitForAnimations(page);
    await hideVariableElements(page);

    await expect(page).toHaveScreenshot('session-status-disconnected.png');
  });

  test('button interactions', async ({ page }) => {
    await navigateToStory(page, 'visual-tests-all-components--session-status-active');
    await waitForAnimations(page);
    await hideVariableElements(page);

    // 연장 버튼 호버
    const extendButton = page.locator('button').filter({ hasText: '세션 연장' });
    await extendButton.hover();
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot('session-status-extend-hover.png');

    // 종료 버튼 호버
    const endButton = page.locator('button').filter({ hasText: '세션 종료' });
    await endButton.hover();
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot('session-status-end-hover.png');
  });
});

test.describe('LoadingSpinner Visual Regression', () => {
  test('default spinner', async ({ page }) => {
    await navigateToStory(page, 'visual-tests-all-components--loading-spinner-default');
    await waitForAnimations(page);

    await expect(page).toHaveScreenshot('loading-spinner-default.png');
  });

  test('with message', async ({ page }) => {
    await navigateToStory(page, 'visual-tests-all-components--loading-spinner-with-message');
    await waitForAnimations(page);

    await expect(page).toHaveScreenshot('loading-spinner-message.png');
  });

  test('overlay mode', async ({ page }) => {
    await navigateToStory(page, 'visual-tests-all-components--loading-spinner-overlay');
    await waitForAnimations(page);

    await expect(page).toHaveScreenshot('loading-spinner-overlay.png');
  });
});

test.describe('Full Layout Visual Regression', () => {
  test('complete application layout', async ({ page }) => {
    await navigateToStory(page, 'visual-tests-all-components--full-layout-test');
    await waitForAnimations(page);
    await hideVariableElements(page);

    await expect(page).toHaveScreenshot('full-layout-complete.png', {
      fullPage: true
    });
  });

  test('dark theme layout', async ({ page }) => {
    await navigateToStory(page, 'visual-tests-all-components--dark-theme-test');
    await waitForAnimations(page);
    await hideVariableElements(page);

    await expect(page).toHaveScreenshot('full-layout-dark.png', {
      fullPage: true
    });
  });

  // 반응형 레이아웃 테스트
  Object.entries(viewports).forEach(([deviceName, viewport]) => {
    test(`full layout responsive - ${deviceName}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await navigateToStory(page, 'visual-tests-all-components--responsive-test');
      await waitForAnimations(page);
      await hideVariableElements(page);

      await expect(page).toHaveScreenshot(`full-layout-${deviceName}.png`, {
        fullPage: true
      });
    });
  });
});

test.describe('Accessibility Visual Tests', () => {
  test('high contrast mode', async ({ page }) => {
    await navigateToStory(page, 'visual-tests-all-components--accessibility-test');
    await waitForAnimations(page);

    // 고대비 모드 시뮬레이션
    await page.addStyleTag({
      content: `
        * {
          filter: contrast(1.5) !important;
        }
      `
    });

    await expect(page).toHaveScreenshot('accessibility-high-contrast.png');
  });

  test('focus indicators', async ({ page }) => {
    await navigateToStory(page, 'visual-tests-all-components--accessibility-test');
    await waitForAnimations(page);

    // 모든 interactive 요소에 포커스 표시
    await page.addStyleTag({
      content: `
        button:focus, input:focus, textarea:focus, [tabindex]:focus {
          outline: 3px solid #4A90E2 !important;
          outline-offset: 2px !important;
        }
      `
    });

    // 첫 번째 버튼에 포커스
    const firstButton = page.locator('button').first();
    await firstButton.focus();

    await expect(page).toHaveScreenshot('accessibility-focus-indicators.png');
  });

  test('reduced motion', async ({ page }) => {
    await navigateToStory(page, 'visual-tests-all-components--full-layout-test');

    // prefers-reduced-motion 시뮬레이션
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

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await waitForAnimations(page);

    await expect(page).toHaveScreenshot('accessibility-reduced-motion.png');
  });
});

// 에러 상태 시각적 테스트
test.describe('Error States Visual Regression', () => {
  test('network error simulation', async ({ page }) => {
    await navigateToStory(page, 'visual-tests-all-components--full-layout-test');
    await waitForAnimations(page);

    // 에러 상태 시뮬레이션
    await page.evaluate(() => {
      const errorDiv = document.createElement('div');
      errorDiv.innerHTML = `
        <div style="background: #fee; border: 1px solid #fcc; padding: 12px; margin: 16px; border-radius: 4px; color: #c33;">
          ⚠️ 네트워크 연결 오류: 서버에 연결할 수 없습니다.
        </div>
      `;
      document.body.prepend(errorDiv);
    });

    await expect(page).toHaveScreenshot('error-state-network.png');
  });

  test('validation errors', async ({ page }) => {
    await navigateToStory(page, 'components-typinginterface--default');
    await waitForAnimations(page);

    // 유효성 검사 오류 시뮬레이션
    const textarea = page.locator('textarea');
    await textarea.fill('x'.repeat(1500)); // 최대 길이 초과

    await page.evaluate(() => {
      const textarea = document.querySelector('textarea');
      if (textarea) {
        textarea.style.borderColor = '#ef4444';
        textarea.style.backgroundColor = '#fef2f2';

        const errorMsg = document.createElement('div');
        errorMsg.textContent = '최대 글자 수를 초과했습니다.';
        errorMsg.style.color = '#ef4444';
        errorMsg.style.fontSize = '14px';
        errorMsg.style.marginTop = '8px';
        textarea.parentElement?.appendChild(errorMsg);
      }
    });

    await expect(page).toHaveScreenshot('error-state-validation.png');
  });
});

// 성능 테스트와 연계된 시각적 테스트
test.describe('Performance Visual Tests', () => {
  test('large data rendering', async ({ page }) => {
    await navigateToStory(page, 'components-typinginterface--performance-test');
    await waitForAnimations(page);

    // 대량 데이터 시뮬레이션
    const textarea = page.locator('textarea');
    await textarea.fill('a'.repeat(500));

    // 빠른 타이핑 시뮬레이션
    for (let i = 0; i < 10; i++) {
      await textarea.press('b');
      await page.waitForTimeout(50);
    }

    await expect(page).toHaveScreenshot('performance-large-data.png');
  });

  test('animation performance', async ({ page }) => {
    await navigateToStory(page, 'visual-tests-all-components--emotion-visualizer-detailed');

    // 애니메이션 활성화 상태에서 스크린샷
    await page.waitForTimeout(2000); // 애니메이션 실행 시간

    await expect(page).toHaveScreenshot('performance-animation.png');
  });
});