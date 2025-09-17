"""
UserSession 모델 - 사용자 세션 관리
"""
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class UserSession(Base):
    """사용자 세션 모델"""

    __tablename__ = "user_sessions"

    # 브라우저 및 네트워크 정보
    user_agent: Mapped[Optional[str]] = mapped_column(
        String(512),
        nullable=True,
        comment="브라우저 User-Agent 정보"
    )

    ip_address_hash: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        comment="해시 처리된 IP 주소 (개인정보 보호)"
    )

    # 세션 인증 및 관리
    session_token: Mapped[str] = mapped_column(
        String(128),
        unique=True,
        nullable=False,
        comment="세션 인증 토큰"
    )

    # 세션 시간 관리
    start_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="세션 시작 시간"
    )

    end_time: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="세션 종료 시간"
    )

    # 세션 상태
    status: Mapped[str] = mapped_column(
        String(20),
        server_default="active",
        nullable=False,
        comment="세션 상태: active, completed, abandoned"
    )

    # 활동 통계
    total_typing_time: Mapped[int] = mapped_column(
        Integer,
        server_default="0",
        nullable=False,
        comment="총 타이핑 시간 (초)"
    )

    total_music_generated: Mapped[int] = mapped_column(
        Integer,
        server_default="0",
        nullable=False,
        comment="생성된 음악 개수"
    )

    # 개인정보 보호
    consent_given: Mapped[bool] = mapped_column(
        Boolean,
        server_default="false",
        nullable=False,
        comment="데이터 수집 동의 여부"
    )

    auto_delete_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="자동 삭제 예정 시간 (24시간 후)"
    )

    # 추가 메타데이터
    session_metadata: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        comment="추가 세션 메타데이터"
    )

    # 관계 설정
    typing_patterns = relationship(
        "TypingPattern",
        back_populates="session",
        cascade="all, delete-orphan",
        lazy="selectin"
    )

    music_prompts = relationship(
        "MusicPrompt",
        back_populates="session",
        cascade="all, delete-orphan",
        lazy="selectin"
    )

    def __init__(self, **kwargs):
        """세션 초기화"""
        super().__init__(**kwargs)

        # 자동 삭제 시간 설정 (24시간 후)
        if not self.auto_delete_at:
            self.auto_delete_at = datetime.utcnow() + timedelta(hours=24)

    def is_active(self) -> bool:
        """세션이 활성 상태인지 확인"""
        return self.status == "active" and self.end_time is None

    def is_expired(self) -> bool:
        """세션이 만료되었는지 확인"""
        if not self.auto_delete_at:
            return False
        return datetime.utcnow() >= self.auto_delete_at

    def complete_session(self) -> None:
        """세션 완료 처리"""
        self.status = "completed"
        self.end_time = datetime.utcnow()

    def abandon_session(self) -> None:
        """세션 중단 처리"""
        self.status = "abandoned"
        self.end_time = datetime.utcnow()

    def update_typing_time(self, additional_seconds: int) -> None:
        """타이핑 시간 업데이트"""
        self.total_typing_time += additional_seconds

    def increment_music_count(self) -> None:
        """생성된 음악 개수 증가"""
        self.total_music_generated += 1

    def to_dict(self) -> dict:
        """세션 정보를 딕셔너리로 변환"""
        return {
            "id": self.id,
            "session_token": self.session_token,
            "status": self.status,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "total_typing_time": self.total_typing_time,
            "total_music_generated": self.total_music_generated,
            "consent_given": self.consent_given,
            "auto_delete_at": self.auto_delete_at.isoformat() if self.auto_delete_at else None,
            "is_active": self.is_active(),
            "is_expired": self.is_expired(),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

    def __repr__(self) -> str:
        return f"<UserSession(id={self.id}, token={self.session_token[:8]}..., status={self.status})>"