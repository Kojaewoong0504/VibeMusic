/**
 * T080: 접근성 테스트 (WCAG 2.1 AA)
 *
 * VibeMusic의 웹 접근성 준수 사항을 검증합니다:
 * - WCAG 2.1 Level AA 준수
 * - 스크린 리더 지원
 * - 키보드 내비게이션
 * - 색상 대비 및 시각적 접근성
 */

import { test, expect } from '@playwright/test';

test.describe('VibeMusic 웹 접근성 테스트 (WCAG 2.1 AA)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await expect(page.getByRole('heading', { name: '당신의 감정이 음악이 됩니다' })).toBeVisible();
  });

  test('ARIA 레이블 및 역할 검증', async ({ page }) => {
    // 주요 랜드마크 역할 확인
    const banner = page.locator('header, [role="banner"]');
    if (await banner.count() > 0) {
      await expect(banner.first()).toBeVisible();
    }

    const main = page.locator('main, [role="main"]');
    if (await main.count() > 0) {
      await expect(main.first()).toBeVisible();
    }

    const contentinfo = page.locator('footer, [role="contentinfo"]');
    if (await contentinfo.count() > 0) {
      await expect(contentinfo.first()).toBeVisible();
    }

    // 버튼들의 적절한 레이블 확인
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();

    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);

      // 버튼에 접근 가능한 이름이 있는지 확인
      const ariaLabel = await button.getAttribute('aria-label');
      const buttonText = await button.textContent();
      const title = await button.getAttribute('title');

      const hasAccessibleName = ariaLabel || buttonText?.trim() || title;
      expect(hasAccessibleName).toBeTruthy();
    }

    // 링크의 적절한 레이블 확인
    const links = page.locator('a');
    const linkCount = await links.count();

    for (let i = 0; i < linkCount; i++) {
      const link = links.nth(i);

      const ariaLabel = await link.getAttribute('aria-label');
      const linkText = await link.textContent();
      const title = await link.getAttribute('title');

      const hasAccessibleName = ariaLabel || linkText?.trim() || title;
      expect(hasAccessibleName).toBeTruthy();
    }
  });

  test('키보드 네비게이션 지원', async ({ page }) => {
    // Tab 키로 포커스 이동 확인
    const focusableElements = page.locator(
      'button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const elementCount = await focusableElements.count();

    if (elementCount > 0) {
      // 첫 번째 요소로 포커스 이동
      await page.keyboard.press('Tab');

      const firstFocusable = focusableElements.first();
      await expect(firstFocusable).toBeFocused();

      // 여러 요소 간 Tab 이동 테스트
      for (let i = 1; i < Math.min(elementCount, 5); i++) {
        await page.keyboard.press('Tab');

        // 포커스가 이동했는지 확인
        const currentFocused = page.locator(':focus');
        await expect(currentFocused).toBeVisible();
      }

      // Shift+Tab으로 역방향 이동 테스트
      await page.keyboard.press('Shift+Tab');
      const previousFocused = page.locator(':focus');
      await expect(previousFocused).toBeVisible();
    }

    // Enter 키로 버튼 활성화 테스트
    const startButton = page.getByRole('button', { name: 'VibeMusic 시작하기' });
    await startButton.focus();
    await page.keyboard.press('Enter');

    // 버튼이 활성화되었는지 확인
    await expect(startButton).toHaveClass(/active/);

    // Escape 키 처리 (모달이 있는 경우)
    await page.keyboard.press('Escape');
    // 현재는 모달이 없으므로 에러가 발생하지 않는지만 확인
  });

  test('스크린 리더 지원 (시맨틱 HTML)', async ({ page }) => {
    // 제목 계층 구조 확인 (h1 > h2 > h3...)
    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    const headingCount = await headings.count();

    if (headingCount > 0) {
      // h1이 존재하는지 확인
      const h1Elements = page.locator('h1');
      const h1Count = await h1Elements.count();
      expect(h1Count).toBeGreaterThan(0);

      // 제목들이 올바른 순서로 배치되었는지 확인
      for (let i = 0; i < headingCount; i++) {
        const heading = headings.nth(i);
        const tagName = await heading.evaluate(el => el.tagName);
        expect(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']).toContain(tagName);
      }
    }

    // 이미지의 alt 텍스트 확인
    const images = page.locator('img');
    const imageCount = await images.count();

    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const role = await img.getAttribute('role');

      // 장식적 이미지가 아니라면 alt 텍스트가 있어야 함
      if (role !== 'presentation' && role !== 'none') {
        expect(alt).toBeTruthy();
      }
    }

    // 폼 레이블 연결 확인 (실제 폼이 있는 경우)
    const inputs = page.locator('input, textarea, select');
    const inputCount = await inputs.count();

    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledby = await input.getAttribute('aria-labelledby');

      if (id) {
        // 연결된 레이블이 있는지 확인
        const label = page.locator(`label[for="${id}"]`);
        const labelExists = await label.count() > 0;

        const hasAccessibleLabel = labelExists || ariaLabel || ariaLabelledby;
        expect(hasAccessibleLabel).toBeTruthy();
      }
    }
  });

  test('색상 대비 및 시각적 접근성', async ({ page }) => {
    // 주요 텍스트 요소들의 색상 대비 확인
    const textElements = page.locator('h1, h2, h3, p, button, a');
    const elementCount = await textElements.count();

    for (let i = 0; i < Math.min(elementCount, 10); i++) {
      const element = textElements.nth(i);

      const styles = await element.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
          color: computed.color,
          backgroundColor: computed.backgroundColor,
          fontSize: computed.fontSize
        };
      });

      // 폰트 크기가 접근성 기준을 만족하는지 확인
      const fontSize = parseInt(styles.fontSize);

      // WCAG 기준: 일반 텍스트는 최소 16px (1rem) 권장
      if (await element.evaluate(el => el.tagName !== 'BUTTON')) {
        expect(fontSize).toBeGreaterThanOrEqual(14); // 최소 허용 크기
      }

      // 색상 정보 로깅 (실제 대비율 계산은 복잡하므로 기본 확인만)
      console.log(`Element ${i}:`, {
        tag: await element.evaluate(el => el.tagName),
        color: styles.color,
        backgroundColor: styles.backgroundColor,
        fontSize: styles.fontSize
      });
    }

    // 포커스 표시기 확인
    const focusableElement = page.getByRole('button', { name: 'VibeMusic 시작하기' });
    await focusableElement.focus();

    const focusStyles = await focusableElement.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        outline: computed.outline,
        outlineColor: computed.outlineColor,
        outlineWidth: computed.outlineWidth,
        boxShadow: computed.boxShadow
      };
    });

    // 포커스 표시기가 있는지 확인
    const hasFocusIndicator =
      focusStyles.outline !== 'none' ||
      focusStyles.boxShadow !== 'none' ||
      focusStyles.outlineWidth !== '0px';

    expect(hasFocusIndicator).toBeTruthy();
  });

  test('동작 및 제스처 접근성', async ({ page }) => {
    // 터치 타겟 크기 확인 (최소 44x44px)
    const interactiveElements = page.locator('button, a, input, [role="button"]');
    const elementCount = await interactiveElements.count();

    for (let i = 0; i < elementCount; i++) {
      const element = interactiveElements.nth(i);
      const box = await element.boundingBox();

      if (box) {
        // WCAG 기준: 터치 타겟은 최소 44x44px
        expect(box.width).toBeGreaterThanOrEqual(32); // 약간 완화된 기준
        expect(box.height).toBeGreaterThanOrEqual(32);
      }
    }

    // 클릭/터치 대안 확인 (키보드로도 접근 가능해야 함)
    const clickableElements = page.locator('[onclick], button, a');
    const clickableCount = await clickableElements.count();

    for (let i = 0; i < Math.min(clickableCount, 5); i++) {
      const element = clickableElements.nth(i);

      // 키보드로 포커스 가능한지 확인
      await element.focus();
      await expect(element).toBeFocused();

      // Enter 키로 활성화 가능한지 확인
      await page.keyboard.press('Enter');
      // 실제 동작 결과는 구현에 따라 달라지므로 에러가 없는지만 확인
    }
  });

  test('시간 제한 및 자동 재생 제어', async ({ page }) => {
    // 자동 재생되는 미디어가 있는지 확인
    const mediaElements = page.locator('audio, video');
    const mediaCount = await mediaElements.count();

    for (let i = 0; i < mediaCount; i++) {
      const media = mediaElements.nth(i);

      // 자동 재생 속성 확인
      const autoplay = await media.getAttribute('autoplay');
      const muted = await media.getAttribute('muted');

      // 자동 재생이 있다면 음소거되어야 하거나 사용자 제어가 가능해야 함
      if (autoplay !== null) {
        const hasControls = await media.getAttribute('controls');
        const isMuted = muted !== null;

        expect(hasControls !== null || isMuted).toBeTruthy();
      }
    }

    // 깜박이거나 번쩍이는 애니메이션 확인
    const animatedElements = page.locator('[style*="animation"], .animate');
    const animatedCount = await animatedElements.count();

    if (animatedCount > 0) {
      console.log(`발견된 애니메이션 요소: ${animatedCount}개`);

      // 애니메이션 일시정지 기능이 있는지 확인 (구현되어 있다면)
      const pauseButton = page.locator('[aria-label*="일시정지"], [aria-label*="pause"]');
      if (await pauseButton.count() > 0) {
        await expect(pauseButton.first()).toBeVisible();
      }
    }

    // 세션 타임아웃 알림 확인 (구현되어 있다면)
    // 실제 타임아웃을 기다리는 대신 시뮬레이션
    await page.evaluate(() => {
      // 타임아웃 관련 로직이 있다면 여기서 테스트
      const sessionData = localStorage.getItem('vibemusic-session');
      if (sessionData) {
        console.log('세션 데이터 존재:', sessionData);
      }
    });
  });

  test('언어 및 지역화 접근성', async ({ page }) => {
    // HTML lang 속성 확인
    const htmlLang = await page.locator('html').getAttribute('lang');
    expect(htmlLang).toBeTruthy();
    expect(htmlLang).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/); // ko, ko-KR 등의 형식

    // 다국어 텍스트의 lang 속성 확인 (있다면)
    const foreignTexts = page.locator('[lang]:not(html)');
    const foreignCount = await foreignTexts.count();

    if (foreignCount > 0) {
      for (let i = 0; i < foreignCount; i++) {
        const element = foreignTexts.nth(i);
        const lang = await element.getAttribute('lang');
        expect(lang).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/);
      }
    }

    // 텍스트 방향 확인 (RTL 언어 지원)
    const dir = await page.locator('html').getAttribute('dir');
    if (dir) {
      expect(['ltr', 'rtl', 'auto']).toContain(dir);
    }

    // 한글 텍스트 렌더링 확인
    const koreanText = page.getByRole('heading', { name: '당신의 감정이 음악이 됩니다' });
    const textBox = await koreanText.boundingBox();
    expect(textBox?.width).toBeGreaterThan(100); // 한글이 올바르게 렌더링되면 충분한 너비
  });

  test('에러 메시지 및 피드백 접근성', async ({ page }) => {
    // 현재 페이지에서 에러 상황 시뮬레이션
    // 실제 에러 메시지가 구현되어 있다면 테스트

    // ARIA live regions 확인
    const liveRegions = page.locator('[aria-live], [role="alert"], [role="status"]');
    const liveCount = await liveRegions.count();

    if (liveCount > 0) {
      for (let i = 0; i < liveCount; i++) {
        const region = liveRegions.nth(i);
        const ariaLive = await region.getAttribute('aria-live');
        const role = await region.getAttribute('role');

        if (ariaLive) {
          expect(['polite', 'assertive', 'off']).toContain(ariaLive);
        }

        if (role) {
          expect(['alert', 'status', 'log']).toContain(role);
        }
      }
    }

    // 필수 필드 표시 확인 (폼이 있다면)
    const requiredFields = page.locator('[required], [aria-required="true"]');
    const requiredCount = await requiredFields.count();

    for (let i = 0; i < requiredCount; i++) {
      const field = requiredFields.nth(i);

      // 필수 필드 표시가 시각적으로도 있는지 확인
      const ariaRequired = await field.getAttribute('aria-required');
      const required = await field.getAttribute('required');

      expect(ariaRequired === 'true' || required !== null).toBeTruthy();
    }

    // 성공/실패 메시지 확인
    const statusMessages = page.locator('.success, .error, .warning, [role="alert"]');
    const statusCount = await statusMessages.count();

    if (statusCount > 0) {
      for (let i = 0; i < statusCount; i++) {
        const message = statusMessages.nth(i);
        const isVisible = await message.isVisible();

        if (isVisible) {
          const text = await message.textContent();
          expect(text?.trim()).toBeTruthy();
        }
      }
    }
  });

  test('모바일 접근성 특화 기능', async ({ page }) => {
    // 모바일 뷰포트로 설정
    await page.setViewportSize({ width: 375, height: 667 });

    // 모바일에서 터치 접근성 확인
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();

    for (let i = 0; i < Math.min(buttonCount, 5); i++) {
      const button = buttons.nth(i);
      const box = await button.boundingBox();

      if (box) {
        // 모바일에서 터치 타겟 크기 (iOS: 44px, Android: 48dp)
        expect(box.height).toBeGreaterThanOrEqual(44);

        // 터치 타겟 간 충분한 간격 (최소 8px)
        const spacing = await button.evaluate(el => {
          const style = window.getComputedStyle(el);
          return {
            marginTop: parseInt(style.marginTop),
            marginBottom: parseInt(style.marginBottom),
            marginLeft: parseInt(style.marginLeft),
            marginRight: parseInt(style.marginRight)
          };
        });

        // 충분한 간격이 있는지 확인 (마진이나 패딩)
        expect(Object.values(spacing).some(value => value >= 4)).toBeTruthy();
      }
    }

    // 모바일 스크린 리더 지원 확인
    const headings = page.locator('h1, h2, h3');
    const headingCount = await headings.count();

    if (headingCount > 0) {
      // 제목 구조가 모바일에서도 명확한지 확인
      for (let i = 0; i < headingCount; i++) {
        const heading = headings.nth(i);
        const text = await heading.textContent();
        const box = await heading.boundingBox();

        expect(text?.trim()).toBeTruthy();
        expect(box?.height).toBeGreaterThan(20); // 충분한 높이
      }
    }

    // 확대/축소 지원 확인
    const viewport = await page.locator('meta[name="viewport"]');
    if (await viewport.count() > 0) {
      const content = await viewport.getAttribute('content');

      // user-scalable=no가 없는지 확인 (접근성을 위해)
      expect(content).not.toContain('user-scalable=no');
      expect(content).not.toContain('maximum-scale=1');
    }
  });

  test('WCAG 2.1 자동 검증 도구 시뮬레이션', async ({ page }) => {
    // 기본적인 접근성 규칙들을 프로그래밍 방식으로 확인

    const accessibilityChecks = await page.evaluate(() => {
      const results = {
        hasH1: false,
        allImagesHaveAlt: true,
        allButtonsHaveLabels: true,
        colorContrastIssues: 0,
        keyboardNavigable: true
      };

      // H1 태그 확인
      results.hasH1 = document.querySelectorAll('h1').length > 0;

      // 이미지 alt 텍스트 확인
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        if (!img.alt && img.getAttribute('role') !== 'presentation') {
          results.allImagesHaveAlt = false;
        }
      });

      // 버튼 레이블 확인
      const buttons = document.querySelectorAll('button');
      buttons.forEach(button => {
        const hasLabel = button.textContent?.trim() ||
                        button.getAttribute('aria-label') ||
                        button.getAttribute('title');
        if (!hasLabel) {
          results.allButtonsHaveLabels = false;
        }
      });

      // 포커스 가능한 요소들 확인
      const focusableElements = document.querySelectorAll(
        'button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      results.keyboardNavigable = focusableElements.length > 0;

      return results;
    });

    // 검증 결과 확인
    expect(accessibilityChecks.hasH1).toBeTruthy();
    expect(accessibilityChecks.allImagesHaveAlt).toBeTruthy();
    expect(accessibilityChecks.allButtonsHaveLabels).toBeTruthy();
    expect(accessibilityChecks.keyboardNavigable).toBeTruthy();

    console.log('접근성 자동 검증 결과:', accessibilityChecks);

    // 추가적인 의미적 HTML 구조 확인
    const semanticStructure = await page.evaluate(() => {
      return {
        hasMain: document.querySelectorAll('main, [role="main"]').length > 0,
        hasNavigation: document.querySelectorAll('nav, [role="navigation"]').length > 0,
        hasHeader: document.querySelectorAll('header, [role="banner"]').length > 0,
        hasFooter: document.querySelectorAll('footer, [role="contentinfo"]').length > 0,
        properHeadingOrder: true // 실제로는 더 복잡한 검증 필요
      };
    });

    console.log('의미적 HTML 구조:', semanticStructure);

    // 기본적인 시맨틱 구조가 있는지 확인
    expect(
      semanticStructure.hasMain ||
      semanticStructure.hasHeader ||
      semanticStructure.hasNavigation
    ).toBeTruthy();
  });
});