/**
 * VibeMusic ResultPage Component
 *
 * 감정 기반 AI 음악 생성 서비스의 결과 페이지
 * - 생성된 음악 재생 및 제어
 * - 다운로드 옵션 제공
 * - 새 음악 생성 버튼
 * - 감정 데이터 및 메타데이터 표시
 */

import React, { useState, useCallback } from 'react';
import {
  Header,
  Footer,
  MusicPlayer,
  LoadingSpinner,
  ErrorBoundary,
} from '../components';
import { colors, fonts, spacing, fontSizes, fontWeights, borderRadius, boxShadow } from '../styles/tokens';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * 음악 메타데이터 타입
 */
export interface MusicMetadata {
  id: string;
  title: string;
  duration: number; // seconds
  bpm: number;
  key: string;
  genre: string;
  createdAt: Date;
  fileSize: number; // bytes
}

/**
 * 감정 프로필 타입
 */
export interface EmotionProfile {
  energy: number; // 0-1
  valence: number; // -1 to 1
  tension: number; // 0-1
  focus: number; // 0-1
  dominantEmotion: string;
  emotionScore: number; // 0-1
}

/**
 * 생성 정보 타입
 */
export interface GenerationInfo {
  sessionId: string;
  typingDuration: number; // seconds
  totalKeystrokes: number;
  averageWPM: number;
  generationTime: number; // seconds
  aiModel: string;
  processingSteps: string[];
}

/**
 * 다운로드 옵션 타입
 */
export interface DownloadOptions {
  format: 'mp3' | 'wav' | 'flac';
  quality: 'low' | 'medium' | 'high' | 'lossless';
  includeMetadata: boolean;
}

/**
 * ResultPage Props
 */
export interface ResultPageProps {
  /** 음악 메타데이터 */
  musicMetadata: MusicMetadata;
  /** 감정 프로필 */
  emotionProfile: EmotionProfile;
  /** 생성 정보 */
  generationInfo?: GenerationInfo;
  /** 음악 파일 URL */
  musicUrl: string;
  /** 로딩 상태 */
  isLoading?: boolean;
  /** 다운로드 진행 상태 */
  isDownloading?: boolean;
  /** 새 음악 생성 핸들러 */
  onCreateNewMusic?: () => void;
  /** 다운로드 핸들러 */
  onDownload?: (options: DownloadOptions) => Promise<void>;
  /** 공유 핸들러 */
  onShare?: (platform: string) => void;
  /** 피드백 핸들러 */
  onFeedback?: (rating: number, comment?: string) => void;
  /** 홈으로 이동 핸들러 */
  onGoHome?: () => void;
  /** 추가 CSS 클래스명 */
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 파일 크기를 읽기 쉬운 형태로 변환
 */
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * 감정을 한국어로 변환
 */
const getEmotionLabel = (emotion: string): string => {
  const emotionMap: Record<string, string> = {
    'happy': '기쁨',
    'sad': '슬픔',
    'excited': '흥분',
    'calm': '평온',
    'anxious': '불안',
    'focused': '집중',
    'relaxed': '여유',
    'energetic': '활력',
    'melancholic': '우울',
    'romantic': '낭만적',
  };

  return emotionMap[emotion] || emotion;
};

/**
 * 감정 점수에 따른 색상 반환
 */
const getEmotionColor = (score: number): string => {
  if (score >= 0.8) return colors.semantic.success;
  if (score >= 0.6) return colors.emotion.energy.medium;
  if (score >= 0.4) return colors.emotion.valence.neutral;
  return colors.emotion.tension.relaxed;
};

// ============================================================================
// Styled Components (CSS-in-JS)
// ============================================================================

const pageStyles: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: colors.neutral[25],
};

const mainContentStyles: React.CSSProperties = {
  flex: 1,
  padding: `${spacing[8]} ${spacing[6]}`,
  maxWidth: '1200px',
  margin: '0 auto',
  width: '100%',
};

const resultHeaderStyles: React.CSSProperties = {
  textAlign: 'center',
  marginBottom: spacing[8],
};

const resultTitleStyles: React.CSSProperties = {
  fontSize: fontSizes['3xl'],
  fontWeight: fontWeights.bold,
  fontFamily: fonts.heading,
  color: colors.neutral[900],
  marginBottom: spacing[2],
};

const resultSubtitleStyles: React.CSSProperties = {
  fontSize: fontSizes.lg,
  color: colors.neutral[600],
  marginBottom: spacing[6],
};

const musicCardStyles: React.CSSProperties = {
  backgroundColor: colors.neutral[0],
  borderRadius: borderRadius['2xl'],
  padding: spacing[8],
  boxShadow: boxShadow.lg,
  border: `1px solid ${colors.neutral[100]}`,
  marginBottom: spacing[8],
};

