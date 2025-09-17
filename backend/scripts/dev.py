#!/usr/bin/env python3
"""
개발 서버 실행 스크립트
"""
import uvicorn
from src.config import settings


if __name__ == "__main__":
    uvicorn.run(
        "src.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
        log_level="info",
        reload_dirs=["src"],
        env_file=".env"
    )