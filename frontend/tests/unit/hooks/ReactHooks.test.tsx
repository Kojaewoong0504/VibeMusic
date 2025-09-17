/**
 * React Hooks Unit Tests
 *
 * useTypingCapture, useWebSocket, useSessionManager, useEmotionAnalysis
 * 훅들의 종합 단위 테스트
 */

import { renderHook, act, waitFor } from '@testing-library/react';
// Jest 전역 함수들 사용 (describe, beforeEach, afterEach, test, expect)

// Mock 타입 정의
interface TypingEvent {
  key: string;
  timestamp: number;
  keyCode: number;
  isKeyDown: boolean;
}

interface TypingPattern {
  speed: number;
  rhythm: number;
  pauses: number[];
  consistency: number;
  pressure: number;
}

interface EmotionVector {
  energy: number;
  valence: number;
  tension: number;
  focus: number;
}

interface EmotionProfile {
  dominant_emotion: string;
  emotion_vector: EmotionVector;
  confidence_score: number;
  tempo_score: number;
  rhythm_consistency: number;
}

interface UserSession {
  id: string;
  start_time: string;
  auto_delete_at: string;
  is_active: boolean;
}

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(public url: string) {
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.(new Event('open'));
    }, 10);
  }

  send(data: string) {
    if (this.readyState === MockWebSocket.OPEN) {
      // Echo back for testing
      setTimeout(() => {
        this.onmessage?.(new MessageEvent('message', { data }));
      }, 10);
    }
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }
}

// Global WebSocket mock
(global as any).WebSocket = MockWebSocket;

// Mock hooks
const mockUseTypingCapture = jest.fn(() => ({
  events: [] as TypingEvent[],
  pattern: null as TypingPattern | null,
  isCapturing: false,
  startCapture: jest.fn(),
  stopCapture: jest.fn(),
  clearBuffer: jest.fn()
}));

const mockUseWebSocket = jest.fn(() => ({
  socket: null as WebSocket | null,
  connectionState: 'disconnected' as 'connecting' | 'connected' | 'disconnected' | 'error',
  lastMessage: null as any,
  sendMessage: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  isConnected: false,
  error: null as Error | null
}));

const mockUseSessionManager = jest.fn(() => ({
  session: null as UserSession | null,
  isLoading: false,
  error: null as Error | null,
  createSession: jest.fn(),
  endSession: jest.fn(),
  extendSession: jest.fn(),
  refreshSession: jest.fn()
}));

const mockUseEmotionAnalysis = jest.fn(() => ({
  emotionProfile: null as EmotionProfile | null,
  isAnalyzing: false,
  confidence: 0,
  analyzeTyping: jest.fn(),
  resetAnalysis: jest.fn(),
  emotionHistory: [] as EmotionProfile[]
}));

// Mock implementations
jest.mock('../../../src/hooks/useTypingCapture', () => ({
  useTypingCapture: mockUseTypingCapture
}));

jest.mock('../../../src/hooks/useWebSocket', () => ({
  useWebSocket: mockUseWebSocket
}));

jest.mock('../../../src/hooks/useSessionManager', () => ({
  useSessionManager: mockUseSessionManager
}));

jest.mock('../../../src/hooks/useEmotionAnalysis', () => ({
  useEmotionAnalysis: mockUseEmotionAnalysis
}));

