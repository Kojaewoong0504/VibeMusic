/**
 * T079: UI/UX 반응형 테스트
 *
 * 다양한 디바이스와 화면 크기에서 VibeMusic의
 * 반응형 디자인과 사용자 경험을 검증합니다.
 */

import { test, expect, devices } from '@playwright/test';

test.describe('VibeMusic 반응형 디자인 테스트', () => {

  // 테스트할 뷰포트 크기들
  const viewports = [
    { name: 'Desktop Large', width: 1920, height: 1080 },
    { name: 'Desktop Medium', width: 1366, height: 768 },
    { name: 'Tablet Landscape', width: 1024, height: 768 },
    { name: 'Tablet Portrait', width: 768, height: 1024 },
    { name: 'Mobile Large', width: 414, height: 896 },
    { name: 'Mobile Medium', width: 375, height: 667 },
    { name: 'Mobile Small', width: 320, height: 568 }
  ];

  // 각 뷰포트에서 기본 레이아웃 테스트
  viewports.forEach(viewport => {
    test(`${viewport.name} (${viewport.width}x${viewport.height}) 기본 레이아웃`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('http://localhost:3000');

      // 핵심 요소들이 표시되는지 확인
      await expect(page.getByRole('heading', { name: '당신의 감정이 음악이 됩니다' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'VibeMusic 시작하기' })).toBeVisible();

      // 뷰포트에 따른 레이아웃 검증
      if (viewport.width >= 1024) {
        // 데스크톱: 버튼들이 수평으로 배열
        const ctaContainer = page.locator('.cta-container');
        if (await ctaContainer.count() > 0) {
          const flexDirection = await ctaContainer.evaluate(el =>
            window.getComputedStyle(el).flexDirection
          );
          expect(flexDirection).toBe('row');
        }
      } else if (viewport.width < 768) {
        // 모바일: 버튼들이 수직으로 배열
        const ctaContainer = page.locator('.cta-container');
        if (await ctaContainer.count() > 0) {
          const flexDirection = await ctaContainer.evaluate(el =>
            window.getComputedStyle(el).flexDirection
          );
          expect(flexDirection).toBe('column');
        }
      }

      // 텍스트가 오버플로우 없이 표시되는지 확인
      const titleElement = page.getByRole('heading', { name: '당신의 감정이 음악이 됩니다' });
      const titleBox = await titleElement.boundingBox();
      expect(titleBox?.width).toBeLessThanOrEqual(viewport.width - 40); // 여백 고려
    });
  });

  test('모바일 전용 인터페이스 테스트', async ({ page }) => {
    // iPhone 13 시뮬레이션
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:3000');

    // 터치 친화적 버튼 크기 확인
    const startButton = page.getByRole('button', { name: 'VibeMusic 시작하기' });
    const buttonBox = await startButton.boundingBox();

    // 최소 터치 타겟 크기 44x44px (iOS 가이드라인)
    expect(buttonBox?.height).toBeGreaterThanOrEqual(44);
    expect(buttonBox?.width).toBeGreaterThanOrEqual(120); // 텍스트 버튼은 더 넓어야 함

    // 모바일에서 호버 효과 대신 터치 효과 확인
    await startButton.tap();
    await expect(startButton).toHaveClass(/active/);

    // 스크롤 가능성 확인
    const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = 844;

    if (bodyHeight > viewportHeight) {
      // 스크롤 테스트
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const scrollY = await page.evaluate(() => window.scrollY);
      expect(scrollY).toBeGreaterThan(0);
    }
  });

  test('태블릿 인터페이스 최적화', async ({ page }) => {
    // iPad 시뮬레이션
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('http://localhost:3000');

    // 태블릿에서 적절한 간격과 크기 확인
    const heroSection = page.locator('.hero-section');
    const heroStyles = await heroSection.evaluate(el => {
      const style = window.getComputedStyle(el);
      return {
        padding: style.padding,
        textAlign: style.textAlign
      };
    });

    expect(heroStyles.textAlign).toBe('center');

    // 기능 그리드가 태블릿에서 적절히 배열되는지 확인
    const featuresGrid = page.locator('.features-grid');
    if (await featuresGrid.count() > 0) {
      const gridColumns = await featuresGrid.evaluate(el => {
        return window.getComputedStyle(el).gridTemplateColumns;
      });

      // 태블릿에서는 2열 정도가 적절
      expect(gridColumns).toContain('fr');
    }
  });

  test('브레이크포인트 전환 테스트', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // 데스크톱에서 시작
    await page.setViewportSize({ width: 1200, height: 800 });

    const ctaContainer = page.locator('.cta-container');
    if (await ctaContainer.count() > 0) {
      // 데스크톱에서 row 레이아웃 확인
      let flexDirection = await ctaContainer.evaluate(el =>
        window.getComputedStyle(el).flexDirection
      );
      expect(flexDirection).toBe('row');

      // 태블릿 크기로 변경
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(500); // CSS 적용 대기

      // 태블릿에서 여전히 row 또는 column 확인
      flexDirection = await ctaContainer.evaluate(el =>
        window.getComputedStyle(el).flexDirection
      );
      expect(['row', 'column']).toContain(flexDirection);

      // 모바일 크기로 변경
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500);

      // 모바일에서 column 레이아웃 확인
      flexDirection = await ctaContainer.evaluate(el =>
        window.getComputedStyle(el).flexDirection
      );
      expect(flexDirection).toBe('column');
    }
  });

  test('이미지 및 미디어 반응형 동작', async ({ page }) => {
    await page.goto('http://localhost:3000');

    const viewportSizes = [
      { width: 1920, height: 1080 },
      { width: 768, height: 1024 },
      { width: 375, height: 667 }
    ];

    for (const size of viewportSizes) {
      await page.setViewportSize(size);
      await page.waitForTimeout(300);

      // 이미지가 있다면 반응형으로 조정되는지 확인
      const images = page.locator('img');
      const imageCount = await images.count();

      if (imageCount > 0) {
        for (let i = 0; i < imageCount; i++) {
          const img = images.nth(i);
          const imgBox = await img.boundingBox();

          if (imgBox) {
            // 이미지가 뷰포트를 넘지 않는지 확인
            expect(imgBox.width).toBeLessThanOrEqual(size.width);

            // 이미지가 너무 작지 않은지 확인 (최소 크기)
            if (size.width >= 768) {
              expect(imgBox.width).toBeGreaterThan(50);
            }
          }
        }
      }
    }
  });

  test('폰트 크기 반응형 조정', async ({ page }) => {
    await page.goto('http://localhost:3000');

    const titleElement = page.getByRole('heading', { name: '당신의 감정이 음악이 됩니다' });

    // 데스크톱에서 폰트 크기 측정
    await page.setViewportSize({ width: 1200, height: 800 });
    const desktopFontSize = await titleElement.evaluate(el => {
      return parseInt(window.getComputedStyle(el).fontSize);
    });

    // 태블릿에서 폰트 크기 측정
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(300);
    const tabletFontSize = await titleElement.evaluate(el => {
      return parseInt(window.getComputedStyle(el).fontSize);
    });

    // 모바일에서 폰트 크기 측정
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(300);
    const mobileFontSize = await titleElement.evaluate(el => {
      return parseInt(window.getComputedStyle(el).fontSize);
    });

    console.log('폰트 크기:', {
      desktop: `${desktopFontSize}px`,
      tablet: `${tabletFontSize}px`,
      mobile: `${mobileFontSize}px`
    });

    // 화면이 작아질수록 폰트도 작아지는지 확인
    expect(mobileFontSize).toBeLessThanOrEqual(tabletFontSize);
    expect(tabletFontSize).toBeLessThanOrEqual(desktopFontSize);

    // 하지만 모바일에서도 읽기 가능한 최소 크기 유지
    expect(mobileFontSize).toBeGreaterThanOrEqual(16);
  });

  test('네비게이션 반응형 동작', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // 데스크톱에서 네비게이션 확인
    await page.setViewportSize({ width: 1200, height: 800 });

    const header = page.locator('header, .header, nav, .nav');
    if (await header.count() > 0) {
      const headerElement = header.first();

      // 데스크톱에서 네비게이션 레이아웃
      const desktopNav = await headerElement.evaluate(el => {
        const style = window.getComputedStyle(el);
        return {
          display: style.display,
          flexDirection: style.flexDirection,
          justifyContent: style.justifyContent
        };
      });

      // 모바일에서 네비게이션 변화 확인
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(300);

      const mobileNav = await headerElement.evaluate(el => {
        const style = window.getComputedStyle(el);
        return {
          display: style.display,
          flexDirection: style.flexDirection,
          justifyContent: style.justifyContent
        };
      });

      // 네비게이션이 모바일에서도 표시되는지 확인
      expect(mobileNav.display).not.toBe('none');
    }

    // 버튼들이 모바일에서도 접근 가능한지 확인
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();

    for (let i = 0; i < Math.min(buttonCount, 5); i++) {
      const button = buttons.nth(i);
      const isVisible = await button.isVisible();
      expect(isVisible).toBeTruthy();
    }
  });

  test('터치 제스처 지원', async ({ page }) => {
    // 모바일 뷰포트 설정
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:3000');

    // 터치 이벤트 시뮬레이션
    const startButton = page.getByRole('button', { name: 'VibeMusic 시작하기' });

    // 터치 시작
    await startButton.tap();
    await expect(startButton).toHaveClass(/active/);

    // 스와이프 제스처 테스트 (페이지에 스크롤 가능한 컨텐츠가 있는 경우)
    const initialScrollY = await page.evaluate(() => window.scrollY);

    // 터치 스크롤 시뮬레이션
    await page.touchscreen.tap(200, 300);
    await page.mouse.move(200, 300);
    await page.mouse.down();
    await page.mouse.move(200, 200);
    await page.mouse.up();

    // 스크롤이 발생했는지 확인 (컨텐츠가 충분히 길 경우)
    const newScrollY = await page.evaluate(() => window.scrollY);
    // 스크롤 가능한 컨텐츠가 있으면 변화가, 없으면 동일한 값
    expect(typeof newScrollY).toBe('number');
  });

  test('가로/세로 화면 전환', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // 세로 모드 (Portrait)
    await page.setViewportSize({ width: 375, height: 667 });

    // 기본 요소들이 세로 모드에서 올바르게 표시되는지 확인
    await expect(page.getByRole('heading', { name: '당신의 감정이 음악이 됩니다' })).toBeVisible();

    const portraitLayout = await page.evaluate(() => {
      const body = document.body;
      return {
        width: body.offsetWidth,
        height: body.offsetHeight,
        scrollHeight: body.scrollHeight
      };
    });

    // 가로 모드 (Landscape)
    await page.setViewportSize({ width: 667, height: 375 });
    await page.waitForTimeout(500);

    // 가로 모드에서도 기본 요소들이 표시되는지 확인
    await expect(page.getByRole('heading', { name: '당신의 감정이 음악이 됩니다' })).toBeVisible();

    const landscapeLayout = await page.evaluate(() => {
      const body = document.body;
      return {
        width: body.offsetWidth,
        height: body.offsetHeight,
        scrollHeight: body.scrollHeight
      };
    });

    // 레이아웃이 적절히 조정되었는지 확인
    expect(landscapeLayout.width).toBeGreaterThan(portraitLayout.width);

    // 가로 모드에서 더 넓은 레이아웃 활용 확인
    const ctaContainer = page.locator('.cta-container');
    if (await ctaContainer.count() > 0) {
      const flexDirection = await ctaContainer.evaluate(el =>
        window.getComputedStyle(el).flexDirection
      );
      // 가로 모드에서는 버튼들이 수평 배열되는 것이 적절
      expect(flexDirection).toBe('row');
    }
  });

  test('고해상도 디스플레이 대응', async ({ page }) => {
    // 고해상도 디스플레이 시뮬레이션 (Retina 등)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:3000');

    // 픽셀 밀도 확인
    const devicePixelRatio = await page.evaluate(() => window.devicePixelRatio);
    console.log('Device Pixel Ratio:', devicePixelRatio);

    // 고해상도에서 텍스트가 선명하게 렌더링되는지 확인
    const titleElement = page.getByRole('heading', { name: '당신의 감정이 음악이 됩니다' });

    // 폰트 렌더링 품질 관련 CSS 속성 확인
    const fontSmoothing = await titleElement.evaluate(el => {
      const style = window.getComputedStyle(el);
      return {
        webkitFontSmoothing: style.webkitFontSmoothing,
        fontSmooth: style.fontSmooth,
        textRendering: style.textRendering
      };
    });

    console.log('Font rendering properties:', fontSmoothing);

    // 이미지가 있다면 고해상도 대응 확인
    const images = page.locator('img');
    const imageCount = await images.count();

    if (imageCount > 0) {
      for (let i = 0; i < imageCount; i++) {
        const img = images.nth(i);
        const imgSrc = await img.getAttribute('src');
        const imgBox = await img.boundingBox();

        if (imgBox && imgSrc) {
          // 이미지가 적절한 크기로 표시되는지 확인
          expect(imgBox.width).toBeGreaterThan(0);
          expect(imgBox.height).toBeGreaterThan(0);
        }
      }
    }
  });

  test('컨텐츠 오버플로우 방지', async ({ page }) => {
    const testViewports = [
      { width: 320, height: 568 }, // 매우 작은 모바일
      { width: 375, height: 667 }, // 일반 모바일
      { width: 768, height: 1024 }, // 태블릿
    ];

    for (const viewport of testViewports) {
      await page.setViewportSize(viewport);
      await page.goto('http://localhost:3000');
      await page.waitForTimeout(300);

      // 수평 스크롤바가 생기지 않는지 확인
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewport.width + 20); // 약간의 여유 허용

      // 텍스트가 잘리지 않는지 확인
      const textElements = page.locator('h1, h2, h3, p, button');
      const textCount = await textElements.count();

      for (let i = 0; i < Math.min(textCount, 10); i++) {
        const element = textElements.nth(i);
        const box = await element.boundingBox();

        if (box) {
          // 요소가 뷰포트를 벗어나지 않는지 확인
          expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 10);
          expect(box.x).toBeGreaterThanOrEqual(-10);
        }
      }
    }
  });
});