"""
EmotionProfile 모델 - 타이핑 패턴에서 추출된 감정 프로필
"""
from typing import Dict, Any, Optional

from sqlalchemy import ForeignKey, Numeric, CheckConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class EmotionProfile(Base):
    """감정 프로필 모델"""

    __tablename__ = "emotion_profiles"

    # 타이핑 패턴 관계 (1:1)
    pattern_id: Mapped[str] = mapped_column(
        ForeignKey("typing_patterns.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        comment="연관된 타이핑 패턴 ID"
    )

    # 타이핑 기반 점수들 (0.0-1.0 범위)
    tempo_score: Mapped[float] = mapped_column(
        Numeric(3, 2),
        nullable=False,
        comment="타이핑 속도 점수 (0.0-1.0)"
    )

    rhythm_consistency: Mapped[float] = mapped_column(
        Numeric(3, 2),
        nullable=False,
        comment="리듬 일관성 (0.0-1.0)"
    )

    pause_intensity: Mapped[float] = mapped_column(
        Numeric(3, 2),
        nullable=False,
        comment="일시정지 강도 (0.0-1.0)"
    )

    # 감정 벡터 (JSON)
    emotion_vector: Mapped[Dict[str, float]] = mapped_column(
        JSONB,
        nullable=False,
        comment="감정 벡터 (energy, valence, tension, focus)"
    )

    # 분석 신뢰도
    confidence_score: Mapped[float] = mapped_column(
        Numeric(3, 2),
        nullable=False,
        comment="분석 신뢰도 (0.0-1.0)"
    )

    # 관계 설정
    typing_pattern = relationship(
        "TypingPattern",
        back_populates="emotion_profile",
        lazy="selectin"
    )

    music_prompts = relationship(
        "MusicPrompt",
        back_populates="emotion_profile",
        lazy="selectin"
    )

    # 제약 조건
    __table_args__ = (
        CheckConstraint(
            "tempo_score >= 0.0 AND tempo_score <= 1.0",
            name="check_tempo_score_range"
        ),
        CheckConstraint(
            "rhythm_consistency >= 0.0 AND rhythm_consistency <= 1.0",
            name="check_rhythm_consistency_range"
        ),
        CheckConstraint(
            "pause_intensity >= 0.0 AND pause_intensity <= 1.0",
            name="check_pause_intensity_range"
        ),
        CheckConstraint(
            "confidence_score >= 0.0 AND confidence_score <= 1.0",
            name="check_confidence_score_range"
        ),
    )

    def validate_emotion_vector(self) -> bool:
        """감정 벡터 유효성 검증"""
        if not self.emotion_vector:
            return False

        required_fields = {'energy', 'valence', 'tension', 'focus'}

        # 필수 필드 확인
        if not all(field in self.emotion_vector for field in required_fields):
            return False

        # 범위 검증
        energy = self.emotion_vector.get('energy', 0)
        valence = self.emotion_vector.get('valence', 0)
        tension = self.emotion_vector.get('tension', 0)
        focus = self.emotion_vector.get('focus', 0)

        # energy, tension, focus: 0.0-1.0
        if not (0.0 <= energy <= 1.0 and 0.0 <= tension <= 1.0 and 0.0 <= focus <= 1.0):
            return False

        # valence: -1.0-1.0
        if not (-1.0 <= valence <= 1.0):
            return False

        return True

    def get_dominant_emotion(self) -> str:
        """주요 감정 분류 반환"""
        if not self.validate_emotion_vector():
            return "unknown"

        energy = self.emotion_vector.get('energy', 0)
        valence = self.emotion_vector.get('valence', 0)
        tension = self.emotion_vector.get('tension', 0)
        focus = self.emotion_vector.get('focus', 0)

        # 감정 분류 로직
        if energy > 0.7 and valence > 0.3:
            return "excited"  # 흥분, 기쁨
        elif energy > 0.7 and valence < -0.3:
            return "angry"    # 화남, 분노
        elif energy < 0.3 and valence > 0.3:
            return "calm"     # 평온, 안정
        elif energy < 0.3 and valence < -0.3:
            return "sad"      # 슬픔, 우울
        elif tension > 0.7:
            return "stressed" # 스트레스, 긴장
        elif focus > 0.8:
            return "focused"  # 집중, 몰입
        elif focus < 0.3:
            return "distracted" # 산만, 주의분산
        else:
            return "neutral"  # 중성, 평범

    def get_music_genre_hints(self) -> list[str]:
        """감정 프로필에 기반한 음악 장르 힌트"""
        dominant_emotion = self.get_dominant_emotion()
        energy = self.emotion_vector.get('energy', 0)
        rhythm_consistency = self.rhythm_consistency

        genre_hints = []

        # 주요 감정별 장르 매핑
        emotion_genres = {
            "excited": ["electronic", "dance", "pop", "upbeat"],
            "angry": ["rock", "metal", "intense", "aggressive"],
            "calm": ["ambient", "classical", "meditation", "peaceful"],
            "sad": ["melancholic", "blues", "slow", "emotional"],
            "stressed": ["chaotic", "experimental", "dissonant"],
            "focused": ["minimal", "repetitive", "steady"],
            "distracted": ["complex", "polyrhythmic", "irregular"],
            "neutral": ["versatile", "balanced", "moderate"]
        }

        genre_hints.extend(emotion_genres.get(dominant_emotion, []))

        # 에너지 레벨별 추가 힌트
        if energy > 0.8:
            genre_hints.extend(["high-energy", "fast"])
        elif energy < 0.2:
            genre_hints.extend(["low-energy", "slow"])

        # 리듬 일관성별 추가 힌트
        if rhythm_consistency > 0.8:
            genre_hints.append("steady-rhythm")
        elif rhythm_consistency < 0.4:
            genre_hints.append("irregular-rhythm")

        return list(set(genre_hints))  # 중복 제거

    def get_tempo_bpm_range(self) -> tuple[int, int]:
        """감정 프로필에 기반한 BPM 범위 추천"""
        energy = self.emotion_vector.get('energy', 0.5)
        tempo = self.tempo_score

        # 기본 BPM 계산
        base_bpm = int(60 + (energy * 80) + (tempo * 40))

        # 감정별 조정
        dominant_emotion = self.get_dominant_emotion()
        adjustments = {
            "excited": 20,
            "angry": 15,
            "calm": -30,
            "sad": -20,
            "stressed": 10,
            "focused": 0,
            "distracted": 5,
            "neutral": 0
        }

        adjusted_bpm = base_bpm + adjustments.get(dominant_emotion, 0)

        # 범위 설정 (±10 BPM)
        min_bpm = max(60, adjusted_bpm - 10)
        max_bpm = min(180, adjusted_bpm + 10)

        return (min_bpm, max_bpm)

    def is_reliable(self) -> bool:
        """분석 결과가 신뢰할 만한지 확인"""
        return self.confidence_score >= 0.3

    def get_warning_message(self) -> Optional[str]:
        """낮은 신뢰도일 때 경고 메시지"""
        if self.confidence_score < 0.3:
            return f"분석 신뢰도가 낮습니다 ({self.confidence_score:.1%}). 더 많은 타이핑 데이터가 필요할 수 있습니다."
        return None

    def to_dict(self) -> dict:
        """감정 프로필 정보를 딕셔너리로 변환"""
        return {
            "id": self.id,
            "pattern_id": self.pattern_id,
            "tempo_score": float(self.tempo_score),
            "rhythm_consistency": float(self.rhythm_consistency),
            "pause_intensity": float(self.pause_intensity),
            "emotion_vector": self.emotion_vector,
            "confidence_score": float(self.confidence_score),
            "dominant_emotion": self.get_dominant_emotion(),
            "music_genre_hints": self.get_music_genre_hints(),
            "tempo_bpm_range": self.get_tempo_bpm_range(),
            "is_reliable": self.is_reliable(),
            "warning_message": self.get_warning_message(),
            "is_valid": self.validate_emotion_vector(),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

    def __repr__(self) -> str:
        emotion = self.get_dominant_emotion()
        confidence = self.confidence_score
        energy = self.emotion_vector.get('energy', 0) if self.emotion_vector else 0

        return f"<EmotionProfile(id={self.id}, emotion={emotion}, energy={energy:.2f}, confidence={confidence:.2f})>"