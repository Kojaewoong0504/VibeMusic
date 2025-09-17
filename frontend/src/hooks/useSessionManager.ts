import { useState, useEffect, useCallback, useRef } from 'react';
import { SessionData } from './types';

interface UseSessionManagerOptions {
  autoDeleteHours?: number; // 자동 삭제 시간 (시간 단위)
  syncInterval?: number; // 서버와 동기화 간격 (ms)
  onSessionExpired?: (sessionId: string) => void;
  onSessionCreated?: (session: SessionData) => void;
  onSessionUpdated?: (session: SessionData) => void;
}

interface UseSessionManagerReturn {
  currentSession: SessionData | null;
  sessions: SessionData[];
  isLoading: boolean;
  error: string | null;
  createSession: () => Promise<SessionData | null>;
  updateSession: (sessionId: string, updates: Partial<SessionData>) => Promise<boolean>;
  deleteSession: (sessionId: string) => Promise<boolean>;
  getSession: (sessionId: string) => SessionData | null;
  clearExpiredSessions: () => void;
  timeUntilExpiry: number | null; // 현재 세션의 만료까지 남은 시간 (ms)
}

export function useSessionManager(options: UseSessionManagerOptions = {}): UseSessionManagerReturn {
  const {
    autoDeleteHours = 24,
    syncInterval = 60000, // 1분
    onSessionExpired,
    onSessionCreated,
    onSessionUpdated
  } = options;

  const [currentSession, setCurrentSession] = useState<SessionData | null>(null);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeUntilExpiry, setTimeUntilExpiry] = useState<number | null>(null);

  const expiryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 세션 ID 생성
  const generateSessionId = useCallback((): string => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // 만료 시간까지의 시간 계산
  const calculateTimeUntilExpiry = useCallback((session: SessionData | null): number | null => {
    if (!session) return null;

    const now = new Date().getTime();
    const expiryTime = session.autoDeleteAt.getTime();
    const remaining = expiryTime - now;

    return remaining > 0 ? remaining : 0;
  }, []);

  // 만료 시간 업데이트
  const updateExpiryTime = useCallback(() => {
    const remaining = calculateTimeUntilExpiry(currentSession);
    setTimeUntilExpiry(remaining);

    if (remaining === 0 && currentSession) {
      onSessionExpired?.(currentSession.id);
      setCurrentSession(null);
      clearExpiredSessions();
    }
  }, [currentSession, calculateTimeUntilExpiry, onSessionExpired]);

  // 만료 타이머 시작
  const startExpiryTimer = useCallback(() => {
    if (expiryTimerRef.current) {
      clearInterval(expiryTimerRef.current);
    }

    expiryTimerRef.current = setInterval(updateExpiryTime, 1000); // 1초마다 업데이트
  }, [updateExpiryTime]);

  // 만료 타이머 중지
  const stopExpiryTimer = useCallback(() => {
    if (expiryTimerRef.current) {
      clearInterval(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
  }, []);

  // 로컬 스토리지에서 세션 로드
  const loadSessionsFromStorage = useCallback((): SessionData[] => {
    try {
      const storedSessions = localStorage.getItem('vibemusic_sessions');
      if (storedSessions) {
        const parsed = JSON.parse(storedSessions);
        return parsed.map((session: any) => ({
          ...session,
          startTime: new Date(session.startTime),
          autoDeleteAt: new Date(session.autoDeleteAt)
        }));
      }
    } catch (error) {
      console.error('세션 로드 실패:', error);
    }
    return [];
  }, []);

  // 로컬 스토리지에 세션 저장
  const saveSessionsToStorage = useCallback((sessionsToSave: SessionData[]) => {
    try {
      localStorage.setItem('vibemusic_sessions', JSON.stringify(sessionsToSave));
    } catch (error) {
      console.error('세션 저장 실패:', error);
    }
  }, []);

  // 만료된 세션 정리
  const clearExpiredSessions = useCallback(() => {
    const now = new Date();
    const validSessions = sessions.filter(session => session.autoDeleteAt > now);

    if (validSessions.length !== sessions.length) {
      setSessions(validSessions);
      saveSessionsToStorage(validSessions);
    }
  }, [sessions, saveSessionsToStorage]);

  // 새 세션 생성
  const createSession = useCallback(async (): Promise<SessionData | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const now = new Date();
      const autoDeleteAt = new Date(now.getTime() + (autoDeleteHours * 60 * 60 * 1000));

      const newSession: SessionData = {
        id: generateSessionId(),
        startTime: now,
        isActive: true,
        autoDeleteAt,
        generatedMusicCount: 0
      };

      // 기존 세션이 있다면 비활성화
      const updatedSessions = sessions.map(session => ({ ...session, isActive: false }));
      const allSessions = [...updatedSessions, newSession];

      setSessions(allSessions);
      setCurrentSession(newSession);
      saveSessionsToStorage(allSessions);

      onSessionCreated?.(newSession);
      return newSession;

    } catch (error) {
      const errorMessage = `세션 생성 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`;
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [sessions, autoDeleteHours, generateSessionId, saveSessionsToStorage, onSessionCreated]);

  // 세션 업데이트
  const updateSession = useCallback(async (sessionId: string, updates: Partial<SessionData>): Promise<boolean> => {
    try {
      const updatedSessions = sessions.map(session =>
        session.id === sessionId
          ? { ...session, ...updates }
          : session
      );

      setSessions(updatedSessions);
      saveSessionsToStorage(updatedSessions);

      // 현재 세션 업데이트
      if (currentSession?.id === sessionId) {
        const updatedCurrentSession = { ...currentSession, ...updates };
        setCurrentSession(updatedCurrentSession);
        onSessionUpdated?.(updatedCurrentSession);
      }

      return true;
    } catch (error) {
      setError(`세션 업데이트 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      return false;
    }
  }, [sessions, currentSession, saveSessionsToStorage, onSessionUpdated]);

  // 세션 삭제
  const deleteSession = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      const filteredSessions = sessions.filter(session => session.id !== sessionId);
      setSessions(filteredSessions);
      saveSessionsToStorage(filteredSessions);

      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
      }

      return true;
    } catch (error) {
      setError(`세션 삭제 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      return false;
    }
  }, [sessions, currentSession, saveSessionsToStorage]);

  // 특정 세션 조회
  const getSession = useCallback((sessionId: string): SessionData | null => {
    return sessions.find(session => session.id === sessionId) || null;
  }, [sessions]);

  // 컴포넌트 마운트시 초기화
  useEffect(() => {
    const loadedSessions = loadSessionsFromStorage();
    setSessions(loadedSessions);

    // 활성 세션 찾기
    const activeSession = loadedSessions.find(session => session.isActive && session.autoDeleteAt > new Date());
    if (activeSession) {
      setCurrentSession(activeSession);
    }

    // 만료된 세션 정리
    const now = new Date();
    const validSessions = loadedSessions.filter(session => session.autoDeleteAt > now);
    if (validSessions.length !== loadedSessions.length) {
      setSessions(validSessions);
      saveSessionsToStorage(validSessions);
    }
  }, [loadSessionsFromStorage, saveSessionsToStorage]);

  // 현재 세션 변경시 만료 타이머 관리
  useEffect(() => {
    if (currentSession) {
      startExpiryTimer();
      updateExpiryTime();
    } else {
      stopExpiryTimer();
      setTimeUntilExpiry(null);
    }

    return () => stopExpiryTimer();
  }, [currentSession, startExpiryTimer, stopExpiryTimer, updateExpiryTime]);

  // 정기적 세션 정리
  useEffect(() => {
    const startSyncTimer = () => {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
      }
      syncTimerRef.current = setInterval(clearExpiredSessions, syncInterval);
    };

    startSyncTimer();

    return () => {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
      }
    };
  }, [clearExpiredSessions, syncInterval]);

  // 컴포넌트 언마운트시 정리
  useEffect(() => {
    return () => {
      stopExpiryTimer();
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
      }
    };
  }, [stopExpiryTimer]);

  return {
    currentSession,
    sessions,
    isLoading,
    error,
    createSession,
    updateSession,
    deleteSession,
    getSession,
    clearExpiredSessions,
    timeUntilExpiry
  };
}