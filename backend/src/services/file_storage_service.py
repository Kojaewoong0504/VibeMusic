"""
음악 파일 스토리지 관리 서비스

생성된 음악 파일의 저장, 조회, 삭제 등을 관리하는 서비스입니다.
로컬 파일 시스템 또는 클라우드 스토리지 지원과 파일 메타데이터 관리,
자동 정리 기능을 제공합니다.
"""
import os
import shutil
import logging
import mimetypes
import hashlib
import aiofiles
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, Optional, List, BinaryIO, AsyncIterator
from urllib.parse import urljoin

from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload

from src.config import settings
from src.models.generated_music import GeneratedMusic
from src.models.user_session import UserSession

logger = logging.getLogger(__name__)


class FileStorageError(Exception):
    """파일 스토리지 관련 오류"""
    def __init__(self, message: str, error_code: Optional[str] = None):
        super().__init__(message)
        self.error_code = error_code


class FileStorageService:
    """파일 스토리지 관리 서비스"""

    def __init__(self):
        # 기본 스토리지 설정
        self.base_storage_path = Path("storage/music_files")
        self.temp_storage_path = Path("storage/temp")
        self.max_file_size = 100 * 1024 * 1024  # 100MB
        self.allowed_formats = {"wav", "mp3", "flac", "m4a"}
        self.cleanup_age_hours = 24  # 24시간 후 자동 삭제

        # 디렉토리 생성
        self.base_storage_path.mkdir(parents=True, exist_ok=True)
        self.temp_storage_path.mkdir(parents=True, exist_ok=True)

        logger.info(f"파일 스토리지 서비스 초기화: {self.base_storage_path}")

    def _get_file_path(self, file_id: str, filename: str) -> Path:
        """파일 저장 경로 생성"""
        # 날짜별 디렉토리 구조: YYYY/MM/DD/
        now = datetime.utcnow()
        date_path = now.strftime("%Y/%m/%d")

        # 파일 ID 기반 하위 디렉토리 (분산 저장)
        subdir = file_id[:2]  # 처음 2글자로 서브디렉토리 생성

        full_dir = self.base_storage_path / date_path / subdir
        full_dir.mkdir(parents=True, exist_ok=True)

        return full_dir / f"{file_id}_{filename}"

    def _get_temp_file_path(self, file_id: str, filename: str) -> Path:
        """임시 파일 경로 생성"""
        return self.temp_storage_path / f"{file_id}_{filename}"

    def _validate_file_format(self, filename: str) -> str:
        """파일 형식 유효성 검사"""
        file_path = Path(filename)
        file_extension = file_path.suffix.lower().lstrip('.')

        if not file_extension:
            raise FileStorageError("파일 확장자가 없습니다", "INVALID_FORMAT")

        if file_extension not in self.allowed_formats:
            raise FileStorageError(
                f"지원하지 않는 파일 형식: {file_extension}",
                "UNSUPPORTED_FORMAT"
            )

        return file_extension

    def _calculate_file_hash(self, file_path: Path) -> str:
        """파일 해시 계산 (무결성 검증용)"""
        try:
            hash_sha256 = hashlib.sha256()
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    hash_sha256.update(chunk)
            return hash_sha256.hexdigest()
        except Exception as e:
            logger.error(f"파일 해시 계산 실패: {str(e)}")
            raise FileStorageError(f"파일 해시 계산 실패: {str(e)}")

    async def save_file_from_url(
        self,
        file_url: str,
        generated_music: GeneratedMusic,
        filename: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        URL에서 파일을 다운로드하여 저장

        Args:
            file_url: 다운로드할 파일 URL
            generated_music: 저장할 음악 모델
            filename: 파일명 (없으면 자동 생성)

        Returns:
            저장된 파일 정보
        """
        import httpx

        try:
            # 파일명 생성
            if not filename:
                file_format = generated_music.format or "wav"
                filename = f"vibemusic_{generated_music.id}.{file_format}"

            # 파일 형식 검증
            file_extension = self._validate_file_format(filename)

            # 임시 파일 경로
            temp_path = self._get_temp_file_path(generated_music.id, filename)

            logger.info(f"파일 다운로드 시작: {file_url} -> {temp_path}")

            # HTTP 클라이언트로 파일 다운로드
            async with httpx.AsyncClient(timeout=300.0) as client:
                async with client.stream('GET', file_url) as response:
                    response.raise_for_status()

                    # 파일 크기 확인
                    content_length = response.headers.get('content-length')
                    if content_length and int(content_length) > self.max_file_size:
                        raise FileStorageError(
                            f"파일 크기가 너무 큽니다: {content_length} bytes",
                            "FILE_TOO_LARGE"
                        )

                    # 임시 파일에 저장
                    total_size = 0
                    async with aiofiles.open(temp_path, 'wb') as f:
                        async for chunk in response.aiter_bytes(chunk_size=8192):
                            total_size += len(chunk)
                            if total_size > self.max_file_size:
                                raise FileStorageError(
                                    "파일 크기가 제한을 초과했습니다",
                                    "FILE_TOO_LARGE"
                                )
                            await f.write(chunk)

            # 실제 저장 경로로 이동
            final_path = self._get_file_path(generated_music.id, filename)
            temp_path.rename(final_path)

            # 파일 정보 수집
            file_stats = final_path.stat()
            file_hash = self._calculate_file_hash(final_path)

            # MIME 타입 확인
            mime_type, _ = mimetypes.guess_type(str(final_path))

            file_info = {
                "file_path": str(final_path),
                "file_size": file_stats.st_size,
                "file_hash": file_hash,
                "mime_type": mime_type or f"audio/{file_extension}",
                "created_at": datetime.utcnow(),
                "storage_type": "local"
            }

            logger.info(
                f"파일 저장 완료: {generated_music.id}, "
                f"size={file_stats.st_size} bytes, path={final_path}"
            )

            return file_info

        except httpx.HTTPStatusError as e:
            error_msg = f"파일 다운로드 실패: HTTP {e.response.status_code}"
            logger.error(error_msg)
            raise FileStorageError(error_msg, "DOWNLOAD_FAILED")

        except httpx.TimeoutException:
            error_msg = "파일 다운로드 타임아웃"
            logger.error(error_msg)
            raise FileStorageError(error_msg, "DOWNLOAD_TIMEOUT")

        except Exception as e:
            # 임시 파일 정리
            if temp_path.exists():
                temp_path.unlink()

            error_msg = f"파일 저장 실패: {str(e)}"
            logger.error(error_msg, exc_info=True)
            raise FileStorageError(error_msg)

    async def save_file_from_binary(
        self,
        file_data: bytes,
        generated_music: GeneratedMusic,
        filename: str
    ) -> Dict[str, Any]:
        """
        바이너리 데이터에서 파일 저장

        Args:
            file_data: 파일 바이너리 데이터
            generated_music: 저장할 음악 모델
            filename: 파일명

        Returns:
            저장된 파일 정보
        """
        try:
            # 파일 형식 검증
            file_extension = self._validate_file_format(filename)

            # 파일 크기 확인
            if len(file_data) > self.max_file_size:
                raise FileStorageError(
                    f"파일 크기가 너무 큽니다: {len(file_data)} bytes",
                    "FILE_TOO_LARGE"
                )

            # 저장 경로
            file_path = self._get_file_path(generated_music.id, filename)

            # 파일 저장
            async with aiofiles.open(file_path, 'wb') as f:
                await f.write(file_data)

            # 파일 정보 수집
            file_stats = file_path.stat()
            file_hash = self._calculate_file_hash(file_path)

            # MIME 타입 확인
            mime_type, _ = mimetypes.guess_type(str(file_path))

            file_info = {
                "file_path": str(file_path),
                "file_size": file_stats.st_size,
                "file_hash": file_hash,
                "mime_type": mime_type or f"audio/{file_extension}",
                "created_at": datetime.utcnow(),
                "storage_type": "local"
            }

            logger.info(
                f"바이너리 파일 저장 완료: {generated_music.id}, "
                f"size={file_stats.st_size} bytes"
            )

            return file_info

        except Exception as e:
            error_msg = f"바이너리 파일 저장 실패: {str(e)}"
            logger.error(error_msg, exc_info=True)
            raise FileStorageError(error_msg)

    def get_file_info(self, generated_music: GeneratedMusic) -> Optional[Dict[str, Any]]:
        """파일 정보 조회"""
        try:
            if not generated_music.file_url:
                return None

            # 로컬 파일 경로 추출
            filename = f"vibemusic_{generated_music.id}.{generated_music.format}"
            file_path = self._get_file_path(generated_music.id, filename)

            if not file_path.exists():
                logger.warning(f"파일이 존재하지 않음: {file_path}")
                return None

            # 파일 정보 수집
            file_stats = file_path.stat()
            mime_type, _ = mimetypes.guess_type(str(file_path))

            return {
                "file_path": str(file_path),
                "file_size": file_stats.st_size,
                "mime_type": mime_type,
                "created_at": datetime.fromtimestamp(file_stats.st_ctime),
                "modified_at": datetime.fromtimestamp(file_stats.st_mtime),
                "exists": True,
                "storage_type": "local"
            }

        except Exception as e:
            logger.error(f"파일 정보 조회 실패: {str(e)}")
            return None

    async def stream_file(self, generated_music: GeneratedMusic) -> StreamingResponse:
        """파일 스트리밍 응답 생성"""
        try:
            file_info = self.get_file_info(generated_music)
            if not file_info:
                raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다")

            file_path = Path(file_info["file_path"])
            filename = f"vibemusic_{generated_music.id}.{generated_music.format}"

            async def file_generator():
                async with aiofiles.open(file_path, 'rb') as f:
                    while chunk := await f.read(8192):
                        yield chunk

            headers = {
                "Content-Length": str(file_info["file_size"]),
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Cache-Control": "public, max-age=3600"
            }

            return StreamingResponse(
                file_generator(),
                media_type=file_info["mime_type"],
                headers=headers
            )

        except Exception as e:
            logger.error(f"파일 스트리밍 실패: {str(e)}")
            raise HTTPException(status_code=500, detail="파일 스트리밍 실패")

    async def delete_file(self, generated_music: GeneratedMusic) -> bool:
        """파일 삭제"""
        try:
            file_info = self.get_file_info(generated_music)
            if not file_info:
                logger.warning(f"삭제할 파일이 없음: {generated_music.id}")
                return True  # 이미 없으므로 성공으로 처리

            file_path = Path(file_info["file_path"])
            file_path.unlink()

            logger.info(f"파일 삭제 완료: {file_path}")
            return True

        except Exception as e:
            logger.error(f"파일 삭제 실패: {str(e)}")
            return False

    async def cleanup_expired_files(self, db: AsyncSession) -> Dict[str, Any]:
        """만료된 파일들 자동 정리"""
        try:
            cutoff_time = datetime.utcnow() - timedelta(hours=self.cleanup_age_hours)
            cleanup_stats = {
                "deleted_files": 0,
                "freed_bytes": 0,
                "errors": 0,
                "processed_sessions": 0
            }

            # 만료된 세션의 생성된 음악 조회
            stmt = (
                select(GeneratedMusic)
                .join(UserSession)
                .where(UserSession.created_at < cutoff_time)
                .options(selectinload(GeneratedMusic.music_prompt))
            )

            result = await db.execute(stmt)
            expired_music = result.scalars().all()

            logger.info(f"만료된 음악 파일 {len(expired_music)}개 정리 시작")

            for music in expired_music:
                try:
                    # 파일 크기 확인 (삭제 전)
                    file_info = self.get_file_info(music)
                    file_size = file_info["file_size"] if file_info else 0

                    # 파일 삭제
                    if await self.delete_file(music):
                        cleanup_stats["deleted_files"] += 1
                        cleanup_stats["freed_bytes"] += file_size

                        # 데이터베이스에서도 삭제
                        await db.delete(music)

                except Exception as e:
                    cleanup_stats["errors"] += 1
                    logger.error(f"파일 정리 실패: {music.id}, {str(e)}")

            # 변경사항 커밋
            await db.commit()

            # 빈 디렉토리 정리
            self._cleanup_empty_directories()

            cleanup_stats["processed_sessions"] = len(expired_music)

            logger.info(
                f"파일 정리 완료: {cleanup_stats['deleted_files']}개 파일, "
                f"{cleanup_stats['freed_bytes']} bytes 정리"
            )

            return cleanup_stats

        except Exception as e:
            await db.rollback()
            logger.error(f"파일 정리 중 오류: {str(e)}", exc_info=True)
            raise FileStorageError(f"파일 정리 실패: {str(e)}")

    def _cleanup_empty_directories(self):
        """빈 디렉토리 정리"""
        try:
            for root, dirs, files in os.walk(str(self.base_storage_path), topdown=False):
                if not files and not dirs:
                    root_path = Path(root)
                    if root_path != self.base_storage_path:  # 루트 디렉토리는 유지
                        root_path.rmdir()
                        logger.debug(f"빈 디렉토리 삭제: {root_path}")

        except Exception as e:
            logger.error(f"빈 디렉토리 정리 실패: {str(e)}")

    def get_storage_stats(self) -> Dict[str, Any]:
        """스토리지 통계 정보"""
        try:
            total_size = 0
            file_count = 0

            for file_path in self.base_storage_path.rglob("*"):
                if file_path.is_file():
                    file_count += 1
                    total_size += file_path.stat().st_size

            # 디스크 사용량 (전체 시스템)
            total, used, free = shutil.disk_usage(str(self.base_storage_path))

            return {
                "storage_path": str(self.base_storage_path),
                "total_files": file_count,
                "total_size_bytes": total_size,
                "total_size_mb": round(total_size / (1024 * 1024), 2),
                "disk_total_gb": round(total / (1024 ** 3), 2),
                "disk_used_gb": round(used / (1024 ** 3), 2),
                "disk_free_gb": round(free / (1024 ** 3), 2),
                "disk_usage_percent": round((used / total) * 100, 2),
                "max_file_size_mb": self.max_file_size / (1024 * 1024),
                "allowed_formats": list(self.allowed_formats),
                "cleanup_age_hours": self.cleanup_age_hours
            }

        except Exception as e:
            logger.error(f"스토리지 통계 조회 실패: {str(e)}")
            return {"error": str(e)}

    async def verify_file_integrity(self, generated_music: GeneratedMusic) -> bool:
        """파일 무결성 검증"""
        try:
            file_info = self.get_file_info(generated_music)
            if not file_info:
                return False

            file_path = Path(file_info["file_path"])

            # 파일 크기 확인
            actual_size = file_path.stat().st_size
            expected_size = generated_music.file_size

            if expected_size and actual_size != expected_size:
                logger.warning(
                    f"파일 크기 불일치: {generated_music.id}, "
                    f"expected={expected_size}, actual={actual_size}"
                )
                return False

            # 파일 형식 확인
            file_extension = file_path.suffix.lower().lstrip('.')
            if file_extension != generated_music.format:
                logger.warning(
                    f"파일 형식 불일치: {generated_music.id}, "
                    f"expected={generated_music.format}, actual={file_extension}"
                )
                return False

            return True

        except Exception as e:
            logger.error(f"파일 무결성 검증 실패: {str(e)}")
            return False

    def get_service_info(self) -> Dict[str, Any]:
        """서비스 정보 반환"""
        return {
            "service_name": "File Storage Service",
            "storage_type": "local",
            "base_path": str(self.base_storage_path),
            "temp_path": str(self.temp_storage_path),
            "max_file_size_mb": self.max_file_size / (1024 * 1024),
            "allowed_formats": list(self.allowed_formats),
            "cleanup_age_hours": self.cleanup_age_hours,
            "version": settings.APP_VERSION
        }


# 전역 서비스 인스턴스
file_storage_service = FileStorageService()


async def get_file_storage_service() -> FileStorageService:
    """파일 스토리지 서비스 인스턴스 반환 (의존성 주입용)"""
    return file_storage_service