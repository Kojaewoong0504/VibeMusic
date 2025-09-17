/**
 * Design System Validator
 *
 * T093: 디자인 시스템 일관성 검수
 * - 디자인 토큰 일관성 검증
 * - 컴포넌트 스타일 검사
 * - 접근성 가이드라인 준수 확인
 * - 반응형 디자인 패턴 검증
 */
import { colors, fonts, spacing, borderRadius, boxShadow, zIndex, tokens } from '@/styles/tokens';
import { breakpoints, mediaQuery } from '@/styles/breakpoints';

// 검증 규칙 인터페이스
interface ValidationRule {
  name: string;
  description: string;
  category: 'color' | 'typography' | 'spacing' | 'accessibility' | 'responsive';
  severity: 'error' | 'warning' | 'info';
  check: (element: Element) => boolean;
  message: string;
  suggestion?: string;
}

interface ValidationResult {
  passed: boolean;
  issues: ValidationIssue[];
  score: number;
  summary: {
    total: number;
    errors: number;
    warnings: number;
    infos: number;
  };
}

interface ValidationIssue {
  rule: ValidationRule;
  element: Element;
  details: string;
}

export class DesignSystemValidator {
  private rules: ValidationRule[] = [];

  constructor() {
    this.initializeRules();
  }

  private initializeRules(): void {
    // 색상 관련 규칙
    this.rules.push({
      name: 'brand-colors',
      description: '브랜드 색상 토큰 사용 확인',
      category: 'color',
      severity: 'warning',
      check: (element: Element) => {
        const computedStyle = getComputedStyle(element);
        const backgroundColor = computedStyle.backgroundColor;
        const color = computedStyle.color;

        // RGB to HEX 변환 후 브랜드 색상과 비교
        return this.isValidBrandColor(backgroundColor) || this.isValidBrandColor(color);
      },
      message: '브랜드 색상 토큰을 사용하지 않는 요소가 발견되었습니다.',
      suggestion: '디자인 토큰에서 정의된 색상을 사용하세요.'
    });

    this.rules.push({
      name: 'color-contrast',
      description: 'WCAG 색상 대비 규칙 준수',
      category: 'accessibility',
      severity: 'error',
      check: (element: Element) => {
        const computedStyle = getComputedStyle(element);
        const backgroundColor = computedStyle.backgroundColor;
        const color = computedStyle.color;

        return this.checkColorContrast(backgroundColor, color);
      },
      message: '색상 대비가 접근성 기준(WCAG AA: 4.5:1)을 충족하지 않습니다.',
      suggestion: '더 높은 대비의 색상 조합을 사용하세요.'
    });

    // 타이포그래피 규칙
    this.rules.push({
      name: 'font-family',
      description: '정의된 폰트 패밀리 사용 확인',
      category: 'typography',
      severity: 'warning',
      check: (element: Element) => {
        const computedStyle = getComputedStyle(element);
        const fontFamily = computedStyle.fontFamily.toLowerCase();

        return fontFamily.includes('inter') ||
               fontFamily.includes('jetbrains mono') ||
               fontFamily.includes('system');
      },
      message: '정의되지 않은 폰트 패밀리를 사용하고 있습니다.',
      suggestion: '디자인 토큰에서 정의된 fonts.body, fonts.heading, fonts.mono를 사용하세요.'
    });

    this.rules.push({
      name: 'font-size-scale',
      description: '일관된 폰트 크기 스케일 사용',
      category: 'typography',
      severity: 'warning',
      check: (element: Element) => {
        const computedStyle = getComputedStyle(element);
        const fontSize = computedStyle.fontSize;

        return this.isValidFontSize(fontSize);
      },
      message: '정의된 폰트 크기 스케일을 벗어난 크기를 사용하고 있습니다.',
      suggestion: 'fontSizes 토큰에서 정의된 크기를 사용하세요.'
    });

    // 간격 규칙
    this.rules.push({
      name: 'spacing-scale',
      description: '8px 기반 간격 시스템 준수',
      category: 'spacing',
      severity: 'info',
      check: (element: Element) => {
        const computedStyle = getComputedStyle(element);
        const margin = computedStyle.margin;
        const padding = computedStyle.padding;

        return this.isValidSpacing(margin) && this.isValidSpacing(padding);
      },
      message: '8px 기반 간격 시스템을 벗어난 간격을 사용하고 있습니다.',
      suggestion: 'spacing 토큰에서 정의된 간격을 사용하세요.'
    });

    // 접근성 규칙
    this.rules.push({
      name: 'focus-visible',
      description: '포커스 표시 확인',
      category: 'accessibility',
      severity: 'error',
      check: (element: Element) => {
        if (!this.isInteractiveElement(element)) return true;

        const computedStyle = getComputedStyle(element, ':focus');
        const outline = computedStyle.outline;
        const boxShadow = computedStyle.boxShadow;

        return outline !== 'none' || boxShadow !== 'none';
      },
      message: '상호작용 가능한 요소에 포커스 표시가 없습니다.',
      suggestion: ':focus-visible 스타일을 추가하세요.'
    });

    this.rules.push({
      name: 'alt-text',
      description: '이미지 대체 텍스트 확인',
      category: 'accessibility',
      severity: 'error',
      check: (element: Element) => {
        if (element.tagName !== 'IMG') return true;

        const alt = element.getAttribute('alt');
        const role = element.getAttribute('role');

        return alt !== null || role === 'presentation';
      },
      message: '이미지에 alt 속성이 누락되었습니다.',
      suggestion: '의미 있는 alt 텍스트를 추가하거나 장식용 이미지는 role="presentation"을 사용하세요.'
    });

    // 반응형 규칙
    this.rules.push({
      name: 'responsive-text',
      description: '반응형 텍스트 크기 확인',
      category: 'responsive',
      severity: 'info',
      check: (element: Element) => {
        // 중요한 텍스트 요소인지 확인
        const tagName = element.tagName.toLowerCase();
        if (!['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'].includes(tagName)) return true;

        // 미디어 쿼리 사용 여부 확인 (실제 구현에서는 CSS 파싱 필요)
        return this.hasResponsiveTextSize(element);
      },
      message: '텍스트 크기가 반응형으로 조정되지 않습니다.',
      suggestion: '브레이크포인트별로 적절한 텍스트 크기를 지정하세요.'
    });
  }

