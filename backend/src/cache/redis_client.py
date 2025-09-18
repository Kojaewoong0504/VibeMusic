"""
Redis 캐시 클라이언트 설정 및 관리

VibeMusic 서비스를 위한 Redis 연결, 세션 관리, 캐시 서비스
- 실시간 타이핑 데이터 버퍼링
- 세션 상태 관리
- 음악 생성 임시 데이터 캐시
- 감정 분석 결과 캐시
"""

import json
import logging
from typing import Any, Dict, List, Optional, Union
from datetime import datetime, timedelta

import redis.asyncio as redis
from redis.asyncio import Redis
from redis.exceptions import RedisError, ConnectionError as RedisConnectionError

from src.config import settings

logger = logging.getLogger(__name__)

# ============================================================================
# Redis Client Configuration
# ============================================================================

class RedisClient:
    """
    비동기 Redis 클라이언트 래퍼
    연결 관리, 재연결, 에러 처리를 포함
    """

    def __init__(self):
        self._client: Optional[Redis] = None
        self._connection_pool = None
        self._is_connected = False

    async def connect(self) -> None:
        """Redis 서버에 연결"""
        try:
            # Redis URL로 직접 연결 (환경변수 우선)
            self._client = redis.from_url(
                settings.REDIS_URL,
                encoding='utf-8',
                decode_responses=True,
                max_connections=settings.REDIS_MAX_CONNECTIONS,
                retry_on_timeout=True,
                socket_timeout=settings.REDIS_SOCKET_TIMEOUT,
                socket_connect_timeout=settings.REDIS_CONNECT_TIMEOUT,
                socket_keepalive=True,
                socket_keepalive_options={},
                health_check_interval=30
            )

            # 연결 테스트
            await self._client.ping()
            self._is_connected = True

            logger.info("Redis 연결 성공: %s:%s (DB: %s)",
                       settings.REDIS_HOST, settings.REDIS_PORT, settings.REDIS_DB)

        except RedisConnectionError as e:
            logger.error("Redis 연결 실패: %s", str(e))
            self._is_connected = False
            raise
        except Exception as e:
            logger.error("Redis 클라이언트 초기화 실패: %s", str(e))
            self._is_connected = False
            raise

    async def disconnect(self) -> None:
        """Redis 연결 종료"""
        if self._client:
            try:
                await self._client.close()
                logger.info("Redis 연결 종료됨")
            except Exception as e:
                logger.error("Redis 연결 종료 중 오류: %s", str(e))
            finally:
                self._client = None
                self._is_connected = False

    async def is_healthy(self) -> bool:
        """Redis 서버 상태 확인"""
        if not self._client or not self._is_connected:
            return False

        try:
            await self._client.ping()
            return True
        except Exception:
            self._is_connected = False
            return False

    @property
    def client(self) -> Optional[Redis]:
        """Redis 클라이언트 인스턴스 반환"""
        return self._client

    @property
    def is_connected(self) -> bool:
        """연결 상태 반환"""
        return self._is_connected


# 전역 Redis 클라이언트 인스턴스
redis_client = RedisClient()


# ============================================================================
# Dependency Functions
# ============================================================================

async def get_redis() -> Redis:
    """
    Redis 클라이언트 의존성
    FastAPI dependency로 사용
    """
    if not redis_client.is_connected or not redis_client.client:
        raise RedisConnectionError("Redis 서버에 연결되지 않음")

    return redis_client.client


async def init_cache() -> None:
    """
    캐시 시스템 초기화
    애플리케이션 시작 시 호출
    """
    try:
        await redis_client.connect()

        # 캐시 네임스페이스 설정
        cache_service = CacheService(redis_client.client)
        await cache_service.clear_expired_sessions()

        logger.info("캐시 시스템 초기화 완료")

    except Exception as e:
        logger.error("캐시 시스템 초기화 실패: %s", str(e))
        raise


async def close_cache() -> None:
    """
    캐시 시스템 종료
    애플리케이션 종료 시 호출
    """
    await redis_client.disconnect()


# ============================================================================
# Cache Service
# ============================================================================

