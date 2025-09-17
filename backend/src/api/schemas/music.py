"""
Music API Schemas - 음악 조회 및 다운로드 관련 스키마

음악 정보 조회에 사용되는 Pydantic 모델들을 정의합니다.
"""
from datetime import datetime
from typing import Optional, Dict, Any

from pydantic import BaseModel, Field


class FileInfo(BaseModel):
    """파일 정보 모델"""

    url: str = Field(..., description="파일 URL")
    size: Optional[int] = Field(None, description="파일 크기 (바이트)")
    format: str = Field(..., description="파일 형식")
    duration: int = Field(..., description="음악 길이 (초)")
    download_url: str = Field(..., description="다운로드 URL")

    class Config:
        json_schema_extra = {
            "example": {
                "url": "https://storage.example.com/music/550e8400-e29b-41d4-a716-446655440000.wav",
                "size": 2048576,
                "format": "wav",
                "duration": 60,
                "download_url": "/v1/sessions/550e8400-e29b-41d4-a716-446655440001/music/550e8400-e29b-41d4-a716-446655440000/download"
            }
        }


class GenerationProgress(BaseModel):
    """생성 진행률 정보"""

    percentage: float = Field(..., description="진행률 (0.0-100.0)")
    estimated_time_remaining: Optional[int] = Field(None, description="예상 남은 시간 (초)")
    current_step: str = Field(..., description="현재 처리 단계")

    class Config:
        json_schema_extra = {
            "example": {
                "percentage": 75.5,
                "estimated_time_remaining": 15,
                "current_step": "audio_synthesis"
            }
        }


class PromptInfo(BaseModel):
    """음악 프롬프트 정보"""

    id: str = Field(..., description="프롬프트 ID")
    original_prompt: str = Field(..., description="원본 텍스트 프롬프트")
    enhanced_prompt: Optional[str] = Field(None, description="향상된 프롬프트")
    emotion_profile_id: str = Field(..., description="사용된 감정 프로필 ID")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440001",
                "original_prompt": "차분하고 평화로운 피아노 멜로디",
                "enhanced_prompt": "gentle focused piano melody with calm energy, peaceful valence",
                "emotion_profile_id": "550e8400-e29b-41d4-a716-446655440002"
            }
        }


class MusicInfoResponse(BaseModel):
    """음악 정보 응답 모델"""

    id: str = Field(..., description="음악 ID")
    session_id: str = Field(..., description="연관된 세션 ID")
    status: str = Field(..., description="생성 상태 (generating, completed, failed)")
    prompt_info: PromptInfo = Field(..., description="사용된 프롬프트 정보")

    # 상태별 조건부 필드
    file_info: Optional[FileInfo] = Field(None, description="파일 정보 (완료된 경우)")
    progress: Optional[GenerationProgress] = Field(None, description="진행률 정보 (생성 중인 경우)")
    error_message: Optional[str] = Field(None, description="에러 메시지 (실패한 경우)")

    # 공통 메타데이터
    ai_model_version: Optional[str] = Field(None, description="사용된 AI 모델 버전")
    created_at: datetime = Field(..., description="생성 시작 시각")
    updated_at: datetime = Field(..., description="마지막 업데이트 시각")
    completed_at: Optional[datetime] = Field(None, description="생성 완료 시각")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "session_id": "550e8400-e29b-41d4-a716-446655440003",
                "status": "completed",
                "prompt_info": {
                    "id": "550e8400-e29b-41d4-a716-446655440001",
                    "original_prompt": "차분하고 평화로운 피아노 멜로디",
                    "enhanced_prompt": "gentle focused piano melody with calm energy",
                    "emotion_profile_id": "550e8400-e29b-41d4-a716-446655440002"
                },
                "file_info": {
                    "url": "https://storage.example.com/music/550e8400-e29b-41d4-a716-446655440000.wav",
                    "size": 2048576,
                    "format": "wav",
                    "duration": 60,
                    "download_url": "/v1/sessions/550e8400-e29b-41d4-a716-446655440003/music/550e8400-e29b-41d4-a716-446655440000/download"
                },
                "ai_model_version": "musicgen-1.5",
                "created_at": "2025-09-15T12:00:00Z",
                "updated_at": "2025-09-15T12:01:00Z",
                "completed_at": "2025-09-15T12:01:00Z"
            }
        }