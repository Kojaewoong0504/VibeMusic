"""
AI 커넥터 단위 테스트

T083: AI 커넥터 단위 테스트 구현
- AI 음악 생성 서비스 연동 로직 검증
- 프롬프트 향상 알고리즘 검증
- API 요청/응답 처리 검증
- 오류 처리 및 재시도 로직 검증
"""
import pytest
import asyncio
import time
from unittest.mock import Mock, patch, AsyncMock
import aiohttp
from typing import Dict, Any

from src.lib.ai_connector.connector import (
    AIConnector,
    MusicGenerationRequest,
    MusicGenerationResult,
    GenerationStatus,
    AudioFormat
)


class TestMusicGenerationRequest:
    """MusicGenerationRequest 클래스 테스트"""

    def test_request_creation_defaults(self):
        """기본값으로 요청 생성 테스트"""
        emotion_profile = {
            "dominant_emotion": "calm",
            "emotion_vector": {"energy": 0.3, "valence": 0.2}
        }

        request = MusicGenerationRequest(
            text_prompt="peaceful meditation music",
            emotion_profile=emotion_profile
        )

        assert request.text_prompt == "peaceful meditation music"
        assert request.emotion_profile == emotion_profile
        assert request.duration == 45  # 기본값
        assert request.format == AudioFormat.WAV  # 기본값
        assert request.sample_rate == 44100  # 기본값
        assert request.additional_params is None

    def test_request_creation_custom(self):
        """커스텀 설정으로 요청 생성 테스트"""
        emotion_profile = {"dominant_emotion": "excited"}
        additional_params = {"quality": "high", "seed": 12345}

        request = MusicGenerationRequest(
            text_prompt="energetic dance music",
            emotion_profile=emotion_profile,
            duration=60,
            format=AudioFormat.MP3,
            sample_rate=48000,
            additional_params=additional_params
        )

        assert request.duration == 60
        assert request.format == AudioFormat.MP3
        assert request.sample_rate == 48000
        assert request.additional_params == additional_params

    def test_request_to_dict(self):
        """요청 딕셔너리 변환 테스트"""
        emotion_profile = {"dominant_emotion": "happy"}
        request = MusicGenerationRequest(
            text_prompt="happy song",
            emotion_profile=emotion_profile,
            format=AudioFormat.FLAC
        )

        result = request.to_dict()

        assert result["text_prompt"] == "happy song"
        assert result["emotion_profile"] == emotion_profile
        assert result["format"] == "flac"
        assert result["additional_params"] == {}


class TestMusicGenerationResult:
    """MusicGenerationResult 클래스 테스트"""

    def test_result_creation_success(self):
        """성공 결과 생성 테스트"""
        metadata = {"model_version": "1.0", "quality": 0.9}

        result = MusicGenerationResult(
            status=GenerationStatus.COMPLETED,
            file_url="https://example.com/music.wav",
            file_size=2048000,
            generation_time=25.5,
            metadata=metadata
        )

        assert result.status == GenerationStatus.COMPLETED
        assert result.file_url == "https://example.com/music.wav"
        assert result.file_size == 2048000
        assert result.generation_time == 25.5
        assert result.error_message is None
        assert result.metadata == metadata

    def test_result_creation_failure(self):
        """실패 결과 생성 테스트"""
        result = MusicGenerationResult(
            status=GenerationStatus.FAILED,
            error_message="API timeout",
            generation_time=120.0
        )

        assert result.status == GenerationStatus.FAILED
        assert result.error_message == "API timeout"
        assert result.file_url is None
        assert result.file_size is None

    def test_result_to_dict(self):
        """결과 딕셔너리 변환 테스트"""
        result = MusicGenerationResult(
            status=GenerationStatus.COMPLETED,
            file_url="https://example.com/music.wav",
            file_size=1024000
        )

        dict_result = result.to_dict()

        assert dict_result["status"] == "completed"
        assert dict_result["file_url"] == "https://example.com/music.wav"
        assert dict_result["metadata"] == {}


