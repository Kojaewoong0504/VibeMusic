"""
구조화된 로깅 설정

JSON 형태의 구조화된 로그 출력과 성능 모니터링,
보안 이벤트 로깅을 제공합니다.
"""
import json
import logging
import logging.config
import sys
import time
import traceback
from datetime import datetime
from typing import Dict, Any, Optional
from pathlib import Path
from contextlib import contextmanager

from fastapi import Request, Response
import uvicorn

from src.config import settings


class JSONFormatter(logging.Formatter):
    """JSON 형태로 로그를 포맷하는 포매터"""

    def __init__(self):
        super().__init__()
        self.hostname = self._get_hostname()

    def _get_hostname(self) -> str:
        """호스트명 획득"""
        try:
            import socket
            return socket.gethostname()
        except:
            return "unknown"

    def format(self, record: logging.LogRecord) -> str:
        """로그 레코드를 JSON으로 포맷"""
        try:
            # 기본 로그 데이터
            log_data = {
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "level": record.levelname,
                "logger": record.name,
                "message": record.getMessage(),
                "hostname": self.hostname,
                "process_id": record.process,
                "thread_id": record.thread,
            }

            # 파일 정보 (개발 환경에서만)
            if settings.ENVIRONMENT == "development":
                log_data.update({
                    "filename": record.filename,
                    "line_number": record.lineno,
                    "function_name": record.funcName,
                })

            # 예외 정보 추가
            if record.exc_info:
                log_data["exception"] = {
                    "type": record.exc_info[0].__name__ if record.exc_info[0] else None,
                    "message": str(record.exc_info[1]) if record.exc_info[1] else None,
                    "traceback": traceback.format_exception(*record.exc_info),
                }

            # 사용자 정의 필드 추가
            extra_fields = {}
            for key, value in record.__dict__.items():
                if key not in [
                    'name', 'msg', 'args', 'levelname', 'levelno', 'pathname',
                    'filename', 'module', 'lineno', 'funcName', 'created',
                    'msecs', 'relativeCreated', 'thread', 'threadName',
                    'processName', 'process', 'exc_info', 'exc_text', 'stack_info'
                ]:
                    extra_fields[key] = value

            if extra_fields:
                log_data["extra"] = extra_fields

            return json.dumps(log_data, ensure_ascii=False, default=str)

        except Exception as e:
            # 포맷팅 실패 시 기본 메시지 반환
            fallback_data = {
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "level": "ERROR",
                "logger": "logging_formatter",
                "message": f"로그 포맷팅 실패: {str(e)}",
                "original_message": str(record.msg),
            }
            return json.dumps(fallback_data, ensure_ascii=False)


