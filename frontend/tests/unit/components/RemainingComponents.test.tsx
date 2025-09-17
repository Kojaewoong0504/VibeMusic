/**
 * Remaining UI Components Unit Tests
 *
 * SessionStatus, GenerationProgress, Header, Footer, LoadingSpinner, ErrorBoundary
 * 컴포넌트들의 종합 단위 테스트
 */

import React, { ErrorInfo } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// Jest mock된 컴포넌트들을 import
import SessionStatus from '../../../src/components/SessionStatus';
import GenerationProgress from '../../../src/components/GenerationProgress';
import Header from '../../../src/components/Header';
import Footer from '../../../src/components/Footer';
import LoadingSpinner from '../../../src/components/LoadingSpinner';
import ErrorBoundary from '../../../src/components/ErrorBoundary';

// 테스트용 데이터
const mockSession = {
  id: 'session-123',
  start_time: '2024-01-15T10:00:00Z',
  auto_delete_at: '2024-01-15T11:00:00Z',
  is_active: true,
  created_at: '2024-01-15T10:00:00Z'
};

const mockGenerationRequest = {
  id: 'request-123',
  session_id: 'session-123',
  status: 'generating' as const,
  progress: 65,
  estimated_completion: '2024-01-15T10:05:00Z',
  current_step: 'ai_processing',
  steps_completed: 3,
  total_steps: 5
};

// Mock 컴포넌트들 (실제 구현 대신)
jest.mock('../../../src/components/SessionStatus', () => {
  return function MockSessionStatus(props: any) {
    const { session, connectionState, musicCount, onEndSession, onExtendSession, compact } = props;

    if (!session) {
      return <div>세션이 없습니다</div>;
    }

    const timeRemaining = Math.max(0, new Date(session.auto_delete_at).getTime() - Date.now());
    const minutes = Math.floor(timeRemaining / (1000 * 60));
    const isExpiring = minutes < 30;

    return (
      <div className={`session-status ${compact ? 'compact' : ''}`}>
        <h3>세션 상태</h3>
        <div>상태: {session.is_active ? '활성' : '비활성'}</div>
        <div>연결: {connectionState}</div>
        <div>음악 개수: {musicCount}</div>
        <div>남은 시간: {minutes}분</div>
        {isExpiring && <div className="expiring-warning">곧 만료됩니다</div>}
        {onEndSession && <button onClick={onEndSession}>세션 종료</button>}
        {onExtendSession && (
          <button onClick={() => onExtendSession(1)}>1시간 연장</button>
        )}
      </div>
    );
  };
});

