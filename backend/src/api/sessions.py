"""
Sessions API - 사용자 세션 관리 엔드포인트

이 모듈은 사용자 세션 생성, 조회, 관리를 위한 REST API 엔드포인트를 제공합니다.
"""
from datetime import datetime
from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Request, status, Header
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.connection import get_async_session
from src.services.session_service import SessionService
from src.models.user_session import UserSession
from src.api.schemas.sessions import SessionCreateRequest, SessionResponse
from src.api.schemas.common import ErrorResponse


# API 라우터 생성
router = APIRouter()




# 의존성 함수
async def get_session_service(
    db: AsyncSession = Depends(get_async_session)
) -> SessionService:
    """SessionService 의존성 주입"""
    return SessionService(db)


def get_client_info(request: Request) -> Dict[str, Optional[str]]:
    """클라이언트 정보 추출"""
    return {
        "user_agent": request.headers.get("user-agent"),
        "ip_address": request.client.host if request.client else None
    }


def extract_session_token(authorization: Optional[str] = Header(None)) -> Optional[str]:
    """
    Authorization 헤더에서 세션 토큰 추출

    Args:
        authorization: Authorization 헤더 값

    Returns:
        세션 토큰 또는 None
    """
    if not authorization:
        return None

    # Bearer 토큰 형식 지원: "Bearer <token>"
    if authorization.startswith("Bearer "):
        return authorization[7:]  # "Bearer " 제거

    # 직접 토큰 형식도 지원
    return authorization


async def verify_session_access(
    session_id: str,
    session_token: Optional[str],
    session_service: SessionService
) -> UserSession:
    """
    세션 접근 권한 검증

    Args:
        session_id: 요청된 세션 ID
        session_token: 제공된 세션 토큰
        session_service: SessionService 인스턴스

    Returns:
        검증된 UserSession 객체

    Raises:
        HTTPException: 인증 실패 또는 권한 없음
    """
    # 토큰이 없는 경우
    if not session_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "MISSING_TOKEN",
                "message": "세션 토큰이 필요합니다.",
                "details": {
                    "required_header": "Authorization: Bearer <session_token>"
                }
            }
        )

    # 토큰으로 세션 조회
    user_session = await session_service.validate_session(session_token)
    if not user_session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "INVALID_TOKEN",
                "message": "유효하지 않은 세션 토큰입니다.",
                "details": {
                    "token_status": "expired_or_invalid"
                }
            }
        )

    # 요청된 세션 ID와 토큰의 세션 ID가 일치하는지 확인
    if user_session.id != session_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "ACCESS_DENIED",
                "message": "해당 세션에 접근할 권한이 없습니다.",
                "details": {
                    "requested_session": session_id,
                    "token_session": user_session.id
                }
            }
        )

    return user_session


# API 엔드포인트
@router.post(
    "/",
    response_model=SessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="새 세션 생성",
    description="새로운 사용자 세션을 생성합니다.",
    responses={
        201: {
            "description": "세션이 성공적으로 생성되었습니다.",
            "model": SessionResponse
        },
        400: {
            "description": "잘못된 요청 파라미터",
            "model": ErrorResponse
        },
        500: {
            "description": "서버 내부 오류",
            "model": ErrorResponse
        }
    }
)
async def create_session(
    request_data: SessionCreateRequest,
    request: Request,
    session_service: SessionService = Depends(get_session_service)
) -> SessionResponse:
    """
    새로운 사용자 세션 생성

    이 엔드포인트는 새로운 사용자 세션을 생성하고 세션 토큰을 반환합니다.
    클라이언트는 이 토큰을 사용하여 후속 API 호출을 인증할 수 있습니다.

    Args:
        request_data: 세션 생성 요청 데이터
        request: FastAPI Request 객체 (클라이언트 정보 추출용)
        session_service: SessionService 의존성

    Returns:
        생성된 세션 정보

    Raises:
        HTTPException: 세션 생성 실패시
    """
    try:
        # 클라이언트 정보 추출
        client_info = get_client_info(request)

        # 세션 생성
        user_session = await session_service.create_session(
            user_agent=client_info["user_agent"],
            ip_address=client_info["ip_address"],
            consent_given=request_data.consent_given,
            metadata=request_data.metadata
        )

        # 응답 데이터 구성
        response_data = SessionResponse(
            id=user_session.id,
            session_token=user_session.session_token,
            status=user_session.status,
            consent_given=user_session.consent_given,
            created_at=user_session.created_at,
            auto_delete_at=user_session.auto_delete_at,
            total_typing_time=user_session.total_typing_time,
            music_generated_count=user_session.music_generated_count,
            metadata=user_session.metadata
        )

        return response_data

    except ValueError as e:
        # 유효성 검증 오류
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "INVALID_REQUEST",
                "message": f"잘못된 요청 데이터: {str(e)}",
                "details": {
                    "validation_error": str(e)
                }
            }
        )

    except Exception as e:
        # 서버 내부 오류
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "SESSION_CREATION_FAILED",
                "message": "세션 생성 중 오류가 발생했습니다.",
                "details": {
                    "error_type": type(e).__name__,
                    "error_message": str(e)
                }
            }
        )


