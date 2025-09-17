"""
Redis 캐싱 최적화 전략

성능 향상을 위한 고급 캐싱 패턴 구현
"""
import json
import logging
import asyncio
import hashlib
from typing import Any, Dict, List, Optional, Union, Callable, TypeVar, Generic
from datetime import datetime, timedelta
from functools import wraps, lru_cache
from dataclasses import dataclass
from enum import Enum

import redis.asyncio as aioredis
from redis.asyncio import Redis
from redis.exceptions import RedisError

from ..utils.logging import get_logger

logger = get_logger(__name__)

T = TypeVar('T')


class CacheStrategy(str, Enum):
    """캐시 전략 유형"""
    WRITE_THROUGH = "write_through"
    WRITE_BEHIND = "write_behind"
    CACHE_ASIDE = "cache_aside"
    REFRESH_AHEAD = "refresh_ahead"


class CacheLevel(str, Enum):
    """캐시 레벨"""
    L1_MEMORY = "l1_memory"  # 인메모리 캐시
    L2_REDIS = "l2_redis"    # Redis 캐시
    L3_DATABASE = "l3_database"  # 데이터베이스


@dataclass
class CacheConfig:
    """캐시 설정"""
    ttl: int = 3600  # 기본 1시간
    strategy: CacheStrategy = CacheStrategy.CACHE_ASIDE
    compress: bool = False
    serializer: str = "json"  # json, pickle, msgpack
    memory_cache_size: int = 1000
    batch_write_size: int = 100
    refresh_threshold: float = 0.8  # TTL의 80%에서 미리 갱신