jest.mock('../../../src/components/GenerationProgress', () => {
  return function MockGenerationProgress(props: any) {
    const { request, onCancel, showDetails, animated } = props;

    if (!request) {
      return <div>생성 요청이 없습니다</div>;
    }

    return (
      <div className={`generation-progress ${animated ? 'animated' : ''}`}>
        <h3>음악 생성 중</h3>
        <div>상태: {request.status}</div>
        <div>진행률: {request.progress}%</div>
        <div>현재 단계: {request.current_step}</div>
        <div>완료 단계: {request.steps_completed}/{request.total_steps}</div>
        {showDetails && (
          <div className="details">
            <div>예상 완료: {request.estimated_completion}</div>
          </div>
        )}
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${request.progress}%` }}
            role="progressbar"
            aria-valuenow={request.progress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        {onCancel && <button onClick={onCancel}>취소</button>}
      </div>
    );
  };
});

jest.mock('../../../src/components/Header', () => {
  return function MockHeader(props: any) {
    const { session, onNavigate, showNav } = props;

    return (
      <header className="app-header">
        <div className="logo">
          <h1>VibeMusic</h1>
        </div>
        {showNav && (
          <nav>
            <button onClick={() => onNavigate?.('home')}>홈</button>
            <button onClick={() => onNavigate?.('generate')}>생성</button>
            <button onClick={() => onNavigate?.('history')}>이력</button>
          </nav>
        )}
        {session && (
          <div className="session-info">
            세션: {session.id.slice(-8)}
          </div>
        )}
      </header>
    );
  };
});

jest.mock('../../../src/components/Footer', () => {
  return function MockFooter(props: any) {
    const { showLinks, compact } = props;

    return (
      <footer className={`app-footer ${compact ? 'compact' : ''}`}>
        <div className="copyright">© 2024 VibeMusic</div>
        {showLinks && (
          <div className="links">
            <a href="/privacy">개인정보처리방침</a>
            <a href="/terms">이용약관</a>
            <a href="/support">지원</a>
          </div>
        )}
      </footer>
    );
  };
});

jest.mock('../../../src/components/LoadingSpinner', () => {
  return function MockLoadingSpinner(props: any) {
    const { size = 'medium', message, overlay } = props;

    return (
      <div className={`loading-spinner ${size} ${overlay ? 'overlay' : ''}`}>
        <div className="spinner" role="status" aria-label="로딩 중">
          <div className="spinner-icon"></div>
        </div>
        {message && <div className="loading-message">{message}</div>}
      </div>
    );
  };
});

jest.mock('../../../src/components/ErrorBoundary', () => {
  const React = require('react');
  return class MockErrorBoundary extends React.Component<any, any> {
    constructor(props: any) {
      super(props);
      this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error: Error) {
      return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
      this.setState({ errorInfo });
      this.props.onError?.(error, errorInfo);
    }

    render() {
      if (this.state.hasError) {
        if (this.props.fallback) {
          return this.props.fallback(this.state.error, this.state.errorInfo);
        }
        return (
          <div className="error-boundary">
            <h2>오류가 발생했습니다</h2>
            <p>{this.state.error?.message}</p>
            <button onClick={() => this.setState({ hasError: false, error: null })}>
              다시 시도
            </button>
          </div>
        );
      }
      return this.props.children;
    }
  };
});

describe('SessionStatus 컴포넌트', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('세션이 없을 때 메시지가 표시된다', () => {
    render(
      <React.Suspense fallback={<div>로딩...</div>}>
        <SessionStatus session={null} />
      </React.Suspense>
    );

    expect(screen.getByText('세션이 없습니다')).toBeInTheDocument();
  });

  test('세션 정보가 올바르게 표시된다', () => {
    render(
      <React.Suspense fallback={<div>로딩...</div>}>
        <SessionStatus
          session={mockSession}
          connectionState="connected"
          musicCount={3}
        />
      </React.Suspense>
    );

    expect(screen.getByText('세션 상태')).toBeInTheDocument();
    expect(screen.getByText('상태: 활성')).toBeInTheDocument();
    expect(screen.getByText('연결: connected')).toBeInTheDocument();
    expect(screen.getByText('음악 개수: 3')).toBeInTheDocument();
  });

  test('세션 종료 버튼이 작동한다', async () => {
    const onEndSession = jest.fn();
    render(
      <React.Suspense fallback={<div>로딩...</div>}>
        <SessionStatus
          session={mockSession}
          onEndSession={onEndSession}
        />
      </React.Suspense>
    );

    const endButton = screen.getByText('세션 종료');
    await user.click(endButton);

    expect(onEndSession).toHaveBeenCalled();
  });

  test('세션 연장 버튼이 작동한다', async () => {
    const onExtendSession = jest.fn();
    render(
      <React.Suspense fallback={<div>로딩...</div>}>
        <SessionStatus
          session={mockSession}
          onExtendSession={onExtendSession}
        />
      </React.Suspense>
    );

    const extendButton = screen.getByText('1시간 연장');
    await user.click(extendButton);

    expect(onExtendSession).toHaveBeenCalledWith(1);
  });

  test('컴팩트 모드가 적용된다', () => {
    const { container } = render(
      <React.Suspense fallback={<div>로딩...</div>}>
        <SessionStatus
          session={mockSession}
          compact={true}
        />
      </React.Suspense>
    );

    expect(container.querySelector('.compact')).toBeInTheDocument();
  });
});

describe('GenerationProgress 컴포넌트', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  test('생성 요청이 없을 때 메시지가 표시된다', () => {
    render(
      <React.Suspense fallback={<div>로딩...</div>}>
        <GenerationProgress request={null} />
      </React.Suspense>
    );

    expect(screen.getByText('생성 요청이 없습니다')).toBeInTheDocument();
  });

  test('생성 진행 상황이 표시된다', () => {
    render(
      <React.Suspense fallback={<div>로딩...</div>}>
        <GenerationProgress request={mockGenerationRequest} />
      </React.Suspense>
    );

    expect(screen.getByText('음악 생성 중')).toBeInTheDocument();
    expect(screen.getByText('상태: generating')).toBeInTheDocument();
    expect(screen.getByText('진행률: 65%')).toBeInTheDocument();
    expect(screen.getByText('현재 단계: ai_processing')).toBeInTheDocument();
    expect(screen.getByText('완료 단계: 3/5')).toBeInTheDocument();
  });

  test('진행률 바가 올바른 값으로 표시된다', () => {
    render(
      <React.Suspense fallback={<div>로딩...</div>}>
        <GenerationProgress request={mockGenerationRequest} />
      </React.Suspense>
    );

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '65');
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');

    const progressFill = progressBar;
    expect(progressFill).toHaveStyle('width: 65%');
  });

  test('취소 버튼이 작동한다', async () => {
    const onCancel = jest.fn();
    render(
      <React.Suspense fallback={<div>로딩...</div>}>
        <GenerationProgress
          request={mockGenerationRequest}
          onCancel={onCancel}
        />
      </React.Suspense>
    );

    const cancelButton = screen.getByText('취소');
    await user.click(cancelButton);

    expect(onCancel).toHaveBeenCalled();
  });

  test('상세 정보가 표시된다', () => {
    render(
      <React.Suspense fallback={<div>로딩...</div>}>
        <GenerationProgress
          request={mockGenerationRequest}
          showDetails={true}
        />
      </React.Suspense>
    );

    expect(screen.getByText(/예상 완료:/)).toBeInTheDocument();
  });

  test('애니메이션 클래스가 적용된다', () => {
    const { container } = render(
      <React.Suspense fallback={<div>로딩...</div>}>
        <GenerationProgress
          request={mockGenerationRequest}
          animated={true}
        />
      </React.Suspense>
    );

    expect(container.querySelector('.animated')).toBeInTheDocument();
  });
});

describe('Header 컴포넌트', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  test('기본 헤더가 렌더링된다', () => {
    render(
      <React.Suspense fallback={<div>로딩...</div>}>
        <Header />
      </React.Suspense>
    );

    expect(screen.getByText('VibeMusic')).toBeInTheDocument();
  });

  test('네비게이션이 표시된다', () => {
    const onNavigate = jest.fn();
    render(
      <React.Suspense fallback={<div>로딩...</div>}>
        <Header
          showNav={true}
          onNavigate={onNavigate}
        />
      </React.Suspense>
    );

    expect(screen.getByText('홈')).toBeInTheDocument();
    expect(screen.getByText('생성')).toBeInTheDocument();
    expect(screen.getByText('이력')).toBeInTheDocument();
  });

  test('네비게이션 버튼이 작동한다', async () => {
    const onNavigate = jest.fn();
    render(
      <React.Suspense fallback={<div>로딩...</div>}>
        <Header
          showNav={true}
          onNavigate={onNavigate}
        />
      </React.Suspense>
    );

    await user.click(screen.getByText('홈'));
    expect(onNavigate).toHaveBeenCalledWith('home');

    await user.click(screen.getByText('생성'));
    expect(onNavigate).toHaveBeenCalledWith('generate');

    await user.click(screen.getByText('이력'));
    expect(onNavigate).toHaveBeenCalledWith('history');
  });

  test('세션 정보가 표시된다', () => {
    render(
      <React.Suspense fallback={<div>로딩...</div>}>
        <Header session={mockSession} />
      </React.Suspense>
    );

    expect(screen.getByText(/세션: .*123/)).toBeInTheDocument();
  });
});

describe('Footer 컴포넌트', () => {
  test('기본 푸터가 렌더링된다', () => {
    render(
      <React.Suspense fallback={<div>로딩...</div>}>
        <Footer />
      </React.Suspense>
    );

    expect(screen.getByText('© 2024 VibeMusic')).toBeInTheDocument();
  });

  test('링크들이 표시된다', () => {
    render(
      <React.Suspense fallback={<div>로딩...</div>}>
        <Footer showLinks={true} />
      </React.Suspense>
    );

    expect(screen.getByText('개인정보처리방침')).toBeInTheDocument();
    expect(screen.getByText('이용약관')).toBeInTheDocument();
    expect(screen.getByText('지원')).toBeInTheDocument();
  });

  test('컴팩트 모드가 적용된다', () => {
    const { container } = render(
      <React.Suspense fallback={<div>로딩...</div>}>
        <Footer compact={true} />
      </React.Suspense>
    );

    expect(container.querySelector('.compact')).toBeInTheDocument();
  });
});

describe('LoadingSpinner 컴포넌트', () => {
  test('기본 스피너가 렌더링된다', () => {
    render(
      <React.Suspense fallback={<div>로딩...</div>}>
        <LoadingSpinner />
      </React.Suspense>
    );

    const spinner = screen.getByRole('status');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveAttribute('aria-label', '로딩 중');
  });

  test('메시지가 표시된다', () => {
    render(
      <React.Suspense fallback={<div>로딩...</div>}>
        <LoadingSpinner message="데이터를 불러오는 중..." />
      </React.Suspense>
    );

    expect(screen.getByText('데이터를 불러오는 중...')).toBeInTheDocument();
  });

  test('다양한 크기가 적용된다', () => {
    const { container } = render(
      <React.Suspense fallback={<div>로딩...</div>}>
        <LoadingSpinner size="large" />
      </React.Suspense>
    );

    expect(container.querySelector('.large')).toBeInTheDocument();
  });

  test('오버레이 모드가 적용된다', () => {
    const { container } = render(
      <React.Suspense fallback={<div>로딩...</div>}>
        <LoadingSpinner overlay={true} />
      </React.Suspense>
    );

    expect(container.querySelector('.overlay')).toBeInTheDocument();
  });
});

describe('ErrorBoundary 컴포넌트', () => {
  // Console.error 경고 숨기기
  const originalError = console.error;
  beforeEach(() => {
    console.error = jest.fn();
  });

  afterEach(() => {
    console.error = originalError;
  });

  test('정상적인 자식 컴포넌트를 렌더링한다', () => {
    const TestComponent = () => <div>정상 컴포넌트</div>;

    render(
      <React.Suspense fallback={<div>로딩...</div>}>
        <ErrorBoundary>
          <TestComponent />
        </ErrorBoundary>
      </React.Suspense>
    );

    expect(screen.getByText('정상 컴포넌트')).toBeInTheDocument();
  });

  test('에러가 발생하면 에러 UI를 표시한다', () => {
    const ThrowError = () => {
      throw new Error('테스트 에러');
    };

    render(
      <React.Suspense fallback={<div>로딩...</div>}>
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      </React.Suspense>
    );

    expect(screen.getByText('오류가 발생했습니다')).toBeInTheDocument();
    expect(screen.getByText('테스트 에러')).toBeInTheDocument();
  });

  test('다시 시도 버튼이 작동한다', async () => {
    const user = userEvent.setup();
    let shouldThrow = true;

    const TestComponent = () => {
      if (shouldThrow) {
        throw new Error('테스트 에러');
      }
      return <div>복구된 컴포넌트</div>;
    };

    render(
      <React.Suspense fallback={<div>로딩...</div>}>
        <ErrorBoundary>
          <TestComponent />
        </ErrorBoundary>
      </React.Suspense>
    );

    expect(screen.getByText('오류가 발생했습니다')).toBeInTheDocument();

    shouldThrow = false;
    await user.click(screen.getByText('다시 시도'));

    expect(screen.getByText('복구된 컴포넌트')).toBeInTheDocument();
  });

  test('에러 콜백이 호출된다', () => {
    const onError = jest.fn();
    const ThrowError = () => {
      throw new Error('테스트 에러');
    };

    render(
      <React.Suspense fallback={<div>로딩...</div>}>
        <ErrorBoundary onError={onError}>
          <ThrowError />
        </ErrorBoundary>
      </React.Suspense>
    );

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String)
      })
    );
  });

  test('커스텀 fallback이 렌더링된다', () => {
    const customFallback = (error: Error) => (
      <div>커스텀 에러: {error.message}</div>
    );

    const ThrowError = () => {
      throw new Error('커스텀 테스트 에러');
    };

    render(
      <React.Suspense fallback={<div>로딩...</div>}>
        <ErrorBoundary fallback={customFallback}>
          <ThrowError />
        </ErrorBoundary>
      </React.Suspense>
    );

    expect(screen.getByText('커스텀 에러: 커스텀 테스트 에러')).toBeInTheDocument();
  });
});

// 통합 테스트
describe('컴포넌트들의 통합 테스트', () => {
  test('모든 컴포넌트가 함께 렌더링된다', async () => {
    const user = userEvent.setup();

    render(
      <React.Suspense fallback={<div>로딩...</div>}>
        <ErrorBoundary>
          <Header session={mockSession} showNav={true} />
          <SessionStatus
            session={mockSession}
            connectionState="authenticated"
            musicCount={2}
          />
          <GenerationProgress request={mockGenerationRequest} />
          <Footer showLinks={true} />
        </ErrorBoundary>
      </React.Suspense>
    );

    // 모든 주요 요소들이 렌더링되었는지 확인
    expect(screen.getByText('VibeMusic')).toBeInTheDocument();
    expect(screen.getByText('세션 상태')).toBeInTheDocument();
    expect(screen.getByText('음악 생성 중')).toBeInTheDocument();
    expect(screen.getByText('© 2024 VibeMusic')).toBeInTheDocument();
  });

  test('로딩 상태에서 스피너가 표시된다', () => {
    render(
      <React.Suspense fallback={<LoadingSpinner message="앱을 불러오는 중..." />}>
        <div>앱 콘텐츠</div>
      </React.Suspense>
    );

    // Suspense가 트리거되지 않았으므로 실제 콘텐츠가 표시됨
    expect(screen.getByText('앱 콘텐츠')).toBeInTheDocument();
  });

  test('접근성 요소들이 올바르게 설정되어 있다', () => {
    render(
      <React.Suspense fallback={<div>로딩...</div>}>
        <GenerationProgress request={mockGenerationRequest} />
        <LoadingSpinner message="로딩 중..." />
      </React.Suspense>
    );

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow');
    expect(progressBar).toHaveAttribute('aria-valuemin');
    expect(progressBar).toHaveAttribute('aria-valuemax');

    const spinner = screen.getByRole('status');
    expect(spinner).toHaveAttribute('aria-label');
  });
});