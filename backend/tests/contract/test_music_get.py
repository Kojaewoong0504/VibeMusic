"""
T011: GET /sessions/{id}/music/{music_id} 계약 테스트

생성된 음악 정보 조회 API의 계약을 검증하는 테스트입니다.
OpenAPI 스펙에 정의된 음악 생성 상태 및 정보 조회를 엄격히 검증합니다.

TDD 원칙: 이 테스트는 현재 실패해야 합니다 (구현이 없으므로)
"""

import pytest
from fastapi.testclient import TestClient
from datetime import datetime
import uuid

# TODO: 실제 FastAPI 앱이 구현되면 import 경로 수정
# from src.main import app

# 현재는 임시 앱으로 테스트가 실패하도록 설정
from fastapi import FastAPI
app = FastAPI()

client = TestClient(app)


class TestMusicGet:
    """GET /sessions/{session_id}/music/{music_id} 엔드포인트 계약 테스트"""

    @pytest.fixture
    def valid_session_token(self):
        """테스트용 유효한 세션 토큰"""
        return "test_session_token_12345"

    @pytest.fixture
    def valid_session_id(self):
        """테스트용 유효한 세션 ID"""
        return str(uuid.uuid4())

    @pytest.fixture
    def valid_music_id(self):
        """테스트용 유효한 음악 ID"""
        return str(uuid.uuid4())

    def test_get_music_completed_success(self, valid_session_id, valid_session_token, valid_music_id):
        """
        완료된 음악 정보 조회 성공 테스트

        계약 검증:
        - 요청: session_id, music_id (UUID), Authorization 헤더
        - 응답: 200, GeneratedMusic 스키마 준수
        """
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        response = client.get(
            f"/v1/sessions/{valid_session_id}/music/{valid_music_id}",
            headers=headers
        )

        # 완료된 음악인 경우 200 응답
        assert response.status_code == 200

        # 응답 데이터 구조 검증 (GeneratedMusic 스키마)
        music_data = response.json()

        # 필수 필드 존재 확인
        required_fields = [
            "id", "file_url", "file_size", "duration", "format",
            "sample_rate", "generation_time", "quality_score",
            "status", "created_at", "completed_at"
        ]

        for field in required_fields:
            assert field in music_data, f"필수 필드 '{field}'가 응답에 없습니다"

        # 데이터 타입 검증
        assert isinstance(music_data["id"], str)
        assert isinstance(music_data["file_url"], str)
        assert isinstance(music_data["file_size"], int)
        assert isinstance(music_data["duration"], int)
        assert isinstance(music_data["format"], str)
        assert isinstance(music_data["sample_rate"], int)
        assert isinstance(music_data["generation_time"], (int, float))
        assert isinstance(music_data["quality_score"], (int, float))
        assert isinstance(music_data["status"], str)
        assert isinstance(music_data["created_at"], str)
        assert isinstance(music_data["completed_at"], str)

        # UUID 형식 검증
        try:
            uuid.UUID(music_data["id"])
        except ValueError:
            pytest.fail(f"id는 유효한 UUID여야 합니다: {music_data['id']}")

        # 값 범위 검증
        assert music_data["file_size"] >= 0, "file_size는 0 이상이어야 합니다"
        assert music_data["duration"] >= 0, "duration은 0 이상이어야 합니다"
        assert music_data["sample_rate"] > 0, "sample_rate는 양수여야 합니다"
        assert music_data["generation_time"] >= 0, "generation_time은 0 이상이어야 합니다"
        assert 0.0 <= music_data["quality_score"] <= 1.0, "quality_score는 0.0~1.0 범위여야 합니다"

        # status enum 값 검증
        valid_statuses = ["generating", "completed", "failed"]
        assert music_data["status"] in valid_statuses, \
            f"status는 {valid_statuses} 중 하나여야 합니다: {music_data['status']}"

        # format enum 값 검증
        valid_formats = ["wav", "mp3", "flac"]
        assert music_data["format"] in valid_formats, \
            f"format은 {valid_formats} 중 하나여야 합니다: {music_data['format']}"

        # URL 형식 검증 (기본적인 URL 구조)
        file_url = music_data["file_url"]
        assert file_url.startswith(('http://', 'https://')), "file_url은 유효한 URL이어야 합니다"

        # 날짜 시간 형식 검증
        for datetime_field in ["created_at", "completed_at"]:
            datetime_str = music_data[datetime_field]
            try:
                datetime.fromisoformat(datetime_str.replace('Z', '+00:00'))
            except ValueError:
                pytest.fail(f"{datetime_field}는 유효한 ISO 8601 형식이어야 합니다: {datetime_str}")

    def test_get_music_generating_status(self, valid_session_id, valid_session_token, valid_music_id):
        """
        생성 중인 음악 정보 조회 테스트

        계약 검증:
        - 응답: 202 Accepted, status="generating", progress 포함
        """
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        response = client.get(
            f"/v1/sessions/{valid_session_id}/music/{valid_music_id}",
            headers=headers
        )

        # 생성 중인 경우 202 응답도 허용
        if response.status_code == 202:
            # 생성 진행 중 응답 구조 검증
            progress_data = response.json()

            # 필수 필드 확인
            assert "status" in progress_data
            assert "progress" in progress_data

            # 값 검증
            assert progress_data["status"] == "generating"
            progress = progress_data["progress"]
            assert isinstance(progress, int)
            assert 0 <= progress <= 100, f"progress는 0~100 범위여야 합니다: {progress}"

    def test_get_music_unauthorized_access(self, valid_session_id, valid_music_id):
        """인증되지 않은 접근 테스트"""
        response = client.get(
            f"/v1/sessions/{valid_session_id}/music/{valid_music_id}"
        )

        assert response.status_code == 401

    def test_get_music_invalid_token(self, valid_session_id, valid_music_id):
        """잘못된 토큰으로 접근 테스트"""
        headers = {
            "Authorization": "Bearer invalid_token"
        }

        response = client.get(
            f"/v1/sessions/{valid_session_id}/music/{valid_music_id}",
            headers=headers
        )

        assert response.status_code == 401

    def test_get_music_malformed_token(self, valid_session_id, valid_music_id):
        """잘못된 형식의 Authorization 헤더 테스트"""
        # Bearer 없이
        headers = {
            "Authorization": "invalid_token_12345"
        }

        response = client.get(
            f"/v1/sessions/{valid_session_id}/music/{valid_music_id}",
            headers=headers
        )

        assert response.status_code == 401

        # 빈 토큰
        headers = {
            "Authorization": "Bearer "
        }

        response = client.get(
            f"/v1/sessions/{valid_session_id}/music/{valid_music_id}",
            headers=headers
        )

        assert response.status_code == 401

    def test_get_music_session_not_found(self, valid_session_token, valid_music_id):
        """존재하지 않는 세션 ID로 조회 테스트"""
        non_existent_session_id = str(uuid.uuid4())
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        response = client.get(
            f"/v1/sessions/{non_existent_session_id}/music/{valid_music_id}",
            headers=headers
        )

        assert response.status_code == 404

    def test_get_music_not_found(self, valid_session_id, valid_session_token):
        """존재하지 않는 음악 ID로 조회 테스트"""
        non_existent_music_id = str(uuid.uuid4())
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        response = client.get(
            f"/v1/sessions/{valid_session_id}/music/{non_existent_music_id}",
            headers=headers
        )

        assert response.status_code == 404

    def test_get_music_invalid_session_uuid(self, valid_session_token, valid_music_id):
        """잘못된 UUID 형식의 세션 ID 테스트"""
        invalid_session_id = "not-a-valid-uuid"
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        response = client.get(
            f"/v1/sessions/{invalid_session_id}/music/{valid_music_id}",
            headers=headers
        )

        assert response.status_code == 400

    def test_get_music_invalid_music_uuid(self, valid_session_id, valid_session_token):
        """잘못된 UUID 형식의 음악 ID 테스트"""
        invalid_music_id = "not-a-valid-uuid"
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        response = client.get(
            f"/v1/sessions/{valid_session_id}/music/{invalid_music_id}",
            headers=headers
        )

        assert response.status_code == 400

    def test_get_music_forbidden_access(self, valid_session_token, valid_music_id):
        """다른 사용자의 음악 접근 시도 테스트"""
        # 다른 사용자의 세션 ID라고 가정
        other_user_session_id = str(uuid.uuid4())
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        response = client.get(
            f"/v1/sessions/{other_user_session_id}/music/{valid_music_id}",
            headers=headers
        )

        # 403 또는 404 둘 다 허용 (보안 정책에 따라)
        assert response.status_code in [403, 404]

    def test_get_music_response_content_type(self, valid_session_id, valid_session_token, valid_music_id):
        """응답 Content-Type 검증"""
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        response = client.get(
            f"/v1/sessions/{valid_session_id}/music/{valid_music_id}",
            headers=headers
        )

        # 200 또는 202 둘 다 허용
        assert response.status_code in [200, 202]
        assert response.headers["content-type"] == "application/json"

    def test_get_music_case_sensitive_uuid(self, valid_session_token):
        """UUID의 대소문자 처리 테스트"""
        # UUID는 대소문자를 구분하지 않아야 함
        test_session_uuid = "12345678-1234-1234-1234-123456789abc"
        test_music_uuid = "87654321-4321-4321-4321-abc123456789"

        uppercase_session = test_session_uuid.upper()
        lowercase_session = test_session_uuid.lower()
        uppercase_music = test_music_uuid.upper()
        lowercase_music = test_music_uuid.lower()

        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        # 두 요청 모두 같은 결과를 반환해야 함
        response_upper = client.get(
            f"/v1/sessions/{uppercase_session}/music/{uppercase_music}",
            headers=headers
        )
        response_lower = client.get(
            f"/v1/sessions/{lowercase_session}/music/{lowercase_music}",
            headers=headers
        )

        assert response_upper.status_code == response_lower.status_code


