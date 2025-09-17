/**
 * MusicPlayer Component Unit Tests
 *
 * AI 생성 음악 플레이어의 모든 기능을 테스트
 * - 기본 재생/일시정지/정지 기능
 * - 진행바 조작 및 시간 표시
 * - 볼륨 조절 및 음소거
 * - 다운로드 기능
 * - 오디오 이벤트 처리
 * - 에러 상태 관리
 * - 접근성 준수
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import MusicPlayer from '../../../src/components/MusicPlayer';
import type { GeneratedMusic } from '../../../shared/types/api';

// Mock Audio 클래스
class MockAudio {
  src = '';
  volume = 1;
  muted = false;
  currentTime = 0;
  duration = 0;
  paused = true;
  ended = false;
  readyState = 0;
  autoplay = false;
  preload = 'metadata';

  private eventListeners: { [key: string]: Function[] } = {};

  constructor(src?: string) {
    if (src) this.src = src;
    // 기본 duration 설정 (3분)
    setTimeout(() => {
      this.duration = 180;
      this.readyState = 4; // HAVE_ENOUGH_DATA
      this.dispatchEvent('loadedmetadata');
    }, 10);
  }

  addEventListener(event: string, callback: Function) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  removeEventListener(event: string, callback: Function) {
    if (this.eventListeners[event]) {
      this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
    }
  }

  dispatchEvent(event: string, data?: any) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(callback => callback(data));
    }
  }

  async play() {
    if (this.src === 'error://test') {
      throw new Error('Network error');
    }
    this.paused = false;
    this.dispatchEvent('play');
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
    this.dispatchEvent('pause');
  }

  load() {
    this.dispatchEvent('loadstart');
    setTimeout(() => {
      if (this.src === 'error://test') {
        this.dispatchEvent('error');
      } else {
        this.duration = 180;
        this.readyState = 4;
        this.dispatchEvent('loadedmetadata');
      }
    }, 10);
  }

  // 시간 업데이트 시뮬레이션
  simulateTimeUpdate(time: number) {
    this.currentTime = time;
    this.dispatchEvent('timeupdate');
  }

  // 재생 완료 시뮬레이션
  simulateEnded() {
    this.paused = true;
    this.ended = true;
    this.currentTime = this.duration;
    this.dispatchEvent('ended');
  }

  // 볼륨 변경 시뮬레이션
  simulateVolumeChange() {
    this.dispatchEvent('volumechange');
  }
}

// HTMLAudioElement Mock
(global as any).HTMLAudioElement = MockAudio;

// URL.createObjectURL Mock
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

// 테스트용 음악 데이터
const mockMusic: GeneratedMusic = {
  id: 'music-123',
  session_id: 'session-456',
  prompt_text: '차분한 느낌의 음악',
  emotion_profile: {
    dominant_emotion: 'calm',
    emotion_vector: { energy: 0.3, tension: 0.2, valence: 0.6 },
    confidence_score: 0.85,
    tempo_score: 0.4,
    rhythm_consistency: 0.8
  },
  file_url: 'https://example.com/music.wav',
  format: 'wav',
  duration: 180,
  file_size: 5242880,
  status: 'completed',
  quality_score: 0.92,
  generation_time: 25.5,
  created_at: '2024-01-15T10:30:00Z'
};

const mockGeneratingMusic: GeneratedMusic = {
  ...mockMusic,
  status: 'generating',
  file_url: null
};

describe('MusicPlayer 컴포넌트', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // fake timers가 활성화된 경우에만 정리
    if (jest.isMockFunction(setTimeout)) {
      try {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
      } catch (e) {
        // 이미 real timers로 되어있으면 무시
      }
    }
  });

  describe('기본 렌더링', () => {
    test('음악이 없을 때 기본 상태로 렌더링된다', () => {
      render(<MusicPlayer music={null} />);

      expect(screen.getByText('재생할 음악이 없습니다')).toBeInTheDocument();
      expect(screen.getByText('먼저 감정을 분석하고 음악을 생성해주세요')).toBeInTheDocument();

      const playButton = screen.getByLabelText('재생');
      expect(playButton).toBeDisabled();
    });

    test('완료된 음악이 있을 때 정보가 표시된다', () => {
      render(<MusicPlayer music={mockMusic} />);

      expect(screen.getByText('생성된 음악 #music-123')).toBeInTheDocument();
      expect(screen.getByText('형식: WAV')).toBeInTheDocument();
      expect(screen.getByText('길이: 3:00')).toBeInTheDocument();
      expect(screen.getByText('품질: 92%')).toBeInTheDocument();

      const playButton = screen.getByLabelText('재생');
      expect(playButton).not.toBeDisabled();
    });

    test('생성 중인 음악의 상태가 표시된다', () => {
      render(<MusicPlayer music={mockGeneratingMusic} />);

      expect(screen.getByText('음악이 생성 중입니다...')).toBeInTheDocument();

      const playButton = screen.getByLabelText('재생');
      expect(playButton).toBeDisabled();
    });

    test('커스텀 className이 적용된다', () => {
      const { container } = render(
        <MusicPlayer music={mockMusic} className="custom-player" />
      );

      expect(container.firstChild).toHaveClass('custom-player');
    });
  });

  describe('재생 제어', () => {
    test('재생 버튼 클릭 시 음악이 재생된다', async () => {
      const onPlayStateChange = jest.fn();
      render(
        <MusicPlayer
          music={mockMusic}
          onPlayStateChange={onPlayStateChange}
        />
      );

      const playButton = screen.getByLabelText('재생');
      await user.click(playButton);

      await waitFor(() => {
        expect(onPlayStateChange).toHaveBeenCalledWith(true);
        expect(screen.getByLabelText('일시정지')).toBeInTheDocument();
      });
    });

    test('일시정지 버튼 클릭 시 음악이 일시정지된다', async () => {
      const onPlayStateChange = jest.fn();
      render(
        <MusicPlayer
          music={mockMusic}
          onPlayStateChange={onPlayStateChange}
        />
      );

      // 먼저 재생
      const playButton = screen.getByLabelText('재생');
      await user.click(playButton);

      await waitFor(() => {
        expect(screen.getByLabelText('일시정지')).toBeInTheDocument();
      });

      // 일시정지
      const pauseButton = screen.getByLabelText('일시정지');
      await user.click(pauseButton);

      await waitFor(() => {
        expect(onPlayStateChange).toHaveBeenCalledWith(false);
        expect(screen.getByLabelText('재생')).toBeInTheDocument();
      });
    });

    test('정지 버튼 클릭 시 음악이 정지되고 처음으로 돌아간다', async () => {
      render(<MusicPlayer music={mockMusic} />);

      // 재생 시작
      const playButton = screen.getByLabelText('재생');
      await user.click(playButton);

      // 시간 진행 시뮬레이션
      const audio = document.querySelector('audio') as any;
      act(() => {
        audio.simulateTimeUpdate(60); // 1분으로 이동
      });

      // 정지
      const stopButton = screen.getByLabelText('정지');
      await user.click(stopButton);

      await waitFor(() => {
        expect(screen.getByText('0:00')).toBeInTheDocument();
      });
    });

    test('자동재생이 설정되면 음악이 자동으로 재생된다', async () => {
      const onPlayStateChange = jest.fn();
      render(
        <MusicPlayer
          music={mockMusic}
          autoPlay={true}
          onPlayStateChange={onPlayStateChange}
        />
      );

      await waitFor(() => {
        expect(onPlayStateChange).toHaveBeenCalledWith(true);
      });
    });
  });

  describe('진행바 조작', () => {
    test('진행바 클릭 시 해당 위치로 이동한다', async () => {
      render(<MusicPlayer music={mockMusic} />);

      await waitFor(() => {
        const progressBar = screen.getByRole('progressbar', { name: '재생 진행률' });
        expect(progressBar).toBeInTheDocument();
      });

      const progressBar = screen.getByRole('progressbar', { name: '재생 진행률' });

      // getBoundingClientRect Mock
      jest.spyOn(progressBar, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        right: 400,
        bottom: 8,
        width: 400,
        height: 8,
        x: 0,
        y: 0,
        toJSON: () => ({})
      });

      // 진행바 중간 클릭 (50% 위치)
      fireEvent.click(progressBar, { clientX: 200 });

      await waitFor(() => {
        // 진행률이 50%로 변경되었는지 확인
        expect(progressBar).toHaveAttribute('aria-valuenow', '50');
      });
    });

    test('진행률 변경 시 콜백이 호출된다', async () => {
      const onProgressChange = jest.fn();
      render(
        <MusicPlayer
          music={mockMusic}
          onProgressChange={onProgressChange}
        />
      );

      // 시간 업데이트 시뮬레이션
      const audio = document.querySelector('audio') as any;
      await waitFor(() => {
        expect(audio).toBeTruthy();
      });

      act(() => {
        audio.simulateTimeUpdate(90); // 1분 30초
      });

      await waitFor(() => {
        expect(onProgressChange).toHaveBeenCalledWith(0.5, 90, 180);
      });
    });
  });

  describe('볼륨 조절', () => {
    test('볼륨바 클릭 시 볼륨이 변경된다', async () => {
      render(<MusicPlayer music={mockMusic} enableVolumeControl={true} />);

      const volumeSlider = screen.getByRole('slider', { name: '볼륨' });

      // getBoundingClientRect Mock
      jest.spyOn(volumeSlider, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        right: 96,
        bottom: 8,
        width: 96,
        height: 8,
        x: 0,
        y: 0,
        toJSON: () => ({})
      });

      // 볼륨 50%로 설정
      fireEvent.click(volumeSlider, { clientX: 48 });

      await waitFor(() => {
        expect(screen.getByText('50')).toBeInTheDocument();
      });
    });

    test('음소거 버튼 클릭 시 음소거 상태가 변경된다', async () => {
      render(<MusicPlayer music={mockMusic} enableVolumeControl={true} />);

      const muteButton = screen.getByLabelText('음소거');
      await user.click(muteButton);

      await waitFor(() => {
        expect(screen.getByLabelText('음소거 해제')).toBeInTheDocument();
      });
    });

    test('볼륨 조절이 비활성화되면 볼륨 컨트롤이 표시되지 않는다', () => {
      render(<MusicPlayer music={mockMusic} enableVolumeControl={false} />);

      expect(screen.queryByRole('slider', { name: '볼륨' })).not.toBeInTheDocument();
      expect(screen.queryByLabelText('음소거')).not.toBeInTheDocument();
    });
  });

  describe('다운로드 기능', () => {
    test('다운로드 버튼 클릭 시 콜백이 호출된다', async () => {
      const onDownload = jest.fn();
      render(
        <MusicPlayer
          music={mockMusic}
          onDownload={onDownload}
          showDownload={true}
        />
      );

      const downloadButton = screen.getByLabelText('다운로드');
      await user.click(downloadButton);

      expect(onDownload).toHaveBeenCalledWith(mockMusic);
    });

    test('다운로드 콜백이 없으면 기본 다운로드 동작을 수행한다', async () => {
      // document.createElement Mock
      const mockLink = {
        href: '',
        download: '',
        click: jest.fn()
      };
      jest.spyOn(document, 'createElement').mockReturnValue(mockLink as any);

      render(
        <MusicPlayer
          music={mockMusic}
          showDownload={true}
        />
      );

      const downloadButton = screen.getByLabelText('다운로드');
      await user.click(downloadButton);

      expect(mockLink.href).toBe(mockMusic.file_url);
      expect(mockLink.download).toBe(`vibemusic-${mockMusic.id}.${mockMusic.format}`);
      expect(mockLink.click).toHaveBeenCalled();
    });

    test('다운로드 버튼이 비활성화되면 표시되지 않는다', () => {
      render(<MusicPlayer music={mockMusic} showDownload={false} />);

      expect(screen.queryByLabelText('다운로드')).not.toBeInTheDocument();
    });

    test('음악이 재생 가능하지 않으면 다운로드 버튼이 표시되지 않는다', () => {
      render(<MusicPlayer music={mockGeneratingMusic} showDownload={true} />);

      expect(screen.queryByLabelText('다운로드')).not.toBeInTheDocument();
    });
  });

  describe('시간 표시', () => {
    test('현재 시간과 총 길이가 올바르게 표시된다', async () => {
      render(<MusicPlayer music={mockMusic} />);

      await waitFor(() => {
        expect(screen.getByText('0:00')).toBeInTheDocument();
        expect(screen.getByText('3:00')).toBeInTheDocument();
      });
    });

    test('시간 업데이트 시 현재 시간이 변경된다', async () => {
      render(<MusicPlayer music={mockMusic} />);

      const audio = document.querySelector('audio') as any;
      await waitFor(() => {
        expect(audio).toBeTruthy();
      });

      act(() => {
        audio.simulateTimeUpdate(65); // 1분 5초
      });

      await waitFor(() => {
        expect(screen.getByText('1:05')).toBeInTheDocument();
      });
    });

    test('시간 포맷이 올바르게 표시된다', async () => {
      render(<MusicPlayer music={mockMusic} />);

      const audio = document.querySelector('audio') as any;
      await waitFor(() => {
        expect(audio).toBeTruthy();
      });

      // 다양한 시간으로 테스트
      act(() => {
        audio.simulateTimeUpdate(3665); // 1시간 1분 5초
      });

      await waitFor(() => {
        expect(screen.getByText('61:05')).toBeInTheDocument();
      });
    });
  });

  describe('오디오 이벤트 처리', () => {
    test('음악 로딩 시 로딩 상태가 표시된다', async () => {
      render(<MusicPlayer music={mockMusic} />);

      const playButton = screen.getByLabelText('재생');

      // 로딩 상태 시뮬레이션
      const audio = document.querySelector('audio') as any;
      act(() => {
        audio.dispatchEvent('loadstart');
      });

      await user.click(playButton);

      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
      });
    });

    test('음악 재생 완료 시 초기 상태로 돌아간다', async () => {
      const onPlayStateChange = jest.fn();
      render(
        <MusicPlayer
          music={mockMusic}
          onPlayStateChange={onPlayStateChange}
        />
      );

      const audio = document.querySelector('audio') as any;
      await waitFor(() => {
        expect(audio).toBeTruthy();
      });

      // 재생 완료 시뮬레이션
      act(() => {
        audio.simulateEnded();
      });

      await waitFor(() => {
        expect(onPlayStateChange).toHaveBeenCalledWith(false);
        expect(screen.getByText('0:00')).toBeInTheDocument();
      });
    });

    test('오디오 로드 에러 시 에러 메시지가 표시된다', async () => {
      const errorMusic = { ...mockMusic, file_url: 'error://test' };
      render(<MusicPlayer music={errorMusic} />);

      const audio = document.querySelector('audio') as any;
      await waitFor(() => {
        expect(audio).toBeTruthy();
      });

      act(() => {
        audio.dispatchEvent('error');
      });

      await waitFor(() => {
        expect(screen.getByText('음악을 로드할 수 없습니다.')).toBeInTheDocument();
      });
    });

    test('재생 에러 시 에러 메시지가 표시된다', async () => {
      const errorMusic = { ...mockMusic, file_url: 'error://test' };
      render(<MusicPlayer music={errorMusic} />);

      const playButton = screen.getByLabelText('재생');
      await user.click(playButton);

      await waitFor(() => {
        expect(screen.getByText('음악을 재생할 수 없습니다.')).toBeInTheDocument();
      });
    });
  });

  describe('접근성', () => {
    test('모든 버튼에 적절한 aria-label이 있다', () => {
      render(<MusicPlayer music={mockMusic} />);

      expect(screen.getByLabelText('재생')).toBeInTheDocument();
      expect(screen.getByLabelText('정지')).toBeInTheDocument();
      expect(screen.getByLabelText('다운로드')).toBeInTheDocument();
      expect(screen.getByLabelText('음소거')).toBeInTheDocument();
      expect(screen.getByLabelText('볼륨')).toBeInTheDocument();
      expect(screen.getByLabelText('재생 진행률')).toBeInTheDocument();
    });

    test('진행바에 적절한 aria 속성이 있다', async () => {
      render(<MusicPlayer music={mockMusic} />);

      await waitFor(() => {
        const progressBar = screen.getByRole('progressbar', { name: '재생 진행률' });
        expect(progressBar).toHaveAttribute('aria-valuenow', '0');
        expect(progressBar).toHaveAttribute('aria-valuemin', '0');
        expect(progressBar).toHaveAttribute('aria-valuemax', '100');
      });
    });

    test('볼륨 슬라이더에 적절한 aria 속성이 있다', () => {
      render(<MusicPlayer music={mockMusic} enableVolumeControl={true} />);

      const volumeSlider = screen.getByRole('slider', { name: '볼륨' });
      expect(volumeSlider).toHaveAttribute('aria-valuenow', '80');
      expect(volumeSlider).toHaveAttribute('aria-valuemin', '0');
      expect(volumeSlider).toHaveAttribute('aria-valuemax', '100');
    });

    test('에러 메시지에 적절한 role이 있다', async () => {
      const errorMusic = { ...mockMusic, file_url: 'error://test' };
      render(<MusicPlayer music={errorMusic} />);

      const audio = document.querySelector('audio') as any;
      await waitFor(() => {
        expect(audio).toBeTruthy();
      });

      act(() => {
        audio.dispatchEvent('error');
      });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });

    test('상태 메시지에 적절한 role이 있다', () => {
      render(<MusicPlayer music={mockGeneratingMusic} />);

      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('키보드 네비게이션', () => {
    test('탭 키로 모든 컨트롤에 접근할 수 있다', async () => {
      render(<MusicPlayer music={mockMusic} />);

      const playButton = screen.getByLabelText('재생');
      const stopButton = screen.getByLabelText('정지');
      const downloadButton = screen.getByLabelText('다운로드');
      const muteButton = screen.getByLabelText('음소거');

      // 탭 순서대로 포커스 이동
      await user.tab();
      expect(playButton).toHaveFocus();

      await user.tab();
      expect(stopButton).toHaveFocus();

      await user.tab();
      expect(downloadButton).toHaveFocus();

      await user.tab();
      expect(muteButton).toHaveFocus();
    });

    test('Enter/Space 키로 버튼을 활성화할 수 있다', async () => {
      const onPlayStateChange = jest.fn();
      render(
        <MusicPlayer
          music={mockMusic}
          onPlayStateChange={onPlayStateChange}
        />
      );

      const playButton = screen.getByLabelText('재생');
      playButton.focus();

      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(onPlayStateChange).toHaveBeenCalledWith(true);
      });
    });
  });

  describe('성능', () => {
    test('컴포넌트 언마운트 시 이벤트 리스너가 정리된다', () => {
      const { unmount } = render(<MusicPlayer music={mockMusic} />);

      const audio = document.querySelector('audio') as any;
      const removeEventListenerSpy = jest.spyOn(audio, 'removeEventListener');

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('loadstart', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('loadedmetadata', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('play', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('pause', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('timeupdate', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('ended', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('error', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('volumechange', expect.any(Function));
    });

    test('불필요한 리렌더링이 발생하지 않는다', () => {
      const renderSpy = jest.fn();
      const TestComponent = (props: any) => {
        renderSpy();
        return <MusicPlayer {...props} />;
      };

      const { rerender } = render(<TestComponent music={mockMusic} />);

      // 같은 props로 리렌더링
      rerender(<TestComponent music={mockMusic} />);

      // 리렌더링 횟수가 합리적인지 확인 (초기 + 메타데이터 로드)
      expect(renderSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge Cases', () => {
    test('음악이 null에서 유효한 음악으로 변경될 때 정상적으로 동작한다', async () => {
      const { rerender } = render(<MusicPlayer music={null} />);

      expect(screen.getByText('재생할 음악이 없습니다')).toBeInTheDocument();

      rerender(<MusicPlayer music={mockMusic} />);

      await waitFor(() => {
        expect(screen.getByText('생성된 음악 #music-123')).toBeInTheDocument();
        expect(screen.getByLabelText('재생')).not.toBeDisabled();
      });
    });

    test('진행바가 매우 짧은 음악에서도 정상적으로 동작한다', async () => {
      const shortMusic = { ...mockMusic, duration: 5 };
      render(<MusicPlayer music={shortMusic} />);

      await waitFor(() => {
        expect(screen.getByText('0:05')).toBeInTheDocument();
      });
    });

    test('매우 긴 음악에서도 시간이 올바르게 표시된다', async () => {
      const longMusic = { ...mockMusic, duration: 7200 }; // 2시간
      render(<MusicPlayer music={longMusic} />);

      await waitFor(() => {
        expect(screen.getByText('120:00')).toBeInTheDocument();
      });
    });

    test('품질 점수가 없는 음악도 정상적으로 표시된다', () => {
      const musicWithoutQuality = { ...mockMusic };
      delete musicWithoutQuality.quality_score;

      render(<MusicPlayer music={musicWithoutQuality} />);

      expect(screen.getByText('생성된 음악 #music-123')).toBeInTheDocument();
      expect(screen.queryByText('품질:')).not.toBeInTheDocument();
    });

    test('파일 URL이 없는 음악은 재생할 수 없다', () => {
      const musicWithoutUrl = { ...mockMusic, file_url: null };
      render(<MusicPlayer music={musicWithoutUrl} />);

      const playButton = screen.getByLabelText('재생');
      expect(playButton).toBeDisabled();
    });
  });
});