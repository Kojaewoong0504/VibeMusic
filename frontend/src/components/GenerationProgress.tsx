/**
 * GenerationProgress Component
 *
 * AI 음악 생성 진행 상황을 시각화하는 컴포넌트
 * 단계별 상태, 진행률, 예상 완료 시간, 취소 기능 등을 제공
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { GeneratedMusic } from '../../../shared/types/api';

interface GenerationStep {
  id: string;
  label: string;
  description: string;
  duration: number; // 예상 소요 시간 (초)
  completed: boolean;
  active: boolean;
}

interface GenerationProgressProps {
  /** 생성 중인 음악 정보 */
  music: GeneratedMusic | null;

  /** 현재 진행률 (0-100) */
  progress?: number;

  /** 예상 완료 시간 (초) */
  estimatedTime?: number;

  /** 현재 단계 */
  currentStep?: string;

  /** 취소 가능 여부 */
  cancellable?: boolean;

  /** 취소 이벤트 */
  onCancel?: () => void;

  /** 완료 이벤트 */
  onComplete?: (music: GeneratedMusic) => void;

  /** 오류 이벤트 */
  onError?: (error: string) => void;

  /** 컴팩트 모드 */
  compact?: boolean;

  /** CSS 클래스명 */
  className?: string;
}

