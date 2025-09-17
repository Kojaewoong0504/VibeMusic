"""
세션 인증 미들웨어

사용자 세션 토큰 검증 및 인증 처리를 담당하는 미들웨어입니다.
세션 토큰의 유효성 검사, 만료 확인, 권한 검증을 수행합니다.
"""
import logging
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from fastapi import Request, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.database.connection import get_async_session
from src.models.user_session import UserSession
from src.config import settings

logger = logging.getLogger(__name__)

# HTTP Bearer 토큰 스키마
security = HTTPBearer(auto_error=False)


class SessionAuthError(Exception):
    """세션 인증 관련 오류"""
    def __init__(self, message: str, error_code: str = "AUTH_ERROR"):
        super().__init__(message)
        self.error_code = error_code


class SessionAuthService:
    """세션 인증 서비스"""

    def __init__(self):
        self.token_length = 32
        self.session_duration_hours = 24
        self.max_sessions_per_ip = 10

    def generate_session_token(self) -> str:
        """안전한 세션 토큰 생성"""
        return secrets.token_urlsafe(self.token_length)

    def hash_ip_address(self, ip_address: str) -> str:
        """IP 주소 해시 처리 (개인정보 보호)"""
        # 소금(salt) 추가하여 무작위 해싱
        salted_ip = f"{ip_address}:{settings.SECRET_KEY}"
        return hashlib.sha256(salted_ip.encode()).hexdigest()

    def extract_client_info(self, request: Request) -> Dict[str, Any]:
        """클라이언트 정보 추출"""
        # 실제 IP 주소 추출 (프록시 고려)
        client_ip = request.headers.get("X-Forwarded-For")
        if client_ip:
            # 첫 번째 IP만 사용 (프록시 체인에서)
            client_ip = client_ip.split(',')[0].strip()
        else:
            client_ip = request.client.host if request.client else "unknown"

        user_agent = request.headers.get("User-Agent", "unknown")

        return {
            "ip_address": client_ip,
            "ip_address_hash": self.hash_ip_address(client_ip),
            "user_agent": user_agent[:512]  # 길이 제한
        }

    async def create_session(
        self,
        request: Request,
        db: AsyncSession
    ) -> UserSession:
        """새 세션 생성"""
        try:
            client_info = self.extract_client_info(request)

            # IP별 세션 수 제한 확인
            existing_sessions_count = await self._count_active_sessions_by_ip(
                client_info["ip_address_hash"], db
            )

            if existing_sessions_count >= self.max_sessions_per_ip:
                # 가장 오래된 세션 정리
                await self._cleanup_oldest_sessions_for_ip(
                    client_info["ip_address_hash"], db
                )

            # 새 세션 생성
            session_token = self.generate_session_token()
            start_time = datetime.utcnow()

            new_session = UserSession(
                session_token=session_token,
                ip_address_hash=client_info["ip_address_hash"],
                user_agent=client_info["user_agent"],
                start_time=start_time,
                is_active=True
            )

            db.add(new_session)
            await db.commit()
            await db.refresh(new_session)

            logger.info(
                f"새 세션 생성: session_id={new_session.id}, "
                f"ip_hash={client_info['ip_address_hash'][:8]}..."
            )

            return new_session

        except Exception as e:
            await db.rollback()
            logger.error(f"세션 생성 실패: {str(e)}")
            raise SessionAuthError(f"세션 생성 실패: {str(e)}")

    async def get_session_by_token(
        self,
        token: str,
        db: AsyncSession
    ) -> Optional[UserSession]:
        """토큰으로 세션 조회"""
        try:
            stmt = select(UserSession).where(
                UserSession.session_token == token,
                UserSession.is_active == True
            )

            result = await db.execute(stmt)
            session = result.scalar_one_or_none()

            if not session:
                return None

            # 세션 만료 확인
            if self._is_session_expired(session):
                logger.info(f"만료된 세션: {session.id}")
                await self._deactivate_session(session, db)
                return None

            # 세션 활동 시간 업데이트
            session.last_activity = datetime.utcnow()
            await db.commit()

            return session

        except Exception as e:
            logger.error(f"세션 조회 실패: {str(e)}")
            return None

    def _is_session_expired(self, session: UserSession) -> bool:
        """세션 만료 여부 확인"""
        if not session.start_time:
            return True

        expiry_time = session.start_time + timedelta(hours=self.session_duration_hours)
        return datetime.utcnow() > expiry_time

    async def _deactivate_session(self, session: UserSession, db: AsyncSession) -> None:
        """세션 비활성화"""
        try:
            session.is_active = False
            session.end_time = datetime.utcnow()
            await db.commit()

            logger.info(f"세션 비활성화: {session.id}")

        except Exception as e:
            logger.error(f"세션 비활성화 실패: {str(e)}")

    async def _count_active_sessions_by_ip(
        self,
        ip_hash: str,
        db: AsyncSession
    ) -> int:
        """IP별 활성 세션 수 조회"""
        stmt = select(UserSession).where(
            UserSession.ip_address_hash == ip_hash,
            UserSession.is_active == True
        )

        result = await db.execute(stmt)
        sessions = result.scalars().all()

        # 만료된 세션 정리
        active_count = 0
        for session in sessions:
            if self._is_session_expired(session):
                await self._deactivate_session(session, db)
            else:
                active_count += 1

        return active_count

    async def _cleanup_oldest_sessions_for_ip(
        self,
        ip_hash: str,
        db: AsyncSession
    ) -> None:
        """IP별 가장 오래된 세션 정리"""
        stmt = select(UserSession).where(
            UserSession.ip_address_hash == ip_hash,
            UserSession.is_active == True
        ).order_by(UserSession.start_time.asc()).limit(1)

        result = await db.execute(stmt)
        oldest_session = result.scalar_one_or_none()

        if oldest_session:
            await self._deactivate_session(oldest_session, db)
            logger.info(f"오래된 세션 정리: {oldest_session.id}")

    async def validate_session_token(
        self,
        token: str,
        request: Request,
        db: AsyncSession
    ) -> UserSession:
        """세션 토큰 유효성 검사"""
        if not token:
            raise SessionAuthError("세션 토큰이 없습니다", "NO_TOKEN")

        session = await self.get_session_by_token(token, db)
        if not session:
            raise SessionAuthError("유효하지 않은 세션입니다", "INVALID_SESSION")

        # 추가 보안 검사
        client_info = self.extract_client_info(request)

        # IP 주소 변경 확인 (선택적 - 엄격한 보안)
        if settings.ENVIRONMENT == "production":
            if session.ip_address_hash != client_info["ip_address_hash"]:
                logger.warning(
                    f"세션 IP 변경 감지: session_id={session.id}, "
                    f"original={session.ip_address_hash[:8]}..., "
                    f"current={client_info['ip_address_hash'][:8]}..."
                )
                # 프로덕션에서는 IP 변경 시 세션 무효화
                await self._deactivate_session(session, db)
                raise SessionAuthError("세션 보안 검증 실패", "SECURITY_VIOLATION")

        return session

    async def logout_session(self, session: UserSession, db: AsyncSession) -> bool:
        """세션 로그아웃"""
        try:
            await self._deactivate_session(session, db)
            logger.info(f"세션 로그아웃: {session.id}")
            return True

        except Exception as e:
            logger.error(f"세션 로그아웃 실패: {str(e)}")
            return False

    async def cleanup_expired_sessions(self, db: AsyncSession) -> Dict[str, Any]:
        """만료된 세션 정리"""
        try:
            cleanup_stats = {
                "cleaned_sessions": 0,
                "errors": 0
            }

            # 활성 상태지만 만료된 세션들 조회
            stmt = select(UserSession).where(UserSession.is_active == True)
            result = await db.execute(stmt)
            active_sessions = result.scalars().all()

            for session in active_sessions:
                try:
                    if self._is_session_expired(session):
                        await self._deactivate_session(session, db)
                        cleanup_stats["cleaned_sessions"] += 1

                except Exception as e:
                    cleanup_stats["errors"] += 1
                    logger.error(f"세션 정리 실패: {session.id}, {str(e)}")

            logger.info(
                f"세션 정리 완료: {cleanup_stats['cleaned_sessions']}개 정리, "
                f"{cleanup_stats['errors']}개 오류"
            )

            return cleanup_stats

        except Exception as e:
            logger.error(f"세션 정리 중 오류: {str(e)}")
            return {"cleaned_sessions": 0, "errors": 1, "error": str(e)}


