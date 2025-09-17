/**
 * SessionStatus Component
 *
 * 사용자 세션의 현재 상태와 정보를 표시하는 컴포넌트
 * 세션 활성화, 타이밍 정보, 생성된 음악 개수, 자동 삭제 시간 등을 관리
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { UserSession } from '../../../shared/types/api';
import type { ConnectionState } from '../../../shared/types/websocket';

interface SessionStatusProps {
  /** 현재 세션 정보 */
  session: UserSession | null;

  /** WebSocket 연결 상태 */
  connectionState?: ConnectionState;

  /** 생성된 음악 개수 */
  musicCount?: number;

  /** 세션 종료 이벤트 */
  onEndSession?: () => void;

  /** 세션 연장 이벤트 */
  onExtendSession?: (hours: number) => void;

  /** 컴팩트 모드 */
  compact?: boolean;

  /** CSS 클래스명 */
  className?: string;
}

interface TimeInfo {
  elapsed: string;
  remaining: string;
  remainingMs: number;
  isExpiringSoon: boolean;
}

const SessionStatus: React.FC<SessionStatusProps> = ({
  session,
  connectionState = 'disconnected',
  musicCount = 0,
  onEndSession,
  onExtendSession,
  compact = false,
  className = ''
}) => {
  // State
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [showExtendOptions, setShowExtendOptions] = useState(false);

  // 현재 시간 업데이트
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // 시간 정보 계산
  const getTimeInfo = useCallback((): TimeInfo | null => {
    if (!session) return null;

    const startTime = new Date(session.start_time).getTime();
    const deleteTime = new Date(session.auto_delete_at).getTime();
    const elapsedMs = currentTime - startTime;
    const remainingMs = deleteTime - currentTime;

    const formatDuration = (ms: number): string => {
      if (ms <= 0) return '0분';

      const hours = Math.floor(ms / (1000 * 60 * 60));
      const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 0) {
        return `${hours}시간 ${minutes}분`;
      }
      return `${minutes}분`;
    };

    return {
      elapsed: formatDuration(elapsedMs),
      remaining: formatDuration(remainingMs),
      remainingMs,
      isExpiringSoon: remainingMs < 30 * 60 * 1000 // 30분 미만
    };
  }, [session, currentTime]);

  const timeInfo = getTimeInfo();

  // 연결 상태 정보
  const getConnectionInfo = useCallback(() => {
    const stateMap = {
      connecting: { label: '연결 중...', color: 'text-warning', bgColor: 'bg-warning' },
      connected: { label: '연결됨', color: 'text-info', bgColor: 'bg-info' },
      authenticated: { label: '인증 완료', color: 'text-success', bgColor: 'bg-success' },
      disconnecting: { label: '연결 해제 중...', color: 'text-warning', bgColor: 'bg-warning' },
      disconnected: { label: '연결 안됨', color: 'text-neutral-500', bgColor: 'bg-neutral-400' },
      error: { label: '연결 오류', color: 'text-error', bgColor: 'bg-error' }
    };

    return stateMap[connectionState] || stateMap.disconnected;
  }, [connectionState]);

  const connectionInfo = getConnectionInfo();

  // 세션 연장 처리
  const handleExtendSession = useCallback((hours: number) => {
    onExtendSession?.(hours);
    setShowExtendOptions(false);
  }, [onExtendSession]);

  // 세션이 없는 경우
  if (!session) {
    return (
      <div className={`session-status session-status--no-session p-4 rounded-lg bg-neutral-50 ${className}`}>
        <div className="text-center text-neutral-600">
          <div className="w-12 h-12 mx-auto mb-3 bg-neutral-200 rounded-full flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M11,16.5L6.5,12L7.91,10.59L11,13.67L16.59,8.09L18,9.5L11,16.5Z" />
            </svg>
          </div>
          <p className="text-sm">
            새 세션을 시작하여 음악 생성을 시작하세요
          </p>
        </div>
      </div>
    );
  }

  // 컴팩트 모드
  if (compact) {
    return (
      <div className={`session-status session-status--compact flex items-center gap-4 p-3 bg-white rounded-lg shadow-sm ${className}`}>
        {/* 연결 상태 */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connectionInfo.bgColor}`} />
          <span className="text-sm text-neutral-600">
            {connectionInfo.label}
          </span>
        </div>

        {/* 시간 정보 */}
        {timeInfo && (
          <div className="text-sm text-neutral-600">
            <span className="font-mono">{timeInfo.remaining}</span> 남음
          </div>
        )}

        {/* 음악 개수 */}
        <div className="text-sm text-neutral-600">
          음악 {musicCount}개
        </div>

        {/* 만료 임박 경고 */}
        {timeInfo?.isExpiringSoon && (
          <div className="text-sm text-warning font-medium">
            ⚠️ 만료 임박
          </div>
        )}
      </div>
    );
  }

  // 상세 모드 (기본)
  return (
    <div className={`session-status bg-white rounded-lg shadow-md overflow-hidden ${className}`}>
      {/* 헤더 */}
      <div className={`session-status__header p-4 ${timeInfo?.isExpiringSoon ? 'bg-warning bg-opacity-10' : 'bg-neutral-50'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-neutral-800">
              세션 #{session.id.slice(-8)}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-3 h-3 rounded-full ${connectionInfo.bgColor}`} />
              <span className={`text-sm ${connectionInfo.color}`}>
                {connectionInfo.label}
              </span>
            </div>
          </div>

          <div className="text-right">
            <div className={`text-sm ${session.status === 'active' ? 'text-success' : 'text-neutral-500'}`}>
              {session.status === 'active' ? '활성' : '비활성'}
            </div>
            <div className="text-xs text-neutral-500 mt-1">
              {new Date(session.start_time).toLocaleString('ko-KR')} 시작
            </div>
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className="p-4">
        {/* 시간 정보 */}
        {timeInfo && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-600 font-mono">
                {timeInfo.elapsed}
              </div>
              <div className="text-xs text-neutral-500">경과 시간</div>
            </div>

            <div className="text-center">
              <div className={`text-2xl font-bold font-mono ${timeInfo.isExpiringSoon ? 'text-warning' : 'text-neutral-700'}`}>
                {timeInfo.remaining}
              </div>
              <div className="text-xs text-neutral-500">남은 시간</div>
            </div>
          </div>
        )}

        {/* 만료 임박 경고 */}
        {timeInfo?.isExpiringSoon && (
          <div className="alert alert--warning mb-4" role="alert">
            <strong>세션이 곧 만료됩니다!</strong>
            <br />
            세션을 연장하지 않으면 {timeInfo.remaining} 후에 자동으로 삭제됩니다.
          </div>
        )}

        {/* 통계 정보 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-3 bg-neutral-50 rounded-lg">
            <div className="text-xl font-bold text-primary-600">
              {musicCount}
            </div>
            <div className="text-xs text-neutral-600">생성된 음악</div>
          </div>

          <div className="text-center p-3 bg-neutral-50 rounded-lg">
            <div className="text-xl font-bold text-neutral-700">
              {session.total_typing_time}s
            </div>
            <div className="text-xs text-neutral-600">타이핑 시간</div>
          </div>

          <div className="text-center p-3 bg-neutral-50 rounded-lg">
            <div className="text-xl font-bold text-neutral-700">
              {session.total_music_generated}
            </div>
            <div className="text-xs text-neutral-600">총 생성량</div>
          </div>
        </div>

        {/* 자동 삭제 정보 */}
        <div className="p-3 bg-info bg-opacity-10 rounded-lg mb-4">
          <div className="flex items-center gap-2 mb-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-info">
              <path d="M13,9H11V7H13M13,17H11V11H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z" />
            </svg>
            <span className="text-sm font-medium text-info">자동 삭제 정책</span>
          </div>
          <p className="text-xs text-neutral-600">
            개인정보 보호를 위해 세션은 {new Date(session.auto_delete_at).toLocaleString('ko-KR')}에 자동으로 삭제됩니다.
            모든 데이터와 생성된 음악이 완전히 삭제됩니다.
          </p>
        </div>

        {/* 액션 버튼 */}
        <div className="flex gap-2">
          {/* 세션 연장 */}
          {timeInfo?.isExpiringSoon && onExtendSession && (
            <div className="relative">
              <button
                className="btn btn--primary btn--sm flex-1"
                onClick={() => setShowExtendOptions(true)}
              >
                세션 연장
              </button>

              {showExtendOptions && (
                <div className="absolute bottom-full left-0 mb-2 bg-white border rounded-lg shadow-lg p-3 z-10 whitespace-nowrap">
                  <div className="text-sm font-medium mb-2">연장 시간 선택:</div>
                  <div className="flex gap-2">
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => handleExtendSession(1)}
                    >
                      1시간
                    </button>
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => handleExtendSession(3)}
                    >
                      3시간
                    </button>
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => handleExtendSession(12)}
                    >
                      12시간
                    </button>
                  </div>
                  <button
                    className="absolute -top-1 -right-1 w-6 h-6 bg-neutral-200 rounded-full flex items-center justify-center text-xs"
                    onClick={() => setShowExtendOptions(false)}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 세션 종료 */}
          {onEndSession && (
            <button
              className="btn btn--danger btn--sm"
              onClick={onEndSession}
            >
              세션 종료
            </button>
          )}
        </div>
      </div>

      {/* 진행 바 (세션 진행률) */}
      {timeInfo && (
        <div className="px-4 pb-4">
          <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ${
                timeInfo.isExpiringSoon ? 'bg-warning' : 'bg-primary-500'
              }`}
              style={{
                width: `${Math.max(0, Math.min(100, ((24 * 60 * 60 * 1000 - timeInfo.remainingMs) / (24 * 60 * 60 * 1000)) * 100))}%`
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-neutral-500 mt-1">
            <span>세션 시작</span>
            <span>{timeInfo.isExpiringSoon ? '만료 임박' : '정상'}</span>
            <span>자동 삭제</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionStatus;