"""
GeneratedMusic 모델 - AI에 의해 생성된 음악 파일과 메타데이터
"""
from datetime import datetime
from typing import Optional, Dict, Any
from enum import Enum

from sqlalchemy import ForeignKey, String, Integer, BigInteger, Numeric, DateTime, Text, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class MusicStatus(str, Enum):
    """음악 생성 상태 열거형"""
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"


class MusicFormat(str, Enum):
    """지원하는 음악 파일 형식"""
    WAV = "wav"
    MP3 = "mp3"
    FLAC = "flac"


class GeneratedMusic(Base):
    """생성된 음악 모델"""

    __tablename__ = "generated_music"

    # 음악 프롬프트 관계 (1:1)
    prompt_id: Mapped[str] = mapped_column(
        ForeignKey("music_prompts.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        comment="연관된 음악 프롬프트 ID"
    )

    # 파일 정보
    file_url: Mapped[Optional[str]] = mapped_column(
        String(512),
        nullable=True,
        comment="음악 파일 URL"
    )

    file_size: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        nullable=True,
        comment="파일 크기 (바이트)"
    )

    duration: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        comment="실제 음악 길이 (초)"
    )

    format: Mapped[Optional[str]] = mapped_column(
        String(10),
        nullable=True,
        comment="파일 형식 (wav, mp3, flac)"
    )

    sample_rate: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        comment="샘플링 레이트 (Hz)"
    )

    # 생성 정보
    generation_time: Mapped[Optional[float]] = mapped_column(
        Numeric(5, 2),
        nullable=True,
        comment="생성 소요 시간 (초)"
    )

    ai_model_version: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        comment="사용된 AI 모델 버전"
    )

    quality_score: Mapped[Optional[float]] = mapped_column(
        Numeric(3, 2),
        nullable=True,
        comment="음질 점수 (0.0-1.0)"
    )

    # 상태 관리
    status: Mapped[str] = mapped_column(
        String(20),
        server_default="generating",
        nullable=False,
        comment="생성 상태"
    )

    error_message: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="실패 시 오류 메시지"
    )

    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="생성 완료 시간"
    )

    # 관계 설정
    music_prompt = relationship(
        "MusicPrompt",
        back_populates="generated_music",
        lazy="selectin"
    )

    # 제약 조건
    __table_args__ = (
        CheckConstraint(
            "status IN ('generating', 'completed', 'failed')",
            name="check_valid_status"
        ),
        CheckConstraint(
            "format IS NULL OR format IN ('wav', 'mp3', 'flac')",
            name="check_valid_format"
        ),
        CheckConstraint(
            "generation_time IS NULL OR generation_time > 0",
            name="check_positive_generation_time"
        ),
        CheckConstraint(
            "quality_score IS NULL OR (quality_score >= 0.0 AND quality_score <= 1.0)",
            name="check_quality_score_range"
        ),
        CheckConstraint(
            "file_size IS NULL OR file_size > 0",
            name="check_positive_file_size"
        ),
        CheckConstraint(
            "duration IS NULL OR duration > 0",
            name="check_positive_duration"
        ),
    )

    def start_generation(self, ai_model_version: str) -> None:
        """음악 생성 시작"""
        self.status = MusicStatus.GENERATING
        self.ai_model_version = ai_model_version
        self.error_message = None
        self.completed_at = None

    def complete_generation(
        self,
        file_url: str,
        file_size: int,
        duration: int,
        format: str,
        sample_rate: int,
        generation_time: float,
        quality_score: Optional[float] = None
    ) -> None:
        """음악 생성 완료"""
        self.status = MusicStatus.COMPLETED
        self.file_url = file_url
        self.file_size = file_size
        self.duration = duration
        self.format = format
        self.sample_rate = sample_rate
        self.generation_time = generation_time
        self.quality_score = quality_score
        self.completed_at = datetime.utcnow()
        self.error_message = None

    def fail_generation(self, error_message: str) -> None:
        """음악 생성 실패"""
        self.status = MusicStatus.FAILED
        self.error_message = error_message
        self.completed_at = datetime.utcnow()

    def is_completed(self) -> bool:
        """생성이 완료되었는지 확인"""
        return self.status == MusicStatus.COMPLETED

    def is_failed(self) -> bool:
        """생성이 실패했는지 확인"""
        return self.status == MusicStatus.FAILED

    def is_generating(self) -> bool:
        """현재 생성 중인지 확인"""
        return self.status == MusicStatus.GENERATING

    def get_file_size_mb(self) -> Optional[float]:
        """파일 크기를 MB 단위로 반환"""
        if self.file_size is None:
            return None
        return round(self.file_size / (1024 * 1024), 2)

    def get_download_info(self) -> Optional[Dict[str, Any]]:
        """다운로드 정보 반환"""
        if not self.is_completed() or not self.file_url:
            return None

        return {
            "url": self.file_url,
            "filename": f"vibemusic_{self.id}.{self.format}",
            "size_bytes": self.file_size,
            "size_mb": self.get_file_size_mb(),
            "duration_seconds": self.duration,
            "format": self.format,
            "sample_rate": self.sample_rate,
            "quality_score": float(self.quality_score) if self.quality_score else None
        }

    def get_generation_metrics(self) -> Dict[str, Any]:
        """생성 성능 메트릭"""
        return {
            "generation_time_seconds": float(self.generation_time) if self.generation_time else None,
            "ai_model_version": self.ai_model_version,
            "status": self.status,
            "quality_score": float(self.quality_score) if self.quality_score else None,
            "started_at": self.created_at.isoformat() if self.created_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "total_time_seconds": (
                (self.completed_at - self.created_at).total_seconds()
                if self.completed_at and self.created_at
                else None
            )
        }

    def validate_completion_data(self) -> bool:
        """완료 상태의 데이터 유효성 검증"""
        if self.status != MusicStatus.COMPLETED:
            return True  # 완료 상태가 아니면 검증 생략

        required_fields = [
            self.file_url,
            self.file_size,
            self.duration,
            self.format,
            self.sample_rate,
            self.generation_time
        ]

        # 필수 필드 확인
        if any(field is None for field in required_fields):
            return False

        # 형식 검증
        if self.format not in [MusicFormat.WAV, MusicFormat.MP3, MusicFormat.FLAC]:
            return False

        # 양수 값 검증
        if any(val <= 0 for val in [self.file_size, self.duration, self.generation_time]):
            return False

        # 샘플링 레이트 범위 검증 (8kHz - 192kHz)
        if not (8000 <= self.sample_rate <= 192000):
            return False

        return True

    def to_dict(self) -> dict:
        """생성된 음악 정보를 딕셔너리로 변환"""
        return {
            "id": self.id,
            "prompt_id": self.prompt_id,
            "status": self.status,
            "file_info": self.get_download_info(),
            "generation_metrics": self.get_generation_metrics(),
            "error_message": self.error_message,
            "is_valid": self.validate_completion_data(),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

    def __repr__(self) -> str:
        status_emoji = {
            MusicStatus.GENERATING: "🔄",
            MusicStatus.COMPLETED: "✅",
            MusicStatus.FAILED: "❌"
        }

        emoji = status_emoji.get(self.status, "❓")
        duration_info = f"{self.duration}s" if self.duration else "unknown"
        format_info = self.format if self.format else "unknown"

        return f"<GeneratedMusic(id={self.id}, {emoji} {self.status}, {duration_info}, {format_info})>"