"""
에러 핸들링 및 예외 처리 미들웨어

전역 예외 처리, 사용자 친화적 에러 응답 생성,
에러 로깅 및 모니터링을 제공합니다.
"""
import logging
import traceback
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, Type, Union

from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError, ResponseValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError, IntegrityError, OperationalError

from src.config import settings
from src.utils.logging import get_security_logger

logger = logging.getLogger(__name__)
security_logger = get_security_logger()


class ErrorTracker:
    """에러 추적 및 통계"""

    def __init__(self):
        self.error_counts = {}
        self.error_history = []
        self.max_history = 1000

    def track_error(self, error_type: str, error_code: str, path: str):
        """에러 발생 추적"""
        error_key = f"{error_type}:{error_code}"

        # 카운트 증가
        if error_key not in self.error_counts:
            self.error_counts[error_key] = 0
        self.error_counts[error_key] += 1

        # 히스토리 추가
        self.error_history.append({
            "timestamp": datetime.utcnow().isoformat(),
            "error_type": error_type,
            "error_code": error_code,
            "path": path,
        })

        # 히스토리 크기 제한
        if len(self.error_history) > self.max_history:
            self.error_history = self.error_history[-self.max_history:]

    def get_error_stats(self) -> Dict[str, Any]:
        """에러 통계 반환"""
        return {
            "error_counts": self.error_counts,
            "total_errors": sum(self.error_counts.values()),
            "recent_errors": self.error_history[-10:],  # 최근 10개
            "history_size": len(self.error_history),
        }

    def get_frequent_errors(self, limit: int = 5) -> list:
        """빈발 에러 목록 반환"""
        sorted_errors = sorted(
            self.error_counts.items(),
            key=lambda x: x[1],
            reverse=True
        )
        return sorted_errors[:limit]


