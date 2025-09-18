"""
VibeMusic FastAPI 애플리케이션 메인 진입점
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn

from src.config import settings
from src.api.router import api_router
from src.api.websocket import router as websocket_router
from src.database.connection import init_db, close_db
from src.cache.redis_client import init_cache, close_cache


@asynccontextmanager
async def lifespan(app: FastAPI):
    """애플리케이션 라이프사이클 관리"""
    # 시작 시 초기화
    print(f"🎵 {settings.APP_NAME} v{settings.APP_VERSION} 시작 중...")
    print(f"🔧 환경: {settings.ENVIRONMENT}")
    print(f"🐘 데이터베이스: PostgreSQL")

    # 데이터베이스 초기화
    await init_db()
    print("✅ 데이터베이스 초기화 완료")

    # Redis 캐시 초기화
    try:
        await init_cache()
        print("✅ Redis 캐시 초기화 완료")
    except Exception as e:
        print(f"⚠️  Redis 캐시 초기화 실패: {e}")
        print("⚠️  Redis 없이 서비스를 시작합니다...")

    yield

    # 종료 시 정리
    print("🛑 Redis 캐시 연결을 종료합니다...")
    await close_cache()
    print("🛑 데이터베이스 연결을 종료합니다...")
    await close_db()
    print("🎵 VibeMusic 서비스를 종료합니다...")


# FastAPI 애플리케이션 생성
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="감정 기반 AI 음악 생성 서비스",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan
)

# CORS 미들웨어 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 라우터 포함
app.include_router(api_router)

# WebSocket 라우터 포함
app.include_router(websocket_router)


@app.get("/")
async def root():
    """루트 엔드포인트"""
    return {
        "message": f"Welcome to {settings.APP_NAME}!",
        "version": settings.APP_VERSION,
        "status": "healthy",
        "api_docs": "/docs",
        "api_v1": "/v1/",
        "health_check": "/health"
    }


@app.get("/health")
async def root_health_check():
    """
    루트 헬스 체크 엔드포인트 (Docker 헬스체크용)
    /v1/health와 동일한 기능을 제공
    """
    from src.api.router import health_check
    return await health_check()


if __name__ == "__main__":
    uvicorn.run(
        "src.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )