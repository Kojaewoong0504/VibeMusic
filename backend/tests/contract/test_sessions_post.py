"""
T007: POST /sessions 계약 테스트

새로운 사용자 세션 생성 API의 계약을 검증하는 테스트입니다.
OpenAPI 스펙에 정의된 요청/응답 형식을 엄격히 검증합니다.

TDD 원칙: 이 테스트는 현재 실패해야 합니다 (구현이 없으므로)
"""

import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
import uuid
import json

# TODO: 실제 FastAPI 앱이 구현되면 import 경로 수정
# from src.main import app

# 현재는 임시 앱으로 테스트가 실패하도록 설정
from fastapi import FastAPI
app = FastAPI()

client = TestClient(app)


class TestSessionsPost:
    """POST /sessions 엔드포인트 계약 테스트"""

    def test_create_session_success(self):
        """
        정상적인 세션 생성 요청 테스트

        계약 검증:
        - 요청: consent_given=True, auto_delete_hours는 옵션
        - 응답: 201, session_id(UUID), session_token, auto_delete_at
        """
        # 테스트 데이터
        request_data = {
            "consent_given": True,
            "auto_delete_hours": 24
        }

        # API 호출 - 현재는 실패할 것임 (구현 없음)
        response = client.post("/v1/sessions", json=request_data)

        # 응답 상태 코드 검증
        assert response.status_code == 201

        # 응답 데이터 구조 검증
        response_data = response.json()

        # 필수 필드 존재 확인
        assert "session_id" in response_data
        assert "session_token" in response_data
        assert "auto_delete_at" in response_data

        # 데이터 타입 검증
        session_id = response_data["session_id"]
        assert isinstance(session_id, str)

        # UUID 형식 검증
        try:
            uuid.UUID(session_id)
        except ValueError:
            pytest.fail(f"session_id는 유효한 UUID여야 합니다: {session_id}")

        # session_token은 문자열이어야 함
        assert isinstance(response_data["session_token"], str)
        assert len(response_data["session_token"]) > 10  # 최소한의 토큰 길이

        # auto_delete_at는 ISO 8601 datetime 형식이어야 함
        auto_delete_at = response_data["auto_delete_at"]
        assert isinstance(auto_delete_at, str)

        # datetime 파싱 검증
        try:
            parsed_date = datetime.fromisoformat(auto_delete_at.replace('Z', '+00:00'))
            # 24시간 후 시점이어야 함 (±1분 오차 허용)
            expected_time = datetime.now() + timedelta(hours=24)
            time_diff = abs((parsed_date.replace(tzinfo=None) - expected_time).total_seconds())
            assert time_diff < 60, f"auto_delete_at 시간이 예상과 다릅니다: {time_diff}초 차이"
        except ValueError:
            pytest.fail(f"auto_delete_at는 유효한 ISO 8601 형식이어야 합니다: {auto_delete_at}")

    def test_create_session_minimal_request(self):
        """
        최소 요청 데이터로 세션 생성 테스트

        계약 검증:
        - 요청: consent_given=True만 필수
        - auto_delete_hours 생략 시 기본값 24시간 적용
        """
        request_data = {
            "consent_given": True
        }

        response = client.post("/v1/sessions", json=request_data)

        assert response.status_code == 201
        response_data = response.json()

        # 기본값 검증: 24시간 후 삭제 예정
        auto_delete_at = response_data["auto_delete_at"]
        parsed_date = datetime.fromisoformat(auto_delete_at.replace('Z', '+00:00'))
        expected_time = datetime.now() + timedelta(hours=24)
        time_diff = abs((parsed_date.replace(tzinfo=None) - expected_time).total_seconds())
        assert time_diff < 60

    def test_create_session_custom_auto_delete(self):
        """
        사용자 정의 자동 삭제 시간 테스트

        계약 검증:
        - auto_delete_hours: 1~168 범위
        - 응답의 auto_delete_at가 정확히 반영됨
        """
        test_hours = 72  # 3일
        request_data = {
            "consent_given": True,
            "auto_delete_hours": test_hours
        }

        response = client.post("/v1/sessions", json=request_data)

        assert response.status_code == 201
        response_data = response.json()

        # 사용자 정의 시간 검증
        auto_delete_at = response_data["auto_delete_at"]
        parsed_date = datetime.fromisoformat(auto_delete_at.replace('Z', '+00:00'))
        expected_time = datetime.now() + timedelta(hours=test_hours)
        time_diff = abs((parsed_date.replace(tzinfo=None) - expected_time).total_seconds())
        assert time_diff < 60

    def test_create_session_consent_required(self):
        """
        동의 없이 세션 생성 시도 - 실패해야 함

        계약 검증:
        - consent_given=False 또는 누락 시 400 에러
        - 에러 응답 형식 검증
        """
        # consent_given이 False인 경우
        request_data = {
            "consent_given": False
        }

        response = client.post("/v1/sessions", json=request_data)

        assert response.status_code == 400

        # 에러 응답 구조 검증
        error_data = response.json()
        assert "error" in error_data
        assert "message" in error_data
        assert isinstance(error_data["error"], str)
        assert isinstance(error_data["message"], str)

    def test_create_session_missing_consent(self):
        """동의 필드 누락 시 에러 테스트"""
        request_data = {}

        response = client.post("/v1/sessions", json=request_data)

        assert response.status_code == 400
        error_data = response.json()
        assert "error" in error_data
        assert "message" in error_data

    def test_create_session_invalid_auto_delete_hours(self):
        """
        잘못된 auto_delete_hours 값 테스트

        계약 검증:
        - 최소값: 1시간
        - 최대값: 168시간 (7일)
        - 범위 외 값 시 400 에러
        """
        # 최소값 미만
        request_data = {
            "consent_given": True,
            "auto_delete_hours": 0
        }

        response = client.post("/v1/sessions", json=request_data)
        assert response.status_code == 400

        # 최대값 초과
        request_data = {
            "consent_given": True,
            "auto_delete_hours": 200
        }

        response = client.post("/v1/sessions", json=request_data)
        assert response.status_code == 400

    def test_create_session_invalid_json(self):
        """잘못된 JSON 형식 요청 테스트"""
        # Content-Type은 application/json이지만 잘못된 데이터
        response = client.post(
            "/v1/sessions",
            data="invalid json",
            headers={"Content-Type": "application/json"}
        )

        assert response.status_code == 400

    def test_create_session_response_content_type(self):
        """응답 Content-Type 검증"""
        request_data = {
            "consent_given": True
        }

        response = client.post("/v1/sessions", json=request_data)

        assert response.status_code == 201
        assert response.headers["content-type"] == "application/json"

    def test_create_session_unique_tokens(self):
        """
        연속 세션 생성 시 고유 토큰 발급 검증

        계약 검증:
        - 각 세션마다 고유한 session_id와 session_token 발급
        - 동시 요청에도 충돌 없이 처리
        """
        request_data = {
            "consent_given": True
        }

        # 여러 세션 생성
        responses = []
        for _ in range(3):
            response = client.post("/v1/sessions", json=request_data)
            assert response.status_code == 201
            responses.append(response.json())

        # 모든 session_id가 고유한지 확인
        session_ids = [r["session_id"] for r in responses]
        assert len(set(session_ids)) == len(session_ids), "session_id가 중복되었습니다"

        # 모든 session_token이 고유한지 확인
        session_tokens = [r["session_token"] for r in responses]
        assert len(set(session_tokens)) == len(session_tokens), "session_token이 중복되었습니다"


