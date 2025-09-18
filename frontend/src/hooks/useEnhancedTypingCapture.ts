/**
 * T004: 타이핑 이벤트 캡처 시스템 구현
 * Enhanced typing capture system with real-time pattern analysis
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { TypingEvent, TypingPattern } from './types';

interface UseEnhancedTypingCaptureOptions {
  enabled?: boolean;
  bufferSize?: number; // 버퍼에 저장할 최대 이벤트 수
  analysisWindowMs?: number; // 패턴 분석 윈도우 시간 (ms)
  performanceMode?: boolean; // 성능 최적화 모드
}

interface UseEnhancedTypingCaptureReturn {
  events: TypingEvent[];
  pattern: TypingPattern | null;
  isCapturing: boolean;
  startCapture: () => void;
  stopCapture: () => void;
  clearBuffer: () => void;
  performanceMetrics: {
    processingTime: number;
    eventCount: number;
    averageProcessingTime: number;
  };
}

export function useEnhancedTypingCapture(
  options: UseEnhancedTypingCaptureOptions = {}
): UseEnhancedTypingCaptureReturn {
  const {
    enabled = false,
    bufferSize = 1000,
    analysisWindowMs = 5000,
    performanceMode = true
  } = options;

  const [events, setEvents] = useState<TypingEvent[]>([]);
  const [pattern, setPattern] = useState<TypingPattern | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // 성능 메트릭스
  const [performanceMetrics, setPerformanceMetrics] = useState({
    processingTime: 0,
    eventCount: 0,
    averageProcessingTime: 0
  });

  // 내부 상태 관리
  const bufferRef = useRef<TypingEvent[]>([]);
  const lastAnalysisRef = useRef<number>(0);
  const keyDownTimeRef = useRef<Map<string, number>>(new Map());
  const lastEventTimeRef = useRef<number>(0);
  const processingTimesRef = useRef<number[]>([]);

  // 타이핑 이벤트 생성 (T004 요구사항에 맞게 개선)
  const createTypingEvent = useCallback((
    event: KeyboardEvent,
    isKeyDown: boolean,
    startTime: number
  ): TypingEvent => {
    const timestamp = Date.now();
    const key = event.key;

    // duration 계산 (키 누름 시간)
    let duration = 0;
    if (isKeyDown) {
      // 키 다운 시 시작 시간 기록
      keyDownTimeRef.current.set(key, timestamp);
    } else {
      // 키 업 시 duration 계산
      const keyDownTime = keyDownTimeRef.current.get(key);
      if (keyDownTime) {
        duration = timestamp - keyDownTime;
        keyDownTimeRef.current.delete(key);
      }
    }

    // interval 계산 (이전 키와의 간격)
    const interval = lastEventTimeRef.current > 0 ? timestamp - lastEventTimeRef.current : 0;
    lastEventTimeRef.current = timestamp;

    // isBackspace 검사
    const isBackspace = key === 'Backspace' || key === 'Delete';

    return {
      key,
      timestamp,
      duration,
      interval,
      isBackspace,
      // 하위 호환성을 위한 기존 필드
      keyCode: event.keyCode || event.which,
      isKeyDown
    };
  }, []);

  // 타이핑 패턴 분석 (T004 요구사항에 맞게 개선)
  const analyzePattern = useCallback((eventWindow: TypingEvent[]): TypingPattern => {
    const startTime = performance.now();

    if (eventWindow.length < 2) {
      return {
        events: eventWindow,
        averageSpeed: 0,
        rhythmVariation: 0,
        pausePattern: [],
        // 하위 호환성
        speed: 0,
        rhythm: 0,
        pauses: [],
        consistency: 0,
        pressure: 0
      };
    }

    // 키 다운 이벤트만 필터링 (실제 타이핑)
    const typingEvents = eventWindow.filter(e => e.isKeyDown && !e.isBackspace);

    if (typingEvents.length < 2) {
      return {
        events: eventWindow,
        averageSpeed: 0,
        rhythmVariation: 0,
        pausePattern: [],
        speed: 0,
        rhythm: 0,
        pauses: [],
        consistency: 0,
        pressure: 0
      };
    }

    // averageSpeed 계산 (WPM)
    const timeSpanMs = typingEvents[typingEvents.length - 1].timestamp - typingEvents[0].timestamp;
    const timeSpanMin = timeSpanMs / 60000;
    const averageSpeed = timeSpanMin > 0 ? (typingEvents.length / 5) / timeSpanMin : 0;

    // rhythmVariation 계산 (리듬 변화도)
    const intervals = typingEvents.slice(1).map((event, index) =>
      event.timestamp - typingEvents[index].timestamp
    );

    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) =>
      sum + Math.pow(interval - avgInterval, 2), 0
    ) / intervals.length;
    const standardDeviation = Math.sqrt(variance);
    const rhythmVariation = avgInterval > 0 ? standardDeviation / avgInterval : 0;

    // pausePattern 계산 (일시정지 패턴)
    const pausePattern = intervals.filter(interval => interval > 500); // 500ms 이상을 일시정지로 간주

    // 성능 메트릭 업데이트
    const processingTime = performance.now() - startTime;
    processingTimesRef.current.push(processingTime);
    if (processingTimesRef.current.length > 100) {
      processingTimesRef.current = processingTimesRef.current.slice(-50);
    }

    const averageProcessingTime = processingTimesRef.current.reduce((sum, time) => sum + time, 0) /
      processingTimesRef.current.length;

    setPerformanceMetrics({
      processingTime,
      eventCount: eventWindow.length,
      averageProcessingTime
    });

    return {
      events: eventWindow,
      averageSpeed: Math.round(averageSpeed * 100) / 100,
      rhythmVariation: Math.round(rhythmVariation * 100) / 100,
      pausePattern,
      // 하위 호환성을 위한 기존 필드
      speed: Math.round(averageSpeed),
      rhythm: Math.max(0, 1 - rhythmVariation),
      pauses: pausePattern,
      consistency: Math.max(0, 1 - rhythmVariation),
      pressure: Math.min(1, typingEvents.length / 100)
    };
  }, []);

  // 키 다운 이벤트 핸들러
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isCapturing) return;

    const startTime = performance.now();
    const typingEvent = createTypingEvent(event, true, startTime);

    // 버퍼 업데이트
    bufferRef.current = [...bufferRef.current, typingEvent].slice(-bufferSize);
    setEvents(prev => [...prev, typingEvent].slice(-bufferSize));

    // 성능 모드에 따른 분석 주기 조정
    const analysisInterval = performanceMode ? 1000 : 500; // 성능 모드에서는 1초, 일반 모드에서는 0.5초

    const now = Date.now();
    if (now - lastAnalysisRef.current > analysisInterval) {
      const windowStart = now - analysisWindowMs;
      const eventWindow = bufferRef.current.filter(e => e.timestamp >= windowStart);

      if (eventWindow.length > 1) {
        const newPattern = analyzePattern(eventWindow);
        setPattern(newPattern);
        lastAnalysisRef.current = now;
      }
    }
  }, [isCapturing, createTypingEvent, bufferSize, analysisWindowMs, analyzePattern, performanceMode]);

  // 키 업 이벤트 핸들러
  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    if (!isCapturing) return;

    const startTime = performance.now();
    const typingEvent = createTypingEvent(event, false, startTime);

    // 키 업 이벤트도 기록 (duration 계산을 위해 필요)
    bufferRef.current = [...bufferRef.current, typingEvent].slice(-bufferSize);
    setEvents(prev => [...prev, typingEvent].slice(-bufferSize));
  }, [isCapturing, createTypingEvent, bufferSize]);

  // 캡처 시작
  const startCapture = useCallback(() => {
    setIsCapturing(true);
    lastEventTimeRef.current = 0;
    keyDownTimeRef.current.clear();
    console.log('🎯 타이핑 캡처 시작됨');
  }, []);

  // 캡처 중지
  const stopCapture = useCallback(() => {
    setIsCapturing(false);
    console.log('⏹️ 타이핑 캡처 중지됨');
  }, []);

  // 버퍼 클리어
  const clearBuffer = useCallback(() => {
    setEvents([]);
    setPattern(null);
    bufferRef.current = [];
    lastAnalysisRef.current = 0;
    lastEventTimeRef.current = 0;
    keyDownTimeRef.current.clear();
    processingTimesRef.current = [];
    setPerformanceMetrics({
      processingTime: 0,
      eventCount: 0,
      averageProcessingTime: 0
    });
    console.log('🧹 타이핑 버퍼 클리어됨');
  }, []);

  // 이벤트 리스너 등록/해제
  useEffect(() => {
    if (isCapturing) {
      // 브라우저 호환성을 위한 이벤트 옵션
      const options = { passive: true };
      document.addEventListener('keydown', handleKeyDown, options);
      document.addEventListener('keyup', handleKeyUp, options);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [isCapturing, handleKeyDown, handleKeyUp]);

  // enabled 옵션에 따른 자동 시작/중지
  useEffect(() => {
    if (enabled) {
      startCapture();
    } else {
      stopCapture();
    }
  }, [enabled, startCapture, stopCapture]);

  return {
    events,
    pattern,
    isCapturing,
    startCapture,
    stopCapture,
    clearBuffer,
    performanceMetrics
  };
}

export default useEnhancedTypingCapture;