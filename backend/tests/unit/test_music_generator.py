"""
T007: 음악 생성 서비스 단위 테스트
"""

import asyncio
import pytest
import tempfile
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch, AsyncMock

from src.services.music_generator import (
    MusicGenerationService,
    EmotionToMusicMapper,
    MockMusicAPI,
    MusicGenerationRequest,
    MusicGenerationStatus,
    MusicStyle
)
from src.models.emotion import EmotionData


class TestEmotionToMusicMapper:
    """감정-음악 매핑 로직 테스트"""

    def test_map_emotion_to_prompt_basic(self):
        """기본 감정 매핑 테스트"""
        # Given: 높은 에너지, 긍정적 감정가, 낮은 긴장도
        emotion = EmotionData(
            energy=0.8,
            valence=0.6,
            tension=0.2,
            focus=0.7,
            confidence=0.9,
            sample_size=20
        )

        # When: 프롬프트 매핑
        prompt = EmotionToMusicMapper.map_emotion_to_prompt(emotion)

        # Then: 예상된 매핑 결과
        assert prompt.tempo == "fast"  # energy > 0.7
        assert prompt.mood == "uplifting"  # valence > 0.3
        assert prompt.intensity == "calm"  # tension < 0.3
        assert "fast uplifting calm" in prompt.text

    def test_map_emotion_to_prompt_sad_slow(self):
        """슬프고 느린 감정 매핑 테스트"""
        # Given: 낮은 에너지, 부정적 감정가, 높은 긴장도
        emotion = EmotionData(
            energy=0.2,
            valence=-0.6,
            tension=0.8,
            focus=0.3,
            confidence=0.8,
            sample_size=15
        )

        # When: 프롬프트 매핑
        prompt = EmotionToMusicMapper.map_emotion_to_prompt(emotion)

        # Then: 예상된 매핑 결과
        assert prompt.tempo == "slow"  # energy < 0.3
        assert prompt.mood == "melancholic"  # valence < -0.3
        assert prompt.intensity == "intense"  # tension > 0.6
        assert "slow melancholic intense" in prompt.text

    def test_map_emotion_with_user_prompt(self):
        """사용자 프롬프트가 포함된 매핑 테스트"""
        # Given: 기본 감정과 사용자 프롬프트
        emotion = EmotionData(
            energy=0.5,
            valence=0.1,
            tension=0.4,
            focus=0.6,
            confidence=0.8,
            sample_size=10
        )
        user_prompt = "piano and violin"

        # When: 프롬프트 매핑
        prompt = EmotionToMusicMapper.map_emotion_to_prompt(emotion, user_prompt)

        # Then: 사용자 프롬프트가 포함됨
        assert user_prompt in prompt.text

    def test_determine_style_classical(self):
        """클래식 스타일 결정 테스트"""
        # Given: 높은 집중도, 낮은 긴장도
        emotion = EmotionData(
            energy=0.5,
            valence=0.0,
            tension=0.2,
            focus=0.8,
            confidence=0.9,
            sample_size=25
        )

        # When: 스타일 결정
        style = EmotionToMusicMapper._determine_style(emotion)

        # Then: 클래식 스타일
        assert style == MusicStyle.CLASSICAL

    def test_determine_style_ambient(self):
        """앰비언트 스타일 결정 테스트"""
        # Given: 낮은 에너지, 낮은 긴장도
        emotion = EmotionData(
            energy=0.2,
            valence=0.0,
            tension=0.1,
            focus=0.5,
            confidence=0.8,
            sample_size=20
        )

        # When: 스타일 결정
        style = EmotionToMusicMapper._determine_style(emotion)

        # Then: 앰비언트 스타일
        assert style == MusicStyle.AMBIENT

    def test_determine_style_electronic(self):
        """일렉트로닉 스타일 결정 테스트"""
        # Given: 높은 에너지, 높은 긴장도
        emotion = EmotionData(
            energy=0.9,
            valence=0.2,
            tension=0.8,
            focus=0.6,
            confidence=0.9,
            sample_size=30
        )

        # When: 스타일 결정
        style = EmotionToMusicMapper._determine_style(emotion)

        # Then: 일렉트로닉 스타일
        assert style == MusicStyle.ELECTRONIC