const cardSectionStyles: React.CSSProperties = {
  marginBottom: spacing[6],
};

const cardSectionTitleStyles: React.CSSProperties = {
  fontSize: fontSizes.lg,
  fontWeight: fontWeights.semibold,
  color: colors.neutral[800],
  marginBottom: spacing[3],
  display: 'flex',
  alignItems: 'center',
  gap: spacing[2],
};

const metadataGridStyles: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: spacing[4],
  marginBottom: spacing[6],
};

const metadataItemStyles: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: `${spacing[3]} ${spacing[4]}`,
  backgroundColor: colors.neutral[50],
  borderRadius: borderRadius.md,
  fontSize: fontSizes.sm,
};

const metadataLabelStyles: React.CSSProperties = {
  color: colors.neutral[600],
  fontWeight: fontWeights.medium,
};

const metadataValueStyles: React.CSSProperties = {
  color: colors.neutral[900],
  fontWeight: fontWeights.semibold,
};

const emotionGridStyles: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
  gap: spacing[3],
  marginBottom: spacing[4],
};

const emotionMeterStyles: React.CSSProperties = {
  textAlign: 'center',
  padding: spacing[3],
  backgroundColor: colors.neutral[50],
  borderRadius: borderRadius.md,
};

const emotionMeterLabelStyles: React.CSSProperties = {
  fontSize: fontSizes.xs,
  color: colors.neutral[600],
  marginBottom: spacing[1],
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const emotionMeterValueStyles: React.CSSProperties = {
  fontSize: fontSizes.lg,
  fontWeight: fontWeights.bold,
  marginBottom: spacing[2],
};

const emotionBarStyles: React.CSSProperties = {
  height: '4px',
  backgroundColor: colors.neutral[200],
  borderRadius: '2px',
  overflow: 'hidden',
};

const actionsGridStyles: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: spacing[4],
  marginTop: spacing[8],
};

const actionButtonStyles: React.CSSProperties = {
  padding: `${spacing[4]} ${spacing[6]}`,
  borderRadius: borderRadius.lg,
  fontSize: fontSizes.base,
  fontWeight: fontWeights.semibold,
  cursor: 'pointer',
  transition: 'all 200ms ease-out',
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: spacing[2],
  minHeight: '56px',
};

const primaryButtonStyles: React.CSSProperties = {
  ...actionButtonStyles,
  backgroundColor: colors.primary[500],
  color: colors.neutral[0],
  boxShadow: boxShadow.sm,
};

const secondaryButtonStyles: React.CSSProperties = {
  ...actionButtonStyles,
  backgroundColor: colors.neutral[0],
  color: colors.neutral[700],
  border: `2px solid ${colors.neutral[300]}`,
};

const dangerButtonStyles: React.CSSProperties = {
  ...actionButtonStyles,
  backgroundColor: colors.semantic.error,
  color: colors.neutral[0],
  boxShadow: boxShadow.sm,
};

const downloadMenuStyles: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  backgroundColor: colors.neutral[0],
  borderRadius: borderRadius.md,
  boxShadow: boxShadow.lg,
  border: `1px solid ${colors.neutral[200]}`,
  padding: spacing[2],
  zIndex: 10,
  marginTop: spacing[1],
};

const downloadOptionStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${spacing[2]} ${spacing[3]}`,
  borderRadius: borderRadius.sm,
  cursor: 'pointer',
  fontSize: fontSizes.sm,
  transition: 'background-color 150ms ease-out',
};

// ============================================================================
// Sub Components
// ============================================================================

/**
 * 감정 미터 컴포넌트
 */
const EmotionMeter: React.FC<{
  label: string;
  value: number;
  color: string;
}> = ({ label, value, color }) => {
  const percentage = Math.abs(value) * 100;

  return (
    <div style={emotionMeterStyles}>
      <div style={emotionMeterLabelStyles}>{label}</div>
      <div style={{ ...emotionMeterValueStyles, color }}>
        {Math.round(percentage)}%
      </div>
      <div style={emotionBarStyles}>
        <div
          style={{
            width: `${percentage}%`,
            height: '100%',
            backgroundColor: color,
            transition: 'width 300ms ease-out',
          }}
        />
      </div>
    </div>
  );
};

/**
 * 다운로드 메뉴 컴포넌트
 */
const DownloadMenu: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onDownload: (options: DownloadOptions) => void;
  isDownloading: boolean;
}> = ({ isOpen, onClose, onDownload, isDownloading }) => {
  if (!isOpen) return null;

  const downloadOptions: Array<{
    label: string;
    format: DownloadOptions['format'];
    quality: DownloadOptions['quality'];
    description: string;
  }> = [
    { label: 'MP3 고음질', format: 'mp3', quality: 'high', description: '320kbps, 작은 파일 크기' },
    { label: 'WAV 무손실', format: 'wav', quality: 'lossless', description: '원본 품질, 큰 파일 크기' },
    { label: 'FLAC 무손실', format: 'flac', quality: 'lossless', description: '압축된 무손실, 중간 크기' },
  ];

  return (
    <div style={downloadMenuStyles}>
      {downloadOptions.map((option, index) => (
        <div
          key={index}
          style={downloadOptionStyles}
          onClick={() => {
            if (!isDownloading) {
              onDownload({
                format: option.format,
                quality: option.quality,
                includeMetadata: true,
              });
              onClose();
            }
          }}
          onMouseEnter={(e) => {
            if (!isDownloading) {
              (e.target as HTMLElement).style.backgroundColor = colors.neutral[50];
            }
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.backgroundColor = 'transparent';
          }}
        >
          <div>
            <div style={{ fontWeight: fontWeights.medium }}>{option.label}</div>
            <div style={{ fontSize: fontSizes.xs, color: colors.neutral[500] }}>
              {option.description}
            </div>
          </div>
          {isDownloading && <LoadingSpinner size="sm" />}
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * VibeMusic ResultPage 컴포넌트
 */
const ResultPage: React.FC<ResultPageProps> = ({
  musicMetadata,
  emotionProfile,
  generationInfo,
  musicUrl,
  isLoading = false,
  isDownloading = false,
  onCreateNewMusic,
  onDownload,
  onShare,
  onFeedback,
  onGoHome,
  className,
}) => {
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [rating, setRating] = useState(0);

  const handleDownload = useCallback(async (options: DownloadOptions) => {
    if (onDownload) {
      try {
        await onDownload(options);
      } catch (error) {
        console.error('Download failed:', error);
        alert('다운로드에 실패했습니다. 다시 시도해 주세요.');
      }
    }
  }, [onDownload]);

  const handleShare = useCallback((platform: string) => {
    if (onShare) {
      onShare(platform);
    }
  }, [onShare]);

  // 로딩 중일 때
  if (isLoading) {
    return (
      <div style={pageStyles}>
        <LoadingSpinner
          size="lg"
          variant="music"
          message="결과를 불러오고 있어요..."
          overlay
        />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      {/* CSS 스타일 */}
      <style>
        {`
          .primary-button:hover:not(:disabled) {
            background-color: ${colors.primary[600]};
            transform: translateY(-1px);
            box-shadow: ${boxShadow.md};
          }

          .secondary-button:hover:not(:disabled) {
            background-color: ${colors.neutral[50]};
            border-color: ${colors.primary[300]};
            color: ${colors.primary[600]};
          }

          .danger-button:hover:not(:disabled) {
            background-color: ${colors.semantic.error};
            transform: translateY(-1px);
          }

          .disabled-button {
            opacity: 0.6;
            cursor: not-allowed;
          }

          @media (max-width: 768px) {
            .main-content {
              padding: ${spacing[4]};
            }

            .music-card {
              padding: ${spacing[6]};
            }

            .actions-grid {
              grid-template-columns: 1fr;
            }

            .metadata-grid {
              grid-template-columns: 1fr;
            }

            .emotion-grid {
              grid-template-columns: repeat(2, 1fr);
            }
          }

          @media (max-width: 480px) {
            .result-title {
              font-size: ${fontSizes['2xl']};
            }

            .emotion-grid {
              grid-template-columns: 1fr;
            }
          }
        `}
      </style>

      <div className={`result-page ${className || ''}`} style={pageStyles}>
        {/* Header */}
        <Header onGoHome={onGoHome} />

        {/* Main Content */}
        <div className="main-content" style={mainContentStyles}>
          {/* Result Header */}
          <div style={resultHeaderStyles}>
            <h1 className="result-title" style={resultTitleStyles}>
              🎵 음악이 완성되었어요!
            </h1>
            <p style={resultSubtitleStyles}>
              당신의 감정에서 태어난 특별한 음악을 감상해보세요
            </p>
          </div>

          {/* Music Card */}
          <div className="music-card" style={musicCardStyles}>
            {/* Music Player Section */}
            <div style={cardSectionStyles}>
              <div style={cardSectionTitleStyles}>
                <span>🎧</span>
                음악 재생
              </div>
              <MusicPlayer
                title={musicMetadata.title}
                src={musicUrl}
                duration={musicMetadata.duration}
                autoPlay={false}
                showPlaylist={false}
              />
            </div>

            {/* Music Metadata Section */}
            <div style={cardSectionStyles}>
              <div style={cardSectionTitleStyles}>
                <span>📊</span>
                음악 정보
              </div>
              <div className="metadata-grid" style={metadataGridStyles}>
                <div style={metadataItemStyles}>
                  <span style={metadataLabelStyles}>제목</span>
                  <span style={metadataValueStyles}>{musicMetadata.title}</span>
                </div>
                <div style={metadataItemStyles}>
                  <span style={metadataLabelStyles}>길이</span>
                  <span style={metadataValueStyles}>
                    {Math.floor(musicMetadata.duration / 60)}:{String(musicMetadata.duration % 60).padStart(2, '0')}
                  </span>
                </div>
                <div style={metadataItemStyles}>
                  <span style={metadataLabelStyles}>BPM</span>
                  <span style={metadataValueStyles}>{musicMetadata.bpm}</span>
                </div>
                <div style={metadataItemStyles}>
                  <span style={metadataLabelStyles}>조성</span>
                  <span style={metadataValueStyles}>{musicMetadata.key}</span>
                </div>
                <div style={metadataItemStyles}>
                  <span style={metadataLabelStyles}>장르</span>
                  <span style={metadataValueStyles}>{musicMetadata.genre}</span>
                </div>
                <div style={metadataItemStyles}>
                  <span style={metadataLabelStyles}>크기</span>
                  <span style={metadataValueStyles}>{formatFileSize(musicMetadata.fileSize)}</span>
                </div>
              </div>
            </div>

            {/* Emotion Profile Section */}
            <div style={cardSectionStyles}>
              <div style={cardSectionTitleStyles}>
                <span>🎭</span>
                감정 프로필
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing[4],
                  marginBottom: spacing[4],
                  padding: spacing[4],
                  backgroundColor: colors.neutral[50],
                  borderRadius: borderRadius.md,
                }}
              >
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    backgroundColor: getEmotionColor(emotionProfile.emotionScore),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: fontSizes.xl,
                    fontWeight: fontWeights.bold,
                    color: colors.neutral[0],
                  }}
                >
                  {Math.round(emotionProfile.emotionScore * 100)}%
                </div>
                <div>
                  <div style={{ fontSize: fontSizes.lg, fontWeight: fontWeights.semibold, marginBottom: spacing[1] }}>
                    주요 감정: {getEmotionLabel(emotionProfile.dominantEmotion)}
                  </div>
                  <div style={{ fontSize: fontSizes.sm, color: colors.neutral[600] }}>
                    감정 일치도 {Math.round(emotionProfile.emotionScore * 100)}%로 분석되었습니다
                  </div>
                </div>
              </div>

              <div className="emotion-grid" style={emotionGridStyles}>
                <EmotionMeter
                  label="에너지"
                  value={emotionProfile.energy}
                  color={colors.emotion.energy.high}
                />
                <EmotionMeter
                  label="감정 극성"
                  value={emotionProfile.valence}
                  color={emotionProfile.valence > 0 ? colors.emotion.valence.positive : colors.emotion.valence.negative}
                />
                <EmotionMeter
                  label="긴장도"
                  value={emotionProfile.tension}
                  color={colors.emotion.tension.tense}
                />
                <EmotionMeter
                  label="집중도"
                  value={emotionProfile.focus}
                  color={colors.emotion.focus.focused}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="actions-grid" style={actionsGridStyles}>
            <button
              className="primary-button"
              style={primaryButtonStyles}
              onClick={onCreateNewMusic}
              aria-label="새 음악 생성하기"
            >
              <span>🎼</span>
              새 음악 생성
            </button>

            <div style={{ position: 'relative' }}>
              <button
                className={`secondary-button ${isDownloading ? 'disabled-button' : ''}`}
                style={secondaryButtonStyles}
                onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                disabled={isDownloading}
                aria-label="음악 다운로드"
              >
                <span>⬇️</span>
                {isDownloading ? '다운로드 중...' : '다운로드'}
              </button>
              <DownloadMenu
                isOpen={showDownloadMenu}
                onClose={() => setShowDownloadMenu(false)}
                onDownload={handleDownload}
                isDownloading={isDownloading}
              />
            </div>

            <button
              className="secondary-button"
              style={secondaryButtonStyles}
              onClick={() => handleShare('general')}
              aria-label="음악 공유하기"
            >
              <span>📤</span>
              공유하기
            </button>

            <button
              className="secondary-button"
              style={secondaryButtonStyles}
              onClick={onGoHome}
              aria-label="홈으로 이동"
            >
              <span>🏠</span>
              홈으로
            </button>
          </div>
        </div>

        {/* Footer */}
        <Footer />
      </div>
    </ErrorBoundary>
  );
};

export default ResultPage;
export type { ResultPageProps, MusicMetadata, EmotionProfile, GenerationInfo, DownloadOptions };