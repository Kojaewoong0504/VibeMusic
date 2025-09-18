/**
 * VibeMusic MusicGenerationPage Component
 *
 * 감정 기반 AI 음악 생성 서비스의 핵심 기능 페이지
 * - TypingInterface와 EmotionVisualizer 통합
 * - 실시간 상태 업데이트
 * - 음악 생성 결과 표시
 * - 반응형 레이아웃
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Header,
  TypingInterface,
  EmotionVisualizer,
  SessionStatus,
  GenerationProgress,
  LoadingSpinner,
  ErrorBoundary,
  MusicPlayer,
} from '../components';
import { useMusicAPI } from '../hooks/useMusicAPI';
import { colors, fonts, spacing, fontSizes, fontWeights, borderRadius, boxShadow } from '../styles/tokens';
import {
  responsiveSpacing,
  responsiveTypography,
  touchOptimization,
  mediaQuery,
  responsiveLayout
} from '../styles/responsive';
import { useResponsive, useMobileDetection } from '../hooks/useResponsive';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * 세션 상태 타입
 */
export type SessionState = 'idle' | 'typing' | 'analyzing' | 'generating' | 'completed' | 'error';

/**
 * 감정 데이터 타입
 */
export interface EmotionData {
  energy: number; // 0-1
  valence: number; // -1 to 1 (negative to positive)
  tension: number; // 0-1
  focus: number; // 0-1
  rhythm: number[]; // rhythm pattern
  timestamp: Date;
}

/**
 * 타이핑 데이터 타입
 */
export interface TypingData {
  text: string;
  keystrokes: number;
  wpm: number; // words per minute
  pauses: number[]; // pause durations in ms
  rhythm: number[]; // typing rhythm
  timestamp: Date;
}

/**
 * 생성 진행 상태 타입
 */
export interface GenerationState {
  stage: 'analyzing' | 'processing' | 'generating' | 'finalizing' | 'completed';
  progress: number; // 0-100
  message: string;
  estimatedTimeRemaining?: number; // seconds
}

/**
 * MusicGenerationPage Props
 */
export interface MusicGenerationPageProps {
  /** 세션 ID */
  sessionId?: string;
  /** 초기 로딩 상태 */
  initialLoading?: boolean;
  /** 세션 종료 핸들러 */
  onSessionEnd?: () => void;
  /** 음악 생성 완료 핸들러 */
  onMusicGenerated?: (musicId: string, musicData: any) => void;
  /** 에러 핸들러 */
  onError?: (error: Error) => void;
  /** 추가 CSS 클래스명 */
  className?: string;
}

// ============================================================================
// Mock Data & Utilities
// ============================================================================

/**
 * 타이핑 데이터에서 감정 추출 (Mock)
 */
const analyzeEmotionFromTyping = (typingData: TypingData): EmotionData => {
  // Mock emotion analysis based on typing patterns
  const avgPause = typingData.pauses.length > 0
    ? typingData.pauses.reduce((sum, pause) => sum + pause, 0) / typingData.pauses.length
    : 500;

  return {
    energy: Math.min(1, Math.max(0, (typingData.wpm - 20) / 60)), // Higher WPM = more energy
    valence: Math.random() * 2 - 1, // Random for demo (-1 to 1)
    tension: Math.min(1, Math.max(0, avgPause > 1000 ? 0.3 : 0.7)), // Long pauses = less tension
    focus: Math.min(1, Math.max(0, typingData.rhythm.length > 0 ? 0.8 : 0.4)), // Consistent rhythm = more focus
    rhythm: typingData.rhythm,
    timestamp: new Date(),
  };
};

/**
 * 음악 생성 시뮬레이션
 */
