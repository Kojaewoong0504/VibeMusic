/**
 * Optimized Typing Capture Hook
 *
 * T092: 타이핑 패턴 실시간 처리 성능 튜닝
 * - 50ms 미만 레이턴시 목표
 * - 웹워커 활용으로 메인 스레드 부하 분산
 * - 디바운싱/쓰로틀링으로 이벤트 최적화
 * - 메모리 풀과 캐싱으로 GC 압력 감소
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

interface TypingEvent {
  key: string;
  timestamp: number;
  type: 'keydown' | 'keyup';
  duration: number;
}

interface TypingPattern {
  speed: number;
  rhythm: number;
  consistency: number;
  pressure: number;
  pauses: number[];
}

interface PerformanceMetrics {
  eventsProcessed: number;
  avgLatency: number;
  maxLatency: number;
  processingRate: number;
  bufferUtilization: number;
  lastUpdate: number;
}

interface OptimizedTypingCaptureOptions {
  enabled?: boolean;
  bufferSize?: number;
  analysisWindowMs?: number;
  throttleMs?: number;
  debounceMs?: number;
  useWebWorker?: boolean;
  maxLatencyMs?: number;
}

interface OptimizedTypingCaptureReturn {
  events: TypingEvent[];
  pattern: TypingPattern | null;
  metrics: PerformanceMetrics;
  isCapturing: boolean;
  isWorkerReady: boolean;
  startCapture: () => void;
  stopCapture: () => void;
  clearBuffer: () => void;
  getLatencyReport: () => string;
}

// 메모리 풀 클래스
class EventMemoryPool {
  private pool: TypingEvent[] = [];
  private poolSize = 1000;

  acquire(): TypingEvent {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return {
      key: '',
      timestamp: 0,
      type: 'keydown',
      duration: 0
    };
  }

  release(event: TypingEvent): void {
    if (this.pool.length < this.poolSize) {
      // 객체 재사용을 위해 리셋
      event.key = '';
      event.timestamp = 0;
      event.type = 'keydown';
      event.duration = 0;
      this.pool.push(event);
    }
  }

  clear(): void {
    this.pool.length = 0;
  }
}

// 스로틀링 유틸리티
class Throttle {
  private lastExecution = 0;
  private timeoutId: number | null = null;

  constructor(private interval: number) {}

  execute(callback: () => void): void {
    const now = performance.now();

    if (now - this.lastExecution >= this.interval) {
      this.lastExecution = now;
      callback();
    } else if (!this.timeoutId) {
      this.timeoutId = window.setTimeout(() => {
        this.lastExecution = performance.now();
        this.timeoutId = null;
        callback();
      }, this.interval - (now - this.lastExecution));
    }
  }

  clear(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

// 디바운싱 유틸리티
class Debounce {
  private timeoutId: number | null = null;

  constructor(private delay: number) {}

  execute(callback: () => void): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = window.setTimeout(() => {
      this.timeoutId = null;
      callback();
    }, this.delay);
  }

  clear(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

// 링 버퍼 구현
class RingBuffer<T> {
  private buffer: T[] = [];
  private head = 0;
  private tail = 0;
  private count = 0;

  constructor(private capacity: number) {
    this.buffer = new Array(capacity);
  }

  push(item: T): void {
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;

    if (this.count < this.capacity) {
      this.count++;
    } else {
      this.head = (this.head + 1) % this.capacity;
    }
  }

  toArray(): T[] {
    if (this.count === 0) return [];

    const result: T[] = [];
    let current = this.head;

    for (let i = 0; i < this.count; i++) {
      result.push(this.buffer[current]);
      current = (current + 1) % this.capacity;
    }

    return result;
  }

  clear(): void {
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }

  size(): number {
    return this.count;
  }

  isFull(): boolean {
    return this.count === this.capacity;
  }
}

export function useOptimizedTypingCapture(
  options: OptimizedTypingCaptureOptions = {}
): OptimizedTypingCaptureReturn {
  const {
    enabled = false,
    bufferSize = 1000,
    analysisWindowMs = 5000,
    throttleMs = 16, // ~60fps
    debounceMs = 100,
    useWebWorker = true,
    maxLatencyMs = 50
  } = options;

  // 상태
  const [isCapturing, setIsCapturing] = useState(false);
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const [pattern, setPattern] = useState<TypingPattern | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    eventsProcessed: 0,
    avgLatency: 0,
    maxLatency: 0,
    processingRate: 0,
    bufferUtilization: 0,
    lastUpdate: Date.now()
  });

  // 참조들
  const ringBuffer = useRef(new RingBuffer<TypingEvent>(bufferSize));
  const memoryPool = useRef(new EventMemoryPool());
  const workerRef = useRef<Worker | null>(null);
  const throttle = useRef(new Throttle(throttleMs));
  const debounce = useRef(new Debounce(debounceMs));
  const metricsRef = useRef(metrics);
  const eventTimestamps = useRef<number[]>([]);

  // 성능 메트릭 업데이트
  const updateMetrics = useCallback((eventLatency?: number) => {
    const now = Date.now();
    const currentMetrics = { ...metricsRef.current };

    if (eventLatency !== undefined) {
      currentMetrics.eventsProcessed++;

      // 이동 평균 계산
      if (currentMetrics.avgLatency === 0) {
        currentMetrics.avgLatency = eventLatency;
      } else {
        const alpha = 0.1;
        currentMetrics.avgLatency =
          (1 - alpha) * currentMetrics.avgLatency + alpha * eventLatency;
      }

      if (eventLatency > currentMetrics.maxLatency) {
        currentMetrics.maxLatency = eventLatency;
      }
    }

    // 처리율 계산 (events per second)
    eventTimestamps.current = eventTimestamps.current.filter(t => now - t < 1000);
    currentMetrics.processingRate = eventTimestamps.current.length;

    // 버퍼 사용률
    currentMetrics.bufferUtilization =
      (ringBuffer.current.size() / bufferSize) * 100;

    currentMetrics.lastUpdate = now;

    metricsRef.current = currentMetrics;
    setMetrics(currentMetrics);
  }, [bufferSize]);

  // 웹워커 초기화
  useEffect(() => {
    if (!useWebWorker) {
      setIsWorkerReady(true);
      return;
    }

    const workerCode = `
      // Web Worker for typing pattern analysis
      let analysisBuffer = [];

      function analyzePattern(events) {
        if (events.length < 2) return null;

        const keydownEvents = events.filter(e => e.type === 'keydown');
        if (keydownEvents.length < 2) return null;

        // 간격 계산
        const intervals = [];
        for (let i = 1; i < keydownEvents.length; i++) {
          intervals.push(keydownEvents[i].timestamp - keydownEvents[i-1].timestamp);
        }

        // 타이핑 속도 (WPM)
        const timeSpan = keydownEvents[keydownEvents.length - 1].timestamp - keydownEvents[0].timestamp;
        const minutes = timeSpan / 60000;
        const speed = minutes > 0 ? (keydownEvents.length / 5) / minutes : 0;

        // 리듬 일관성
        const avgInterval = intervals.reduce((sum, int) => sum + int, 0) / intervals.length;
        const variance = intervals.reduce((sum, int) => sum + Math.pow(int - avgInterval, 2), 0) / intervals.length;
        const stdDev = Math.sqrt(variance);
        const rhythm = Math.max(0, 1 - (stdDev / avgInterval));

        // 일관성
        const consistency = rhythm;

        // 압력/강도
        const pressure = Math.min(1, keydownEvents.length / 100);

        // 일시정지
        const pauses = intervals.filter(int => int > 500);

        return {
          speed: Math.round(speed),
          rhythm: Math.round(rhythm * 100) / 100,
          consistency: Math.round(consistency * 100) / 100,
          pressure: Math.round(pressure * 100) / 100,
          pauses
        };
      }

      self.onmessage = function(e) {
        const { type, events } = e.data;

        if (type === 'analyze') {
          const pattern = analyzePattern(events);
          self.postMessage({ type: 'pattern', pattern });
        }
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));

    worker.onmessage = (e) => {
      const { type, pattern } = e.data;
      if (type === 'pattern' && pattern) {
        setPattern(pattern);
      }
    };

    worker.onerror = (error) => {
      console.warn('Web Worker error, falling back to main thread:', error);
      setIsWorkerReady(true);
    };

    workerRef.current = worker;
    setIsWorkerReady(true);

    return () => {
      worker.terminate();
      URL.revokeObjectURL(blob);
    };
  }, [useWebWorker]);

  // 패턴 분석 (웹워커 없을 때)
  const analyzePatternSync = useCallback((events: TypingEvent[]): TypingPattern | null => {
    if (events.length < 2) return null;

    const keydownEvents = events.filter(e => e.type === 'keydown');
    if (keydownEvents.length < 2) return null;

    const intervals = [];
    for (let i = 1; i < keydownEvents.length; i++) {
      intervals.push(keydownEvents[i].timestamp - keydownEvents[i-1].timestamp);
    }

    const timeSpan = keydownEvents[keydownEvents.length - 1].timestamp - keydownEvents[0].timestamp;
    const minutes = timeSpan / 60000;
    const speed = minutes > 0 ? (keydownEvents.length / 5) / minutes : 0;

    const avgInterval = intervals.reduce((sum, int) => sum + int, 0) / intervals.length;
    const variance = intervals.reduce((sum, int) => sum + Math.pow(int - avgInterval, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    const rhythm = Math.max(0, 1 - (stdDev / avgInterval));

    const consistency = rhythm;
    const pressure = Math.min(1, keydownEvents.length / 100);
    const pauses = intervals.filter(int => int > 500);

    return {
      speed: Math.round(speed),
      rhythm: Math.round(rhythm * 100) / 100,
      consistency: Math.round(consistency * 100) / 100,
      pressure: Math.round(pressure * 100) / 100,
      pauses
    };
  }, []);

  // 이벤트 처리
  const processEvent = useCallback((event: KeyboardEvent, type: 'keydown' | 'keyup') => {
    const startTime = performance.now();

    if (!isCapturing) return;

    // 메모리 풀에서 이벤트 객체 가져오기
    const typingEvent = memoryPool.current.acquire();
    typingEvent.key = event.key;
    typingEvent.timestamp = Date.now();
    typingEvent.type = type;
    typingEvent.duration = type === 'keyup' ? performance.now() - startTime : 0;

    // 링 버퍼에 추가
    ringBuffer.current.push(typingEvent);

    // 메트릭 업데이트
    eventTimestamps.current.push(Date.now());
    const eventLatency = performance.now() - startTime;
    updateMetrics(eventLatency);

    // 레이턴시 경고
    if (eventLatency > maxLatencyMs) {
      console.warn(`⚠️ High latency detected: ${eventLatency.toFixed(2)}ms (target: ${maxLatencyMs}ms)`);
    }

    // 스로틀된 패턴 분석
    throttle.current.execute(() => {
      const recentEvents = ringBuffer.current.toArray()
        .filter(e => Date.now() - e.timestamp < analysisWindowMs);

      if (recentEvents.length >= 10) {
        if (useWebWorker && workerRef.current && isWorkerReady) {
          // 웹워커로 분석
          workerRef.current.postMessage({
            type: 'analyze',
            events: recentEvents
          });
        } else {
          // 메인 스레드에서 분석
          debounce.current.execute(() => {
            const newPattern = analyzePatternSync(recentEvents);
            if (newPattern) {
              setPattern(newPattern);
            }
          });
        }
      }
    });
  }, [isCapturing, updateMetrics, maxLatencyMs, analysisWindowMs, analyzePatternSync, useWebWorker, isWorkerReady]);

  // 키보드 이벤트 핸들러들
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    processEvent(event, 'keydown');
  }, [processEvent]);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    processEvent(event, 'keyup');
  }, [processEvent]);

  // 컨트롤 함수들
  const startCapture = useCallback(() => {
    setIsCapturing(true);
  }, []);

  const stopCapture = useCallback(() => {
    setIsCapturing(false);
    throttle.current.clear();
    debounce.current.clear();
  }, []);

  const clearBuffer = useCallback(() => {
    ringBuffer.current.clear();
    memoryPool.current.clear();
    setPattern(null);
    setMetrics({
      eventsProcessed: 0,
      avgLatency: 0,
      maxLatency: 0,
      processingRate: 0,
      bufferUtilization: 0,
      lastUpdate: Date.now()
    });
    eventTimestamps.current = [];
  }, []);

  // 레이턴시 리포트
  const getLatencyReport = useCallback(() => {
    const { avgLatency, maxLatency, processingRate } = metricsRef.current;

    const status = avgLatency < maxLatencyMs ? '✅' : '⚠️';
    return `${status} Avg: ${avgLatency.toFixed(2)}ms | Max: ${maxLatency.toFixed(2)}ms | Rate: ${processingRate.toFixed(1)}evt/s`;
  }, [maxLatencyMs]);

  // 이벤트 리스너 등록
  useEffect(() => {
    if (isCapturing) {
      document.addEventListener('keydown', handleKeyDown, { passive: true });
      document.addEventListener('keyup', handleKeyUp, { passive: true });
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [isCapturing, handleKeyDown, handleKeyUp]);

  // 활성화 옵션에 따른 자동 시작/중지
  useEffect(() => {
    if (enabled) {
      startCapture();
    } else {
      stopCapture();
    }
  }, [enabled, startCapture, stopCapture]);

  // 정리
  useEffect(() => {
    return () => {
      stopCapture();
      clearBuffer();
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, [stopCapture, clearBuffer]);

  // 현재 이벤트 배열 (메모화)
  const events = useMemo(() => ringBuffer.current.toArray(), [ringBuffer.current.size()]);

  return {
    events,
    pattern,
    metrics,
    isCapturing,
    isWorkerReady,
    startCapture,
    stopCapture,
    clearBuffer,
    getLatencyReport
  };
}