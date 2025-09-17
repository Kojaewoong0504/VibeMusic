"""
데이터베이스 성능 최적화 서비스

자동 정리, 통계 수집, 쿼리 최적화를 담당
"""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from contextlib import asynccontextmanager

from sqlalchemy import text, func, select, delete, update, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database.connection import get_async_session
from ..models.user_session import UserSession
from ..models.typing_pattern import TypingPattern
from ..models.generated_music import GeneratedMusic, MusicStatus
from ..utils.logging import get_logger

logger = get_logger(__name__)


class DatabaseOptimizer:
    """데이터베이스 성능 최적화 관리"""

    def __init__(self):
        self.cleanup_batch_size = 1000
        self.statistics_cache_ttl = 3600  # 1시간
        self._last_cleanup = None
        self._last_stats_update = None

    async def cleanup_expired_sessions(self, batch_size: Optional[int] = None) -> int:
        """만료된 세션 자동 정리 (인덱스 최적화 적용)"""
        batch_size = batch_size or self.cleanup_batch_size

        async with get_async_session() as session:
            try:
                # 최적화된 쿼리: idx_user_sessions_auto_delete_at 인덱스 활용
                expired_query = select(UserSession.id).where(
                    and_(
                        UserSession.auto_delete_at <= datetime.utcnow(),
                        UserSession.status.in_(['active', 'completed', 'abandoned'])
                    )
                ).order_by(UserSession.auto_delete_at).limit(batch_size)

                result = await session.execute(expired_query)
                expired_ids = [row[0] for row in result.fetchall()]

                if not expired_ids:
                    logger.info("만료된 세션이 없습니다")
                    return 0

                # 배치 삭제 최적화 (트랜잭션 크기 제한)
                deleted_total = 0
                for i in range(0, len(expired_ids), 100):  # 100개씩 처리
                    batch_ids = expired_ids[i:i+100]
                    delete_query = delete(UserSession).where(
                        UserSession.id.in_(batch_ids)
                    )

                    result = await session.execute(delete_query)
                    deleted_total += result.rowcount

                await session.commit()

                logger.info(f"만료된 세션 {deleted_total}개 정리 완료")
                self._last_cleanup = datetime.utcnow()

                return deleted_total

            except Exception as e:
                await session.rollback()
                logger.error(f"세션 정리 중 오류: {e}")
                raise

    async def cleanup_orphaned_music_files(self) -> int:
        """고아 음악 파일 정리 (24시간 이상 생성 중인 상태)"""
        cutoff_time = datetime.utcnow() - timedelta(hours=24)

        async with get_async_session() as session:
            try:
                # 24시간 이상 생성 중인 음악 파일들을 실패로 마킹
                update_query = update(GeneratedMusic).where(
                    and_(
                        GeneratedMusic.status == MusicStatus.GENERATING,
                        GeneratedMusic.created_at <= cutoff_time
                    )
                ).values(
                    status=MusicStatus.FAILED,
                    error_message="생성 타임아웃 (24시간 초과)",
                    completed_at=datetime.utcnow()
                )

                result = await session.execute(update_query)
                updated_count = result.rowcount

                await session.commit()

                if updated_count > 0:
                    logger.info(f"타임아웃된 음악 생성 {updated_count}개를 실패로 처리")

                return updated_count

            except Exception as e:
                await session.rollback()
                logger.error(f"고아 음악 파일 정리 중 오류: {e}")
                raise

    async def update_table_statistics(self) -> Dict[str, Any]:
        """테이블 통계 업데이트 및 수집"""
        async with get_async_session() as session:
            try:
                # PostgreSQL 통계 업데이트
                await session.execute(text("ANALYZE user_sessions"))
                await session.execute(text("ANALYZE typing_patterns"))
                await session.execute(text("ANALYZE generated_music"))

                # 테이블별 통계 수집
                stats = {}

                # UserSession 통계
                session_stats = await session.execute(
                    select(
                        func.count(UserSession.id).label('total'),
                        func.count().filter(UserSession.status == 'active').label('active'),
                        func.count().filter(UserSession.status == 'completed').label('completed'),
                        func.avg(UserSession.total_typing_time).label('avg_typing_time'),
                        func.avg(UserSession.total_music_generated).label('avg_music_count')
                    )
                )
                session_row = session_stats.first()
                stats['user_sessions'] = {
                    'total': session_row.total,
                    'active': session_row.active,
                    'completed': session_row.completed,
                    'avg_typing_time_seconds': float(session_row.avg_typing_time or 0),
                    'avg_music_count': float(session_row.avg_music_count or 0)
                }

                # TypingPattern 통계
                pattern_stats = await session.execute(
                    select(
                        func.count(TypingPattern.id).label('total'),
                        func.avg(func.jsonb_array_length(TypingPattern.keystrokes)).label('avg_keystrokes')
                    )
                )
                pattern_row = pattern_stats.first()
                stats['typing_patterns'] = {
                    'total': pattern_row.total,
                    'avg_keystrokes': float(pattern_row.avg_keystrokes or 0)
                }

                # GeneratedMusic 통계
                music_stats = await session.execute(
                    select(
                        func.count(GeneratedMusic.id).label('total'),
                        func.count().filter(GeneratedMusic.status == 'completed').label('completed'),
                        func.count().filter(GeneratedMusic.status == 'generating').label('generating'),
                        func.count().filter(GeneratedMusic.status == 'failed').label('failed'),
                        func.avg(GeneratedMusic.generation_time).label('avg_generation_time'),
                        func.avg(GeneratedMusic.quality_score).label('avg_quality_score')
                    )
                )
                music_row = music_stats.first()
                stats['generated_music'] = {
                    'total': music_row.total,
                    'completed': music_row.completed,
                    'generating': music_row.generating,
                    'failed': music_row.failed,
                    'avg_generation_time_seconds': float(music_row.avg_generation_time or 0),
                    'avg_quality_score': float(music_row.avg_quality_score or 0)
                }

                stats['updated_at'] = datetime.utcnow().isoformat()
                self._last_stats_update = datetime.utcnow()

                logger.info("데이터베이스 통계 업데이트 완료")
                return stats

            except Exception as e:
                logger.error(f"통계 업데이트 중 오류: {e}")
                raise

    async def get_slow_queries(self) -> List[Dict[str, Any]]:
        """느린 쿼리 분석 (PostgreSQL pg_stat_statements 사용)"""
        async with get_async_session() as session:
            try:
                # pg_stat_statements 확장이 있는 경우에만 실행
                slow_queries_sql = """
                SELECT
                    query,
                    calls,
                    total_exec_time,
                    mean_exec_time,
                    max_exec_time,
                    rows,
                    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
                FROM pg_stat_statements
                WHERE mean_exec_time > 100  -- 100ms 이상
                ORDER BY mean_exec_time DESC
                LIMIT 10
                """

                result = await session.execute(text(slow_queries_sql))
                slow_queries = []

                for row in result.fetchall():
                    slow_queries.append({
                        'query': row.query[:200] + '...' if len(row.query) > 200 else row.query,
                        'calls': row.calls,
                        'total_exec_time_ms': float(row.total_exec_time),
                        'mean_exec_time_ms': float(row.mean_exec_time),
                        'max_exec_time_ms': float(row.max_exec_time),
                        'rows_processed': row.rows,
                        'cache_hit_percent': float(row.hit_percent) if row.hit_percent else 0
                    })

                return slow_queries

            except Exception as e:
                # pg_stat_statements가 없거나 권한이 없는 경우
                logger.warning(f"느린 쿼리 분석 실패 (pg_stat_statements 필요): {e}")
                return []

    async def get_index_usage_stats(self) -> List[Dict[str, Any]]:
        """인덱스 사용 통계"""
        async with get_async_session() as session:
            try:
                index_usage_sql = """
                SELECT
                    schemaname,
                    tablename,
                    indexname,
                    idx_tup_read,
                    idx_tup_fetch,
                    idx_scan,
                    idx_tup_read::float / GREATEST(idx_scan, 1) as avg_tuples_per_scan
                FROM pg_stat_user_indexes
                WHERE schemaname = 'public'
                ORDER BY idx_scan DESC
                """

                result = await session.execute(text(index_usage_sql))
                index_stats = []

                for row in result.fetchall():
                    index_stats.append({
                        'schema': row.schemaname,
                        'table': row.tablename,
                        'index': row.indexname,
                        'scans': row.idx_scan,
                        'tuples_read': row.idx_tup_read,
                        'tuples_fetched': row.idx_tup_fetch,
                        'avg_tuples_per_scan': float(row.avg_tuples_per_scan)
                    })

                return index_stats

            except Exception as e:
                logger.error(f"인덱스 통계 조회 실패: {e}")
                return []

    async def optimize_database_settings(self) -> Dict[str, str]:
        """데이터베이스 설정 최적화 권장사항"""
        async with get_async_session() as session:
            try:
                # 현재 설정 조회
                settings_sql = """
                SELECT name, setting, unit, short_desc
                FROM pg_settings
                WHERE name IN (
                    'shared_buffers',
                    'effective_cache_size',
                    'maintenance_work_mem',
                    'checkpoint_completion_target',
                    'wal_buffers',
                    'default_statistics_target',
                    'random_page_cost',
                    'effective_io_concurrency'
                )
                """

                result = await session.execute(text(settings_sql))
                current_settings = {row.name: row.setting for row in result.fetchall()}

                # 메모리 정보 조회
                memory_sql = "SELECT (SELECT setting FROM pg_settings WHERE name = 'shared_buffers') as shared_buffers"
                memory_result = await session.execute(text(memory_sql))

                recommendations = {
                    'shared_buffers': '25% of total RAM for dedicated DB server',
                    'effective_cache_size': '75% of total RAM',
                    'maintenance_work_mem': '64MB to 1GB depending on operations',
                    'checkpoint_completion_target': '0.9 for write-heavy workloads',
                    'wal_buffers': '16MB for high write volumes',
                    'default_statistics_target': '100 for better query planning',
                    'random_page_cost': '1.1 for SSD storage',
                    'effective_io_concurrency': '200 for SSD arrays'
                }

                return {
                    'current_settings': current_settings,
                    'recommendations': recommendations,
                    'note': 'Restart required for some settings to take effect'
                }

            except Exception as e:
                logger.error(f"설정 조회 실패: {e}")
                return {'error': str(e)}

    async def run_maintenance_tasks(self) -> Dict[str, Any]:
        """종합 유지보수 작업 실행"""
        maintenance_results = {
            'started_at': datetime.utcnow().isoformat(),
            'tasks': {}
        }

        try:
            # 1. 만료된 세션 정리
            cleanup_count = await self.cleanup_expired_sessions()
            maintenance_results['tasks']['session_cleanup'] = {
                'status': 'completed',
                'deleted_sessions': cleanup_count
            }

            # 2. 고아 음악 파일 정리
            orphaned_count = await self.cleanup_orphaned_music_files()
            maintenance_results['tasks']['music_cleanup'] = {
                'status': 'completed',
                'updated_records': orphaned_count
            }

            # 3. 통계 업데이트
            stats = await self.update_table_statistics()
            maintenance_results['tasks']['statistics_update'] = {
                'status': 'completed',
                'statistics': stats
            }

            # 4. 느린 쿼리 분석
            slow_queries = await self.get_slow_queries()
            maintenance_results['tasks']['slow_query_analysis'] = {
                'status': 'completed',
                'slow_queries_count': len(slow_queries),
                'queries': slow_queries[:5]  # 상위 5개만
            }

            # 5. 인덱스 사용률 체크
            index_stats = await self.get_index_usage_stats()
            unused_indexes = [idx for idx in index_stats if idx['scans'] < 10]
            maintenance_results['tasks']['index_analysis'] = {
                'status': 'completed',
                'total_indexes': len(index_stats),
                'low_usage_indexes': len(unused_indexes)
            }

            maintenance_results['completed_at'] = datetime.utcnow().isoformat()
            maintenance_results['status'] = 'success'

            logger.info("데이터베이스 유지보수 작업 완료")

        except Exception as e:
            maintenance_results['status'] = 'error'
            maintenance_results['error'] = str(e)
            maintenance_results['completed_at'] = datetime.utcnow().isoformat()
            logger.error(f"유지보수 작업 중 오류: {e}")

        return maintenance_results