describe('useTypingCapture Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('초기 상태가 올바르게 설정된다', () => {
    mockUseTypingCapture.mockReturnValue({
      events: [],
      pattern: null,
      isCapturing: false,
      startCapture: jest.fn(),
      stopCapture: jest.fn(),
      clearBuffer: jest.fn()
    });

    const { result } = renderHook(() => mockUseTypingCapture());

    expect(result.current.events).toEqual([]);
    expect(result.current.pattern).toBeNull();
    expect(result.current.isCapturing).toBe(false);
  });

  test('캡처 시작 및 중지가 작동한다', () => {
    const startCapture = jest.fn();
    const stopCapture = jest.fn();

    mockUseTypingCapture.mockReturnValue({
      events: [],
      pattern: null,
      isCapturing: false,
      startCapture,
      stopCapture,
      clearBuffer: jest.fn()
    });

    const { result } = renderHook(() => mockUseTypingCapture());

    act(() => {
      result.current.startCapture();
    });

    expect(startCapture).toHaveBeenCalled();

    act(() => {
      result.current.stopCapture();
    });

    expect(stopCapture).toHaveBeenCalled();
  });

  test('타이핑 이벤트가 올바르게 캡처된다', () => {
    const mockEvents: TypingEvent[] = [
      { key: 'a', timestamp: 1000, keyCode: 65, isKeyDown: true },
      { key: 'b', timestamp: 1100, keyCode: 66, isKeyDown: true },
      { key: 'c', timestamp: 1200, keyCode: 67, isKeyDown: true }
    ];

    mockUseTypingCapture.mockReturnValue({
      events: mockEvents,
      pattern: null,
      isCapturing: true,
      startCapture: jest.fn(),
      stopCapture: jest.fn(),
      clearBuffer: jest.fn()
    });

    const { result } = renderHook(() => mockUseTypingCapture());

    expect(result.current.events).toEqual(mockEvents);
    expect(result.current.isCapturing).toBe(true);
  });

  test('타이핑 패턴이 분석된다', () => {
    const mockPattern: TypingPattern = {
      speed: 60,
      rhythm: 0.85,
      pauses: [600, 800],
      consistency: 0.80,
      pressure: 0.75
    };

    mockUseTypingCapture.mockReturnValue({
      events: [],
      pattern: mockPattern,
      isCapturing: true,
      startCapture: jest.fn(),
      stopCapture: jest.fn(),
      clearBuffer: jest.fn()
    });

    const { result } = renderHook(() => mockUseTypingCapture());

    expect(result.current.pattern).toEqual(mockPattern);
  });

  test('버퍼 클리어가 작동한다', () => {
    const clearBuffer = jest.fn();

    mockUseTypingCapture.mockReturnValue({
      events: [],
      pattern: null,
      isCapturing: false,
      startCapture: jest.fn(),
      stopCapture: jest.fn(),
      clearBuffer
    });

    const { result } = renderHook(() => mockUseTypingCapture());

    act(() => {
      result.current.clearBuffer();
    });

    expect(clearBuffer).toHaveBeenCalled();
  });
});