const GenerationProgress: React.FC<GenerationProgressProps> = ({
  music,
  progress = 0,
  estimatedTime = 30,
  currentStep = 'analyzing',
  cancellable = true,
  onCancel,
  onComplete,
  onError,
  compact = false,
  className = ''
}) => {
  // State
  const [steps, setSteps] = useState<GenerationStep[]>([
    {
      id: 'analyzing',
      label: '감정 분석',
      description: '타이핑 패턴에서 감정 정보를 추출하고 있습니다',
      duration: 5,
      completed: false,
      active: false
    },
    {
      id: 'processing',
      label: '음악 생성',
      description: 'AI 모델이 감정에 맞는 음악을 생성하고 있습니다',
      duration: 20,
      completed: false,
      active: false
    },
    {
      id: 'finalizing',
      label: '후처리',
      description: '음악 파일을 최적화하고 메타데이터를 추가하고 있습니다',
      duration: 5,
      completed: false,
      active: false
    }
  ]);

  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime] = useState(Date.now());
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // 경과 시간 업데이트
  useEffect(() => {
    if (!music || music.status !== 'generating') return;

    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [music, startTime]);

  // 단계별 상태 업데이트
  useEffect(() => {
    setSteps(prevSteps =>
      prevSteps.map(step => ({
        ...step,
        active: step.id === currentStep,
        completed: step.id === 'analyzing' && ['processing', 'finalizing'].includes(currentStep) ||
                  step.id === 'processing' && currentStep === 'finalizing'
      }))
    );
  }, [currentStep]);

  // 음악 상태 변화 감지
  useEffect(() => {
    if (!music) return;

    if (music.status === 'completed' && onComplete) {
      onComplete(music);
    } else if (music.status === 'failed' && onError) {
      onError(music.error_message || '음악 생성에 실패했습니다.');
    }
  }, [music, onComplete, onError]);

  // 시간 포맷팅
  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // 남은 시간 계산
  const getRemainingTime = useCallback((): number => {
    const remaining = Math.max(0, estimatedTime - elapsedTime);
    return remaining;
  }, [estimatedTime, elapsedTime]);

  // 취소 확인 처리
  const handleCancelConfirm = useCallback(() => {
    setShowCancelConfirm(false);
    onCancel?.();
  }, [onCancel]);

  // 단계별 아이콘
  const getStepIcon = useCallback((step: GenerationStep) => {
    if (step.completed) {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-success">
          <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M11,16.5L18,9.5L16.59,8.09L11,13.67L7.41,10.09L6,11.5L11,16.5Z" />
        </svg>
      );
    }

    if (step.active) {
      return (
        <div className="spinner spinner--sm text-primary-500" />
      );
    }

    return (
      <div className="w-5 h-5 rounded-full border-2 border-neutral-300" />
    );
  }, []);

  // 전체 진행률 계산
  const getOverallProgress = useCallback((): number => {
    const completedSteps = steps.filter(s => s.completed).length;
    const activeStepProgress = steps.find(s => s.active) ? progress / 100 : 0;
    return ((completedSteps + activeStepProgress) / steps.length) * 100;
  }, [steps, progress]);

  const overallProgress = getOverallProgress();
  const remainingTime = getRemainingTime();

  // 음악이 없거나 생성 중이 아닌 경우
  if (!music || music.status !== 'generating') {
    return null;
  }

  // 컴팩트 모드
  if (compact) {
    return (
      <div className={`generation-progress-compact flex items-center gap-4 p-3 bg-white rounded-lg shadow-sm ${className}`}>
        {/* 진행률 바 */}
        <div className="flex-1">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-neutral-700">
              음악 생성 중...
            </span>
            <span className="text-xs text-neutral-500">
              {Math.round(overallProgress)}%
            </span>
          </div>
          <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 transition-all duration-500 generating"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>

        {/* 남은 시간 */}
        <div className="text-sm text-neutral-600 font-mono">
          {formatTime(remainingTime)}
        </div>

        {/* 취소 버튼 */}
        {cancellable && onCancel && (
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => setShowCancelConfirm(true)}
            aria-label="생성 취소"
          >
            취소
          </button>
        )}
      </div>
    );
  }

  // 상세 모드 (기본)
  return (
    <div className={`generation-progress bg-white rounded-lg shadow-lg overflow-hidden ${className}`}>
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold mb-1">
              AI 음악 생성 중
            </h3>
            <p className="text-primary-100 text-sm">
              감정을 담은 음악을 만들고 있습니다...
            </p>
          </div>

          <div className="text-right">
            <div className="text-2xl font-bold font-mono">
              {Math.round(overallProgress)}%
            </div>
            <div className="text-primary-200 text-sm">
              완료
            </div>
          </div>
        </div>

        {/* 전체 진행률 바 */}
        <div className="mt-4">
          <div className="w-full h-3 bg-primary-400 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-500"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className="p-6">
        {/* 단계별 진행 상황 */}
        <div className="space-y-4 mb-6">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-1">
                {getStepIcon(step)}
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className={`font-medium ${step.completed ? 'text-success' : step.active ? 'text-primary-600' : 'text-neutral-500'}`}>
                    {step.label}
                  </h4>
                  {step.active && (
                    <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded-full">
                      진행 중
                    </span>
                  )}
                  {step.completed && (
                    <span className="text-xs bg-success text-white px-2 py-1 rounded-full">
                      완료
                    </span>
                  )}
                </div>

                <p className={`text-sm mt-1 ${step.active ? 'text-neutral-700' : 'text-neutral-500'}`}>
                  {step.description}
                </p>

                {/* 개별 단계 진행률 */}
                {step.active && (
                  <div className="mt-2 w-full h-1 bg-neutral-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </div>

              <div className="text-xs text-neutral-400 mt-1">
                ~{step.duration}초
              </div>
            </div>
          ))}
        </div>

        {/* 시간 정보 */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="text-center p-3 bg-neutral-50 rounded-lg">
            <div className="text-lg font-bold text-neutral-700 font-mono">
              {formatTime(elapsedTime)}
            </div>
            <div className="text-xs text-neutral-500">경과 시간</div>
          </div>

          <div className="text-center p-3 bg-neutral-50 rounded-lg">
            <div className="text-lg font-bold text-primary-600 font-mono">
              {formatTime(remainingTime)}
            </div>
            <div className="text-xs text-neutral-500">예상 남은 시간</div>
          </div>
        </div>

        {/* 생성 정보 */}
        {music && (
          <div className="p-4 bg-info bg-opacity-10 rounded-lg mb-4">
            <div className="flex items-center gap-2 mb-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-info">
                <path d="M12,3V13.55C11.41,13.21 10.73,13 10,13A3,3 0 0,0 7,16A3,3 0 0,0 10,19A3,3 0 0,0 13,16V7H18V5H12V3Z" />
              </svg>
              <span className="text-sm font-medium text-info">생성 정보</span>
            </div>
            <div className="text-sm text-neutral-600 space-y-1">
              <div>형식: {music.format?.toUpperCase() || 'WAV'}</div>
              <div>길이: {music.duration || 30}초</div>
              <div>ID: #{music.id.slice(-8)}</div>
            </div>
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex justify-between items-center">
          <div className="text-sm text-neutral-500">
            음악 생성을 취소하면 현재까지의 작업이 모두 삭제됩니다.
          </div>

          {cancellable && onCancel && (
            <button
              className="btn btn--danger"
              onClick={() => setShowCancelConfirm(true)}
            >
              생성 취소
            </button>
          )}
        </div>
      </div>

      {/* 취소 확인 모달 */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" role="dialog">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold mb-4">생성 취소 확인</h3>
            <p className="text-neutral-600 mb-6">
              정말로 음악 생성을 취소하시겠습니까?
              <br />
              현재까지의 작업이 모두 삭제됩니다.
            </p>

            <div className="flex gap-3">
              <button
                className="btn btn--ghost flex-1"
                onClick={() => setShowCancelConfirm(false)}
              >
                계속 생성
              </button>
              <button
                className="btn btn--danger flex-1"
                onClick={handleCancelConfirm}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GenerationProgress;