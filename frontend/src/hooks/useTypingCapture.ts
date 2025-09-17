import { useState, useEffect, useCallback, useRef } from 'react';
import { TypingEvent, TypingPattern } from './types';

interface UseTypingCaptureOptions {
  enabled?: boolean;
  bufferSize?: number; // 버퍼에 저장할 최대 이벤트 수
  analysisWindowMs?: number; // 패턴 분석 윈도우 시간 (ms)
}

interface UseTypingCaptureReturn {
  events: TypingEvent[];
  pattern: TypingPattern | null;
  isCapturing: boolean;
  startCapture: () => void;
  stopCapture: () => void;
  clearBuffer: () => void;
}

export function useTypingCapture(options: UseTypingCaptureOptions = {}): UseTypingCaptureReturn {
  const {
    enabled = false,
    bufferSize = 1000,
    analysisWindowMs = 5000
  } = options;

  const [events, setEvents] = useState<TypingEvent[]>([]);
  const [pattern, setPattern] = useState<TypingPattern | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const bufferRef = useRef<TypingEvent[]>([]);
  const lastAnalysisRef = useRef<number>(0);

  // 키 이벤트를 TypingEvent로 변환
  const createTypingEvent = useCallback((event: KeyboardEvent, isKeyDown: boolean): TypingEvent => {
    return {
      key: event.key,
      timestamp: Date.now(),
      keyCode: event.keyCode || event.which,
      isKeyDown
    };
  }, []);

  // 타이핑 패턴 분석
  const analyzePattern = useCallback((eventWindow: TypingEvent[]): TypingPattern => {
    if (eventWindow.length < 2) {
      return {
        speed: 0,
        rhythm: 0,
        pauses: [],
        consistency: 0,
        pressure: 0
      };
    }

    const keydownEvents = eventWindow.filter(e => e.isKeyDown);
    const intervals = [];
    const pauses = [];

    // 키 입력 간격 계산
    for (let i = 1; i < keydownEvents.length; i++) {
      const interval = keydownEvents[i].timestamp - keydownEvents[i - 1].timestamp;
      intervals.push(interval);

      // 500ms 이상 간격을 일시정지로 간주
      if (interval > 500) {
        pauses.push(interval);
      }
    }

    // 타이핑 속도 계산 (WPM - Words Per Minute)
    // 평균 단어 길이 5자 기준, 1분당 타이핑한 글자 수 / 5
    const timeSpanMs = keydownEvents[keydownEvents.length - 1].timestamp - keydownEvents[0].timestamp;
    const timeSpanMin = timeSpanMs / 60000;
    const speed = timeSpanMin > 0 ? (keydownEvents.length / 5) / timeSpanMin : 0;

    // 리듬 점수 계산 (간격의 일관성)
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
    const standardDeviation = Math.sqrt(variance);
    const rhythm = Math.max(0, 1 - (standardDeviation / avgInterval));

    // 일관성 점수 계산
    const consistency = rhythm; // 현재는 리듬과 같은 방식으로 계산

    // 압력/강도 계산 (키 입력 빈도 기준)
    const pressure = Math.min(1, keydownEvents.length / 100); // 100타를 기준으로 정규화

    return {
      speed: Math.round(speed),
      rhythm: Math.round(rhythm * 100) / 100,
      pauses,
      consistency: Math.round(consistency * 100) / 100,
      pressure: Math.round(pressure * 100) / 100
    };
  }, []);

  // 키 다운 이벤트 핸들러
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isCapturing) return;

    const typingEvent = createTypingEvent(event, true);
    bufferRef.current = [...bufferRef.current, typingEvent].slice(-bufferSize);

    setEvents(prev => [...prev, typingEvent].slice(-bufferSize));

    // 주기적으로 패턴 분석 (성능 최적화)
    const now = Date.now();
    if (now - lastAnalysisRef.current > 1000) { // 1초마다 분석
      const windowStart = now - analysisWindowMs;
      const eventWindow = bufferRef.current.filter(e => e.timestamp >= windowStart);
      const newPattern = analyzePattern(eventWindow);
      setPattern(newPattern);
      lastAnalysisRef.current = now;
    }
  }, [isCapturing, createTypingEvent, bufferSize, analysisWindowMs, analyzePattern]);

  // 키 업 이벤트 핸들러
  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    if (!isCapturing) return;

    const typingEvent = createTypingEvent(event, false);
    bufferRef.current = [...bufferRef.current, typingEvent].slice(-bufferSize);

    setEvents(prev => [...prev, typingEvent].slice(-bufferSize));
  }, [isCapturing, createTypingEvent, bufferSize]);

  // 캡처 시작
  const startCapture = useCallback(() => {
    setIsCapturing(true);
  }, []);

  // 캡처 중지
  const stopCapture = useCallback(() => {
    setIsCapturing(false);
  }, []);

  // 버퍼 클리어
  const clearBuffer = useCallback(() => {
    setEvents([]);
    setPattern(null);
    bufferRef.current = [];
    lastAnalysisRef.current = 0;
  }, []);

  // 이벤트 리스너 등록/해제
  useEffect(() => {
    if (isCapturing) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('keyup', handleKeyUp);
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
    clearBuffer
  };
}