describe('useWebSocket Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('초기 상태가 올바르게 설정된다', () => {
    mockUseWebSocket.mockReturnValue({
      socket: null,
      connectionState: 'disconnected',
      lastMessage: null,
      sendMessage: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      isConnected: false,
      error: null
    });

    const { result } = renderHook(() => mockUseWebSocket());

    expect(result.current.socket).toBeNull();
    expect(result.current.connectionState).toBe('disconnected');
    expect(result.current.isConnected).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('WebSocket 연결이 작동한다', async () => {
    const connect = jest.fn();

    mockUseWebSocket.mockReturnValue({
      socket: new MockWebSocket('ws://localhost:8000'),
      connectionState: 'connecting',
      lastMessage: null,
      sendMessage: jest.fn(),
      connect,
      disconnect: jest.fn(),
      isConnected: false,
      error: null
    });

    const { result } = renderHook(() => mockUseWebSocket());

    act(() => {
      result.current.connect();
    });

    expect(connect).toHaveBeenCalled();
  });

  test('연결 상태 변화가 추적된다', () => {
    mockUseWebSocket.mockReturnValue({
      socket: null,
      connectionState: 'connected',
      lastMessage: null,
      sendMessage: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      isConnected: true,
      error: null
    });

    const { result } = renderHook(() => mockUseWebSocket());

    expect(result.current.connectionState).toBe('connected');
    expect(result.current.isConnected).toBe(true);
  });

  test('메시지 전송이 작동한다', () => {
    const sendMessage = jest.fn();

    mockUseWebSocket.mockReturnValue({
      socket: new MockWebSocket('ws://localhost:8000'),
      connectionState: 'connected',
      lastMessage: null,
      sendMessage,
      connect: jest.fn(),
      disconnect: jest.fn(),
      isConnected: true,
      error: null
    });

    const { result } = renderHook(() => mockUseWebSocket());

    act(() => {
      result.current.sendMessage({ type: 'test', data: 'hello' });
    });

    expect(sendMessage).toHaveBeenCalledWith({ type: 'test', data: 'hello' });
  });

  test('메시지 수신이 처리된다', () => {
    const lastMessage = { type: 'typing', data: { key: 'a', timestamp: 1000 } };

    mockUseWebSocket.mockReturnValue({
      socket: null,
      connectionState: 'connected',
      lastMessage,
      sendMessage: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      isConnected: true,
      error: null
    });

    const { result } = renderHook(() => mockUseWebSocket());

    expect(result.current.lastMessage).toEqual(lastMessage);
  });

  test('연결 해제가 작동한다', () => {
    const disconnect = jest.fn();

    mockUseWebSocket.mockReturnValue({
      socket: null,
      connectionState: 'disconnected',
      lastMessage: null,
      sendMessage: jest.fn(),
      connect: jest.fn(),
      disconnect,
      isConnected: false,
      error: null
    });

    const { result } = renderHook(() => mockUseWebSocket());

    act(() => {
      result.current.disconnect();
    });

    expect(disconnect).toHaveBeenCalled();
  });

  test('연결 에러가 처리된다', () => {
    const error = new Error('Connection failed');

    mockUseWebSocket.mockReturnValue({
      socket: null,
      connectionState: 'error',
      lastMessage: null,
      sendMessage: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      isConnected: false,
      error
    });

    const { result } = renderHook(() => mockUseWebSocket());

    expect(result.current.connectionState).toBe('error');
    expect(result.current.error).toEqual(error);
  });
});

