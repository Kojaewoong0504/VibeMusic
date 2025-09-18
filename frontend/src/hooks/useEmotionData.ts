/**
 * T008: 프론트엔드 감정 시각화 연동 - 감정 데이터 상태 관리
 * WebSocket으로 받은 감정 데이터를 관리하고 시각화를 위한 상태를 제공합니다.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { EmotionMessage, WebSocketMessage } from './types';

export interface EmotionData {
  energy: number;      // 에너지 레벨 (0-1)
  valence: number;     // 감정가 (-1~1, 부정적~긍정적)
  tension: number;     // 긴장도 (0-1)
  focus: number;       // 집중도 (0-1)
  confidence: number;  // 분석 신뢰도 (0-1)
  timestamp: Date;     // 감정 데이터 수신 시간
}

export interface EmotionHistoryItem extends EmotionData {
  id: string;          // 고유 식별자
}

export interface EmotionTrend {
  metric: keyof EmotionData;
  direction: 'increasing' | 'decreasing' | 'stable';
  change: number;      // 변화량
  timeWindow: number;  // 분석 기간 (ms)
}

export interface EmotionSummary {
  averageEnergy: number;
  averageValence: number;
  averageTension: number;
  averageFocus: number;
  dominantEmotion: 'positive' | 'negative' | 'neutral' | 'energetic' | 'calm';
  emotionStability: number;  // 감정 안정성 (0-1, 높을수록 안정)
  dataCount: number;         // 분석된 데이터 개수
}

interface UseEmotionDataOptions {
  sessionId: string;
  maxHistorySize?: number;        // 최대 히스토리 크기 (기본: 100)
  smoothingWindow?: number;       // 스무딩 윈도우 크기 (기본: 5)
  trendAnalysisWindow?: number;   // 트렌드 분석 윈도우 (ms, 기본: 30000 = 30초)
  onEmotionUpdate?: (emotion: EmotionData) => void;
  onTrendChange?: (trends: EmotionTrend[]) => void;
}

interface UseEmotionDataReturn {
  // 현재 감정 상태
  currentEmotion: EmotionData | null;
  smoothedEmotion: EmotionData | null;

  // 히스토리 관리
  emotionHistory: EmotionHistoryItem[];
  addEmotionData: (emotion: Omit<EmotionData, 'timestamp'>) => void;
  clearHistory: () => void;

  // 트렌드 분석
  emotionTrends: EmotionTrend[];
  emotionSummary: EmotionSummary | null;

  // WebSocket 메시지 처리
  handleWebSocketMessage: (message: WebSocketMessage) => void;

  // 상태
  isReceivingData: boolean;
  lastUpdateTime: Date | null;
  dataQuality: 'excellent' | 'good' | 'fair' | 'poor' | 'no-data';
}

export function useEmotionData(options: UseEmotionDataOptions): UseEmotionDataReturn {
  const {
    sessionId,
    maxHistorySize = 100,
    smoothingWindow = 5,
    trendAnalysisWindow = 30000,
    onEmotionUpdate,
    onTrendChange
  } = options;

  // 상태 관리
  const [currentEmotion, setCurrentEmotion] = useState<EmotionData | null>(null);
  const [smoothedEmotion, setSmoothedEmotion] = useState<EmotionData | null>(null);
  const [emotionHistory, setEmotionHistory] = useState<EmotionHistoryItem[]>([]);
  const [emotionTrends, setEmotionTrends] = useState<EmotionTrend[]>([]);
  const [isReceivingData, setIsReceivingData] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);

  // 내부 레퍼런스
  const historyIdCounterRef = useRef(0);
  const dataQualityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 감정 데이터 추가
  const addEmotionData = useCallback((emotionInput: Omit<EmotionData, 'timestamp'>) => {
    const newEmotion: EmotionData = {
      ...emotionInput,
      timestamp: new Date()
    };

    const newHistoryItem: EmotionHistoryItem = {
      ...newEmotion,
      id: `emotion_${historyIdCounterRef.current++}`
    };

    // 현재 감정 업데이트
    setCurrentEmotion(newEmotion);
    setLastUpdateTime(newEmotion.timestamp);
    setIsReceivingData(true);

    // 히스토리 업데이트 (최대 크기 제한)
    setEmotionHistory(prev => {
      const updated = [...prev, newHistoryItem];
      return updated.length > maxHistorySize
        ? updated.slice(-maxHistorySize)
        : updated;
    });

    // 콜백 호출
    onEmotionUpdate?.(newEmotion);

    // 데이터 수신 상태 타이머 리셋
    if (dataQualityTimeoutRef.current) {
      clearTimeout(dataQualityTimeoutRef.current);
    }
    dataQualityTimeoutRef.current = setTimeout(() => {
      setIsReceivingData(false);
    }, 5000); // 5초 동안 데이터가 없으면 중단으로 간주

  }, [maxHistorySize, onEmotionUpdate]);

  // 스무딩된 감정 계산
  useEffect(() => {
    if (emotionHistory.length < 2) {
      setSmoothedEmotion(currentEmotion);
      return;
    }

    const recentData = emotionHistory.slice(-smoothingWindow);
    if (recentData.length === 0) return;

    const smoothed: EmotionData = {
      energy: recentData.reduce((sum, item) => sum + item.energy, 0) / recentData.length,
      valence: recentData.reduce((sum, item) => sum + item.valence, 0) / recentData.length,
      tension: recentData.reduce((sum, item) => sum + item.tension, 0) / recentData.length,
      focus: recentData.reduce((sum, item) => sum + item.focus, 0) / recentData.length,
      confidence: recentData.reduce((sum, item) => sum + item.confidence, 0) / recentData.length,
      timestamp: new Date()
    };

    setSmoothedEmotion(smoothed);
  }, [emotionHistory, smoothingWindow]);

  // 트렌드 분석
  useEffect(() => {
    if (emotionHistory.length < 3) return;

    const now = Date.now();
    const recentData = emotionHistory.filter(
      item => now - item.timestamp.getTime() < trendAnalysisWindow
    );

    if (recentData.length < 3) return;

    const calculateTrend = (metric: keyof EmotionData): EmotionTrend => {
      const values = recentData.map(item => item[metric] as number);
      const firstHalf = values.slice(0, Math.floor(values.length / 2));
      const secondHalf = values.slice(Math.floor(values.length / 2));

      const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

      const change = secondAvg - firstAvg;
      const direction = Math.abs(change) < 0.05 ? 'stable'
        : change > 0 ? 'increasing' : 'decreasing';

      return {
        metric,
        direction,
        change,
        timeWindow: trendAnalysisWindow
      };
    };

    const trends: EmotionTrend[] = [
      calculateTrend('energy'),
      calculateTrend('valence'),
      calculateTrend('tension'),
      calculateTrend('focus')
    ];

    setEmotionTrends(trends);
    onTrendChange?.(trends);

  }, [emotionHistory, trendAnalysisWindow, onTrendChange]);

  // 감정 요약 계산
  const emotionSummary: EmotionSummary | null = emotionHistory.length > 0 ? (() => {
    const data = emotionHistory;
    const count = data.length;

    const averageEnergy = data.reduce((sum, item) => sum + item.energy, 0) / count;
    const averageValence = data.reduce((sum, item) => sum + item.valence, 0) / count;
    const averageTension = data.reduce((sum, item) => sum + item.tension, 0) / count;
    const averageFocus = data.reduce((sum, item) => sum + item.focus, 0) / count;

    // 지배적 감정 결정
    let dominantEmotion: EmotionSummary['dominantEmotion'] = 'neutral';
    if (averageEnergy > 0.7) {
      dominantEmotion = 'energetic';
    } else if (averageEnergy < 0.3) {
      dominantEmotion = 'calm';
    } else if (averageValence > 0.3) {
      dominantEmotion = 'positive';
    } else if (averageValence < -0.3) {
      dominantEmotion = 'negative';
    }

    // 감정 안정성 계산 (변동성의 역수)
    const energyVariance = data.reduce((sum, item) =>
      sum + Math.pow(item.energy - averageEnergy, 2), 0) / count;
    const valenceVariance = data.reduce((sum, item) =>
      sum + Math.pow(item.valence - averageValence, 2), 0) / count;

    const averageVariance = (energyVariance + valenceVariance) / 2;
    const emotionStability = Math.max(0, 1 - averageVariance * 2);

    return {
      averageEnergy,
      averageValence,
      averageTension,
      averageFocus,
      dominantEmotion,
      emotionStability,
      dataCount: count
    };
  })() : null;

  // 데이터 품질 계산
  const dataQuality: UseEmotionDataReturn['dataQuality'] = (() => {
    if (!lastUpdateTime) return 'no-data';

    const timeSinceLastUpdate = Date.now() - lastUpdateTime.getTime();
    const confidence = currentEmotion?.confidence ?? 0;

    if (timeSinceLastUpdate > 10000) return 'no-data';  // 10초 이상 데이터 없음
    if (confidence < 0.3) return 'poor';
    if (confidence < 0.6) return 'fair';
    if (confidence < 0.8) return 'good';
    return 'excellent';
  })();

  // WebSocket 메시지 처리
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === 'emotion_update' && message.session_id === sessionId) {
      const emotionMessage = message as EmotionMessage;

      // 감정 데이터 검증
      const { energy, valence, tension, focus } = emotionMessage.data;

      if (typeof energy === 'number' && typeof valence === 'number' &&
          typeof tension === 'number' && typeof focus === 'number') {

        addEmotionData({
          energy: Math.max(0, Math.min(1, energy)),
          valence: Math.max(-1, Math.min(1, valence)),
          tension: Math.max(0, Math.min(1, tension)),
          focus: Math.max(0, Math.min(1, focus)),
          confidence: Math.max(0, Math.min(1, emotionMessage.data.confidence || 0.8))
        });
      }
    }
  }, [sessionId, addEmotionData]);

  // 히스토리 정리
  const clearHistory = useCallback(() => {
    setEmotionHistory([]);
    setCurrentEmotion(null);
    setSmoothedEmotion(null);
    setEmotionTrends([]);
    setLastUpdateTime(null);
    setIsReceivingData(false);
  }, []);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (dataQualityTimeoutRef.current) {
        clearTimeout(dataQualityTimeoutRef.current);
      }
    };
  }, []);

  return {
    currentEmotion,
    smoothedEmotion,
    emotionHistory,
    addEmotionData,
    clearHistory,
    emotionTrends,
    emotionSummary,
    handleWebSocketMessage,
    isReceivingData,
    lastUpdateTime,
    dataQuality
  };
}