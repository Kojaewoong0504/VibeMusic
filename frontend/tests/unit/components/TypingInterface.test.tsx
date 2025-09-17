/**
 * TypingInterface 컴포넌트 단위 테스트
 *
 * T084: React 컴포넌트 단위 테스트 구현
 * - 타이핑 인터페이스 기능 검증
 * - 키스트로크 이벤트 처리 검증
 * - 실시간 통계 계산 검증
 * - 사용자 상호작용 테스트
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import TypingInterface from '../../../src/components/TypingInterface';

// shared types는 실제 타입을 사용 (mock 제거)

describe('TypingInterface Component', () => {
  const defaultProps = {
    onKeystroke: jest.fn(),
    onTextChange: jest.fn(),
    onStatsChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('렌더링 테스트', () => {
    it('기본 props로 정상 렌더링', () => {
      render(<TypingInterface {...defaultProps} />);

      expect(screen.getByText('당신의 감정을 자유롭게 타이핑해보세요...')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('여기에 입력하세요')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('커스텀 props로 렌더링', () => {
      const customProps = {
        ...defaultProps,
        prompt: '커스텀 프롬프트',
        placeholder: '커스텀 플레이스홀더',
        maxLength: 500,
        disabled: true,
        className: 'custom-class'
      };

      render(<TypingInterface {...customProps} />);

      expect(screen.getByText('커스텀 프롬프트')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('커스텀 플레이스홀더')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeDisabled();
      expect(screen.getByRole('textbox')).toHaveAttribute('maxLength', '500');
    });

    it('활성 상태 표시', () => {
      render(<TypingInterface {...defaultProps} isActive={true} />);

      const container = screen.getByRole('textbox').closest('.typing-interface');
      expect(container).toHaveClass('typing-interface--active');
    });

    it('비활성 상태에서 입력 불가', () => {
      render(<TypingInterface {...defaultProps} disabled={true} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea).toBeDisabled();
    });
  });

  describe('텍스트 입력 테스트', () => {
    it('텍스트 입력 시 onTextChange 호출', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<TypingInterface {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Hello World');

      expect(defaultProps.onTextChange).toHaveBeenCalledWith('Hello World');
    });

    it('maxLength 제한 동작', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<TypingInterface {...defaultProps} maxLength={5} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Hello World');

      expect(textarea).toHaveValue('Hello');
    });

    it('Enter 키 입력 시 새 줄 생성', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<TypingInterface {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Line 1{enter}Line 2');

      expect(textarea).toHaveValue('Line 1\nLine 2');
    });
  });

  describe('키스트로크 이벤트 테스트', () => {
    it('키 다운 이벤트에서 onKeystroke 호출', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<TypingInterface {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'a');

      expect(defaultProps.onKeystroke).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'a',
          timestamp: expect.any(Number),
          event_type: 'keydown'
        })
      );
    });

    it('특수 키 처리 (Space, Enter, Backspace)', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<TypingInterface {...defaultProps} />);

      const textarea = screen.getByRole('textbox');

      // Space 키
      await user.type(textarea, ' ');
      expect(defaultProps.onKeystroke).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'Space' })
      );

      // Enter 키
      await user.keyboard('{Enter}');
      expect(defaultProps.onKeystroke).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'Enter' })
      );

      // Backspace 키
      await user.keyboard('{Backspace}');
      expect(defaultProps.onKeystroke).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'Backspace' })
      );
    });

    it('키스트로크 타임스탬프 기록', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<TypingInterface {...defaultProps} />);

      const textarea = screen.getByRole('textbox');

      // 첫 번째 키 입력
      await user.type(textarea, 'a');
      const firstCall = defaultProps.onKeystroke.mock.calls[0][0];

      act(() => {
        jest.advanceTimersByTime(100);
      });

      // 두 번째 키 입력
      await user.type(textarea, 'b');
      const secondCall = defaultProps.onKeystroke.mock.calls[1][0];

      // 타임스탬프가 증가했는지 확인
      expect(secondCall.timestamp).toBeGreaterThan(firstCall.timestamp);
    });
  });

  describe('타이핑 통계 테스트', () => {
    it('WPM 계산', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<TypingInterface {...defaultProps} />);

      const textarea = screen.getByRole('textbox');

      // 1분 경과 시뮬레이션
      act(() => {
        jest.advanceTimersByTime(60000); // 1분
      });

      // 25글자 입력 (5단어)
      await user.type(textarea, 'This is exactly five words');

      // 통계 업데이트 대기
      await waitFor(() => {
        expect(defaultProps.onStatsChange).toHaveBeenCalledWith(
          expect.objectContaining({
            wpm: expect.any(Number),
            totalChars: 25
          })
        );
      });
    });

    it('평균 키 간격 계산', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<TypingInterface {...defaultProps} />);

      const textarea = screen.getByRole('textbox');

      // 일정한 간격으로 키 입력
      for (let i = 0; i < 5; i++) {
        await user.type(textarea, 'a');
        act(() => {
          jest.advanceTimersByTime(200); // 200ms 간격
        });
      }

      await waitFor(() => {
        expect(defaultProps.onStatsChange).toHaveBeenCalledWith(
          expect.objectContaining({
            averageInterval: expect.any(Number)
          })
        );
      });
    });

    it('일시정지 카운트', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<TypingInterface {...defaultProps} />);

      const textarea = screen.getByRole('textbox');

      // 빠른 타이핑
      await user.type(textarea, 'fast');

      // 긴 일시정지 (1초)
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // 다시 타이핑
      await user.type(textarea, 'slow');

      await waitFor(() => {
        expect(defaultProps.onStatsChange).toHaveBeenCalledWith(
          expect.objectContaining({
            pauseCount: expect.any(Number)
          })
        );
      });
    });

    it('리듬 패턴 분석 - steady', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<TypingInterface {...defaultProps} />);

      const textarea = screen.getByRole('textbox');

      // 일정한 간격으로 타이핑
      for (let i = 0; i < 10; i++) {
        await user.type(textarea, 'a');
        act(() => {
          jest.advanceTimersByTime(150); // 일정한 150ms 간격
        });
      }

      await waitFor(() => {
        expect(defaultProps.onStatsChange).toHaveBeenCalledWith(
          expect.objectContaining({
            rhythm: 'steady'
          })
        );
      });
    });

    it('리듬 패턴 분석 - variable', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<TypingInterface {...defaultProps} />);

      const textarea = screen.getByRole('textbox');

      // 불규칙한 간격으로 타이핑
      const intervals = [50, 300, 100, 500, 80, 400];
      for (let i = 0; i < intervals.length; i++) {
        await user.type(textarea, 'a');
        act(() => {
          jest.advanceTimersByTime(intervals[i]);
        });
      }

      await waitFor(() => {
        expect(defaultProps.onStatsChange).toHaveBeenCalledWith(
          expect.objectContaining({
            rhythm: 'variable'
          })
        );
      });
    });

    it('리듬 패턴 분석 - bursts', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<TypingInterface {...defaultProps} />);

      const textarea = screen.getByRole('textbox');

      // 버스트 패턴 (빠른 연속 입력)
      for (let i = 0; i < 10; i++) {
        await user.type(textarea, 'a');
        act(() => {
          jest.advanceTimersByTime(50); // 매우 빠른 간격
        });
      }

      await waitFor(() => {
        expect(defaultProps.onStatsChange).toHaveBeenCalledWith(
          expect.objectContaining({
            rhythm: 'bursts'
          })
        );
      });
    });
  });

  describe('타이핑 상태 표시 테스트', () => {
    it('타이핑 중일 때 시각적 표시', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<TypingInterface {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      const container = textarea.closest('.typing-interface');

      await user.type(textarea, 'a');

      expect(container).toHaveClass('typing-interface--typing');
    });

    it('타이핑 멈췄을 때 상태 변경', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<TypingInterface {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      const container = textarea.closest('.typing-interface');

      await user.type(textarea, 'a');

      // 타이핑 중 상태 확인
      expect(container).toHaveClass('typing-interface--typing');

      // 2초 후 타이핑 멈춤
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(container).not.toHaveClass('typing-interface--typing');
    });

    it('실시간 키스트로크 표시', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<TypingInterface {...defaultProps} />);

      const textarea = screen.getByRole('textbox');

      await user.type(textarea, 'hello');

      // 최근 키스트로크 표시 확인
      const recentKeystrokes = screen.getByTestId('recent-keystrokes');
      expect(recentKeystrokes).toBeInTheDocument();
    });
  });

  describe('접근성 테스트', () => {
    it('ARIA 라벨 설정', () => {
      render(<TypingInterface {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('aria-label', '감정 타이핑 입력 필드');
    });

    it('키보드 네비게이션', () => {
      render(<TypingInterface {...defaultProps} />);

      const textarea = screen.getByRole('textbox');

      // Tab으로 포커스
      textarea.focus();
      expect(textarea).toHaveFocus();

      // Escape로 포커스 해제
      fireEvent.keyDown(textarea, { key: 'Escape' });
      expect(textarea).not.toHaveFocus();
    });

    it('스크린 리더 지원', () => {
      render(<TypingInterface {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('aria-describedby');

      const description = screen.getByText(/타이핑 패턴이 실시간으로 분석됩니다/);
      expect(description).toBeInTheDocument();
    });
  });

  describe('성능 테스트', () => {
    it('빠른 연속 입력 처리', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<TypingInterface {...defaultProps} />);

      const textarea = screen.getByRole('textbox');

      // 100개 문자 빠른 입력
      const text = 'a'.repeat(100);
      await user.type(textarea, text);

      expect(textarea).toHaveValue(text);
      expect(defaultProps.onTextChange).toHaveBeenCalledWith(text);
    });

    it('메모리 누수 방지 - 타이머 정리', () => {
      const { unmount } = render(<TypingInterface {...defaultProps} />);

      // 컴포넌트 언마운트
      unmount();

      // 메모리 누수 없이 정리되었는지 확인
      expect(jest.getTimerCount()).toBe(0);
    });

    it('대량 키스트로크 데이터 처리', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<TypingInterface {...defaultProps} />);

      const textarea = screen.getByRole('textbox');

      // 1000개 키스트로크 시뮬레이션
      for (let i = 0; i < 100; i++) {
        await user.type(textarea, 'test ');
        act(() => {
          jest.advanceTimersByTime(10);
        });
      }

      // 성능 저하 없이 처리되는지 확인
      expect(defaultProps.onKeystroke).toHaveBeenCalledTimes(500); // 'test ' = 5글자 × 100
    });
  });

  describe('에러 처리 테스트', () => {
    it('onKeystroke 핸들러 오류 시 계속 동작', async () => {
      const faultyHandler = jest.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });

      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(
        <TypingInterface
          {...defaultProps}
          onKeystroke={faultyHandler}
        />
      );

      const textarea = screen.getByRole('textbox');

      // 오류가 발생해도 컴포넌트가 계속 동작하는지 확인
      await user.type(textarea, 'test');
      expect(textarea).toHaveValue('test');
    });

    it('잘못된 maxLength 처리', () => {
      render(<TypingInterface {...defaultProps} maxLength={-1} />);

      const textarea = screen.getByRole('textbox');
      // 음수 maxLength는 무시되고 기본값 사용
      expect(textarea).toHaveAttribute('maxLength', '1000');
    });

    it('null/undefined props 처리', () => {
      const props = {
        onKeystroke: undefined,
        onTextChange: null,
        onStatsChange: undefined,
        prompt: null,
        placeholder: undefined
      };

      expect(() => {
        render(<TypingInterface {...props} />);
      }).not.toThrow();
    });
  });

  describe('통합 테스트', () => {
    it('전체 타이핑 플로우', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const mockHandlers = {
        onKeystroke: jest.fn(),
        onTextChange: jest.fn(),
        onStatsChange: jest.fn()
      };

      render(<TypingInterface {...mockHandlers} />);

      const textarea = screen.getByRole('textbox');

      // 1. 타이핑 시작
      await user.type(textarea, 'Hello world!');

      // 2. 모든 핸들러가 호출되었는지 확인
      expect(mockHandlers.onTextChange).toHaveBeenCalledWith('Hello world!');
      expect(mockHandlers.onKeystroke).toHaveBeenCalled();

      // 3. 통계 업데이트 확인
      await waitFor(() => {
        expect(mockHandlers.onStatsChange).toHaveBeenCalledWith(
          expect.objectContaining({
            wpm: expect.any(Number),
            averageInterval: expect.any(Number),
            pauseCount: expect.any(Number),
            totalChars: 12,
            rhythm: expect.any(String)
          })
        );
      });
    });
  });
});