class MultiLevelCache(Generic[T]):
    """다단계 캐시 시스템 (성능 최적화 적용)"""

    def __init__(self, redis_client: Redis, config: CacheConfig):
        self.redis = redis_client
        self.config = config
        self._memory_cache: Dict[str, Any] = {}
        self._memory_timestamps: Dict[str, datetime] = {}
        self._batch_write_queue: Dict[str, Any] = {}
        self._write_lock = asyncio.Lock()

        # 성능 최적화 추가 필드
        self._hit_count = 0
        self._miss_count = 0
        self._memory_hit_count = 0
        self._redis_hit_count = 0
        self._last_optimization = datetime.utcnow()
        self._compression_enabled = config.compress

        # 백프레셔 제어
        self._max_queue_size = config.batch_write_size * 10
        self._queue_backpressure_threshold = config.batch_write_size * 5

    @lru_cache(maxsize=1000)
    def _get_cache_key(self, namespace: str, key: str) -> str:
        """캐시 키 생성 (해시 기반 최적화)"""
        if len(key) > 200:  # 긴 키는 해시화
            key_hash = hashlib.sha256(key.encode()).hexdigest()[:16]
            return f"{namespace}:hash:{key_hash}"
        return f"{namespace}:{key}"

    def _serialize(self, data: Any) -> str:
        """데이터 직렬화 (압축 지원)"""
        if self.config.serializer == "json":
            serialized = json.dumps(data, default=str, ensure_ascii=False)
        else:
            serialized = json.dumps(data, default=str, ensure_ascii=False)

        # 압축 적용 (큰 데이터에만)
        if self._compression_enabled and len(serialized) > 1024:  # 1KB 이상
            import gzip
            import base64
            compressed = gzip.compress(serialized.encode('utf-8'))
            return f"compressed:{base64.b64encode(compressed).decode('ascii')}"

        return serialized

    def _deserialize(self, data: str) -> Any:
        """데이터 역직렬화 (압축 해제 지원)"""
        # 압축된 데이터 확인
        if data.startswith("compressed:"):
            import gzip
            import base64
            compressed_data = data[11:]  # "compressed:" 제거
            compressed_bytes = base64.b64decode(compressed_data.encode('ascii'))
            decompressed = gzip.decompress(compressed_bytes).decode('utf-8')
            return json.loads(decompressed)

        if self.config.serializer == "json":
            return json.loads(data)
        return json.loads(data)

    async def get(self, namespace: str, key: str) -> Optional[T]:
        """다단계 캐시에서 데이터 조회 (성능 메트릭 포함)"""
        cache_key = self._get_cache_key(namespace, key)

        # L1: 메모리 캐시 확인
        if cache_key in self._memory_cache:
            timestamp = self._memory_timestamps.get(cache_key)
            if timestamp and (datetime.utcnow() - timestamp).seconds < self.config.ttl:
                self._hit_count += 1
                self._memory_hit_count += 1
                logger.debug(f"L1 캐시 히트: {cache_key}")
                return self._memory_cache[cache_key]
            else:
                # 만료된 메모리 캐시 제거
                del self._memory_cache[cache_key]
                del self._memory_timestamps[cache_key]

        # L2: Redis 캐시 확인
        try:
            redis_data = await self.redis.get(cache_key)
            if redis_data:
                self._hit_count += 1
                self._redis_hit_count += 1
                logger.debug(f"L2 캐시 히트: {cache_key}")
                data = self._deserialize(redis_data)

                # L1 캐시에 저장 (메모리 크기 제한 + LRU 고려)
                if len(self._memory_cache) < self.config.memory_cache_size:
                    self._memory_cache[cache_key] = data
                    self._memory_timestamps[cache_key] = datetime.utcnow()
                elif self.config.memory_cache_size > 0:
                    # LRU 정책으로 가장 오래된 항목 제거
                    oldest_key = min(self._memory_timestamps.items(), key=lambda x: x[1])[0]
                    del self._memory_cache[oldest_key]
                    del self._memory_timestamps[oldest_key]

                    # 새 항목 추가
                    self._memory_cache[cache_key] = data
                    self._memory_timestamps[cache_key] = datetime.utcnow()

                return data

        except RedisError as e:
            logger.warning(f"Redis 조회 실패: {e}")

        self._miss_count += 1
        logger.debug(f"캐시 미스: {cache_key}")
        return None

    async def set(self, namespace: str, key: str, value: T, ttl: Optional[int] = None) -> bool:
        """다단계 캐시에 데이터 저장 (백프레셔 제어 포함)"""
        cache_key = self._get_cache_key(namespace, key)
        ttl = ttl or self.config.ttl

        # L1: 메모리 캐시 저장 (LRU 정책 적용)
        if len(self._memory_cache) < self.config.memory_cache_size:
            self._memory_cache[cache_key] = value
            self._memory_timestamps[cache_key] = datetime.utcnow()
        elif self.config.memory_cache_size > 0:
            # LRU 정책으로 가장 오래된 항목 제거
            oldest_key = min(self._memory_timestamps.items(), key=lambda x: x[1])[0]
            del self._memory_cache[oldest_key]
            del self._memory_timestamps[oldest_key]

            # 새 항목 추가
            self._memory_cache[cache_key] = value
            self._memory_timestamps[cache_key] = datetime.utcnow()

        # L2: Redis 캐시 저장
        try:
            serialized_data = self._serialize(value)

            if self.config.strategy == CacheStrategy.WRITE_BEHIND:
                # 백프레셔 제어: 큐가 너무 클 때 즉시 플러시
                async with self._write_lock:
                    if len(self._batch_write_queue) >= self._max_queue_size:
                        logger.warning(f"배치 큐 한계 도달, 즉시 플러시: {len(self._batch_write_queue)}개 항목")
                        await self._flush_batch_writes()

                    self._batch_write_queue[cache_key] = (serialized_data, ttl)

                    # 임계치 도달 시 백그라운드 플러시
                    if len(self._batch_write_queue) >= self.config.batch_write_size:
                        asyncio.create_task(self._flush_batch_writes())
                    elif len(self._batch_write_queue) >= self._queue_backpressure_threshold:
                        # 백프레셔 상황에서 조건부 플러시
                        asyncio.create_task(self._conditional_flush())
            else:
                # 즉시 쓰기
                await self.redis.setex(cache_key, ttl, serialized_data)

            return True

        except RedisError as e:
            logger.error(f"Redis 저장 실패: {e}")
            return False

    async def _conditional_flush(self) -> None:
        """조건부 배치 플러시 (백프레셔 제어)"""
        async with self._write_lock:
            # 큐가 여전히 임계치를 넘는 경우에만 플러시
            if len(self._batch_write_queue) >= self._queue_backpressure_threshold:
                await self._flush_batch_writes()

    async def _flush_batch_writes(self) -> None:
        """배치 쓰기 큐 플러시"""
        if not self._batch_write_queue:
            return

        try:
            pipe = self.redis.pipeline()
            for cache_key, (data, ttl) in self._batch_write_queue.items():
                pipe.setex(cache_key, ttl, data)

            await pipe.execute()
            logger.debug(f"배치 쓰기 완료: {len(self._batch_write_queue)}개 항목")
            self._batch_write_queue.clear()

        except RedisError as e:
            logger.error(f"배치 쓰기 실패: {e}")

    async def delete(self, namespace: str, key: str) -> bool:
        """캐시에서 데이터 삭제"""
        cache_key = self._get_cache_key(namespace, key)

        # L1 캐시에서 삭제
        self._memory_cache.pop(cache_key, None)
        self._memory_timestamps.pop(cache_key, None)

        # L2 캐시에서 삭제
        try:
            result = await self.redis.delete(cache_key)
            return result > 0
        except RedisError as e:
            logger.error(f"Redis 삭제 실패: {e}")
            return False

    async def clear_namespace(self, namespace: str) -> int:
        """네임스페이스 전체 캐시 삭제"""
        pattern = f"{namespace}:*"

        # L1 캐시에서 해당 네임스페이스 삭제
        keys_to_remove = [k for k in self._memory_cache.keys() if k.startswith(f"{namespace}:")]
        for key in keys_to_remove:
            self._memory_cache.pop(key, None)
            self._memory_timestamps.pop(key, None)

        # L2 캐시에서 삭제
        try:
            keys = await self.redis.keys(pattern)
            if keys:
                deleted = await self.redis.delete(*keys)
                logger.info(f"네임스페이스 '{namespace}' 캐시 {deleted}개 삭제")
                return deleted
            return 0
        except RedisError as e:
            logger.error(f"네임스페이스 삭제 실패: {e}")
            return 0


