/**
 * VibeMusic Footer Component
 *
 * 감정 기반 AI 음악 생성 서비스의 푸터
 * - 저작권 정보
 * - 개인정보 처리방침 링크
 * - 도움말 및 지원 링크
 * - 반응형 디자인 지원
 */

import React from 'react';
import { colors, fonts, spacing, fontSizes, fontWeights } from '../styles/tokens';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * 링크 정보 타입
 */
export interface FooterLink {
  label: string;
  href?: string;
  onClick?: () => void;
}

/**
 * Footer 컴포넌트 Props
 */
export interface FooterProps {
  /** 저작권 연도 (기본값: 현재 연도) */
  copyrightYear?: number;
  /** 회사/서비스 이름 */
  companyName?: string;
  /** 개인정보 처리방침 링크 */
  onPrivacyClick?: () => void;
  /** 이용약관 링크 */
  onTermsClick?: () => void;
  /** 지원/문의 링크 */
  onSupportClick?: () => void;
  /** 추가 링크들 */
  additionalLinks?: FooterLink[];
  /** 추가 CSS 클래스명 */
  className?: string;
}

// ============================================================================
// Styled Components (CSS-in-JS)
// ============================================================================

const footerStyles: React.CSSProperties = {
  backgroundColor: colors.neutral[50],
  borderTop: `1px solid ${colors.neutral[200]}`,
  padding: `${spacing[8]} ${spacing[6]} ${spacing[6]}`,
  marginTop: 'auto',
};

const containerStyles: React.CSSProperties = {
  maxWidth: '1200px',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[6],
};

const mainContentStyles: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: spacing[8],
  flexWrap: 'wrap',
};

const brandSectionStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[4],
  flex: '1',
  minWidth: '280px',
};

const brandLogoStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing[2],
};

const logoIconStyles: React.CSSProperties = {
  width: '24px',
  height: '24px',
  borderRadius: '6px',
  background: `linear-gradient(135deg, ${colors.primary[500]}, ${colors.primary[700]})`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: colors.neutral[0],
  fontSize: fontSizes.sm,
  fontWeight: fontWeights.bold,
};

const logoTextStyles: React.CSSProperties = {
  fontSize: fontSizes.lg,
  fontWeight: fontWeights.bold,
  fontFamily: fonts.heading,
  color: colors.neutral[900],
};

const descriptionStyles: React.CSSProperties = {
  fontSize: fontSizes.sm,
  color: colors.neutral[600],
  lineHeight: 1.6,
  maxWidth: '320px',
};

const linksSectionStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[3],
  minWidth: '160px',
};

const linksSectionTitleStyles: React.CSSProperties = {
  fontSize: fontSizes.sm,
  fontWeight: fontWeights.semibold,
  color: colors.neutral[900],
  marginBottom: spacing[1],
};

const linkStyles: React.CSSProperties = {
  fontSize: fontSizes.sm,
  color: colors.neutral[600],
  textDecoration: 'none',
  cursor: 'pointer',
  transition: 'color 150ms ease-out',
  padding: `${spacing[1]} 0`,
  border: 'none',
  background: 'none',
  textAlign: 'left',
};

const dividerStyles: React.CSSProperties = {
  height: '1px',
  backgroundColor: colors.neutral[200],
  margin: `${spacing[6]} 0 ${spacing[4]}`,
};

const bottomSectionStyles: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: spacing[4],
};

const copyrightStyles: React.CSSProperties = {
  fontSize: fontSizes.sm,
  color: colors.neutral[500],
};

