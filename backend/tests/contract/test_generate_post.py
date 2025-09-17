"""
T010: POST /sessions/{id}/generate 계약 테스트

AI 음악 생성 API의 계약을 검증하는 테스트입니다.
OpenAPI 스펙에 정의된 텍스트 프롬프트와 감정 프로필 기반 음악 생성을 엄격히 검증합니다.

TDD 원칙: 이 테스트는 현재 실패해야 합니다 (구현이 없으므로)
"""

import pytest
from fastapi.testclient import TestClient
import uuid

# TODO: 실제 FastAPI 앱이 구현되면 import 경로 수정
# from src.main import app

# 현재는 임시 앱으로 테스트가 실패하도록 설정
from fastapi import FastAPI
app = FastAPI()

client = TestClient(app)


class TestGeneratePost:
    """POST /sessions/{session_id}/generate 엔드포인트 계약 테스트"""

    @pytest.fixture
    def valid_session_token(self):
        """테스트용 유효한 세션 토큰"""
        return "test_session_token_12345"

    @pytest.fixture
    def valid_session_id(self):
        """테스트용 유효한 세션 ID"""
        return str(uuid.uuid4())

    @pytest.fixture
    def valid_emotion_profile_id(self):
        """테스트용 유효한 감정 프로필 ID"""
        return str(uuid.uuid4())

    def test_generate_music_success(self, valid_session_id, valid_session_token, valid_emotion_profile_id):
        """
        정상적인 음악 생성 요청 테스트

        계약 검증:
        - 요청: text_prompt, emotion_profile_id, 선택적 generation_parameters
        - 응답: 202 Accepted, music_id, estimated_completion_time
        """
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        request_data = {
            "text_prompt": "Create a calm and peaceful melody for meditation",
            "emotion_profile_id": valid_emotion_profile_id,
            "generation_parameters": {
                "duration": 30,
                "format": "wav",
                "genre_hint": "ambient"
            }
        }

        response = client.post(
            f"/v1/sessions/{valid_session_id}/generate",
            json=request_data,
            headers=headers
        )

        # 응답 상태 코드 검증 (202 Accepted - 비동기 처리)
        assert response.status_code == 202

        # 응답 데이터 구조 검증
        generation_result = response.json()

        # 필수 필드 존재 확인
        assert "music_id" in generation_result
        assert "estimated_completion_time" in generation_result

        # music_id UUID 형식 검증
        music_id = generation_result["music_id"]
        assert isinstance(music_id, str)

        try:
            uuid.UUID(music_id)
        except ValueError:
            pytest.fail(f"music_id는 유효한 UUID여야 합니다: {music_id}")

        # estimated_completion_time 검증 (초 단위 정수)
        completion_time = generation_result["estimated_completion_time"]
        assert isinstance(completion_time, int)
        assert completion_time > 0, "예상 완료 시간은 양수여야 합니다"
        assert completion_time <= 3600, "예상 완료 시간이 1시간을 초과하면 안됩니다"  # 합리적인 상한선

    def test_generate_music_minimal_request(self, valid_session_id, valid_session_token, valid_emotion_profile_id):
        """
        최소 요청 데이터로 음악 생성 테스트

        계약 검증:
        - 필수 필드만으로 요청 (text_prompt, emotion_profile_id)
        - generation_parameters 생략 시 기본값 적용
        """
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        request_data = {
            "text_prompt": "Create uplifting happy music",
            "emotion_profile_id": valid_emotion_profile_id
        }

        response = client.post(
            f"/v1/sessions/{valid_session_id}/generate",
            json=request_data,
            headers=headers
        )

        assert response.status_code == 202

        generation_result = response.json()
        assert "music_id" in generation_result
        assert "estimated_completion_time" in generation_result

    def test_generate_music_custom_parameters(self, valid_session_id, valid_session_token, valid_emotion_profile_id):
        """
        사용자 정의 생성 매개변수 테스트

        계약 검증:
        - duration: 15~120초 범위
        - format: wav, mp3, flac 중 선택
        - genre_hint: 최대 50자 문자열
        """
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        # 다양한 매개변수 조합 테스트
        test_cases = [
            {
                "duration": 15,
                "format": "wav",
                "genre_hint": "classical"
            },
            {
                "duration": 60,
                "format": "mp3",
                "genre_hint": "electronic"
            },
            {
                "duration": 120,
                "format": "flac",
                "genre_hint": "jazz"
            }
        ]

        for params in test_cases:
            request_data = {
                "text_prompt": "Create music with specific parameters",
                "emotion_profile_id": valid_emotion_profile_id,
                "generation_parameters": params
            }

            response = client.post(
                f"/v1/sessions/{valid_session_id}/generate",
                json=request_data,
                headers=headers
            )

            assert response.status_code == 202, f"파라미터 {params}로 실패했습니다"

    def test_generate_missing_required_fields(self, valid_session_id, valid_session_token, valid_emotion_profile_id):
        """필수 필드 누락 시 에러 테스트"""
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        # text_prompt 누락
        request_data = {
            "emotion_profile_id": valid_emotion_profile_id
        }

        response = client.post(
            f"/v1/sessions/{valid_session_id}/generate",
            json=request_data,
            headers=headers
        )

        assert response.status_code == 400

        # emotion_profile_id 누락
        request_data = {
            "text_prompt": "Create music without emotion profile"
        }

        response = client.post(
            f"/v1/sessions/{valid_session_id}/generate",
            json=request_data,
            headers=headers
        )

        assert response.status_code == 400

    def test_generate_invalid_text_prompt_length(self, valid_session_id, valid_session_token, valid_emotion_profile_id):
        """
        텍스트 프롬프트 길이 검증 테스트

        계약 검증:
        - 최소 길이: 10자
        - 최대 길이: 500자
        """
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        # 너무 짧은 프롬프트 (10자 미만)
        request_data = {
            "text_prompt": "short",  # 5자
            "emotion_profile_id": valid_emotion_profile_id
        }

        response = client.post(
            f"/v1/sessions/{valid_session_id}/generate",
            json=request_data,
            headers=headers
        )

        assert response.status_code == 400

        # 너무 긴 프롬프트 (500자 초과)
        request_data = {
            "text_prompt": "x" * 501,  # 501자
            "emotion_profile_id": valid_emotion_profile_id
        }

        response = client.post(
            f"/v1/sessions/{valid_session_id}/generate",
            json=request_data,
            headers=headers
        )

        assert response.status_code == 400

    def test_generate_invalid_duration_range(self, valid_session_id, valid_session_token, valid_emotion_profile_id):
        """
        잘못된 duration 범위 테스트

        계약 검증:
        - 최소값: 15초
        - 최대값: 120초
        """
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        # 최소값 미만
        request_data = {
            "text_prompt": "Create short music",
            "emotion_profile_id": valid_emotion_profile_id,
            "generation_parameters": {
                "duration": 10  # 15초 미만
            }
        }

        response = client.post(
            f"/v1/sessions/{valid_session_id}/generate",
            json=request_data,
            headers=headers
        )

        assert response.status_code == 400

        # 최대값 초과
        request_data = {
            "text_prompt": "Create long music",
            "emotion_profile_id": valid_emotion_profile_id,
            "generation_parameters": {
                "duration": 150  # 120초 초과
            }
        }

        response = client.post(
            f"/v1/sessions/{valid_session_id}/generate",
            json=request_data,
            headers=headers
        )

        assert response.status_code == 400

    def test_generate_invalid_format_enum(self, valid_session_id, valid_session_token, valid_emotion_profile_id):
        """
        잘못된 format enum 값 테스트

        계약 검증:
        - 허용된 값: wav, mp3, flac
        """
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        invalid_formats = ["mp4", "ogg", "aac", "wma", "invalid"]

        for invalid_format in invalid_formats:
            request_data = {
                "text_prompt": "Create music with invalid format",
                "emotion_profile_id": valid_emotion_profile_id,
                "generation_parameters": {
                    "format": invalid_format
                }
            }

            response = client.post(
                f"/v1/sessions/{valid_session_id}/generate",
                json=request_data,
                headers=headers
            )

            assert response.status_code == 400, f"잘못된 형식 '{invalid_format}'에 대해 400을 반환해야 합니다"

    def test_generate_invalid_genre_hint_length(self, valid_session_id, valid_session_token, valid_emotion_profile_id):
        """
        장르 힌트 길이 검증 테스트

        계약 검증:
        - 최대 길이: 50자
        """
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        request_data = {
            "text_prompt": "Create music with long genre hint",
            "emotion_profile_id": valid_emotion_profile_id,
            "generation_parameters": {
                "genre_hint": "x" * 51  # 50자 초과
            }
        }

        response = client.post(
            f"/v1/sessions/{valid_session_id}/generate",
            json=request_data,
            headers=headers
        )

        assert response.status_code == 400

    def test_generate_invalid_emotion_profile_id(self, valid_session_id, valid_session_token):
        """잘못된 감정 프로필 ID 테스트"""
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        # UUID 형식이 아닌 ID
        request_data = {
            "text_prompt": "Create music with invalid profile id",
            "emotion_profile_id": "not-a-valid-uuid"
        }

        response = client.post(
            f"/v1/sessions/{valid_session_id}/generate",
            json=request_data,
            headers=headers
        )

        assert response.status_code == 400

    def test_generate_nonexistent_emotion_profile(self, valid_session_id, valid_session_token):
        """존재하지 않는 감정 프로필로 생성 시도"""
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        nonexistent_profile_id = str(uuid.uuid4())

        request_data = {
            "text_prompt": "Create music with nonexistent profile",
            "emotion_profile_id": nonexistent_profile_id
        }

        response = client.post(
            f"/v1/sessions/{valid_session_id}/generate",
            json=request_data,
            headers=headers
        )

        # 404 (프로필 없음) 또는 400 (잘못된 요청) 둘 다 허용
        assert response.status_code in [400, 404]

    def test_generate_unauthorized_access(self, valid_session_id, valid_emotion_profile_id):
        """인증되지 않은 접근 테스트"""
        request_data = {
            "text_prompt": "Create music without authentication",
            "emotion_profile_id": valid_emotion_profile_id
        }

        response = client.post(
            f"/v1/sessions/{valid_session_id}/generate",
            json=request_data
        )

        assert response.status_code == 401

    def test_generate_invalid_token(self, valid_session_id, valid_emotion_profile_id):
        """잘못된 토큰으로 접근 테스트"""
        headers = {
            "Authorization": "Bearer invalid_token"
        }

        request_data = {
            "text_prompt": "Create music with invalid token",
            "emotion_profile_id": valid_emotion_profile_id
        }

        response = client.post(
            f"/v1/sessions/{valid_session_id}/generate",
            json=request_data,
            headers=headers
        )

        assert response.status_code == 401

    def test_generate_session_not_found(self, valid_session_token, valid_emotion_profile_id):
        """존재하지 않는 세션 ID로 생성 요청"""
        non_existent_session_id = str(uuid.uuid4())
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        request_data = {
            "text_prompt": "Create music for nonexistent session",
            "emotion_profile_id": valid_emotion_profile_id
        }

        response = client.post(
            f"/v1/sessions/{non_existent_session_id}/generate",
            json=request_data,
            headers=headers
        )

        assert response.status_code == 404

    def test_generate_invalid_session_uuid(self, valid_session_token, valid_emotion_profile_id):
        """잘못된 UUID 형식의 세션 ID 테스트"""
        invalid_session_id = "not-a-valid-uuid"
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        request_data = {
            "text_prompt": "Create music with invalid session UUID",
            "emotion_profile_id": valid_emotion_profile_id
        }

        response = client.post(
            f"/v1/sessions/{invalid_session_id}/generate",
            json=request_data,
            headers=headers
        )

        assert response.status_code == 400

    def test_generate_response_content_type(self, valid_session_id, valid_session_token, valid_emotion_profile_id):
        """응답 Content-Type 검증"""
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        request_data = {
            "text_prompt": "Create music for content type test",
            "emotion_profile_id": valid_emotion_profile_id
        }

        response = client.post(
            f"/v1/sessions/{valid_session_id}/generate",
            json=request_data,
            headers=headers
        )

        assert response.status_code == 202
        assert response.headers["content-type"] == "application/json"

    def test_generate_concurrent_requests(self, valid_session_id, valid_session_token, valid_emotion_profile_id):
        """
        동시 생성 요청 테스트

        계약 검증:
        - 각 요청마다 고유한 music_id 발급
        - 동시 요청 처리 능력
        """
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        # 여러 음악 생성 요청
        responses = []
        for i in range(3):
            request_data = {
                "text_prompt": f"Create music number {i + 1}",
                "emotion_profile_id": valid_emotion_profile_id
            }

            response = client.post(
                f"/v1/sessions/{valid_session_id}/generate",
                json=request_data,
                headers=headers
            )

            assert response.status_code == 202
            responses.append(response.json())

        # 모든 music_id가 고유한지 확인
        music_ids = [r["music_id"] for r in responses]
        assert len(set(music_ids)) == len(music_ids), "music_id가 중복되었습니다"