const simulateMusicGeneration = (
  emotionData: EmotionData,
  onProgress: (state: GenerationState) => void
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const stages: GenerationState[] = [
      { stage: 'analyzing', progress: 10, message: '감정 데이터를 분석하고 있어요...', estimatedTimeRemaining: 25 },
      { stage: 'processing', progress: 30, message: '음악 스타일을 결정하고 있어요...', estimatedTimeRemaining: 20 },
      { stage: 'generating', progress: 60, message: 'AI가 음악을 작곡하고 있어요...', estimatedTimeRemaining: 10 },
      { stage: 'finalizing', progress: 90, message: '최종 음악 파일을 생성하고 있어요...', estimatedTimeRemaining: 3 },
      { stage: 'completed', progress: 100, message: '음악 생성이 완료되었어요!', estimatedTimeRemaining: 0 },
    ];

    let currentStage = 0;

    const progressInterval = setInterval(() => {
      if (currentStage < stages.length) {
        onProgress(stages[currentStage]);

        if (currentStage === stages.length - 1) {
          clearInterval(progressInterval);
          // 성공 확률 90%
          if (Math.random() > 0.1) {
            resolve(`music_${Date.now()}`);
          } else {
            reject(new Error('음악 생성에 실패했습니다. 다시 시도해 주세요.'));
          }
        }
        currentStage++;
      }
    }, 2000 + Math.random() * 2000); // 2-4초 간격
  });
};

// ============================================================================
// Responsive Styled Components (T096)
// ============================================================================

const useMusicGenerationPageStyles = () => {
  const { getValue, device } = useResponsive();
  const { shouldShowMobileUI } = useMobileDetection();

  const pageStyles: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: colors.neutral[25],
  };

  const mainContentStyles: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: shouldShowMobileUI ? 'column' : 'row',
    gap: getValue({
      mobile: responsiveSpacing.componentGap.mobile,
      tablet: responsiveSpacing.componentGap.tablet,
      desktop: responsiveSpacing.componentGap.desktop,
      wide: responsiveSpacing.componentGap.wide,
    }),
    padding: getValue({
      mobile: responsiveSpacing.containerPadding.mobile,
      tablet: responsiveSpacing.containerPadding.tablet,
      desktop: responsiveSpacing.containerPadding.desktop,
      wide: responsiveSpacing.containerPadding.wide,
    }),
    maxWidth: getValue({
      mobile: '100%',
      tablet: '100%',
      desktop: responsiveLayout.maxWidth.desktop,
      wide: responsiveLayout.maxWidth.wide,
    }),
    margin: '0 auto',
    width: '100%',
  };

  const primaryPanelStyles: React.CSSProperties = {
    flex: shouldShowMobileUI ? 'none' : 2,
    display: 'flex',
    flexDirection: 'column',
    gap: getValue({
      mobile: responsiveSpacing.componentGap.mobile,
      tablet: responsiveSpacing.componentGap.tablet,
      desktop: responsiveSpacing.componentGap.desktop,
      wide: responsiveSpacing.componentGap.wide,
    }),
    order: shouldShowMobileUI ? 1 : 0,
  };

  const sidePanelStyles: React.CSSProperties = {
    flex: shouldShowMobileUI ? 'none' : 1,
    minWidth: shouldShowMobileUI ? 'auto' : getValue({
      mobile: 'auto',
      tablet: responsiveLayout.sidebarWidth.tablet,
      desktop: responsiveLayout.sidebarWidth.desktop,
      wide: responsiveLayout.sidebarWidth.wide,
    }),
    display: 'flex',
    flexDirection: 'column',
    gap: getValue({
      mobile: responsiveSpacing.elementGap.mobile,
      tablet: responsiveSpacing.elementGap.tablet,
      desktop: responsiveSpacing.elementGap.desktop,
      wide: responsiveSpacing.elementGap.wide,
    }),
    order: shouldShowMobileUI ? 2 : 1,
  };

  return {
    pageStyles,
    mainContentStyles,
    primaryPanelStyles,
    sidePanelStyles,
    shouldShowMobileUI,
    device,
  };
};