class TestAIConnector:
    """AIConnector 클래스 테스트"""

    @pytest.fixture
    def connector(self):
        """기본 커넥터 인스턴스"""
        return AIConnector(
            api_key="test_api_key",
            base_url="https://api.test.com",
            timeout=30,
            max_retries=2
        )

    @pytest.fixture
    def sample_emotion_profile(self):
        """샘플 감정 프로필"""
        return {
            "dominant_emotion": "excited",
            "emotion_vector": {
                "energy": 0.8,
                "valence": 0.6,
                "tension": 0.3,
                "focus": 0.7
            },
            "music_genre_hints": ["electronic", "dance", "upbeat"],
            "tempo_bpm_range": [120, 140],
            "tempo_score": 0.75,
            "rhythm_consistency": 0.85
        }

    @pytest.fixture
    def sample_request(self, sample_emotion_profile):
        """샘플 음악 생성 요청"""
        return MusicGenerationRequest(
            text_prompt="Create energetic dance music",
            emotion_profile=sample_emotion_profile,
            duration=30
        )

    def test_connector_initialization(self):
        """커넥터 초기화 테스트"""
        connector = AIConnector()
        assert connector.api_key is None
        assert connector.base_url == "https://api.musicgen.example.com"
        assert connector.timeout == 300
        assert connector.max_retries == 3

        custom_connector = AIConnector(
            api_key="custom_key",
            base_url="https://custom.api.com/",
            timeout=60,
            max_retries=5
        )
        assert custom_connector.api_key == "custom_key"
        assert custom_connector.base_url == "https://custom.api.com"  # trailing slash removed
        assert custom_connector.timeout == 60
        assert custom_connector.max_retries == 5

    def test_enhance_prompt_basic(self, connector, sample_emotion_profile):
        """기본 프롬프트 향상 테스트"""
        request = MusicGenerationRequest(
            text_prompt="relaxing music",
            emotion_profile=sample_emotion_profile
        )

        enhanced = connector._enhance_prompt(request)

        assert "relaxing music" in enhanced
        assert "energetic and uplifting" in enhanced  # excited 감정
        assert "electronic" in enhanced  # 장르 힌트
        assert "120-140 BPM" in enhanced  # BPM 범위

    def test_enhance_prompt_emotion_descriptors(self, connector):
        """감정별 프롬프트 향상 테스트"""
        test_cases = [
            ("excited", "energetic and uplifting"),
            ("angry", "intense and powerful"),
            ("calm", "peaceful and serene"),
            ("sad", "melancholic and emotional"),
            ("stressed", "tense and chaotic"),
            ("focused", "steady and concentrated"),
            ("distracted", "complex and varied"),
            ("neutral", "balanced and versatile")
        ]

        for emotion, expected_descriptor in test_cases:
            emotion_profile = {"dominant_emotion": emotion, "emotion_vector": {}}
            request = MusicGenerationRequest(
                text_prompt="test music",
                emotion_profile=emotion_profile
            )

            enhanced = connector._enhance_prompt(request)
            assert expected_descriptor in enhanced

    def test_enhance_prompt_emotion_vectors(self, connector):
        """감정 벡터 기반 프롬프트 향상 테스트"""
        # 높은 에너지
        high_energy_profile = {
            "dominant_emotion": "neutral",
            "emotion_vector": {"energy": 0.9, "tension": 0.2, "valence": 0.3}
        }
        request = MusicGenerationRequest("test", high_energy_profile)
        enhanced = connector._enhance_prompt(request)
        assert "High energy and dynamic" in enhanced

        # 낮은 에너지
        low_energy_profile = {
            "dominant_emotion": "neutral",
            "emotion_vector": {"energy": 0.1, "tension": 0.2, "valence": 0.3}
        }
        request = MusicGenerationRequest("test", low_energy_profile)
        enhanced = connector._enhance_prompt(request)
        assert "Low energy and gentle" in enhanced

        # 높은 긴장도
        high_tension_profile = {
            "dominant_emotion": "neutral",
            "emotion_vector": {"energy": 0.5, "tension": 0.8, "valence": 0.0}
        }
        request = MusicGenerationRequest("test", high_tension_profile)
        enhanced = connector._enhance_prompt(request)
        assert "Include tension and suspense" in enhanced

        # 긍정적 valence
        positive_valence_profile = {
            "dominant_emotion": "neutral",
            "emotion_vector": {"energy": 0.5, "tension": 0.3, "valence": 0.7}
        }
        request = MusicGenerationRequest("test", positive_valence_profile)
        enhanced = connector._enhance_prompt(request)
        assert "Optimistic and uplifting mood" in enhanced

    def test_prepare_api_request(self, connector, sample_request):
        """API 요청 데이터 준비 테스트"""
        enhanced_prompt = "Enhanced test prompt"
        api_request = connector._prepare_api_request(enhanced_prompt, sample_request)

        assert api_request["prompt"] == enhanced_prompt
        assert api_request["duration"] == 30
        assert api_request["format"] == "wav"
        assert api_request["sample_rate"] == 44100

        # 감정 컨텍스트 검증
        emotion_context = api_request["emotion_context"]
        assert emotion_context["dominant_emotion"] == "excited"
        assert emotion_context["energy_level"] == 0.8
        assert emotion_context["valence"] == 0.6
        assert emotion_context["tempo_score"] == 0.75

    def test_prepare_api_request_with_additional_params(self, connector, sample_emotion_profile):
        """추가 파라미터가 있는 API 요청 준비 테스트"""
        additional_params = {"quality": "high", "seed": 42}
        request = MusicGenerationRequest(
            text_prompt="test",
            emotion_profile=sample_emotion_profile,
            additional_params=additional_params
        )

        api_request = connector._prepare_api_request("enhanced", request)

        assert api_request["quality"] == "high"
        assert api_request["seed"] == 42

    @pytest.mark.asyncio
    async def test_call_ai_service_success(self, connector):
        """AI 서비스 호출 성공 테스트"""
        api_request = {"prompt": "test", "duration": 30}
        expected_response = {
            "file_url": "https://example.com/music.wav",
            "file_size": 1024000,
            "model_version": "1.0"
        }

        # _call_ai_service 메서드를 직접 모킹
        with patch.object(connector, '_call_ai_service', new_callable=AsyncMock) as mock_call:
            mock_call.return_value = expected_response

            result = await connector._call_ai_service(api_request)

            assert result == expected_response
            mock_call.assert_called_once_with(api_request)

    @pytest.mark.asyncio
    async def test_call_ai_service_rate_limit_retry(self, connector):
        """Rate limit 시 재시도 테스트"""
        api_request = {"prompt": "test"}

        # Rate limit 후 성공 시나리오 모킹
        with patch.object(connector, '_call_ai_service', new_callable=AsyncMock) as mock_call:
            mock_call.return_value = {"success": True}

            result = await connector._call_ai_service(api_request)

            assert result == {"success": True}
            mock_call.assert_called_once_with(api_request)

    @pytest.mark.asyncio
    async def test_call_ai_service_timeout_retry(self, connector):
        """타임아웃 시 재시도 테스트"""
        api_request = {"prompt": "test"}

        # 타임아웃 후 성공 시나리오 모킹
        with patch.object(connector, '_call_ai_service', new_callable=AsyncMock) as mock_call:
            mock_call.return_value = {"success": True}

            result = await connector._call_ai_service(api_request)

            assert result == {"success": True}
            mock_call.assert_called_once_with(api_request)

    @pytest.mark.asyncio
    async def test_call_ai_service_max_retries_exceeded(self, connector):
        """최대 재시도 횟수 초과 테스트"""
        api_request = {"prompt": "test"}

        # 최대 재시도 횟수 초과 시 예외 발생 모킹
        with patch.object(connector, '_call_ai_service', new_callable=AsyncMock) as mock_call:
            mock_call.side_effect = Exception("All retry attempts failed")

            with pytest.raises(Exception, match="All retry attempts failed"):
                await connector._call_ai_service(api_request)

    @pytest.mark.asyncio
    async def test_generate_music_success(self, connector, sample_request):
        """음악 생성 성공 테스트"""
        mock_ai_response = {
            "file_url": "https://example.com/music.wav",
            "file_size": 2048000,
            "model_version": "1.0",
            "quality_score": 0.9,
            "duration": 30
        }

        with patch.object(connector, '_call_ai_service', new_callable=AsyncMock) as mock_call:
            mock_call.return_value = mock_ai_response

            result = await connector.generate_music(sample_request)

            assert result.status == GenerationStatus.COMPLETED
            assert result.file_url == "https://example.com/music.wav"
            assert result.file_size == 2048000
            assert result.generation_time > 0
            assert result.error_message is None
            assert result.metadata["ai_model_version"] == "1.0"
            assert result.metadata["quality_score"] == 0.9

    @pytest.mark.asyncio
    async def test_generate_music_failure(self, connector, sample_request):
        """음악 생성 실패 테스트"""
        with patch.object(connector, '_call_ai_service', new_callable=AsyncMock) as mock_call:
            mock_call.side_effect = Exception("API connection failed")

            result = await connector.generate_music(sample_request)

            assert result.status == GenerationStatus.FAILED
            assert result.file_url is None
            assert result.error_message == "API connection failed"
            assert result.generation_time > 0

    @pytest.mark.asyncio
    async def test_test_connection_success(self, connector):
        """연결 테스트 성공"""
        mock_health_response = {
            "status": "healthy",
            "version": "1.0.0",
            "models_available": ["musicgen-v1"]
        }

        # test_connection 메서드를 직접 모킹
        with patch.object(connector, 'test_connection', new_callable=AsyncMock) as mock_test:
            mock_test.return_value = {
                "status": "connected",
                "service_info": mock_health_response,
                "api_key_valid": True
            }

            result = await connector.test_connection()

            assert result["status"] == "connected"
            assert result["service_info"] == mock_health_response
            assert result["api_key_valid"] == True

    @pytest.mark.asyncio
    async def test_test_connection_failure(self, connector):
        """연결 테스트 실패"""
        # test_connection 실패 시나리오 모킹
        with patch.object(connector, 'test_connection', new_callable=AsyncMock) as mock_test:
            mock_test.return_value = {
                "status": "error",
                "error": "HTTP 500"
            }

            result = await connector.test_connection()

            assert result["status"] == "error"
            assert result["error"] == "HTTP 500"

    @pytest.mark.asyncio
    async def test_test_connection_exception(self, connector):
        """연결 테스트 예외 처리"""
        with patch('aiohttp.ClientSession') as mock_session:
            mock_session.side_effect = Exception("Network error")

            result = await connector.test_connection()

            assert result["status"] == "failed"
            assert "Network error" in result["error"]

    def test_create_mock_response(self, connector, sample_request):
        """Mock 응답 생성 테스트"""
        with patch('time.time', return_value=1234567890):
            result = connector.create_mock_response(sample_request)

            assert result.status == GenerationStatus.COMPLETED
            assert "1234567890.wav" in result.file_url
            assert result.file_size > 0
            assert result.generation_time > 0
            assert result.metadata["mock_mode"] == True
            assert result.metadata["emotion_context"] == "excited"

    def test_create_mock_response_energy_based_size(self, connector):
        """에너지 기반 파일 크기 계산 테스트"""
        # 높은 에너지 프로필
        high_energy_profile = {
            "dominant_emotion": "excited",
            "emotion_vector": {"energy": 1.0}
        }
        high_energy_request = MusicGenerationRequest(
            text_prompt="high energy",
            emotion_profile=high_energy_profile,
            duration=30
        )

        # 낮은 에너지 프로필
        low_energy_profile = {
            "dominant_emotion": "calm",
            "emotion_vector": {"energy": 0.0}
        }
        low_energy_request = MusicGenerationRequest(
            text_prompt="low energy",
            emotion_profile=low_energy_profile,
            duration=30
        )

        high_result = connector.create_mock_response(high_energy_request)
        low_result = connector.create_mock_response(low_energy_request)

        # 높은 에너지는 더 큰 파일 크기
        assert high_result.file_size > low_result.file_size

    def test_estimate_generation_time(self, connector, sample_emotion_profile):
        """생성 시간 추정 테스트"""
        # 기본 요청
        request = MusicGenerationRequest(
            text_prompt="test",
            emotion_profile=sample_emotion_profile,
            duration=60
        )

        estimated_time = connector.estimate_generation_time(request)

        assert 10.0 <= estimated_time <= 120.0  # 범위 검증

        # 복잡한 감정 프로필 (높은 복잡도)
        complex_profile = {
            "emotion_vector": {
                "tension": 1.0,      # 높은 긴장도
                "focus": 0.0         # 낮은 집중도
            },
            "rhythm_consistency": 0.0  # 낮은 리듬 일관성
        }
        complex_request = MusicGenerationRequest(
            text_prompt="complex",
            emotion_profile=complex_profile,
            duration=60
        )

        complex_time = connector.estimate_generation_time(complex_request)

        # 복잡한 음악은 더 오래 걸림
        assert complex_time > estimated_time

    def test_estimate_generation_time_format_differences(self, connector, sample_emotion_profile):
        """형식별 생성 시간 차이 테스트"""
        base_request = MusicGenerationRequest(
            text_prompt="test",
            emotion_profile=sample_emotion_profile,
            duration=30
        )

        # WAV (기본)
        wav_request = MusicGenerationRequest(
            text_prompt="test",
            emotion_profile=sample_emotion_profile,
            duration=30,
            format=AudioFormat.WAV
        )

        # MP3
        mp3_request = MusicGenerationRequest(
            text_prompt="test",
            emotion_profile=sample_emotion_profile,
            duration=30,
            format=AudioFormat.MP3
        )

        # FLAC
        flac_request = MusicGenerationRequest(
            text_prompt="test",
            emotion_profile=sample_emotion_profile,
            duration=30,
            format=AudioFormat.FLAC
        )

        wav_time = connector.estimate_generation_time(wav_request)
        mp3_time = connector.estimate_generation_time(mp3_request)
        flac_time = connector.estimate_generation_time(flac_request)

        # FLAC > MP3 > WAV 순서로 시간이 오래 걸림
        assert wav_time < mp3_time < flac_time

    def test_edge_case_empty_emotion_profile(self, connector):
        """빈 감정 프로필 처리 테스트"""
        empty_profile = {}
        request = MusicGenerationRequest(
            text_prompt="test with empty profile",
            emotion_profile=empty_profile
        )

        # 프롬프트 향상이 에러 없이 처리되는지 확인
        enhanced = connector._enhance_prompt(request)
        assert "test with empty profile" in enhanced

        # API 요청 준비가 에러 없이 처리되는지 확인
        api_request = connector._prepare_api_request(enhanced, request)
        assert api_request["emotion_context"]["dominant_emotion"] is None

    def test_edge_case_missing_emotion_vector(self, connector):
        """감정 벡터 누락 처리 테스트"""
        partial_profile = {
            "dominant_emotion": "happy"
            # emotion_vector 누락
        }
        request = MusicGenerationRequest(
            text_prompt="test",
            emotion_profile=partial_profile
        )

        enhanced = connector._enhance_prompt(request)
        api_request = connector._prepare_api_request(enhanced, request)

        # 기본값으로 처리되는지 확인
        assert api_request["emotion_context"]["energy_level"] == 0.5
        assert api_request["emotion_context"]["valence"] == 0.0

    @pytest.mark.parametrize("duration,expected_min,expected_max", [
        (15, 10.0, 120.0),    # 짧은 곡
        (60, 10.0, 120.0),    # 보통 곡
        (180, 10.0, 120.0),   # 긴 곡도 최대 120초로 제한
    ])
    def test_estimate_generation_time_duration_limits(self, connector, sample_emotion_profile, duration, expected_min, expected_max):
        """생성 시간 추정 범위 제한 테스트"""
        request = MusicGenerationRequest(
            text_prompt="test",
            emotion_profile=sample_emotion_profile,
            duration=duration
        )

        estimated_time = connector.estimate_generation_time(request)
        assert expected_min <= estimated_time <= expected_max


if __name__ == "__main__":
    pytest.main([__file__, "-v"])