class ErrorResponse:
    """표준화된 에러 응답"""

    @staticmethod
    def create_response(
        error_code: str,
        message: str,
        status_code: int = 500,
        details: Optional[Dict[str, Any]] = None,
        request_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """에러 응답 생성"""
        response_data = {
            "error": {
                "code": error_code,
                "message": message,
                "timestamp": datetime.utcnow().isoformat() + "Z",
            }
        }

        if request_id:
            response_data["error"]["request_id"] = request_id

        if details and settings.ENVIRONMENT == "development":
            response_data["error"]["details"] = details

        if settings.ENVIRONMENT == "production":
            # 프로덕션에서는 민감한 정보 제거
            response_data["error"]["message"] = ErrorResponse._sanitize_message(message)

        return response_data

    @staticmethod
    def _sanitize_message(message: str) -> str:
        """프로덕션용 메시지 정리"""
        # 파일 경로, 스택 트레이스 등 제거
        sensitive_patterns = [
            "/", "\\", "File \"", "line ", "in ", "Traceback",
            "sqlalchemy", "psycopg2", "redis", "httpx"
        ]

        sanitized = message
        for pattern in sensitive_patterns:
            if pattern in sanitized:
                return "서버 내부 오류가 발생했습니다. 관리자에게 문의하세요."

        return sanitized[:200]  # 길이 제한


class GlobalExceptionHandler(BaseHTTPMiddleware):
    """전역 예외 처리 미들웨어"""

    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.error_tracker = ErrorTracker()

    async def dispatch(self, request: Request, call_next):
        """요청 처리 및 예외 처리"""
        request_id = str(uuid.uuid4())

        try:
            # 요청 ID를 상태에 저장
            request.state.request_id = request_id

            response = await call_next(request)

            # 응답 헤더에 요청 ID 추가
            response.headers["X-Request-ID"] = request_id

            return response

        except Exception as exc:
            return await self._handle_exception(request, exc, request_id)

    async def _handle_exception(
        self,
        request: Request,
        exc: Exception,
        request_id: str
    ) -> JSONResponse:
        """예외 처리"""
        try:
            # 예외 정보 수집
            error_info = self._analyze_exception(exc)

            # 에러 추적
            self.error_tracker.track_error(
                error_info["type"],
                error_info["code"],
                request.url.path
            )

            # 보안 관련 에러 특별 처리
            if self._is_security_related(exc):
                await self._handle_security_error(request, exc, request_id)

            # 로깅
            await self._log_exception(request, exc, error_info, request_id)

            # 응답 생성
            return self._create_error_response(error_info, request_id)

        except Exception as handler_exc:
            # 핸들러 자체에서 오류 발생 시 최소한의 응답
            logger.critical(
                f"예외 핸들러에서 오류 발생: {str(handler_exc)}",
                exc_info=True
            )

            return JSONResponse(
                status_code=500,
                content={
                    "error": {
                        "code": "HANDLER_ERROR",
                        "message": "예외 처리 중 오류가 발생했습니다",
                        "request_id": request_id,
                    }
                }
            )

    def _analyze_exception(self, exc: Exception) -> Dict[str, Any]:
        """예외 분석"""
        exc_type = type(exc).__name__
        exc_message = str(exc)

        # HTTP 예외
        if isinstance(exc, (HTTPException, StarletteHTTPException)):
            return {
                "type": "HTTPException",
                "code": f"HTTP_{exc.status_code}",
                "message": exc.detail,
                "status_code": exc.status_code,
                "category": "client_error" if 400 <= exc.status_code < 500 else "server_error"
            }

        # 검증 오류
        elif isinstance(exc, RequestValidationError):
            return {
                "type": "ValidationError",
                "code": "VALIDATION_ERROR",
                "message": "요청 데이터가 유효하지 않습니다",
                "status_code": 422,
                "category": "validation_error",
                "details": exc.errors() if settings.ENVIRONMENT == "development" else None
            }

        # 데이터베이스 오류
        elif isinstance(exc, SQLAlchemyError):
            return self._analyze_db_error(exc)

        # 일반 예외
        else:
            return {
                "type": exc_type,
                "code": "INTERNAL_ERROR",
                "message": exc_message if settings.ENVIRONMENT == "development" else "내부 서버 오류",
                "status_code": 500,
                "category": "server_error"
            }

    def _analyze_db_error(self, exc: SQLAlchemyError) -> Dict[str, Any]:
        """데이터베이스 오류 분석"""
        exc_message = str(exc)

        if isinstance(exc, IntegrityError):
            return {
                "type": "IntegrityError",
                "code": "DATA_INTEGRITY_ERROR",
                "message": "데이터 무결성 제약 조건 위반",
                "status_code": 409,
                "category": "client_error"
            }

        elif isinstance(exc, OperationalError):
            if "connection" in exc_message.lower():
                return {
                    "type": "OperationalError",
                    "code": "DATABASE_CONNECTION_ERROR",
                    "message": "데이터베이스 연결 오류",
                    "status_code": 503,
                    "category": "server_error"
                }

        # 기타 DB 오류
        return {
            "type": "DatabaseError",
            "code": "DATABASE_ERROR",
            "message": "데이터베이스 처리 중 오류가 발생했습니다",
            "status_code": 500,
            "category": "server_error"
        }

    def _is_security_related(self, exc: Exception) -> bool:
        """보안 관련 예외인지 확인"""
        security_indicators = [
            "unauthorized", "forbidden", "authentication", "permission",
            "token", "session", "csrf", "xss", "injection"
        ]

        exc_message = str(exc).lower()
        return any(indicator in exc_message for indicator in security_indicators)

    async def _handle_security_error(
        self,
        request: Request,
        exc: Exception,
        request_id: str
    ):
        """보안 관련 에러 특별 처리"""
        client_ip = request.client.host if request.client else "unknown"

        security_logger.log_suspicious_activity(
            "security_exception",
            {
                "exception_type": type(exc).__name__,
                "exception_message": str(exc),
                "request_path": request.url.path,
                "request_method": request.method,
                "client_ip": client_ip,
                "user_agent": request.headers.get("User-Agent"),
                "request_id": request_id,
            }
        )

    async def _log_exception(
        self,
        request: Request,
        exc: Exception,
        error_info: Dict[str, Any],
        request_id: str
    ):
        """예외 로깅"""
        # 로그 레벨 결정
        if error_info["status_code"] >= 500:
            log_level = logging.ERROR
        elif error_info["status_code"] >= 400:
            log_level = logging.WARNING
        else:
            log_level = logging.INFO

        # 로그 메시지 생성
        log_message = (
            f"예외 발생: {error_info['type']} - "
            f"{request.method} {request.url.path}"
        )

        # 로그 컨텍스트
        log_extra = {
            "exception": {
                "type": error_info["type"],
                "code": error_info["code"],
                "message": error_info["message"],
                "status_code": error_info["status_code"],
                "category": error_info["category"],
                "request_id": request_id,
            },
            "request": {
                "method": request.method,
                "path": request.url.path,
                "query_params": dict(request.query_params),
                "client_ip": request.client.host if request.client else "unknown",
                "user_agent": request.headers.get("User-Agent"),
            }
        }

        # 개발 환경에서는 스택 트레이스 포함
        if settings.ENVIRONMENT == "development":
            log_extra["exception"]["traceback"] = traceback.format_exception(
                type(exc), exc, exc.__traceback__
            )

        logger.log(log_level, log_message, extra=log_extra)

    def _create_error_response(
        self,
        error_info: Dict[str, Any],
        request_id: str
    ) -> JSONResponse:
        """에러 응답 생성"""
        response_content = ErrorResponse.create_response(
            error_code=error_info["code"],
            message=error_info["message"],
            status_code=error_info["status_code"],
            details=error_info.get("details"),
            request_id=request_id
        )

        return JSONResponse(
            status_code=error_info["status_code"],
            content=response_content,
            headers={"X-Request-ID": request_id}
        )

    def get_error_stats(self) -> Dict[str, Any]:
        """에러 통계 반환"""
        return self.error_tracker.get_error_stats()


def create_custom_exception_handlers(app: FastAPI):
    """커스텀 예외 핸들러 등록"""

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        """HTTP 예외 핸들러"""
        request_id = getattr(request.state, "request_id", str(uuid.uuid4()))

        logger.warning(
            f"HTTP 예외: {exc.status_code} - {request.method} {request.url.path}",
            extra={
                "http_exception": {
                    "status_code": exc.status_code,
                    "detail": exc.detail,
                    "request_id": request_id,
                }
            }
        )

        response_content = ErrorResponse.create_response(
            error_code=f"HTTP_{exc.status_code}",
            message=exc.detail,
            status_code=exc.status_code,
            request_id=request_id
        )

        return JSONResponse(
            status_code=exc.status_code,
            content=response_content,
            headers={"X-Request-ID": request_id}
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        """요청 검증 예외 핸들러"""
        request_id = getattr(request.state, "request_id", str(uuid.uuid4()))

        # 검증 오류 상세 정보
        errors = []
        for error in exc.errors():
            errors.append({
                "field": ".".join(str(loc) for loc in error["loc"]),
                "message": error["msg"],
                "type": error["type"],
            })

        logger.info(
            f"요청 검증 실패: {request.method} {request.url.path}",
            extra={
                "validation_error": {
                    "errors": errors,
                    "request_id": request_id,
                }
            }
        )

        response_content = ErrorResponse.create_response(
            error_code="VALIDATION_ERROR",
            message="요청 데이터가 유효하지 않습니다",
            status_code=422,
            details={"validation_errors": errors} if settings.ENVIRONMENT == "development" else None,
            request_id=request_id
        )

        return JSONResponse(
            status_code=422,
            content=response_content,
            headers={"X-Request-ID": request_id}
        )

    @app.exception_handler(500)
    async def internal_server_error_handler(request: Request, exc):
        """내부 서버 오류 핸들러"""
        request_id = getattr(request.state, "request_id", str(uuid.uuid4()))

        logger.error(
            f"내부 서버 오류: {request.method} {request.url.path}",
            exc_info=True,
            extra={"request_id": request_id}
        )

        response_content = ErrorResponse.create_response(
            error_code="INTERNAL_SERVER_ERROR",
            message="내부 서버 오류가 발생했습니다",
            status_code=500,
            request_id=request_id
        )

        return JSONResponse(
            status_code=500,
            content=response_content,
            headers={"X-Request-ID": request_id}
        )


def setup_error_handling(app: FastAPI):
    """에러 핸들링 설정"""
    logger.info("에러 핸들링 미들웨어 설정 시작")

    # 전역 예외 처리 미들웨어 추가
    app.add_middleware(GlobalExceptionHandler)

    # 커스텀 예외 핸들러 등록
    create_custom_exception_handlers(app)

    logger.info("에러 핸들링 미들웨어 설정 완료")


# 전역 에러 핸들러 인스턴스 (통계용)
global_error_handler: Optional[GlobalExceptionHandler] = None


def get_error_handler() -> Optional[GlobalExceptionHandler]:
    """에러 핸들러 인스턴스 반환"""
    return global_error_handler


def set_error_handler(handler: GlobalExceptionHandler):
    """에러 핸들러 인스턴스 설정"""
    global global_error_handler
    global_error_handler = handler


class CustomException(Exception):
    """커스텀 예외 기본 클래스"""

    def __init__(
        self,
        message: str,
        error_code: str = "CUSTOM_ERROR",
        status_code: int = 500,
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        self.details = details or {}


class BusinessLogicError(CustomException):
    """비즈니스 로직 오류"""

    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            error_code="BUSINESS_LOGIC_ERROR",
            status_code=400,
            details=details
        )


class ResourceNotFoundError(CustomException):
    """리소스 없음 오류"""

    def __init__(self, resource_type: str, resource_id: str):
        message = f"{resource_type}을(를) 찾을 수 없습니다: {resource_id}"
        super().__init__(
            message=message,
            error_code="RESOURCE_NOT_FOUND",
            status_code=404,
            details={"resource_type": resource_type, "resource_id": resource_id}
        )


class ServiceUnavailableError(CustomException):
    """서비스 사용 불가 오류"""

    def __init__(self, service_name: str, reason: str):
        message = f"{service_name} 서비스를 사용할 수 없습니다: {reason}"
        super().__init__(
            message=message,
            error_code="SERVICE_UNAVAILABLE",
            status_code=503,
            details={"service_name": service_name, "reason": reason}
        )