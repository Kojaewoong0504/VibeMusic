"""
보안 헤더 및 CORS 설정 미들웨어

웹 애플리케이션 보안 강화를 위한 HTTP 헤더 설정과
CORS(Cross-Origin Resource Sharing) 정책을 관리합니다.
"""
import logging
from typing import List, Dict, Any, Callable
from urllib.parse import urlparse

from fastapi import Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from src.config import settings

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """보안 헤더 설정 미들웨어"""

    def __init__(self, app: ASGIApp):
        super().__init__(app)

        # 보안 헤더 설정
        self.security_headers = {
            # XSS 보호
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",

            # HTTPS 강제 (프로덕션)
            "Strict-Transport-Security": (
                "max-age=31536000; includeSubDomains; preload"
                if settings.ENVIRONMENT == "production"
                else "max-age=0"
            ),

            # 컨텐츠 보안 정책
            "Content-Security-Policy": self._build_csp_policy(),

            # 추가 보안 헤더
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Permissions-Policy": "geolocation=(), microphone=(), camera=()",

            # 애플리케이션 정보 숨김
            "Server": "VibeMusic",
        }

        logger.info("보안 헤더 미들웨어 초기화 완료")

    def _build_csp_policy(self) -> str:
        """Content Security Policy 구성"""
        # 기본 보안 정책
        csp_directives = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  # React 개발 모드 지원
            "style-src 'self' 'unsafe-inline'",  # CSS-in-JS 지원
            "img-src 'self' data: https:",
            "font-src 'self' data:",
            "connect-src 'self' ws: wss:",  # WebSocket 지원
            "media-src 'self' blob:",  # 음악 파일 재생 지원
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
        ]

        # 개발 환경에서는 더 관대한 정책
        if settings.ENVIRONMENT == "development":
            csp_directives = [
                directive.replace("'self'", "'self' localhost:* 127.0.0.1:*")
                for directive in csp_directives
            ]

        return "; ".join(csp_directives)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """요청 처리 및 보안 헤더 추가"""
        try:
            # 요청 전 로깅 (민감한 정보 제외)
            self._log_request_info(request)

            # 다음 미들웨어/엔드포인트 호출
            response = await call_next(request)

            # 보안 헤더 추가
            for header, value in self.security_headers.items():
                response.headers[header] = value

            # 개발 환경에서 CORS 프리플라이트 응답 개선
            if settings.ENVIRONMENT == "development" and request.method == "OPTIONS":
                response.headers["Access-Control-Max-Age"] = "3600"

            return response

        except Exception as e:
            logger.error(f"보안 미들웨어 처리 중 오류: {str(e)}", exc_info=True)
            # 오류 발생 시에도 기본 보안 헤더는 추가
            response = Response(
                content="Internal Server Error",
                status_code=500,
                headers=self.security_headers
            )
            return response

    def _log_request_info(self, request: Request) -> None:
        """요청 정보 로깅 (보안 관련)"""
        try:
            # 기본 요청 정보
            client_ip = self._get_client_ip(request)
            user_agent = request.headers.get("User-Agent", "unknown")

            # 보안 관련 헤더 확인
            security_headers = {
                "origin": request.headers.get("Origin"),
                "referer": request.headers.get("Referer"),
                "x_forwarded_for": request.headers.get("X-Forwarded-For"),
                "x_real_ip": request.headers.get("X-Real-IP"),
            }

            # 의심스러운 요청 패턴 감지
            suspicious_patterns = self._detect_suspicious_patterns(request)

            if suspicious_patterns:
                logger.warning(
                    f"의심스러운 요청 패턴 감지: {request.method} {request.url.path}, "
                    f"client_ip={client_ip}, patterns={suspicious_patterns}"
                )

            # 디버그 모드에서만 상세 로깅
            if settings.LOG_LEVEL == "DEBUG":
                logger.debug(
                    f"보안 요청 정보: {request.method} {request.url.path}, "
                    f"client_ip={client_ip}, "
                    f"user_agent={user_agent[:100]}..., "
                    f"security_headers={security_headers}"
                )

        except Exception as e:
            logger.error(f"요청 정보 로깅 실패: {str(e)}")

    def _get_client_ip(self, request: Request) -> str:
        """실제 클라이언트 IP 추출"""
        # 프록시 헤더들을 순서대로 확인
        for header in ["X-Forwarded-For", "X-Real-IP", "X-Client-IP"]:
            if header in request.headers:
                ip = request.headers[header].split(',')[0].strip()
                if ip:
                    return ip

        # 직접 연결된 클라이언트 IP
        return request.client.host if request.client else "unknown"

    def _detect_suspicious_patterns(self, request: Request) -> List[str]:
        """의심스러운 요청 패턴 감지"""
        patterns = []

        try:
            path = request.url.path.lower()
            query = str(request.url.query).lower()
            user_agent = request.headers.get("User-Agent", "").lower()

            # SQL Injection 패턴
            sql_patterns = ["'", "union", "select", "insert", "drop", "delete", "--", "/*"]
            if any(pattern in path or pattern in query for pattern in sql_patterns):
                patterns.append("potential_sql_injection")

            # XSS 패턴
            xss_patterns = ["<script", "javascript:", "onerror", "onload", "alert("]
            if any(pattern in path or pattern in query for pattern in xss_patterns):
                patterns.append("potential_xss")

            # 경로 순회 패턴
            if "../" in path or "..\\" in path:
                patterns.append("path_traversal")

            # 봇/크롤러 감지
            bot_patterns = ["bot", "crawler", "spider", "scraper", "curl", "wget"]
            if any(pattern in user_agent for pattern in bot_patterns):
                patterns.append("automated_client")

            # 비정상적으로 긴 요청
            if len(path) > 1000 or len(query) > 2000:
                patterns.append("abnormally_long_request")

        except Exception as e:
            logger.error(f"의심 패턴 감지 실패: {str(e)}")

        return patterns


