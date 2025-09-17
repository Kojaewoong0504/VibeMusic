"""
Analysis API - 타이핑 패턴 분석 엔드포인트

이 모듈은 사용자의 키스트로크 데이터를 분석하여 타이핑 패턴과 감정 프로필을 생성하는 REST API 엔드포인트를 제공합니다.
"""
from datetime import datetime
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.connection import get_async_session
from src.services.pattern_analysis_service import PatternAnalysisService
from src.services.session_service import SessionService
from src.api.sessions import extract_session_token, verify_session_access, get_session_service
from src.api.schemas.analysis import AnalyzeRequest, AnalyzeResponse, TypingPatternResponse, EmotionProfileResponse
from src.api.schemas.common import ErrorResponse


# API 라우터 생성
router = APIRouter()




# 의존성 함수
async def get_pattern_analysis_service(
    db: AsyncSession = Depends(get_async_session)
) -> PatternAnalysisService:
    """PatternAnalysisService 의존성 주입"""
    return PatternAnalysisService(db)


# API 엔드포인트
@router.post(
    "/{session_id}/analyze",
    response_model=AnalyzeResponse,
    status_code=status.HTTP_200_OK,
    summary="타이핑 패턴 분석",
    description="키스트로크 데이터를 분석하여 타이핑 패턴과 감정 프로필을 생성합니다.",
    responses={
        200: {
            "description": "분석이 성공적으로 완료되었습니다.",
            "model": AnalyzeResponse
        },
        400: {
            "description": "잘못된 요청 데이터",
            "model": ErrorResponse
        },
        401: {
            "description": "인증 실패",
            "model": ErrorResponse
        },
        403: {
            "description": "권한 없음",
            "model": ErrorResponse
        },
        422: {
            "description": "키스트로크 데이터 검증 실패",
            "model": ErrorResponse
        },
        500: {
            "description": "서버 내부 오류",
            "model": ErrorResponse
        }
    }
)
async def analyze_typing_pattern(
    session_id: str,
    request_data: AnalyzeRequest,
    session_token: Optional[str] = Depends(extract_session_token),
    session_service: SessionService = Depends(get_session_service),
    pattern_service: PatternAnalysisService = Depends(get_pattern_analysis_service)
) -> AnalyzeResponse:
    """
    타이핑 패턴 분석

    사용자의 키스트로크 데이터를 분석하여 타이핑 패턴과 감정 프로필을 생성합니다.
    분석 결과는 데이터베이스에 저장되며, 음악 생성에 사용될 수 있습니다.

    Args:
        session_id: 분석할 세션 ID (경로 파라미터)
        request_data: 키스트로크 데이터와 텍스트 내용
        session_token: 세션 토큰 (Authorization 헤더에서 추출)
        session_service: SessionService 의존성
        pattern_service: PatternAnalysisService 의존성

    Returns:
        타이핑 패턴과 감정 프로필 분석 결과

    Raises:
        HTTPException: 인증 실패, 권한 없음, 분석 실패, 서버 오류
    """
    try:
        # 세션 접근 권한 검증
        user_session = await verify_session_access(
            session_id, session_token, session_service
        )

        # 키스트로크 데이터를 딕셔너리 형태로 변환
        keystrokes_data = [
            {
                "key": ks.key,
                "timestamp": ks.timestamp,
                "duration": ks.duration,
                "type": ks.type
            }
            for ks in request_data.keystrokes
        ]

        # 타이핑 패턴 분석 실행
        typing_pattern, emotion_profile = await pattern_service.analyze_typing_pattern(
            session_id=session_id,
            keystrokes=keystrokes_data,
            text_content=request_data.text_content
        )

        # 세션 활동 시간 업데이트 (분석 수행)
        if keystrokes_data:
            # 첫 번째와 마지막 키스트로크 시간 차이 계산
            start_time = min(ks["timestamp"] for ks in keystrokes_data)
            end_time = max(ks["timestamp"] for ks in keystrokes_data)
            typing_duration_seconds = int((end_time - start_time) / 1000)

            await session_service.update_session_activity(
                session_id=session_id,
                typing_time_seconds=typing_duration_seconds
            )

        # 분석 요약 정보 생성
        analysis_summary = {
            "typing_speed_wpm": 0.0,  # 기본값
            "total_keystrokes": len(keystrokes_data),
            "analysis_duration_ms": (
                max(ks["timestamp"] for ks in keystrokes_data) -
                min(ks["timestamp"] for ks in keystrokes_data)
            ) if keystrokes_data else 0.0,
            "dominant_emotion": emotion_profile.get_dominant_emotion(),
            "confidence_level": (
                "high" if emotion_profile.confidence_score >= 0.8 else
                "medium" if emotion_profile.confidence_score >= 0.6 else
                "low"
            )
        }

        # WPM 계산 (키스트로크에서 단어 추정)
        if keystrokes_data and analysis_summary["analysis_duration_ms"] > 0:
            # 대략적인 WPM 계산 (5 characters = 1 word)
            characters_typed = len([ks for ks in keystrokes_data if ks["type"] == "keydown"])
            words_typed = characters_typed / 5
            minutes_elapsed = analysis_summary["analysis_duration_ms"] / (1000 * 60)
            if minutes_elapsed > 0:
                analysis_summary["typing_speed_wpm"] = round(words_typed / minutes_elapsed, 1)

        # 응답 데이터 구성
        response_data = AnalyzeResponse(
            typing_pattern=TypingPatternResponse(
                id=typing_pattern.id,
                session_id=typing_pattern.session_id,
                text_content=typing_pattern.text_content,
                created_at=typing_pattern.created_at,
                keystrokes_count=len(typing_pattern.keystrokes)
            ),
            emotion_profile=EmotionProfileResponse(
                id=emotion_profile.id,
                pattern_id=emotion_profile.pattern_id,
                tempo_score=emotion_profile.tempo_score,
                rhythm_consistency=emotion_profile.rhythm_consistency,
                pause_intensity=emotion_profile.pause_intensity,
                emotion_vector=emotion_profile.emotion_vector,
                confidence_score=emotion_profile.confidence_score,
                dominant_emotion=emotion_profile.get_dominant_emotion(),
                created_at=emotion_profile.created_at
            ),
            analysis_summary=analysis_summary
        )

        return response_data

    except HTTPException:
        # 이미 적절한 상태 코드와 메시지가 설정된 예외는 재발생
        raise

    except ValueError as e:
        # 키스트로크 데이터 검증 오류
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "INVALID_KEYSTROKES",
                "message": f"키스트로크 데이터가 유효하지 않습니다: {str(e)}",
                "details": {
                    "validation_error": str(e),
                    "required_format": {
                        "key": "string",
                        "timestamp": "number (unix timestamp in milliseconds)",
                        "duration": "number (optional, milliseconds)",
                        "type": "string (keydown or keyup)"
                    }
                }
            }
        )

    except RuntimeError as e:
        # 세션 관련 오류
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "SESSION_ERROR",
                "message": f"세션 처리 중 오류가 발생했습니다: {str(e)}",
                "details": {
                    "session_id": session_id,
                    "error_message": str(e)
                }
            }
        )

    except Exception as e:
        # 예상치 못한 서버 오류
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "ANALYSIS_FAILED",
                "message": "타이핑 패턴 분석 중 오류가 발생했습니다.",
                "details": {
                    "error_type": type(e).__name__,
                    "error_message": str(e)
                }
            }
        )


@router.get(
    "/health",
    summary="Analysis API 헬스 체크",
    description="Analysis API의 상태를 확인합니다.",
    tags=["health"]
)
async def analysis_health_check(
    pattern_service: PatternAnalysisService = Depends(get_pattern_analysis_service)
) -> Dict[str, Any]:
    """
    Analysis API 헬스 체크

    Returns:
        API 상태 정보
    """
    try:
        # 분석기 통계 조회로 서비스 상태 확인
        stats = pattern_service.get_analysis_statistics()

        return {
            "status": "healthy",
            "service": "analysis-api",
            "version": "1.0.0",
            "database": "connected",
            "analysis_statistics": stats,
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        return {
            "status": "unhealthy",
            "service": "analysis-api",
            "version": "1.0.0",
            "database": "error",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


# 라우터 메타데이터
router.tags = ["analysis"]