"""
Generation API - 음악 생성 엔드포인트

이 모듈은 타이핑 패턴과 감정 프로필을 기반으로 AI 음악을 생성하는 REST API 엔드포인트를 제공합니다.
"""
from datetime import datetime
from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.connection import get_async_session
from src.services.music_generation_service import MusicGenerationService
from src.services.pattern_analysis_service import PatternAnalysisService
from src.services.session_service import SessionService
from src.services.music_generator import music_service, MusicGenerationRequest
from src.api.sessions import extract_session_token, verify_session_access, get_session_service
from src.api.schemas.generation import GenerateRequest, GenerateResponse, EmotionSummary, MusicPromptInfo
from src.api.schemas.common import ErrorResponse
from src.models.emotion import EmotionData


# API 라우터 생성
router = APIRouter()




# 의존성 함수
async def get_music_generation_service(
    db: AsyncSession = Depends(get_async_session)
) -> MusicGenerationService:
    """MusicGenerationService 의존성 주입"""
    return MusicGenerationService(db)


async def get_pattern_analysis_service(
    db: AsyncSession = Depends(get_async_session)
) -> PatternAnalysisService:
    """PatternAnalysisService 의존성 주입"""
    return PatternAnalysisService(db)


# API 엔드포인트
@router.post(
    "/{session_id}/generate",
    response_model=GenerateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="AI 음악 생성",
    description="타이핑 패턴과 감정 프로필을 기반으로 AI 음악을 생성합니다.",
    responses={
        201: {
            "description": "음악 생성이 성공적으로 시작되었습니다.",
            "model": GenerateResponse
        },
        400: {
            "description": "잘못된 요청 또는 분석 데이터 없음",
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
            "description": "요청 데이터 검증 실패",
            "model": ErrorResponse
        },
        500: {
            "description": "서버 내부 오류",
            "model": ErrorResponse
        }
    }
)
async def generate_music(
    session_id: str,
    request_data: GenerateRequest,
    session_token: Optional[str] = Depends(extract_session_token),
    session_service: SessionService = Depends(get_session_service),
    music_service: MusicGenerationService = Depends(get_music_generation_service),
    pattern_service: PatternAnalysisService = Depends(get_pattern_analysis_service)
) -> GenerateResponse:
    """
    AI 음악 생성

    사용자의 타이핑 패턴과 감정 프로필을 분석하여 개인화된 AI 음악을 생성합니다.
    세션에 분석된 타이핑 패턴이 있어야 하며, 가장 최근의 감정 프로필을 사용합니다.

    Args:
        session_id: 음악을 생성할 세션 ID (경로 파라미터)
        request_data: 음악 생성 요청 데이터
        session_token: 세션 토큰 (Authorization 헤더에서 추출)
        session_service: SessionService 의존성
        music_service: MusicGenerationService 의존성
        pattern_service: PatternAnalysisService 의존성

    Returns:
        음악 생성 결과 및 상태 정보

    Raises:
        HTTPException: 인증 실패, 권한 없음, 분석 데이터 없음, 생성 실패, 서버 오류
    """
    try:
        # 세션 접근 권한 검증
        user_session = await verify_session_access(
            session_id, session_token, session_service
        )

        # 세션의 타이핑 패턴 조회 (가장 최근 1개)
        typing_patterns = await pattern_service.get_patterns_by_session(
            session_id=session_id,
            limit=1,
            offset=0
        )

        if not typing_patterns:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "NO_TYPING_PATTERNS",
                    "message": "이 세션에는 분석된 타이핑 패턴이 없습니다.",
                    "details": {
                        "session_id": session_id,
                        "required_action": "먼저 /analyze 엔드포인트로 타이핑 패턴을 분석해주세요."
                    }
                }
            )

        # 가장 최근 타이핑 패턴의 감정 프로필 조회
        latest_pattern = typing_patterns[0]
        emotion_profile = await pattern_service.get_emotion_profile_by_pattern(
            pattern_id=latest_pattern.id
        )

        if not emotion_profile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "NO_EMOTION_PROFILE",
                    "message": "타이핑 패턴에 대한 감정 프로필이 없습니다.",
                    "details": {
                        "pattern_id": latest_pattern.id,
                        "required_action": "패턴 재분석이 필요할 수 있습니다."
                    }
                }
            )

        # 음악 프롬프트 생성
        music_prompt = await music_service.create_music_prompt(
            session_id=session_id,
            emotion_profile_id=emotion_profile.id,
            text_prompt=request_data.text_prompt,
            duration=request_data.duration,
            audio_format=request_data.audio_format
        )

        # 음악 생성 시작
        generated_music = await music_service.generate_music(
            prompt_id=music_prompt.id,
            use_mock=request_data.use_mock
        )

        # 세션 활동 업데이트 (음악 생성)
        await session_service.update_session_activity(
            session_id=session_id,
            music_generated=True
        )

        # 예상 완료 시간 계산 (대략적 추정)
        estimated_completion = None
        if generated_music.status == "generating":
            import datetime as dt
            # 일반적으로 1분 음악 생성에 30-60초 소요 예상
            estimated_seconds = max(30, request_data.duration * 0.8)
            estimated_completion = datetime.utcnow() + dt.timedelta(seconds=estimated_seconds)

        # 감정 요약 정보 구성
        emotion_summary = EmotionSummary(
            dominant_emotion=emotion_profile.get_dominant_emotion(),
            emotion_vector=emotion_profile.emotion_vector,
            confidence_score=emotion_profile.confidence_score,
            tempo_score=emotion_profile.tempo_score,
            rhythm_consistency=emotion_profile.rhythm_consistency
        )

        # 프롬프트 정보 구성
        prompt_info = MusicPromptInfo(
            id=music_prompt.id,
            original_prompt=music_prompt.text_prompt,
            enhanced_prompt=music_prompt.enhanced_prompt,
            duration=music_prompt.duration,
            audio_format=music_prompt.audio_format
        )

        # 응답 데이터 구성
        response_data = GenerateResponse(
            music_id=generated_music.id,
            prompt_info=prompt_info,
            emotion_context=emotion_summary,
            generation_status=generated_music.status,
            estimated_completion_time=estimated_completion,
            created_at=generated_music.created_at,
            file_url=generated_music.file_url if generated_music.status == "completed" else None
        )

        return response_data

    except HTTPException:
        # 이미 적절한 상태 코드와 메시지가 설정된 예외는 재발생
        raise

    except ValueError as e:
        # 입력값 검증 오류
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "INVALID_REQUEST_DATA",
                "message": f"요청 데이터가 유효하지 않습니다: {str(e)}",
                "details": {
                    "validation_error": str(e)
                }
            }
        )

    except RuntimeError as e:
        # 서비스 관련 오류
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "GENERATION_ERROR",
                "message": f"음악 생성 중 오류가 발생했습니다: {str(e)}",
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
                "error": "MUSIC_GENERATION_FAILED",
                "message": "음악 생성 중 예상치 못한 오류가 발생했습니다.",
                "details": {
                    "error_type": type(e).__name__,
                    "error_message": str(e)
                }
            }
        )