# 전역 인증 서비스 인스턴스
auth_service = SessionAuthService()


async def get_current_session(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_async_session)
) -> UserSession:
    """
    현재 세션 가져오기 (의존성 주입용)

    Authorization: Bearer <session_token> 헤더에서 토큰을 추출하여 검증합니다.
    """
    try:
        if not credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="인증 토큰이 필요합니다",
                headers={"WWW-Authenticate": "Bearer"}
            )

        session = await auth_service.validate_session_token(
            credentials.credentials, request, db
        )

        return session

    except SessionAuthError as e:
        logger.warning(f"인증 실패: {e.error_code} - {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"}
        )

    except Exception as e:
        logger.error(f"인증 중 예상치 못한 오류: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="인증 처리 중 오류가 발생했습니다"
        )


async def get_optional_session(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_async_session)
) -> Optional[UserSession]:
    """
    선택적 세션 가져오기 (토큰이 없어도 오류 발생하지 않음)
    """
    try:
        if not credentials:
            return None

        session = await auth_service.validate_session_token(
            credentials.credentials, request, db
        )

        return session

    except SessionAuthError:
        # 선택적 인증에서는 오류를 무시하고 None 반환
        return None

    except Exception as e:
        logger.error(f"선택적 인증 중 오류: {str(e)}")
        return None


async def get_session_from_token(
    token: str,
    db: AsyncSession
) -> Optional[UserSession]:
    """
    토큰으로 세션 직접 조회 (WebSocket 등에서 사용)
    """
    try:
        return await auth_service.get_session_by_token(token, db)

    except Exception as e:
        logger.error(f"토큰 세션 조회 실패: {str(e)}")
        return None


def get_auth_service() -> SessionAuthService:
    """인증 서비스 인스턴스 반환"""
    return auth_service