  /**
   * 전체 페이지 또는 특정 요소의 디자인 시스템 준수도 검증
   */
  public validatePage(rootElement: Element = document.body): ValidationResult {
    const allElements = rootElement.querySelectorAll('*');
    const issues: ValidationIssue[] = [];

    // 모든 요소에 대해 모든 규칙 검증
    allElements.forEach((element) => {
      this.rules.forEach((rule) => {
        if (!rule.check(element)) {
          issues.push({
            rule,
            element,
            details: this.getElementSelector(element)
          });
        }
      });
    });

    // 결과 정리
    const summary = {
      total: issues.length,
      errors: issues.filter(i => i.rule.severity === 'error').length,
      warnings: issues.filter(i => i.rule.severity === 'warning').length,
      infos: issues.filter(i => i.rule.severity === 'info').length,
    };

    // 점수 계산 (100점 만점)
    const errorPenalty = summary.errors * 10;
    const warningPenalty = summary.warnings * 5;
    const infoPenalty = summary.infos * 1;
    const totalPenalty = errorPenalty + warningPenalty + infoPenalty;
    const score = Math.max(0, 100 - totalPenalty);

    return {
      passed: summary.errors === 0,
      issues,
      score,
      summary
    };
  }

  /**
   * 컴포넌트별 검증
   */
  public validateComponent(componentElement: Element): ValidationResult {
    return this.validatePage(componentElement);
  }

  /**
   * 검증 보고서 생성
   */
  public generateReport(result: ValidationResult): string {
    const { score, summary, issues } = result;

    let report = `📊 디자인 시스템 준수도 리포트\n`;
    report += `════════════════════════════════\n\n`;
    report += `🏆 종합 점수: ${score}점/100점\n`;
    report += `📝 총 이슈: ${summary.total}개\n`;
    report += `❌ 오류: ${summary.errors}개\n`;
    report += `⚠️  경고: ${summary.warnings}개\n`;
    report += `ℹ️  정보: ${summary.infos}개\n\n`;

    // 등급 평가
    let grade = 'F';
    if (score >= 90) grade = 'A';
    else if (score >= 80) grade = 'B';
    else if (score >= 70) grade = 'C';
    else if (score >= 60) grade = 'D';

    report += `🎯 등급: ${grade}\n\n`;

    // 카테고리별 이슈 분류
    const categorizedIssues = this.categorizeIssues(issues);

    Object.entries(categorizedIssues).forEach(([category, categoryIssues]) => {
      if (categoryIssues.length === 0) return;

      report += `📂 ${category.toUpperCase()} (${categoryIssues.length}개)\n`;
      report += `─────────────────────────\n`;

      categoryIssues.slice(0, 5).forEach((issue, index) => {
        const icon = issue.rule.severity === 'error' ? '❌' :
                    issue.rule.severity === 'warning' ? '⚠️' : 'ℹ️';

        report += `${icon} ${issue.rule.name}: ${issue.rule.message}\n`;
        report += `   └─ 요소: ${issue.details}\n`;
        if (issue.rule.suggestion) {
          report += `   💡 제안: ${issue.rule.suggestion}\n`;
        }
        report += `\n`;
      });

      if (categoryIssues.length > 5) {
        report += `   ... 및 ${categoryIssues.length - 5}개 더\n\n`;
      }
    });

    // 개선 권장사항
    report += `🚀 개선 권장사항\n`;
    report += `─────────────────\n`;

    if (summary.errors > 0) {
      report += `• 접근성 오류를 우선적으로 해결하세요\n`;
    }
    if (summary.warnings > 0) {
      report += `• 디자인 토큰 사용을 일관되게 적용하세요\n`;
    }
    if (score < 80) {
      report += `• 디자인 시스템 가이드라인을 재검토하세요\n`;
    }

    return report;
  }