@router.post(
    "/{session_id}/generate-simple",
    response_model=Dict[str, Any],
    status_code=status.HTTP_201_CREATED,
    summary="간단한 AI 음악 생성",
    description="감정 데이터를 직접 입력받아 AI 음악을 생성합니다. (T007 목업 버전)",
    responses={
        201: {
            "description": "음악 생성이 성공적으로 시작되었습니다."
        },
        400: {
            "description": "잘못된 요청 데이터",
            "model": ErrorResponse
        },
        401: {
            "description": "인증 실패",
            "model": ErrorResponse
        },
        500: {
            "description": "서버 내부 오류",
            "model": ErrorResponse
        }
    }
)
async def generate_simple_music(
    session_id: str,
    request_data: Dict[str, Any],
    session_token: Optional[str] = Depends(extract_session_token),
    session_service: SessionService = Depends(get_session_service)
) -> Dict[str, Any]:
    """
    간단한 AI 음악 생성 (T007 구현)

    감정 데이터를 직접 입력받아 목업 AI 음악을 생성합니다.
    실제 타이핑 패턴 분석 없이 감정 데이터만으로 음악을 생성하는 MVP 버전입니다.

    Request Body:
    {
        "emotion_data": {
            "energy": 0.7,
            "valence": 0.3,
            "tension": 0.5,
            "focus": 0.8
        },
        "user_prompt": "optional user prompt",
        "style_preference": "ambient",
        "duration": 30
    }

    Args:
        session_id: 세션 ID (경로 파라미터)
        request_data: 음악 생성 요청 데이터
        session_token: 세션 토큰 (Authorization 헤더에서 추출)
        session_service: SessionService 의존성

    Returns:
        음악 생성 결과 및 상태 정보

    Raises:
        HTTPException: 인증 실패, 잘못된 요청, 서버 오류
    """
    try:
        # 세션 접근 권한 검증
        user_session = await verify_session_access(
            session_id, session_token, session_service
        )

        # 요청 데이터 검증
        if "emotion_data" not in request_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "MISSING_EMOTION_DATA",
                    "message": "감정 데이터가 필요합니다.",
                    "details": {
                        "required_fields": ["emotion_data"]
                    }
                }
            )

        emotion_dict = request_data["emotion_data"]

        # 감정 데이터 객체 생성
        emotion_data = EmotionData(
            energy=emotion_dict.get("energy", 0.5),
            valence=emotion_dict.get("valence", 0.0),
            tension=emotion_dict.get("tension", 0.5),
            focus=emotion_dict.get("focus", 0.5),
            confidence=emotion_dict.get("confidence", 0.8),
            sample_size=emotion_dict.get("sample_size", 10),
            processing_time_ms=emotion_dict.get("processing_time_ms", 50.0)
        )

        # 음악 생성 요청 구성
        music_request = MusicGenerationRequest(
            emotion_data=emotion_data,
            user_prompt=request_data.get("user_prompt"),
            style_preference=request_data.get("style_preference"),
            duration=request_data.get("duration", 30)
        )

        # 음악 생성 시작
        generation_result = await music_service.generate_music(music_request)

        # 세션 활동 업데이트
        await session_service.update_session_activity(
            session_id=session_id,
            music_generated=True
        )

        # 응답 데이터 구성
        response_data = {
            "success": True,
            "generation_id": generation_result.generation_id,
            "status": generation_result.status.value,
            "prompt": {
                "text": generation_result.prompt.text if generation_result.prompt else None,
                "style": generation_result.prompt.style.value if generation_result.prompt else None,
                "tempo": generation_result.prompt.tempo if generation_result.prompt else None,
                "mood": generation_result.prompt.mood if generation_result.prompt else None,
                "intensity": generation_result.prompt.intensity if generation_result.prompt else None
            },
            "emotion_context": {
                "energy": emotion_data.energy,
                "valence": emotion_data.valence,
                "tension": emotion_data.tension,
                "focus": emotion_data.focus,
                "confidence": emotion_data.confidence
            },
            "file_info": {
                "file_path": generation_result.file_path,
                "file_url": generation_result.file_url,
                "created_at": generation_result.created_at.isoformat(),
                "completed_at": generation_result.completed_at.isoformat() if generation_result.completed_at else None
            },
            "metadata": generation_result.metadata,
            "session_id": session_id
        }

        return response_data

    except HTTPException:
        # 이미 적절한 상태 코드와 메시지가 설정된 예외는 재발생
        raise

    except ValueError as e:
        # 감정 데이터 검증 오류
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "INVALID_EMOTION_DATA",
                "message": f"감정 데이터가 유효하지 않습니다: {str(e)}",
                "details": {
                    "validation_error": str(e)
                }
            }
        )

    except Exception as e:
        # 예상치 못한 서버 오류
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "SIMPLE_MUSIC_GENERATION_FAILED",
                "message": "간단 음악 생성 중 예상치 못한 오류가 발생했습니다.",
                "details": {
                    "error_type": type(e).__name__,
                    "error_message": str(e)
                }
            }
        )


