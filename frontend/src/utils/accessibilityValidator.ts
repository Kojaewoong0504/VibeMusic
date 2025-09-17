/**
 * Accessibility Validator
 *
 * T094: 접근성 최종 검증 (스크린 리더, 키보드 네비게이션)
 * - WCAG 2.1 AA 준수 검증
 * - 키보드 네비게이션 테스트
 * - 스크린 리더 호환성 확인
 * - 색상 대비 및 텍스트 가독성 검증
 */

interface AccessibilityRule {
  id: string;
  name: string;
  description: string;
  level: 'A' | 'AA' | 'AAA';
  guideline: string;
  check: (element?: Element) => Promise<AccessibilityCheck[]>;
}

interface AccessibilityCheck {
  passed: boolean;
  element?: Element;
  selector?: string;
  message: string;
  suggestion?: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
}

interface AccessibilityReport {
  timestamp: Date;
  totalChecks: number;
  passed: number;
  failed: number;
  score: number;
  level: 'A' | 'AA' | 'AAA' | 'FAIL';
  checks: AccessibilityCheck[];
  summary: {
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
}

export class AccessibilityValidator {
  private rules: AccessibilityRule[] = [];

  constructor() {
    this.initializeRules();
  }

  private initializeRules(): void {
    // 1.1 텍스트 대안
    this.rules.push({
      id: '1.1.1',
      name: '비텍스트 콘텐츠',
      description: '모든 이미지에는 적절한 대체 텍스트가 있어야 합니다',
      level: 'A',
      guideline: '인식 가능',
      check: async () => {
        const images = document.querySelectorAll('img, svg, canvas');
        const checks: AccessibilityCheck[] = [];

        images.forEach((img) => {
          const alt = img.getAttribute('alt');
          const role = img.getAttribute('role');
          const ariaLabel = img.getAttribute('aria-label');
          const ariaLabelledby = img.getAttribute('aria-labelledby');

          const hasAlternative = alt !== null ||
                                role === 'presentation' ||
                                role === 'img' && (ariaLabel || ariaLabelledby);

          checks.push({
            passed: hasAlternative,
            element: img,
            selector: this.getSelector(img),
            message: hasAlternative ?
              '이미지에 적절한 대체 텍스트가 있습니다' :
              '이미지에 대체 텍스트가 누락되었습니다',
            suggestion: hasAlternative ? undefined :
              'alt 속성을 추가하거나 장식용 이미지는 alt="" 또는 role="presentation"을 사용하세요',
            impact: 'critical'
          });
        });

        return checks;
      }
    });

    // 1.4 구별 가능
    this.rules.push({
      id: '1.4.3',
      name: '색상 대비 (최소)',
      description: '텍스트와 배경 간 색상 대비는 최소 4.5:1이어야 합니다',
      level: 'AA',
      guideline: '인식 가능',
      check: async () => {
        const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, a, button, label, input, textarea');
        const checks: AccessibilityCheck[] = [];

        textElements.forEach((element) => {
          const computedStyle = getComputedStyle(element);
          const color = computedStyle.color;
          const backgroundColor = computedStyle.backgroundColor;

          // 투명한 배경인 경우 부모 요소에서 배경색 찾기
          const effectiveBgColor = this.getEffectiveBackgroundColor(element);

          const contrast = this.calculateContrast(color, effectiveBgColor);
          const fontSize = parseFloat(computedStyle.fontSize);
          const fontWeight = parseInt(computedStyle.fontWeight);

          // 큰 텍스트(18pt 이상 또는 14pt Bold)는 3:1, 일반 텍스트는 4.5:1
          const isLargeText = fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700);
          const requiredContrast = isLargeText ? 3 : 4.5;

          const passed = contrast >= requiredContrast;

          checks.push({
            passed,
            element,
            selector: this.getSelector(element),
            message: passed ?
              `색상 대비가 충분합니다 (${contrast.toFixed(2)}:1)` :
              `색상 대비가 부족합니다 (${contrast.toFixed(2)}:1, 필요: ${requiredContrast}:1)`,
            suggestion: passed ? undefined :
              '텍스트와 배경색의 대비를 높이세요',
            impact: 'serious'
          });
        });

        return checks;
      }
    });

