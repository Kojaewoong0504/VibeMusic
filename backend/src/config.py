"""
애플리케이션 설정 관리
"""
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    """애플리케이션 설정"""
    
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)
    
    # 앱 기본 설정
    APP_NAME: str = "VibeMusic API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "production"
    
    # 서버 설정
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # 데이터베이스 설정
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://vibemusic:password@localhost:5432/vibemusic",
        description="PostgreSQL 데이터베이스 연결 URL"
    )
    DATABASE_ECHO: bool = False
    
    # Redis 설정
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis 연결 URL"
    )
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = ""
    REDIS_DB: int = 0
    REDIS_MAX_CONNECTIONS: int = 100
    REDIS_SOCKET_TIMEOUT: float = 5.0
    REDIS_CONNECT_TIMEOUT: float = 5.0
    
    # JWT 보안 설정
    SECRET_KEY: str = Field(
        default="change-this-secret-key-in-production",
        description="JWT 토큰 생성용 비밀 키"
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # AI 음악 생성 API 설정
    AI_MUSIC_API_URL: str = Field(
        default="",
        description="AI 음악 생성 API 엔드포인트"
    )
    AI_MUSIC_API_KEY: str = Field(
        default="",
        description="AI 음악 생성 API 키"
    )
    
    # WebSocket 설정
    WS_HEARTBEAT_INTERVAL: int = 30
    WS_MAX_CONNECTIONS: int = 1000
    
    # 로깅 설정
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"
    
    # CORS 설정
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    
    @property
    def database_url_sync(self) -> str:
        """동기 데이터베이스 URL (마이그레이션용)"""
        return self.DATABASE_URL.replace("+asyncpg", "")


# 전역 설정 인스턴스
settings = Settings()