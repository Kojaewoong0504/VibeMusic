"""
Sessions API Schemas - 세션 관련 스키마

세션 생성, 조회 등에 사용되는 Pydantic 모델들을 정의합니다.
"""
from datetime import datetime
from typing import Optional, Dict, Any

from pydantic import BaseModel, Field


class SessionCreateRequest(BaseModel):
    """세션 생성 요청 모델"""

    consent_given: bool = Field(
        ...,
        description="데이터 수집 및 처리에 대한 사용자 동의 여부"
    )

    metadata: Optional[Dict[str, Any]] = Field(
        default=None,
        description="추가 메타데이터 (선택사항)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "consent_given": True,
                "metadata": {
                    "browser": "Chrome",
                    "platform": "Windows",
                    "timezone": "Asia/Seoul"
                }
            }
        }


class SessionResponse(BaseModel):
    """세션 응답 모델"""

    id: str = Field(..., description="세션 고유 ID")
    session_token: str = Field(..., description="세션 인증 토큰")
    status: str = Field(..., description="세션 상태")
    consent_given: bool = Field(..., description="데이터 수집 동의 여부")
    created_at: datetime = Field(..., description="세션 생성 시각")
    auto_delete_at: Optional[datetime] = Field(None, description="자동 삭제 예정 시각")
    total_typing_time: int = Field(..., description="총 타이핑 시간 (초)")
    music_generated_count: int = Field(..., description="생성된 음악 개수")
    metadata: Optional[Dict[str, Any]] = Field(None, description="추가 메타데이터")

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "session_token": "abc123def456ghi789jkl012mno345pqr678",
                "status": "active",
                "consent_given": True,
                "created_at": "2025-09-15T12:00:00Z",
                "auto_delete_at": "2025-09-16T12:00:00Z",
                "total_typing_time": 0,
                "music_generated_count": 0,
                "metadata": {
                    "browser": "Chrome",
                    "platform": "Windows"
                }
            }
        }