# 추가적인 계약 검증을 위한 스키마 테스트
class TestSessionsPostSchema:
    """OpenAPI 스키마 준수 테스트"""

    def test_request_schema_validation(self):
        """요청 스키마 검증 - 추가 필드 거부"""
        request_data = {
            "consent_given": True,
            "auto_delete_hours": 24,
            "extra_field": "should_be_rejected"  # 스키마에 없는 필드
        }

        response = client.post("/v1/sessions", json=request_data)

        # 구현에 따라 추가 필드를 무시하거나 에러를 낼 수 있음
        # 여기서는 성공적으로 처리되지만 extra_field는 무시되어야 함
        if response.status_code == 201:
            # 응답에는 추가 필드가 포함되지 않아야 함
            response_data = response.json()
            assert "extra_field" not in response_data

    def test_response_schema_completeness(self):
        """응답 스키마 완전성 검증"""
        request_data = {
            "consent_given": True
        }

        response = client.post("/v1/sessions", json=request_data)
        assert response.status_code == 201

        response_data = response.json()

        # OpenAPI 스키마에 정의된 모든 필수 필드가 있어야 함
        required_fields = ["session_id", "session_token", "auto_delete_at"]
        for field in required_fields:
            assert field in response_data, f"필수 필드 '{field}'가 응답에 없습니다"

        # 예상치 못한 추가 필드가 없어야 함
        for field in response_data.keys():
            assert field in required_fields, f"예상치 못한 필드 '{field}'가 응답에 있습니다"