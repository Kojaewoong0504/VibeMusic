"""
테스트: 세션 생성 API 검증 (T003)
"""
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from src.main import app
from src.models.user_session import UserSession
from datetime import datetime, timezone


@pytest.fixture
def client():
    """테스트 클라이언트 생성"""
    return TestClient(app)


@pytest.fixture
def mock_user_session():
    """Mock UserSession 객체"""
    session = UserSession(
        id="test-session-id",
        session_token="test-token-123",
        consent_given=True,
        status="active",
        created_at=datetime.now(timezone.utc),
        auto_delete_at=datetime.now(timezone.utc),
        total_typing_time=0,
        total_music_generated=0,
        session_metadata={"initial_prompt": "테스트 프롬프트"}
    )
    return session


class TestSessionsAPI:
    """세션 생성 API 테스트 (T003)"""

    @patch('src.services.session_service.SessionService.create_session')
    def test_create_session_with_prompt_success(self, mock_create_session, mock_user_session, client):
        """정상 케이스: prompt 포함 세션 생성 성공"""
        mock_create_session.return_value = mock_user_session

        response = client.post(
            "/v1/sessions/",
            json={
                "prompt": "테스트 프롬프트",
                "consent_given": True
            }
        )

        assert response.status_code == 201
        data = response.json()

        # 응답 형식 검증
        assert "id" in data
        assert "session_token" in data
        assert "status" in data
        assert data["consent_given"] is True
        assert data["session_metadata"]["initial_prompt"] == "테스트 프롬프트"

        # 서비스 호출 검증
        mock_create_session.assert_called_once()
        call_args = mock_create_session.call_args[1]
        assert call_args["consent_given"] is True
        assert call_args["prompt"] == "테스트 프롬프트"

    @patch('src.services.session_service.SessionService.create_session')
    def test_create_session_without_prompt_success(self, mock_create_session, client):
        """정상 케이스: prompt 없이 세션 생성 성공"""
        mock_session = UserSession(
            id="test-session-id",
            session_token="test-token-456",
            consent_given=True,
            status="active",
            created_at=datetime.now(timezone.utc),
            auto_delete_at=datetime.now(timezone.utc),
            total_typing_time=0,
            total_music_generated=0,
            session_metadata={}
        )
        mock_create_session.return_value = mock_session

        response = client.post(
            "/v1/sessions/",
            json={"consent_given": True}
        )

        assert response.status_code == 201
        data = response.json()

        # 응답 형식 검증
        assert "id" in data
        assert "session_token" in data
        assert data["consent_given"] is True
        assert data["session_metadata"] == {}

        # 서비스 호출 검증
        mock_create_session.assert_called_once()
        call_args = mock_create_session.call_args[1]
        assert call_args["consent_given"] is True
        assert call_args["prompt"] is None

    def test_create_session_missing_consent_given(self, client):
        """에러 케이스: 필수 필드 consent_given 누락"""
        response = client.post(
            "/v1/sessions/",
            json={"prompt": "테스트"}
        )

        assert response.status_code == 422  # Pydantic validation error
        data = response.json()
        assert "detail" in data
        assert any(error["loc"] == ["body", "consent_given"] for error in data["detail"])

    def test_create_session_consent_given_false(self, client):
        """에러 케이스: consent_given이 false"""
        response = client.post(
            "/v1/sessions/",
            json={
                "prompt": "테스트",
                "consent_given": False
            }
        )

        assert response.status_code == 400
        data = response.json()
        assert data["detail"]["error"] == "CONSENT_REQUIRED"
        assert data["detail"]["message"] == "데이터 수집 및 처리에 대한 동의가 필요합니다."
        assert data["detail"]["details"]["field"] == "consent_given"
        assert data["detail"]["details"]["current_value"] is False

    def test_create_session_prompt_too_long(self, client):
        """에러 케이스: 프롬프트가 너무 긴 경우"""
        long_prompt = "a" * 1001

        response = client.post(
            "/v1/sessions/",
            json={
                "prompt": long_prompt,
                "consent_given": True
            }
        )

        assert response.status_code == 422  # Pydantic validation error
        data = response.json()
        assert "detail" in data

        # Pydantic의 max_length 검증 에러
        error = data["detail"][0]
        assert error["loc"] == ["body", "prompt"]
        assert error["type"] == "string_too_long"

    @patch('src.services.session_service.SessionService.create_session')
    def test_create_session_with_metadata(self, mock_create_session, client):
        """정상 케이스: 메타데이터 포함 세션 생성"""
        mock_session = UserSession(
            id="test-session-id",
            session_token="test-token-789",
            consent_given=True,
            status="active",
            created_at=datetime.now(timezone.utc),
            auto_delete_at=datetime.now(timezone.utc),
            total_typing_time=0,
            total_music_generated=0,
            session_metadata={
                "initial_prompt": "메타데이터 테스트",
                "browser": "Chrome",
                "platform": "Windows"
            }
        )
        mock_create_session.return_value = mock_session

        response = client.post(
            "/v1/sessions/",
            json={
                "prompt": "메타데이터 테스트",
                "consent_given": True,
                "metadata": {
                    "browser": "Chrome",
                    "platform": "Windows"
                }
            }
        )

        assert response.status_code == 201
        data = response.json()

        # 메타데이터 검증
        assert data["session_metadata"]["initial_prompt"] == "메타데이터 테스트"
        assert data["session_metadata"]["browser"] == "Chrome"
        assert data["session_metadata"]["platform"] == "Windows"

    @patch('src.services.session_service.SessionService.create_session')
    def test_create_session_service_error(self, mock_create_session, client):
        """에러 케이스: 서비스 레벨 오류"""
        mock_create_session.side_effect = Exception("Database error")

        response = client.post(
            "/v1/sessions/",
            json={
                "prompt": "에러 테스트",
                "consent_given": True
            }
        )

        assert response.status_code == 500
        data = response.json()
        assert data["detail"]["error"] == "SESSION_CREATION_FAILED"
        assert "세션 생성 중 오류가 발생했습니다" in data["detail"]["message"]

    def test_create_session_invalid_json(self, client):
        """에러 케이스: 잘못된 JSON 형식"""
        response = client.post(
            "/v1/sessions/",
            data="invalid json",
            headers={"Content-Type": "application/json"}
        )

        assert response.status_code == 422
        data = response.json()
        assert "detail" in data

    def test_create_session_empty_body(self, client):
        """에러 케이스: 빈 요청 본문"""
        response = client.post(
            "/v1/sessions/",
            json={}
        )

        assert response.status_code == 422
        data = response.json()
        assert "detail" in data

        # consent_given 필드 누락 에러 확인
        assert any(error["loc"] == ["body", "consent_given"] for error in data["detail"])


class TestSessionsAPIIntegration:
    """세션 생성 API 통합 테스트"""

    def test_session_creation_flow(self, client):
        """전체 세션 생성 플로우 테스트"""
        # 세션 생성
        response = client.post(
            "/v1/sessions/",
            json={
                "prompt": "통합 테스트 프롬프트",
                "consent_given": True,
                "metadata": {
                    "test_type": "integration",
                    "environment": "test"
                }
            }
        )

        if response.status_code == 201:
            data = response.json()

            # 기본 필드 검증
            assert "id" in data
            assert "session_token" in data
            assert "status" in data
            assert "created_at" in data
            assert "auto_delete_at" in data

            # 세션 상태 확인
            assert data["status"] == "active"
            assert data["consent_given"] is True
            assert data["total_typing_time"] == 0
            assert data["total_music_generated"] == 0

            # 메타데이터 확인
            metadata = data["session_metadata"]
            assert metadata["initial_prompt"] == "통합 테스트 프롬프트"
            assert metadata["test_type"] == "integration"
            assert metadata["environment"] == "test"

            # 세션 토큰 형식 검증 (Base64 URL Safe)
            session_token = data["session_token"]
            assert len(session_token) > 20
            assert session_token.replace("-", "").replace("_", "").isalnum()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])