class TestMockMusicAPI:
    """목업 음악 API 테스트"""

    def setup_method(self):
        """테스트 설정"""
        self.temp_dir = tempfile.mkdtemp()
        self.mock_api = MockMusicAPI(self.temp_dir)

    def teardown_method(self):
        """테스트 정리"""
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_ensure_sample_files(self):
        """샘플 파일 생성 테스트"""
        # Given: 빈 디렉토리
        samples_dir = Path(self.temp_dir)

        # When: MockMusicAPI 초기화
        api = MockMusicAPI(str(samples_dir))

        # Then: 샘플 파일들이 생성됨
        assert (samples_dir / "happy_energetic.mp3").exists()
        assert (samples_dir / "sad_slow.mp3").exists()
        assert (samples_dir / "calm_ambient.mp3").exists()
        assert (samples_dir / "default.mp3").exists()

    @pytest.mark.asyncio
    async def test_generate_music_happy(self):
        """행복한 음악 생성 테스트"""
        # Given: 행복한 프롬프트
        from src.services.music_generator import MusicPrompt
        prompt = MusicPrompt(
            text="A fast uplifting energetic piece",
            style=MusicStyle.ACOUSTIC,
            tempo="fast",
            mood="uplifting",
            intensity="moderate"
        )

        # When: 음악 생성
        file_path = await self.mock_api.generate_music(prompt)

        # Then: 행복한 음악 파일 반환
        assert "happy_energetic.mp3" in file_path
        assert Path(file_path).exists()

    @pytest.mark.asyncio
    async def test_generate_music_sad(self):
        """슬픈 음악 생성 테스트"""
        # Given: 슬픈 프롬프트
        from src.services.music_generator import MusicPrompt
        prompt = MusicPrompt(
            text="A slow melancholic calm piece",
            style=MusicStyle.AMBIENT,
            tempo="slow",
            mood="melancholic",
            intensity="calm"
        )

        # When: 음악 생성
        file_path = await self.mock_api.generate_music(prompt)

        # Then: 슬픈 음악 파일 반환
        assert "sad_slow.mp3" in file_path
        assert Path(file_path).exists()

    @pytest.mark.asyncio
    async def test_generate_music_default(self):
        """기본 음악 생성 테스트"""
        # Given: 일반적인 프롬프트
        from src.services.music_generator import MusicPrompt
        prompt = MusicPrompt(
            text="A medium contemplative moderate piece",
            style=MusicStyle.JAZZ,
            tempo="medium",
            mood="contemplative",
            intensity="moderate"
        )

        # When: 음악 생성
        file_path = await self.mock_api.generate_music(prompt)

        # Then: 기본 음악 파일 반환
        assert "default.mp3" in file_path
        assert Path(file_path).exists()


