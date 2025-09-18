"""
테스트: 헬스체크 엔드포인트 검증
"""
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from httpx import AsyncClient

from src.main import app


@pytest.fixture
def client():
    """테스트 클라이언트 생성"""
    return TestClient(app)


class TestHealthCheck:
    """헬스체크 엔드포인트 테스트"""

    def test_root_endpoint_includes_health_check(self, client):
        """루트 엔드포인트에 헬스체크 정보 포함 확인"""
        response = client.get("/")
        assert response.status_code == 200

        data = response.json()
        assert "health_check" in data
        assert data["health_check"] == "/health"
        assert data["status"] == "healthy"

    @patch('src.database.connection.check_db_health')
    @patch('src.cache.redis_client.redis_client.is_healthy')
    def test_health_endpoint_all_healthy(self, mock_redis_health, mock_db_health, client):
        """모든 서비스가 정상일 때 헬스체크 테스트"""
        # Mock 설정: 모든 서비스 정상
        mock_db_health.return_value = True
        mock_redis_health.return_value = True

        response = client.get("/health")
        assert response.status_code == 200

        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "vibemusic-backend"
        assert data["version"] == "1.0.0"
        assert data["database"] == "connected"
        assert data["redis"] == "connected"
        assert "timestamp" in data

    @patch('src.database.connection.check_db_health')
    @patch('src.cache.redis_client.redis_client.is_healthy')
    def test_health_endpoint_database_down(self, mock_redis_health, mock_db_health, client):
        """데이터베이스가 다운된 경우 헬스체크 테스트"""
        # Mock 설정: 데이터베이스 다운, Redis 정상
        mock_db_health.return_value = False
        mock_redis_health.return_value = True

        response = client.get("/health")
        assert response.status_code == 503  # Service Unavailable

        data = response.json()
        assert data["status"] == "unhealthy"
        assert data["database"] == "disconnected"
        assert data["redis"] == "connected"

    @patch('src.database.connection.check_db_health')
    @patch('src.cache.redis_client.redis_client.is_healthy')
    def test_health_endpoint_redis_down(self, mock_redis_health, mock_db_health, client):
        """Redis가 다운된 경우 헬스체크 테스트"""
        # Mock 설정: 데이터베이스 정상, Redis 다운
        mock_db_health.return_value = True
        mock_redis_health.return_value = False

        response = client.get("/health")
        assert response.status_code == 503  # Service Unavailable

        data = response.json()
        assert data["status"] == "unhealthy"
        assert data["database"] == "connected"
        assert data["redis"] == "disconnected"

    @patch('src.database.connection.check_db_health')
    @patch('src.cache.redis_client.redis_client.is_healthy')
    def test_health_endpoint_all_down(self, mock_redis_health, mock_db_health, client):
        """모든 서비스가 다운된 경우 헬스체크 테스트"""
        # Mock 설정: 모든 서비스 다운
        mock_db_health.return_value = False
        mock_redis_health.return_value = False

        response = client.get("/health")
        assert response.status_code == 503  # Service Unavailable

        data = response.json()
        assert data["status"] == "unhealthy"
        assert data["database"] == "disconnected"
        assert data["redis"] == "disconnected"

    @patch('src.database.connection.check_db_health')
    @patch('src.cache.redis_client.redis_client.is_healthy')
    def test_health_endpoint_database_error(self, mock_redis_health, mock_db_health, client):
        """데이터베이스 헬스체크에서 예외 발생 테스트"""
        # Mock 설정: 데이터베이스 예외, Redis 정상
        mock_db_health.side_effect = Exception("Database connection failed")
        mock_redis_health.return_value = True

        response = client.get("/health")
        assert response.status_code == 503  # Service Unavailable

        data = response.json()
        assert data["status"] == "unhealthy"
        assert "error: Database connection failed" in data["database"]
        assert data["redis"] == "connected"

    @patch('src.database.connection.check_db_health')
    @patch('src.cache.redis_client.redis_client.is_healthy')
    def test_health_endpoint_redis_error(self, mock_redis_health, mock_db_health, client):
        """Redis 헬스체크에서 예외 발생 테스트"""
        # Mock 설정: 데이터베이스 정상, Redis 예외
        mock_db_health.return_value = True
        mock_redis_health.side_effect = Exception("Redis connection failed")

        response = client.get("/health")
        assert response.status_code == 503  # Service Unavailable

        data = response.json()
        assert data["status"] == "unhealthy"
        assert data["database"] == "connected"
        assert "error: Redis connection failed" in data["redis"]

    def test_v1_health_endpoint_same_as_root(self, client):
        """v1 헬스체크 엔드포인트가 루트와 동일한 기능 제공 확인"""
        # 두 엔드포인트가 동일한 응답을 하는지 확인
        with patch('src.database.connection.check_db_health') as mock_db_health, \
             patch('src.cache.redis_client.redis_client.is_healthy') as mock_redis_health:

            # Mock 설정
            mock_db_health.return_value = True
            mock_redis_health.return_value = True

            # 두 엔드포인트 모두 테스트
            root_response = client.get("/health")
            v1_response = client.get("/v1/health")

            assert root_response.status_code == v1_response.status_code == 200

            root_data = root_response.json()
            v1_data = v1_response.json()

            # timestamp는 다를 수 있으므로 제외하고 비교
            root_data.pop("timestamp", None)
            v1_data.pop("timestamp", None)

            assert root_data == v1_data


class TestHealthCheckIntegration:
    """헬스체크 통합 테스트 (실제 데이터베이스 연결 사용)"""

    def test_health_check_with_real_database(self, client):
        """실제 데이터베이스 연결을 사용한 헬스체크 테스트"""
        response = client.get("/health")

        # 상태 코드는 데이터베이스 상태에 따라 200 또는 503
        assert response.status_code in [200, 503]

        data = response.json()
        assert "status" in data
        assert "database" in data
        assert "redis" in data
        assert "timestamp" in data
        assert data["service"] == "vibemusic-backend"
        assert data["version"] == "1.0.0"

    def test_health_check_response_format(self, client):
        """헬스체크 응답 형식 검증"""
        response = client.get("/health")
        data = response.json()

        # 필수 필드 존재 확인
        required_fields = ["status", "service", "version", "timestamp", "database", "redis"]
        for field in required_fields:
            assert field in data, f"Required field '{field}' missing from health check response"

        # 상태 값 유효성 확인
        assert data["status"] in ["healthy", "unhealthy"]
        assert data["database"] in ["connected", "disconnected"] or "error:" in data["database"]
        assert data["redis"] in ["connected", "disconnected"] or "error:" in data["redis"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])