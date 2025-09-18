/**
 * T009: 음악 재생 및 다운로드 기능 - 음악 API 연동 훅
 * 음악 정보 조회, 스트리밍, 다운로드 기능을 제공하는 커스텀 훅
 */
import { useState, useCallback, useEffect } from 'react';

export interface MusicFile {
  url: string;
  size: number;
  format: string;
  duration: number;
  download_url: string;
}

export interface MusicInfo {
  id: string;
  session_id: string;
  status: 'generating' | 'completed' | 'failed';
  file_info?: MusicFile;
  progress?: {
    percentage: number;
    estimated_time_remaining?: number;
    current_step: string;
  };
  error_message?: string;
  ai_model_version?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface UseMusicAPIOptions {
  sessionId: string;
  sessionToken?: string;
  onMusicUpdate?: (music: MusicInfo) => void;
  onError?: (error: string) => void;
}

interface UseMusicAPIReturn {
  // 상태
  currentMusic: MusicInfo | null;
  isLoading: boolean;
  error: string | null;

  // 음악 관리
  getMusicInfo: (musicId: string) => Promise<MusicInfo | null>;
  refreshMusicInfo: (musicId: string) => Promise<void>;
  clearError: () => void;

  // 다운로드
  downloadMusic: (musicId: string, filename?: string) => Promise<void>;
  getStreamingUrl: (musicId: string) => string | null;

  // 폴링 (생성 중인 음악 상태 추적)
  startPolling: (musicId: string, interval?: number) => void;
  stopPolling: () => void;
  isPolling: boolean;
}

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export function useMusicAPI(options: UseMusicAPIOptions): UseMusicAPIReturn {
  const { sessionId, sessionToken, onMusicUpdate, onError } = options;

  // 상태 관리
  const [currentMusic, setCurrentMusic] = useState<MusicInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // API 헤더 생성
  const getHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }

    return headers;
  }, [sessionToken]);

  // 에러 처리
  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    onError?.(errorMessage);
  }, [onError]);

  // 음악 정보 조회
  const getMusicInfo = useCallback(async (musicId: string): Promise<MusicInfo | null> => {
    if (!sessionId || !musicId) {
      handleError('세션 ID와 음악 ID가 필요합니다.');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/v1/sessions/${sessionId}/music/${musicId}`,
        {
          method: 'GET',
          headers: getHeaders(),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.detail?.message || `음악 정보 조회 실패 (${response.status})`;
        throw new Error(errorMessage);
      }

      const musicInfo: MusicInfo = await response.json();
      setCurrentMusic(musicInfo);
      onMusicUpdate?.(musicInfo);

      return musicInfo;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '음악 정보 조회 중 오류가 발생했습니다.';
      handleError(errorMessage);
      return null;

    } finally {
      setIsLoading(false);
    }
  }, [sessionId, getHeaders, handleError, onMusicUpdate]);

  // 음악 정보 새로고침
  const refreshMusicInfo = useCallback(async (musicId: string): Promise<void> => {
    await getMusicInfo(musicId);
  }, [getMusicInfo]);

  // 에러 정리
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 스트리밍 URL 생성
  const getStreamingUrl = useCallback((musicId: string): string | null => {
    if (!sessionId || !musicId) return null;

    // 음악 파일의 직접 URL 반환 (백엔드에서 스트리밍 지원)
    return `${API_BASE_URL}/v1/sessions/${sessionId}/music/${musicId}/download`;
  }, [sessionId]);

  // 음악 다운로드
  const downloadMusic = useCallback(async (musicId: string, filename?: string): Promise<void> => {
    if (!sessionId || !musicId) {
      handleError('세션 ID와 음악 ID가 필요합니다.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/v1/sessions/${sessionId}/music/${musicId}/download`,
        {
          method: 'GET',
          headers: getHeaders(),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.detail?.message || `다운로드 실패 (${response.status})`;
        throw new Error(errorMessage);
      }

      // 응답에서 Content-Disposition 헤더로 파일명 추출
      const contentDisposition = response.headers.get('Content-Disposition');
      let suggestedFilename = filename || 'music';

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          suggestedFilename = filenameMatch[1].replace(/['"]/g, '');
        }
      }

      // Blob으로 변환하여 다운로드
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = suggestedFilename;
      document.body.appendChild(link);
      link.click();

      // 정리
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '다운로드 중 오류가 발생했습니다.';
      handleError(errorMessage);

    } finally {
      setIsLoading(false);
    }
  }, [sessionId, getHeaders, handleError]);

  // 폴링 시작 (생성 중인 음악 상태 추적)
  const startPolling = useCallback((musicId: string, interval: number = 3000) => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }

    setIsPolling(true);

    const poll = async () => {
      const musicInfo = await getMusicInfo(musicId);

      // 생성 완료 또는 실패 시 폴링 중단
      if (musicInfo && (musicInfo.status === 'completed' || musicInfo.status === 'failed')) {
        stopPolling();
      }
    };

    // 즉시 한 번 실행
    poll();

    // 주기적 실행 설정
    const newInterval = setInterval(poll, interval);
    setPollingInterval(newInterval);
  }, [pollingInterval, getMusicInfo]);

  // 폴링 중단
  const stopPolling = useCallback(() => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    setIsPolling(false);
  }, [pollingInterval]);

  // 컴포넌트 언마운트 시 폴링 정리
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  return {
    // 상태
    currentMusic,
    isLoading,
    error,

    // 음악 관리
    getMusicInfo,
    refreshMusicInfo,
    clearError,

    // 다운로드
    downloadMusic,
    getStreamingUrl,

    // 폴링
    startPolling,
    stopPolling,
    isPolling,
  };
}