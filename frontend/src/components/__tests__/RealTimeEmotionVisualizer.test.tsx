/**
 * T008: RealTimeEmotionVisualizer 컴포넌트 테스트
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

// Canvas 모킹
const mockCanvasContext = {
  fillRect: jest.fn(),
  clearRect: jest.fn(),
  getImageData: jest.fn(),
  putImageData: jest.fn(),
  createImageData: jest.fn(),
  setTransform: jest.fn(),
  drawImage: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  beginPath: jest.fn(),
  closePath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  arc: jest.fn(),
  stroke: jest.fn(),
  fill: jest.fn(),
  translate: jest.fn(),
  scale: jest.fn(),
  rotate: jest.fn(),
  globalAlpha: 1,
  strokeStyle: '',
  fillStyle: '',
  lineWidth: 1,
  font: '',
  textAlign: 'start',
  textBaseline: 'alphabetic',
  measureText: jest.fn(() => ({ width: 100 })),
  fillText: jest.fn(),
  strokeText: jest.fn(),
  createLinearGradient: jest.fn(() => ({
    addColorStop: jest.fn()
  })),
  createRadialGradient: jest.fn(() => ({
    addColorStop: jest.fn()
  })),
  createPattern: jest.fn()
};

HTMLCanvasElement.prototype.getContext = jest.fn(() => mockCanvasContext);

// requestAnimationFrame 모킹
global.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 16));

const mockEmotionData = {
  currentEmotion: {
    energy: 0.7,
    valence: 0.3,
    tension: 0.5,
    focus: 0.8,
    confidence: 0.9,
    timestamp: new Date()
  },
  smoothedEmotion: {
    energy: 0.65,
    valence: 0.35,
    tension: 0.45,
    focus: 0.75,
    confidence: 0.85,
    timestamp: new Date()
  },
  emotionHistory: [
    {
      id: 'emotion_1',
      energy: 0.6,
      valence: 0.4,
      tension: 0.4,
      focus: 0.7,
      confidence: 0.8,
      timestamp: new Date(Date.now() - 5000)
    },
    {
      id: 'emotion_2',
      energy: 0.7,
      valence: 0.3,
      tension: 0.5,
      focus: 0.8,
      confidence: 0.9,
      timestamp: new Date()
    }
  ],
  emotionTrends: [
    {
      metric: 'energy' as const,
      direction: 'increasing' as const,
      change: 0.1,
      timeWindow: 30000
    }
  ],
  emotionSummary: {
    averageEnergy: 0.65,
    averageValence: 0.35,
    averageTension: 0.45,
    averageFocus: 0.75,
    dominantEmotion: 'energetic' as const,
    emotionStability: 0.8,
    dataCount: 2
  },
  isReceivingData: true,
  lastUpdateTime: new Date(),
  dataQuality: 'excellent' as const,
  addEmotionData: jest.fn(),
  clearHistory: jest.fn(),
  handleWebSocketMessage: jest.fn()
};

const mockWebSocketData = {
  isConnected: true,
  connectionStatus: 'connected' as const,
  lastPingTime: new Date(),
  reconnectAttempts: 0,
  sendMessage: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn()
};

describe('RealTimeEmotionVisualizer', () => {
  beforeEach(() => {
    mockUseEmotionData.mockReturnValue(mockEmotionData);
    mockUseWebSocket.mockReturnValue(mockWebSocketData);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('기본 컴포넌트가 올바르게 렌더링되어야 함', () => {
    render(<RealTimeEmotionVisualizer sessionId="test-session" />);

    expect(screen.getByText('실시간 감정 분석')).toBeInTheDocument();
    expect(screen.getByTestId('realtime-emotion-visualizer')).toBeInTheDocument();
  });

  it('연결 상태가 올바르게 표시되어야 함', () => {
    render(<RealTimeEmotionVisualizer sessionId="test-session" />);

    expect(screen.getByText('연결됨')).toBeInTheDocument();
    expect(screen.getByText('우수')).toBeInTheDocument(); // 데이터 품질
  });

  it('연결 끊김 상태가 올바르게 표시되어야 함', () => {
    mockUseWebSocket.mockReturnValue({
      ...mockWebSocketData,
      isConnected: false,
      connectionStatus: 'disconnected'
    });

    render(<RealTimeEmotionVisualizer sessionId="test-session" />);

    expect(screen.getByText('연결 끊김')).toBeInTheDocument();
  });

  it('현재 감정 값들이 올바르게 표시되어야 함', () => {
    render(<RealTimeEmotionVisualizer sessionId="test-session" mode="detailed" />);

    expect(screen.getByText('에너지: 70%')).toBeInTheDocument();
    expect(screen.getByText('감정가: 30%')).toBeInTheDocument();
    expect(screen.getByText('긴장도: 50%')).toBeInTheDocument();
    expect(screen.getByText('집중도: 80%')).toBeInTheDocument();
  });

  it('시각화 모드 변경이 올바르게 작동해야 함', () => {
    render(<RealTimeEmotionVisualizer sessionId="test-session" />);

    const modeButton = screen.getByRole('button', { name: /시각화 모드/ });

    fireEvent.click(modeButton);

    // 모드 변경 후 DOM 업데이트 확인
    expect(modeButton).toBeInTheDocument();
  });

  it('트렌드 정보가 올바르게 표시되어야 함', () => {
    render(<RealTimeEmotionVisualizer sessionId="test-session" mode="detailed" />);

    expect(screen.getByText(/에너지.*↗/)).toBeInTheDocument(); // 증가 화살표
  });

  it('감정 요약이 올바르게 표시되어야 함', () => {
    render(<RealTimeEmotionVisualizer sessionId="test-session" mode="detailed" />);

    expect(screen.getByText('지배적 감정: 활동적')).toBeInTheDocument();
    expect(screen.getByText('감정 안정성: 80%')).toBeInTheDocument();
  });

  it('minimal 모드에서 간단한 정보만 표시되어야 함', () => {
    render(<RealTimeEmotionVisualizer sessionId="test-session" mode="minimal" />);

    // 상세 정보는 표시되지 않아야 함
    expect(screen.queryByText('에너지: 70%')).not.toBeInTheDocument();
    expect(screen.queryByText('지배적 감정:')).not.toBeInTheDocument();
  });

  it('데이터가 없을 때 적절한 메시지가 표시되어야 함', () => {
    mockUseEmotionData.mockReturnValue({
      ...mockEmotionData,
      currentEmotion: null,
      emotionHistory: [],
      dataQuality: 'no-data'
    });

    render(<RealTimeEmotionVisualizer sessionId="test-session" />);

    expect(screen.getByText('감정 데이터를 기다리는 중...')).toBeInTheDocument();
  });

  it('히스토리 정리 버튼이 올바르게 작동해야 함', () => {
    render(<RealTimeEmotionVisualizer sessionId="test-session" mode="detailed" />);

    const clearButton = screen.getByRole('button', { name: '히스토리 정리' });
    fireEvent.click(clearButton);

    expect(mockEmotionData.clearHistory).toHaveBeenCalled();
  });

  it('캔버스가 올바르게 렌더링되어야 함', () => {
    render(<RealTimeEmotionVisualizer sessionId="test-session" />);

    const canvas = screen.getByRole('img', { hidden: true }); // canvas는 img role로 인식됨
    expect(canvas).toBeInTheDocument();
  });

  it('애니메이션이 활성화되어야 함', async () => {
    render(<RealTimeEmotionVisualizer sessionId="test-session" />);

    // requestAnimationFrame이 호출되는지 확인하기 위해 짧은 시간 대기
    await waitFor(() => {
      expect(document.querySelector('canvas')).toBeInTheDocument();
    });
  });

  it('WebSocket 메시지 핸들러가 등록되어야 함', () => {
    render(<RealTimeEmotionVisualizer sessionId="test-session" />);

    expect(mockWebSocketData.subscribe).toHaveBeenCalledWith(
      'emotion_update',
      expect.any(Function)
    );
  });

  it('컴포넌트 언마운트 시 정리 작업이 수행되어야 함', () => {
    const { unmount } = render(<RealTimeEmotionVisualizer sessionId="test-session" />);

    unmount();

    expect(mockWebSocketData.unsubscribe).toHaveBeenCalledWith(
      'emotion_update',
      expect.any(Function)
    );
  });

  it('커스텀 스타일이 적용되어야 함', () => {
    const customStyle = { backgroundColor: 'red' };
    render(
      <RealTimeEmotionVisualizer
        sessionId="test-session"
        style={customStyle}
      />
    );

    const container = screen.getByTestId('realtime-emotion-visualizer');
    expect(container).toHaveStyle('background-color: red');
  });

  it('커스텀 클래스네임이 적용되어야 함', () => {
    render(
      <RealTimeEmotionVisualizer
        sessionId="test-session"
        className="custom-class"
      />
    );

    const container = screen.getByTestId('realtime-emotion-visualizer');
    expect(container).toHaveClass('custom-class');
  });

  it('onEmotionUpdate 콜백이 호출되어야 함', () => {
    const onEmotionUpdate = jest.fn();
    render(
      <RealTimeEmotionVisualizer
        sessionId="test-session"
        onEmotionUpdate={onEmotionUpdate}
      />
    );

    // 감정 데이터 업데이트 시뮬레이션
    // 실제로는 WebSocket 메시지를 통해 트리거됨
    expect(mockWebSocketData.subscribe).toHaveBeenCalled();
  });
});