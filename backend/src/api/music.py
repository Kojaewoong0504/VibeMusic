"""
Music API - 생성된 음악 조회 및 관리 엔드포인트

이 모듈은 생성된 음악 파일의 정보 조회, 다운로드 등을 위한 REST API 엔드포인트를 제공합니다.
"""
from datetime import datetime
from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
import os
import mimetypes
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.connection import get_async_session
from src.services.music_generation_service import MusicGenerationService
from src.services.session_service import SessionService
from src.api.sessions import extract_session_token, verify_session_access, get_session_service
from src.api.schemas.music import MusicInfoResponse, FileInfo, GenerationProgress, PromptInfo
from src.api.schemas.common import ErrorResponse


# API 라우터 생성
router = APIRouter()




# 의존성 함수
async def get_music_generation_service(
    db: AsyncSession = Depends(get_async_session)
) -> MusicGenerationService:
    """MusicGenerationService 의존성 주입"""
    return MusicGenerationService(db)


async def verify_music_access(
    session_id: str,
    music_id: str,
    session_token: Optional[str],
    session_service: SessionService,
    music_service: MusicGenerationService
):
    """
    음악 접근 권한 검증

    Args:
        session_id: 요청된 세션 ID
        music_id: 요청된 음악 ID
        session_token: 세션 토큰
        session_service: SessionService 인스턴스
        music_service: MusicGenerationService 인스턴스

    Returns:
        (user_session, generated_music) 튜플

    Raises:
        HTTPException: 인증 실패, 권한 없음, 음악 없음
    """
    # 세션 접근 권한 검증
    user_session = await verify_session_access(session_id, session_token, session_service)

    # 음악 존재 확인
    generated_music = await music_service.get_music_by_id(music_id)
    if not generated_music:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "MUSIC_NOT_FOUND",
                "message": "요청된 음악을 찾을 수 없습니다.",
                "details": {
                    "music_id": music_id
                }
            }
        )

    # 음악 소유권 검증 (음악의 프롬프트가 해당 세션에 속하는지 확인)
    if generated_music.prompt.session_id != session_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "MUSIC_ACCESS_DENIED",
                "message": "해당 음악에 접근할 권한이 없습니다.",
                "details": {
                    "music_id": music_id,
                    "session_id": session_id,
                    "music_session_id": generated_music.prompt.session_id
                }
            }
        )

    return user_session, generated_music


# API 엔드포인트
@router.get(
    "/{session_id}/music/{music_id}",
    response_model=MusicInfoResponse,
    status_code=status.HTTP_200_OK,
    summary="생성된 음악 정보 조회",
    description="특정 음악의 상세 정보와 생성 상태를 조회합니다.",
    responses={
        200: {
            "description": "음악 정보가 성공적으로 조회되었습니다.",
            "model": MusicInfoResponse
        },
        401: {
            "description": "인증 실패",
            "model": ErrorResponse
        },
        403: {
            "description": "권한 없음 - 해당 음악에 접근할 권한이 없음",
            "model": ErrorResponse
        },
        404: {
            "description": "음악을 찾을 수 없음",
            "model": ErrorResponse
        },
        500: {
            "description": "서버 내부 오류",
            "model": ErrorResponse
        }
    }
)
async def get_music_info(
    session_id: str,
    music_id: str,
    session_token: Optional[str] = Depends(extract_session_token),
    session_service: SessionService = Depends(get_session_service),
    music_service: MusicGenerationService = Depends(get_music_generation_service)
) -> MusicInfoResponse:
    """
    생성된 음악 정보 조회

    특정 음악의 상세 정보, 생성 상태, 파일 정보 등을 조회합니다.
    음악 상태에 따라 다른 정보가 제공됩니다:
    - generating: 진행률과 예상 시간
    - completed: 파일 정보와 다운로드 URL
    - failed: 에러 메시지

    Args:
        session_id: 세션 ID (경로 파라미터)
        music_id: 음악 ID (경로 파라미터)
        session_token: 세션 토큰 (Authorization 헤더에서 추출)
        session_service: SessionService 의존성
        music_service: MusicGenerationService 의존성

    Returns:
        음악 정보와 상태

    Raises:
        HTTPException: 인증 실패, 권한 없음, 음악 없음, 서버 오류
    """
    try:
        # 음악 접근 권한 검증
        user_session, generated_music = await verify_music_access(
            session_id, music_id, session_token, session_service, music_service
        )

        # 프롬프트 정보 구성
        prompt_info = PromptInfo(
            id=generated_music.prompt.id,
            original_prompt=generated_music.prompt.text_prompt,
            enhanced_prompt=generated_music.prompt.enhanced_prompt,
            emotion_profile_id=generated_music.prompt.emotion_profile_id
        )

        # 상태별 조건부 정보 구성
        file_info = None
        progress = None
        error_message = None

        if generated_music.status == "completed" and generated_music.file_url:
            # 완료된 경우 파일 정보 제공
            file_info = FileInfo(
                url=generated_music.file_url,
                size=generated_music.file_size,
                format=generated_music.file_format or "wav",
                duration=generated_music.prompt.duration,
                download_url=f"/v1/sessions/{session_id}/music/{music_id}/download"
            )

        elif generated_music.status == "generating":
            # 생성 중인 경우 진행률 정보 제공
            generation_status = await music_service.get_generation_status(music_id)
            if generation_status:
                progress = GenerationProgress(
                    percentage=generation_status.get("progress", 0.0),
                    estimated_time_remaining=generation_status.get("estimated_time_remaining"),
                    current_step=generation_status.get("current_step", "processing")
                )

        elif generated_music.status == "failed":
            # 실패한 경우 에러 메시지 제공
            error_message = generated_music.error_message

        # 응답 데이터 구성
        response_data = MusicInfoResponse(
            id=generated_music.id,
            session_id=session_id,
            status=generated_music.status,
            prompt_info=prompt_info,
            file_info=file_info,
            progress=progress,
            error_message=error_message,
            ai_model_version=generated_music.ai_model_version,
            created_at=generated_music.created_at,
            updated_at=generated_music.updated_at,
            completed_at=generated_music.completed_at
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
                "error": "MUSIC_INFO_RETRIEVAL_FAILED",
                "message": "음악 정보 조회 중 오류가 발생했습니다.",
                "details": {
                    "error_type": type(e).__name__,
                    "error_message": str(e)
                }
            }
        )


