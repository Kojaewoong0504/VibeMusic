/**
 * T008: RealTimeEmotionVisualizer 기본 테스트
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import RealTimeEmotionVisualizer from '../RealTimeEmotionVisualizer';

// useEmotionData 훅 모킹
jest.mock('../../hooks/useEmotionData', () => ({
  useEmotionData: jest.fn()
}));

// useWebSocket 훅 모킹
jest.mock('../../hooks/useWebSocket', () => ({
  useWebSocket: jest.fn()
}));

const mockUseEmotionData = require('../../hooks/useEmotionData').useEmotionData;
const mockUseWebSocket = require('../../hooks/useWebSocket').useWebSocket;

// Canvas API 완전 모킹
const mockCanvas = {
  getContext: jest.fn(() => ({
    fillRect: jest.fn(),
    clearRect: jest.fn(),
    beginPath: jest.fn(),
    closePath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    stroke: jest.fn(),
    fill: jest.fn(),
    createLinearGradient: jest.fn(() => ({
      addColorStop: jest.fn()
    })),
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
    globalAlpha: 1
  })),
  width: 400,
  height: 200
};

// HTMLCanvasElement 모킹
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: () => mockCanvas.getContext()
});

// requestAnimationFrame 모킹
global.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 16));

const mockEmotionData = {
  currentEmotion: null,
  smoothedEmotion: null,
  emotionHistory: [],
  emotionTrends: [],
  emotionSummary: null,
  isReceivingData: false,
  lastUpdateTime: null,
  dataQuality: 'no-data' as const,
  addEmotionData: jest.fn(),
  clearHistory: jest.fn(),
  handleWebSocketMessage: jest.fn()
};

const mockWebSocketData = {
  isConnected: false,
  connectionStatus: 'disconnected' as const,
  lastPingTime: null,
  reconnectAttempts: 0,
  sendMessage: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn()
};

describe('RealTimeEmotionVisualizer 기본 테스트', () => {
  beforeEach(() => {
    mockUseEmotionData.mockReturnValue(mockEmotionData);
    mockUseWebSocket.mockReturnValue(mockWebSocketData);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('컴포넌트가 기본적으로 렌더링되어야 함', () => {
    render(<RealTimeEmotionVisualizer sessionId="test-session" />);

    expect(screen.getByTestId('realtime-emotion-visualizer')).toBeInTheDocument();
    expect(screen.getByText('실시간 감정 분석')).toBeInTheDocument();
  });

  it('데이터가 없을 때 적절한 메시지가 표시되어야 함', () => {
    render(<RealTimeEmotionVisualizer sessionId="test-session" />);

    expect(screen.getByText('감정 데이터를 기다리는 중...')).toBeInTheDocument();
  });

  it('WebSocket 구독이 설정되어야 함', () => {
    render(<RealTimeEmotionVisualizer sessionId="test-session" />);

    expect(mockWebSocketData.subscribe).toHaveBeenCalledWith(
      'emotion_update',
      expect.any(Function)
    );
  });

  it('감정 데이터가 있을 때 올바르게 표시되어야 함', () => {
    const dataWithEmotion = {
      ...mockEmotionData,
      currentEmotion: {
        energy: 0.7,
        valence: 0.3,
        tension: 0.5,
        focus: 0.8,
        confidence: 0.9,
        timestamp: new Date()
      },
      isReceivingData: true,
      dataQuality: 'excellent' as const
    };

    mockUseEmotionData.mockReturnValue(dataWithEmotion);
    mockUseWebSocket.mockReturnValue({
      ...mockWebSocketData,
      isConnected: true,
      connectionStatus: 'connected'
    });

    render(<RealTimeEmotionVisualizer sessionId="test-session" />);

    expect(screen.getByText('에너지: 70%')).toBeInTheDocument();
    expect(screen.getByText('연결됨')).toBeInTheDocument();
  });

  it('minimal 모드가 올바르게 작동해야 함', () => {
    render(<RealTimeEmotionVisualizer sessionId="test-session" mode="minimal" />);

    expect(screen.getByTestId('realtime-emotion-visualizer')).toBeInTheDocument();
    // minimal 모드에서는 상세 정보가 표시되지 않음
    expect(screen.queryByText('에너지:')).not.toBeInTheDocument();
  });
});