// 추가 반응형 스타일
const useAdditionalMusicPageStyles = () => {
  const { getValue } = useResponsive();
  const { shouldShowMobileUI } = useMobileDetection();

  const panelStyles: React.CSSProperties = {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.xl,
    padding: getValue({
      mobile: spacing[4],
      tablet: spacing[5],
      desktop: spacing[6],
      wide: spacing[6],
    }),
    boxShadow: boxShadow.sm,
    border: `1px solid ${colors.neutral[100]}`,
  };

  const splitPanelStyles: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: shouldShowMobileUI ? '1fr' : '1fr 1fr',
    gap: getValue({
      mobile: responsiveSpacing.componentGap.mobile,
      tablet: responsiveSpacing.componentGap.tablet,
      desktop: responsiveSpacing.componentGap.desktop,
      wide: responsiveSpacing.componentGap.wide,
    }),
    height: shouldShowMobileUI ? 'auto' : getValue({
      mobile: 'auto',
      tablet: '350px',
      desktop: '400px',
      wide: '400px',
    }),
  };

  const statusBarStyles: React.CSSProperties = {
    backgroundColor: colors.neutral[0],
    padding: getValue({
      mobile: `${spacing[2]} ${responsiveSpacing.containerPadding.mobile}`,
      tablet: `${spacing[3]} ${responsiveSpacing.containerPadding.tablet}`,
      desktop: `${spacing[3]} ${responsiveSpacing.containerPadding.desktop}`,
      wide: `${spacing[3]} ${responsiveSpacing.containerPadding.wide}`,
    }),
    borderBottom: `1px solid ${colors.neutral[100]}`,
    display: 'flex',
    alignItems: shouldShowMobileUI ? 'flex-start' : 'center',
    justifyContent: 'space-between',
    flexDirection: shouldShowMobileUI ? 'column' : 'row',
    gap: shouldShowMobileUI ? spacing[3] : 0,
    minHeight: getValue({
      mobile: responsiveLayout.headerHeight.mobile,
      tablet: responsiveLayout.headerHeight.tablet,
      desktop: responsiveLayout.headerHeight.desktop,
      wide: responsiveLayout.headerHeight.wide,
    }),
  };

  const statusTextStyles: React.CSSProperties = {
    fontSize: getValue({
      mobile: fontSizes.sm,
      tablet: fontSizes.sm,
      desktop: fontSizes.sm,
      wide: fontSizes.sm,
    }),
    color: colors.neutral[600],
    fontWeight: fontWeights.medium,
  };

  const instructionStyles: React.CSSProperties = {
    backgroundColor: colors.primary[50],
    border: `1px solid ${colors.primary[200]}`,
    borderRadius: borderRadius.lg,
    padding: getValue({
      mobile: spacing[3],
      tablet: spacing[4],
      desktop: spacing[4],
      wide: spacing[4],
    }),
    marginBottom: getValue({
      mobile: spacing[4],
      tablet: spacing[5],
      desktop: spacing[6],
      wide: spacing[6],
    }),
  };

  const instructionTitleStyles: React.CSSProperties = {
    fontSize: getValue({
      mobile: fontSizes.sm,
      tablet: fontSizes.base,
      desktop: fontSizes.base,
      wide: fontSizes.base,
    }),
    fontWeight: fontWeights.semibold,
    color: colors.primary[800],
    marginBottom: spacing[2],
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
  };

  const instructionTextStyles: React.CSSProperties = {
    fontSize: getValue({
      mobile: fontSizes.xs,
      tablet: fontSizes.sm,
      desktop: fontSizes.sm,
      wide: fontSizes.sm,
    }),
    color: colors.primary[700],
    lineHeight: responsiveTypography.lineHeight.normal,
  };

  const emptyStateStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: getValue({
      mobile: '200px',
      tablet: '250px',
      desktop: '300px',
      wide: '300px',
    }),
    color: colors.neutral[500],
    textAlign: 'center',
    padding: getValue({
      mobile: spacing[4],
      tablet: spacing[5],
      desktop: spacing[6],
      wide: spacing[6],
    }),
  };

  const generateButtonStyles: React.CSSProperties = {
    background: `linear-gradient(135deg, ${colors.primary[500]}, ${colors.primary[600]})`,
    color: colors.neutral[0],
    padding: getValue({
      mobile: `${touchOptimization.buttonSize.medium.mobile} ${spacing[5]}`,
      tablet: `${touchOptimization.buttonSize.medium.tablet} ${spacing[6]}`,
      desktop: `${touchOptimization.buttonSize.medium.desktop} ${spacing[6]}`,
      wide: `${touchOptimization.buttonSize.medium.desktop} ${spacing[6]}`,
    }),
    borderRadius: borderRadius.lg,
    border: 'none',
    fontSize: getValue({
      mobile: fontSizes.sm,
      tablet: fontSizes.base,
      desktop: fontSizes.base,
      wide: fontSizes.base,
    }),
    fontWeight: fontWeights.semibold,
    cursor: 'pointer',
    transition: 'all 200ms ease-out',
    boxShadow: boxShadow.sm,
    width: shouldShowMobileUI ? '100%' : 'auto',
    minWidth: getValue({
      mobile: touchOptimization.minTouchTarget,
      tablet: '180px',
      desktop: '200px',
      wide: '200px',
    }),
    minHeight: getValue({
      mobile: touchOptimization.minTouchTarget,
      tablet: touchOptimization.buttonSize.medium.tablet,
      desktop: touchOptimization.buttonSize.medium.desktop,
      wide: touchOptimization.buttonSize.medium.desktop,
    }),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    touchAction: 'manipulation',
  };

  return {
    panelStyles,
    splitPanelStyles,
    statusBarStyles,
    statusTextStyles,
    instructionStyles,
    instructionTitleStyles,
    instructionTextStyles,
    emptyStateStyles,
    generateButtonStyles,
    shouldShowMobileUI,
  };
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * VibeMusic MusicGenerationPage 컴포넌트 (T096 반응형 최적화)
 */