    // 2.1 키보드 접근 가능
    this.rules.push({
      id: '2.1.1',
      name: '키보드',
      description: '모든 기능이 키보드로 접근 가능해야 합니다',
      level: 'A',
      guideline: '조작 가능',
      check: async () => {
        const interactiveElements = document.querySelectorAll(
          'a, button, input, textarea, select, [tabindex], [role="button"], [role="link"], [role="tab"], [role="menuitem"]'
        );
        const checks: AccessibilityCheck[] = [];

        interactiveElements.forEach((element) => {
          const tabindex = element.getAttribute('tabindex');
          const isKeyboardAccessible = tabindex !== '-1' &&
            (element.tagName.toLowerCase() !== 'div' || element.hasAttribute('tabindex'));

          // onclick 핸들러가 있지만 키보드 이벤트 핸들러가 없는 요소 확인
          const hasClickHandler = element.hasAttribute('onclick') ||
            element.addEventListener !== undefined;
          const hasKeyboardHandler = element.hasAttribute('onkeydown') ||
            element.hasAttribute('onkeypress') ||
            element.hasAttribute('onkeyup');

          const needsKeyboardHandler = hasClickHandler &&
            !['button', 'a', 'input', 'textarea', 'select'].includes(element.tagName.toLowerCase()) &&
            !hasKeyboardHandler;

          checks.push({
            passed: isKeyboardAccessible && !needsKeyboardHandler,
            element,
            selector: this.getSelector(element),
            message: isKeyboardAccessible && !needsKeyboardHandler ?
              '키보드로 접근 가능합니다' :
              '키보드로 접근할 수 없습니다',
            suggestion: isKeyboardAccessible && !needsKeyboardHandler ? undefined :
              'tabindex="0"을 추가하고 키보드 이벤트 핸들러를 구현하세요',
            impact: 'critical'
          });
        });

        return checks;
      }
    });

    // 2.4 탐색 가능
    this.rules.push({
      id: '2.4.1',
      name: '블록 건너뛰기',
      description: '반복되는 콘텐츠를 건너뛸 수 있는 메커니즘이 있어야 합니다',
      level: 'A',
      guideline: '조작 가능',
      check: async () => {
        const skipLinks = document.querySelectorAll('a[href^="#"]:first-child, [role="banner"] + a[href^="#"]');
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        const landmarks = document.querySelectorAll('[role="main"], main, [role="navigation"], nav');

        const hasSkipLink = skipLinks.length > 0;
        const hasHeadingStructure = headings.length > 0;
        const hasLandmarks = landmarks.length > 0;

        const passed = hasSkipLink || hasHeadingStructure || hasLandmarks;

        return [{
          passed,
          message: passed ?
            '콘텐츠 건너뛰기 메커니즘이 제공됩니다' :
            '콘텐츠를 건너뛸 수 있는 메커니즘이 없습니다',
          suggestion: passed ? undefined :
            '건너뛰기 링크, 제목 구조 또는 랜드마크 역할을 추가하세요',
          impact: 'serious'
        }];
      }
    });

    // 2.4.3 포커스 순서
    this.rules.push({
      id: '2.4.3',
      name: '포커스 순서',
      description: '포커스 순서는 의미와 조작에 맞게 논리적이어야 합니다',
      level: 'A',
      guideline: '조작 가능',
      check: async () => {
        const focusableElements = document.querySelectorAll(
          'a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
        );
        const checks: AccessibilityCheck[] = [];

        let previousElement: Element | null = null;
        focusableElements.forEach((element, index) => {
          if (previousElement) {
            const prevRect = previousElement.getBoundingClientRect();
            const currRect = element.getBoundingClientRect();

            // 시각적 순서와 탭 순서가 크게 다른지 확인
            const visuallyBefore = prevRect.top < currRect.top ||
              (prevRect.top === currRect.top && prevRect.left < currRect.left);

            const tabindex = parseInt(element.getAttribute('tabindex') || '0');
            const prevTabindex = parseInt(previousElement.getAttribute('tabindex') || '0');

            const logicalOrder = tabindex === 0 || tabindex > prevTabindex;

            checks.push({
              passed: visuallyBefore === logicalOrder,
              element,
              selector: this.getSelector(element),
              message: visuallyBefore === logicalOrder ?
                '포커스 순서가 논리적입니다' :
                '포커스 순서가 시각적 순서와 일치하지 않습니다',
              suggestion: visuallyBefore === logicalOrder ? undefined :
                'tabindex 속성을 조정하거나 DOM 순서를 변경하세요',
              impact: 'moderate'
            });
          }
          previousElement = element;
        });

        return checks;
      }
    });

    // 3.1 읽기 가능
    this.rules.push({
      id: '3.1.1',
      name: '페이지 언어',
      description: '웹페이지의 기본 언어가 식별되어야 합니다',
      level: 'A',
      guideline: '이해 가능',
      check: async () => {
        const html = document.documentElement;
        const lang = html.getAttribute('lang');

        const passed = lang !== null && lang.trim() !== '';

        return [{
          passed,
          element: html,
          selector: 'html',
          message: passed ?
            `페이지 언어가 설정되었습니다 (${lang})` :
            '페이지 언어가 설정되지 않았습니다',
          suggestion: passed ? undefined :
            '<html> 태그에 lang="ko" 속성을 추가하세요',
          impact: 'serious'
        }];
      }
    });

