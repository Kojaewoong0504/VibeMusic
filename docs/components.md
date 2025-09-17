# VibeMusic UI 컴포넌트 문서

## 개요

VibeMusic의 React 컴포넌트 라이브러리 문서입니다. 모든 컴포넌트는 TypeScript로 작성되었으며, 반응형 디자인과 접근성을 지원합니다.

## 디자인 시스템

### 테마 및 색상

#### 컬러 팔레트

```typescript
// Light Theme
const lightTheme = {
  primary: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    500: '#06b6d4',
    700: '#0e7490',
    900: '#164e63'
  },
  neutral: {
    0: '#ffffff',
    50: '#f8fafc',
    100: '#f1f5f9',
    500: '#64748b',
    700: '#334155',
    900: '#0f172a'
  },
  semantic: {
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#06b6d4'
  }
};

// Dark Theme
const darkTheme = {
  primary: {
    50: '#164e63',
    500: '#22d3ee',
    700: '#06b6d4'
  },
  neutral: {
    0: '#0f172a',
    50: '#1e293b',
    100: '#334155',
    700: '#f1f5f9',
    900: '#ffffff'
  }
};
```

### 타이포그래피

```css
/* 폰트 패밀리 */
.font-sans { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif; }
.font-mono { font-family: 'Fira Code', Menlo, Monaco, monospace; }

/* 폰트 크기 */
.text-xs { font-size: 0.75rem; }    /* 12px */
.text-sm { font-size: 0.875rem; }   /* 14px */
.text-base { font-size: 1rem; }     /* 16px */
.text-lg { font-size: 1.125rem; }   /* 18px */
.text-xl { font-size: 1.25rem; }    /* 20px */
.text-2xl { font-size: 1.5rem; }    /* 24px */
.text-3xl { font-size: 1.875rem; }  /* 30px */

/* 폰트 가중치 */
.font-light { font-weight: 300; }
.font-normal { font-weight: 400; }
.font-medium { font-weight: 500; }
.font-semibold { font-weight: 600; }
.font-bold { font-weight: 700; }
```

### 간격 및 레이아웃

```css
/* 간격 시스템 (0.25rem = 4px 기준) */
.space-1 { margin: 0.25rem; }   /* 4px */
.space-2 { margin: 0.5rem; }    /* 8px */
.space-3 { margin: 0.75rem; }   /* 12px */
.space-4 { margin: 1rem; }      /* 16px */
.space-6 { margin: 1.5rem; }    /* 24px */
.space-8 { margin: 2rem; }      /* 32px */

/* 반응형 브레이크포인트 */
/* mobile: 0px */
/* tablet: 768px */
/* desktop: 1024px */
/* wide: 1280px */
```

## 컴포넌트 라이브러리

### 1. Layout 컴포넌트

#### Header

메인 네비게이션과 브랜드 로고를 포함하는 헤더 컴포넌트입니다.

**Props**
```typescript
interface HeaderProps {
  sessionInfo?: SessionInfo;
  onLogoClick?: () => void;
  onNewSession?: () => void;
  onHelpClick?: () => void;
  className?: string;
}

interface SessionInfo {
  id: string;
  startTime: Date;
  isActive: boolean;
  musicCount: number;
}
```

**사용 예시**
```tsx
import { Header } from '@/components/Header';

function App() {
  const sessionInfo = {
    id: 'session-123',
    startTime: new Date(),
    isActive: true,
    musicCount: 3
  };

  return (
    <Header
      sessionInfo={sessionInfo}
      onLogoClick={() => navigate('/')}
      onNewSession={() => startNewSession()}
      onHelpClick={() => navigate('/help')}
    />
  );
}
```

**특징**
- 반응형 디자인 지원 (모바일에서 세션 정보 숨김)
- 터치 디바이스 최적화
- 접근성 지원 (키보드 네비게이션)
- 다크 모드 지원

---

#### Footer

하단 정보와 링크를 포함하는 푸터 컴포넌트입니다.

**Props**
```typescript
interface FooterProps {
  className?: string;
}
```

**사용 예시**
```tsx
import { Footer } from '@/components/Footer';

function App() {
  return <Footer />;
}
```

