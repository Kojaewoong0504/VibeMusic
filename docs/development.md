# VibeMusic 개발 가이드

## 목차

1. [개발 환경 설정](#개발-환경-설정)
2. [프로젝트 구조](#프로젝트-구조)
3. [개발 워크플로우](#개발-워크플로우)
4. [코딩 규칙](#코딩-규칙)
5. [테스트 가이드](#테스트-가이드)
6. [배포 및 운영](#배포-및-운영)
7. [문제 해결](#문제-해결)

## 개발 환경 설정

### 필수 요구사항

- **Python 3.12+** (백엔드)
- **Node.js 18+** (프론트엔드)
- **PostgreSQL 15+** (데이터베이스)
- **Redis 7+** (캐시 및 세션)
- **Docker & Docker Compose** (개발 환경)

### 초기 설정

#### 1. 저장소 클론 및 기본 설정

```bash
# 저장소 클론
git clone https://github.com/vibemusic/vibemusic.git
cd vibemusic

# 환경 설정 파일 생성
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

#### 2. Docker 개발 환경 시작

```bash
# PostgreSQL, Redis, Nginx 컨테이너 시작
docker-compose up -d

# 컨테이너 상태 확인
docker-compose ps
```

#### 3. 백엔드 설정

```bash
cd backend

# Python 가상환경 생성
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt
pip install -r requirements-dev.txt

# 데이터베이스 마이그레이션
alembic upgrade head

# 개발 서버 시작
python -m uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

#### 4. 프론트엔드 설정

```bash
cd frontend

# 의존성 설치
npm install

# 개발 서버 시작
npm run dev
```

#### 5. 접속 확인

- **프론트엔드**: http://localhost:3000
- **백엔드 API**: http://localhost:8000
- **API 문서**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### IDE 설정

#### VS Code 추천 확장

**백엔드 (Python)**
- Python
- Pylance
- Black Formatter
- isort
- Python Docstring Generator

**프론트엔드 (React/TypeScript)**
- ES7+ React/Redux/React-Native snippets
- TypeScript Hero
- Tailwind CSS IntelliSense
- Auto Rename Tag
- Prettier - Code formatter

#### 설정 파일

`.vscode/settings.json`:
```json
{
  "python.defaultInterpreterPath": "./backend/.venv/bin/python",
  "python.linting.enabled": true,
  "python.linting.pylintEnabled": false,
  "python.linting.flake8Enabled": true,
  "python.formatting.provider": "black",
  "[python]": {
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "source.organizeImports": true
    }
  },
  "[typescript]": {
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

## 프로젝트 구조

### 전체 구조

```
vibemusic/
├── .github/                    # GitHub Actions 워크플로우
├── .vscode/                    # VS Code 설정
├── backend/                    # FastAPI 백엔드
│   ├── .venv/                  # Python 가상환경
│   ├── migrations/             # Alembic 마이그레이션
│   ├── src/
│   │   ├── api/               # API 엔드포인트
│   │   │   ├── schemas/       # Pydantic 스키마
│   │   │   └── websocket/     # WebSocket 핸들러
│   │   ├── database/          # 데이터베이스 설정
│   │   ├── lib/               # 독립 라이브러리
│   │   │   ├── pattern_analyzer/
│   │   │   ├── emotion_mapper/
│   │   │   └── ai_connector/
│   │   ├── models/            # SQLAlchemy 모델
│   │   ├── services/          # 비즈니스 로직
│   │   ├── utils/             # 유틸리티 함수
│   │   ├── config.py          # 설정
│   │   └── main.py            # FastAPI 앱
│   ├── tests/                 # 백엔드 테스트
│   │   ├── contract/          # API 계약 테스트
│   │   ├── integration/       # 통합 테스트
│   │   └── unit/              # 유닛 테스트
│   └── requirements*.txt      # Python 의존성
├── frontend/                   # React 프론트엔드
│   ├── public/                # 정적 파일
│   ├── src/
│   │   ├── components/        # React 컴포넌트
│   │   │   ├── common/        # 공통 컴포넌트
│   │   │   └── features/      # 기능별 컴포넌트
│   │   ├── hooks/             # 커스텀 훅
│   │   ├── pages/             # 페이지 컴포넌트
│   │   ├── services/          # API 서비스
│   │   ├── stores/            # Zustand 스토어
│   │   ├── styles/            # 스타일 및 테마
│   │   ├── types/             # TypeScript 타입
│   │   ├── utils/             # 유틸리티 함수
│   │   └── main.tsx           # React 앱 진입점
│   ├── tests/                 # 프론트엔드 테스트
│   └── package.json           # Node.js 의존성
├── shared/                     # 공유 코드
│   └── types/                 # 공유 TypeScript 타입
├── docs/                      # 프로젝트 문서
├── specs/                     # 기술 명세서
├── nginx/                     # Nginx 설정
├── docker-compose.yml         # Docker 구성
└── README.md                  # 프로젝트 개요
```

### 아키텍처 패턴

#### 백엔드 아키텍처

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Layer    │ -> │  Service Layer  │ -> │ Repository Layer│
│   (FastAPI)    │    │ (Business Logic)│    │  (SQLAlchemy)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         v                       v                       v
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Schema Layer   │    │  Library Layer  │    │  Database Layer │
│  (Pydantic)    │    │ (Independent)   │    │ (PostgreSQL)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

#### 프론트엔드 아키텍처

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Pages Layer    │ -> │ Components Layer│ -> │  Hooks Layer    │
│   (Routing)     │    │   (UI Logic)    │    │ (State Logic)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         v                       v                       v
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Services Layer  │    │  Stores Layer   │    │  Utils Layer    │
│ (API Calls)     │    │ (Global State)  │    │  (Utilities)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 개발 워크플로우

### Git 브랜치 전략

```
main                    # 프로덕션 배포 브랜치
├── develop            # 개발 통합 브랜치
├── feature/001-ai-ai  # 현재 기능 브랜치
├── feature/002-xxx    # 다음 기능 브랜치
└── hotfix/bug-fix     # 긴급 수정 브랜치
```

### 커밋 메시지 규칙

```
type(scope): description

[optional body]

[optional footer]
```

**타입 종류**:
- `feat`: 새로운 기능
- `fix`: 버그 수정
- `docs`: 문서 업데이트
- `style`: 코드 스타일링 (포맷팅)
- `refactor`: 리팩토링
- `test`: 테스트 추가/수정
- `chore`: 빌드/패키지 관련

**예시**:
```bash
feat(api): add typing pattern analysis endpoint

- Add POST /sessions/{id}/analyze endpoint
- Implement keystroke data validation
- Add emotion profile generation

Closes #123
```

### 개발 프로세스

#### 1. 이슈 생성 및 할당

```bash
# GitHub Issues에서 이슈 생성
# 라벨: feature, bug, enhancement, docs
# 마일스톤: 해당 스프린트
# 담당자: 개발자 할당
```

#### 2. 브랜치 생성 및 개발

```bash
# develop에서 새 브랜치 생성
git checkout develop
git pull origin develop
git checkout -b feature/issue-123-typing-analysis

# 개발 진행
# ... 코드 작성 ...

# 테스트 실행
cd backend && pytest
cd frontend && npm test

# 커밋 및 푸시
git add .
git commit -m "feat(api): add typing analysis endpoint"
git push origin feature/issue-123-typing-analysis
```

#### 3. Pull Request 생성

```markdown
## 📝 변경 사항
- 타이핑 패턴 분석 엔드포인트 추가
- 키스트로크 데이터 검증 로직 구현
- 감정 프로필 생성 기능 추가

## 🧪 테스트
- [ ] 유닛 테스트 통과
- [ ] 통합 테스트 통과
- [ ] API 문서 업데이트

## 📸 스크린샷
(필요시 첨부)

## 🔗 관련 이슈
Closes #123
```

#### 4. 코드 리뷰 및 병합

```bash
# 리뷰어 검토 후 승인
# CI/CD 파이프라인 통과 확인
# develop 브랜치로 병합
```

## 코딩 규칙

### 백엔드 (Python) 규칙

#### 1. 코드 스타일

```python
# black, isort, flake8 사용
# 최대 줄 길이: 88자
# 들여쓰기: 공백 4개

# 좋은 예시
def analyze_typing_pattern(
    keystroke_data: List[KeystrokeData],
    session_id: str,
    algorithm_version: str = "v2.1"
) -> TypingPattern:
    """
    타이핑 패턴을 분석합니다.

    Args:
        keystroke_data: 키스트로크 데이터 리스트
        session_id: 세션 ID
        algorithm_version: 알고리즘 버전

    Returns:
        분석된 타이핑 패턴

    Raises:
        ValueError: 데이터가 유효하지 않을 때
    """
    if not keystroke_data:
        raise ValueError("키스트로크 데이터가 없습니다")

    # 분석 로직...
    return pattern
```

#### 2. 타입 힌팅

```python
# 모든 함수와 메서드에 타입 힌팅 필수
from typing import List, Dict, Optional, Union, Any

def process_data(
    data: Dict[str, Any],
    options: Optional[List[str]] = None
) -> Union[str, None]:
    pass
```

#### 3. 에러 처리

```python
# 구체적인 예외 처리
try:
    result = dangerous_operation()
except SpecificException as e:
    logger.error(f"구체적인 에러 발생: {e}")
    raise HTTPException(
        status_code=400,
        detail={
            "error": "SPECIFIC_ERROR",
            "message": "사용자 친화적 메시지",
            "details": {"additional": "info"}
        }
    )
```

#### 4. 로깅

```python
import logging

logger = logging.getLogger(__name__)

def process_request():
    logger.info("요청 처리 시작", extra={"session_id": session_id})

    try:
        result = process()
        logger.info("요청 처리 완료", extra={"result": result})
    except Exception as e:
        logger.error("요청 처리 실패", extra={"error": str(e)})
        raise
```

### 프론트엔드 (TypeScript/React) 규칙

#### 1. 컴포넌트 구조

```tsx
// 컴포넌트 파일 구조
import React from 'react';
import { ComponentProps } from './types';
import { useCustomHook } from './hooks';
import './styles.css';

interface Props extends ComponentProps {
  customProp: string;
}

export const MyComponent: React.FC<Props> = ({
  customProp,
  ...restProps
}) => {
  // 훅 사용
  const { data, loading } = useCustomHook();

  // 이벤트 핸들러
  const handleClick = useCallback(() => {
    // 로직...
  }, []);

  // 렌더링 조건
  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div {...restProps}>
      {/* JSX */}
    </div>
  );
};

export default MyComponent;
```

#### 2. 훅 사용

```tsx
// 커스텀 훅 패턴
export const useTypingAnalysis = (sessionId: string) => {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (data: KeystrokeData[]) => {
    try {
      setLoading(true);
      setError(null);

      const result = await analysisService.analyze(sessionId, data);
      setAnalysis(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  return {
    analysis,
    loading,
    error,
    analyze
  };
};
```

#### 3. 상태 관리

```tsx
// Zustand 스토어 패턴
interface SessionStore {
  session: Session | null;
  analysis: AnalysisResult | null;

  // Actions
  setSession: (session: Session) => void;
  setAnalysis: (analysis: AnalysisResult) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  session: null,
  analysis: null,

  setSession: (session) => set({ session }),
  setAnalysis: (analysis) => set({ analysis }),
  reset: () => set({ session: null, analysis: null })
}));
```

#### 4. API 서비스

```tsx
// API 서비스 패턴
class AnalysisService {
  private baseURL = process.env.VITE_API_BASE_URL;

  async analyze(
    sessionId: string,
    data: KeystrokeData[]
  ): Promise<AnalysisResult> {
    const response = await fetch(`${this.baseURL}/sessions/${sessionId}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getSessionToken()}`
      },
      body: JSON.stringify({ keystroke_data: data })
    });

    if (!response.ok) {
      throw new Error(`분석 실패: ${response.status}`);
    }

    return response.json();
  }
}

export const analysisService = new AnalysisService();
```

### 공통 규칙

#### 1. 네이밍 규칙

**Python**:
```python
# snake_case
variable_name = "value"
function_name()
class_name = ClassName
CONSTANT_NAME = "value"
```

**TypeScript**:
```typescript
// camelCase
const variableName = "value";
function functionName() {}
const ComponentName = () => {};
const CONSTANT_NAME = "value";
```

#### 2. 파일 구조

```bash
# 파일명
backend: snake_case.py
frontend: camelCase.tsx, kebab-case.css

# 폴더명
kebab-case/
snake_case/  (Python에서)
```

## 테스트 가이드

### 테스트 전략

**테스트 피라미드**:
```
        E2E Tests (적음)
    Integration Tests (보통)
Unit Tests (많음)
```

### 백엔드 테스트

#### 1. 유닛 테스트

```python
# tests/unit/test_pattern_analyzer.py
import pytest
from src.lib.pattern_analyzer import PatternAnalyzer
from src.lib.pattern_analyzer.types import KeystrokeData

class TestPatternAnalyzer:
    def setup_method(self):
        self.analyzer = PatternAnalyzer()

    def test_analyze_valid_data(self):
        """유효한 데이터로 패턴 분석 테스트"""
        keystroke_data = [
            KeystrokeData(key="a", timestamp=1000, duration=100),
            KeystrokeData(key="b", timestamp=1200, duration=120),
        ]

        result = self.analyzer.analyze(keystroke_data)

        assert result is not None
        assert result.wpm > 0
        assert 0 <= result.rhythm_score <= 1

    def test_analyze_empty_data(self):
        """빈 데이터 처리 테스트"""
        with pytest.raises(ValueError, match="데이터가 없습니다"):
            self.analyzer.analyze([])
```

#### 2. 통합 테스트

```python
# tests/integration/test_analysis_service.py
import pytest
from fastapi.testclient import TestClient
from src.main import app
from src.database.connection import get_async_session
from tests.fixtures import create_test_session

@pytest.mark.asyncio
class TestAnalysisService:
    def setup_method(self):
        self.client = TestClient(app)

    async def test_analyze_endpoint(self, test_session):
        """분석 엔드포인트 통합 테스트"""
        session_id = test_session.id
        token = test_session.session_token

        response = self.client.post(
            f"/v1/sessions/{session_id}/analyze",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "keystroke_data": [
                    {"key": "a", "timestamp": 1000, "duration": 100}
                ],
                "text_content": "test"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert "analysis_id" in data
        assert "typing_pattern" in data
```

#### 3. API 계약 테스트

```python
# tests/contract/test_sessions_post.py
def test_create_session_contract():
    """세션 생성 API 계약 테스트"""
    response = client.post("/v1/sessions/", json={
        "consent_given": True
    })

    # 상태 코드 확인
    assert response.status_code == 201

    # 응답 스키마 확인
    data = response.json()
    assert "id" in data
    assert "session_token" in data
    assert data["consent_given"] is True
    assert isinstance(data["created_at"], str)
```

### 프론트엔드 테스트

#### 1. 유닛 테스트 (Jest)

```tsx
// tests/unit/hooks/useTypingAnalysis.test.ts
import { renderHook, act } from '@testing-library/react';
import { useTypingAnalysis } from '@/hooks/useTypingAnalysis';

describe('useTypingAnalysis', () => {
  it('초기 상태가 올바르게 설정되어야 함', () => {
    const { result } = renderHook(() => useTypingAnalysis('session-123'));

    expect(result.current.analysis).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('분석이 성공적으로 실행되어야 함', async () => {
    const { result } = renderHook(() => useTypingAnalysis('session-123'));

    const mockData = [
      { key: 'a', timestamp: 1000, duration: 100 }
    ];

    await act(async () => {
      await result.current.analyze(mockData);
    });

    expect(result.current.analysis).toBeTruthy();
    expect(result.current.loading).toBe(false);
  });
});
```

#### 2. 컴포넌트 테스트

```tsx
// tests/unit/components/TypingAnalyzer.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { TypingAnalyzer } from '@/components/TypingAnalyzer';

describe('TypingAnalyzer', () => {
  it('키 입력을 올바르게 캡처해야 함', () => {
    render(<TypingAnalyzer sessionId="test-session" />);

    const input = screen.getByTestId('typing-input');
    fireEvent.keyDown(input, { key: 'a' });
    fireEvent.keyUp(input, { key: 'a' });

    expect(screen.getByText(/키 입력: 1/)).toBeInTheDocument();
  });

  it('분석 버튼 클릭 시 분석이 시작되어야 함', () => {
    const onAnalyze = jest.fn();
    render(<TypingAnalyzer sessionId="test-session" onAnalyze={onAnalyze} />);

    const button = screen.getByText('분석 시작');
    fireEvent.click(button);

    expect(onAnalyze).toHaveBeenCalled();
  });
});
```

#### 3. E2E 테스트 (Playwright)

```typescript
// tests/e2e/typing-analysis.spec.ts
import { test, expect } from '@playwright/test';

test.describe('타이핑 분석 워크플로우', () => {
  test('사용자는 타이핑 패턴을 분석할 수 있다', async ({ page }) => {
    // 메인 페이지 접속
    await page.goto('/');

    // 새 세션 시작
    await page.click('[data-testid="start-session"]');
    await expect(page.locator('[data-testid="session-created"]')).toBeVisible();

    // 타이핑 입력
    const input = page.locator('[data-testid="typing-input"]');
    await input.type('Hello, world!', { delay: 100 });

    // 분석 시작
    await page.click('[data-testid="analyze-button"]');

    // 결과 확인
    await expect(page.locator('[data-testid="analysis-result"]')).toBeVisible();
    await expect(page.locator('[data-testid="emotion-display"]')).toContainText(/감정:/);
  });

  test('사용자는 AI 음악을 생성할 수 있다', async ({ page }) => {
    // 이전 테스트에서 이어짐...

    // 음악 생성 요청
    await page.fill('[data-testid="prompt-input"]', '차분한 피아노 음악');
    await page.click('[data-testid="generate-music"]');

    // 생성 완료 대기 (최대 60초)
    await expect(page.locator('[data-testid="music-player"]')).toBeVisible({ timeout: 60000 });

    // 음악 재생 테스트
    await page.click('[data-testid="play-button"]');
    await expect(page.locator('[data-testid="playing-indicator"]')).toBeVisible();
  });
});
```

### 테스트 실행

```bash
# 백엔드 테스트
cd backend

# 전체 테스트 실행
pytest

# 커버리지 포함
pytest --cov=src --cov-report=html

# 특정 테스트만 실행
pytest tests/unit/test_pattern_analyzer.py::TestPatternAnalyzer::test_analyze_valid_data

# 프론트엔드 테스트
cd frontend

# 유닛 테스트
npm test

# E2E 테스트
npm run test:e2e

# 커버리지 포함
npm run test:coverage
```

## 배포 및 운영

### 개발 환경 배포

```bash
# Docker Compose로 전체 스택 실행
docker-compose -f docker-compose.dev.yml up -d

# 개별 서비스 재시작
docker-compose restart backend
docker-compose restart frontend
```

### 프로덕션 배포

#### 1. 환경 변수 설정

```bash
# backend/.env.prod
ENVIRONMENT=production
DEBUG=False
SECRET_KEY=your-secret-key
DATABASE_URL=postgresql://user:pass@host:5432/vibemusic
REDIS_URL=redis://redis:6379/0
CORS_ORIGINS=https://vibemusic.com
```

#### 2. Docker 빌드 및 배포

```bash
# 프로덕션 이미지 빌드
docker build -t vibemusic/backend:latest ./backend
docker build -t vibemusic/frontend:latest ./frontend

# 배포
docker-compose -f docker-compose.prod.yml up -d
```

#### 3. 데이터베이스 마이그레이션

```bash
# 프로덕션 데이터베이스 마이그레이션
docker exec -it vibemusic_backend alembic upgrade head
```

### 모니터링 및 로깅

#### 1. 로그 설정

```python
# backend/src/config.py
LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        },
        "json": {
            "format": '{"timestamp": "%(asctime)s", "logger": "%(name)s", "level": "%(levelname)s", "message": "%(message)s"}'
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json" if settings.ENVIRONMENT == "production" else "default"
        },
        "file": {
            "class": "logging.FileHandler",
            "filename": "vibemusic.log",
            "formatter": "json"
        }
    },
    "root": {
        "level": "INFO",
        "handlers": ["console", "file"]
    }
}
```

#### 2. 헬스 체크

```python
# backend/src/health.py
@router.get("/health")
async def health_check():
    """시스템 헬스 체크"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow(),
        "version": settings.APP_VERSION,
        "dependencies": {
            "database": await check_database(),
            "redis": await check_redis(),
            "ai_service": await check_ai_service()
        }
    }
```

#### 3. 메트릭 수집

```python
# Prometheus 메트릭 예시
from prometheus_client import Counter, Histogram, generate_latest

# 메트릭 정의
REQUEST_COUNT = Counter('requests_total', 'Total requests', ['method', 'endpoint'])
REQUEST_DURATION = Histogram('request_duration_seconds', 'Request duration')

@app.middleware("http")
async def add_metrics(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)

    REQUEST_COUNT.labels(
        method=request.method,
        endpoint=request.url.path
    ).inc()

    REQUEST_DURATION.observe(time.time() - start_time)
    return response
```

## 문제 해결

### 자주 발생하는 문제들

#### 1. 데이터베이스 연결 오류

**문제**: `psycopg2.OperationalError: could not connect to server`

**해결책**:
```bash
# PostgreSQL 컨테이너 상태 확인
docker-compose ps postgres

# 컨테이너 재시작
docker-compose restart postgres

# 연결 테스트
docker exec -it vibemusic_postgres psql -U postgres -d vibemusic
```

#### 2. WebSocket 연결 실패

**문제**: `WebSocket connection failed`

**해결책**:
```typescript
// 재연결 로직 구현
class WebSocketManager {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect() {
    const ws = new WebSocket(this.url);

    ws.onopen = () => {
      this.reconnectAttempts = 0;
    };

    ws.onclose = () => {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        setTimeout(() => {
          this.reconnectAttempts++;
          this.connect();
        }, 1000 * Math.pow(2, this.reconnectAttempts));
      }
    };
  }
}
```

#### 3. 메모리 사용량 증가

**문제**: 메모리 사용량이 지속적으로 증가

**해결책**:
```python
# 메모리 프로파일링
import tracemalloc
import psutil

def monitor_memory():
    tracemalloc.start()

    # 코드 실행...

    current, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    process = psutil.Process()
    memory_info = process.memory_info()

    logger.info(f"메모리 사용량: {memory_info.rss / 1024 / 1024:.2f} MB")
```

#### 4. API 응답 속도 저하

**문제**: API 응답 시간이 느림

**해결책**:
```python
# 성능 프로파일링
import cProfile
import pstats

def profile_api_call():
    profiler = cProfile.Profile()
    profiler.enable()

    # API 호출 코드...

    profiler.disable()
    stats = pstats.Stats(profiler)
    stats.sort_stats('cumulative')
    stats.print_stats(20)  # 상위 20개 함수 출력
```

### 디버깅 팁

#### 1. 백엔드 디버깅

```python
# 상세한 로깅 활성화
import logging
logging.basicConfig(level=logging.DEBUG)

# pdb 사용
import pdb; pdb.set_trace()

# FastAPI 디버그 모드
uvicorn src.main:app --reload --log-level debug
```

#### 2. 프론트엔드 디버깅

```typescript
// React Developer Tools 활용
// Redux DevTools Extension 사용

// 상세한 로깅
console.log('디버그 정보:', { data, state, props });

// 성능 측정
console.time('렌더링 시간');
// 컴포넌트 렌더링...
console.timeEnd('렌더링 시간');
```

#### 3. 네트워크 디버깅

```bash
# API 요청 테스트
curl -X POST "http://localhost:8000/v1/sessions/" \
  -H "Content-Type: application/json" \
  -d '{"consent_given": true}' \
  -v

# WebSocket 연결 테스트
wscat -c "ws://localhost:8000/v1/ws/session-id?token=your-token"
```

### 성능 최적화

#### 1. 백엔드 최적화

```python
# 데이터베이스 쿼리 최적화
from sqlalchemy.orm import selectinload

# N+1 문제 해결
async def get_sessions_with_music():
    return await session.execute(
        select(UserSession)
        .options(selectinload(UserSession.music_generations))
    )

# 캐싱 활용
from functools import lru_cache

@lru_cache(maxsize=128)
def expensive_calculation(data: str) -> str:
    # 비용이 큰 계산...
    return result
```

#### 2. 프론트엔드 최적화

```typescript
// React.memo로 불필요한 렌더링 방지
export const ExpensiveComponent = React.memo(({ data }) => {
  // 컴포넌트 로직...
}, (prevProps, nextProps) => {
  return prevProps.data.id === nextProps.data.id;
});

// useMemo로 계산 결과 메모이제이션
const expensiveValue = useMemo(() => {
  return calculateExpensiveValue(data);
}, [data]);

// lazy loading으로 번들 크기 최적화
const LazyComponent = React.lazy(() => import('./LazyComponent'));
```

---

이 개발 가이드는 VibeMusic 프로젝트의 효과적인 개발을 위한 모든 필수 정보를 담고 있습니다. 추가 질문이나 개선 사항이 있다면 GitHub Issues를 통해 문의해 주세요.