const MusicGenerationPage: React.FC<MusicGenerationPageProps> = ({
  sessionId,
  initialLoading = false,
  onSessionEnd,
  onMusicGenerated,
  onError,
  className,
}) => {
  // 반응형 스타일 Hook 사용
  const mainStyles = useMusicGenerationPageStyles();
  const additionalStyles = useAdditionalMusicPageStyles();
  const { device, viewport } = useResponsive();

  // State
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [typingData, setTypingData] = useState<TypingData | null>(null);
  const [emotionData, setEmotionData] = useState<EmotionData | null>(null);
  const [generationState, setGenerationState] = useState<GenerationState | null>(null);
  const [sessionStartTime] = useState(new Date());
  const [generatedMusicCount, setGeneratedMusicCount] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedMusicId, setGeneratedMusicId] = useState<string | null>(null);

  // useMusicAPI 훅 사용
  const musicAPI = useMusicAPI({
    sessionId: sessionId || `session-${sessionStartTime.getTime()}`,
    onMusicUpdate: (musicInfo) => {
      console.log('Music info updated:', musicInfo);
    },
    onError: (error) => {
      console.error('Music API error:', error);
      if (onError) {
        onError(new Error(error));
      }
    }
  });

  // 컴포넌트 언마운트 시 폴링 정리
  useEffect(() => {
    return () => {
      if (musicAPI.isPolling) {
        musicAPI.stopPolling();
      }
    };
  }, [musicAPI]);

  // 타이핑 데이터 처리
  const handleTypingData = useCallback((data: any) => {
    const newTypingData: TypingData = {
      text: data.text || '',
      keystrokes: data.keystrokes || 0,
      wpm: data.wpm || 0,
      pauses: data.pauses || [],
      rhythm: data.rhythm || [],
      timestamp: new Date(),
    };

    setTypingData(newTypingData);
    setSessionState('typing');

    // 감정 분석
    const emotion = analyzeEmotionFromTyping(newTypingData);
    setEmotionData(emotion);
  }, []);

  // 음악 생성 시작
  const handleGenerateMusic = useCallback(async () => {
    if (!emotionData || isGenerating) return;

    try {
      setIsGenerating(true);
      setSessionState('generating');
      setGenerationState({
        stage: 'analyzing',
        progress: 0,
        message: '음악 생성을 시작합니다...',
        estimatedTimeRemaining: 30,
      });

      const musicId = await simulateMusicGeneration(emotionData, setGenerationState);

      setSessionState('completed');
      setGeneratedMusicCount(prev => prev + 1);
      setGeneratedMusicId(musicId);

      // 생성된 음악의 정보를 폴링으로 추적
      if (musicId) {
        musicAPI.startPolling(musicId);
      }

      if (onMusicGenerated) {
        onMusicGenerated(musicId, { emotionData, typingData });
      }
    } catch (error) {
      setSessionState('error');
      setGenerationState(null);
      if (onError) {
        onError(error as Error);
      }
    } finally {
      setIsGenerating(false);
    }
  }, [emotionData, typingData, isGenerating, onMusicGenerated, onError]);

  // 새 세션 시작
  const handleNewSession = useCallback(() => {
    setSessionState('idle');
    setTypingData(null);
    setEmotionData(null);
    setGenerationState(null);
    setIsGenerating(false);
    setGeneratedMusicId(null);

    // 폴링 중단
    if (musicAPI.isPolling) {
      musicAPI.stopPolling();
    }
  }, [musicAPI]);

  // 세션 정보 구성
  const sessionInfo = {
    id: sessionId || `session-${sessionStartTime.getTime()}`,
    startTime: sessionStartTime,
    isActive: sessionState !== 'idle',
    musicCount: generatedMusicCount,
  };

  // 초기 로딩 중
  if (initialLoading) {
    return (
      <div style={mainStyles.pageStyles}>
        <LoadingSpinner
          size="lg"
          variant="music"
          message="음악 생성 환경을 준비하고 있어요..."
          overlay
        />
      </div>
    );
  }

  return (
    <ErrorBoundary onError={onError}>
      {/* 반응형 최적화된 CSS (T096) */}
      <style>
        {`
          /* 호버 효과 (터치 디바이스에서는 비활성화) */
          ${device.isTouch ? '' : `
            .generate-music-btn:hover:not(:disabled) {
              background: linear-gradient(135deg, ${colors.primary[600]}, ${colors.primary[700]});
              transform: translateY(-1px);
              box-shadow: ${boxShadow.md};
            }
          `}

          /* 터치 디바이스 최적화 */
          ${device.isTouch ? `
            .generate-music-btn:active:not(:disabled) {
              background: linear-gradient(135deg, ${colors.primary[700]}, ${colors.primary[800]});
              transform: scale(0.98);
            }

            .generate-music-btn {
              -webkit-touch-callout: none;
              -webkit-user-select: none;
              user-select: none;
              -webkit-tap-highlight-color: rgba(0,0,0,0);
            }
          ` : ''}

          .generate-music-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none !important;
          }

          /* 고해상도 디스플레이 최적화 */
          ${device.isRetina ? `
            .panel,
            .status-bar {
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
            }
          ` : ''}

          /* 접근성 향상 */
          @media (prefers-reduced-motion: reduce) {
            .generate-music-btn,
            .panel {
              transition: none;
            }
          }

          /* 고대비 모드 지원 */
          @media (prefers-contrast: high) {
            .panel {
              border-width: 2px;
              border-color: ${colors.neutral[400]};
            }

            .generate-music-btn {
              border: 2px solid ${colors.primary[700]};
            }
          }
        `}
      </style>

      <div className={`music-generation-page ${className || ''}`} style={mainStyles.pageStyles}>
        {/* Header */}
        <Header
          sessionInfo={sessionInfo}
          onNewSession={handleNewSession}
          onSessionEnd={onSessionEnd}
        />

        {/* Status Bar */}
        <div className="status-bar" style={additionalStyles.statusBarStyles}>
          <div style={additionalStyles.statusTextStyles}>
            상태: {
              sessionState === 'idle' ? '대기 중' :
              sessionState === 'typing' ? '타이핑 중' :
              sessionState === 'analyzing' ? '감정 분석 중' :
              sessionState === 'generating' ? '음악 생성 중' :
              sessionState === 'completed' ? '생성 완료' :
              sessionState === 'error' ? '오류 발생' : '알 수 없음'
            }
          </div>

          {emotionData && !isGenerating && sessionState !== 'completed' && (
            <button
              className="generate-music-btn"
              style={additionalStyles.generateButtonStyles}
              onClick={handleGenerateMusic}
              disabled={isGenerating}
              aria-label="음악 생성하기"
              type="button"
            >
              <span>🎵</span>
              <span>음악 생성하기</span>
            </button>
          )}
        </div>

        {/* Main Content */}
        <div className="main-content" style={mainStyles.mainContentStyles}>
          {/* Primary Panel */}
          <div className="primary-panel" style={mainStyles.primaryPanelStyles}>
            {/* Instructions */}
            {sessionState === 'idle' && (
              <div style={additionalStyles.instructionStyles}>
                <div style={additionalStyles.instructionTitleStyles}>
                  <span>💡</span>
                  <span>시작하기</span>
                </div>
                <p style={additionalStyles.instructionTextStyles}>
                  아래 텍스트 영역에 자유롭게 타이핑해보세요.
                  {!additionalStyles.shouldShowMobileUI && <br />}
                  일기, 생각, 또는 어떤 내용이든 자연스럽게 입력하시면
                  {additionalStyles.shouldShowMobileUI && <br />}
                  당신의 타이핑 패턴에서 감정을 분석합니다.
                </p>
              </div>
            )}

            {/* Typing Interface & Emotion Visualizer */}
            <div className="split-panel" style={additionalStyles.splitPanelStyles}>
              <div className="panel" style={additionalStyles.panelStyles}>
                <TypingInterface
                  onTypingData={handleTypingData}
                  disabled={isGenerating}
                  placeholder={
                    sessionState === 'idle'
                      ? "여기에 자유롭게 타이핑해보세요..."
                      : "계속 타이핑하여 감정 데이터를 업데이트할 수 있습니다."
                  }
                />
              </div>

              <div className="panel" style={additionalStyles.panelStyles}>
                {emotionData ? (
                  <EmotionVisualizer
                    emotionData={emotionData}
                    isActive={sessionState === 'typing'}
                    size={additionalStyles.shouldShowMobileUI ? "sm" : "md"}
                  />
                ) : (
                  <div style={additionalStyles.emptyStateStyles}>
                    <div style={{
                      fontSize: additionalStyles.shouldShowMobileUI ? '2.5rem' : '3rem',
                      marginBottom: spacing[3],
                      lineHeight: 1
                    }}>📊</div>
                    <div style={{
                      fontSize: additionalStyles.shouldShowMobileUI ? fontSizes.xs : fontSizes.sm,
                      color: colors.neutral[500],
                      textAlign: 'center'
                    }}>
                      타이핑을 시작하면
                      <br />
                      실시간 감정 분석을 보여드려요
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Side Panel */}
          <div className="side-panel" style={mainStyles.sidePanelStyles}>
            {/* Session Status */}
            <div className="panel" style={additionalStyles.panelStyles}>
              <SessionStatus
                sessionId={sessionInfo.id}
                startTime={sessionInfo.startTime}
                isActive={sessionInfo.isActive}
                generatedMusicCount={sessionInfo.musicCount}
                currentStatus={sessionState}
              />
            </div>

            {/* Generation Progress */}
            {generationState && (
              <div className="panel" style={additionalStyles.panelStyles}>
                <GenerationProgress
                  stage={generationState.stage}
                  progress={generationState.progress}
                  message={generationState.message}
                  estimatedTimeRemaining={generationState.estimatedTimeRemaining}
                />
              </div>
            )}

            {/* Music Player */}
            {generatedMusicId && musicAPI.currentMusic && sessionState === 'completed' && (
              <div className="panel" style={additionalStyles.panelStyles}>
                <MusicPlayer
                  musicId={generatedMusicId}
                  sessionId={sessionInfo.id}
                  title={`생성된 음악 #${generatedMusicCount}`}
                  artistName="VibeMusic AI"
                  albumName="감정 기반 AI 음악"
                  duration={musicAPI.currentMusic.file_info?.duration || 0}
                  size={additionalStyles.shouldShowMobileUI ? 'sm' : 'md'}
                  onError={(error) => {
                    console.error('Music player error:', error);
                    if (onError) {
                      onError(new Error(error));
                    }
                  }}
                />
              </div>
            )}

            {/* Empty state for side panel */}
            {!generationState && !generatedMusicId && sessionState === 'idle' && (
              <div className="panel" style={{
                ...additionalStyles.panelStyles,
                ...additionalStyles.emptyStateStyles
              }}>
                <div style={{
                  fontSize: additionalStyles.shouldShowMobileUI ? '1.8rem' : '2rem',
                  marginBottom: spacing[2],
                  lineHeight: 1
                }}>🎼</div>
                <div style={{
                  fontSize: additionalStyles.shouldShowMobileUI ? fontSizes.xs : fontSizes.sm,
                  textAlign: 'center'
                }}>
                  타이핑을 시작하면
                  <br />
                  세션 정보가 표시됩니다
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default MusicGenerationPage;
export type { MusicGenerationPageProps, SessionState, EmotionData, TypingData, GenerationState };