**특징**
- 저작권 정보 및 링크
- 소셜 미디어 링크
- 반응형 레이아웃

---

### 2. 상호작용 컴포넌트

#### TypingInterface

사용자의 타이핑을 캡처하고 실시간으로 분석 결과를 표시하는 컴포넌트입니다.

**Props**
```typescript
interface TypingInterfaceProps {
  sessionId: string;
  onKeystroke?: (keystroke: KeystrokeData) => void;
  onAnalysisUpdate?: (analysis: AnalysisResult) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

interface KeystrokeData {
  key: string;
  timestamp: number;
  duration: number;
  interval: number;
}
```

**사용 예시**
```tsx
import { TypingInterface } from '@/components/TypingInterface';

function AnalysisPage() {
  const handleKeystroke = (keystroke: KeystrokeData) => {
    console.log('키 입력:', keystroke);
  };

  const handleAnalysisUpdate = (analysis: AnalysisResult) => {
    console.log('분석 결과 업데이트:', analysis);
  };

  return (
    <TypingInterface
      sessionId="session-123"
      onKeystroke={handleKeystroke}
      onAnalysisUpdate={handleAnalysisUpdate}
      placeholder="자유롭게 타이핑해보세요..."
    />
  );
}
```

**특징**
- 실시간 키스트로크 캡처
- WebSocket을 통한 실시간 통신
- 타이핑 통계 표시 (WPM, 정확도)
- 감정 상태 실시간 미리보기

---

#### ThemeToggle

라이트/다크 테마 전환을 위한 토글 컴포넌트입니다.

**Props**
```typescript
interface ThemeToggleProps {
  variant?: 'icon' | 'dropdown' | 'segmented';
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  className?: string;
}
```

**사용 예시**
```tsx
import { ThemeToggle } from '@/components/ThemeToggle';

function Settings() {
  return (
    <div className="settings-panel">
      <h3>테마 설정</h3>
      <ThemeToggle
        variant="segmented"
        size="medium"
        showLabel={true}
      />
    </div>
  );
}
```

**특징**
- 3가지 표시 변형 (아이콘, 드롭다운, 세그먼트)
- 키보드 네비게이션 지원
- 시스템 테마 자동 감지
- 애니메이션 전환 효과

---

### 3. 피드백 컴포넌트

#### LoadingSpinner

로딩 상태를 표시하는 스피너 컴포넌트입니다.

**Props**
```typescript
interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'white';
  text?: string;
  showText?: boolean;
  className?: string;
}
```

**사용 예시**
```tsx
import { LoadingSpinner } from '@/components/LoadingSpinner';

function LoadingPage() {
  return (
    <div className="loading-container">
      <LoadingSpinner
        size="large"
        color="primary"
        text="음악을 생성하고 있습니다..."
        showText={true}
      />
    </div>
  );
}
```

**특징**
- 3가지 크기 지원
- 다양한 색상 옵션
- 선택적 텍스트 표시
- 부드러운 회전 애니메이션

---

#### EmotionVisualizer

감정 분석 결과를 시각적으로 표시하는 컴포넌트입니다.

**Props**
```typescript
interface EmotionVisualizerProps {
  emotion: EmotionData;
  showDetails?: boolean;
  animated?: boolean;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

interface EmotionData {
  dominant: string;
  intensity: number;
  confidence: number;
  secondary?: Array<{
    emotion: string;
    confidence: number;
  }>;
}
```

**사용 예시**
```tsx
import { EmotionVisualizer } from '@/components/EmotionVisualizer';

function AnalysisResults() {
  const emotionData = {
    dominant: 'calm',
    intensity: 0.8,
    confidence: 0.95,
    secondary: [
      { emotion: 'focused', confidence: 0.7 },
      { emotion: 'creative', confidence: 0.5 }
    ]
  };

  return (
    <div className="analysis-panel">
      <h3>감정 분석 결과</h3>
      <EmotionVisualizer
        emotion={emotionData}
        showDetails={true}
        animated={true}
        size="large"
      />
    </div>
  );
}
```

**특징**
- 감정별 색상 코딩
- 강도 및 신뢰도 표시
- 보조 감정 표시
- 애니메이션 효과 지원