    // 4.1 파싱 가능
    this.rules.push({
      id: '4.1.1',
      name: '파싱',
      description: 'HTML 코드에 문법 오류가 없어야 합니다',
      level: 'A',
      guideline: '견고성',
      check: async () => {
        const checks: AccessibilityCheck[] = [];

        // ID 중복 검사
        const elementsWithId = document.querySelectorAll('[id]');
        const ids = new Set<string>();
        const duplicateIds = new Set<string>();

        elementsWithId.forEach((element) => {
          const id = element.getAttribute('id')!;
          if (ids.has(id)) {
            duplicateIds.add(id);
          }
          ids.add(id);
        });

        duplicateIds.forEach((id) => {
          const elements = document.querySelectorAll(`[id="${id}"]`);
          elements.forEach((element) => {
            checks.push({
              passed: false,
              element,
              selector: this.getSelector(element),
              message: `중복된 ID가 발견되었습니다: ${id}`,
              suggestion: '각 ID는 페이지에서 고유해야 합니다',
              impact: 'serious'
            });
          });
        });

        if (checks.length === 0) {
          checks.push({
            passed: true,
            message: 'ID 중복이 없습니다',
            impact: 'minor'
          });
        }

        return checks;
      }
    });

    // ARIA 레이블 규칙
    this.rules.push({
      id: '4.1.2',
      name: '이름, 역할, 값',
      description: '사용자 인터페이스 구성요소의 이름과 역할이 식별되어야 합니다',
      level: 'A',
      guideline: '견고성',
      check: async () => {
        const interactiveElements = document.querySelectorAll(
          'button, input, textarea, select, a, [role="button"], [role="link"], [role="tab"], [role="menuitem"]'
        );
        const checks: AccessibilityCheck[] = [];

        interactiveElements.forEach((element) => {
          const tagName = element.tagName.toLowerCase();
          const role = element.getAttribute('role');
          const ariaLabel = element.getAttribute('aria-label');
          const ariaLabelledby = element.getAttribute('aria-labelledby');
          const ariaDescribedby = element.getAttribute('aria-describedby');

          // 요소의 접근 가능한 이름 확인
          let hasAccessibleName = false;

          if (tagName === 'button' || role === 'button') {
            hasAccessibleName = !!(
              ariaLabel ||
              ariaLabelledby ||
              element.textContent?.trim() ||
              element.querySelector('img')?.getAttribute('alt')
            );
          } else if (tagName === 'input') {
            const type = element.getAttribute('type') || 'text';
            const label = document.querySelector(`label[for="${element.id}"]`);
            const placeholder = element.getAttribute('placeholder');

            hasAccessibleName = !!(
              ariaLabel ||
              ariaLabelledby ||
              label ||
              (type === 'submit' && element.getAttribute('value')) ||
              (type === 'image' && element.getAttribute('alt')) ||
              placeholder
            );
          } else if (tagName === 'a' || role === 'link') {
            hasAccessibleName = !!(
              ariaLabel ||
              ariaLabelledby ||
              element.textContent?.trim() ||
              element.querySelector('img')?.getAttribute('alt')
            );
          }

          checks.push({
            passed: hasAccessibleName,
            element,
            selector: this.getSelector(element),
            message: hasAccessibleName ?
              '접근 가능한 이름이 있습니다' :
              '접근 가능한 이름이 없습니다',
            suggestion: hasAccessibleName ? undefined :
              'aria-label, 텍스트 콘텐츠, 또는 연결된 레이블을 추가하세요',
            impact: 'critical'
          });
        });

        return checks;
      }
    });
  }

