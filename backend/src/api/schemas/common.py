"""
Common API Schemas - 공통 스키마 정의

모든 API에서 사용되는 공통 Pydantic 모델들을 정의합니다.
"""
from datetime import datetime
from typing import Optional, Dict, Any

from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    """에러 응답 모델"""

    error: str = Field(..., description="에러 코드")
    message: str = Field(..., description="에러 메시지")
    details: Optional[Dict[str, Any]] = Field(None, description="추가 에러 정보")

    class Config:
        json_schema_extra = {
            "example": {
                "error": "VALIDATION_ERROR",
                "message": "요청 데이터가 유효하지 않습니다.",
                "details": {
                    "field": "username",
                    "reason": "필수 필드입니다."
                }
            }
        }


class HealthResponse(BaseModel):
    """헬스 체크 응답 모델"""

    status: str = Field(..., description="서비스 상태")
    service: str = Field(..., description="서비스 이름")
    version: str = Field(..., description="서비스 버전")
    timestamp: str = Field(..., description="응답 시각")
    database: Optional[str] = Field(None, description="데이터베이스 상태")
    additional_info: Optional[Dict[str, Any]] = Field(None, description="추가 정보")

    class Config:
        json_schema_extra = {
            "example": {
                "status": "healthy",
                "service": "vibemusic-api",
                "version": "1.0.0",
                "timestamp": "2025-09-15T12:00:00Z",
                "database": "connected",
                "additional_info": {
                    "uptime_seconds": 3600
                }
            }
        }