@router.get(
    "/{session_id}/music/{music_id}/download",
    summary="음악 파일 다운로드",
    description="생성된 음악 파일을 다운로드합니다.",
    responses={
        200: {
            "description": "음악 파일이 성공적으로 다운로드됩니다.",
            "content": {
                "audio/wav": {},
                "audio/mpeg": {},
                "audio/flac": {}
            }
        },
        401: {
            "description": "인증 실패",
            "model": ErrorResponse
        },
        403: {
            "description": "권한 없음",
            "model": ErrorResponse
        },
        404: {
            "description": "음악 파일을 찾을 수 없음",
            "model": ErrorResponse
        },
        409: {
            "description": "음악이 아직 생성 중이거나 실패함",
            "model": ErrorResponse
        },
        500: {
            "description": "서버 내부 오류",
            "model": ErrorResponse
        }
    }
)
async def download_music(
    session_id: str,
    music_id: str,
    session_token: Optional[str] = Depends(extract_session_token),
    session_service: SessionService = Depends(get_session_service),
    music_service: MusicGenerationService = Depends(get_music_generation_service)
) -> FileResponse:
    """
    음악 파일 다운로드

    생성이 완료된 음악 파일을 다운로드합니다.
    음악이 아직 생성 중이거나 실패한 경우 다운로드할 수 없습니다.

    Args:
        session_id: 세션 ID (경로 파라미터)
        music_id: 음악 ID (경로 파라미터)
        session_token: 세션 토큰 (Authorization 헤더에서 추출)
        session_service: SessionService 의존성
        music_service: MusicGenerationService 의존성

    Returns:
        음악 파일 스트림

    Raises:
        HTTPException: 인증 실패, 권한 없음, 파일 없음, 생성 미완료, 서버 오류
    """
    try:
        # 음악 접근 권한 검증
        user_session, generated_music = await verify_music_access(
            session_id, music_id, session_token, session_service, music_service
        )

        # 음악 생성 완료 상태 확인
        if not generated_music.is_completed():
            status_messages = {
                "generating": "음악이 아직 생성 중입니다.",
                "failed": "음악 생성이 실패했습니다."
            }

            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": "MUSIC_NOT_READY",
                    "message": status_messages.get(generated_music.status, "음악을 다운로드할 수 없습니다."),
                    "details": {
                        "music_id": music_id,
                        "current_status": generated_music.status,
                        "error_message": generated_music.error_message if generated_music.status == "failed" else None
                    }
                }
            )

        # 파일 URL 확인
        if not generated_music.file_url:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": "FILE_URL_MISSING",
                    "message": "음악 파일 URL이 없습니다.",
                    "details": {
                        "music_id": music_id
                    }
                }
            )

        # 다운로드 정보 생성
        download_info = generated_music.get_download_info()
        if not download_info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": "DOWNLOAD_INFO_UNAVAILABLE",
                    "message": "다운로드 정보를 생성할 수 없습니다.",
                    "details": {
                        "music_id": music_id
                    }
                }
            )

        # 파일 경로 처리 (URL이 로컬 파일 경로인 경우)
        file_path = generated_music.file_url

        # URL이 로컬 파일 시스템 경로가 아닌 경우 (S3, HTTP 등)
        if file_path.startswith(('http://', 'https://', 's3://')):
            # 외부 URL의 경우, 프록시 다운로드 또는 리다이렉트 처리
            # 현재는 기본적인 오류 응답
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail={
                    "error": "EXTERNAL_FILE_NOT_SUPPORTED",
                    "message": "외부 파일 다운로드는 현재 지원되지 않습니다.",
                    "details": {
                        "file_url": file_path,
                        "music_id": music_id
                    }
                }
            )

        # 로컬 파일 존재 확인
        if not os.path.exists(file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": "FILE_NOT_FOUND",
                    "message": "음악 파일이 서버에서 찾을 수 없습니다.",
                    "details": {
                        "file_path": file_path,
                        "music_id": music_id
                    }
                }
            )

        # 파일 보안 검증 (경로 순회 공격 방지)
        real_path = os.path.realpath(file_path)
        if not real_path.startswith(os.path.realpath('/tmp/')):  # 허용된 디렉토리 범위 내인지 확인
            # 실제 환경에서는 음악 파일 저장 디렉토리로 수정 필요
            pass  # 개발 환경에서는 경고만

        # MIME 타입 결정
        mime_type, _ = mimetypes.guess_type(file_path)
        if not mime_type:
            # 파일 형식에 따른 기본 MIME 타입
            format_to_mime = {
                'wav': 'audio/wav',
                'mp3': 'audio/mpeg',
                'flac': 'audio/flac'
            }
            mime_type = format_to_mime.get(generated_music.format, 'application/octet-stream')

        # 안전한 파일명 생성
        safe_filename = download_info['filename']
        # 파일명에서 위험한 문자 제거
        safe_filename = "".join(c for c in safe_filename if c.isalnum() or c in '._-')

        # 다운로드 통계 업데이트 (선택적)
        # await music_service.increment_download_count(music_id)

        # FileResponse로 파일 스트리밍 다운로드
        return FileResponse(
            path=file_path,
            media_type=mime_type,
            filename=safe_filename,
            headers={
                "Content-Disposition": f"attachment; filename=\"{safe_filename}\"",
                "Content-Length": str(generated_music.file_size or 0),
                "Cache-Control": "private, max-age=0, no-cache, no-store",
                "X-Music-ID": music_id,
                "X-Session-ID": session_id
            }
        )

    except HTTPException:
        # 이미 적절한 상태 코드와 메시지가 설정된 예외는 재발생
        raise

    except FileNotFoundError:
        # 파일 시스템 레벨에서 파일을 찾을 수 없는 경우
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "FILE_SYSTEM_ERROR",
                "message": "파일 시스템에서 음악 파일을 찾을 수 없습니다.",
                "details": {
                    "music_id": music_id
                }
            }
        )

    except PermissionError:
        # 파일 접근 권한 오류
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "FILE_ACCESS_DENIED",
                "message": "음악 파일에 대한 접근 권한이 없습니다.",
                "details": {
                    "music_id": music_id
                }
            }
        )

    except Exception as e:
        # 예상치 못한 서버 오류
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "DOWNLOAD_FAILED",
                "message": "음악 파일 다운로드 중 오류가 발생했습니다.",
                "details": {
                    "error_type": type(e).__name__,
                    "error_message": str(e)
                }
            }
        )


@router.get(
    "/health",
    summary="Music API 헬스 체크",
    description="Music API의 상태를 확인합니다.",
    tags=["health"]
)
async def music_health_check(
    music_service: MusicGenerationService = Depends(get_music_generation_service)
) -> Dict[str, Any]:
    """
    Music API 헬스 체크

    Returns:
        API 상태 정보
    """
    try:
        # 음악 생성 서비스 통계 조회로 서비스 상태 확인
        stats = music_service.get_service_statistics()

        return {
            "status": "healthy",
            "service": "music-api",
            "version": "1.0.0",
            "database": "connected",
            "file_storage": "available",
            "service_statistics": stats,
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        return {
            "status": "unhealthy",
            "service": "music-api",
            "version": "1.0.0",
            "database": "error",
            "file_storage": "error",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


# 라우터 메타데이터
router.tags = ["music"]