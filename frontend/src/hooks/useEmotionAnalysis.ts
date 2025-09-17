import { useState, useEffect, useCallback, useRef } from 'react';
import { EmotionVector, TypingPattern, EmotionAnalysisConfig } from './types';

interface UseEmotionAnalysisOptions extends Partial<EmotionAnalysisConfig> {
  enabled?: boolean;
  onEmotionChange?: (emotion: EmotionVector) => void;
}

interface EmotionAnalysisData {
  current: EmotionVector;
  history: Array<{ emotion: EmotionVector; timestamp: number }>;
  trend: 'rising' | 'falling' | 'stable';
  dominantEmotion: keyof EmotionVector;
}

interface AnimationState {
  isAnimating: boolean;
  progress: number; // 0-1
  target: EmotionVector;
  previous: EmotionVector;
}

interface UseEmotionAnalysisReturn {
  emotion: EmotionVector;
  analysisData: EmotionAnalysisData;
  animationState: AnimationState;
  visualizationData: {
    waveform: number[];
    energyLevel: number;
    emotionColors: Record<keyof EmotionVector, string>;
  };
  analyzePattern: (pattern: TypingPattern) => EmotionVector;
  resetAnalysis: () => void;
  getEmotionDescription: () => string;
}

const DEFAULT_EMOTION: EmotionVector = {
  energy: 0.5,
  tension: 0.5,
  focus: 0.5,
  creativity: 0.5,
  calmness: 0.5
};

const EMOTION_COLORS = {
  energy: '#ff6b6b',    // 빨강
  tension: '#ffa500',   // 주황
  focus: '#4ecdc4',     // 청록
  creativity: '#45b7d1', // 파랑
  calmness: '#96ceb4'   // 초록
} as const;

