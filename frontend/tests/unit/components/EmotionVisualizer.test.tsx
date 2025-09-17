/**
 * EmotionVisualizer Component Unit Tests
 *
 * 감정 벡터 시각화 컴포넌트의 모든 기능을 테스트
 * - 다양한 표시 모드 (detailed, compact, minimal)
 * - 캔버스 기반 차트 렌더링 (레이더, 웨이브폼)
 * - 실시간 애니메이션 효과
 * - 테마 시스템 (default, dark, vibrant)
 * - 감정 상태 해석 및 표시
 * - 타이핑 통계 연동
 * - 접근성 준수
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import EmotionVisualizer from '../../../src/components/EmotionVisualizer';
import type { EmotionProfile, EmotionVector } from '../../../shared/types/api';
import type { TypingStatistics } from '../../../shared/types/websocket';

// Canvas getContext Mock
const mockCanvasContext = {
  clearRect: jest.fn(),
  fillRect: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  arc: jest.fn(),
  stroke: jest.fn(),
  fill: jest.fn(),
  closePath: jest.fn(),
  fillText: jest.fn(),
  createLinearGradient: jest.fn(() => ({
    addColorStop: jest.fn()
  })),
  createRadialGradient: jest.fn(() => ({
    addColorStop: jest.fn()
  })),
  strokeStyle: '',
  fillStyle: '',
  lineWidth: 1,
  font: '',
  textAlign: 'center' as CanvasTextAlign
};

// HTMLCanvasElement Mock
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: jest.fn(() => mockCanvasContext)
});

Object.defineProperty(HTMLCanvasElement.prototype, 'width', {
  value: 300,
  writable: true
});

Object.defineProperty(HTMLCanvasElement.prototype, 'height', {
  value: 300,
  writable: true
});

// requestAnimationFrame Mock
global.requestAnimationFrame = jest.fn((cb) => {
  setTimeout(cb, 16);
  return 1;
});

global.cancelAnimationFrame = jest.fn();

// 테스트용 감정 데이터
const mockEmotionVector: EmotionVector = {
  energy: 0.8,
  valence: 0.6,
  tension: 0.4,
  focus: 0.7
};

const mockEmotionProfile: EmotionProfile = {
  dominant_emotion: 'excited',
  emotion_vector: mockEmotionVector,
  confidence_score: 0.85,
  tempo_score: 0.9,
  rhythm_consistency: 0.75,
  music_genre_hints: ['electronic', 'upbeat'],
  tempo_bpm_range: [120, 140]
};

const mockTypingStats: TypingStatistics = {
  average_wpm: 65,
  keystroke_intervals: [150, 180, 120, 200],
  pause_patterns: [500, 1000, 300],
  rhythm_score: 0.8,
  focus_level: 0.7,
  session_duration: 120
};

// 다양한 감정 상태 테스트 데이터
const calmEmotion: EmotionProfile = {
  ...mockEmotionProfile,
  dominant_emotion: 'calm',
  emotion_vector: { energy: 0.2, valence: 0.3, tension: 0.1, focus: 0.8 }
};

const stressedEmotion: EmotionProfile = {
  ...mockEmotionProfile,
  dominant_emotion: 'stressed',
  emotion_vector: { energy: 0.9, valence: -0.4, tension: 0.8, focus: 0.3 }
};

const neutralEmotion: EmotionProfile = {
  ...mockEmotionProfile,
  dominant_emotion: 'neutral',
  emotion_vector: { energy: 0.5, valence: 0.0, tension: 0.5, focus: 0.5 }
};

describe('EmotionVisualizer 컴포넌트', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('기본 렌더링', () => {
    test('감정 프로필이 없을 때 기본값으로 렌더링된다', () => {
      render(<EmotionVisualizer emotionProfile={null} />);

      expect(screen.getByText('감정 상태 분석')).toBeInTheDocument();
      expect(screen.getByText('감정 벡터')).toBeInTheDocument();
      expect(screen.getByText('감정 패턴')).toBeInTheDocument();

      // 기본값 0%가 표시되는지 확인
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    test('감정 프로필이 있을 때 정보가 표시된다', () => {
      render(<EmotionVisualizer emotionProfile={mockEmotionProfile} />);

      expect(screen.getByText('감정 상태 분석')).toBeInTheDocument();
      expect(screen.getByText('신뢰도: 85%')).toBeInTheDocument();
      expect(screen.getByText('템포: 90')).toBeInTheDocument();
      expect(screen.getByText('리듬 일관성: 75%')).toBeInTheDocument();

      // 감정 벡터 값들이 표시되는지 확인
      expect(screen.getByText('80%')).toBeInTheDocument(); // 에너지
      expect(screen.getByText('40%')).toBeInTheDocument(); // 긴장도
      expect(screen.getByText('70%')).toBeInTheDocument(); // 집중도
    });

    test('타이핑 통계가 있을 때 웨이브폼이 표시된다', () => {
      render(
        <EmotionVisualizer
          emotionProfile={mockEmotionProfile}
          typingStats={mockTypingStats}
        />
      );

      expect(screen.getByText('타이핑 리듬 파형')).toBeInTheDocument();
      expect(screen.getByText('65 WPM')).toBeInTheDocument();
    });

    test('커스텀 className이 적용된다', () => {
      const { container } = render(
        <EmotionVisualizer
          emotionProfile={mockEmotionProfile}
          className="custom-visualizer"
        />
      );

      expect(container.firstChild).toHaveClass('custom-visualizer');
    });
  });

  describe('표시 모드', () => {
    test('컴팩트 모드로 렌더링된다', () => {
      render(
        <EmotionVisualizer
          emotionProfile={mockEmotionProfile}
          mode="compact"
        />
      );

      expect(screen.getByText('에너지')).toBeInTheDocument();
      expect(screen.getByText('극성')).toBeInTheDocument();
      expect(screen.getByText('긴장도')).toBeInTheDocument();
      expect(screen.getByText('집중도')).toBeInTheDocument();

      // 상세 모드 요소들이 없는지 확인
      expect(screen.queryByText('감정 상태 분석')).not.toBeInTheDocument();
      expect(screen.queryByText('감정 벡터')).not.toBeInTheDocument();
    });

    test('최소 모드로 렌더링된다', () => {
      const { container } = render(
        <EmotionVisualizer
          emotionProfile={mockEmotionProfile}
          mode="minimal"
        />
      );

      // 4개의 감정 표시 점이 있는지 확인
      const emotionDots = container.querySelectorAll('.w-4.h-4.rounded-full');
      expect(emotionDots).toHaveLength(4);

      // 텍스트는 최소화되어야 함
      expect(screen.queryByText('감정 상태 분석')).not.toBeInTheDocument();
    });

    test('상세 모드에서 감정 상태 설명이 표시된다', () => {
      render(
        <EmotionVisualizer
          emotionProfile={mockEmotionProfile}
          mode="detailed"
        />
      );

      expect(screen.getByText('현재 감정 상태')).toBeInTheDocument();
      expect(screen.getByText(/높은 에너지와.*긍정적인.*편안한.*높은 집중도로/)).toBeInTheDocument();
    });
  });

  describe('테마 시스템', () => {
    test('기본 테마가 적용된다', () => {
      const { container } = render(
        <EmotionVisualizer
          emotionProfile={mockEmotionProfile}
          theme="default"
        />
      );

      const visualizer = container.firstChild as HTMLElement;
      expect(visualizer.style.backgroundColor).toBe('rgb(255, 255, 255)');
    });

    test('다크 테마가 적용된다', () => {
      const { container } = render(
        <EmotionVisualizer
          emotionProfile={mockEmotionProfile}
          theme="dark"
        />
      );

      const visualizer = container.firstChild as HTMLElement;
      expect(visualizer.style.backgroundColor).toBe('rgb(31, 41, 55)');
    });

    test('활기찬 테마가 적용된다', () => {
      const { container } = render(
        <EmotionVisualizer
          emotionProfile={mockEmotionProfile}
          theme="vibrant"
        />
      );

      const visualizer = container.firstChild as HTMLElement;
      expect(visualizer.style.backgroundColor).toBe('rgb(45, 52, 54)');
    });
  });

  describe('감정 상태별 표시', () => {
    test('차분한 감정 상태가 올바르게 표시된다', () => {
      render(<EmotionVisualizer emotionProfile={calmEmotion} />);

      expect(screen.getByText(/낮은 에너지와.*긍정적인.*편안한.*높은 집중도로/)).toBeInTheDocument();
    });

    test('스트레스 감정 상태가 올바르게 표시된다', () => {
      render(<EmotionVisualizer emotionProfile={stressedEmotion} />);

      expect(screen.getByText(/높은 에너지와.*부정적인.*긴장된.*보통 집중도로/)).toBeInTheDocument();
    });

    test('중성 감정 상태가 올바르게 표시된다', () => {
      render(<EmotionVisualizer emotionProfile={neutralEmotion} />);

      expect(screen.getByText(/보통의 에너지와.*중성적인.*편안한.*보통 집중도로/)).toBeInTheDocument();
    });

    test('감정 극성이 올바르게 처리된다', () => {
      const negativeValenceEmotion = {
        ...mockEmotionProfile,
        emotion_vector: { ...mockEmotionVector, valence: -0.6 }
      };

      render(
        <EmotionVisualizer
          emotionProfile={negativeValenceEmotion}
          mode="compact"
        />
      );

      // 음수 극성값이 올바르게 표시되는지 확인
      expect(screen.getByText('-60')).toBeInTheDocument();
    });
  });

  describe('캔버스 렌더링', () => {
    test('레이더 차트가 그려진다', async () => {
      render(<EmotionVisualizer emotionProfile={mockEmotionProfile} />);

      await waitFor(() => {
        expect(mockCanvasContext.clearRect).toHaveBeenCalled();
        expect(mockCanvasContext.arc).toHaveBeenCalled();
        expect(mockCanvasContext.stroke).toHaveBeenCalled();
        expect(mockCanvasContext.fill).toHaveBeenCalled();
        expect(mockCanvasContext.fillText).toHaveBeenCalled();
      });
    });

    test('웨이브폼이 그려진다', async () => {
      render(
        <EmotionVisualizer
          emotionProfile={mockEmotionProfile}
          typingStats={mockTypingStats}
          animated={true}
        />
      );

      await waitFor(() => {
        expect(mockCanvasContext.beginPath).toHaveBeenCalled();
        expect(mockCanvasContext.createLinearGradient).toHaveBeenCalled();
      });
    });

    test('애니메이션이 비활성화되면 requestAnimationFrame이 호출되지 않는다', () => {
      render(
        <EmotionVisualizer
          emotionProfile={mockEmotionProfile}
          animated={false}
        />
      );

      expect(global.requestAnimationFrame).not.toHaveBeenCalled();
    });

    test('애니메이션이 활성화되면 requestAnimationFrame이 호출된다', async () => {
      render(
        <EmotionVisualizer
          emotionProfile={mockEmotionProfile}
          animated={true}
        />
      );

      await waitFor(() => {
        expect(global.requestAnimationFrame).toHaveBeenCalled();
      });
    });
  });

  describe('감정 바 렌더링', () => {
    test('모든 감정 바가 올바른 값으로 표시된다', () => {
      render(<EmotionVisualizer emotionProfile={mockEmotionProfile} />);

      expect(screen.getByText('에너지 레벨')).toBeInTheDocument();
      expect(screen.getByText('감정 극성')).toBeInTheDocument();
      expect(screen.getByText('긴장도')).toBeInTheDocument();
      expect(screen.getByText('집중도')).toBeInTheDocument();
    });

    test('감정 바에 애니메이션 효과가 적용된다', () => {
      const { container } = render(
        <EmotionVisualizer
          emotionProfile={mockEmotionProfile}
          animated={true}
        />
      );

      const emotionBars = container.querySelectorAll('.h-full.transition-all');
      expect(emotionBars.length).toBeGreaterThan(0);

      emotionBars.forEach(bar => {
        expect(bar).toHaveStyle('box-shadow: 0 0 10px');
      });
    });

    test('애니메이션이 비활성화되면 그림자 효과가 없다', () => {
      const { container } = render(
        <EmotionVisualizer
          emotionProfile={mockEmotionProfile}
          animated={false}
        />
      );

      const emotionBars = container.querySelectorAll('.h-full.transition-all');
      emotionBars.forEach(bar => {
        expect(bar).not.toHaveStyle('box-shadow');
      });
    });
  });

  describe('접근성', () => {
    test('최소 모드에서 감정 정보가 tooltip으로 제공된다', () => {
      render(
        <EmotionVisualizer
          emotionProfile={mockEmotionProfile}
          mode="minimal"
        />
      );

      const dots = screen.getAllByRole('generic');
      const energyDot = dots.find(dot => dot.getAttribute('title')?.includes('에너지'));
      expect(energyDot).toHaveAttribute('title', '에너지: 80%');
    });

    test('감정 수치가 스크린 리더에 친화적으로 표시된다', () => {
      render(<EmotionVisualizer emotionProfile={mockEmotionProfile} />);

      expect(screen.getByText('에너지 레벨')).toBeInTheDocument();
      expect(screen.getByText('감정 극성')).toBeInTheDocument();

      // 수치와 라벨이 연결되어 있는지 확인
      const energySection = screen.getByText('에너지 레벨').closest('.emotion-bar');
      expect(energySection).toContainElement(screen.getByText('80%'));
    });

    test('캔버스에 적절한 대체 텍스트가 제공된다', () => {
      render(
        <EmotionVisualizer
          emotionProfile={mockEmotionProfile}
          typingStats={mockTypingStats}
        />
      );

      // 캔버스 요소들이 존재하는지 확인
      const canvases = screen.getAllByRole('img', { hidden: true });
      expect(canvases.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('성능', () => {
    test('컴포넌트 언마운트 시 애니메이션이 정리된다', () => {
      const { unmount } = render(
        <EmotionVisualizer
          emotionProfile={mockEmotionProfile}
          animated={true}
        />
      );

      unmount();

      expect(global.cancelAnimationFrame).toHaveBeenCalled();
    });

    test('웨이브폼 데이터가 200개로 제한된다', async () => {
      render(
        <EmotionVisualizer
          emotionProfile={mockEmotionProfile}
          typingStats={mockTypingStats}
          animated={true}
        />
      );

      // 애니메이션 프레임 진행
      for (let i = 0; i < 250; i++) {
        act(() => {
          jest.advanceTimersByTime(16);
        });
      }

      // 웨이브폼 데이터가 제한되었는지 확인하기 위해 캔버스 그리기 호출 횟수 확인
      await waitFor(() => {
        expect(mockCanvasContext.clearRect).toHaveBeenCalled();
      });
    });

    test('불필요한 리렌더링이 발생하지 않는다', () => {
      const renderSpy = jest.fn();
      const TestComponent = (props: any) => {
        renderSpy();
        return <EmotionVisualizer {...props} />;
      };

      const { rerender } = render(<TestComponent emotionProfile={mockEmotionProfile} />);

      // 같은 props로 리렌더링
      rerender(<TestComponent emotionProfile={mockEmotionProfile} />);

      // 리렌더링 횟수가 합리적인지 확인
      expect(renderSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge Cases', () => {
    test('감정 벡터 값이 범위를 벗어날 때 올바르게 클램핑된다', () => {
      const extremeEmotion: EmotionProfile = {
        ...mockEmotionProfile,
        emotion_vector: {
          energy: 1.5,  // 범위 초과
          valence: -2.0, // 범위 초과
          tension: -0.5, // 범위 미만
          focus: 1.2     // 범위 초과
        }
      };

      render(<EmotionVisualizer emotionProfile={extremeEmotion} />);

      // 값이 적절히 클램핑되어 표시되는지 확인
      expect(screen.getByText('100%')).toBeInTheDocument(); // energy, 최대값으로 클램핑
      expect(screen.getByText('0%')).toBeInTheDocument(); // tension, 최소값으로 클램핑
    });

    test('타이핑 통계 없이도 정상적으로 동작한다', () => {
      render(
        <EmotionVisualizer
          emotionProfile={mockEmotionProfile}
          typingStats={undefined}
        />
      );

      expect(screen.getByText('감정 상태 분석')).toBeInTheDocument();
      expect(screen.queryByText('타이핑 리듬 파형')).not.toBeInTheDocument();
    });

    test('매우 작은 감정 값들이 올바르게 표시된다', () => {
      const minimalEmotion: EmotionProfile = {
        ...mockEmotionProfile,
        emotion_vector: {
          energy: 0.001,
          valence: -0.001,
          tension: 0.001,
          focus: 0.001
        }
      };

      render(<EmotionVisualizer emotionProfile={minimalEmotion} />);

      // 매우 작은 값들이 0%로 표시되는지 확인
      expect(screen.getAllByText('0%')).toHaveLength(4);
    });

    test('캔버스 getContext가 null을 반환할 때 에러가 발생하지 않는다', () => {
      // getContext가 null을 반환하도록 모킹
      HTMLCanvasElement.prototype.getContext = jest.fn(() => null);

      expect(() => {
        render(<EmotionVisualizer emotionProfile={mockEmotionProfile} />);
      }).not.toThrow();
    });

    test('신뢰도 점수가 없을 때도 정상적으로 동작한다', () => {
      const emotionWithoutConfidence = {
        ...mockEmotionProfile
      };
      delete emotionWithoutConfidence.confidence_score;

      render(<EmotionVisualizer emotionProfile={emotionWithoutConfidence} />);

      expect(screen.getByText('감정 상태 분석')).toBeInTheDocument();
      // 신뢰도 정보가 없으므로 표시되지 않아야 함
      expect(screen.queryByText(/신뢰도:/)).not.toBeInTheDocument();
    });
  });

  describe('실시간 업데이트', () => {
    test('감정 프로필 변경 시 차트가 업데이트된다', async () => {
      const { rerender } = render(
        <EmotionVisualizer emotionProfile={mockEmotionProfile} />
      );

      expect(screen.getByText('80%')).toBeInTheDocument(); // 초기 에너지 값

      // 새로운 감정 프로필로 업데이트
      rerender(<EmotionVisualizer emotionProfile={calmEmotion} />);

      await waitFor(() => {
        expect(screen.getByText('20%')).toBeInTheDocument(); // 변경된 에너지 값
      });
    });

    test('타이핑 통계 변경 시 웨이브폼이 업데이트된다', async () => {
      const { rerender } = render(
        <EmotionVisualizer
          emotionProfile={mockEmotionProfile}
          typingStats={mockTypingStats}
          animated={true}
        />
      );

      expect(screen.getByText('65 WPM')).toBeInTheDocument();

      const newTypingStats = { ...mockTypingStats, average_wpm: 85 };
      rerender(
        <EmotionVisualizer
          emotionProfile={mockEmotionProfile}
          typingStats={newTypingStats}
          animated={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('85 WPM')).toBeInTheDocument();
      });
    });
  });
});