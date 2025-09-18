"""
SessionService - 사용자 세션 CRUD 서비스

이 서비스는 UserSession 모델에 대한 비즈니스 로직과 데이터베이스 작업을 처리합니다.
"""
import secrets
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from sqlalchemy import select, delete, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from src.models.user_session import UserSession
from src.database.connection import get_async_session


class SessionService:
    """사용자 세션 관리 서비스"""

    def __init__(self, db_session: Optional[AsyncSession] = None):
        """
        세션 서비스 초기화

        Args:
            db_session: 데이터베이스 세션 (의존성 주입용)
        """
        self.db_session = db_session

    async def create_session(
        self,
        user_agent: Optional[str] = None,
        ip_address: Optional[str] = None,
        consent_given: bool = False,
        prompt: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> UserSession:
        """
        새로운 사용자 세션 생성

        Args:
            user_agent: 브라우저 User-Agent
            ip_address: 사용자 IP 주소 (해시 처리됨)
            consent_given: 데이터 수집 동의 여부
            prompt: 초기 텍스트 프롬프트 (음악 생성용)
            metadata: 추가 메타데이터

        Returns:
            생성된 UserSession 객체
        """
        # 세션 토큰 생성 (암호화적으로 안전한 랜덤 문자열)
        session_token = self._generate_session_token()

        # IP 주소 해시 처리 (개인정보 보호)
        ip_hash = self._hash_ip_address(ip_address) if ip_address else None

        # 메타데이터 구성 (prompt 포함)
        session_metadata = metadata or {}
        if prompt:
            session_metadata["initial_prompt"] = prompt

        # 새 세션 객체 생성
        new_session = UserSession(
            session_token=session_token,
            user_agent=user_agent,
            ip_address_hash=ip_hash,
            consent_given=consent_given,
            session_metadata=session_metadata
        )

        # 데이터베이스에 저장
        if self.db_session:
            session = self.db_session
        else:
            async with get_async_session() as session:
                session.add(new_session)
                await session.commit()
                await session.refresh(new_session)
                return new_session

        session.add(new_session)
        await session.commit()
        await session.refresh(new_session)
        return new_session

    async def get_session_by_id(self, session_id: str) -> Optional[UserSession]:
        """
        ID로 세션 조회

        Args:
            session_id: 세션 ID

        Returns:
            UserSession 객체 또는 None
        """
        if self.db_session:
            session = self.db_session
        else:
            async with get_async_session() as session:
                result = await session.execute(
                    select(UserSession).where(UserSession.id == session_id)
                )
                return result.scalar_one_or_none()

        result = await session.execute(
            select(UserSession).where(UserSession.id == session_id)
        )
        return result.scalar_one_or_none()

    async def get_session_by_token(self, session_token: str) -> Optional[UserSession]:
        """
        토큰으로 세션 조회

        Args:
            session_token: 세션 토큰

        Returns:
            UserSession 객체 또는 None
        """
        if self.db_session:
            session = self.db_session
        else:
            async with get_async_session() as session:
                result = await session.execute(
                    select(UserSession).where(UserSession.session_token == session_token)
                )
                return result.scalar_one_or_none()

        result = await session.execute(
            select(UserSession).where(UserSession.session_token == session_token)
        )
        return result.scalar_one_or_none()

    async def get_active_sessions(
        self,
        limit: int = 100,
        offset: int = 0
    ) -> List[UserSession]:
        """
        활성 세션 목록 조회

        Args:
            limit: 최대 반환 개수
            offset: 시작 위치

        Returns:
            활성 세션 리스트
        """
        if self.db_session:
            session = self.db_session
        else:
            async with get_async_session() as session:
                result = await session.execute(
                    select(UserSession)
                    .where(
                        and_(
                            UserSession.status == "active",
                            UserSession.end_time.is_(None),
                            or_(
                                UserSession.auto_delete_at.is_(None),
                                UserSession.auto_delete_at > datetime.utcnow()
                            )
                        )
                    )
                    .order_by(UserSession.created_at.desc())
                    .limit(limit)
                    .offset(offset)
                )
                return result.scalars().all()

        result = await session.execute(
            select(UserSession)
            .where(
                and_(
                    UserSession.status == "active",
                    UserSession.end_time.is_(None),
                    or_(
                        UserSession.auto_delete_at.is_(None),
                        UserSession.auto_delete_at > datetime.utcnow()
                    )
                )
            )
            .order_by(UserSession.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return result.scalars().all()

    async def update_session_activity(
        self,
        session_id: str,
        typing_time_seconds: int = 0,
        music_generated: bool = False
    ) -> Optional[UserSession]:
        """
        세션 활동 정보 업데이트

        Args:
            session_id: 세션 ID
            typing_time_seconds: 추가 타이핑 시간 (초)
            music_generated: 음악이 생성되었는지 여부

        Returns:
            업데이트된 UserSession 객체 또는 None
        """
        user_session = await self.get_session_by_id(session_id)
        if not user_session:
            return None

        # 활동 정보 업데이트
        if typing_time_seconds > 0:
            user_session.update_typing_time(typing_time_seconds)

        if music_generated:
            user_session.increment_music_count()

        # 데이터베이스 저장
        if self.db_session:
            session = self.db_session
        else:
            async with get_async_session() as session:
                session.add(user_session)
                await session.commit()
                await session.refresh(user_session)
                return user_session

        session.add(user_session)
        await session.commit()
        await session.refresh(user_session)
        return user_session

    async def complete_session(self, session_id: str) -> Optional[UserSession]:
        """
        세션 완료 처리

        Args:
            session_id: 세션 ID

        Returns:
            완료된 UserSession 객체 또는 None
        """
        user_session = await self.get_session_by_id(session_id)
        if not user_session:
            return None

        # 세션 완료 처리
        user_session.complete_session()

        # 데이터베이스 저장
        if self.db_session:
            session = self.db_session
        else:
            async with get_async_session() as session:
                session.add(user_session)
                await session.commit()
                await session.refresh(user_session)
                return user_session

        session.add(user_session)
        await session.commit()
        await session.refresh(user_session)
        return user_session

    async def abandon_session(self, session_id: str) -> Optional[UserSession]:
        """
        세션 중단 처리

        Args:
            session_id: 세션 ID

        Returns:
            중단된 UserSession 객체 또는 None
        """
        user_session = await self.get_session_by_id(session_id)
        if not user_session:
            return None

        # 세션 중단 처리
        user_session.abandon_session()

        # 데이터베이스 저장
        if self.db_session:
            session = self.db_session
        else:
            async with get_async_session() as session:
                session.add(user_session)
                await session.commit()
                await session.refresh(user_session)
                return user_session

        session.add(user_session)
        await session.commit()
        await session.refresh(user_session)
        return user_session

    async def delete_expired_sessions(self) -> int:
        """
        만료된 세션들 삭제

        Returns:
            삭제된 세션 개수
        """
        current_time = datetime.utcnow()

        if self.db_session:
            session = self.db_session
        else:
            async with get_async_session() as session:
                # 만료된 세션 조회
                result = await session.execute(
                    select(UserSession).where(
                        and_(
                            UserSession.auto_delete_at.is_not(None),
                            UserSession.auto_delete_at <= current_time
                        )
                    )
                )
                expired_sessions = result.scalars().all()

                # 만료된 세션 삭제
                if expired_sessions:
                    await session.execute(
                        delete(UserSession).where(
                            and_(
                                UserSession.auto_delete_at.is_not(None),
                                UserSession.auto_delete_at <= current_time
                            )
                        )
                    )
                    await session.commit()

                return len(expired_sessions)

        # 만료된 세션 조회
        result = await session.execute(
            select(UserSession).where(
                and_(
                    UserSession.auto_delete_at.is_not(None),
                    UserSession.auto_delete_at <= current_time
                )
            )
        )
        expired_sessions = result.scalars().all()

        # 만료된 세션 삭제
        if expired_sessions:
            await session.execute(
                delete(UserSession).where(
                    and_(
                        UserSession.auto_delete_at.is_not(None),
                        UserSession.auto_delete_at <= current_time
                    )
                )
            )
            await session.commit()

        return len(expired_sessions)

    async def get_session_statistics(self) -> Dict[str, Any]:
        """
        세션 통계 정보 조회

        Returns:
            세션 통계 딕셔너리
        """
        if self.db_session:
            session = self.db_session
        else:
            async with get_async_session() as session:
                # 전체 세션 수
                total_result = await session.execute(select(UserSession))
                total_sessions = len(total_result.scalars().all())

                # 활성 세션 수
                active_result = await session.execute(
                    select(UserSession).where(UserSession.status == "active")
                )
                active_sessions = len(active_result.scalars().all())

                # 완료된 세션 수
                completed_result = await session.execute(
                    select(UserSession).where(UserSession.status == "completed")
                )
                completed_sessions = len(completed_result.scalars().all())

                # 중단된 세션 수
                abandoned_result = await session.execute(
                    select(UserSession).where(UserSession.status == "abandoned")
                )
                abandoned_sessions = len(abandoned_result.scalars().all())

                return {
                    "total_sessions": total_sessions,
                    "active_sessions": active_sessions,
                    "completed_sessions": completed_sessions,
                    "abandoned_sessions": abandoned_sessions,
                    "completion_rate": (
                        completed_sessions / total_sessions * 100
                        if total_sessions > 0 else 0
                    )
                }

        # 전체 세션 수
        total_result = await session.execute(select(UserSession))
        total_sessions = len(total_result.scalars().all())

        # 활성 세션 수
        active_result = await session.execute(
            select(UserSession).where(UserSession.status == "active")
        )
        active_sessions = len(active_result.scalars().all())

        # 완료된 세션 수
        completed_result = await session.execute(
            select(UserSession).where(UserSession.status == "completed")
        )
        completed_sessions = len(completed_result.scalars().all())

        # 중단된 세션 수
        abandoned_result = await session.execute(
            select(UserSession).where(UserSession.status == "abandoned")
        )
        abandoned_sessions = len(abandoned_result.scalars().all())

        return {
            "total_sessions": total_sessions,
            "active_sessions": active_sessions,
            "completed_sessions": completed_sessions,
            "abandoned_sessions": abandoned_sessions,
            "completion_rate": (
                completed_sessions / total_sessions * 100
                if total_sessions > 0 else 0
            )
        }

    async def extend_session_lifetime(
        self,
        session_id: str,
        additional_hours: int = 24
    ) -> Optional[UserSession]:
        """
        세션 생명주기 연장

        Args:
            session_id: 세션 ID
            additional_hours: 추가 연장 시간 (시간)

        Returns:
            업데이트된 UserSession 객체 또는 None
        """
        user_session = await self.get_session_by_id(session_id)
        if not user_session:
            return None

        # 자동 삭제 시간 연장
        if user_session.auto_delete_at:
            user_session.auto_delete_at += timedelta(hours=additional_hours)
        else:
            user_session.auto_delete_at = datetime.utcnow() + timedelta(hours=additional_hours)

        # 데이터베이스 저장
        if self.db_session:
            session = self.db_session
        else:
            async with get_async_session() as session:
                session.add(user_session)
                await session.commit()
                await session.refresh(user_session)
                return user_session

        session.add(user_session)
        await session.commit()
        await session.refresh(user_session)
        return user_session

    def _generate_session_token(self, length: int = 32) -> str:
        """
        안전한 세션 토큰 생성

        Args:
            length: 토큰 길이

        Returns:
            생성된 토큰 문자열
        """
        return secrets.token_urlsafe(length)

    def _hash_ip_address(self, ip_address: str) -> str:
        """
        IP 주소 해시 처리 (개인정보 보호)

        Args:
            ip_address: 원본 IP 주소

        Returns:
            해시 처리된 IP 주소
        """
        import hashlib

        # 솔트 추가 (환경별로 다르게 설정 가능)
        salt = "vibemusic_session_salt"

        # SHA-256 해시
        hasher = hashlib.sha256()
        hasher.update((ip_address + salt).encode('utf-8'))

        return hasher.hexdigest()

    async def validate_session(self, session_token: str) -> Optional[UserSession]:
        """
        세션 토큰 유효성 검증

        Args:
            session_token: 검증할 세션 토큰

        Returns:
            유효한 UserSession 객체 또는 None
        """
        user_session = await self.get_session_by_token(session_token)

        if not user_session:
            return None

        # 세션이 만료되었는지 확인
        if user_session.is_expired():
            return None

        # 세션이 활성 상태인지 확인
        if not user_session.is_active():
            return None

        return user_session