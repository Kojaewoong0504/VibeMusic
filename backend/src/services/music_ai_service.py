"""
AI 음악 생성 API 연동 서비스

MusicGen 또는 유사한 AI 음악 생성 서비스와의 연동을 담당하는 서비스입니다.
MusicPrompt를 받아 AI API에 요청하고, 생성된 음악 파일을 받아 처리합니다.
"""
import asyncio
import logging
import time
from typing import Dict, Any, Optional
from urllib.parse import urljoin

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.models.music_prompt import MusicPrompt
from src.models.generated_music import GeneratedMusic

logger = logging.getLogger(__name__)


class MusicAIAPIError(Exception):
    """AI 음악 생성 API 관련 오류"""
    def __init__(self, message: str, status_code: Optional[int] = None, api_error_code: Optional[str] = None):
        super().__init__(message)
        self.status_code = status_code
        self.api_error_code = api_error_code


class MusicAIService:
    """AI 음악 생성 서비스"""

    def __init__(self):
        self.api_url = settings.AI_MUSIC_API_URL.rstrip('/')
        self.api_key = settings.AI_MUSIC_API_KEY
        self.timeout = 300  # 5분 타임아웃
        self.max_retries = 3
        self.retry_delay = 2.0

        # API 클라이언트 설정
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(self.timeout),
            headers={
                "User-Agent": f"VibeMusic/{settings.APP_VERSION}",
                "Content-Type": "application/json"
            }
        )

        logger.info("MusicAI Service 초기화 완료")

    async def __aenter__(self):
        """비동기 컨텍스트 매니저 진입"""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """비동기 컨텍스트 매니저 종료"""
        await self.close()

    async def close(self):
        """클라이언트 종료"""
        await self.client.aclose()

    def _validate_configuration(self) -> None:
        """설정 유효성 검사"""
        if not self.api_url:
            raise ValueError("AI_MUSIC_API_URL이 설정되지 않았습니다")
        if not self.api_key:
            raise ValueError("AI_MUSIC_API_KEY가 설정되지 않았습니다")

    async def check_api_status(self) -> Dict[str, Any]:
        """AI API 상태 확인"""
        try:
            self._validate_configuration()

            status_url = urljoin(self.api_url, "/v1/status")
            headers = {"Authorization": f"Bearer {self.api_key}"}

            response = await self.client.get(status_url, headers=headers)

            if response.status_code == 200:
                data = response.json()
                return {
                    "status": "healthy",
                    "api_version": data.get("version", "unknown"),
                    "model_info": data.get("model_info", {}),
                    "response_time_ms": response.elapsed.total_seconds() * 1000
                }
            else:
                return {
                    "status": "unhealthy",
                    "status_code": response.status_code,
                    "error": response.text
                }

        except Exception as e:
            logger.error(f"API 상태 확인 실패: {str(e)}")
            return {
                "status": "error",
                "error": str(e)
            }

    def _prepare_request_payload(self, music_prompt: MusicPrompt) -> Dict[str, Any]:
        """API 요청 페이로드 준비"""
        # 기본 텍스트 프롬프트 사용 (enhanced_prompt가 있으면 우선)
        text_prompt = music_prompt.enhanced_prompt or music_prompt.text_prompt

        # 생성 파라미터 기본값 설정
        params = music_prompt.generation_parameters or {}

        payload = {
            "prompt": text_prompt,
            "duration": params.get("duration", 45),  # 기본 45초
            "sample_rate": 44100,  # CD 품질
            "format": "wav",  # 고음질 WAV 포맷
            "model_version": "musicgen-large",  # 기본 모델
        }

        # 감정 프로필 기반 파라미터 추가
        if music_prompt.emotion_profile:
            emotion_data = music_prompt.emotion_profile.emotion_vector or {}

            # 템포 정보 추가
            tempo_range = music_prompt.emotion_profile.get_tempo_bpm_range()
            payload["tempo"] = {
                "min_bpm": tempo_range[0],
                "max_bpm": tempo_range[1]
            }

            # 감정 벡터 정보 추가
            payload["emotion_conditioning"] = {
                "energy": emotion_data.get("energy", 0.5),
                "tension": emotion_data.get("tension", 0.5),
                "focus": emotion_data.get("focus", 0.5),
                "dominant_emotion": music_prompt.emotion_profile.get_dominant_emotion()
            }

            # 장르 힌트 추가
            genre_hints = music_prompt.emotion_profile.get_music_genre_hints()
            if genre_hints:
                payload["genre_influences"] = genre_hints[:3]  # 상위 3개만 사용

        # 추가 파라미터
        if "genre_hint" in params:
            payload["genre"] = params["genre_hint"]
        if "tempo_bpm" in params:
            payload["tempo"]["preferred_bpm"] = params["tempo_bpm"]
        if "mood_tags" in params:
            payload["mood_tags"] = params["mood_tags"]

        return payload

    async def _call_generation_api(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """AI API 호출 (재시도 로직 포함)"""
        last_exception = None

        for attempt in range(self.max_retries):
            try:
                generation_url = urljoin(self.api_url, "/v1/generate")
                headers = {"Authorization": f"Bearer {self.api_key}"}

                logger.info(f"AI API 호출 시도 {attempt + 1}/{self.max_retries}")

                response = await self.client.post(
                    generation_url,
                    json=payload,
                    headers=headers
                )

                if response.status_code == 200:
                    return response.json()
                elif response.status_code == 429:  # 요청 제한
                    retry_after = int(response.headers.get("Retry-After", self.retry_delay))
                    logger.warning(f"요청 제한 도달, {retry_after}초 후 재시도")
                    await asyncio.sleep(retry_after)
                    continue
                elif response.status_code >= 500:  # 서버 오류
                    logger.warning(f"서버 오류 {response.status_code}, 재시도 진행")
                    if attempt < self.max_retries - 1:
                        await asyncio.sleep(self.retry_delay * (2 ** attempt))  # 지수 백오프
                        continue
                else:  # 클라이언트 오류 (재시도 불가)
                    error_data = {}
                    try:
                        error_data = response.json()
                    except:
                        pass

                    raise MusicAIAPIError(
                        f"API 호출 실패: {response.status_code}",
                        status_code=response.status_code,
                        api_error_code=error_data.get("error_code")
                    )

            except httpx.TimeoutException as e:
                last_exception = MusicAIAPIError(f"API 타임아웃: {str(e)}")
                logger.warning(f"API 타임아웃, 시도 {attempt + 1}/{self.max_retries}")
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(self.retry_delay)

            except httpx.NetworkError as e:
                last_exception = MusicAIAPIError(f"네트워크 오류: {str(e)}")
                logger.warning(f"네트워크 오류, 시도 {attempt + 1}/{self.max_retries}")
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(self.retry_delay)

        # 모든 재시도 실패
        if last_exception:
            raise last_exception
        else:
            raise MusicAIAPIError("알 수 없는 오류로 API 호출 실패")

    def _parse_api_response(self, response_data: Dict[str, Any]) -> Dict[str, Any]:
        """API 응답 파싱"""
        try:
            # 필수 필드 확인
            required_fields = ["file_url", "duration", "file_size"]
            missing_fields = [field for field in required_fields if field not in response_data]

            if missing_fields:
                raise MusicAIAPIError(f"API 응답에 필수 필드가 없습니다: {missing_fields}")

            # 응답 데이터 정리
            parsed_data = {
                "file_url": response_data["file_url"],
                "file_size": int(response_data["file_size"]),
                "duration": int(response_data["duration"]),
                "format": response_data.get("format", "wav"),
                "sample_rate": int(response_data.get("sample_rate", 44100)),
                "ai_model_version": response_data.get("model_version", "unknown"),
                "quality_score": float(response_data["quality_score"]) if "quality_score" in response_data else None,
                "generation_metadata": response_data.get("metadata", {})
            }

            # 데이터 유효성 검증
            if parsed_data["file_size"] <= 0:
                raise MusicAIAPIError("잘못된 파일 크기")
            if parsed_data["duration"] <= 0:
                raise MusicAIAPIError("잘못된 음악 길이")
            if parsed_data["sample_rate"] < 8000 or parsed_data["sample_rate"] > 192000:
                raise MusicAIAPIError("잘못된 샘플링 레이트")

            return parsed_data

        except (KeyError, ValueError, TypeError) as e:
            raise MusicAIAPIError(f"API 응답 파싱 실패: {str(e)}")

    async def generate_music(
        self,
        music_prompt: MusicPrompt,
        generated_music: GeneratedMusic,
        db: AsyncSession
    ) -> GeneratedMusic:
        """
        AI 음악 생성 실행

        Args:
            music_prompt: 음악 프롬프트 모델
            generated_music: 생성된 음악 모델 (상태 업데이트용)
            db: 데이터베이스 세션

        Returns:
            업데이트된 GeneratedMusic 모델
        """
        start_time = time.time()

        try:
            self._validate_configuration()

            # 생성 시작 표시
            ai_model_version = "musicgen-large-v1"
            generated_music.start_generation(ai_model_version)
            await db.commit()

            logger.info(f"음악 생성 시작: prompt_id={music_prompt.id}")

            # API 요청 페이로드 준비
            payload = self._prepare_request_payload(music_prompt)
            logger.debug(f"API 요청 페이로드: {payload}")

            # AI API 호출
            response_data = await self._call_generation_api(payload)

            # 응답 데이터 파싱
            parsed_data = self._parse_api_response(response_data)

            # 생성 완료 처리
            generation_time = time.time() - start_time
            generated_music.complete_generation(
                file_url=parsed_data["file_url"],
                file_size=parsed_data["file_size"],
                duration=parsed_data["duration"],
                format=parsed_data["format"],
                sample_rate=parsed_data["sample_rate"],
                generation_time=generation_time,
                quality_score=parsed_data["quality_score"]
            )

            await db.commit()

            logger.info(
                f"음악 생성 완료: prompt_id={music_prompt.id}, "
                f"duration={parsed_data['duration']}s, "
                f"size={parsed_data['file_size']} bytes, "
                f"generation_time={generation_time:.2f}s"
            )

            return generated_music

        except MusicAIAPIError as e:
            # API 관련 오류
            error_message = f"AI API 오류: {str(e)}"
            if e.api_error_code:
                error_message += f" (코드: {e.api_error_code})"

            generated_music.fail_generation(error_message)
            await db.commit()

            logger.error(f"음악 생성 실패: {error_message}")
            raise

        except Exception as e:
            # 예상치 못한 오류
            error_message = f"예상치 못한 오류: {str(e)}"
            generated_music.fail_generation(error_message)
            await db.commit()

            logger.error(f"음악 생성 중 오류 발생: {error_message}", exc_info=True)
            raise MusicAIAPIError(error_message)

    async def get_generation_estimate(self, music_prompt: MusicPrompt) -> Dict[str, Any]:
        """음악 생성 예상 시간 및 비용 추정"""
        try:
            params = music_prompt.generation_parameters or {}
            duration = params.get("duration", 45)

            # 간단한 추정 로직 (실제 API가 있다면 더 정확한 추정)
            estimated_time = max(30, duration * 0.8)  # 최소 30초, 음악 길이의 80%

            return {
                "estimated_generation_time_seconds": estimated_time,
                "estimated_file_size_mb": duration * 1.5,  # 대략적인 파일 크기
                "complexity_score": self._calculate_complexity_score(music_prompt),
                "queue_position": 0,  # 현재 큐에서의 위치 (실제 구현 시)
                "model_version": "musicgen-large-v1"
            }

        except Exception as e:
            logger.error(f"생성 예상 시간 계산 실패: {str(e)}")
            return {
                "estimated_generation_time_seconds": 60,
                "estimated_file_size_mb": 5.0,
                "complexity_score": 0.5,
                "queue_position": 0,
                "model_version": "musicgen-large-v1",
                "error": str(e)
            }

    def _calculate_complexity_score(self, music_prompt: MusicPrompt) -> float:
        """음악 생성 복잡도 점수 계산 (0.0-1.0)"""
        score = 0.5  # 기본 점수

        # 텍스트 프롬프트 길이
        text_length = len(music_prompt.text_prompt)
        if text_length > 100:
            score += 0.1
        elif text_length > 200:
            score += 0.2

        # 생성 파라미터
        params = music_prompt.generation_parameters or {}
        duration = params.get("duration", 45)

        if duration > 60:
            score += 0.1
        elif duration > 90:
            score += 0.2

        # 감정 프로필 복잡도
        if music_prompt.emotion_profile:
            emotion_vector = music_prompt.emotion_profile.emotion_vector or {}

            # 감정 벡터의 분산을 복잡도로 계산
            values = list(emotion_vector.values())
            if values:
                variance = sum((v - 0.5) ** 2 for v in values) / len(values)
                score += min(0.2, variance)

        return min(1.0, max(0.0, score))

    async def cancel_generation(self, generated_music: GeneratedMusic, db: AsyncSession) -> bool:
        """
        음악 생성 취소 (가능한 경우)

        Args:
            generated_music: 취소할 생성 작업
            db: 데이터베이스 세션

        Returns:
            취소 성공 여부
        """
        try:
            if not generated_music.is_generating():
                logger.warning(f"생성 중이 아닌 작업 취소 시도: {generated_music.id}")
                return False

            # 실제 API에서 취소 지원하는 경우 구현
            # cancel_url = urljoin(self.api_url, f"/v1/cancel/{generation_id}")
            # response = await self.client.post(cancel_url, headers=headers)

            # 현재는 단순히 상태를 실패로 변경
            generated_music.fail_generation("사용자에 의해 취소됨")
            await db.commit()

            logger.info(f"음악 생성 취소됨: {generated_music.id}")
            return True

        except Exception as e:
            logger.error(f"음악 생성 취소 실패: {str(e)}")
            return False

    def get_service_info(self) -> Dict[str, Any]:
        """서비스 정보 반환"""
        return {
            "service_name": "MusicAI Service",
            "api_url": self.api_url,
            "api_configured": bool(self.api_key),
            "timeout_seconds": self.timeout,
            "max_retries": self.max_retries,
            "supported_formats": ["wav", "mp3", "flac"],
            "supported_sample_rates": [22050, 44100, 48000],
            "duration_range": {"min": 15, "max": 120},
            "version": settings.APP_VERSION
        }


# 전역 서비스 인스턴스
music_ai_service = MusicAIService()


async def get_music_ai_service() -> MusicAIService:
    """MusicAI 서비스 인스턴스 반환 (의존성 주입용)"""
    return music_ai_service