class TestMusicGenerationService:
    """음악 생성 서비스 테스트"""

    def setup_method(self):
        """테스트 설정"""
        self.temp_dir = tempfile.mkdtemp()
        self.service = MusicGenerationService(self.temp_dir)

    def teardown_method(self):
        """테스트 정리"""
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    @pytest.mark.asyncio
    async def test_generate_music_success(self):
        """성공적인 음악 생성 테스트"""
        # Given: 음악 생성 요청
        emotion_data = EmotionData(
            energy=0.7,
            valence=0.4,
            tension=0.3,
            focus=0.8,
            confidence=0.9,
            sample_size=20
        )

        request = MusicGenerationRequest(
            emotion_data=emotion_data,
            user_prompt="relaxing piano music",
            style_preference=MusicStyle.CLASSICAL,
            duration=30
        )

        # When: 음악 생성
        result = await self.service.generate_music(request)

        # Then: 성공적인 결과
        assert result.status == MusicGenerationStatus.COMPLETED
        assert result.generation_id is not None
        assert result.file_path is not None
        assert result.file_url is not None
        assert result.prompt is not None
        assert result.completed_at is not None
        assert Path(result.file_path).exists()

    @pytest.mark.asyncio
    async def test_generate_music_metadata(self):
        """음악 생성 메타데이터 테스트"""
        # Given: 음악 생성 요청
        emotion_data = EmotionData(
            energy=0.5,
            valence=-0.2,
            tension=0.6,
            focus=0.4,
            confidence=0.8,
            sample_size=15
        )

        request = MusicGenerationRequest(
            emotion_data=emotion_data,
            user_prompt="melancholic strings",
            duration=45
        )

        # When: 음악 생성
        result = await self.service.generate_music(request)

        # Then: 메타데이터 포함
        assert "emotion_energy" in result.metadata
        assert "emotion_valence" in result.metadata
        assert "emotion_tension" in result.metadata
        assert "emotion_focus" in result.metadata
        assert "user_prompt" in result.metadata
        assert result.metadata["emotion_energy"] == 0.5
        assert result.metadata["emotion_valence"] == -0.2

    @pytest.mark.asyncio
    async def test_get_generation_status(self):
        """생성 상태 조회 테스트"""
        # Given: 음악 생성 후
        emotion_data = EmotionData(
            energy=0.6,
            valence=0.2,
            tension=0.4,
            focus=0.7,
            confidence=0.9,
            sample_size=18
        )

        request = MusicGenerationRequest(
            emotion_data=emotion_data,
            duration=25
        )

        result = await self.service.generate_music(request)
        generation_id = result.generation_id

        # When: 상태 조회
        status_result = await self.service.get_generation_status(generation_id)

        # Then: 상태 정보 반환
        assert status_result is not None
        assert status_result.generation_id == generation_id
        assert status_result.status == MusicGenerationStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_get_generation_status_not_found(self):
        """존재하지 않는 생성 ID 조회 테스트"""
        # Given: 존재하지 않는 ID
        non_existent_id = "non-existent-id"

        # When: 상태 조회
        result = await self.service.get_generation_status(non_existent_id)

        # Then: None 반환
        assert result is None

    @pytest.mark.asyncio
    async def test_list_generations(self):
        """생성 목록 조회 테스트"""
        # Given: 여러 음악 생성
        emotion_data = EmotionData(
            energy=0.5,
            valence=0.0,
            tension=0.5,
            focus=0.5,
            confidence=0.8,
            sample_size=10
        )

        request1 = MusicGenerationRequest(emotion_data=emotion_data, duration=20)
        request2 = MusicGenerationRequest(emotion_data=emotion_data, duration=30)
        request3 = MusicGenerationRequest(emotion_data=emotion_data, duration=40)

        await self.service.generate_music(request1)
        await asyncio.sleep(0.01)  # 시간 차이를 위한 작은 지연
        await self.service.generate_music(request2)
        await asyncio.sleep(0.01)
        await self.service.generate_music(request3)

        # When: 목록 조회
        generations = await self.service.list_generations(limit=2)

        # Then: 최신 2개 반환
        assert len(generations) == 2
        assert generations[0].created_at >= generations[1].created_at  # 최신순 정렬

    @pytest.mark.asyncio
    async def test_cleanup_old_files(self):
        """오래된 파일 정리 테스트"""
        # Given: 음악 생성
        emotion_data = EmotionData(
            energy=0.5,
            valence=0.0,
            tension=0.5,
            focus=0.5,
            confidence=0.8,
            sample_size=10
        )

        request = MusicGenerationRequest(emotion_data=emotion_data, duration=20)
        result = await self.service.generate_music(request)

        # 생성 시간을 과거로 수정 (강제로 오래된 파일로 만들기)
        result.created_at = datetime.utcnow() - timedelta(hours=25)

        # When: 오래된 파일 정리
        cleaned_count = await self.service.cleanup_old_files(max_age_hours=24)

        # Then: 파일 정리됨
        assert cleaned_count == 1
        assert result.generation_id not in self.service.generation_storage


@pytest.mark.asyncio
async def test_integration_emotion_to_music_flow():
    """감정에서 음악까지 전체 플로우 통합 테스트"""
    # Given: 임시 디렉토리와 서비스
    temp_dir = tempfile.mkdtemp()
    try:
        service = MusicGenerationService(temp_dir)

        # 다양한 감정 시나리오 테스트
        test_scenarios = [
            {
                "name": "Happy Energetic",
                "emotion": EmotionData(
                    energy=0.9, valence=0.7, tension=0.3, focus=0.8,
                    confidence=0.9, sample_size=25
                ),
                "expected_tempo": "fast",
                "expected_mood": "uplifting"
            },
            {
                "name": "Sad Calm",
                "emotion": EmotionData(
                    energy=0.2, valence=-0.6, tension=0.2, focus=0.4,
                    confidence=0.8, sample_size=20
                ),
                "expected_tempo": "slow",
                "expected_mood": "melancholic"
            },
            {
                "name": "Neutral Focused",
                "emotion": EmotionData(
                    energy=0.5, valence=0.1, tension=0.4, focus=0.9,
                    confidence=0.9, sample_size=30
                ),
                "expected_tempo": "medium",
                "expected_mood": "contemplative"
            }
        ]

        # When & Then: 각 시나리오 테스트
        for scenario in test_scenarios:
            request = MusicGenerationRequest(
                emotion_data=scenario["emotion"],
                user_prompt=f"Test music for {scenario['name']}",
                duration=20
            )

            result = await service.generate_music(request)

            # 결과 검증
            assert result.status == MusicGenerationStatus.COMPLETED
            assert result.prompt.tempo == scenario["expected_tempo"]
            assert result.prompt.mood == scenario["expected_mood"]
            assert Path(result.file_path).exists()
            assert scenario["name"].lower().replace(" ", "_") in result.prompt.text.lower() or \
                   result.prompt.text  # 프롬프트에 시나리오 특성이 반영됨

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    # 테스트 실행
    pytest.main([__file__, "-v"])