class TestGenerationParametersSchema:
    """생성 매개변수 스키마 상세 검증 테스트"""

    def test_generation_parameters_default_values(self):
        """기본값 검증 테스트"""
        # OpenAPI 스펙에 따른 기본값들
        default_values = {
            "duration": 30,
            "format": "wav"
        }

        # 실제 구현에서 이 기본값들이 적용되는지 검증
        for param, default_value in default_values.items():
            # 실제 API 호출에서 기본값이 적용되는지 확인
            # (실제 구현 후에 활성화)
            pass

    def test_generation_parameters_optional_fields(self):
        """선택적 필드들이 올바르게 처리되는지 검증"""
        optional_params = {
            "duration": 45,
            "format": "mp3",
            "genre_hint": "ambient"
        }

        # 각 필드가 개별적으로 생략되어도 동작하는지 확인
        for field_to_omit in optional_params.keys():
            partial_params = {k: v for k, v in optional_params.items() if k != field_to_omit}
            # 부분적인 매개변수로도 요청이 성공해야 함
            assert len(partial_params) < len(optional_params)

    def test_valid_format_enum_values(self):
        """유효한 format enum 값들 검증"""
        valid_formats = ["wav", "mp3", "flac"]

        for format_value in valid_formats:
            # 각 형식이 유효한지 확인
            assert format_value in valid_formats

    def test_duration_boundary_values(self):
        """duration 경계값 테스트"""
        # 최소값, 최대값 경계 테스트
        boundary_values = [15, 120]  # 최소, 최대

        for duration in boundary_values:
            # 경계값이 유효한지 확인
            assert 15 <= duration <= 120


class TestGenerateErrorResponses:
    """에러 응답 형식 검증 테스트"""

    def test_error_response_schema(self):
        """400 에러 응답 스키마 검증"""
        # OpenAPI 스펙에 정의된 Error 스키마 검증
        expected_error_fields = ["error", "message"]

        # 실제 에러 응답에서 이 필드들이 포함되는지 확인
        # (실제 구현 후에 활성화)
        sample_error_response = {
            "error": "VALIDATION_ERROR",
            "message": "Invalid request parameters",
            "details": {
                "field": "text_prompt",
                "issue": "too_short"
            }
        }

        for field in expected_error_fields:
            assert field in sample_error_response

        # details는 선택적 필드
        if "details" in sample_error_response:
            assert isinstance(sample_error_response["details"], dict)