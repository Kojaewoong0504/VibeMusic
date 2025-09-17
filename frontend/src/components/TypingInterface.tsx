/**
 * TypingInterface Component
 *
 * 실시간 타이핑 입력을 받고 시각적 피드백을 제공하는 컴포넌트
 * 키 입력 패턴을 분석하여 감정 생성에 활용
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Keystroke } from '../../../shared/types/websocket';

interface TypingStats {
  wpm: number;
  averageInterval: number;
  pauseCount: number;
  totalChars: number;
  rhythm: 'steady' | 'variable' | 'bursts';
}

interface TypingInterfaceProps {
  /** 타이핑 이벤트 핸들러 */
  onKeystroke?: (keystroke: Keystroke) => void;

  /** 텍스트 변경 이벤트 핸들러 */
  onTextChange?: (text: string) => void;

  /** 타이핑 통계 변경 이벤트 핸들러 */
  onStatsChange?: (stats: TypingStats) => void;

  /** 프롬프트 텍스트 */
  prompt?: string;

  /** 플레이스홀더 텍스트 */
  placeholder?: string;

  /** 최대 글자 수 */
  maxLength?: number;

  /** 비활성화 상태 */
  disabled?: boolean;

  /** 활성 상태 (WebSocket 연결 등) */
  isActive?: boolean;

  /** CSS 클래스명 */
  className?: string;
}