  // ========== 유틸리티 메소드 ==========

  private isValidBrandColor(colorValue: string): boolean {
    if (!colorValue || colorValue === 'rgba(0, 0, 0, 0)') return true;

    // RGB/RGBA 색상을 HEX로 변환하여 브랜드 색상과 비교
    const hex = this.rgbToHex(colorValue);
    if (!hex) return false;

    // 브랜드 색상 토큰에 포함되는지 확인
    const brandColors = [
      ...Object.values(colors.primary),
      ...Object.values(colors.neutral),
      ...Object.values(colors.semantic)
    ];

    return brandColors.some(brandColor =>
      this.normalizeColor(brandColor) === this.normalizeColor(hex)
    );
  }

  private checkColorContrast(backgroundColor: string, textColor: string): boolean {
    if (!backgroundColor || !textColor) return true;

    const bgLuminance = this.getLuminance(backgroundColor);
    const textLuminance = this.getLuminance(textColor);

    const contrast = (Math.max(bgLuminance, textLuminance) + 0.05) /
                    (Math.min(bgLuminance, textLuminance) + 0.05);

    return contrast >= 4.5; // WCAG AA 기준
  }

  private isValidFontSize(fontSize: string): boolean {
    const validSizes = Object.values(tokens.fontSizes);
    return validSizes.includes(fontSize);
  }

  private isValidSpacing(spacing: string): boolean {
    if (!spacing || spacing === '0px') return true;

    // 8px 기반인지 확인
    const pxValue = parseFloat(spacing);
    return pxValue % 8 === 0 || pxValue % 4 === 0; // 4px도 허용
  }

  private isInteractiveElement(element: Element): boolean {
    const interactiveTags = ['button', 'a', 'input', 'textarea', 'select'];
    const isInteractiveTag = interactiveTags.includes(element.tagName.toLowerCase());
    const hasClickHandler = element.hasAttribute('onclick') ||
                           element.hasAttribute('role') &&
                           ['button', 'link', 'tab'].includes(element.getAttribute('role')!);

    return isInteractiveTag || hasClickHandler;
  }

  private hasResponsiveTextSize(element: Element): boolean {
    // 실제로는 CSS 파싱이 필요하지만, 간단한 추정
    const computedStyle = getComputedStyle(element);
    const classList = Array.from(element.classList);

    // Tailwind CSS나 반응형 클래스명 패턴 확인
    return classList.some(className =>
      className.includes('sm:') ||
      className.includes('md:') ||
      className.includes('lg:') ||
      className.includes('text-') && (className.includes('sm') || className.includes('md') || className.includes('lg'))
    );
  }

  private getElementSelector(element: Element): string {
    if (element.id) return `#${element.id}`;

    const classList = Array.from(element.classList);
    if (classList.length > 0) {
      return `${element.tagName.toLowerCase()}.${classList[0]}`;
    }

    return element.tagName.toLowerCase();
  }

  private categorizeIssues(issues: ValidationIssue[]): Record<string, ValidationIssue[]> {
    return issues.reduce((acc, issue) => {
      const category = issue.rule.category;
      if (!acc[category]) acc[category] = [];
      acc[category].push(issue);
      return acc;
    }, {} as Record<string, ValidationIssue[]>);
  }

  private rgbToHex(rgb: string): string | null {
    const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return null;

    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);

    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  private normalizeColor(color: string): string {
    return color.toLowerCase().replace(/\s/g, '');
  }

  private getLuminance(color: string): number {
    // 간단한 luminance 계산 (실제로는 더 정확한 계산 필요)
    const hex = this.rgbToHex(color) || color;
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    return 0.299 * r + 0.587 * g + 0.114 * b;
  }
}

// 전역 인스턴스
export const designSystemValidator = new DesignSystemValidator();

// React Hook으로 사용할 수 있는 헬퍼
export function useDesignSystemValidation() {
  const validateCurrentPage = () => {
    return designSystemValidator.validatePage();
  };

  const validateElement = (element: Element) => {
    return designSystemValidator.validateComponent(element);
  };

  const generateReport = (result: ValidationResult) => {
    return designSystemValidator.generateReport(result);
  };

  return {
    validateCurrentPage,
    validateElement,
    generateReport,
    validator: designSystemValidator
  };
}