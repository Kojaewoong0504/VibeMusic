"""
PostgreSQL 데이터베이스 연결 및 세션 관리

VibeMusic 서비스를 위한 데이터베이스 연결, 세션 관리, 트랜잭션 처리
- 비동기 PostgreSQL 연결 (AsyncSession)
- 동기 연결 (마이그레이션용)
- 연결 풀 관리
- 헬스 체크 및 에러 처리
"""
import logging
from typing import AsyncGenerator, Optional

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from src.config import settings

logger = logging.getLogger(__name__)


# 비동기 엔진 생성
async_engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DATABASE_ECHO,
    future=True,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20
)

# 동기 엔진 (마이그레이션용)
sync_engine = create_engine(
    settings.database_url_sync,
    echo=settings.DATABASE_ECHO,
    future=True,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20
)

# 비동기 세션 팩토리
AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# 동기 세션 팩토리 (마이그레이션용)
SessionLocal = sessionmaker(
    bind=sync_engine,
    autocommit=False,
    autoflush=False
)


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """
    비동기 데이터베이스 세션 의존성
    FastAPI dependency로 사용
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


def get_sync_session():
    """
    동기 데이터베이스 세션 (마이그레이션용)
    """
    session = SessionLocal()
    try:
        return session
    finally:
        session.close()


async def init_db() -> None:
    """
    데이터베이스 초기화
    애플리케이션 시작 시 호출
    """
    # 임포트는 여기서 해야 circular import 방지
    from src.models import (
        Base,
        UserSession,
        TypingPattern,
        EmotionProfile,
        MusicPrompt,
        GeneratedMusic
    )

    # 모든 테이블 생성 (개발용 - 프로덕션에서는 마이그레이션 사용)
    if settings.ENVIRONMENT == "development":
        async with async_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)


async def close_db() -> None:
    """
    데이터베이스 연결 종료
    애플리케이션 종료 시 호출
    """
    try:
        await async_engine.dispose()
        logger.info("데이터베이스 연결 종료됨")
    except Exception as e:
        logger.error("데이터베이스 연결 종료 중 오류: %s", str(e))


async def check_db_health() -> bool:
    """
    데이터베이스 연결 상태 확인
    헬스 체크용
    """
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
            return True
    except SQLAlchemyError as e:
        logger.error("데이터베이스 헬스 체크 실패: %s", str(e))
        return False
    except Exception as e:
        logger.error("데이터베이스 헬스 체크 중 예상치 못한 오류: %s", str(e))
        return False


async def create_database_if_not_exists() -> bool:
    """
    데이터베이스가 존재하지 않으면 생성
    개발 환경에서만 사용
    """
    if settings.ENVIRONMENT != "development":
        logger.warning("프로덕션 환경에서 데이터베이스 자동 생성 요청 거부")
        return False

    try:
        # 데이터베이스 이름 추출
        import urllib.parse
        parsed = urllib.parse.urlparse(settings.DATABASE_URL)
        db_name = parsed.path.lstrip('/')

        # postgres 데이터베이스에 연결하여 대상 데이터베이스 생성
        admin_url = settings.DATABASE_URL.replace(f'/{db_name}', '/postgres')
        admin_engine = create_async_engine(admin_url, isolation_level="AUTOCOMMIT")

        async with admin_engine.begin() as conn:
            # 데이터베이스 존재 여부 확인
            result = await conn.execute(
                text(f"SELECT 1 FROM pg_database WHERE datname = '{db_name}'")
            )

            if not result.fetchone():
                # 데이터베이스 생성
                await conn.execute(text(f"CREATE DATABASE {db_name}"))
                logger.info("데이터베이스 '%s' 생성됨", db_name)
            else:
                logger.info("데이터베이스 '%s' 이미 존재함", db_name)

        await admin_engine.dispose()
        return True

    except Exception as e:
        logger.error("데이터베이스 생성 실패: %s", str(e))
        return False