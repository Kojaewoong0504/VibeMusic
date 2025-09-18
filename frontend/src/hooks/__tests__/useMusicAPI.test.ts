/**
 * T009: useMusicAPI 훅 테스트
 * 음악 재생 및 다운로드 기능의 API 연동 테스트
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useMusicAPI } from '../useMusicAPI';

// fetch 모킹
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('useMusicAPI', () => {
  const mockOptions = {
    sessionId: 'test-session-123',
    sessionToken: 'test-token',
    onMusicUpdate: jest.fn(),
    onError: jest.fn(),
  };

  const mockMusicInfo = {
    id: 'music-123',
    session_id: 'test-session-123',
    status: 'completed' as const,
    file_info: {
      url: 'https://api.example.com/music/music-123.mp3',
      size: 2048,
      format: 'mp3',
      duration: 180,
      download_url: 'https://api.example.com/music/music-123/download',
    },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:03:00Z',
    completed_at: '2024-01-01T00:03:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  afterEach(() => {
    // 각 테스트에서 개별적으로 fake timer를 사용하는 경우만 정리
    try {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    } catch (error) {
      // fake timer가 활성화되지 않은 경우 무시
    }
  });

  it('초기 상태가 올바르게 설정되어야 함', () => {
    const { result } = renderHook(() => useMusicAPI(mockOptions));

    expect(result.current.currentMusic).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.isPolling).toBe(false);
  });

  it('getMusicInfo가 성공적으로 음악 정보를 조회해야 함', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockMusicInfo,
    } as Response);

    const { result } = renderHook(() => useMusicAPI(mockOptions));

    let musicInfo: any;
    await act(async () => {
      musicInfo = await result.current.getMusicInfo('music-123');
    });

    expect(musicInfo).toEqual(mockMusicInfo);
    expect(result.current.currentMusic).toEqual(mockMusicInfo);
    expect(mockOptions.onMusicUpdate).toHaveBeenCalledWith(mockMusicInfo);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/v1/sessions/test-session-123/music/music-123',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
      }
    );
  });

  it('getMusicInfo 에러 시 적절히 처리해야 함', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ detail: { message: '음악을 찾을 수 없습니다.' } }),
    } as Response);

    const { result } = renderHook(() => useMusicAPI(mockOptions));

    let musicInfo: any;
    await act(async () => {
      musicInfo = await result.current.getMusicInfo('music-123');
    });

    expect(musicInfo).toBeNull();
    expect(result.current.error).toBe('음악을 찾을 수 없습니다.');
    expect(mockOptions.onError).toHaveBeenCalledWith('음악을 찾을 수 없습니다.');
  });

  it('getStreamingUrl이 올바른 URL을 반환해야 함', () => {
    const { result } = renderHook(() => useMusicAPI(mockOptions));

    const streamingUrl = result.current.getStreamingUrl('music-123');

    expect(streamingUrl).toBe('http://localhost:8000/v1/sessions/test-session-123/music/music-123/download');
  });

  it('getStreamingUrl이 세션 ID나 음악 ID가 없을 때 null을 반환해야 함', () => {
    const { result } = renderHook(() => useMusicAPI({ ...mockOptions, sessionId: '' }));

    const streamingUrl = result.current.getStreamingUrl('music-123');

    expect(streamingUrl).toBeNull();
  });

  it('downloadMusic이 성공적으로 파일을 다운로드해야 함', async () => {
    const mockBlob = new Blob(['mock-audio-data'], { type: 'audio/mpeg' });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      blob: async () => mockBlob,
      headers: {
        get: (name: string) => {
          if (name === 'Content-Disposition') {
            return 'attachment; filename="test-music.mp3"';
          }
          return null;
        },
      },
    } as Response);

    const { result } = renderHook(() => useMusicAPI(mockOptions));
    const mockCreateElement = document.createElement as jest.Mock;
    const mockLink = {
      href: '',
      download: '',
      click: jest.fn(),
      style: {},
    };
    mockCreateElement.mockReturnValue(mockLink);

    await act(async () => {
      await result.current.downloadMusic('music-123', 'custom-filename.mp3');
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/v1/sessions/test-session-123/music/music-123/download',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-token',
        }),
      })
    );

    expect(global.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
    expect(mockLink.download).toBe('custom-filename.mp3');
    expect(mockLink.click).toHaveBeenCalled();
    expect(document.body.appendChild).toHaveBeenCalledWith(mockLink);
    expect(document.body.removeChild).toHaveBeenCalledWith(mockLink);
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('mock-object-url');
  });

  it('downloadMusic에서 Content-Disposition 헤더로 파일명을 추출해야 함', async () => {
    const mockBlob = new Blob(['mock-audio-data'], { type: 'audio/mpeg' });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      blob: async () => mockBlob,
      headers: {
        get: (name: string) => {
          if (name === 'Content-Disposition') {
            return 'attachment; filename="generated-music-123.mp3"';
          }
          return null;
        },
      },
    } as Response);

    const { result } = renderHook(() => useMusicAPI(mockOptions));
    const mockCreateElement = document.createElement as jest.Mock;
    const mockLink = {
      href: '',
      download: '',
      click: jest.fn(),
      style: {},
    };
    mockCreateElement.mockReturnValue(mockLink);

    await act(async () => {
      await result.current.downloadMusic('music-123');
    });

    expect(mockLink.download).toBe('generated-music-123.mp3');
  });

  it('폴링이 올바르게 시작되고 중단되어야 함', async () => {
    jest.useFakeTimers();

    // 첫 번째 호출: generating 상태
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...mockMusicInfo, status: 'generating' }),
    } as Response);

    // 두 번째 호출: completed 상태
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockMusicInfo,
    } as Response);

    const { result } = renderHook(() => useMusicAPI(mockOptions));

    await act(async () => {
      result.current.startPolling('music-123', 1000);
    });

    expect(result.current.isPolling).toBe(true);

    // 첫 번째 폴링 실행
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    // 두 번째 폴링 실행 (completed 상태로 변경되어 폴링 중단)
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(result.current.isPolling).toBe(false);
    });

    expect(mockFetch).toHaveBeenCalledTimes(3); // 초기 호출 + 2번의 폴링

    jest.useRealTimers();
  });

  it('폴링 중 failed 상태에서도 중단되어야 함', async () => {
    jest.useFakeTimers();

    // 첫 번째 호출: generating 상태
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...mockMusicInfo, status: 'generating' }),
    } as Response);

    // 두 번째 호출: failed 상태
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...mockMusicInfo, status: 'failed' }),
    } as Response);

    const { result } = renderHook(() => useMusicAPI(mockOptions));

    await act(async () => {
      result.current.startPolling('music-123', 1000);
    });

    expect(result.current.isPolling).toBe(true);

    // 첫 번째 폴링 실행
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    // 두 번째 폴링 실행 (failed 상태로 변경되어 폴링 중단)
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(result.current.isPolling).toBe(false);
    });

    jest.useRealTimers();
  });

  it('stopPolling이 폴링을 올바르게 중단해야 함', async () => {
    jest.useFakeTimers();

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ...mockMusicInfo, status: 'generating' }),
    } as Response);

    const { result } = renderHook(() => useMusicAPI(mockOptions));

    await act(async () => {
      result.current.startPolling('music-123', 1000);
    });

    expect(result.current.isPolling).toBe(true);

    act(() => {
      result.current.stopPolling();
    });

    expect(result.current.isPolling).toBe(false);

    jest.useRealTimers();
  });

  it('clearError가 에러 상태를 정리해야 함', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ detail: { message: '서버 오류' } }),
    } as Response);

    const { result } = renderHook(() => useMusicAPI(mockOptions));

    await act(async () => {
      await result.current.getMusicInfo('music-123');
    });

    expect(result.current.error).toBe('서버 오류');

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('refreshMusicInfo가 getMusicInfo를 호출해야 함', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockMusicInfo,
    } as Response);

    const { result } = renderHook(() => useMusicAPI(mockOptions));

    await act(async () => {
      await result.current.refreshMusicInfo('music-123');
    });

    expect(result.current.currentMusic).toEqual(mockMusicInfo);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/v1/sessions/test-session-123/music/music-123',
      expect.objectContaining({
        method: 'GET',
      })
    );
  });

  it('세션 ID나 음악 ID가 없을 때 적절한 에러를 반환해야 함', async () => {
    const { result } = renderHook(() => useMusicAPI({ ...mockOptions, sessionId: '' }));

    let musicInfo: any;
    await act(async () => {
      musicInfo = await result.current.getMusicInfo('music-123');
    });

    expect(musicInfo).toBeNull();
    expect(result.current.error).toBe('세션 ID와 음악 ID가 필요합니다.');
  });

  it('downloadMusic에서 세션 ID나 음악 ID가 없을 때 적절한 에러를 반환해야 함', async () => {
    const { result } = renderHook(() => useMusicAPI({ ...mockOptions, sessionId: '' }));

    await act(async () => {
      await result.current.downloadMusic('music-123');
    });

    expect(result.current.error).toBe('세션 ID와 음악 ID가 필요합니다.');
  });
});