class CacheManager:
    """캐시 관리자 - 도메인별 캐시 전략 관리"""

    def __init__(self, redis_client: Redis):
        self.redis = redis_client
        self.caches: Dict[str, MultiLevelCache] = {}
        self._init_domain_caches()

    def _init_domain_caches(self):
        """도메인별 캐시 초기화"""
        # 세션 캐시 (짧은 TTL, 높은 처리량)
        self.caches['sessions'] = MultiLevelCache(
            self.redis,
            CacheConfig(
                ttl=1800,  # 30분
                strategy=CacheStrategy.WRITE_THROUGH,
                memory_cache_size=500,
                batch_write_size=50
            )
        )

        # 타이핑 패턴 캐시 (중간 TTL, 실시간 처리)
        self.caches['typing_patterns'] = MultiLevelCache(
            self.redis,
            CacheConfig(
                ttl=7200,  # 2시간
                strategy=CacheStrategy.WRITE_BEHIND,
                memory_cache_size=200,
                batch_write_size=100
            )
        )

        # 감정 분석 결과 캐시 (긴 TTL, 계산 비용 고려)
        self.caches['emotion_analysis'] = MultiLevelCache(
            self.redis,
            CacheConfig(
                ttl=21600,  # 6시간
                strategy=CacheStrategy.CACHE_ASIDE,
                memory_cache_size=300,
                batch_write_size=20
            )
        )

        # AI 음악 생성 결과 캐시 (매우 긴 TTL, 생성 비용 고려)
        self.caches['generated_music'] = MultiLevelCache(
            self.redis,
            CacheConfig(
                ttl=86400,  # 24시간
                strategy=CacheStrategy.WRITE_THROUGH,
                memory_cache_size=100,
                batch_write_size=10
            )
        )

        # API 응답 캐시 (짧은 TTL, 높은 요청률)
        self.caches['api_responses'] = MultiLevelCache(
            self.redis,
            CacheConfig(
                ttl=300,  # 5분
                strategy=CacheStrategy.WRITE_THROUGH,
                memory_cache_size=1000,
                batch_write_size=200
            )
        )

    def get_cache(self, domain: str) -> MultiLevelCache:
        """도메인별 캐시 인스턴스 반환"""
        return self.caches.get(domain, self.caches['api_responses'])

    async def warm_up_cache(self, domain: str, data_loader: Callable) -> int:
        """캐시 워밍업"""
        cache = self.get_cache(domain)
        count = 0

        try:
            warm_up_data = await data_loader()
            for key, value in warm_up_data.items():
                await cache.set(domain, key, value)
                count += 1

            logger.info(f"캐시 워밍업 완료 - {domain}: {count}개 항목")
            return count

        except Exception as e:
            logger.error(f"캐시 워밍업 실패 - {domain}: {e}")
            return 0

    async def get_cache_stats(self) -> Dict[str, Any]:
        """캐시 통계 수집"""
        stats = {
            'domains': {},
            'redis_info': {},
            'memory_usage': {}
        }

        # Redis 정보
        try:
            redis_info = await self.redis.info()
            stats['redis_info'] = {
                'used_memory': redis_info.get('used_memory_human', 'unknown'),
                'connected_clients': redis_info.get('connected_clients', 0),
                'keyspace_hits': redis_info.get('keyspace_hits', 0),
                'keyspace_misses': redis_info.get('keyspace_misses', 0),
                'hit_rate': self._calculate_hit_rate(
                    redis_info.get('keyspace_hits', 0),
                    redis_info.get('keyspace_misses', 0)
                )
            }
        except Exception as e:
            logger.error(f"Redis 정보 조회 실패: {e}")

        # 도메인별 캐시 통계
        for domain, cache in self.caches.items():
            memory_count = len(cache._memory_cache)
            redis_count = 0

            try:
                redis_keys = await self.redis.keys(f"{domain}:*")
                redis_count = len(redis_keys)
            except Exception:
                pass

            stats['domains'][domain] = {
                'memory_cache_count': memory_count,
                'redis_cache_count': redis_count,
                'memory_cache_limit': cache.config.memory_cache_size,
                'ttl': cache.config.ttl,
                'strategy': cache.config.strategy.value
            }

        return stats

    def _calculate_hit_rate(self, hits: int, misses: int) -> float:
        """캐시 히트율 계산"""
        total = hits + misses
        if total == 0:
            return 0.0
        return round((hits / total) * 100, 2)

    async def optimize_memory_usage(self) -> Dict[str, int]:
        """메모리 사용량 최적화"""
        cleanup_stats = {}

        for domain, cache in self.caches.items():
            cleaned = 0
            current_time = datetime.utcnow()

            # 만료된 메모리 캐시 항목 정리
            expired_keys = []
            for key, timestamp in cache._memory_timestamps.items():
                if (current_time - timestamp).seconds > cache.config.ttl:
                    expired_keys.append(key)

            for key in expired_keys:
                cache._memory_cache.pop(key, None)
                cache._memory_timestamps.pop(key, None)
                cleaned += 1

            # 메모리 한계 초과 시 LRU 방식으로 정리
            if len(cache._memory_cache) > cache.config.memory_cache_size:
                # 타임스탬프 기준 정렬하여 오래된 것부터 제거
                sorted_items = sorted(
                    cache._memory_timestamps.items(),
                    key=lambda x: x[1]
                )

                excess_count = len(cache._memory_cache) - cache.config.memory_cache_size
                for key, _ in sorted_items[:excess_count]:
                    cache._memory_cache.pop(key, None)
                    cache._memory_timestamps.pop(key, None)
                    cleaned += 1

            cleanup_stats[domain] = cleaned

        total_cleaned = sum(cleanup_stats.values())
        if total_cleaned > 0:
            logger.info(f"메모리 캐시 정리 완료: {cleanup_stats}")

        return cleanup_stats

    async def flush_all_writes(self) -> None:
        """모든 보류 중인 쓰기 작업 플러시"""
        for domain, cache in self.caches.items():
            try:
                await cache._flush_batch_writes()
            except Exception as e:
                logger.error(f"도메인 '{domain}' 쓰기 플러시 실패: {e}")


