"""
FastAPI 메인 라우터 설정
"""
from fastapi import APIRouter

# API 버전별 라우터
api_router = APIRouter(prefix="/v1")


@api_router.get("/health")
async def health_check():
    """헬스 체크 엔드포인트"""
    return {
        "status": "healthy",
        "service": "vibemusic-backend",
        "version": "1.0.0"
    }


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