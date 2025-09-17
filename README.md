# 🎵 VibeMusic - 감정 기반 AI 음악 생성 서비스

타이핑 패턴에서 감정을 분석해 개인 맞춤형 AI 음악을 생성하는 웹 서비스입니다.

## ✨ 주요 기능

- **실시간 타이핑 패턴 캡처**: WebSocket을 통한 키보드 입력 실시간 분석
- **감정 분석**: 타이핑 속도, 리듬, 일시정지 패턴으로 감정 상태 추출
- **AI 음악 생성**: 분석된 감정을 바탕으로 개인화된 음악 생성
- **실시간 미리보기**: 타이핑하는 동안 실시간 감정 상태 시각화
- **개인정보 보호**: 24시간 자동 삭제로 개인정보 보호

## 🏗️ 프로젝트 구조

```
vibemusic/
├── backend/                # FastAPI 백엔드
│   ├── src/
│   │   ├── models/        # SQLAlchemy 모델
│   │   ├── services/      # 비즈니스 로직
│   │   ├── api/          # FastAPI 엔드포인트
│   │   └── lib/          # 독립 라이브러리
│   └── tests/            # 백엔드 테스트
├── frontend/              # React 프론트엔드
│   ├── src/
│   │   ├── components/   # React 컴포넌트
│   │   ├── pages/       # 페이지 컴포넌트
│   │   ├── services/    # API 호출
│   │   └── hooks/       # React hooks
│   └── tests/           # 프론트엔드 테스트
├── shared/               # 공유 타입 정의
│   └── types/
└── specs/               # 기술 명세서
```

## 🚀 빠른 시작

### 1. 개발 환경 설정

```bash
# 저장소 클론
git clone https://github.com/vibemusic/vibemusic.git
cd vibemusic

# Docker로 개발 환경 시작
docker-compose up -d

# 백엔드 의존성 설치 (Python 3.12+)
cd backend
pip install -r requirements.txt
pip install -r requirements-dev.txt

# 프론트엔드 의존성 설치 (Node.js 18+)
cd ../frontend  
npm install

# 데이터베이스 마이그레이션
cd ../backend
python -m alembic upgrade head

# 개발 서버 시작
python -m uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

# 새 터미널에서 프론트엔드 시작
cd frontend
npm run dev
```

### 2. 접속 확인

- **프론트엔드**: http://localhost:3000
- **백엔드 API**: http://localhost:8000
- **API 문서**: http://localhost:8000/docs

## 🛠️ 기술 스택

### 백엔드
- **Python 3.12** - 최신 Python 기능 활용
- **FastAPI** - 고성능 비동기 웹 프레임워크
- **PostgreSQL** - 관계형 데이터베이스
- **Redis** - 세션 캐싱 및 실시간 데이터
- **WebSocket** - 실시간 타이핑 패턴 전송
- **SQLAlchemy** - ORM
- **Alembic** - 데이터베이스 마이그레이션

### 프론트엔드
- **React 18+** - 최신 React 기능 및 Hooks
- **TypeScript** - 타입 안전성
- **Vite** - 빠른 개발 서버
- **TailwindCSS** - 유틸리티 퍼스트 CSS
- **React Query** - 서버 상태 관리
- **Zustand** - 클라이언트 상태 관리
- **Framer Motion** - 애니메이션

### 개발 도구
- **Docker & Docker Compose** - 컨테이너화
- **Pytest** - 백엔드 테스트
- **Jest & Playwright** - 프론트엔드 테스트
- **Black & ESLint** - 코드 포맷팅
- **Storybook** - 컴포넌트 문서화

## 📋 개발 명령어

### 백엔드
```bash
cd backend

# 개발 서버 실행
python -m uvicorn src.main:app --reload

# 테스트 실행
pytest

# 코드 포맷팅
black src tests
isort src tests

# 타입 체크
mypy src
```

### 프론트엔드
```bash
cd frontend

# 개발 서버 실행
npm run dev

# 빌드
npm run build

# 테스트
npm test
npm run test:e2e

# 린팅
npm run lint
npm run lint:fix

# Storybook
npm run storybook
```

## 🧪 테스트

### 테스트 전략
- **Contract Tests**: API 계약 테스트 우선
- **Integration Tests**: 데이터베이스 및 WebSocket 통합 테스트
- **E2E Tests**: 사용자 플로우 전체 테스트
- **Unit Tests**: 개별 함수 및 컴포넌트 테스트

### 테스트 실행
```bash
# 백엔드 테스트
cd backend && pytest --cov=src

# 프론트엔드 테스트
cd frontend && npm test

# E2E 테스트
cd frontend && npm run test:e2e
```

## 🔒 보안 및 개인정보보호

- **자동 데이터 삭제**: 24시간 후 자동 세션 삭제
- **토큰 기반 인증**: JWT를 통한 안전한 세션 관리
- **HTTPS/WSS**: 모든 통신 암호화
- **Rate Limiting**: API 남용 방지
- **CORS 설정**: 허용된 도메인만 접근

## 📚 문서

- [API 문서](./specs/001-ai-ai/contracts/openapi.yaml)
- [WebSocket 명세](./specs/001-ai-ai/contracts/websocket.yaml)
- [데이터 모델](./specs/001-ai-ai/data-model.md)
- [개발 가이드](./specs/001-ai-ai/quickstart.md)

## 🤝 기여하기

1. Fork 저장소
2. Feature 브랜치 생성 (`git checkout -b feature/amazing-feature`)
3. 변경사항 커밋 (`git commit -m 'Add amazing feature'`)
4. 브랜치에 Push (`git push origin feature/amazing-feature`)
5. Pull Request 생성

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 있습니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

---

**Made with ❤️ by VibeMusic Team**