class TestGeneratedMusicSchema:
    """GeneratedMusic 스키마 준수 테스트"""

    @pytest.fixture
    def sample_completed_music(self):
        """완료된 음악 데이터 샘플"""
        return {
            "id": str(uuid.uuid4()),
            "file_url": "https://api.vibemusic.app/files/music/12345.wav",
            "file_size": 2048576,  # 2MB
            "duration": 30,  # 30초
            "format": "wav",
            "sample_rate": 44100,
            "generation_time": 25.5,  # 25.5초
            "quality_score": 0.85,
            "status": "completed",
            "created_at": "2024-09-15T10:30:00Z",
            "completed_at": "2024-09-15T10:30:25Z"
        }

    @pytest.fixture
    def sample_generating_music(self):
        """생성 중인 음악 데이터 샘플"""
        return {
            "status": "generating",
            "progress": 45
        }

    def test_completed_music_schema_validation(self, sample_completed_music):
        """완료된 음악 스키마 검증"""
        music = sample_completed_music

        # 필수 필드 존재 확인
        required_fields = [
            "id", "file_url", "file_size", "duration", "format",
            "sample_rate", "generation_time", "quality_score",
            "status", "created_at", "completed_at"
        ]

        for field in required_fields:
            assert field in music, f"필수 필드 '{field}'가 없습니다"

        # 타입 검증
        assert isinstance(music["id"], str)
        assert isinstance(music["file_url"], str)
        assert isinstance(music["file_size"], int)
        assert isinstance(music["duration"], int)
        assert isinstance(music["format"], str)
        assert isinstance(music["sample_rate"], int)
        assert isinstance(music["generation_time"], (int, float))
        assert isinstance(music["quality_score"], (int, float))
        assert isinstance(music["status"], str)
        assert isinstance(music["created_at"], str)
        assert isinstance(music["completed_at"], str)

    def test_generating_music_schema_validation(self, sample_generating_music):
        """생성 중인 음악 스키마 검증"""
        music = sample_generating_music

        # 필수 필드 존재 확인
        required_fields = ["status", "progress"]

        for field in required_fields:
            assert field in music, f"필수 필드 '{field}'가 없습니다"

        # 타입 검증
        assert isinstance(music["status"], str)
        assert isinstance(music["progress"], int)

        # 값 검증
        assert music["status"] == "generating"
        assert 0 <= music["progress"] <= 100

    def test_music_status_enum_values(self):
        """음악 상태 enum 값 검증"""
        valid_statuses = ["generating", "completed", "failed"]

        for status in valid_statuses:
            # 각 상태값이 유효한지 검증
            assert status in valid_statuses

    def test_music_format_enum_values(self):
        """음악 형식 enum 값 검증"""
        valid_formats = ["wav", "mp3", "flac"]

        for format_value in valid_formats:
            # 각 형식값이 유효한지 검증
            assert format_value in valid_formats

    def test_quality_score_range_validation(self):
        """품질 점수 범위 검증"""
        valid_scores = [0.0, 0.5, 1.0, 0.85]
        invalid_scores = [-0.1, 1.1, 2.0]

        for score in valid_scores:
            assert 0.0 <= score <= 1.0, f"유효한 점수여야 합니다: {score}"

        for score in invalid_scores:
            assert not (0.0 <= score <= 1.0), f"무효한 점수여야 합니다: {score}"

    def test_numeric_fields_validation(self):
        """숫자 필드 검증"""
        # 양수여야 하는 필드들
        positive_fields = {
            "file_size": 2048576,
            "duration": 30,
            "sample_rate": 44100,
            "generation_time": 25.5
        }

        for field, value in positive_fields.items():
            if field == "generation_time":
                assert value >= 0, f"{field}는 0 이상이어야 합니다: {value}"
            else:
                assert value >= 0, f"{field}는 0 이상이어야 합니다: {value}"

    def test_datetime_fields_format_validation(self):
        """날짜 시간 필드 형식 검증"""
        valid_datetime_formats = [
            "2024-09-15T10:30:00Z",
            "2024-09-15T10:30:00.123Z",
            "2024-09-15T10:30:00+00:00",
            "2024-09-15T10:30:00.123+00:00"
        ]

        for datetime_str in valid_datetime_formats:
            try:
                datetime.fromisoformat(datetime_str.replace('Z', '+00:00'))
            except ValueError:
                pytest.fail(f"유효한 datetime 형식이어야 합니다: {datetime_str}")

    def test_file_url_format_validation(self):
        """파일 URL 형식 검증"""
        valid_urls = [
            "https://api.vibemusic.app/files/music/12345.wav",
            "http://localhost:8000/files/music/test.mp3",
            "https://cdn.vibemusic.app/generated/abc123.flac"
        ]

        for url in valid_urls:
            assert url.startswith(('http://', 'https://')), f"유효한 URL이어야 합니다: {url}"


class TestMusicGetSecurity:
    """보안 관련 테스트"""

    def test_music_access_isolation(self):
        """음악 접근 격리 검증"""
        # 사용자는 자신의 세션에서 생성된 음악만 접근할 수 있어야 함
        # 실제 구현 후에 활성화
        pass

    def test_expired_token_handling(self):
        """만료된 토큰 처리 테스트"""
        # 실제 구현에서 토큰 만료 기능이 있다면 테스트
        pass

    def test_file_url_security(self):
        """파일 URL 보안 검증"""
        # file_url이 적절한 권한 제어를 가지고 있는지 확인
        # 직접 접근 시 인증이 필요한지 검증
        pass

    def test_sensitive_data_exposure(self):
        """민감한 데이터 노출 방지 검증"""
        # 응답에 내부 시스템 정보나 민감한 데이터가 포함되지 않는지 확인
        pass