  /**
   * 전체 접근성 검증 실행
   */
  public async validate(): Promise<AccessibilityReport> {
    const allChecks: AccessibilityCheck[] = [];

    // 모든 규칙 실행
    for (const rule of this.rules) {
      try {
        const ruleChecks = await rule.check();
        allChecks.push(...ruleChecks);
      } catch (error) {
        console.error(`접근성 규칙 ${rule.id} 실행 중 오류:`, error);
      }
    }

    // 통계 계산
    const passed = allChecks.filter(check => check.passed).length;
    const failed = allChecks.length - passed;
    const score = allChecks.length > 0 ? Math.round((passed / allChecks.length) * 100) : 0;

    // 심각도별 분류
    const summary = {
      critical: allChecks.filter(check => !check.passed && check.impact === 'critical').length,
      serious: allChecks.filter(check => !check.passed && check.impact === 'serious').length,
      moderate: allChecks.filter(check => !check.passed && check.impact === 'moderate').length,
      minor: allChecks.filter(check => !check.passed && check.impact === 'minor').length,
    };

    // 접근성 수준 결정
    let level: 'A' | 'AA' | 'AAA' | 'FAIL' = 'FAIL';
    if (summary.critical === 0) {
      if (summary.serious === 0) {
        if (summary.moderate === 0) {
          level = 'AAA';
        } else {
          level = 'AA';
        }
      } else {
        level = 'A';
      }
    }

    return {
      timestamp: new Date(),
      totalChecks: allChecks.length,
      passed,
      failed,
      score,
      level,
      checks: allChecks,
      summary
    };
  }

  /**
   * 키보드 내비게이션 테스트
   */
  public async testKeyboardNavigation(): Promise<{passed: boolean, issues: string[]}> {
    const issues: string[] = [];

    // 1. 모든 interactive 요소가 키보드로 접근 가능한지 확인
    const focusableElements = document.querySelectorAll(
      'a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) {
      issues.push('포커스 가능한 요소가 없습니다');
    }

    // 2. 포커스 표시 확인
    const elementsWithoutFocusStyle = Array.from(focusableElements).filter(element => {
      const styles = getComputedStyle(element, ':focus');
      return styles.outline === 'none' && styles.boxShadow === 'none';
    });

    if (elementsWithoutFocusStyle.length > 0) {
      issues.push(`${elementsWithoutFocusStyle.length}개 요소에 포커스 표시가 없습니다`);
    }

    // 3. 논리적 탭 순서 확인
    const tabIndexIssues = this.validateTabOrder();
    if (tabIndexIssues.length > 0) {
      issues.push(...tabIndexIssues);
    }

    return {
      passed: issues.length === 0,
      issues
    };
  }

  /**
   * 스크린 리더 호환성 확인
   */
  public checkScreenReaderCompatibility(): {passed: boolean, issues: string[]} {
    const issues: string[] = [];

    // 1. ARIA 레이블 확인
    const unlabeledInteractive = document.querySelectorAll(
      'button:not([aria-label]):not([aria-labelledby]):empty, ' +
      'input:not([aria-label]):not([aria-labelledby]):not([placeholder]), ' +
      'a:not([aria-label]):not([aria-labelledby]):empty'
    );

    if (unlabeledInteractive.length > 0) {
      issues.push(`${unlabeledInteractive.length}개의 레이블 없는 interactive 요소가 있습니다`);
    }

    // 2. 제목 구조 확인
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    if (headings.length === 0) {
      issues.push('제목 구조가 없습니다');
    }

    // 3. 랜드마크 확인
    const landmarks = document.querySelectorAll(
      'main, [role="main"], nav, [role="navigation"], aside, [role="complementary"], ' +
      'header, [role="banner"], footer, [role="contentinfo"]'
    );

    if (landmarks.length === 0) {
      issues.push('페이지 랜드마크가 없습니다');
    }

    return {
      passed: issues.length === 0,
      issues
    };
  }

  /**
   * 접근성 리포트 생성
   */
  public generateReport(report: AccessibilityReport): string {
    const { score, level, summary, checks } = report;

    let output = `♿ 접근성 검증 리포트\n`;
    output += `═══════════════════════════\n\n`;
    output += `🏆 접근성 점수: ${score}점/100점\n`;
    output += `📊 접근성 수준: ${level}\n`;
    output += `✅ 통과: ${report.passed}개\n`;
    output += `❌ 실패: ${report.failed}개\n\n`;

    // 심각도별 이슈
    output += `🚨 심각도별 이슈 분포\n`;
    output += `──────────────────────\n`;
    output += `🔴 Critical: ${summary.critical}개\n`;
    output += `🟡 Serious: ${summary.serious}개\n`;
    output += `🟠 Moderate: ${summary.moderate}개\n`;
    output += `🔵 Minor: ${summary.minor}개\n\n`;

    // 실패한 검사들만 표시
    const failedChecks = checks.filter(check => !check.passed);

    if (failedChecks.length > 0) {
      output += `❌ 실패한 검사 항목\n`;
      output += `──────────────────\n`;

      // Critical부터 표시
      ['critical', 'serious', 'moderate', 'minor'].forEach(impact => {
        const impactChecks = failedChecks.filter(check => check.impact === impact);
        if (impactChecks.length === 0) return;

        const icon = {
          critical: '🔴',
          serious: '🟡',
          moderate: '🟠',
          minor: '🔵'
        }[impact];

        output += `\n${icon} ${impact.toUpperCase()} (${impactChecks.length}개)\n`;

        impactChecks.slice(0, 5).forEach(check => {
          output += `• ${check.message}\n`;
          if (check.selector) {
            output += `  └─ 요소: ${check.selector}\n`;
          }
          if (check.suggestion) {
            output += `  💡 제안: ${check.suggestion}\n`;
          }
        });

        if (impactChecks.length > 5) {
          output += `  ... 및 ${impactChecks.length - 5}개 더\n`;
        }
      });
    }

    // 개선 권장사항
    output += `\n🚀 개선 권장사항\n`;
    output += `─────────────────\n`;

    if (summary.critical > 0) {
      output += `• Critical 이슈를 우선적으로 해결하세요\n`;
    }
    if (summary.serious > 0) {
      output += `• 색상 대비와 키보드 접근성을 점검하세요\n`;
    }
    if (level === 'FAIL') {
      output += `• WCAG 기본 가이드라인부터 준수하세요\n`;
    }
    if (score < 80) {
      output += `• 접근성 전문가의 검토를 받아보세요\n`;
    }

    return output;
  }