@router.get(
    "/{session_id}/generation/{generation_id}/status",
    response_model=Dict[str, Any],
    summary="음악 생성 상태 조회",
    description="생성 중인 음악의 상태를 조회합니다.",
    responses={
        200: {
            "description": "상태가 성공적으로 조회되었습니다."
        },
        404: {
            "description": "생성 작업을 찾을 수 없음",
            "model": ErrorResponse
        },
        500: {
            "description": "서버 내부 오류",
            "model": ErrorResponse
        }
    }
)
async def get_generation_status(
    session_id: str,
    generation_id: str,
    session_token: Optional[str] = Depends(extract_session_token),
    session_service: SessionService = Depends(get_session_service)
) -> Dict[str, Any]:
    """
    음악 생성 상태 조회

    Args:
        session_id: 세션 ID (경로 파라미터)
        generation_id: 생성 ID (경로 파라미터)
        session_token: 세션 토큰 (Authorization 헤더에서 추출)
        session_service: SessionService 의존성

    Returns:
        생성 상태 정보

    Raises:
        HTTPException: 인증 실패, 작업 없음, 서버 오류
    """
    try:
        # 세션 접근 권한 검증
        user_session = await verify_session_access(
            session_id, session_token, session_service
        )

        # 생성 상태 조회
        result = await music_service.get_generation_status(generation_id)

        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": "GENERATION_NOT_FOUND",
                    "message": "생성 작업을 찾을 수 없습니다.",
                    "details": {
                        "generation_id": generation_id
                    }
                }
            )

        # 응답 데이터 구성
        response_data = {
            "generation_id": result.generation_id,
            "status": result.status.value,
            "file_path": result.file_path,
            "file_url": result.file_url,
            "created_at": result.created_at.isoformat(),
            "completed_at": result.completed_at.isoformat() if result.completed_at else None,
            "error_message": result.error_message,
            "metadata": result.metadata
        }

        return response_data

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "STATUS_RETRIEVAL_FAILED",
                "message": "상태 조회 중 오류가 발생했습니다.",
                "details": {
                    "error_type": type(e).__name__,
                    "error_message": str(e)
                }
            }
        )


@router.get(
    "/health",
    summary="Generation API 헬스 체크",
    description="Generation API의 상태를 확인합니다.",
    tags=["health"]
)
async def generation_health_check(
    music_service: MusicGenerationService = Depends(get_music_generation_service)
) -> Dict[str, Any]:
    """
    Generation API 헬스 체크

    Returns:
        API 상태 정보
    """
    try:
        # 음악 생성 서비스 통계 조회로 서비스 상태 확인
        stats = music_service.get_service_statistics()

        return {
            "status": "healthy",
            "service": "generation-api",
            "version": "1.0.0",
            "database": "connected",
            "ai_connector": "available",
            "service_statistics": stats,
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        return {
            "status": "unhealthy",
            "service": "generation-api",
            "version": "1.0.0",
            "database": "error",
            "ai_connector": "error",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


# 라우터 메타데이터
router.tags = ["generation"]