class PlainFormatter(logging.Formatter):
    """개발 환경용 일반 텍스트 포매터"""

    def __init__(self):
        super().__init__(
            fmt="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )


class RequestLoggingFilter(logging.Filter):
    """요청 관련 로그 필터"""

    def filter(self, record: logging.LogRecord) -> bool:
        """민감한 정보 필터링"""
        message = record.getMessage().lower()

        # 민감한 정보가 포함된 로그 필터링
        sensitive_patterns = [
            "password", "token", "secret", "key", "authorization",
            "cookie", "session", "csrf", "api_key"
        ]

        for pattern in sensitive_patterns:
            if pattern in message:
                record.msg = "[FILTERED] 민감한 정보가 포함된 로그"
                record.args = ()
                break

        return True


class PerformanceLogger:
    """성능 측정 및 로깅"""

    def __init__(self, logger_name: str = "performance"):
        self.logger = logging.getLogger(logger_name)

    @contextmanager
    def measure_time(self, operation: str, **context):
        """실행 시간 측정 컨텍스트 매니저"""
        start_time = time.perf_counter()
        start_memory = self._get_memory_usage()

        try:
            yield

        finally:
            end_time = time.perf_counter()
            end_memory = self._get_memory_usage()

            duration = end_time - start_time
            memory_delta = end_memory - start_memory if start_memory and end_memory else None

            self.logger.info(
                f"성능 측정: {operation}",
                extra={
                    "performance": {
                        "operation": operation,
                        "duration_seconds": round(duration, 4),
                        "memory_delta_mb": round(memory_delta / 1024 / 1024, 2) if memory_delta else None,
                        "start_memory_mb": round(start_memory / 1024 / 1024, 2) if start_memory else None,
                        "end_memory_mb": round(end_memory / 1024 / 1024, 2) if end_memory else None,
                        "context": context,
                    }
                }
            )

    def _get_memory_usage(self) -> Optional[int]:
        """현재 메모리 사용량 조회 (바이트)"""
        try:
            import psutil
            process = psutil.Process()
            return process.memory_info().rss
        except ImportError:
            return None
        except Exception:
            return None

    def log_slow_query(self, query: str, duration: float, params: Optional[Dict] = None):
        """느린 쿼리 로깅"""
        self.logger.warning(
            f"느린 쿼리 감지: {duration:.3f}초",
            extra={
                "slow_query": {
                    "duration_seconds": duration,
                    "query": query[:500] + "..." if len(query) > 500 else query,
                    "parameters": params,
                }
            }
        )

    def log_api_performance(self, method: str, path: str, status_code: int, duration: float, **context):
        """API 성능 로깅"""
        self.logger.info(
            f"API 응답: {method} {path} - {status_code} ({duration:.3f}초)",
            extra={
                "api_performance": {
                    "method": method,
                    "path": path,
                    "status_code": status_code,
                    "duration_seconds": duration,
                    "context": context,
                }
            }
        )


class SecurityLogger:
    """보안 이벤트 로깅"""

    def __init__(self, logger_name: str = "security"):
        self.logger = logging.getLogger(logger_name)

    def log_auth_attempt(self, success: bool, session_id: Optional[str] = None, **context):
        """인증 시도 로깅"""
        level = logging.INFO if success else logging.WARNING
        message = "인증 성공" if success else "인증 실패"

        self.logger.log(
            level,
            message,
            extra={
                "security_event": {
                    "type": "authentication",
                    "success": success,
                    "session_id": session_id,
                    "context": context,
                }
            }
        )

    def log_suspicious_activity(self, activity_type: str, details: Dict[str, Any], **context):
        """의심스러운 활동 로깅"""
        self.logger.warning(
            f"의심스러운 활동 감지: {activity_type}",
            extra={
                "security_event": {
                    "type": "suspicious_activity",
                    "activity_type": activity_type,
                    "details": details,
                    "context": context,
                }
            }
        )

    def log_security_violation(self, violation_type: str, details: Dict[str, Any], **context):
        """보안 위반 로깅"""
        self.logger.error(
            f"보안 위반: {violation_type}",
            extra={
                "security_event": {
                    "type": "security_violation",
                    "violation_type": violation_type,
                    "details": details,
                    "context": context,
                }
            }
        )


class LoggingConfig:
    """로깅 설정 관리"""

    def __init__(self):
        self.log_level = settings.LOG_LEVEL.upper()
        self.log_format = settings.LOG_FORMAT.lower()
        self.log_dir = Path("logs")

    def setup_logging(self):
        """로깅 설정 초기화"""
        # 로그 디렉토리 생성
        self.log_dir.mkdir(exist_ok=True)

        # 로그 설정 구성
        logging_config = {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "json": {"()": JSONFormatter},
                "plain": {"()": PlainFormatter},
            },
            "filters": {
                "request_filter": {"()": RequestLoggingFilter},
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": self.log_format,
                    "stream": sys.stdout,
                    "filters": ["request_filter"],
                },
                "file": {
                    "class": "logging.handlers.RotatingFileHandler",
                    "filename": str(self.log_dir / "vibemusic.log"),
                    "maxBytes": 10 * 1024 * 1024,  # 10MB
                    "backupCount": 5,
                    "formatter": "json",
                    "filters": ["request_filter"],
                },
                "error_file": {
                    "class": "logging.handlers.RotatingFileHandler",
                    "filename": str(self.log_dir / "errors.log"),
                    "maxBytes": 10 * 1024 * 1024,  # 10MB
                    "backupCount": 10,
                    "formatter": "json",
                    "level": "ERROR",
                },
                "security_file": {
                    "class": "logging.handlers.RotatingFileHandler",
                    "filename": str(self.log_dir / "security.log"),
                    "maxBytes": 50 * 1024 * 1024,  # 50MB
                    "backupCount": 20,
                    "formatter": "json",
                    "level": "WARNING",
                },
            },
            "loggers": {
                # 애플리케이션 로거
                "src": {
                    "level": self.log_level,
                    "handlers": ["console", "file"],
                    "propagate": False,
                },
                # 성능 로거
                "performance": {
                    "level": "INFO",
                    "handlers": ["console", "file"],
                    "propagate": False,
                },
                # 보안 로거
                "security": {
                    "level": "WARNING",
                    "handlers": ["console", "security_file"],
                    "propagate": False,
                },
                # 에러 로거
                "error": {
                    "level": "ERROR",
                    "handlers": ["console", "error_file"],
                    "propagate": False,
                },
                # 외부 라이브러리 로거
                "uvicorn": {
                    "level": "INFO",
                    "handlers": ["console"],
                    "propagate": False,
                },
                "sqlalchemy": {
                    "level": "WARNING" if settings.ENVIRONMENT == "production" else "INFO",
                    "handlers": ["console", "file"],
                    "propagate": False,
                },
                "httpx": {
                    "level": "WARNING",
                    "handlers": ["console", "file"],
                    "propagate": False,
                },
            },
            "root": {
                "level": self.log_level,
                "handlers": ["console", "file", "error_file"],
            },
        }

        # 로깅 설정 적용
        logging.config.dictConfig(logging_config)

        # 시작 로그
        logger = logging.getLogger("src.logging")
        logger.info(
            f"로깅 시스템 초기화 완료",
            extra={
                "config": {
                    "log_level": self.log_level,
                    "log_format": self.log_format,
                    "log_directory": str(self.log_dir),
                    "environment": settings.ENVIRONMENT,
                }
            }
        )

    def configure_uvicorn_logging(self):
        """Uvicorn 로깅 설정"""
        uvicorn_config = {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "()": "uvicorn.logging.DefaultFormatter",
                    "fmt": "%(levelprefix)s %(message)s",
                    "use_colors": None,
                },
                "access": {
                    "()": "uvicorn.logging.AccessFormatter",
                    "fmt": '%(levelprefix)s %(client_addr)s - "%(request_line)s" %(status_code)s',
                },
            },
            "handlers": {
                "default": {
                    "formatter": "default",
                    "class": "logging.StreamHandler",
                    "stream": "ext://sys.stdout",
                },
                "access": {
                    "formatter": "access",
                    "class": "logging.StreamHandler",
                    "stream": "ext://sys.stdout",
                },
            },
            "loggers": {
                "uvicorn": {"handlers": ["default"], "level": "INFO"},
                "uvicorn.error": {"level": "INFO"},
                "uvicorn.access": {"handlers": ["access"], "level": "INFO", "propagate": False},
            },
        }

        return uvicorn_config


# 전역 로깅 설정 및 유틸리티 인스턴스
logging_config = LoggingConfig()
performance_logger = PerformanceLogger()
security_logger = SecurityLogger()


def setup_application_logging():
    """애플리케이션 로깅 설정"""
    logging_config.setup_logging()


def get_performance_logger() -> PerformanceLogger:
    """성능 로거 인스턴스 반환"""
    return performance_logger


def get_security_logger() -> SecurityLogger:
    """보안 로거 인스턴스 반환"""
    return security_logger


def log_request_response(request: Request, response: Response, duration: float):
    """HTTP 요청/응답 로깅"""
    logger = logging.getLogger("src.api")

    # 민감한 경로 필터링
    sensitive_paths = ["/docs", "/redoc", "/openapi.json"]
    if any(request.url.path.startswith(path) for path in sensitive_paths):
        return

    # 성능 로깅
    performance_logger.log_api_performance(
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        duration=duration,
        query_params=dict(request.query_params),
        user_agent=request.headers.get("User-Agent", "unknown")[:100],
    )

    # 에러 상태 코드 로깅
    if response.status_code >= 400:
        logger.warning(
            f"HTTP 에러 응답: {request.method} {request.url.path} - {response.status_code}",
            extra={
                "http_error": {
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "duration_seconds": duration,
                    "client_ip": request.client.host if request.client else "unknown",
                }
            }
        )


def get_logging_stats() -> Dict[str, Any]:
    """로깅 통계 정보"""
    try:
        log_files = list(logging_config.log_dir.glob("*.log"))

        stats = {
            "log_directory": str(logging_config.log_dir),
            "log_level": logging_config.log_level,
            "log_format": logging_config.log_format,
            "log_files": [],
        }

        for log_file in log_files:
            file_stats = log_file.stat()
            stats["log_files"].append({
                "filename": log_file.name,
                "size_mb": round(file_stats.st_size / 1024 / 1024, 2),
                "modified": datetime.fromtimestamp(file_stats.st_mtime).isoformat(),
            })

        return stats

    except Exception as e:
        return {"error": str(e)}


class AsyncRequestLoggingMiddleware:
    """비동기 요청 로깅 미들웨어"""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        start_time = time.perf_counter()

        async def send_with_logging(message):
            if message["type"] == "http.response.start":
                # 응답 헤더에 요청 ID 추가 (추적 용도)
                headers = list(message.get("headers", []))
                request_id = f"req_{int(time.time() * 1000)}"
                headers.append([b"x-request-id", request_id.encode()])
                message["headers"] = headers

            elif message["type"] == "http.response.body" and not message.get("more_body", False):
                # 응답 완료 시 로깅
                duration = time.perf_counter() - start_time

                # 요청 정보 구성
                request = Request(scope, receive)
                response_status = message.get("status", 200)

                # 로깅 수행
                logger = logging.getLogger("src.middleware.request")
                logger.info(
                    f"요청 처리 완료: {request.method} {request.url.path}",
                    extra={
                        "request": {
                            "method": request.method,
                            "path": request.url.path,
                            "duration_seconds": round(duration, 4),
                            "status_code": response_status,
                            "client_ip": scope.get("client", ["unknown"])[0],
                        }
                    }
                )

            await send(message)

        await self.app(scope, receive, send_with_logging)