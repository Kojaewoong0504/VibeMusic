/**
 * T009: MusicGenerationPage 음악 재생 및 다운로드 기능 테스트
 * 음악 생성 완료 후 재생/다운로드 통합 기능 검증
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import MusicGenerationPage from '../MusicGenerationPage';

// useMusicAPI 훅 모킹
jest.mock('../../hooks/useMusicAPI', () => ({
  useMusicAPI: jest.fn(),
}));

// 기타 컴포넌트들 모킹
jest.mock('../../components', () => ({
  Header: ({ onNewSession, onSessionEnd }: any) => (
    <div data-testid="header">
      <button onClick={onNewSession} data-testid="new-session-btn">새 세션</button>
      <button onClick={onSessionEnd} data-testid="end-session-btn">세션 종료</button>
    </div>
  ),
  TypingInterface: ({ onTypingData, disabled, placeholder }: any) => (
    <div data-testid="typing-interface">
      <textarea
        data-testid="typing-textarea"
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => {
          if (onTypingData) {
            onTypingData({
              text: e.target.value,
              keystrokes: e.target.value.length,
              wpm: Math.random() * 60 + 20,
              pauses: [100, 200, 150],
              rhythm: [0.5, 0.3, 0.7],
            });
          }
        }}
      />
    </div>
  ),
  EmotionVisualizer: ({ emotionData, isActive, size }: any) => (
    <div data-testid="emotion-visualizer" data-active={isActive} data-size={size}>
      {emotionData ? `Energy: ${Math.round(emotionData.energy * 100)}%` : '감정 데이터 없음'}
    </div>
  ),
  SessionStatus: ({ sessionId, currentStatus }: any) => (
    <div data-testid="session-status" data-status={currentStatus}>
      세션: {sessionId}
    </div>
  ),
  GenerationProgress: ({ stage, progress, message }: any) => (
    <div data-testid="generation-progress" data-stage={stage}>
      진행률: {progress}% - {message}
    </div>
  ),
  LoadingSpinner: ({ message, overlay }: any) => (
    <div data-testid="loading-spinner" data-overlay={overlay}>
      {message}
    </div>
  ),
  ErrorBoundary: ({ children, onError }: any) => (
    <div data-testid="error-boundary">{children}</div>
  ),
  MusicPlayer: ({ musicId, sessionId, title, artistName, albumName, size, onError }: any) => (
    <div data-testid="music-player" data-music-id={musicId} data-session-id={sessionId} data-size={size}>
      <div data-testid="music-title">{title}</div>
      <div data-testid="music-artist">{artistName}</div>
      <div data-testid="music-album">{albumName}</div>
      <button
        data-testid="play-button"
        onClick={() => console.log('Play music:', musicId)}
      >
        재생
      </button>
      <button
        data-testid="download-button"
        onClick={() => console.log('Download music:', musicId)}
      >
        다운로드
      </button>
      <button
        data-testid="error-button"
        onClick={() => onError && onError('테스트 에러')}
      >
        에러 트리거
      </button>
    </div>
  ),
}));

// useResponsive 훅 모킹
jest.mock('../../hooks/useResponsive', () => ({
  useResponsive: () => ({
    getValue: (values: any) => values.desktop || values.mobile || '',
    device: { isTouch: false, isRetina: false },
    viewport: { width: 1024, height: 768 },
  }),
  useMobileDetection: () => ({
    shouldShowMobileUI: false,
  }),
}));

const mockUseMusicAPI = require('../../hooks/useMusicAPI').useMusicAPI;

describe('MusicGenerationPage - 음악 재생 및 다운로드 기능 (T009)', () => {
  const mockMusicAPI = {
    currentMusic: null,
    isLoading: false,
    error: null,
    isPolling: false,
    getMusicInfo: jest.fn(),
    refreshMusicInfo: jest.fn(),
    clearError: jest.fn(),
    downloadMusic: jest.fn(),
    getStreamingUrl: jest.fn(),
    startPolling: jest.fn(),
    stopPolling: jest.fn(),
  };

  const mockMusicInfo = {
    id: 'music-123',
    session_id: 'test-session',
    status: 'completed' as const,
    file_info: {
      url: 'https://api.example.com/music/music-123.mp3',
      size: 2048000,
      format: 'mp3',
      duration: 180,
      download_url: 'https://api.example.com/music/music-123/download',
    },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:03:00Z',
    completed_at: '2024-01-01T00:03:00Z',
  };

  const defaultProps = {
    sessionId: 'test-session-123',
    onSessionEnd: jest.fn(),
    onMusicGenerated: jest.fn(),
    onError: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMusicAPI.mockReturnValue(mockMusicAPI);

    // setTimeout과 clearTimeout 모킹
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('초기 렌더링 시 음악 플레이어가 표시되지 않아야 함', () => {
    render(<MusicGenerationPage {...defaultProps} />);

    expect(screen.queryByTestId('music-player')).not.toBeInTheDocument();
    expect(screen.getByTestId('typing-interface')).toBeInTheDocument();
    expect(screen.getByTestId('emotion-visualizer')).toBeInTheDocument();
  });

  it('타이핑 후 음악 생성 버튼이 나타나야 함', async () => {
    render(<MusicGenerationPage {...defaultProps} />);

    const textarea = screen.getByTestId('typing-textarea');

    await act(async () => {
      fireEvent.change(textarea, { target: { value: '테스트 텍스트입니다' } });
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /음악 생성하기/ })).toBeInTheDocument();
    });
  });

  it('음악 생성 완료 후 음악 플레이어가 표시되어야 함', async () => {
    // 음악 정보를 가진 mockMusicAPI 설정
    const mockMusicAPIWithData = {
      ...mockMusicAPI,
      currentMusic: mockMusicInfo,
    };
    mockUseMusicAPI.mockReturnValue(mockMusicAPIWithData);

    render(<MusicGenerationPage {...defaultProps} />);

    // 타이핑 시뮬레이션
    const textarea = screen.getByTestId('typing-textarea');
    await act(async () => {
      fireEvent.change(textarea, { target: { value: '감정이 담긴 텍스트입니다' } });
    });

    // 음악 생성 버튼 클릭
    const generateButton = await screen.findByRole('button', { name: /음악 생성하기/ });

    await act(async () => {
      fireEvent.click(generateButton);
    });

    // 음악 생성 시뮬레이션 진행
    await act(async () => {
      jest.advanceTimersByTime(10000); // 10초 후 완료
    });

    // 생성 완료 후 음악 플레이어 확인
    await waitFor(() => {
      expect(screen.getByTestId('music-player')).toBeInTheDocument();
    });

    expect(screen.getByTestId('music-title')).toHaveTextContent('생성된 음악 #1');
    expect(screen.getByTestId('music-artist')).toHaveTextContent('VibeMusic AI');
    expect(screen.getByTestId('music-album')).toHaveTextContent('감정 기반 AI 음악');
  });

  it('음악 생성 시 폴링이 시작되어야 함', async () => {
    render(<MusicGenerationPage {...defaultProps} />);

    // 타이핑 시뮬레이션
    const textarea = screen.getByTestId('typing-textarea');
    await act(async () => {
      fireEvent.change(textarea, { target: { value: '폴링 테스트 텍스트' } });
    });

    // 음악 생성 버튼 클릭
    const generateButton = await screen.findByRole('button', { name: /음악 생성하기/ });

    await act(async () => {
      fireEvent.click(generateButton);
    });

    // 음악 생성 시뮬레이션 완료 대기
    await act(async () => {
      jest.advanceTimersByTime(10000);
    });

    // 폴링 시작 확인
    await waitFor(() => {
      expect(mockMusicAPI.startPolling).toHaveBeenCalled();
    });
  });

  it('음악 플레이어에서 재생 버튼이 작동해야 함', async () => {
    const mockMusicAPIWithData = {
      ...mockMusicAPI,
      currentMusic: mockMusicInfo,
    };
    mockUseMusicAPI.mockReturnValue(mockMusicAPIWithData);

    render(<MusicGenerationPage {...defaultProps} />);

    // 음악 생성 완료 상태로 설정
    await act(async () => {
      // MusicGenerationPage의 내부 상태를 시뮬레이션하기 위해
      // 타이핑 → 생성 → 완료 과정을 거침
      const textarea = screen.getByTestId('typing-textarea');
      fireEvent.change(textarea, { target: { value: '재생 테스트' } });
    });

    const generateButton = await screen.findByRole('button', { name: /음악 생성하기/ });

    await act(async () => {
      fireEvent.click(generateButton);
      jest.advanceTimersByTime(10000);
    });

    // 음악 플레이어의 재생 버튼 확인 및 클릭
    await waitFor(() => {
      expect(screen.getByTestId('music-player')).toBeInTheDocument();
    });

    const playButton = screen.getByTestId('play-button');
    expect(playButton).toBeInTheDocument();

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    fireEvent.click(playButton);

    expect(consoleSpy).toHaveBeenCalledWith('Play music:', expect.stringMatching(/music_\d+/));
    consoleSpy.mockRestore();
  });

  it('음악 플레이어에서 다운로드 버튼이 작동해야 함', async () => {
    const mockMusicAPIWithData = {
      ...mockMusicAPI,
      currentMusic: mockMusicInfo,
    };
    mockUseMusicAPI.mockReturnValue(mockMusicAPIWithData);

    render(<MusicGenerationPage {...defaultProps} />);

    // 음악 생성 완료 상태로 설정
    await act(async () => {
      const textarea = screen.getByTestId('typing-textarea');
      fireEvent.change(textarea, { target: { value: '다운로드 테스트' } });
    });

    const generateButton = await screen.findByRole('button', { name: /음악 생성하기/ });

    await act(async () => {
      fireEvent.click(generateButton);
      jest.advanceTimersByTime(10000);
    });

    // 음악 플레이어의 다운로드 버튼 확인 및 클릭
    await waitFor(() => {
      expect(screen.getByTestId('music-player')).toBeInTheDocument();
    });

    const downloadButton = screen.getByTestId('download-button');
    expect(downloadButton).toBeInTheDocument();

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    fireEvent.click(downloadButton);

    expect(consoleSpy).toHaveBeenCalledWith('Download music:', expect.stringMatching(/music_\d+/));
    consoleSpy.mockRestore();
  });

  it('새 세션 시작 시 폴링이 중단되고 음악 플레이어가 숨겨져야 함', async () => {
    const mockMusicAPIWithPolling = {
      ...mockMusicAPI,
      currentMusic: mockMusicInfo,
      isPolling: true,
    };
    mockUseMusicAPI.mockReturnValue(mockMusicAPIWithPolling);

    render(<MusicGenerationPage {...defaultProps} />);

    // 음악 생성 완료 상태로 설정
    await act(async () => {
      const textarea = screen.getByTestId('typing-textarea');
      fireEvent.change(textarea, { target: { value: '새 세션 테스트' } });
    });

    const generateButton = await screen.findByRole('button', { name: /음악 생성하기/ });

    await act(async () => {
      fireEvent.click(generateButton);
      jest.advanceTimersByTime(10000);
    });

    await waitFor(() => {
      expect(screen.getByTestId('music-player')).toBeInTheDocument();
    });

    // 새 세션 버튼 클릭
    const newSessionButton = screen.getByTestId('new-session-btn');

    await act(async () => {
      fireEvent.click(newSessionButton);
    });

    // 폴링 중단 확인
    expect(mockMusicAPIWithPolling.stopPolling).toHaveBeenCalled();

    // 음악 플레이어가 숨겨져야 함 (idle 상태로 돌아감)
    await waitFor(() => {
      expect(screen.queryByTestId('music-player')).not.toBeInTheDocument();
    });
  });

  it('음악 플레이어에서 에러 발생 시 적절히 처리해야 함', async () => {
    const mockMusicAPIWithData = {
      ...mockMusicAPI,
      currentMusic: mockMusicInfo,
    };
    mockUseMusicAPI.mockReturnValue(mockMusicAPIWithData);

    render(<MusicGenerationPage {...defaultProps} />);

    // 음악 생성 완료 상태로 설정
    await act(async () => {
      const textarea = screen.getByTestId('typing-textarea');
      fireEvent.change(textarea, { target: { value: '에러 테스트' } });
    });

    const generateButton = await screen.findByRole('button', { name: /음악 생성하기/ });

    await act(async () => {
      fireEvent.click(generateButton);
      jest.advanceTimersByTime(10000);
    });

    await waitFor(() => {
      expect(screen.getByTestId('music-player')).toBeInTheDocument();
    });

    // 음악 플레이어에서 에러 트리거
    const errorButton = screen.getByTestId('error-button');

    await act(async () => {
      fireEvent.click(errorButton);
    });

    // onError 콜백이 호출되어야 함
    expect(defaultProps.onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('useMusicAPI의 onMusicUpdate 콜백이 설정되어야 함', () => {
    render(<MusicGenerationPage {...defaultProps} />);

    expect(mockUseMusicAPI).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'test-session-123',
        onMusicUpdate: expect.any(Function),
        onError: expect.any(Function),
      })
    );
  });

  it('useMusicAPI의 onError 콜백이 올바르게 처리되어야 함', () => {
    render(<MusicGenerationPage {...defaultProps} />);

    const callArgs = mockUseMusicAPI.mock.calls[0][0];
    const onErrorCallback = callArgs.onError;

    // onError 콜백 실행
    onErrorCallback('테스트 API 에러');

    expect(defaultProps.onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('음악 정보가 업데이트될 때 콘솔 로그가 출력되어야 함', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    render(<MusicGenerationPage {...defaultProps} />);

    const callArgs = mockUseMusicAPI.mock.calls[0][0];
    const onMusicUpdateCallback = callArgs.onMusicUpdate;

    // onMusicUpdate 콜백 실행
    onMusicUpdateCallback(mockMusicInfo);

    expect(consoleSpy).toHaveBeenCalledWith('Music info updated:', mockMusicInfo);
    consoleSpy.mockRestore();
  });
});