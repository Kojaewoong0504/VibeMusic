/**
 * Jest Test Setup
 *
 * 모든 단위 테스트 실행 전에 설정되는 전역 설정
 */

import '@testing-library/jest-dom';

// 전역 목킹 설정
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// ResizeObserver 목킹
Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  })),
});

// IntersectionObserver 목킹
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  })),
});

// Canvas 목킹
HTMLCanvasElement.prototype.getContext = jest.fn().mockImplementation((contextId) => {
  if (contextId === '2d') {
    return {
      clearRect: jest.fn(),
      fillRect: jest.fn(),
      strokeRect: jest.fn(),
      beginPath: jest.fn(),
      closePath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      arc: jest.fn(),
      stroke: jest.fn(),
      fill: jest.fn(),
      fillText: jest.fn(),
      measureText: jest.fn(() => ({ width: 0 })),
      createLinearGradient: jest.fn(() => ({
        addColorStop: jest.fn(),
      })),
      // 기타 필요한 메서드들
      save: jest.fn(),
      restore: jest.fn(),
      translate: jest.fn(),
      rotate: jest.fn(),
      scale: jest.fn(),
    };
  }
  return null;
});

// Audio 목킹
Object.defineProperty(window, 'HTMLAudioElement', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    play: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn(),
    load: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    currentTime: 0,
    duration: 100,
    volume: 1,
    muted: false,
    paused: true,
    ended: false,
    readyState: 4,
  })),
});

// WebSocket 목킹
Object.defineProperty(window, 'WebSocket', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
    close: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    readyState: WebSocket.OPEN,
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
  })),
});

// 타이머 목킹 (필요시 개별 테스트에서 사용)
beforeEach(() => {
  jest.clearAllTimers();
});

// 콘솔 에러 억제 (테스트 실행 중 불필요한 에러 로그 방지)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    // React Testing Library의 일부 경고는 무시
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// 전역 테스트 데이터
declare global {
  var testData: {
    mockEmotionProfile: any;
    mockSession: any;
    mockMusic: any;
    mockTypingStats: any;
  };
}

global.testData = {
  mockEmotionProfile: {
    tempo_score: 0.7,
    rhythm_consistency: 0.8,
    pause_intensity: 0.3,
    emotion_vector: {
      energy: 0.7,
      valence: 0.5,
      tension: 0.3,
      focus: 0.8,
    },
    confidence_score: 0.85,
    dominant_emotion: 'focused',
    music_genre_hints: ['ambient', 'concentration'],
    tempo_bpm_range: [90, 110],
  },

  mockSession: {
    id: 'test-session-123',
    start_time: '2024-01-15T10:00:00Z',
    auto_delete_at: '2024-01-15T11:00:00Z',
    is_active: true,
  },

  mockMusic: {
    id: 'music-test-456',
    format: 'wav',
    duration: 180,
    quality_score: 0.9,
    file_url: 'https://example.com/test-music.wav',
  },

  mockTypingStats: {
    average_wpm: 65,
    keystroke_intervals: [150, 180, 120, 200],
    pause_patterns: [500, 1000, 300],
    rhythm_score: 0.8,
    focus_level: 0.7,
    session_duration: 120,
  },
};