export function useEmotionAnalysis(options: UseEmotionAnalysisOptions = {}): UseEmotionAnalysisReturn {
  const {
    enabled = true,
    updateInterval = 1000,
    windowSize = 10,
    animationDuration = 800,
    smoothingFactor = 0.3,
    onEmotionChange
  } = options;

  const [emotion, setEmotion] = useState<EmotionVector>(DEFAULT_EMOTION);
  const [analysisData, setAnalysisData] = useState<EmotionAnalysisData>({
    current: DEFAULT_EMOTION,
    history: [],
    trend: 'stable',
    dominantEmotion: 'energy'
  });
  const [animationState, setAnimationState] = useState<AnimationState>({
    isAnimating: false,
    progress: 0,
    target: DEFAULT_EMOTION,
    previous: DEFAULT_EMOTION
  });

  const animationFrameRef = useRef<number | null>(null);
  const animationStartTimeRef = useRef<number | null>(null);
  const emotionHistoryRef = useRef<Array<{ emotion: EmotionVector; timestamp: number }>>([]);

  // 타이핑 패턴을 감정 벡터로 변환
  const analyzePattern = useCallback((pattern: TypingPattern): EmotionVector => {
    if (!enabled) return DEFAULT_EMOTION;

    // 타이핑 속도 기반 에너지 계산
    const normalizedSpeed = Math.min(pattern.speed / 60, 1); // 60WPM을 기준으로 정규화
    const energy = normalizedSpeed;

    // 리듬 불규칙성 기반 긴장도 계산
    const tension = Math.max(0, 1 - pattern.rhythm);

    // 타이핑 일관성 기반 집중도 계산
    const focus = pattern.consistency;

    // 일시정지 패턴 기반 창의성 계산
    const pauseVariation = pattern.pauses.length > 0
      ? Math.min(pattern.pauses.reduce((sum, pause) => sum + pause, 0) / (pattern.pauses.length * 1000), 1)
      : 0;
    const creativity = pauseVariation * 0.7 + (1 - pattern.consistency) * 0.3;

    // 압력과 속도의 역관계로 차분함 계산
    const speedFactor = Math.min(pattern.speed / 40, 1); // 40WPM 기준
    const pressureFactor = pattern.pressure;
    const calmness = Math.max(0, 1 - (speedFactor * 0.6 + pressureFactor * 0.4));

    return {
      energy: Math.round(energy * 100) / 100,
      tension: Math.round(tension * 100) / 100,
      focus: Math.round(focus * 100) / 100,
      creativity: Math.round(creativity * 100) / 100,
      calmness: Math.round(calmness * 100) / 100
    };
  }, [enabled]);

  // 감정 트렌드 분석
  const analyzeTrend = useCallback((history: Array<{ emotion: EmotionVector; timestamp: number }>): 'rising' | 'falling' | 'stable' => {
    if (history.length < 3) return 'stable';

    const recent = history.slice(-3);
    const avgIntensity = (emotion: EmotionVector) =>
      (emotion.energy + emotion.tension + emotion.focus + emotion.creativity + emotion.calmness) / 5;

    const intensities = recent.map(item => avgIntensity(item.emotion));
    const trend = intensities[intensities.length - 1] - intensities[0];

    if (trend > 0.1) return 'rising';
    if (trend < -0.1) return 'falling';
    return 'stable';
  }, []);

  // 지배적 감정 계산
  const getDominantEmotion = useCallback((emotion: EmotionVector): keyof EmotionVector => {
    const entries = Object.entries(emotion) as [keyof EmotionVector, number][];
    return entries.reduce((max, current) =>
      current[1] > max[1] ? current : max
    )[0];
  }, []);

  // 감정 설명 생성
  const getEmotionDescription = useCallback((): string => {
    const { current, dominantEmotion } = analysisData;
    const intensity = current[dominantEmotion];

    const descriptions: Record<keyof EmotionVector, Record<string, string>> = {
      energy: {
        high: '활기찬 상태',
        medium: '적당한 활력',
        low: '차분한 상태'
      },
      tension: {
        high: '긴장된 상태',
        medium: '약간 긴장',
        low: '편안한 상태'
      },
      focus: {
        high: '고도 집중',
        medium: '적당한 집중',
        low: '산만한 상태'
      },
      creativity: {
        high: '창의적 사고',
        medium: '유연한 사고',
        low: '논리적 사고'
      },
      calmness: {
        high: '매우 차분함',
        medium: '안정된 상태',
        low: '불안정한 상태'
      }
    };

    const level = intensity > 0.7 ? 'high' : intensity > 0.3 ? 'medium' : 'low';
    return descriptions[dominantEmotion][level];
  }, [analysisData]);

  // 애니메이션 프레임 처리
  const animate = useCallback((timestamp: number) => {
    if (!animationStartTimeRef.current) {
      animationStartTimeRef.current = timestamp;
    }

    const elapsed = timestamp - animationStartTimeRef.current;
    const progress = Math.min(elapsed / animationDuration, 1);

    // 이징 함수 적용 (ease-out)
    const easedProgress = 1 - Math.pow(1 - progress, 3);

    // 현재 감정과 목표 감정 간 보간
    const interpolated: EmotionVector = {
      energy: animationState.previous.energy + (animationState.target.energy - animationState.previous.energy) * easedProgress,
      tension: animationState.previous.tension + (animationState.target.tension - animationState.previous.tension) * easedProgress,
      focus: animationState.previous.focus + (animationState.target.focus - animationState.previous.focus) * easedProgress,
      creativity: animationState.previous.creativity + (animationState.target.creativity - animationState.previous.creativity) * easedProgress,
      calmness: animationState.previous.calmness + (animationState.target.calmness - animationState.previous.calmness) * easedProgress
    };

    setEmotion(interpolated);
    setAnimationState(prev => ({ ...prev, progress: easedProgress }));

    if (progress < 1) {
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      // 애니메이션 완료
      setAnimationState(prev => ({ ...prev, isAnimating: false, progress: 1 }));
      animationStartTimeRef.current = null;
      setEmotion(animationState.target);
    }
  }, [animationDuration, animationState.previous, animationState.target]);

  // 새 감정 상태로 애니메이션 시작
  const animateToEmotion = useCallback((newEmotion: EmotionVector) => {
    // 기존 애니메이션 중단
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // 스무딩 적용
    const smoothedEmotion: EmotionVector = {
      energy: emotion.energy + (newEmotion.energy - emotion.energy) * smoothingFactor,
      tension: emotion.tension + (newEmotion.tension - emotion.tension) * smoothingFactor,
      focus: emotion.focus + (newEmotion.focus - emotion.focus) * smoothingFactor,
      creativity: emotion.creativity + (newEmotion.creativity - emotion.creativity) * smoothingFactor,
      calmness: emotion.calmness + (newEmotion.calmness - emotion.calmness) * smoothingFactor
    };

    setAnimationState({
      isAnimating: true,
      progress: 0,
      target: smoothedEmotion,
      previous: emotion
    });

    animationStartTimeRef.current = null;
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [emotion, smoothingFactor, animate]);

  // 분석 데이터 업데이트
  const updateAnalysisData = useCallback((newEmotion: EmotionVector) => {
    const timestamp = Date.now();
    const newHistoryEntry = { emotion: newEmotion, timestamp };

    // 히스토리 업데이트 (윈도우 크기 유지)
    emotionHistoryRef.current = [...emotionHistoryRef.current, newHistoryEntry].slice(-windowSize);

    const trend = analyzeTrend(emotionHistoryRef.current);
    const dominantEmotion = getDominantEmotion(newEmotion);

    setAnalysisData({
      current: newEmotion,
      history: emotionHistoryRef.current,
      trend,
      dominantEmotion
    });

    onEmotionChange?.(newEmotion);
  }, [windowSize, analyzeTrend, getDominantEmotion, onEmotionChange]);

  // 감정 분석 리셋
  const resetAnalysis = useCallback(() => {
    setEmotion(DEFAULT_EMOTION);
    setAnalysisData({
      current: DEFAULT_EMOTION,
      history: [],
      trend: 'stable',
      dominantEmotion: 'energy'
    });
    emotionHistoryRef.current = [];

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  // 시각화 데이터 생성
  const visualizationData = {
    waveform: emotionHistoryRef.current.slice(-20).map(entry =>
      (entry.emotion.energy + entry.emotion.tension + entry.emotion.focus + entry.emotion.creativity + entry.emotion.calmness) / 5
    ),
    energyLevel: analysisData.current.energy,
    emotionColors: EMOTION_COLORS
  };

  // 패턴 변경시 감정 분석 및 애니메이션 시작
  const startEmotionUpdate = useCallback((pattern: TypingPattern): EmotionVector => {
    const newEmotion = analyzePattern(pattern);
    updateAnalysisData(newEmotion);
    animateToEmotion(newEmotion);
    return newEmotion;
  }, [analyzePattern, updateAnalysisData, animateToEmotion]);

  // 컴포넌트 언마운트시 애니메이션 정리
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return {
    emotion,
    analysisData,
    animationState,
    visualizationData,
    analyzePattern: startEmotionUpdate,
    resetAnalysis,
    getEmotionDescription
  };
}