const TypingInterface: React.FC<TypingInterfaceProps> = ({
  onKeystroke,
  onTextChange,
  onStatsChange,
  prompt = "당신의 감정을 자유롭게 타이핑해보세요...",
  placeholder = "여기에 입력하세요",
  maxLength = 1000,
  disabled = false,
  isActive = false,
  className = ''
}) => {
  // State
  const [text, setText] = useState('');
  const [stats, setStats] = useState<TypingStats>({
    wpm: 0,
    averageInterval: 0,
    pauseCount: 0,
    totalChars: 0,
    rhythm: 'steady'
  });
  const [isTyping, setIsTyping] = useState(false);
  const [recentKeystrokes, setRecentKeystrokes] = useState<number[]>([]);

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const startTimeRef = useRef<number>(Date.now());
  const lastKeystrokeRef = useRef<number>(0);
  const keystrokeTimesRef = useRef<number[]>([]);
  const pauseTimeoutRef = useRef<NodeJS.Timeout>();

  // 타이핑 리듬 분석
  const analyzeRhythm = useCallback((intervals: number[]): 'steady' | 'variable' | 'bursts' => {
    if (intervals.length < 3) return 'steady';

    const avg = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avg, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);

    // 표준편차가 평균의 30% 이상이면 variable
    if (stdDev > avg * 0.3) return 'variable';

    // 연속된 빠른 입력이 많으면 bursts
    const fastIntervals = intervals.filter(interval => interval < avg * 0.7);
    if (fastIntervals.length > intervals.length * 0.4) return 'bursts';

    return 'steady';
  }, []);

  // 타이핑 통계 업데이트
  const updateStats = useCallback(() => {
    const now = Date.now();
    const elapsedMinutes = (now - startTimeRef.current) / 60000;
    const wpm = elapsedMinutes > 0 ? Math.round((text.length / 5) / elapsedMinutes) : 0;

    const intervals = keystrokeTimesRef.current.slice(-20).reduce((acc, time, index, arr) => {
      if (index > 0) {
        acc.push(time - arr[index - 1]);
      }
      return acc;
    }, [] as number[]);

    const averageInterval = intervals.length > 0
      ? intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
      : 0;

    const pauseCount = intervals.filter(interval => interval > 1000).length;
    const rhythm = analyzeRhythm(intervals);

    const newStats: TypingStats = {
      wpm,
      averageInterval: Math.round(averageInterval),
      pauseCount,
      totalChars: text.length,
      rhythm
    };

    setStats(newStats);
    onStatsChange?.(newStats);
  }, [text.length, analyzeRhythm, onStatsChange]);

  // 키스트로크 처리
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const now = Date.now();

    // 특수 키 필터링 (Shift, Ctrl, Alt 등 제외)
    if (e.key.length > 1 && !['Enter', 'Backspace', 'Delete', 'Tab', 'Space'].includes(e.key)) {
      return;
    }

    const keystroke: Keystroke = {
      key: e.key === ' ' ? 'Space' : e.key,
      timestamp: now,
      event_type: 'keydown',
      modifiers: [
        ...(e.ctrlKey ? ['ctrl' as const] : []),
        ...(e.altKey ? ['alt' as const] : []),
        ...(e.shiftKey ? ['shift' as const] : []),
        ...(e.metaKey ? ['meta' as const] : [])
      ]
    };

    // 키스트로크 이벤트 발생
    onKeystroke?.(keystroke);

    // 타이핑 상태 업데이트
    setIsTyping(true);

    // 최근 키스트로크 시간 업데이트 (시각적 피드백용)
    setRecentKeystrokes(prev => [...prev.slice(-4), now]);

    // 키스트로크 시간 기록
    keystrokeTimesRef.current.push(now);
    if (keystrokeTimesRef.current.length > 50) {
      keystrokeTimesRef.current = keystrokeTimesRef.current.slice(-30);
    }

    lastKeystrokeRef.current = now;

    // 일시정지 감지 타이머 재설정
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
    }

    pauseTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1000);
  }, [onKeystroke]);

  // 텍스트 변경 처리
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;

    if (newText.length <= maxLength) {
      setText(newText);
      onTextChange?.(newText);
    }
  }, [maxLength, onTextChange]);

  // 통계 업데이트
  useEffect(() => {
    const interval = setInterval(updateStats, 1000);
    return () => clearInterval(interval);
  }, [updateStats]);

  // 포커스 관리
  useEffect(() => {
    if (isActive && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isActive]);

  // 타이핑 활동 표시 (최근 키스트로크 기반)
  const getTypingIntensity = (): number => {
    const now = Date.now();
    const recentCount = recentKeystrokes.filter(time => now - time < 2000).length;
    return Math.min(recentCount / 5, 1); // 0-1 범위로 정규화
  };

  const intensity = getTypingIntensity();

  return (
    <div className={`typing-interface ${isActive ? 'typing-interface--active' : ''} ${className}`}>
      {/* 프롬프트 섹션 */}
      <div className="typing-interface__prompt">
        <h3 className="text-lg font-medium text-neutral-800 mb-2">
          {prompt}
        </h3>

        {/* 활동 상태 표시 */}
        <div className="flex items-center gap-2 mb-4">
          <div
            className={`w-3 h-3 rounded-full transition-colors ${
              isActive
                ? isTyping
                  ? 'bg-success animate-pulse'
                  : 'bg-primary-500'
                : 'bg-neutral-300'
            }`}
            aria-label={
              isActive
                ? isTyping
                  ? '타이핑 중'
                  : '연결됨'
                : '연결 안됨'
            }
          />
          <span className="text-sm text-neutral-600">
            {isActive
              ? isTyping
                ? '타이핑 중...'
                : '입력 대기 중'
              : '연결 안됨'}
          </span>
        </div>
      </div>

      {/* 입력 영역 */}
      <div className="typing-interface__input-container relative">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          className={`
            textarea
            min-h-[200px]
            resize-none
            ${intensity > 0.7 ? 'border-primary-400 shadow-glow-sm' : ''}
            ${isTyping ? 'border-primary-300' : ''}
          `}
          style={{
            background: intensity > 0
              ? `linear-gradient(135deg, rgba(124, 109, 255, ${intensity * 0.1}), transparent)`
              : undefined
          }}
          aria-label="감정 표현 텍스트 입력"
          aria-describedby="typing-stats character-count"
        />

        {/* 타이핑 활동 시각화 */}
        <div className="absolute top-2 right-2 flex gap-1">
          {recentKeystrokes.slice(-5).map((time, index) => (
            <div
              key={`${time}-${index}`}
              className="w-2 h-2 bg-primary-400 rounded-full animate-pulse"
              style={{
                opacity: 1 - (index * 0.2),
                animationDelay: `${index * 0.1}s`
              }}
            />
          ))}
        </div>

        {/* 글자 수 표시 */}
        <div
          id="character-count"
          className={`
            absolute bottom-2 right-2 text-xs px-2 py-1 rounded
            ${text.length > maxLength * 0.9
              ? 'bg-warning text-white'
              : 'bg-neutral-100 text-neutral-600'}
          `}
        >
          {text.length}/{maxLength}
        </div>
      </div>

      {/* 타이핑 통계 표시 */}
      <div id="typing-stats" className="typing-stats mt-4" role="status" aria-live="polite">
        <div className="typing-stat">
          <div className="typing-stat__value">{stats.wpm}</div>
          <div className="typing-stat__label">WPM</div>
        </div>

        <div className="typing-stat">
          <div className="typing-stat__value">{stats.averageInterval}ms</div>
          <div className="typing-stat__label">평균 간격</div>
        </div>

        <div className="typing-stat">
          <div className="typing-stat__value">{stats.pauseCount}</div>
          <div className="typing-stat__label">일시정지</div>
        </div>

        <div className="typing-stat">
          <div className="typing-stat__value">
            <span className={`
              inline-block w-3 h-3 rounded-full mr-1
              ${stats.rhythm === 'steady' ? 'bg-success' :
                stats.rhythm === 'variable' ? 'bg-warning' : 'bg-error'}
            `} />
            {stats.rhythm === 'steady' ? '규칙적' :
             stats.rhythm === 'variable' ? '가변적' : '폭발적'}
          </div>
          <div className="typing-stat__label">리듬</div>
        </div>
      </div>

      {/* 진행률 표시 */}
      <div className="mt-4">
        <div className="flex justify-between items-center text-sm text-neutral-600 mb-1">
          <span>입력 진행률</span>
          <span>{Math.round((text.length / 100) * 100)}%</span>
        </div>
        <div className="progress">
          <div
            className="progress__bar"
            style={{ width: `${Math.min((text.length / 100) * 100, 100)}%` }}
            role="progressbar"
            aria-valuenow={Math.min(text.length, 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="입력 진행률"
          />
        </div>
        <div className="text-xs text-neutral-500 mt-1">
          음악 생성을 위해서는 최소 50자 이상 입력해주세요
        </div>
      </div>
    </div>
  );
};

export default TypingInterface;