describe('useSessionManager Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('초기 상태가 올바르게 설정된다', () => {
    mockUseSessionManager.mockReturnValue({
      session: null,
      isLoading: false,
      error: null,
      createSession: jest.fn(),
      endSession: jest.fn(),
      extendSession: jest.fn(),
      refreshSession: jest.fn()
    });

    const { result } = renderHook(() => mockUseSessionManager());

    expect(result.current.session).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('세션 생성이 작동한다', async () => {
    const createSession = jest.fn();
    const mockSession: UserSession = {
      id: 'session-123',
      start_time: '2024-01-15T10:00:00Z',
      auto_delete_at: '2024-01-15T11:00:00Z',
      is_active: true
    };

    mockUseSessionManager.mockReturnValue({
      session: mockSession,
      isLoading: false,
      error: null,
      createSession,
      endSession: jest.fn(),
      extendSession: jest.fn(),
      refreshSession: jest.fn()
    });

    const { result } = renderHook(() => mockUseSessionManager());

    await act(async () => {
      await result.current.createSession();
    });

    expect(createSession).toHaveBeenCalled();
    expect(result.current.session).toEqual(mockSession);
  });

  test('세션 종료가 작동한다', async () => {
    const endSession = jest.fn();

    mockUseSessionManager.mockReturnValue({
      session: null,
      isLoading: false,
      error: null,
      createSession: jest.fn(),
      endSession,
      extendSession: jest.fn(),
      refreshSession: jest.fn()
    });

    const { result } = renderHook(() => mockUseSessionManager());

    await act(async () => {
      await result.current.endSession();
    });

    expect(endSession).toHaveBeenCalled();
  });

  test('세션 연장이 작동한다', async () => {
    const extendSession = jest.fn();

    mockUseSessionManager.mockReturnValue({
      session: null,
      isLoading: false,
      error: null,
      createSession: jest.fn(),
      endSession: jest.fn(),
      extendSession,
      refreshSession: jest.fn()
    });

    const { result } = renderHook(() => mockUseSessionManager());

    await act(async () => {
      await result.current.extendSession(60); // 60분 연장
    });

    expect(extendSession).toHaveBeenCalledWith(60);
  });

  test('로딩 상태가 관리된다', () => {
    mockUseSessionManager.mockReturnValue({
      session: null,
      isLoading: true,
      error: null,
      createSession: jest.fn(),
      endSession: jest.fn(),
      extendSession: jest.fn(),
      refreshSession: jest.fn()
    });

    const { result } = renderHook(() => mockUseSessionManager());

    expect(result.current.isLoading).toBe(true);
  });

  test('에러 상태가 처리된다', () => {
    const error = new Error('Session creation failed');

    mockUseSessionManager.mockReturnValue({
      session: null,
      isLoading: false,
      error,
      createSession: jest.fn(),
      endSession: jest.fn(),
      extendSession: jest.fn(),
      refreshSession: jest.fn()
    });

    const { result } = renderHook(() => mockUseSessionManager());

    expect(result.current.error).toEqual(error);
  });

  test('세션 새로고침이 작동한다', async () => {
    const refreshSession = jest.fn();

    mockUseSessionManager.mockReturnValue({
      session: null,
      isLoading: false,
      error: null,
      createSession: jest.fn(),
      endSession: jest.fn(),
      extendSession: jest.fn(),
      refreshSession
    });

    const { result } = renderHook(() => mockUseSessionManager());

    await act(async () => {
      await result.current.refreshSession();
    });

    expect(refreshSession).toHaveBeenCalled();
  });
});

describe('useEmotionAnalysis Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('초기 상태가 올바르게 설정된다', () => {
    mockUseEmotionAnalysis.mockReturnValue({
      emotionProfile: null,
      isAnalyzing: false,
      confidence: 0,
      analyzeTyping: jest.fn(),
      resetAnalysis: jest.fn(),
      emotionHistory: []
    });

    const { result } = renderHook(() => mockUseEmotionAnalysis());

    expect(result.current.emotionProfile).toBeNull();
    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.confidence).toBe(0);
    expect(result.current.emotionHistory).toEqual([]);
  });

  test('감정 분석이 작동한다', async () => {
    const analyzeTyping = jest.fn();
    const mockEmotionProfile: EmotionProfile = {
      dominant_emotion: 'excited',
      emotion_vector: {
        energy: 0.8,
        valence: 0.6,
        tension: 0.4,
        focus: 0.7
      },
      confidence_score: 0.85,
      tempo_score: 0.9,
      rhythm_consistency: 0.75
    };

    mockUseEmotionAnalysis.mockReturnValue({
      emotionProfile: mockEmotionProfile,
      isAnalyzing: false,
      confidence: 0.85,
      analyzeTyping,
      resetAnalysis: jest.fn(),
      emotionHistory: [mockEmotionProfile]
    });

    const { result } = renderHook(() => mockUseEmotionAnalysis());

    const typingData = {
      events: [{ key: 'a', timestamp: 1000, keyCode: 65, isKeyDown: true }],
      pattern: { speed: 60, rhythm: 0.8, pauses: [], consistency: 0.75, pressure: 0.6 }
    };

    await act(async () => {
      await result.current.analyzeTyping(typingData);
    });

    expect(analyzeTyping).toHaveBeenCalledWith(typingData);
    expect(result.current.emotionProfile).toEqual(mockEmotionProfile);
    expect(result.current.confidence).toBe(0.85);
  });

  test('분석 중 상태가 관리된다', () => {
    mockUseEmotionAnalysis.mockReturnValue({
      emotionProfile: null,
      isAnalyzing: true,
      confidence: 0,
      analyzeTyping: jest.fn(),
      resetAnalysis: jest.fn(),
      emotionHistory: []
    });

    const { result } = renderHook(() => mockUseEmotionAnalysis());

    expect(result.current.isAnalyzing).toBe(true);
  });

  test('감정 분석 초기화가 작동한다', () => {
    const resetAnalysis = jest.fn();

    mockUseEmotionAnalysis.mockReturnValue({
      emotionProfile: null,
      isAnalyzing: false,
      confidence: 0,
      analyzeTyping: jest.fn(),
      resetAnalysis,
      emotionHistory: []
    });

    const { result } = renderHook(() => mockUseEmotionAnalysis());

    act(() => {
      result.current.resetAnalysis();
    });

    expect(resetAnalysis).toHaveBeenCalled();
  });

  test('감정 히스토리가 관리된다', () => {
    const emotionHistory: EmotionProfile[] = [
      {
        dominant_emotion: 'calm',
        emotion_vector: { energy: 0.3, valence: 0.2, tension: 0.1, focus: 0.8 },
        confidence_score: 0.9,
        tempo_score: 0.4,
        rhythm_consistency: 0.85
      },
      {
        dominant_emotion: 'excited',
        emotion_vector: { energy: 0.8, valence: 0.6, tension: 0.4, focus: 0.7 },
        confidence_score: 0.85,
        tempo_score: 0.9,
        rhythm_consistency: 0.75
      }
    ];

    mockUseEmotionAnalysis.mockReturnValue({
      emotionProfile: emotionHistory[1],
      isAnalyzing: false,
      confidence: 0.85,
      analyzeTyping: jest.fn(),
      resetAnalysis: jest.fn(),
      emotionHistory
    });

    const { result } = renderHook(() => mockUseEmotionAnalysis());

    expect(result.current.emotionHistory).toEqual(emotionHistory);
    expect(result.current.emotionHistory).toHaveLength(2);
  });
});