---

#### GenerationProgress

음악 생성 진행 상황을 표시하는 프로그레스 컴포넌트입니다.

**Props**
```typescript
interface GenerationProgressProps {
  progress: ProgressData;
  showSteps?: boolean;
  showETA?: boolean;
  className?: string;
}

interface ProgressData {
  currentStep: string;
  completedSteps: string[];
  totalSteps: string[];
  percentage: number;
  estimatedTime?: number;
}
```

**사용 예시**
```tsx
import { GenerationProgress } from '@/components/GenerationProgress';

function MusicGeneration() {
  const progressData = {
    currentStep: 'ai_generation',
    completedSteps: ['prompt_processing'],
    totalSteps: ['prompt_processing', 'ai_generation', 'audio_processing', 'file_preparation'],
    percentage: 45,
    estimatedTime: 15
  };

  return (
    <div className="generation-status">
      <h3>음악 생성 중...</h3>
      <GenerationProgress
        progress={progressData}
        showSteps={true}
        showETA={true}
      />
    </div>
  );
}
```

**특징**
- 단계별 진행 상황 표시
- 백분율 및 예상 시간 표시
- 실시간 업데이트 지원
- 반응형 디자인

---

### 4. 미디어 컴포넌트

#### MusicPlayer

생성된 음악을 재생하는 플레이어 컴포넌트입니다.

**Props**
```typescript
interface MusicPlayerProps {
  musicUrl: string;
  title?: string;
  artist?: string;
  duration?: number;
  autoPlay?: boolean;
  showControls?: boolean;
  showWaveform?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  className?: string;
}
```

**사용 예시**
```tsx
import { MusicPlayer } from '@/components/MusicPlayer';

function MusicLibrary() {
  const handlePlay = () => {
    console.log('음악 재생 시작');
  };

  const handlePause = () => {
    console.log('음악 재생 중지');
  };

  return (
    <div className="music-library">
      <MusicPlayer
        musicUrl="/api/music/track-123.wav"
        title="차분한 피아노 선율"
        artist="AI Generated"
        duration={120}
        showControls={true}
        showWaveform={true}
        onPlay={handlePlay}
        onPause={handlePause}
      />
    </div>
  );
}
```

**특징**
- 표준 오디오 컨트롤
- 파형 시각화 (선택적)
- 키보드 단축키 지원
- 접근성 레이블
- 자동 재생 옵션

---

### 5. 상태 표시 컴포넌트

#### SessionStatus

현재 세션의 상태 정보를 표시하는 컴포넌트입니다.

**Props**
```typescript
interface SessionStatusProps {
  session: SessionData;
  showDetails?: boolean;
  compact?: boolean;
  className?: string;
}

interface SessionData {
  id: string;
  status: 'active' | 'inactive' | 'expired';
  startTime: Date;
  typingTime: number;
  musicCount: number;
  autoDeleteAt: Date;
}
```

**사용 예시**
```tsx
import { SessionStatus } from '@/components/SessionStatus';

function Dashboard() {
  const sessionData = {
    id: 'session-123',
    status: 'active',
    startTime: new Date(Date.now() - 30 * 60 * 1000), // 30분 전
    typingTime: 300,
    musicCount: 2,
    autoDeleteAt: new Date(Date.now() + 23.5 * 60 * 60 * 1000) // 23.5시간 후
  };

  return (
    <div className="dashboard">
      <SessionStatus
        session={sessionData}
        showDetails={true}
        compact={false}
      />
    </div>
  );
}
```

**특징**
- 세션 지속 시간 표시
- 자동 삭제 시간 카운트다운
- 생성된 음악 개수 표시
- 상태별 색상 코딩

---

#### ErrorBoundary

React 오류를 처리하는 경계 컴포넌트입니다.

**Props**
```typescript
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}
```

**사용 예시**
```tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary
      fallback={({ error, resetError }) => (
        <div className="error-page">
          <h2>오류가 발생했습니다</h2>
          <p>{error.message}</p>
          <button onClick={resetError}>다시 시도</button>
        </div>
      )}
      onError={(error, errorInfo) => {
        console.error('앱 오류:', error, errorInfo);
      }}
    >
      <MainContent />
    </ErrorBoundary>
  );
}
```

