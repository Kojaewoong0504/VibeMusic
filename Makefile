# VibeMusic 개발 편의 스크립트

.PHONY: help setup dev test clean lint format docker-up docker-down

# 기본 도움말
help:
	@echo "VibeMusic 개발 명령어:"
	@echo "  setup      - 개발 환경 초기 설정"
	@echo "  dev        - 개발 서버 시작"
	@echo "  test       - 전체 테스트 실행"
	@echo "  lint       - 코드 린팅"
	@echo "  format     - 코드 포맷팅"
	@echo "  docker-up  - Docker 서비스 시작"
	@echo "  docker-down - Docker 서비스 종료"
	@echo "  clean      - 캐시 및 임시 파일 정리"

# 개발 환경 초기 설정
setup:
	@echo "🔧 개발 환경 설정 중..."
	cd backend && pip install -r requirements.txt && pip install -r requirements-dev.txt
	cd frontend && npm install
	@echo "✅ 개발 환경 설정 완료!"

# 개발 서버 시작 (Docker 사용)
dev:
	@echo "🚀 개발 서버 시작 중..."
	docker-compose up -d db redis
	@echo "⏳ 데이터베이스 준비 중..."
	sleep 10
	cd backend && python -m alembic upgrade head
	docker-compose up -d api frontend
	@echo "✅ 개발 서버 시작 완료!"
	@echo "🌐 Frontend: http://localhost:3000"
	@echo "🔗 Backend: http://localhost:8000"

# 전체 테스트 실행
test:
	@echo "🧪 테스트 실행 중..."
	cd backend && pytest --cov=src
	cd frontend && npm test
	@echo "✅ 모든 테스트 완료!"

# E2E 테스트
test-e2e:
	@echo "🎭 E2E 테스트 실행 중..."
	cd frontend && npm run test:e2e
	@echo "✅ E2E 테스트 완료!"

# 코드 린팅
lint:
	@echo "🔍 코드 린팅 중..."
	cd backend && flake8 src tests && mypy src
	cd frontend && npm run lint
	@echo "✅ 린팅 완료!"

# 코드 포맷팅
format:
	@echo "✨ 코드 포맷팅 중..."
	cd backend && black src tests && isort src tests
	cd frontend && npm run lint:fix
	@echo "✅ 포맷팅 완료!"

# Docker 서비스 시작
docker-up:
	@echo "🐳 Docker 서비스 시작 중..."
	docker-compose up -d
	@echo "✅ Docker 서비스 시작 완료!"

# Docker 서비스 종료
docker-down:
	@echo "🛑 Docker 서비스 종료 중..."
	docker-compose down
	@echo "✅ Docker 서비스 종료 완료!"

# 프로덕션 빌드
build:
	@echo "🏗️ 프로덕션 빌드 중..."
	cd frontend && npm run build
	@echo "✅ 빌드 완료!"

# 캐시 및 임시 파일 정리
clean:
	@echo "🧹 캐시 정리 중..."
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "node_modules" -prune -o -type f -name "*.pyc" -delete 2>/dev/null || true
	cd frontend && npm run clean 2>/dev/null || true
	docker system prune -f
	@echo "✅ 정리 완료!"

# 데이터베이스 마이그레이션
migrate:
	@echo "🗄️ 데이터베이스 마이그레이션 중..."
	cd backend && python -m alembic upgrade head
	@echo "✅ 마이그레이션 완료!"

# 개발용 데이터 시드
seed:
	@echo "🌱 개발용 데이터 시드 중..."
	cd backend && python -m src.scripts.seed_data
	@echo "✅ 시드 완료!"

# 의존성 업데이트
update-deps:
	@echo "📦 의존성 업데이트 중..."
	cd backend && pip-tools compile requirements.in && pip-tools compile requirements-dev.in
	cd frontend && npm update
	@echo "✅ 의존성 업데이트 완료!"