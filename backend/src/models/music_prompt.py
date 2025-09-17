"""
MusicPrompt 모델 - 텍스트 프롬프트와 감정 메타데이터를 결합한 음악 생성 입력
"""
from typing import Dict, Any, Optional, List

from sqlalchemy import ForeignKey, Text, CheckConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class MusicPrompt(Base):
    """음악 프롬프트 모델"""

    __tablename__ = "music_prompts"

    # 세션 관계
    session_id: Mapped[str] = mapped_column(
        ForeignKey("user_sessions.id", ondelete="CASCADE"),
        nullable=False,
        comment="연관된 사용자 세션 ID"
    )

    # 감정 프로필 관계 (1:1)
    emotion_profile_id: Mapped[str] = mapped_column(
        ForeignKey("emotion_profiles.id"),
        nullable=False,
        comment="연관된 감정 프로필 ID"
    )

    # 텍스트 프롬프트
    text_prompt: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="사용자가 입력한 텍스트"
    )

    # 감정 데이터가 추가된 최종 프롬프트
    enhanced_prompt: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="감정 데이터가 추가된 최종 프롬프트"
    )

    # 음악 생성 파라미터
    generation_parameters: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=True,
        comment="음악 생성 파라미터"
    )

    # 관계 설정
    session = relationship(
        "UserSession",
        back_populates="music_prompts",
        lazy="selectin"
    )

    emotion_profile = relationship(
        "EmotionProfile",
        back_populates="music_prompts",
        lazy="selectin"
    )

    generated_music = relationship(
        "GeneratedMusic",
        back_populates="music_prompt",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="selectin"
    )

    # 제약 조건
    __table_args__ = (
        CheckConstraint(
            "length(text_prompt) >= 10 AND length(text_prompt) <= 500",
            name="check_text_prompt_length"
        ),
    )

    def validate_generation_parameters(self) -> bool:
        """생성 파라미터 유효성 검증"""
        if not self.generation_parameters:
            return True  # 파라미터가 없어도 유효 (기본값 사용)

        params = self.generation_parameters

        # duration 검증 (15-120초)
        if 'duration' in params:
            duration = params['duration']
            if not isinstance(duration, (int, float)) or not (15 <= duration <= 120):
                return False

        # tempo_bpm 검증 (60-180 BPM)
        if 'tempo_bpm' in params:
            bpm = params['tempo_bpm']
            if not isinstance(bpm, (int, float)) or not (60 <= bpm <= 180):
                return False

        # genre_hint 검증
        if 'genre_hint' in params:
            genre = params['genre_hint']
            if not isinstance(genre, str) or len(genre.strip()) == 0:
                return False

        # mood_tags 검증
        if 'mood_tags' in params:
            tags = params['mood_tags']
            if not isinstance(tags, list):
                return False
            if len(tags) > 10:  # 최대 10개 태그
                return False
            if not all(isinstance(tag, str) for tag in tags):
                return False

        return True

    def create_enhanced_prompt(self) -> str:
        """감정 프로필을 기반으로 향상된 프롬프트 생성"""
        if not self.emotion_profile:
            return self.text_prompt

        # 기본 텍스트
        enhanced = self.text_prompt

        # 감정 정보 추가
        emotion = self.emotion_profile.get_dominant_emotion()
        genre_hints = self.emotion_profile.get_music_genre_hints()
        tempo_range = self.emotion_profile.get_tempo_bpm_range()

        # 감정 기반 형용사 추가
        emotion_descriptors = {
            "excited": "energetic and uplifting",
            "angry": "intense and powerful",
            "calm": "peaceful and serene",
            "sad": "melancholic and emotional",
            "stressed": "tense and chaotic",
            "focused": "steady and concentrated",
            "distracted": "complex and varied",
            "neutral": "balanced and versatile"
        }

        descriptor = emotion_descriptors.get(emotion, "expressive")

        # 프롬프트 향상
        enhanced += f". Create {descriptor} music"

        # 장르 힌트 추가
        if genre_hints:
            genres = ", ".join(genre_hints[:3])  # 상위 3개만 사용
            enhanced += f" with {genres} influences"

        # 템포 정보 추가
        min_bpm, max_bpm = tempo_range
        if min_bpm == max_bpm:
            enhanced += f" at {min_bpm} BPM"
        else:
            enhanced += f" with tempo between {min_bpm}-{max_bpm} BPM"

        # 감정 벡터 정보 추가
        emotion_vector = self.emotion_profile.emotion_vector
        if emotion_vector:
            energy = emotion_vector.get('energy', 0)
            tension = emotion_vector.get('tension', 0)

            if energy > 0.7:
                enhanced += ". High energy and dynamic"
            elif energy < 0.3:
                enhanced += ". Low energy and gentle"

            if tension > 0.7:
                enhanced += ". Include tension and suspense"
            elif tension < 0.3:
                enhanced += ". Relaxed and flowing"

        return enhanced

    def set_default_parameters(self) -> None:
        """기본 생성 파라미터 설정"""
        if not self.emotion_profile:
            return

        # 감정 프로필에서 파라미터 추출
        genre_hints = self.emotion_profile.get_music_genre_hints()
        tempo_range = self.emotion_profile.get_tempo_bpm_range()
        emotion = self.emotion_profile.get_dominant_emotion()

        # 기본 duration 설정 (감정에 따라)
        duration_mapping = {
            "excited": 45,
            "angry": 40,
            "calm": 60,
            "sad": 50,
            "stressed": 35,
            "focused": 55,
            "distracted": 40,
            "neutral": 45
        }

        default_duration = duration_mapping.get(emotion, 45)

        self.generation_parameters = {
            "duration": default_duration,
            "genre_hint": genre_hints[0] if genre_hints else "versatile",
            "tempo_bpm": (tempo_range[0] + tempo_range[1]) // 2,
            "mood_tags": genre_hints[:5],  # 상위 5개 장르를 무드 태그로 사용
            "emotion_influence": {
                "dominant_emotion": emotion,
                "energy_level": self.emotion_profile.emotion_vector.get('energy', 0.5),
                "tension_level": self.emotion_profile.emotion_vector.get('tension', 0.5)
            }
        }

    def get_generation_summary(self) -> Dict[str, Any]:
        """음악 생성 요약 정보"""
        params = self.generation_parameters or {}

        return {
            "text_preview": self.text_prompt[:50] + "..." if len(self.text_prompt) > 50 else self.text_prompt,
            "enhanced_preview": (self.enhanced_prompt[:100] + "..."
                                if self.enhanced_prompt and len(self.enhanced_prompt) > 100
                                else self.enhanced_prompt),
            "duration": params.get('duration', 45),
            "genre": params.get('genre_hint', 'unknown'),
            "tempo_bpm": params.get('tempo_bpm', 120),
            "mood_tags": params.get('mood_tags', []),
            "emotion_context": {
                "dominant_emotion": self.emotion_profile.get_dominant_emotion() if self.emotion_profile else "unknown",
                "confidence": float(self.emotion_profile.confidence_score) if self.emotion_profile else 0.0
            }
        }

    def to_dict(self) -> dict:
        """음악 프롬프트 정보를 딕셔너리로 변환"""
        return {
            "id": self.id,
            "session_id": self.session_id,
            "emotion_profile_id": self.emotion_profile_id,
            "text_prompt": self.text_prompt,
            "enhanced_prompt": self.enhanced_prompt,
            "generation_parameters": self.generation_parameters,
            "generation_summary": self.get_generation_summary(),
            "is_valid": self.validate_generation_parameters(),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

    def __repr__(self) -> str:
        text_preview = (self.text_prompt[:30] + "..."
                       if len(self.text_prompt) > 30
                       else self.text_prompt)

        emotion = (self.emotion_profile.get_dominant_emotion()
                  if self.emotion_profile
                  else "unknown")

        return f"<MusicPrompt(id={self.id}, text='{text_preview}', emotion={emotion})>"