@router.get(
    "/{session_id}",
    response_model=SessionResponse,
    status_code=status.HTTP_200_OK,
    summary="세션 정보 조회",
    description="특정 세션의 정보를 조회합니다.",
    responses={
        200: {
            "description": "세션 정보가 성공적으로 조회되었습니다.",
            "model": SessionResponse
        },
        401: {
            "description": "인증 실패 - 토큰이 없거나 유효하지 않음",
            "model": ErrorResponse
        },
        403: {
            "description": "권한 없음 - 해당 세션에 접근할 권한이 없음",
            "model": ErrorResponse
        },
        404: {
            "description": "세션을 찾을 수 없음",
            "model": ErrorResponse
        },
        500: {
            "description": "서버 내부 오류",
            "model": ErrorResponse
        }
    }
)
async def get_session(
    session_id: str,
    session_token: Optional[str] = Depends(extract_session_token),
    session_service: SessionService = Depends(get_session_service)
) -> SessionResponse:
    """
    세션 정보 조회

    특정 세션 ID의 정보를 조회합니다. 요청자는 해당 세션의 소유자여야 하며,
    유효한 세션 토큰을 Authorization 헤더에 포함해야 합니다.

    Args:
        session_id: 조회할 세션 ID (경로 파라미터)
        session_token: 세션 토큰 (Authorization 헤더에서 추출)
        session_service: SessionService 의존성

    Returns:
        세션 정보

    Raises:
        HTTPException: 인증 실패, 권한 없음, 세션 없음, 서버 오류
    """
    try:
        # 세션 접근 권한 검증
        user_session = await verify_session_access(
            session_id, session_token, session_service
        )

        # 응답 데이터 구성
        response_data = SessionResponse(
            id=user_session.id,
            session_token=user_session.session_token,
            status=user_session.status,
            consent_given=user_session.consent_given,
            created_at=user_session.created_at,
            auto_delete_at=user_session.auto_delete_at,
            total_typing_time=user_session.total_typing_time,
            music_generated_count=user_session.music_generated_count,
            metadata=user_session.metadata
        )

        return response_data

    except HTTPException:
        # 이미 적절한 상태 코드와 메시지가 설정된 예외는 재발생
        raise

    except Exception as e:
        # 예상치 못한 서버 오류
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "SESSION_RETRIEVAL_FAILED",
                "message": "세션 정보 조회 중 오류가 발생했습니다.",
                "details": {
                    "error_type": type(e).__name__,
                    "error_message": str(e)
                }
            }
        )


@router.get(
    "/health",
    summary="Sessions API 헬스 체크",
    description="Sessions API의 상태를 확인합니다.",
    tags=["health"]
)
async def sessions_health_check(
    session_service: SessionService = Depends(get_session_service)
) -> Dict[str, Any]:
    """
    Sessions API 헬스 체크

    Returns:
        API 상태 정보
    """
    try:
        # 세션 통계 조회로 데이터베이스 연결 확인
        stats = await session_service.get_session_statistics()

        return {
            "status": "healthy",
            "service": "sessions-api",
            "version": "1.0.0",
            "database": "connected",
            "session_statistics": stats,
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unhealthy",
                "service": "sessions-api",
                "version": "1.0.0",
                "database": "error",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
        )


# 라우터 메타데이터
router.tags = ["sessions"]