def cache_result(domain: str, ttl: int = 3600, key_func: Optional[Callable] = None):
    """캐시 데코레이터"""
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # 캐시 매니저 인스턴스 가져오기 (전역 변수 또는 의존성 주입)
            cache_manager = getattr(wrapper, '_cache_manager', None)
            if not cache_manager:
                return await func(*args, **kwargs)

            # 캐시 키 생성
            if key_func:
                cache_key = key_func(*args, **kwargs)
            else:
                # 기본 키 생성 (함수명 + 인수 해시)
                key_parts = [func.__name__]
                key_parts.extend(str(arg) for arg in args)
                key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
                cache_key = ":".join(key_parts)

            cache = cache_manager.get_cache(domain)

            # 캐시에서 조회
            cached_result = await cache.get(domain, cache_key)
            if cached_result is not None:
                return cached_result

            # 캐시 미스 시 함수 실행
            result = await func(*args, **kwargs)

            # 결과를 캐시에 저장
            await cache.set(domain, cache_key, result, ttl)

            return result

        return wrapper
    return decorator


# 글로벌 캐시 매니저 (애플리케이션 시작 시 초기화)
_global_cache_manager: Optional[CacheManager] = None


def get_cache_manager() -> Optional[CacheManager]:
    """글로벌 캐시 매니저 반환"""
    return _global_cache_manager