# 글로벌 인스턴스
db_optimizer = DatabaseOptimizer()


async def schedule_maintenance_tasks():
    """백그라운드 유지보수 작업 스케줄러"""
    while True:
        try:
            # 매 시간마다 유지보수 실행
            await db_optimizer.run_maintenance_tasks()
            await asyncio.sleep(3600)  # 1시간 대기

        except Exception as e:
            logger.error(f"스케줄된 유지보수 작업 실패: {e}")
            await asyncio.sleep(300)  # 5분 후 재시도


    async def get_optimized_active_sessions(self, limit: int = 100) -> List[Dict[str, Any]]:
        """최적화된 활성 세션 조회 (인덱스 활용)"""
        async with get_async_session() as session:
            try:
                # idx_user_sessions_status_start_time 인덱스 활용
                query = select(UserSession).where(
                    UserSession.status == 'active'
                ).order_by(UserSession.start_time.desc()).limit(limit)

                result = await session.execute(query)
                sessions = result.scalars().all()

                return [session.to_dict() for session in sessions]

            except Exception as e:
                logger.error(f"활성 세션 조회 실패: {e}")
                return []

    async def get_session_typing_patterns_optimized(self, session_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """최적화된 세션별 타이핑 패턴 조회"""
        async with get_async_session() as session:
            try:
                # idx_typing_patterns_session_created 인덱스 활용
                query = select(TypingPattern).where(
                    TypingPattern.session_id == session_id
                ).order_by(TypingPattern.created_at.desc()).limit(limit)

                result = await session.execute(query)
                patterns = result.scalars().all()

                return [pattern.to_dict() for pattern in patterns]

            except Exception as e:
                logger.error(f"타이핑 패턴 조회 실패: {e}")
                return []

    async def search_text_content_optimized(self, search_term: str, limit: int = 20) -> List[Dict[str, Any]]:
        """최적화된 텍스트 내용 검색 (Full-text search)"""
        async with get_async_session() as session:
            try:
                # idx_typing_patterns_text_content_gin 인덱스 활용
                search_query = select(TypingPattern).where(
                    and_(
                        TypingPattern.text_content.isnot(None),
                        text("to_tsvector('english', text_content) @@ plainto_tsquery(:search_term)")
                    )
                ).order_by(TypingPattern.created_at.desc()).limit(limit)

                result = await session.execute(search_query, {"search_term": search_term})
                patterns = result.scalars().all()

                return [pattern.to_dict() for pattern in patterns]

            except Exception as e:
                logger.error(f"텍스트 검색 실패: {e}")
                return []

    async def get_daily_statistics_optimized(self, date_from: datetime, date_to: datetime) -> Dict[str, Any]:
        """최적화된 일별 통계 조회"""
        async with get_async_session() as session:
            try:
                # idx_user_sessions_created_date 인덱스 활용
                daily_stats_query = select(
                    func.date(UserSession.created_at).label('date'),
                    func.count(UserSession.id).label('total_sessions'),
                    func.count().filter(UserSession.status == 'completed').label('completed_sessions'),
                    func.avg(UserSession.total_typing_time).label('avg_typing_time'),
                    func.sum(UserSession.total_music_generated).label('total_music_count')
                ).where(
                    and_(
                        UserSession.created_at >= date_from,
                        UserSession.created_at <= date_to
                    )
                ).group_by(func.date(UserSession.created_at)).order_by(func.date(UserSession.created_at))

                result = await session.execute(daily_stats_query)
                daily_stats = []

                for row in result.fetchall():
                    daily_stats.append({
                        'date': row.date.isoformat(),
                        'total_sessions': row.total_sessions,
                        'completed_sessions': row.completed_sessions,
                        'avg_typing_time_seconds': float(row.avg_typing_time or 0),
                        'total_music_count': row.total_music_count or 0
                    })

                return {
                    'period': {
                        'from': date_from.isoformat(),
                        'to': date_to.isoformat()
                    },
                    'daily_statistics': daily_stats
                }

            except Exception as e:
                logger.error(f"일별 통계 조회 실패: {e}")
                return {}


@asynccontextmanager
async def optimized_session():
    """최적화된 세션 컨텍스트 매니저"""
    async with get_async_session() as session:
        try:
            # 세션별 최적화 설정
            await session.execute(text("SET LOCAL work_mem = '32MB'"))
            await session.execute(text("SET LOCAL random_page_cost = 1.1"))
            await session.execute(text("SET LOCAL effective_cache_size = '1GB'"))
            await session.execute(text("SET LOCAL enable_seqscan = false"))  # 인덱스 사용 강제
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()