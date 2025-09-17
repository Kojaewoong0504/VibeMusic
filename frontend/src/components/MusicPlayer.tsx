/**
 * MusicPlayer Component
 *
 * AI로 생성된 음악을 재생하는 완전한 음악 플레이어 컴포넌트
 * 재생/정지, 진행바, 볼륨 조절, 다운로드 등 모든 기본 기능 제공
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { GeneratedMusic } from '../../../shared/types/api';

interface MusicPlayerProps {
  /** 재생할 음악 정보 */
  music: GeneratedMusic | null;

  /** 자동 재생 여부 */
  autoPlay?: boolean;

  /** 볼륨 조절 가능 여부 */
  enableVolumeControl?: boolean;

  /** 다운로드 버튼 표시 여부 */
  showDownload?: boolean;

  /** 재생 상태 변경 이벤트 */
  onPlayStateChange?: (isPlaying: boolean) => void;

  /** 재생 진행률 변경 이벤트 */
  onProgressChange?: (progress: number, currentTime: number, duration: number) => void;

  /** 다운로드 버튼 클릭 이벤트 */
  onDownload?: (music: GeneratedMusic) => void;

  /** CSS 클래스명 */
  className?: string;
}

interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isLoading: boolean;
  error: string | null;
}

const MusicPlayer: React.FC<MusicPlayerProps> = ({
  music,
  autoPlay = false,
  enableVolumeControl = true,
  showDownload = true,
  onPlayStateChange,
  onProgressChange,
  onDownload,
  className = ''
}) => {
  // State
  const [state, setState] = useState<PlaybackState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    isMuted: false,
    isLoading: false,
    error: null
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState(0);

  // Refs
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const volumeBarRef = useRef<HTMLDivElement>(null);

  // 시간 포맷팅
  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // 재생/일시정지 토글
  const togglePlayPause = useCallback(async () => {
    if (!audioRef.current || !music) return;

    try {
      if (state.isPlaying) {
        audioRef.current.pause();
      } else {
        setState(prev => ({ ...prev, isLoading: true, error: null }));
        await audioRef.current.play();
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: '음악을 재생할 수 없습니다.',
        isLoading: false
      }));
      console.error('Music playback error:', error);
    }
  }, [state.isPlaying, music]);

  // 정지
  const stop = useCallback(() => {
    if (!audioRef.current) return;

    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setState(prev => ({ ...prev, currentTime: 0 }));
  }, []);

  // 볼륨 변경
  const changeVolume = useCallback((newVolume: number) => {
    if (!audioRef.current) return;

    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    audioRef.current.volume = clampedVolume;
    setState(prev => ({
      ...prev,
      volume: clampedVolume,
      isMuted: clampedVolume === 0
    }));
  }, []);

  // 음소거 토글
  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;

    const newMuted = !state.isMuted;
    audioRef.current.muted = newMuted;

    setState(prev => ({ ...prev, isMuted: newMuted }));
  }, [state.isMuted]);

  // 진행바 클릭/드래그 처리
  const handleProgressBarClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !audioRef.current || state.duration === 0) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const progress = clickX / rect.width;
    const newTime = progress * state.duration;

    audioRef.current.currentTime = newTime;
    setState(prev => ({ ...prev, currentTime: newTime }));
  }, [state.duration]);

  // 볼륨바 클릭 처리
  const handleVolumeBarClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!volumeBarRef.current) return;

    const rect = volumeBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newVolume = clickX / rect.width;

    changeVolume(newVolume);
  }, [changeVolume]);

  // 다운로드 처리
  const handleDownload = useCallback(() => {
    if (music && onDownload) {
      onDownload(music);
    } else if (music?.file_url) {
      // 기본 다운로드 동작
      const link = document.createElement('a');
      link.href = music.file_url;
      link.download = `vibemusic-${music.id}.${music.format}`;
      link.click();
    }
  }, [music, onDownload]);

  // Audio 이벤트 핸들러
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadStart = () => {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
    };

    const handleLoadedMetadata = () => {
      setState(prev => ({
        ...prev,
        duration: audio.duration,
        isLoading: false
      }));
    };

    const handlePlay = () => {
      setState(prev => ({ ...prev, isPlaying: true, isLoading: false }));
      onPlayStateChange?.(true);
    };

    const handlePause = () => {
      setState(prev => ({ ...prev, isPlaying: false }));
      onPlayStateChange?.(false);
    };

    const handleTimeUpdate = () => {
      if (!isDragging) {
        setState(prev => ({ ...prev, currentTime: audio.currentTime }));
        onProgressChange?.(
          audio.currentTime / audio.duration,
          audio.currentTime,
          audio.duration
        );
      }
    };

    const handleEnded = () => {
      setState(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));
      onPlayStateChange?.(false);
    };

    const handleError = () => {
      setState(prev => ({
        ...prev,
        error: '음악을 로드할 수 없습니다.',
        isLoading: false,
        isPlaying: false
      }));
    };

    const handleVolumeChange = () => {
      setState(prev => ({
        ...prev,
        volume: audio.volume,
        isMuted: audio.muted
      }));
    };

    // 이벤트 리스너 등록
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('volumechange', handleVolumeChange);

    return () => {
      // 이벤트 리스너 정리
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('volumechange', handleVolumeChange);
    };
  }, [isDragging, onPlayStateChange, onProgressChange]);

  // 음악 변경 시 처리
  useEffect(() => {
    if (!audioRef.current) return;

    if (music?.file_url && music.status === 'completed') {
      audioRef.current.src = music.file_url;
      audioRef.current.load();

      if (autoPlay) {
        audioRef.current.play().catch(console.error);
      }
    } else {
      audioRef.current.src = '';
      setState(prev => ({
        ...prev,
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        error: null
      }));
    }
  }, [music, autoPlay]);

  // 초기 볼륨 설정
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = state.volume;
    }
  }, [state.volume]);

  const progress = state.duration > 0 ? state.currentTime / state.duration : 0;
  const displayProgress = isDragging ? dragPosition : progress;

  const canPlay = music && music.status === 'completed' && music.file_url;
  const isGenerating = music && music.status === 'generating';

  return (
    <div className={`music-player bg-white rounded-lg shadow-md p-6 ${className}`}>
      {/* 숨겨진 오디오 엘리먼트 */}
      <audio ref={audioRef} preload="metadata" />

      {/* 음악 정보 표시 */}
      <div className="music-info mb-4">
        {music ? (
          <div>
            <h3 className="text-lg font-semibold text-neutral-800 mb-1">
              생성된 음악 #{music.id.slice(-8)}
            </h3>
            <div className="flex items-center gap-4 text-sm text-neutral-600">
              <span>형식: {music.format.toUpperCase()}</span>
              <span>길이: {formatTime(music.duration)}</span>
              {music.quality_score && (
                <span>품질: {Math.round(music.quality_score * 100)}%</span>
              )}
            </div>
          </div>
        ) : (
          <div className="text-neutral-500">
            재생할 음악이 없습니다
          </div>
        )}
      </div>

      {/* 메인 컨트롤 */}
      <div className="music-controls mb-4">
        {/* 재생 버튼 */}
        <button
          className={`play-button mr-4 ${!canPlay ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={togglePlayPause}
          disabled={!canPlay}
          aria-label={state.isPlaying ? '일시정지' : '재생'}
        >
          {state.isLoading ? (
            <div className="spinner spinner--sm" />
          ) : state.isPlaying ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
        </button>

        {/* 정지 버튼 */}
        <button
          className={`
            w-10 h-10 flex items-center justify-center rounded-full
            bg-neutral-200 hover:bg-neutral-300 transition-colors mr-4
            ${!canPlay ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          onClick={stop}
          disabled={!canPlay}
          aria-label="정지"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="3" y="3" width="18" height="18" />
          </svg>
        </button>

        {/* 시간 표시 */}
        <div className="flex items-center text-sm text-neutral-600 font-mono">
          <span>{formatTime(state.currentTime)}</span>
          <span className="mx-2">/</span>
          <span>{formatTime(state.duration)}</span>
        </div>

        {/* 다운로드 버튼 */}
        {showDownload && canPlay && (
          <button
            className="ml-auto btn btn--ghost btn--sm"
            onClick={handleDownload}
            aria-label="다운로드"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="mr-1">
              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
              <path d="M12,16L16,12H13V8H11V12H8L12,16Z" />
            </svg>
            다운로드
          </button>
        )}
      </div>

      {/* 진행률 바 */}
      <div className="progress-section mb-4">
        <div
          ref={progressBarRef}
          className="relative w-full h-2 bg-neutral-200 rounded-full cursor-pointer"
          onClick={handleProgressBarClick}
          role="progressbar"
          aria-valuenow={Math.round(displayProgress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="재생 진행률"
        >
          <div
            className="absolute top-0 left-0 h-full bg-primary-500 rounded-full transition-all"
            style={{ width: `${displayProgress * 100}%` }}
          />
          <div
            className="absolute top-1/2 w-4 h-4 bg-primary-500 rounded-full transform -translate-y-1/2 -translate-x-1/2 shadow-md"
            style={{ left: `${displayProgress * 100}%` }}
          />
        </div>
      </div>

      {/* 볼륨 컨트롤 */}
      {enableVolumeControl && (
        <div className="volume-section flex items-center gap-3">
          <button
            className="text-neutral-600 hover:text-neutral-800 transition-colors"
            onClick={toggleMute}
            aria-label={state.isMuted ? '음소거 해제' : '음소거'}
          >
            {state.isMuted || state.volume === 0 ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12,4L9.91,6.09L12,8.18M4.27,3L3,4.27L7.73,9H3V15H7L12,20V13.27L16.25,17.52C15.58,18.04 14.83,18.46 14,18.7V20.77C15.38,20.45 16.63,19.82 17.68,18.96L19.73,21L21,19.73L12,10.73M19,12C19,12.94 18.8,13.82 18.46,14.64L19.97,16.15C20.62,14.91 21,13.5 21,12C21,7.72 18,4.14 14,3.23V5.29C16.89,6.15 19,8.83 19,12M16.5,12C16.5,10.23 15.5,8.71 14,7.97V10.18L16.45,12.63C16.5,12.43 16.5,12.21 16.5,12Z" />
              </svg>
            ) : state.volume > 0.5 ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.85 14,18.71V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16.03C15.5,15.29 16.5,13.77 16.5,12M3,9V15H7L12,20V4L7,9H3Z" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5,9V15H9L14,20V4L9,9M18.5,12C18.5,10.23 17.5,8.71 16,7.97V16.03C17.5,15.29 18.5,13.77 18.5,12Z" />
              </svg>
            )}
          </button>

          <div
            ref={volumeBarRef}
            className="relative w-24 h-2 bg-neutral-200 rounded-full cursor-pointer"
            onClick={handleVolumeBarClick}
            role="slider"
            aria-valuenow={Math.round(state.volume * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="볼륨"
          >
            <div
              className="absolute top-0 left-0 h-full bg-primary-500 rounded-full"
              style={{ width: `${state.volume * 100}%` }}
            />
            <div
              className="absolute top-1/2 w-3 h-3 bg-primary-500 rounded-full transform -translate-y-1/2 -translate-x-1/2"
              style={{ left: `${state.volume * 100}%` }}
            />
          </div>

          <span className="text-xs text-neutral-600 font-mono w-8">
            {Math.round(state.volume * 100)}
          </span>
        </div>
      )}

      {/* 상태 메시지 */}
      {state.error && (
        <div className="mt-4 alert alert--error" role="alert">
          {state.error}
        </div>
      )}

      {isGenerating && (
        <div className="mt-4 alert alert--info" role="status">
          음악이 생성 중입니다...
        </div>
      )}

      {!music && (
        <div className="mt-4 text-center text-neutral-500">
          먼저 감정을 분석하고 음악을 생성해주세요
        </div>
      )}
    </div>
  );
};

export default MusicPlayer;