class CORSConfigManager:
    """CORS 설정 관리자"""

    def __init__(self):
        self.allowed_origins = self._get_allowed_origins()
        self.allowed_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
        self.allowed_headers = [
            "Accept",
            "Accept-Language",
            "Content-Language",
            "Content-Type",
            "Authorization",
            "X-Requested-With",
            "X-Session-Token",
        ]
        self.expose_headers = [
            "Content-Length",
            "Content-Type",
            "X-RateLimit-Remaining",
            "X-RateLimit-Limit",
        ]
        self.allow_credentials = True
        self.max_age = 600  # 10분

    def _get_allowed_origins(self) -> List[str]:
        """허용된 오리진 목록 구성"""
        origins = []

        # 설정된 CORS 오리진들
        if settings.CORS_ORIGINS:
            origins.extend(settings.CORS_ORIGINS)

        # 환경별 추가 설정
        if settings.ENVIRONMENT == "development":
            # 개발 환경 오리진들
            dev_origins = [
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "http://localhost:3001",
                "http://127.0.0.1:3001",
            ]
            origins.extend(dev_origins)

        elif settings.ENVIRONMENT == "production":
            # 프로덕션에서는 명시적으로 설정된 오리진만 허용
            if not origins:
                logger.warning("프로덕션 환경에서 CORS_ORIGINS가 설정되지 않았습니다")

        # 중복 제거 및 유효성 검사
        validated_origins = []
        for origin in set(origins):
            if self._validate_origin(origin):
                validated_origins.append(origin)

        logger.info(f"CORS 허용 오리진: {validated_origins}")
        return validated_origins

    def _validate_origin(self, origin: str) -> bool:
        """오리진 유효성 검사"""
        try:
            parsed = urlparse(origin)

            # 스키마 확인
            if parsed.scheme not in ["http", "https"]:
                logger.warning(f"잘못된 CORS 오리진 스키마: {origin}")
                return False

            # 호스트 확인
            if not parsed.netloc:
                logger.warning(f"잘못된 CORS 오리진 호스트: {origin}")
                return False

            return True

        except Exception as e:
            logger.error(f"CORS 오리진 검증 실패: {origin}, {str(e)}")
            return False

    def get_cors_middleware_config(self) -> Dict[str, Any]:
        """CORS 미들웨어 설정 반환"""
        return {
            "allow_origins": self.allowed_origins,
            "allow_credentials": self.allow_credentials,
            "allow_methods": self.allowed_methods,
            "allow_headers": self.allowed_headers,
            "expose_headers": self.expose_headers,
            "max_age": self.max_age,
        }

    def is_origin_allowed(self, origin: str) -> bool:
        """특정 오리진 허용 여부 확인"""
        if not origin:
            return False

        # 정확한 매칭
        if origin in self.allowed_origins:
            return True

        # 개발 환경에서는 localhost 패턴 매칭
        if settings.ENVIRONMENT == "development":
            if origin.startswith("http://localhost:") or origin.startswith("http://127.0.0.1:"):
                return True

        return False

    def log_cors_request(self, request: Request) -> None:
        """CORS 요청 로깅"""
        try:
            origin = request.headers.get("Origin")
            method = request.method

            if method == "OPTIONS":
                # 프리플라이트 요청
                requested_method = request.headers.get("Access-Control-Request-Method")
                requested_headers = request.headers.get("Access-Control-Request-Headers")

                logger.debug(
                    f"CORS 프리플라이트 요청: origin={origin}, "
                    f"method={requested_method}, headers={requested_headers}"
                )

                if not self.is_origin_allowed(origin):
                    logger.warning(f"허용되지 않은 CORS 오리진: {origin}")

            elif origin and origin not in self.allowed_origins:
                logger.info(f"CORS 실제 요청: {method} {request.url.path}, origin={origin}")

        except Exception as e:
            logger.error(f"CORS 요청 로깅 실패: {str(e)}")


# CORS 설정 관리자 인스턴스
cors_manager = CORSConfigManager()


def setup_security_middleware(app):
    """보안 미들웨어 설정"""
    logger.info("보안 미들웨어 설정 시작")

    # CORS 미들웨어 추가
    cors_config = cors_manager.get_cors_middleware_config()
    app.add_middleware(CORSMiddleware, **cors_config)

    # 보안 헤더 미들웨어 추가
    app.add_middleware(SecurityHeadersMiddleware)

    logger.info("보안 미들웨어 설정 완료")


def get_security_info() -> Dict[str, Any]:
    """보안 설정 정보 반환"""
    return {
        "cors": {
            "allowed_origins": cors_manager.allowed_origins,
            "allowed_methods": cors_manager.allowed_methods,
            "allowed_headers": cors_manager.allowed_headers,
            "allow_credentials": cors_manager.allow_credentials,
        },
        "security_headers": {
            "content_security_policy": "enabled",
            "strict_transport_security": settings.ENVIRONMENT == "production",
            "x_frame_options": "DENY",
            "x_content_type_options": "nosniff",
        },
        "environment": settings.ENVIRONMENT,
        "debug_mode": settings.DEBUG
    }