class CacheService:
    """
    Redis 캐시 서비스
    VibeMusic 특화 캐시 오퍼레이션
    """

    # 캐시 키 네임스페이스
    SESSION_PREFIX = "vibemusic:session:"
    TYPING_PREFIX = "vibemusic:typing:"
    EMOTION_PREFIX = "vibemusic:emotion:"
    MUSIC_PREFIX = "vibemusic:music:"
    TEMP_PREFIX = "vibemusic:temp:"

    # 기본 TTL (Time To Live) 설정
    DEFAULT_TTL = 3600  # 1시간
    SESSION_TTL = 86400  # 24시간 (개인정보 보호)
    TYPING_TTL = 1800   # 30분 (실시간 데이터)
    EMOTION_TTL = 3600  # 1시간
    MUSIC_TTL = 86400   # 24시간
    TEMP_TTL = 300      # 5분 (임시 데이터)

    def __init__(self, redis_client: Redis):
        self.redis = redis_client

    # ------------------------------------------------------------------------
    # 세션 관리
    # ------------------------------------------------------------------------

    async def set_session(self, session_id: str, data: Dict[str, Any],
                         ttl: int = SESSION_TTL) -> bool:
        """세션 데이터 저장"""
        try:
            key = f"{self.SESSION_PREFIX}{session_id}"
            serialized_data = json.dumps(data, default=str, ensure_ascii=False)

            result = await self.redis.setex(key, ttl, serialized_data)
            return bool(result)

        except Exception as e:
            logger.error("세션 데이터 저장 실패 [%s]: %s", session_id, str(e))
            return False

    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """세션 데이터 조회"""
        try:
            key = f"{self.SESSION_PREFIX}{session_id}"
            data = await self.redis.get(key)

            if data:
                return json.loads(data)
            return None

        except Exception as e:
            logger.error("세션 데이터 조회 실패 [%s]: %s", session_id, str(e))
            return None

    async def delete_session(self, session_id: str) -> bool:
        """세션 데이터 삭제"""
        try:
            key = f"{self.SESSION_PREFIX}{session_id}"
            result = await self.redis.delete(key)
            return bool(result)

        except Exception as e:
            logger.error("세션 데이터 삭제 실패 [%s]: %s", session_id, str(e))
            return False

    async def extend_session_ttl(self, session_id: str, ttl: int = SESSION_TTL) -> bool:
        """세션 TTL 연장"""
        try:
            key = f"{self.SESSION_PREFIX}{session_id}"
            result = await self.redis.expire(key, ttl)
            return bool(result)

        except Exception as e:
            logger.error("세션 TTL 연장 실패 [%s]: %s", session_id, str(e))
            return False

    # ------------------------------------------------------------------------
    # 실시간 타이핑 데이터 버퍼
    # ------------------------------------------------------------------------

    async def push_typing_data(self, session_id: str, typing_data: Dict[str, Any]) -> bool:
        """타이핑 데이터를 버퍼에 추가"""
        try:
            key = f"{self.TYPING_PREFIX}{session_id}"

            # 타임스탬프 추가
            typing_data['timestamp'] = datetime.utcnow().isoformat()
            serialized_data = json.dumps(typing_data, default=str, ensure_ascii=False)

            # 리스트의 오른쪽에 추가 (FIFO)
            await self.redis.rpush(key, serialized_data)

            # TTL 설정
            await self.redis.expire(key, self.TYPING_TTL)

            # 버퍼 크기 제한 (최대 1000개)
            await self.redis.ltrim(key, -1000, -1)

            return True

        except Exception as e:
            logger.error("타이핑 데이터 푸시 실패 [%s]: %s", session_id, str(e))
            return False

    async def get_typing_buffer(self, session_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """타이핑 데이터 버퍼 조회"""
        try:
            key = f"{self.TYPING_PREFIX}{session_id}"

            # 최근 limit개 데이터 조회
            raw_data = await self.redis.lrange(key, -limit, -1)

            typing_data = []
            for item in raw_data:
                try:
                    data = json.loads(item)
                    typing_data.append(data)
                except json.JSONDecodeError:
                    continue

            return typing_data

        except Exception as e:
            logger.error("타이핑 버퍼 조회 실패 [%s]: %s", session_id, str(e))
            return []

    async def clear_typing_buffer(self, session_id: str) -> bool:
        """타이핑 데이터 버퍼 삭제"""
        try:
            key = f"{self.TYPING_PREFIX}{session_id}"
            result = await self.redis.delete(key)
            return bool(result)

        except Exception as e:
            logger.error("타이핑 버퍼 삭제 실패 [%s]: %s", session_id, str(e))
            return False

    # ------------------------------------------------------------------------
    # 감정 분석 결과 캐시
    # ------------------------------------------------------------------------

    async def cache_emotion_analysis(self, session_id: str, emotion_data: Dict[str, Any],
                                   ttl: int = EMOTION_TTL) -> bool:
        """감정 분석 결과 캐시"""
        try:
            key = f"{self.EMOTION_PREFIX}{session_id}"

            # 메타데이터 추가
            cache_data = {
                'emotion_data': emotion_data,
                'cached_at': datetime.utcnow().isoformat(),
                'ttl': ttl
            }

            serialized_data = json.dumps(cache_data, default=str, ensure_ascii=False)
            result = await self.redis.setex(key, ttl, serialized_data)
            return bool(result)

        except Exception as e:
            logger.error("감정 분석 캐시 실패 [%s]: %s", session_id, str(e))
            return False

    async def get_cached_emotion(self, session_id: str) -> Optional[Dict[str, Any]]:
        """캐시된 감정 분석 결과 조회"""
        try:
            key = f"{self.EMOTION_PREFIX}{session_id}"
            data = await self.redis.get(key)

            if data:
                cache_data = json.loads(data)
                return cache_data.get('emotion_data')
            return None

        except Exception as e:
            logger.error("감정 분석 캐시 조회 실패 [%s]: %s", session_id, str(e))
            return None

    # ------------------------------------------------------------------------
    # 음악 생성 임시 데이터
    # ------------------------------------------------------------------------

    async def set_temp_music_data(self, music_id: str, data: Dict[str, Any],
                                ttl: int = TEMP_TTL) -> bool:
        """음악 생성 임시 데이터 저장"""
        try:
            key = f"{self.TEMP_PREFIX}music:{music_id}"
            serialized_data = json.dumps(data, default=str, ensure_ascii=False)

            result = await self.redis.setex(key, ttl, serialized_data)
            return bool(result)

        except Exception as e:
            logger.error("음악 임시 데이터 저장 실패 [%s]: %s", music_id, str(e))
            return False

    async def get_temp_music_data(self, music_id: str) -> Optional[Dict[str, Any]]:
        """음악 생성 임시 데이터 조회"""
        try:
            key = f"{self.TEMP_PREFIX}music:{music_id}"
            data = await self.redis.get(key)

            if data:
                return json.loads(data)
            return None

        except Exception as e:
            logger.error("음악 임시 데이터 조회 실패 [%s]: %s", music_id, str(e))
            return None

    # ------------------------------------------------------------------------
    # 유틸리티 메서드
    # ------------------------------------------------------------------------

    async def clear_expired_sessions(self) -> int:
        """만료된 세션 정리"""
        try:
            # 패턴 매칭으로 모든 세션 키 조회
            pattern = f"{self.SESSION_PREFIX}*"
            keys = await self.redis.keys(pattern)

            expired_count = 0
            for key in keys:
                ttl = await self.redis.ttl(key)
                if ttl == -1:  # TTL이 설정되지 않은 경우
                    await self.redis.expire(key, self.SESSION_TTL)
                elif ttl == -2:  # 키가 존재하지 않거나 만료된 경우
                    expired_count += 1

            logger.info("만료된 세션 %d개 정리 완료", expired_count)
            return expired_count

        except Exception as e:
            logger.error("만료된 세션 정리 실패: %s", str(e))
            return 0

    async def get_cache_stats(self) -> Dict[str, Any]:
        """캐시 시스템 통계"""
        try:
            info = await self.redis.info()

            # 네임스페이스별 키 개수
            session_keys = len(await self.redis.keys(f"{self.SESSION_PREFIX}*"))
            typing_keys = len(await self.redis.keys(f"{self.TYPING_PREFIX}*"))
            emotion_keys = len(await self.redis.keys(f"{self.EMOTION_PREFIX}*"))
            music_keys = len(await self.redis.keys(f"{self.MUSIC_PREFIX}*"))
            temp_keys = len(await self.redis.keys(f"{self.TEMP_PREFIX}*"))

            return {
                'redis_version': info.get('redis_version'),
                'connected_clients': info.get('connected_clients'),
                'used_memory': info.get('used_memory_human'),
                'hit_rate': info.get('keyspace_hits', 0) / max(1, info.get('keyspace_hits', 0) + info.get('keyspace_misses', 0)),
                'total_commands_processed': info.get('total_commands_processed'),
                'keys_by_namespace': {
                    'sessions': session_keys,
                    'typing': typing_keys,
                    'emotion': emotion_keys,
                    'music': music_keys,
                    'temp': temp_keys
                },
                'uptime_seconds': info.get('uptime_in_seconds')
            }

        except Exception as e:
            logger.error("캐시 통계 조회 실패: %s", str(e))
            return {}

    async def flush_all_cache(self) -> bool:
        """모든 캐시 데이터 삭제 (개발용)"""
        try:
            if settings.ENVIRONMENT == "development":
                await self.redis.flushdb()
                logger.warning("개발 환경: 모든 캐시 데이터 삭제됨")
                return True
            else:
                logger.warning("프로덕션 환경에서 전체 캐시 삭제 요청 거부")
                return False

        except Exception as e:
            logger.error("캐시 전체 삭제 실패: %s", str(e))
            return False