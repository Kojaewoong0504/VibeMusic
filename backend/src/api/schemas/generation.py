"""
Generation API Schemas - 음악 생성 관련 스키마

음악 생성 요청/응답에 사용되는 Pydantic 모델들을 정의합니다.
"""
from datetime import datetime
from typing import Optional, Dict, Any

from pydantic import BaseModel, Field, validator


class GenerateRequest(BaseModel):
    """음악 생성 요청 모델"""

    text_prompt: str = Field(
        ...,
        description="음악 생성을 위한 텍스트 프롬프트",
        min_length=1,
        max_length=1000
    )

    duration: Optional[int] = Field(
        45,
        description="음악 길이 (초, 15-180초)",
        ge=15,
        le=180
    )

    audio_format: Optional[str] = Field(
        "wav",
        description="오디오 형식"
    )

    use_mock: Optional[bool] = Field(
        False,
        description="테스트용 모의 생성 모드 사용 여부"
    )

    @validator('audio_format')
    def validate_audio_format(cls, v):
        allowed_formats = ['wav', 'mp3', 'flac']
        if v not in allowed_formats:
            raise ValueError(f'audio_format must be one of {allowed_formats}')
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "text_prompt": "차분하고 평화로운 피아노 멜로디",
                "duration": 60,
                "audio_format": "wav",
                "use_mock": False
            }
        }


class EmotionSummary(BaseModel):
    """감정 요약 정보"""

    dominant_emotion: str = Field(..., description="주요 감정")
    emotion_vector: Dict[str, float] = Field(..., description="감정 벡터")
    confidence_score: float = Field(..., description="분석 신뢰도")
    tempo_score: float = Field(..., description="템포 점수")
    rhythm_consistency: float = Field(..., description="리듬 일관성")


class MusicPromptInfo(BaseModel):
    """음악 프롬프트 정보"""

    id: str = Field(..., description="프롬프트 ID")
    original_prompt: str = Field(..., description="원본 텍스트 프롬프트")
    enhanced_prompt: Optional[str] = Field(None, description="감정 기반 향상된 프롬프트")
    duration: int = Field(..., description="음악 길이 (초)")
    audio_format: str = Field(..., description="오디오 형식")


class GenerateResponse(BaseModel):
    """음악 생성 응답 모델"""

    music_id: str = Field(..., description="생성된 음악 ID")
    prompt_info: MusicPromptInfo = Field(..., description="사용된 프롬프트 정보")
    emotion_context: EmotionSummary = Field(..., description="분석된 감정 컨텍스트")
    generation_status: str = Field(..., description="생성 상태 (generating, completed, failed)")
    estimated_completion_time: Optional[datetime] = Field(None, description="예상 완료 시각")
    created_at: datetime = Field(..., description="생성 시작 시각")
    file_url: Optional[str] = Field(None, description="생성된 음악 파일 URL (완료시)")

    class Config:
        json_schema_extra = {
            "example": {
                "music_id": "550e8400-e29b-41d4-a716-446655440000",
                "prompt_info": {
                    "id": "550e8400-e29b-41d4-a716-446655440001",
                    "original_prompt": "차분하고 평화로운 피아노 멜로디",
                    "enhanced_prompt": "gentle focused piano melody with calm energy, peaceful valence",
                    "duration": 60,
                    "audio_format": "wav"
                },
                "emotion_context": {
                    "dominant_emotion": "focused",
                    "emotion_vector": {
                        "energy": 0.72,
                        "valence": 0.65,
                        "tension": 0.38,
                        "focus": 0.85
                    },
                    "confidence_score": 0.89,
                    "tempo_score": 0.75,
                    "rhythm_consistency": 0.82
                },
                "generation_status": "generating",
                "estimated_completion_time": "2025-09-15T12:01:00Z",
                "created_at": "2025-09-15T12:00:00Z",
                "file_url": None
            }
        }