**특징**
- 자동 오류 포착
- 커스텀 오류 UI
- 오류 복구 기능
- 로깅 지원

---

### 6. 성능 모니터링

#### PerformanceMonitor

앱 성능을 모니터링하는 컴포넌트입니다.

**Props**
```typescript
interface PerformanceMonitorProps {
  enabled?: boolean;
  showOverlay?: boolean;
  metricsInterval?: number;
  onMetricsUpdate?: (metrics: PerformanceMetrics) => void;
}

interface PerformanceMetrics {
  fps: number;
  memoryUsage: number;
  renderTime: number;
  wsLatency?: number;
}
```

**사용 예시**
```tsx
import { PerformanceMonitor } from '@/components/PerformanceMonitor';

function App() {
  const handleMetricsUpdate = (metrics: PerformanceMetrics) => {
    if (metrics.fps < 30) {
      console.warn('낮은 FPS 감지:', metrics.fps);
    }
  };

  return (
    <>
      <MainContent />
      {process.env.NODE_ENV === 'development' && (
        <PerformanceMonitor
          enabled={true}
          showOverlay={true}
          metricsInterval={1000}
          onMetricsUpdate={handleMetricsUpdate}
        />
      )}
    </>
  );
}
```

**특징**
- FPS 모니터링
- 메모리 사용량 추적
- WebSocket 지연시간 측정
- 개발 모드 전용 오버레이

---

## 접근성 가이드

### WCAG 2.1 AA 준수

모든 컴포넌트는 웹 콘텐츠 접근성 가이드라인을 준수합니다.

#### 키보드 네비게이션

```tsx
// 키보드 네비게이션 예시
const Button: React.FC<ButtonProps> = ({ children, onClick, ...props }) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <button
      {...props}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={props['aria-label']}
    >
      {children}
    </button>
  );
};
```

#### 스크린 리더 지원

```tsx
// ARIA 속성 사용 예시
<div
  role="progressbar"
  aria-valuenow={progress}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-label={`진행률 ${progress}%`}
>
  <div style={{ width: `${progress}%` }} />
</div>
```

#### 색상 대비

```css
/* 4.5:1 이상의 색상 대비 비율 유지 */
.text-primary { color: #0e7490; } /* 대비 비율: 5.2:1 */
.text-secondary { color: #334155; } /* 대비 비율: 7.8:1 */
```

### 반응형 디자인

#### 브레이크포인트

```typescript
const breakpoints = {
  mobile: '0px',
  tablet: '768px',
  desktop: '1024px',
  wide: '1280px'
};
```

#### 반응형 컴포넌트 예시

```tsx
import { useResponsive } from '@/hooks/useResponsive';

const ResponsiveComponent: React.FC = () => {
  const { getValue, device } = useResponsive();

  const containerStyles = {
    padding: getValue({
      mobile: '16px',
      tablet: '24px',
      desktop: '32px',
      wide: '48px'
    }),
    flexDirection: getValue({
      mobile: 'column' as const,
      tablet: 'row' as const
    })
  };

  return (
    <div style={containerStyles}>
      {/* 컴포넌트 내용 */}
    </div>
  );
};
```

## 성능 최적화

### 코드 분할

```tsx
// 동적 임포트를 사용한 코드 분할
const LazyMusicPlayer = React.lazy(() => import('./MusicPlayer'));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <LazyMusicPlayer />
    </Suspense>
  );
}
```

### 메모이제이션

```tsx
// React.memo를 사용한 컴포넌트 최적화
export const OptimizedComponent = React.memo(({ data }) => {
  const expensiveValue = useMemo(() => {
    return calculateExpensiveValue(data);
  }, [data]);

  const handleClick = useCallback(() => {
    // 이벤트 핸들러 로직
  }, []);

  return <div onClick={handleClick}>{expensiveValue}</div>;
}, (prevProps, nextProps) => {
  // 얕은 비교로 충분하지 않은 경우 커스텀 비교 함수
  return prevProps.data.id === nextProps.data.id;
});
```

## 테스트

### 컴포넌트 테스트 예시

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeToggle } from './ThemeToggle';