def init_cache_manager(redis_client: Redis) -> CacheManager:
    """캐시 매니저 초기화"""
    global _global_cache_manager
    _global_cache_manager = CacheManager(redis_client)
    return _global_cache_manager


class PerformanceMonitor:
    """Redis 성능 모니터링 및 자동 튜닝"""

    def __init__(self, cache_manager: CacheManager):
        self.cache_manager = cache_manager
        self.redis = cache_manager.redis
        self._monitoring_enabled = True
        self._last_analysis = datetime.utcnow()
        self._performance_history: List[Dict[str, Any]] = []

    async def collect_performance_metrics(self) -> Dict[str, Any]:
        """성능 메트릭 수집"""
        try:
            redis_info = await self.redis.info()
            cache_stats = await self.cache_manager.get_cache_stats()

            metrics = {
                'timestamp': datetime.utcnow().isoformat(),
                'redis_metrics': {
                    'used_memory_mb': redis_info.get('used_memory', 0) / (1024 * 1024),
                    'connected_clients': redis_info.get('connected_clients', 0),
                    'total_commands_processed': redis_info.get('total_commands_processed', 0),
                    'keyspace_hits': redis_info.get('keyspace_hits', 0),
                    'keyspace_misses': redis_info.get('keyspace_misses', 0),
                    'expired_keys': redis_info.get('expired_keys', 0),
                    'evicted_keys': redis_info.get('evicted_keys', 0),
                    'instantaneous_ops_per_sec': redis_info.get('instantaneous_ops_per_sec', 0),
                    'latency_ms': await self._measure_redis_latency()
                },
                'cache_metrics': cache_stats,
                'performance_scores': self._calculate_performance_scores(redis_info, cache_stats)
            }

            # 성능 히스토리 유지 (최근 100개)
            self._performance_history.append(metrics)
            if len(self._performance_history) > 100:
                self._performance_history.pop(0)

            return metrics

        except Exception as e:
            logger.error(f"성능 메트릭 수집 실패: {e}")
            return {}

    async def _measure_redis_latency(self) -> float:
        """Redis 응답 시간 측정"""
        try:
            start_time = datetime.utcnow()
            await self.redis.ping()
            end_time = datetime.utcnow()
            return (end_time - start_time).total_seconds() * 1000  # ms
        except Exception:
            return -1.0

    def _calculate_performance_scores(self, redis_info: Dict, cache_stats: Dict) -> Dict[str, float]:
        """성능 점수 계산 (0-100)"""
        scores = {}

        # 히트율 점수
        hit_rate = cache_stats.get('redis_info', {}).get('hit_rate', 0)
        scores['hit_rate_score'] = min(hit_rate * 100, 100)

        # 메모리 효율성 점수
        used_memory_mb = redis_info.get('used_memory', 0) / (1024 * 1024)
        memory_score = max(0, 100 - (used_memory_mb / 1024) * 100)  # 1GB 기준
        scores['memory_efficiency_score'] = memory_score

        # 응답 시간 점수 (10ms 이하 = 100점)
        latency = redis_info.get('instantaneous_latency', 10)
        latency_score = max(0, 100 - (latency / 10) * 100)
        scores['latency_score'] = latency_score

        # 처리량 점수
        ops_per_sec = redis_info.get('instantaneous_ops_per_sec', 0)
        throughput_score = min((ops_per_sec / 1000) * 100, 100)  # 1000 ops/sec = 100점
        scores['throughput_score'] = throughput_score

        # 종합 점수
        scores['overall_score'] = sum(scores.values()) / len(scores)

        return scores

    async def analyze_and_optimize(self) -> Dict[str, Any]:
        """성능 분석 및 자동 최적화"""
        if not self._monitoring_enabled:
            return {'status': 'monitoring_disabled'}

        metrics = await self.collect_performance_metrics()
        if not metrics:
            return {'status': 'metrics_collection_failed'}

        recommendations = []
        optimizations_applied = []

        performance_scores = metrics.get('performance_scores', {})
        overall_score = performance_scores.get('overall_score', 0)

        # 히트율이 낮은 경우
        hit_rate_score = performance_scores.get('hit_rate_score', 0)
        if hit_rate_score < 80:
            recommendations.append({
                'type': 'hit_rate_improvement',
                'description': f'캐시 히트율이 낮습니다 ({hit_rate_score:.1f}%). TTL 설정을 검토하고 캐시 워밍업을 고려하세요.',
                'priority': 'high'
            })

            # 자동 TTL 조정
            try:
                await self._optimize_ttl_settings()
                optimizations_applied.append('ttl_auto_adjustment')
            except Exception as e:
                logger.error(f"TTL 자동 조정 실패: {e}")

        # 메모리 사용률이 높은 경우
        memory_score = performance_scores.get('memory_efficiency_score', 100)
        if memory_score < 70:
            recommendations.append({
                'type': 'memory_optimization',
                'description': f'메모리 사용률이 높습니다 ({memory_score:.1f}%). 압축 활성화나 만료 정책 조정을 고려하세요.',
                'priority': 'medium'
            })

            # 자동 메모리 정리
            try:
                cleaned = await self.cache_manager.optimize_memory_usage()
                if sum(cleaned.values()) > 0:
                    optimizations_applied.append(f'memory_cleanup_{sum(cleaned.values())}_items')
            except Exception as e:
                logger.error(f"메모리 정리 실패: {e}")

        # 응답 시간이 느린 경우
        latency_score = performance_scores.get('latency_score', 100)
        if latency_score < 80:
            recommendations.append({
                'type': 'latency_optimization',
                'description': f'Redis 응답 시간이 느립니다 ({latency_score:.1f}%). 연결 풀 설정이나 네트워크를 확인하세요.',
                'priority': 'high'
            })

        return {
            'status': 'completed',
            'overall_score': overall_score,
            'metrics': metrics,
            'recommendations': recommendations,
            'optimizations_applied': optimizations_applied,
            'analysis_time': datetime.utcnow().isoformat()
        }

    async def _optimize_ttl_settings(self) -> None:
        """TTL 설정 자동 최적화"""
        # 히트율이 낮은 도메인의 TTL을 증가
        for domain, cache in self.cache_manager.caches.items():
            if hasattr(cache, '_hit_count') and hasattr(cache, '_miss_count'):
                total_requests = cache._hit_count + cache._miss_count
                if total_requests > 100:  # 충분한 샘플이 있는 경우
                    hit_rate = cache._hit_count / total_requests
                    if hit_rate < 0.8:  # 80% 미만
                        # TTL을 20% 증가
                        new_ttl = int(cache.config.ttl * 1.2)
                        cache.config.ttl = min(new_ttl, 86400)  # 최대 24시간
                        logger.info(f"도메인 '{domain}' TTL 자동 조정: {cache.config.ttl}초")

    def get_performance_trends(self, hours: int = 24) -> Dict[str, Any]:
        """성능 트렌드 분석"""
        if len(self._performance_history) < 2:
            return {'status': 'insufficient_data'}

        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        recent_metrics = [
            m for m in self._performance_history
            if datetime.fromisoformat(m['timestamp']) >= cutoff_time
        ]

        if len(recent_metrics) < 2:
            return {'status': 'insufficient_recent_data'}

        # 트렌드 계산
        trends = {}
        first_metric = recent_metrics[0]
        last_metric = recent_metrics[-1]

        # 주요 메트릭들의 변화율 계산
        for metric_name in ['hit_rate_score', 'memory_efficiency_score', 'latency_score', 'overall_score']:
            first_value = first_metric.get('performance_scores', {}).get(metric_name, 0)
            last_value = last_metric.get('performance_scores', {}).get(metric_name, 0)

            if first_value > 0:
                change_percent = ((last_value - first_value) / first_value) * 100
                trends[metric_name] = {
                    'first_value': first_value,
                    'last_value': last_value,
                    'change_percent': round(change_percent, 2),
                    'trend': 'improving' if change_percent > 0 else 'degrading' if change_percent < 0 else 'stable'
                }

        return {
            'status': 'success',
            'period_hours': hours,
            'data_points': len(recent_metrics),
            'trends': trends,
            'analysis_time': datetime.utcnow().isoformat()
        }


# 글로벌 성능 모니터
_global_performance_monitor: Optional[PerformanceMonitor] = None


def get_performance_monitor() -> Optional[PerformanceMonitor]:
    """글로벌 성능 모니터 반환"""
    return _global_performance_monitor


def init_performance_monitor(cache_manager: CacheManager) -> PerformanceMonitor:
    """성능 모니터 초기화"""
    global _global_performance_monitor
    _global_performance_monitor = PerformanceMonitor(cache_manager)
    return _global_performance_monitor