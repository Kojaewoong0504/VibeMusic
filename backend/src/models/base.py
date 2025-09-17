"""
SQLAlchemy 베이스 모델 및 공통 설정
"""
from datetime import datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """SQLAlchemy 베이스 모델"""
    
    # 테이블 이름 자동 생성
    @declared_attr.directive
    def __tablename__(cls) -> str:
        return cls.__name__.lower()
    
    # 공통 컬럼들
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), 
        primary_key=True, 
        default=lambda: str(uuid4())
    )
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )
    
    def __repr__(self) -> str:
        return f"<{self.__class__.__name__}(id={self.id})>"
    
    def to_dict(self) -> dict[str, Any]:
        """모델을 딕셔너리로 변환"""
        return {
            column.name: getattr(self, column.name)
            for column in self.__table__.columns
        }