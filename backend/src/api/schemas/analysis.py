"""
Analysis API Schemas - 타이핑 패턴 분석 관련 스키마

타이핑 패턴 분석 요청/응답에 사용되는 Pydantic 모델들을 정의합니다.
"""
from datetime import datetime
from typing import List, Optional, Dict, Any

from pydantic import BaseModel, Field, validator


class KeystrokeData(BaseModel):
    """키스트로크 데이터 모델"""

    key: str = Field(..., description="입력된 키 값")
    timestamp: float = Field(..., description="키 입력 시각 (Unix timestamp, milliseconds)")
    duration: Optional[float] = Field(None, description="키 지속 시간 (milliseconds)")
    type: str = Field(..., description="이벤트 타입 (keydown, keyup)")

    @validator('type')
    def validate_type(cls, v):
        if v not in ['keydown', 'keyup']:
            raise ValueError('type must be either "keydown" or "keyup"')
        return v

    @validator('timestamp')
    def validate_timestamp(cls, v):
        if v <= 0:
            raise ValueError('timestamp must be positive')
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "key": "a",
                "timestamp": 1694781234567.8,
                "duration": 85.2,
                "type": "keydown"
            }
        }


class AnalyzeRequest(BaseModel):
    """타이핑 패턴 분석 요청 모델"""

    keystrokes: List[KeystrokeData] = Field(
        ...,
        description="분석할 키스트로크 데이터 리스트",
        min_items=1
    )

    text_content: Optional[str] = Field(
        None,
        description="입력된 텍스트 내용 (선택사항)",
        max_length=5000
    )

    @validator('keystrokes')
    def validate_keystrokes(cls, v):
        if len(v) < 2:
            raise ValueError('최소 2개 이상의 키스트로크 데이터가 필요합니다')
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "keystrokes": [
                    {
                        "key": "h",
                        "timestamp": 1694781234567.8,
                        "duration": 85.2,
                        "type": "keydown"
                    },
                    {
                        "key": "e",
                        "timestamp": 1694781234652.1,
                        "duration": 92.5,
                        "type": "keydown"
                    },
                    {
                        "key": "l",
                        "timestamp": 1694781234744.6,
                        "duration": 78.3,
                        "type": "keydown"
                    }
                ],
                "text_content": "hello world"
            }
        }


class TypingPatternResponse(BaseModel):
    """타이핑 패턴 응답 모델"""

    id: str = Field(..., description="타이핑 패턴 ID")
    session_id: str = Field(..., description="세션 ID")
    text_content: Optional[str] = Field(None, description="입력된 텍스트")
    created_at: datetime = Field(..., description="생성 시각")
    keystrokes_count: int = Field(..., description="키스트로크 개수")

    class Config:
        from_attributes = True


class EmotionProfileResponse(BaseModel):
    """감정 프로필 응답 모델"""

    id: str = Field(..., description="감정 프로필 ID")
    pattern_id: str = Field(..., description="연관된 타이핑 패턴 ID")
    tempo_score: float = Field(..., description="타이핑 속도 점수 (0.0-1.0)")
    rhythm_consistency: float = Field(..., description="리듬 일관성 (0.0-1.0)")
    pause_intensity: float = Field(..., description="일시정지 강도 (0.0-1.0)")
    emotion_vector: Dict[str, float] = Field(..., description="감정 벡터 (energy, valence, tension, focus)")
    confidence_score: float = Field(..., description="분석 신뢰도 (0.0-1.0)")
    dominant_emotion: str = Field(..., description="주요 감정")
    created_at: datetime = Field(..., description="생성 시각")

    class Config:
        from_attributes = True


class AnalyzeResponse(BaseModel):
    """타이핑 패턴 분석 응답 모델"""

    typing_pattern: TypingPatternResponse = Field(..., description="타이핑 패턴 정보")
    emotion_profile: EmotionProfileResponse = Field(..., description="감정 프로필 정보")
    analysis_summary: Dict[str, Any] = Field(..., description="분석 요약 정보")

    class Config:
        json_schema_extra = {
            "example": {
                "typing_pattern": {
                    "id": "550e8400-e29b-41d4-a716-446655440000",
                    "session_id": "550e8400-e29b-41d4-a716-446655440001",
                    "text_content": "hello world",
                    "created_at": "2025-09-15T12:00:00Z",
                    "keystrokes_count": 25
                },
                "emotion_profile": {
                    "id": "550e8400-e29b-41d4-a716-446655440002",
                    "pattern_id": "550e8400-e29b-41d4-a716-446655440000",
                    "tempo_score": 0.75,
                    "rhythm_consistency": 0.82,
                    "pause_intensity": 0.45,
                    "emotion_vector": {
                        "energy": 0.72,
                        "valence": 0.65,
                        "tension": 0.38,
                        "focus": 0.85
                    },
                    "confidence_score": 0.89,
                    "dominant_emotion": "focused",
                    "created_at": "2025-09-15T12:00:00Z"
                },
                "analysis_summary": {
                    "typing_speed_wpm": 65.2,
                    "total_keystrokes": 25,
                    "analysis_duration_ms": 125.5,
                    "dominant_emotion": "focused",
                    "confidence_level": "high"
                }
            }
        }