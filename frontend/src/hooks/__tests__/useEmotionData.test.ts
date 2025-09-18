/**
 * T008: useEmotionData 훅 테스트
 */
import { renderHook, act } from '@testing-library/react';
import { useEmotionData } from '../useEmotionData';
import { WebSocketMessage, EmotionMessage } from '../types';

// Mock setTimeout for testing
jest.useFakeTimers();

describe('useEmotionData', () => {
  const mockOptions = {
    sessionId: 'test-session',
    maxHistorySize: 5,
    smoothingWindow: 3,
    trendAnalysisWindow: 10000,
  };

  const createEmotionMessage = (data: Partial<any> = {}): EmotionMessage => ({
    type: 'emotion_update',
    session_id: 'test-session',
    data: {
      energy: 0.7,
      valence: 0.3,
      tension: 0.5,
      focus: 0.8,
      confidence: 0.9,
      ...data
    },
    timestamp: new Date().toISOString()
  });

  beforeEach(() => {
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.useFakeTimers();
  });

  it('초기 상태가 올바르게 설정되어야 함', () => {
    const { result } = renderHook(() => useEmotionData(mockOptions));

    expect(result.current.currentEmotion).toBeNull();
    expect(result.current.smoothedEmotion).toBeNull();
    expect(result.current.emotionHistory).toEqual([]);
    expect(result.current.emotionTrends).toEqual([]);
    expect(result.current.emotionSummary).toBeNull();
    expect(result.current.isReceivingData).toBe(false);
    expect(result.current.lastUpdateTime).toBeNull();
    expect(result.current.dataQuality).toBe('no-data');
  });

  it('감정 데이터 추가 시 상태가 올바르게 업데이트되어야 함', () => {
    const { result } = renderHook(() => useEmotionData(mockOptions));

    act(() => {
      result.current.addEmotionData({
        energy: 0.7,
        valence: 0.3,
        tension: 0.5,
        focus: 0.8,
        confidence: 0.9
      });
    });

    expect(result.current.currentEmotion).toBeTruthy();
    expect(result.current.currentEmotion?.energy).toBe(0.7);
    expect(result.current.emotionHistory).toHaveLength(1);
    expect(result.current.isReceivingData).toBe(true);
    expect(result.current.lastUpdateTime).toBeTruthy();
  });

  it('WebSocket 메시지 처리가 올바르게 작동해야 함', () => {
    const { result } = renderHook(() => useEmotionData(mockOptions));
    const emotionMessage = createEmotionMessage();

    act(() => {
      result.current.handleWebSocketMessage(emotionMessage);
    });

    expect(result.current.currentEmotion).toBeTruthy();
    expect(result.current.currentEmotion?.energy).toBe(0.7);
    expect(result.current.emotionHistory).toHaveLength(1);
  });

  it('잘못된 세션 ID의 메시지는 무시되어야 함', () => {
    const { result } = renderHook(() => useEmotionData(mockOptions));
    const wrongSessionMessage = createEmotionMessage();
    wrongSessionMessage.session_id = 'wrong-session';

    act(() => {
      result.current.handleWebSocketMessage(wrongSessionMessage);
    });

    expect(result.current.currentEmotion).toBeNull();
    expect(result.current.emotionHistory).toHaveLength(0);
  });

  it('데이터 범위 검증이 올바르게 작동해야 함', () => {
    const { result } = renderHook(() => useEmotionData(mockOptions));
    const invalidMessage = createEmotionMessage({
      energy: 1.5,  // 범위 초과
      valence: -2,  // 범위 초과
      tension: 0.5,
      focus: 0.8
    });

    act(() => {
      result.current.handleWebSocketMessage(invalidMessage);
    });

    expect(result.current.currentEmotion?.energy).toBe(1);  // 1로 제한됨
    expect(result.current.currentEmotion?.valence).toBe(-1);  // -1로 제한됨
  });

  it('스무딩이 올바르게 작동해야 함', () => {
    const { result } = renderHook(() => useEmotionData(mockOptions));

    // 여러 데이터 포인트 추가
    act(() => {
      result.current.addEmotionData({ energy: 1.0, valence: 1.0, tension: 1.0, focus: 1.0, confidence: 1.0 });
    });

    act(() => {
      result.current.addEmotionData({ energy: 0.0, valence: 0.0, tension: 0.0, focus: 0.0, confidence: 0.0 });
    });

    act(() => {
      result.current.addEmotionData({ energy: 0.5, valence: 0.5, tension: 0.5, focus: 0.5, confidence: 0.5 });
    });

    // 스무딩된 값이 평균에 가까워야 함
    expect(result.current.smoothedEmotion?.energy).toBeCloseTo(0.5, 1);
    expect(result.current.smoothedEmotion?.valence).toBeCloseTo(0.5, 1);
  });

  it('히스토리 크기 제한이 올바르게 작동해야 함', () => {
    const { result } = renderHook(() => useEmotionData(mockOptions));

    // maxHistorySize(5)보다 많은 데이터 추가
    for (let i = 0; i < 7; i++) {
      act(() => {
        result.current.addEmotionData({
          energy: 0.5,
          valence: 0.5,
          tension: 0.5,
          focus: 0.5,
          confidence: 0.5
        });
      });
    }

    expect(result.current.emotionHistory).toHaveLength(5);
  });

  it('트렌드 분석이 올바르게 작동해야 함', () => {
    const { result } = renderHook(() => useEmotionData(mockOptions));

    // 증가하는 패턴의 데이터 추가
    act(() => {
      result.current.addEmotionData({ energy: 0.2, valence: 0.2, tension: 0.2, focus: 0.2, confidence: 0.9 });
    });

    act(() => {
      result.current.addEmotionData({ energy: 0.5, valence: 0.5, tension: 0.5, focus: 0.5, confidence: 0.9 });
    });

    act(() => {
      result.current.addEmotionData({ energy: 0.8, valence: 0.8, tension: 0.8, focus: 0.8, confidence: 0.9 });
    });

    expect(result.current.emotionTrends).toHaveLength(4);
    const energyTrend = result.current.emotionTrends.find(t => t.metric === 'energy');
    expect(energyTrend?.direction).toBe('increasing');
  });

  it('감정 요약이 올바르게 계산되어야 함', () => {
    const { result } = renderHook(() => useEmotionData(mockOptions));

    act(() => {
      result.current.addEmotionData({ energy: 0.8, valence: 0.6, tension: 0.3, focus: 0.7, confidence: 0.9 });
    });

    act(() => {
      result.current.addEmotionData({ energy: 0.9, valence: 0.5, tension: 0.2, focus: 0.8, confidence: 0.9 });
    });

    expect(result.current.emotionSummary).toBeTruthy();
    expect(result.current.emotionSummary?.dominantEmotion).toBe('energetic');
    expect(result.current.emotionSummary?.dataCount).toBe(2);
  });

  it('데이터 품질이 올바르게 계산되어야 함', () => {
    const { result } = renderHook(() => useEmotionData(mockOptions));

    // 높은 신뢰도 데이터
    act(() => {
      result.current.addEmotionData({
        energy: 0.7,
        valence: 0.3,
        tension: 0.5,
        focus: 0.8,
        confidence: 0.9
      });
    });

    expect(result.current.dataQuality).toBe('excellent');

    // 낮은 신뢰도 데이터
    act(() => {
      result.current.addEmotionData({
        energy: 0.7,
        valence: 0.3,
        tension: 0.5,
        focus: 0.8,
        confidence: 0.2
      });
    });

    expect(result.current.dataQuality).toBe('poor');
  });

  it('히스토리 정리가 올바르게 작동해야 함', () => {
    const { result } = renderHook(() => useEmotionData(mockOptions));

    // 데이터 추가
    act(() => {
      result.current.addEmotionData({
        energy: 0.7,
        valence: 0.3,
        tension: 0.5,
        focus: 0.8,
        confidence: 0.9
      });
    });

    expect(result.current.emotionHistory).toHaveLength(1);

    // 히스토리 정리
    act(() => {
      result.current.clearHistory();
    });

    expect(result.current.emotionHistory).toHaveLength(0);
    expect(result.current.currentEmotion).toBeNull();
    expect(result.current.smoothedEmotion).toBeNull();
    expect(result.current.isReceivingData).toBe(false);
  });

  it('데이터 수신 타임아웃이 올바르게 작동해야 함', () => {
    const { result } = renderHook(() => useEmotionData(mockOptions));

    act(() => {
      result.current.addEmotionData({
        energy: 0.7,
        valence: 0.3,
        tension: 0.5,
        focus: 0.8,
        confidence: 0.9
      });
    });

    expect(result.current.isReceivingData).toBe(true);

    // 5초 후 타임아웃
    act(() => {
      jest.advanceTimersByTime(5001); // 타임아웃 임계값보다 약간 더 진행
    });

    expect(result.current.isReceivingData).toBe(false);
  });
});