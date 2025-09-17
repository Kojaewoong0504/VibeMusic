"""
T009: POST /sessions/{id}/analyze 계약 테스트

타이핑 패턴 분석 API의 계약을 검증하는 테스트입니다.
OpenAPI 스펙에 정의된 키스트로크 분석 및 감정 프로필 생성을 엄격히 검증합니다.

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


class TestAnalyzePost:
    """POST /sessions/{session_id}/analyze 엔드포인트 계약 테스트"""

    @pytest.fixture
    def valid_session_token(self):
        """테스트용 유효한 세션 토큰"""
        return "test_session_token_12345"

    @pytest.fixture
    def valid_session_id(self):
        """테스트용 유효한 세션 ID"""
        return str(uuid.uuid4())

    @pytest.fixture
    def valid_keystrokes_data(self):
        """유효한 키스트로크 테스트 데이터"""
        return [
            {
                "key": "h",
                "timestamp": 1694780400000.0,  # 2023-09-15 10:00:00
                "duration": 80.5,
                "type": "keydown"
            },
            {
                "key": "h",
                "timestamp": 1694780400080.5,
                "type": "keyup"
            },
            {
                "key": "e",
                "timestamp": 1694780400200.0,
                "duration": 75.0,
                "type": "keydown"
            },
            {
                "key": "e",
                "timestamp": 1694780400275.0,
                "type": "keyup"
            },
            {
                "key": "l",
                "timestamp": 1694780400400.0,
                "duration": 85.0,
                "type": "keydown"
            },
            {
                "key": "l",
                "timestamp": 1694780400485.0,
                "type": "keyup"
            },
            {
                "key": "l",
                "timestamp": 1694780400600.0,
                "duration": 90.0,
                "type": "keydown"
            },
            {
                "key": "l",
                "timestamp": 1694780400690.0,
                "type": "keyup"
            },
            {
                "key": "o",
                "timestamp": 1694780400800.0,
                "duration": 70.0,
                "type": "keydown"
            },
            {
                "key": "o",
                "timestamp": 1694780400870.0,
                "type": "keyup"
            }
        ]

    def test_analyze_typing_pattern_success(self, valid_session_id, valid_session_token, valid_keystrokes_data):
        """
        정상적인 타이핑 패턴 분석 요청 테스트

        계약 검증:
        - 요청: keystrokes 배열(최소 10개), text_content, 인증 토큰
        - 응답: 200, pattern_id, emotion_profile 객체
        """
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        request_data = {
            "keystrokes": valid_keystrokes_data,
            "text_content": "hello world test"
        }

        response = client.post(
            f"/v1/sessions/{valid_session_id}/analyze",
            json=request_data,
            headers=headers
        )

        # 응답 상태 코드 검증
        assert response.status_code == 200

        # 응답 데이터 구조 검증
        analysis_result = response.json()

        # 필수 필드 존재 확인
        assert "pattern_id" in analysis_result
        assert "emotion_profile" in analysis_result

        # pattern_id UUID 형식 검증
        pattern_id = analysis_result["pattern_id"]
        assert isinstance(pattern_id, str)

        try:
            uuid.UUID(pattern_id)
        except ValueError:
            pytest.fail(f"pattern_id는 유효한 UUID여야 합니다: {pattern_id}")

        # emotion_profile 객체 구조 검증
        emotion_profile = analysis_result["emotion_profile"]
        assert isinstance(emotion_profile, dict)

        # EmotionProfile 스키마 필수 필드 검증
        required_emotion_fields = [
            "id", "tempo_score", "rhythm_consistency", "pause_intensity",
            "emotion_vector", "confidence_score", "created_at"
        ]

        for field in required_emotion_fields:
            assert field in emotion_profile, f"emotion_profile에 필수 필드 '{field}'가 없습니다"

        # 감정 벡터 필드 검증
        emotion_vector = emotion_profile["emotion_vector"]
        assert isinstance(emotion_vector, dict)

        emotion_vector_fields = ["energy", "valence", "tension", "focus"]
        for field in emotion_vector_fields:
            assert field in emotion_vector, f"emotion_vector에 필수 필드 '{field}'가 없습니다"
            value = emotion_vector[field]
            assert isinstance(value, (int, float)), f"{field}는 숫자여야 합니다"

            # 값 범위 검증
            if field == "valence":
                assert -1.0 <= value <= 1.0, f"valence는 -1.0~1.0 범위여야 합니다: {value}"
            else:
                assert 0.0 <= value <= 1.0, f"{field}는 0.0~1.0 범위여야 합니다: {value}"

        # 점수 필드 범위 검증
        score_fields = ["tempo_score", "rhythm_consistency", "pause_intensity", "confidence_score"]
        for field in score_fields:
            value = emotion_profile[field]
            assert isinstance(value, (int, float))
            assert 0.0 <= value <= 1.0, f"{field}는 0.0~1.0 범위여야 합니다: {value}"

    def test_analyze_minimum_keystrokes(self, valid_session_id, valid_session_token):
        """
        최소 키스트로크 개수 테스트

        계약 검증:
        - keystrokes 배열은 최소 10개 이상이어야 함
        """
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        # 정확히 10개의 키스트로크
        min_keystrokes = []
        for i in range(10):
            min_keystrokes.extend([
                {
                    "key": chr(ord('a') + i),
                    "timestamp": 1694780400000.0 + i * 100,
                    "duration": 80.0,
                    "type": "keydown"
                },
                {
                    "key": chr(ord('a') + i),
                    "timestamp": 1694780400080.0 + i * 100,
                    "type": "keyup"
                }
            ])

        request_data = {
            "keystrokes": min_keystrokes[:10],  # 정확히 10개
            "text_content": "abcdefghij"
        }

        response = client.post(
            f"/v1/sessions/{valid_session_id}/analyze",
            json=request_data,
            headers=headers
        )

        assert response.status_code == 200

    def test_analyze_insufficient_keystrokes(self, valid_session_id, valid_session_token):
        """
        키스트로크 개수 부족 시 에러 테스트

        계약 검증:
        - keystrokes 개수가 10개 미만이면 400 에러
        """
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        insufficient_keystrokes = [
            {
                "key": "a",
                "timestamp": 1694780400000.0,
                "duration": 80.0,
                "type": "keydown"
            }
        ]  # 1개만

        request_data = {
            "keystrokes": insufficient_keystrokes,
            "text_content": "a"
        }

        response = client.post(
            f"/v1/sessions/{valid_session_id}/analyze",
            json=request_data,
            headers=headers
        )

        assert response.status_code == 400

        # 에러 응답 구조 검증
        error_data = response.json()
        assert "error" in error_data
        assert "message" in error_data

    def test_analyze_missing_required_fields(self, valid_session_id, valid_session_token):
        """필수 필드 누락 시 에러 테스트"""
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        # keystrokes 누락
        request_data = {
            "text_content": "hello world"
        }

        response = client.post(
            f"/v1/sessions/{valid_session_id}/analyze",
            json=request_data,
            headers=headers
        )

        assert response.status_code == 400

        # text_content 누락
        request_data = {
            "keystrokes": [
                {
                    "key": "a",
                    "timestamp": 1694780400000.0,
                    "type": "keydown"
                }
            ] * 10
        }

        response = client.post(
            f"/v1/sessions/{valid_session_id}/analyze",
            json=request_data,
            headers=headers
        )

        assert response.status_code == 400

    def test_analyze_invalid_keystroke_schema(self, valid_session_id, valid_session_token):
        """잘못된 키스트로크 스키마 테스트"""
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        # 필수 필드 누락된 키스트로크
        invalid_keystrokes = [
            {
                "key": "a",
                # timestamp 누락
                "type": "keydown"
            }
        ] * 10

        request_data = {
            "keystrokes": invalid_keystrokes,
            "text_content": "hello world"
        }

        response = client.post(
            f"/v1/sessions/{valid_session_id}/analyze",
            json=request_data,
            headers=headers
        )

        assert response.status_code == 400

    def test_analyze_text_content_length_validation(self, valid_session_id, valid_session_token, valid_keystrokes_data):
        """텍스트 콘텐츠 길이 검증 테스트"""
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        # 너무 짧은 텍스트 (10자 미만)
        request_data = {
            "keystrokes": valid_keystrokes_data,
            "text_content": "short"  # 5자
        }

        response = client.post(
            f"/v1/sessions/{valid_session_id}/analyze",
            json=request_data,
            headers=headers
        )

        assert response.status_code == 400

        # 너무 긴 텍스트 (1000자 초과)
        request_data = {
            "keystrokes": valid_keystrokes_data,
            "text_content": "x" * 1001  # 1001자
        }

        response = client.post(
            f"/v1/sessions/{valid_session_id}/analyze",
            json=request_data,
            headers=headers
        )

        assert response.status_code == 400

    def test_analyze_unauthorized_access(self, valid_session_id, valid_keystrokes_data):
        """인증되지 않은 접근 테스트"""
        # 토큰 없음
        request_data = {
            "keystrokes": valid_keystrokes_data,
            "text_content": "hello world test"
        }

        response = client.post(
            f"/v1/sessions/{valid_session_id}/analyze",
            json=request_data
        )

        assert response.status_code == 401

    def test_analyze_invalid_token(self, valid_session_id, valid_keystrokes_data):
        """잘못된 토큰으로 접근 테스트"""
        headers = {
            "Authorization": "Bearer invalid_token"
        }

        request_data = {
            "keystrokes": valid_keystrokes_data,
            "text_content": "hello world test"
        }

        response = client.post(
            f"/v1/sessions/{valid_session_id}/analyze",
            json=request_data,
            headers=headers
        )

        assert response.status_code == 401

    def test_analyze_session_not_found(self, valid_session_token, valid_keystrokes_data):
        """존재하지 않는 세션 ID로 분석 요청"""
        non_existent_session_id = str(uuid.uuid4())
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        request_data = {
            "keystrokes": valid_keystrokes_data,
            "text_content": "hello world test"
        }

        response = client.post(
            f"/v1/sessions/{non_existent_session_id}/analyze",
            json=request_data,
            headers=headers
        )

        assert response.status_code == 404

    def test_analyze_invalid_session_uuid(self, valid_session_token, valid_keystrokes_data):
        """잘못된 UUID 형식의 세션 ID 테스트"""
        invalid_session_id = "not-a-valid-uuid"
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        request_data = {
            "keystrokes": valid_keystrokes_data,
            "text_content": "hello world test"
        }

        response = client.post(
            f"/v1/sessions/{invalid_session_id}/analyze",
            json=request_data,
            headers=headers
        )

        assert response.status_code == 400

    def test_analyze_response_content_type(self, valid_session_id, valid_session_token, valid_keystrokes_data):
        """응답 Content-Type 검증"""
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        request_data = {
            "keystrokes": valid_keystrokes_data,
            "text_content": "hello world test"
        }

        response = client.post(
            f"/v1/sessions/{valid_session_id}/analyze",
            json=request_data,
            headers=headers
        )

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/json"


class TestAnalyzeKeystrokeSchema:
    """키스트로크 스키마 상세 검증 테스트"""

    def test_keystroke_required_fields(self):
        """키스트로크 필수 필드 검증"""
        # 유효한 키스트로크
        valid_keystroke = {
            "key": "a",
            "timestamp": 1694780400000.0,
            "type": "keydown"
        }

        # 필수 필드가 모두 있는지 확인
        required_fields = ["key", "timestamp", "type"]
        for field in required_fields:
            assert field in valid_keystroke

    def test_keystroke_type_enum(self):
        """키스트로크 타입 enum 검증"""
        valid_types = ["keydown", "keyup"]

        for event_type in valid_types:
            keystroke = {
                "key": "a",
                "timestamp": 1694780400000.0,
                "type": event_type
            }

            # 유효한 타입인지 확인
            assert keystroke["type"] in valid_types

    def test_keystroke_optional_duration(self):
        """키스트로크 duration 선택적 필드 검증"""
        # duration이 있는 경우
        keystroke_with_duration = {
            "key": "a",
            "timestamp": 1694780400000.0,
            "duration": 80.5,
            "type": "keydown"
        }

        if "duration" in keystroke_with_duration:
            assert isinstance(keystroke_with_duration["duration"], (int, float))
            assert keystroke_with_duration["duration"] >= 0

        # duration이 없는 경우도 유효해야 함
        keystroke_without_duration = {
            "key": "a",
            "timestamp": 1694780400000.0,
            "type": "keyup"
        }

        # duration이 없어도 유효한 키스트로크
        required_fields = ["key", "timestamp", "type"]
        for field in required_fields:
            assert field in keystroke_without_duration


class TestAnalyzeEmotionProfile:
    """EmotionProfile 응답 스키마 검증 테스트"""

    @pytest.fixture
    def sample_emotion_profile(self):
        """샘플 EmotionProfile 데이터"""
        return {
            "id": str(uuid.uuid4()),
            "tempo_score": 0.75,
            "rhythm_consistency": 0.82,
            "pause_intensity": 0.65,
            "emotion_vector": {
                "energy": 0.8,
                "valence": 0.3,
                "tension": 0.6,
                "focus": 0.9
            },
            "confidence_score": 0.85,
            "created_at": "2024-09-15T10:30:00Z"
        }

    def test_emotion_profile_schema_completeness(self, sample_emotion_profile):
        """EmotionProfile 스키마 완전성 검증"""
        profile = sample_emotion_profile

        # 모든 필수 필드 존재 확인
        required_fields = [
            "id", "tempo_score", "rhythm_consistency", "pause_intensity",
            "emotion_vector", "confidence_score", "created_at"
        ]

        for field in required_fields:
            assert field in profile, f"필수 필드 '{field}'가 없습니다"

    def test_emotion_vector_completeness(self, sample_emotion_profile):
        """EmotionVector 스키마 완전성 검증"""
        emotion_vector = sample_emotion_profile["emotion_vector"]

        required_vector_fields = ["energy", "valence", "tension", "focus"]
        for field in required_vector_fields:
            assert field in emotion_vector, f"emotion_vector에 필수 필드 '{field}'가 없습니다"

    def test_emotion_profile_value_ranges(self, sample_emotion_profile):
        """EmotionProfile 값 범위 검증"""
        profile = sample_emotion_profile

        # 0.0~1.0 범위 필드들
        range_01_fields = ["tempo_score", "rhythm_consistency", "pause_intensity", "confidence_score"]
        for field in range_01_fields:
            value = profile[field]
            assert 0.0 <= value <= 1.0, f"{field}는 0.0~1.0 범위여야 합니다: {value}"

        # emotion_vector 내 필드들
        emotion_vector = profile["emotion_vector"]

        # valence는 -1.0~1.0 범위
        assert -1.0 <= emotion_vector["valence"] <= 1.0

        # 나머지는 0.0~1.0 범위
        for field in ["energy", "tension", "focus"]:
            value = emotion_vector[field]
            assert 0.0 <= value <= 1.0, f"{field}는 0.0~1.0 범위여야 합니다: {value}"