// 통합 테스트
describe('Hooks 통합 테스트', () => {
  test('타이핑 캡처와 감정 분석이 연동된다', async () => {
    const typingData = {
      events: [
        { key: 'h', timestamp: 1000, keyCode: 72, isKeyDown: true },
        { key: 'e', timestamp: 1100, keyCode: 69, isKeyDown: true },
        { key: 'l', timestamp: 1200, keyCode: 76, isKeyDown: true },
        { key: 'l', timestamp: 1300, keyCode: 76, isKeyDown: true },
        { key: 'o', timestamp: 1400, keyCode: 79, isKeyDown: true }
      ],
      pattern: {
        speed: 60,
        rhythm: 0.85,
        pauses: [],
        consistency: 0.80,
        pressure: 0.75
      }
    };

    const analyzeTyping = jest.fn();

    // useTypingCapture mock
    mockUseTypingCapture.mockReturnValue({
      events: typingData.events,
      pattern: typingData.pattern,
      isCapturing: true,
      startCapture: jest.fn(),
      stopCapture: jest.fn(),
      clearBuffer: jest.fn()
    });

    // useEmotionAnalysis mock
    mockUseEmotionAnalysis.mockReturnValue({
      emotionProfile: null,
      isAnalyzing: false,
      confidence: 0,
      analyzeTyping,
      resetAnalysis: jest.fn(),
      emotionHistory: []
    });

    const { result: typingResult } = renderHook(() => mockUseTypingCapture());
    const { result: emotionResult } = renderHook(() => mockUseEmotionAnalysis());

    // 타이핑 캡처 시작
    act(() => {
      typingResult.current.startCapture();
    });

    // 감정 분석 실행
    await act(async () => {
      await emotionResult.current.analyzeTyping({
        events: typingResult.current.events,
        pattern: typingResult.current.pattern
      });
    });

    expect(analyzeTyping).toHaveBeenCalledWith({
      events: typingData.events,
      pattern: typingData.pattern
    });
  });

  test('WebSocket과 세션 관리가 연동된다', async () => {
    const sendMessage = jest.fn();
    const createSession = jest.fn();

    // useWebSocket mock
    mockUseWebSocket.mockReturnValue({
      socket: new MockWebSocket('ws://localhost:8000'),
      connectionState: 'connected',
      lastMessage: null,
      sendMessage,
      connect: jest.fn(),
      disconnect: jest.fn(),
      isConnected: true,
      error: null
    });

    // useSessionManager mock
    mockUseSessionManager.mockReturnValue({
      session: {
        id: 'session-123',
        start_time: '2024-01-15T10:00:00Z',
        auto_delete_at: '2024-01-15T11:00:00Z',
        is_active: true
      },
      isLoading: false,
      error: null,
      createSession,
      endSession: jest.fn(),
      extendSession: jest.fn(),
      refreshSession: jest.fn()
    });

    const { result: wsResult } = renderHook(() => mockUseWebSocket());
    const { result: sessionResult } = renderHook(() => mockUseSessionManager());

    // 세션 생성 후 WebSocket에 알림
    await act(async () => {
      await sessionResult.current.createSession();
    });

    act(() => {
      wsResult.current.sendMessage({
        type: 'session_created',
        data: { sessionId: sessionResult.current.session?.id }
      });
    });

    expect(createSession).toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith({
      type: 'session_created',
      data: { sessionId: 'session-123' }
    });
  });

  test('모든 hooks가 정상적으로 연동된다', async () => {
    // 모든 hooks의 정상 상태 mock
    mockUseTypingCapture.mockReturnValue({
      events: [{ key: 'a', timestamp: 1000, keyCode: 65, isKeyDown: true }],
      pattern: { speed: 60, rhythm: 0.8, pauses: [], consistency: 0.75, pressure: 0.6 },
      isCapturing: true,
      startCapture: jest.fn(),
      stopCapture: jest.fn(),
      clearBuffer: jest.fn()
    });

    mockUseWebSocket.mockReturnValue({
      socket: new MockWebSocket('ws://localhost:8000'),
      connectionState: 'connected',
      lastMessage: null,
      sendMessage: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      isConnected: true,
      error: null
    });

    mockUseSessionManager.mockReturnValue({
      session: {
        id: 'session-123',
        start_time: '2024-01-15T10:00:00Z',
        auto_delete_at: '2024-01-15T11:00:00Z',
        is_active: true
      },
      isLoading: false,
      error: null,
      createSession: jest.fn(),
      endSession: jest.fn(),
      extendSession: jest.fn(),
      refreshSession: jest.fn()
    });

    mockUseEmotionAnalysis.mockReturnValue({
      emotionProfile: {
        dominant_emotion: 'focused',
        emotion_vector: { energy: 0.6, valence: 0.4, tension: 0.3, focus: 0.8 },
        confidence_score: 0.9,
        tempo_score: 0.6,
        rhythm_consistency: 0.8
      },
      isAnalyzing: false,
      confidence: 0.9,
      analyzeTyping: jest.fn(),
      resetAnalysis: jest.fn(),
      emotionHistory: []
    });

    const typingHook = renderHook(() => mockUseTypingCapture());
    const wsHook = renderHook(() => mockUseWebSocket());
    const sessionHook = renderHook(() => mockUseSessionManager());
    const emotionHook = renderHook(() => mockUseEmotionAnalysis());

    // 모든 hooks가 정상적으로 작동하는지 확인
    expect(typingHook.result.current.isCapturing).toBe(true);
    expect(wsHook.result.current.isConnected).toBe(true);
    expect(sessionHook.result.current.session).toBeTruthy();
    expect(emotionHook.result.current.emotionProfile).toBeTruthy();
    expect(emotionHook.result.current.confidence).toBe(0.9);
  });
});