# 최적화된 FastAPI 프로덕션 Dockerfile (멀티스테이지 빌드)

# Stage 1: 의존성 설치 및 빌드 (빌드 스테이지)
FROM python:3.12-slim as builder

# 빌드 인수 정의
ARG BUILDPLATFORM
ARG TARGETPLATFORM
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION

# 메타데이터 라벨
LABEL maintainer="VibeMusic Team" \
      version="${VERSION}" \
      description="VibeMusic Backend API Server" \
      build-date="${BUILD_DATE}" \
      vcs-ref="${VCS_REF}"

# 빌드 의존성 설치 (캐시 최적화)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    gcc \
    g++ \
    git \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /var/cache/apt/archives/*

# Python 최적화 설정
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=100 \
    POETRY_NO_INTERACTION=1 \
    POETRY_VENV_IN_PROJECT=1 \
    POETRY_CACHE_DIR=/tmp/poetry_cache

# 작업 디렉토리 설정
WORKDIR /app

# requirements 파일들 복사 (레이어 캐싱 최적화)
COPY requirements*.txt ./

# 의존성 설치 (캐시 활용을 위해 분리)
RUN pip install --upgrade pip setuptools wheel && \
    pip install --user --no-cache-dir -r requirements.txt

# 프로덕션 전용 requirements 설치 (있는 경우)
RUN if [ -f requirements.prod.txt ]; then \
    pip install --user --no-cache-dir -r requirements.prod.txt; \
    fi

# 소스 코드 복사 (빌드 시점에만 필요)
COPY . .

# Stage 2: 런타임 스테이지 (최소한의 프로덕션 이미지)
FROM python:3.12-slim as runtime

# 런타임 인수 정의
ARG APP_VERSION=latest
ARG ENVIRONMENT=production

# 런타임 환경 변수 설정
ENV APP_VERSION=${APP_VERSION} \
    ENVIRONMENT=${ENVIRONMENT} \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONHASHSEED=random \
    PYTHONPATH=/app \
    PATH=/home/appuser/.local/bin:$PATH

# 보안을 위한 non-root 유저 생성
RUN groupadd -r appgroup && \
    useradd -r -g appgroup -u 1001 -d /home/appuser -m appuser

# 런타임 의존성만 설치 (보안 및 크기 최적화)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    ca-certificates \
    tini \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /var/cache/apt/archives/*

# 빌드 스테이지에서 설치된 Python 패키지 복사
COPY --from=builder /root/.local /home/appuser/.local

# 애플리케이션 디렉토리 생성 및 권한 설정
WORKDIR /app
RUN chown -R appuser:appgroup /app

# 애플리케이션 코드 복사 (최적화된 복사)
COPY --chown=appuser:appgroup --from=builder /app/src ./src
COPY --chown=appuser:appgroup --from=builder /app/*.py ./
COPY --chown=appuser:appgroup --from=builder /app/alembic* ./

# 로그 디렉토리 생성
RUN mkdir -p /app/logs && chown appuser:appgroup /app/logs

# non-root 사용자로 전환
USER appuser

# 헬스체크 개선 (더 효율적인 체크)
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f -s http://localhost:8000/health || exit 1

# 포트 노출
EXPOSE 8000

# 시그널 처리를 위한 tini 사용
ENTRYPOINT ["tini", "--"]

# 프로덕션 서버 실행 (성능 최적화된 설정)
CMD ["python", "-m", "uvicorn", "src.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "4", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--access-log", \
     "--log-level", "info", \
     "--no-server-header"]