const socialLinksStyles: React.CSSProperties = {
  display: 'flex',
  gap: spacing[4],
  alignItems: 'center',
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * VibeMusic Footer 컴포넌트
 */
const Footer: React.FC<FooterProps> = ({
  copyrightYear = new Date().getFullYear(),
  companyName = 'VibeMusic',
  onPrivacyClick,
  onTermsClick,
  onSupportClick,
  additionalLinks = [],
  className,
}) => {
  const handleLinkClick = (link: FooterLink) => {
    if (link.onClick) {
      link.onClick();
    } else if (link.href) {
      window.open(link.href, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <>
      {/* CSS 호버 효과 추가 */}
      <style>
        {`
          .footer-link:hover {
            color: ${colors.primary[600]};
          }

          @media (max-width: 768px) {
            .footer-main-content {
              flex-direction: column;
              gap: ${spacing[6]};
            }

            .footer-bottom {
              flex-direction: column;
              text-align: center;
              gap: ${spacing[3]};
            }

            .brand-section {
              min-width: auto;
              text-align: center;
            }

            .links-section {
              min-width: auto;
              align-items: center;
              text-align: center;
            }
          }
        `}
      </style>

      <footer
        className={`footer ${className || ''}`}
        style={footerStyles}
      >
        <div style={containerStyles}>
          {/* 메인 콘텐츠 영역 */}
          <div className="footer-main-content" style={mainContentStyles}>
            {/* 브랜드 섹션 */}
            <div className="brand-section" style={brandSectionStyles}>
              <div style={brandLogoStyles}>
                <div style={logoIconStyles}>
                  🎵
                </div>
                <span style={logoTextStyles}>{companyName}</span>
              </div>
              <p style={descriptionStyles}>
                당신의 타이핑 리듬으로 감정을 읽고,
                <br />
                개인화된 AI 음악을 생성하는 혁신적인 서비스입니다.
              </p>
            </div>

            {/* 지원 링크 섹션 */}
            <div className="links-section" style={linksSectionStyles}>
              <h3 style={linksSectionTitleStyles}>지원</h3>
              <button
                className="footer-link"
                style={linkStyles}
                onClick={onSupportClick}
                aria-label="고객 지원"
              >
                고객 지원
              </button>
              <button
                className="footer-link"
                style={linkStyles}
                onClick={() => window.open('mailto:support@vibemusic.com', '_blank')}
                aria-label="문의하기"
              >
                문의하기
              </button>
              <button
                className="footer-link"
                style={linkStyles}
                onClick={() => window.open('/faq', '_blank')}
                aria-label="자주 묻는 질문"
              >
                자주 묻는 질문
              </button>
            </div>

            {/* 법적 정보 섹션 */}
            <div className="links-section" style={linksSectionStyles}>
              <h3 style={linksSectionTitleStyles}>법적 정보</h3>
              <button
                className="footer-link"
                style={linkStyles}
                onClick={onPrivacyClick}
                aria-label="개인정보 처리방침"
              >
                개인정보 처리방침
              </button>
              <button
                className="footer-link"
                style={linkStyles}
                onClick={onTermsClick}
                aria-label="이용약관"
              >
                이용약관
              </button>
              <button
                className="footer-link"
                style={linkStyles}
                onClick={() => window.open('/security', '_blank')}
                aria-label="보안 정책"
              >
                보안 정책
              </button>
            </div>

            {/* 추가 링크 섹션 */}
            {additionalLinks.length > 0 && (
              <div className="links-section" style={linksSectionStyles}>
                <h3 style={linksSectionTitleStyles}>더 보기</h3>
                {additionalLinks.map((link, index) => (
                  <button
                    key={index}
                    className="footer-link"
                    style={linkStyles}
                    onClick={() => handleLinkClick(link)}
                    aria-label={link.label}
                  >
                    {link.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 구분선 */}
          <div style={dividerStyles} />

          {/* 하단 섹션 */}
          <div className="footer-bottom" style={bottomSectionStyles}>
            <div style={copyrightStyles}>
              © {copyrightYear} {companyName}. All rights reserved.
            </div>

            <div style={socialLinksStyles}>
              <span style={{ fontSize: fontSizes.sm, color: colors.neutral[500] }}>
                Made with 🎵 for music lovers
              </span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};

export default Footer;
export type { FooterProps, FooterLink };