  // ========== 유틸리티 메소드 ==========

  private getSelector(element: Element): string {
    if (element.id) return `#${element.id}`;

    const classes = Array.from(element.classList);
    if (classes.length > 0) {
      return `${element.tagName.toLowerCase()}.${classes[0]}`;
    }

    return element.tagName.toLowerCase();
  }

  private getEffectiveBackgroundColor(element: Element): string {
    let currentElement: Element | null = element;

    while (currentElement) {
      const computedStyle = getComputedStyle(currentElement);
      const backgroundColor = computedStyle.backgroundColor;

      // rgba(0, 0, 0, 0)이 아닌 배경색이 있으면 반환
      if (backgroundColor && backgroundColor !== 'rgba(0, 0, 0, 0)' && backgroundColor !== 'transparent') {
        return backgroundColor;
      }

      currentElement = currentElement.parentElement;
    }

    // 기본값으로 흰색 반환
    return 'rgb(255, 255, 255)';
  }

  private calculateContrast(color1: string, color2: string): number {
    const luminance1 = this.getLuminance(color1);
    const luminance2 = this.getLuminance(color2);

    const brightest = Math.max(luminance1, luminance2);
    const darkest = Math.min(luminance1, luminance2);

    return (brightest + 0.05) / (darkest + 0.05);
  }

  private getLuminance(color: string): number {
    const rgb = this.parseColor(color);
    if (!rgb) return 0;

    const [r, g, b] = rgb.map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  private parseColor(color: string): [number, number, number] | null {
    // rgb(r, g, b) 형식 파싱
    const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      return [parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3])];
    }

    // hex 형식 파싱
    const hexMatch = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hexMatch) {
      const hex = hexMatch[1];
      if (hex.length === 3) {
        return [
          parseInt(hex[0] + hex[0], 16),
          parseInt(hex[1] + hex[1], 16),
          parseInt(hex[2] + hex[2], 16)
        ];
      } else {
        return [
          parseInt(hex.slice(0, 2), 16),
          parseInt(hex.slice(2, 4), 16),
          parseInt(hex.slice(4, 6), 16)
        ];
      }
    }

    return null;
  }

  private validateTabOrder(): string[] {
    const issues: string[] = [];
    const focusableElements = Array.from(document.querySelectorAll(
      'a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
    ));

    // tabindex 값 확인
    const customTabIndexElements = focusableElements.filter(el => {
      const tabindex = el.getAttribute('tabindex');
      return tabindex && parseInt(tabindex) > 0;
    });

    if (customTabIndexElements.length > 0) {
      issues.push(`${customTabIndexElements.length}개 요소에서 양수 tabindex를 사용하고 있습니다 (권장하지 않음)`);
    }

    return issues;
  }
}

// 전역 인스턴스
export const accessibilityValidator = new AccessibilityValidator();

// React Hook
export function useAccessibilityValidation() {
  const validatePage = async () => {
    return await accessibilityValidator.validate();
  };

  const testKeyboard = async () => {
    return await accessibilityValidator.testKeyboardNavigation();
  };

  const testScreenReader = () => {
    return accessibilityValidator.checkScreenReaderCompatibility();
  };

  const generateReport = (report: AccessibilityReport) => {
    return accessibilityValidator.generateReport(report);
  };

  return {
    validatePage,
    testKeyboard,
    testScreenReader,
    generateReport,
    validator: accessibilityValidator
  };
}