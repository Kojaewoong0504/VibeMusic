"""
T007: 음악 생성 API 연동 - 감정 기반 음악 생성 서비스
감정 데이터를 음악 프롬프트로 변환하고 AI 음악 생성 API를 연동합니다.
"""

import asyncio
import json
import os
import uuid
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib.parse import urljoin

import aiohttp
from pydantic import BaseModel, Field

from src.models.emotion import EmotionData


class MusicStyle(str, Enum):
    """음악 스타일"""
    CLASSICAL = "classical"
    AMBIENT = "ambient"
    ELECTRONIC = "electronic"
    ACOUSTIC = "acoustic"
    JAZZ = "jazz"
    CINEMATIC = "cinematic"


class MusicGenerationStatus(str, Enum):
    """음악 생성 상태"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class MusicPrompt(BaseModel):
    """음악 생성 프롬프트"""
    text: str = Field(..., description="음악 생성을 위한 텍스트 프롬프트")
    style: MusicStyle = Field(..., description="음악 스타일")
    tempo: str = Field(..., description="템포 (slow/medium/fast)")
    mood: str = Field(..., description="기분 (sad/neutral/happy)")
    intensity: str = Field(..., description="강도 (calm/moderate/intense)")
    duration: int = Field(30, description="음악 길이 (초)")


class MusicGenerationRequest(BaseModel):
    """음악 생성 요청"""
    emotion_data: EmotionData = Field(..., description="감정 분석 결과")
    user_prompt: Optional[str] = Field(None, description="사용자 추가 프롬프트")
    style_preference: Optional[MusicStyle] = Field(None, description="선호 스타일")
    duration: int = Field(30, description="음악 길이 (초)")


class MusicGenerationResult(BaseModel):
    """음악 생성 결과"""
    generation_id: str = Field(..., description="생성 ID")
    status: MusicGenerationStatus = Field(..., description="생성 상태")
    file_path: Optional[str] = Field(None, description="생성된 음악 파일 경로")
    file_url: Optional[str] = Field(None, description="음악 파일 URL")
    prompt: Optional[MusicPrompt] = Field(None, description="사용된 프롬프트")
    metadata: Dict = Field(default_factory=dict, description="메타데이터")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = Field(None, description="완료 시간")
    error_message: Optional[str] = Field(None, description="에러 메시지")


class EmotionToMusicMapper:
    """감정 데이터를 음악 프롬프트로 변환하는 매퍼"""

    @staticmethod
    def map_emotion_to_prompt(emotion: EmotionData, user_prompt: Optional[str] = None,
                            style_preference: Optional[MusicStyle] = None) -> MusicPrompt:
        """감정 데이터를 음악 프롬프트로 변환"""

        # 템포 매핑 (에너지 기반)
        if emotion.energy < 0.3:
            tempo = "slow"
        elif emotion.energy < 0.7:
            tempo = "medium"
        else:
            tempo = "fast"

        # 기분 매핑 (감정가 기반)
        if emotion.valence < -0.3:
            mood = "melancholic"
        elif emotion.valence > 0.3:
            mood = "uplifting"
        else:
            mood = "contemplative"

        # 강도 매핑 (긴장도 기반)
        if emotion.tension < 0.3:
            intensity = "calm"
        elif emotion.tension < 0.6:
            intensity = "moderate"
        else:
            intensity = "intense"

        # 스타일 결정
        style = style_preference or EmotionToMusicMapper._determine_style(emotion)

        # 프롬프트 구성
        base_prompt = f"A {tempo} {mood} {intensity} {style.value} piece"

        # 감정 특성 추가
        characteristics = []

        if emotion.focus > 0.7:
            characteristics.append("focused and structured")
        elif emotion.focus < 0.3:
            characteristics.append("flowing and free-form")

        if emotion.energy > 0.8:
            characteristics.append("energetic and dynamic")
        elif emotion.energy < 0.2:
            characteristics.append("gentle and serene")

        if emotion.tension > 0.7:
            characteristics.append("dramatic and tense")
        elif emotion.tension < 0.3:
            characteristics.append("peaceful and relaxed")

        if characteristics:
            base_prompt += f" with {', '.join(characteristics)} elements"

        # 사용자 프롬프트 추가
        if user_prompt:
            base_prompt += f", incorporating {user_prompt}"

        return MusicPrompt(
            text=base_prompt,
            style=style,
            tempo=tempo,
            mood=mood,
            intensity=intensity
        )

    @staticmethod
    def _determine_style(emotion: EmotionData) -> MusicStyle:
        """감정 데이터를 기반으로 음악 스타일 결정"""

        # 높은 집중도 + 낮은 긴장도 = 클래식
        if emotion.focus > 0.6 and emotion.tension < 0.4:
            return MusicStyle.CLASSICAL

        # 낮은 에너지 + 평온함 = 앰비언트
        if emotion.energy < 0.4 and emotion.tension < 0.3:
            return MusicStyle.AMBIENT

        # 높은 에너지 + 높은 긴장도 = 일렉트로닉
        if emotion.energy > 0.7 and emotion.tension > 0.6:
            return MusicStyle.ELECTRONIC

        # 중간 에너지 + 긍정적 감정가 = 어쿠스틱
        if 0.3 < emotion.energy < 0.7 and emotion.valence > 0.2:
            return MusicStyle.ACOUSTIC

        # 복잡한 패턴 = 재즈
        if emotion.focus > 0.5 and 0.4 < emotion.tension < 0.7:
            return MusicStyle.JAZZ

        # 극적인 변화 = 시네마틱
        if emotion.tension > 0.6 and abs(emotion.valence) > 0.4:
            return MusicStyle.CINEMATIC

        # 기본값
        return MusicStyle.AMBIENT


class MockMusicAPI:
    """개발용 목업 음악 생성 API"""

    def __init__(self, samples_dir: str = "backend/samples"):
        self.samples_dir = Path(samples_dir)
        self.samples_dir.mkdir(parents=True, exist_ok=True)
        self._ensure_sample_files()

    def _ensure_sample_files(self):
        """샘플 음악 파일들이 존재하는지 확인하고 없으면 생성"""
        sample_files = {
            "happy_energetic.mp3": "Happy energetic music sample",
            "sad_slow.mp3": "Sad slow music sample",
            "calm_ambient.mp3": "Calm ambient music sample",
            "intense_dramatic.mp3": "Intense dramatic music sample",
            "focused_classical.mp3": "Focused classical music sample",
            "default.mp3": "Default music sample"
        }

        for filename, description in sample_files.items():
            file_path = self.samples_dir / filename
            if not file_path.exists():
                # 실제 음악 파일 대신 텍스트 파일로 생성 (개발용)
                with open(file_path, 'w') as f:
                    f.write(f"Mock audio file: {description}\n")
                    f.write(f"Generated at: {datetime.utcnow().isoformat()}\n")

    async def generate_music(self, prompt: MusicPrompt) -> str:
        """목업 음악 생성 - 프롬프트에 기반한 샘플 파일 반환"""

        # 간단한 지연 시뮬레이션 (실제 AI 처리 시간)
        await asyncio.sleep(0.5)  # 500ms 지연

        # 프롬프트 기반 파일 선택
        if "happy" in prompt.mood or "uplifting" in prompt.mood:
            if prompt.tempo == "fast":
                return str(self.samples_dir / "happy_energetic.mp3")

        if "sad" in prompt.mood or "melancholic" in prompt.mood:
            if prompt.tempo == "slow":
                return str(self.samples_dir / "sad_slow.mp3")

        if "calm" in prompt.intensity or prompt.style == MusicStyle.AMBIENT:
            return str(self.samples_dir / "calm_ambient.mp3")

        if "intense" in prompt.intensity or "dramatic" in prompt.text:
            return str(self.samples_dir / "intense_dramatic.mp3")

        if prompt.style == MusicStyle.CLASSICAL:
            return str(self.samples_dir / "focused_classical.mp3")

        # 기본값
        return str(self.samples_dir / "default.mp3")


class MusicGenerationService:
    """음악 생성 서비스"""

    def __init__(self, storage_dir: str = "backend/generated_music"):
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.mock_api = MockMusicAPI()
        self.generation_storage: Dict[str, MusicGenerationResult] = {}

    async def generate_music(self, request: MusicGenerationRequest) -> MusicGenerationResult:
        """음악 생성 요청 처리"""

        generation_id = str(uuid.uuid4())

        # 초기 결과 생성
        result = MusicGenerationResult(
            generation_id=generation_id,
            status=MusicGenerationStatus.PENDING,
            metadata={
                "emotion_energy": request.emotion_data.energy,
                "emotion_valence": request.emotion_data.valence,
                "emotion_tension": request.emotion_data.tension,
                "emotion_focus": request.emotion_data.focus,
                "user_prompt": request.user_prompt,
                "style_preference": request.style_preference.value if request.style_preference else None
            }
        )

        # 메모리에 저장
        self.generation_storage[generation_id] = result

        try:
            # 상태를 처리 중으로 변경
            result.status = MusicGenerationStatus.PROCESSING

            # 감정 → 음악 프롬프트 변환
            prompt = EmotionToMusicMapper.map_emotion_to_prompt(
                request.emotion_data,
                request.user_prompt,
                request.style_preference
            )

            result.prompt = prompt

            # 목업 API로 음악 생성
            sample_file_path = await self.mock_api.generate_music(prompt)

            # 생성된 파일을 저장 디렉토리로 복사
            final_filename = f"{generation_id}_{prompt.style.value}_{prompt.tempo}.mp3"
            final_path = self.storage_dir / final_filename

            # 파일 복사 (실제로는 목업이므로 내용 복사)
            with open(sample_file_path, 'r') as source:
                content = source.read()
            with open(final_path, 'w') as target:
                target.write(content)

            # 결과 업데이트
            result.status = MusicGenerationStatus.COMPLETED
            result.file_path = str(final_path)
            result.file_url = f"/api/v1/music/{generation_id}/download"
            result.completed_at = datetime.utcnow()

        except Exception as e:
            result.status = MusicGenerationStatus.FAILED
            result.error_message = str(e)
            result.completed_at = datetime.utcnow()

        return result

    async def get_generation_status(self, generation_id: str) -> Optional[MusicGenerationResult]:
        """생성 상태 조회"""
        return self.generation_storage.get(generation_id)

    async def list_generations(self, limit: int = 10) -> List[MusicGenerationResult]:
        """최근 생성 목록 조회"""
        results = list(self.generation_storage.values())
        results.sort(key=lambda x: x.created_at, reverse=True)
        return results[:limit]

    async def cleanup_old_files(self, max_age_hours: int = 24):
        """오래된 파일 정리"""
        cutoff_time = datetime.utcnow() - timedelta(hours=max_age_hours)

        to_remove = []
        for generation_id, result in self.generation_storage.items():
            if result.created_at < cutoff_time:
                # 파일 삭제
                if result.file_path and Path(result.file_path).exists():
                    Path(result.file_path).unlink()
                to_remove.append(generation_id)

        # 메모리에서 제거
        for generation_id in to_remove:
            del self.generation_storage[generation_id]

        return len(to_remove)


# 전역 서비스 인스턴스
music_service = MusicGenerationService()