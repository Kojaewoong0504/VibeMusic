"""
VibeMusic Cache Module

Redis 캐시 연결 및 관리 모듈
감정 기반 AI 음악 생성 서비스를 위한 고성능 캐시 시스템
"""

from .redis_client import (
    redis_client,
    get_redis,
    init_cache,
    close_cache,
    CacheService
)

__all__ = [
    "redis_client",
    "get_redis",
    "init_cache",
    "close_cache",
    "CacheService"
]