describe('ThemeToggle', () => {
  it('테마 변경이 올바르게 작동해야 함', () => {
    render(<ThemeToggle variant="icon" />);

    const toggleButton = screen.getByRole('button');
    fireEvent.click(toggleButton);

    expect(document.documentElement).toHaveClass('dark');
  });

  it('키보드 네비게이션이 작동해야 함', () => {
    render(<ThemeToggle variant="segmented" />);

    const lightButton = screen.getByLabelText('라이트 모드');
    fireEvent.keyDown(lightButton, { key: 'Enter' });

    expect(document.documentElement).toHaveClass('light');
  });
});
```

## 스토리북 사용법

### 스토리 작성

```typescript
// ThemeToggle.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { ThemeToggle } from './ThemeToggle';

const meta: Meta<typeof ThemeToggle> = {
  title: 'Components/ThemeToggle',
  component: ThemeToggle,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: '라이트/다크 테마를 전환하는 토글 컴포넌트입니다.'
      }
    }
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['icon', 'dropdown', 'segmented']
    },
    size: {
      control: 'select',
      options: ['small', 'medium', 'large']
    },
    showLabel: {
      control: 'boolean'
    }
  }
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Icon: Story = {
  args: {
    variant: 'icon',
    size: 'medium'
  }
};

export const Dropdown: Story = {
  args: {
    variant: 'dropdown',
    size: 'medium',
    showLabel: true
  }
};

export const Segmented: Story = {
  args: {
    variant: 'segmented',
    size: 'large',
    showLabel: true
  }
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
      <ThemeToggle variant="icon" size="small" />
      <ThemeToggle variant="dropdown" size="medium" showLabel />
      <ThemeToggle variant="segmented" size="large" showLabel />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: '모든 변형을 한 번에 볼 수 있는 스토리입니다.'
      }
    }
  }
};
```

### 스토리북 실행

```bash
# 개발 서버 시작
npm run storybook

# 빌드
npm run build-storybook
```

## 기여 가이드

### 새 컴포넌트 추가

1. **컴포넌트 파일 생성**
   ```bash
   mkdir src/components/NewComponent
   touch src/components/NewComponent/index.tsx
   touch src/components/NewComponent/NewComponent.stories.tsx
   touch src/components/NewComponent/NewComponent.test.tsx
   ```

2. **타입 정의**
   ```typescript
   interface NewComponentProps {
     // Props 정의
   }
   ```

3. **접근성 고려사항**
   - ARIA 레이블 추가
   - 키보드 네비게이션 지원
   - 색상 대비 확인

4. **테스트 작성**
   - 유닛 테스트
   - 접근성 테스트
   - 반응형 테스트

5. **스토리북 문서**
   - 기본 스토리
   - 변형 스토리
   - 사용 예시

### Pull Request 가이드

1. **브랜치 생성**
   ```bash
   git checkout -b feature/new-component
   ```

2. **개발 및 테스트**
   ```bash
   npm test
   npm run storybook
   ```

3. **문서 업데이트**
   - 이 문서에 컴포넌트 추가
   - README 업데이트 (필요시)

4. **PR 생성**
   - 스크린샷 첨부
   - 접근성 체크리스트 확인
   - 테스트 결과 포함

---

## 버전 히스토리

### v1.0.0 (2024-01-15)
- 초기 컴포넌트 라이브러리 구축
- 기본 레이아웃 컴포넌트 (Header, Footer)
- 상호작용 컴포넌트 (TypingInterface, ThemeToggle)
- 피드백 컴포넌트 (LoadingSpinner, EmotionVisualizer)
- 미디어 컴포넌트 (MusicPlayer)
- 접근성 및 반응형 디자인 지원

### 향후 계획
- 고급 애니메이션 컴포넌트
- 추가 차트 및 시각화 컴포넌트
- 국제화(i18n) 지원
- 성능 최적화 개선

---

*이 문서는 VibeMusic 컴포넌트 라이브러리 v1.0.0을 기준으로 작성되었습니다. 최신 업데이트는 [GitHub](https://github.com/vibemusic/vibemusic)에서 확인하실 수 있습니다.*