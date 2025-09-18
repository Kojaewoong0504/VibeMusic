"""
FastAPI 메인 라우터 설정
"""
from datetime import datetime
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse

from src.database.connection import check_db_health
from src.cache.redis_client import redis_client

# API 버전별 라우터
api_router = APIRouter(prefix="/v1")


@api_router.get("/health")
async def health_check():
    """
    헬스 체크 엔드포인트
    데이터베이스와 Redis 연결 상태를 확인하여 서비스 상태 반환
    """
    health_status = {
        "status": "healthy",
        "service": "vibemusic-backend",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "database": "unknown",
        "redis": "unknown"
    }

    # 전체 서비스 상태 (모든 구성요소가 정상이어야 healthy)
    all_healthy = True

    # 데이터베이스 연결 상태 확인
    try:
        db_healthy = await check_db_health()
        health_status["database"] = "connected" if db_healthy else "disconnected"
        if not db_healthy:
            all_healthy = False
    except Exception as e:
        health_status["database"] = f"error: {str(e)}"
        all_healthy = False

    # Redis 연결 상태 확인
    try:
        redis_healthy = await redis_client.is_healthy()
        health_status["redis"] = "connected" if redis_healthy else "disconnected"
        if not redis_healthy:
            all_healthy = False
    except Exception as e:
        health_status["redis"] = f"error: {str(e)}"
        all_healthy = False

    # 전체 상태 업데이트
    if not all_healthy:
        health_status["status"] = "unhealthy"
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=health_status
        )

    return health_status


@api_router.get("/")
async def api_root():
    """API 루트 엔드포인트"""
    return {
        "message": "VibeMusic API v1.0.0",
        "docs_url": "/docs",
        "health_check": "/v1/health"
    }


# 라우터 포함
from .sessions import router as sessions_router
from .analysis import router as analysis_router
from .generation import router as generation_router
from .music import router as music_router

# 라우터 등록
api_router.include_router(sessions_router, prefix="/sessions", tags=["sessions"])
api_router.include_router(analysis_router, prefix="/sessions", tags=["analysis"])
api_router.include_router(generation_router, prefix="/sessions", tags=["generation"])
api_router.include_router(music_router, prefix="/sessions", tags=["music"])