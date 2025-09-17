"""
MusicGenerationService - AI 음악 생성 서비스

이 서비스는 텍스트 프롬프트와 감정 프로필을 결합하여 AI 음악 생성을 관리합니다.
"""
import asyncio
from typing import Optional, Dict, Any, List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.music_prompt import MusicPrompt
from src.models.generated_music import GeneratedMusic, MusicStatus, MusicFormat
from src.models.emotion_profile import EmotionProfile
from src.models.user_session import UserSession
from src.database.connection import get_async_session
from src.lib.ai_connector.connector import AIConnector, MusicGenerationRequest, AudioFormat


class MusicGenerationService:
    """AI 음악 생성 관리 서비스"""

    def __init__(
        self,
        db_session: Optional[AsyncSession] = None,
        ai_api_key: Optional[str] = None,
        ai_base_url: str = "https://api.musicgen.example.com"
    ):
        """
        음악 생성 서비스 초기화

        Args:
            db_session: 데이터베이스 세션 (의존성 주입용)
            ai_api_key: AI 서비스 API 키
            ai_base_url: AI 서비스 기본 URL
        """
        self.db_session = db_session
        self.ai_connector = AIConnector(
            api_key=ai_api_key,
            base_url=ai_base_url
        )

    async def create_music_prompt(
        self,
        session_id: str,
        emotion_profile_id: str,
        text_prompt: str,
        duration: int = 45,
        audio_format: str = "wav"
    ) -> MusicPrompt:
        """
        음악 프롬프트 생성

        Args:
            session_id: 사용자 세션 ID
            emotion_profile_id: 감정 프로필 ID
            text_prompt: 사용자 입력 텍스트
            duration: 음악 길이 (초)
            audio_format: 오디오 형식 (wav, mp3, flac)

        Returns:
            생성된 MusicPrompt 객체

        Raises:
            ValueError: 유효하지 않은 파라미터
            RuntimeError: 세션 또는 감정 프로필을 찾을 수 없음
        """
        # 1. 세션 및 감정 프로필 존재 확인
        if not await self._validate_session_exists(session_id):
            raise RuntimeError(f"Session not found: {session_id}")

        emotion_profile = await self._get_emotion_profile(emotion_profile_id)
        if not emotion_profile:
            raise RuntimeError(f"Emotion profile not found: {emotion_profile_id}")

        # 2. 파라미터 유효성 검증
        if not text_prompt or len(text_prompt.strip()) < 10:
            raise ValueError("Text prompt must be at least 10 characters")

        if not (15 <= duration <= 120):
            raise ValueError("Duration must be between 15 and 120 seconds")

        if audio_format not in ["wav", "mp3", "flac"]:
            raise ValueError("Audio format must be one of: wav, mp3, flac")

        # 3. 새 음악 프롬프트 생성
        music_prompt = MusicPrompt(
            session_id=session_id,
            emotion_profile_id=emotion_profile_id,
            text_prompt=text_prompt.strip()
        )

        # 4. 감정 프로필 기반 파라미터 설정
        music_prompt.set_default_parameters()

        # 5. 사용자 지정 파라미터 적용
        if music_prompt.generation_parameters:
            music_prompt.generation_parameters.update({
                "duration": duration,
                "format": audio_format
            })

        # 6. 향상된 프롬프트 생성
        music_prompt.enhanced_prompt = music_prompt.create_enhanced_prompt()

        # 7. 데이터베이스 저장
        if self.db_session:
            session = self.db_session
        else:
            async with get_async_session() as session:
                session.add(music_prompt)
                await session.commit()
                await session.refresh(music_prompt)
                return music_prompt

        session.add(music_prompt)
        await session.commit()
        await session.refresh(music_prompt)
        return music_prompt

    async def generate_music(
        self,
        prompt_id: str,
        use_mock: bool = False
    ) -> GeneratedMusic:
        """
        AI 음악 생성 실행

        Args:
            prompt_id: 음악 프롬프트 ID
            use_mock: Mock 모드 사용 여부 (개발/테스트용)

        Returns:
            생성된 GeneratedMusic 객체

        Raises:
            RuntimeError: 프롬프트를 찾을 수 없거나 이미 생성 중
        """
        # 1. 음악 프롬프트 조회
        music_prompt = await self._get_music_prompt(prompt_id)
        if not music_prompt:
            raise RuntimeError(f"Music prompt not found: {prompt_id}")

        # 2. 이미 생성된 음악이 있는지 확인
        existing_music = await self._get_generated_music_by_prompt(prompt_id)
        if existing_music:
            if existing_music.status == MusicStatus.GENERATING:
                raise RuntimeError("Music generation already in progress")
            elif existing_music.status == MusicStatus.COMPLETED:
                return existing_music

        # 3. 새로운 GeneratedMusic 객체 생성
        generated_music = GeneratedMusic(prompt_id=prompt_id)
        generated_music.start_generation("musicgen-1.0")

        # 4. 데이터베이스에 초기 상태 저장
        if self.db_session:
            session = self.db_session
        else:
            async with get_async_session() as session:
                session.add(generated_music)
                await session.commit()
                await session.refresh(generated_music)

                # 5. AI 음악 생성 요청
                await self._process_music_generation(generated_music, music_prompt, use_mock)
                return generated_music

        session.add(generated_music)
        await session.commit()
        await session.refresh(generated_music)

        # 5. AI 음악 생성 요청
        await self._process_music_generation(generated_music, music_prompt, use_mock)
        return generated_music

    async def get_music_by_id(self, music_id: str) -> Optional[GeneratedMusic]:
        """
        ID로 생성된 음악 조회

        Args:
            music_id: 생성된 음악 ID

        Returns:
            GeneratedMusic 객체 또는 None
        """
        if self.db_session:
            session = self.db_session
        else:
            async with get_async_session() as session:
                result = await session.execute(
                    select(GeneratedMusic).where(GeneratedMusic.id == music_id)
                )
                return result.scalar_one_or_none()

        result = await session.execute(
            select(GeneratedMusic).where(GeneratedMusic.id == music_id)
        )
        return result.scalar_one_or_none()

    async def get_music_by_session(
        self,
        session_id: str,
        limit: int = 50,
        offset: int = 0
    ) -> List[GeneratedMusic]:
        """
        세션별 생성된 음악 목록 조회

        Args:
            session_id: 사용자 세션 ID
            limit: 최대 반환 개수
            offset: 시작 위치

        Returns:
            생성된 음악 리스트
        """
        if self.db_session:
            session = self.db_session
        else:
            async with get_async_session() as session:
                result = await session.execute(
                    select(GeneratedMusic)
                    .join(MusicPrompt)
                    .where(MusicPrompt.session_id == session_id)
                    .order_by(GeneratedMusic.created_at.desc())
                    .limit(limit)
                    .offset(offset)
                )
                return result.scalars().all()

        result = await session.execute(
            select(GeneratedMusic)
            .join(MusicPrompt)
            .where(MusicPrompt.session_id == session_id)
            .order_by(GeneratedMusic.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return result.scalars().all()

    async def get_generation_status(self, music_id: str) -> Optional[Dict[str, Any]]:
        """
        음악 생성 상태 조회

        Args:
            music_id: 생성된 음악 ID

        Returns:
            상태 정보 딕셔너리 또는 None
        """
        generated_music = await self.get_music_by_id(music_id)
        if not generated_music:
            return None

        return {
            "music_id": music_id,
            "status": generated_music.status,
            "progress": self._calculate_progress(generated_music),
            "estimated_time_remaining": self._estimate_remaining_time(generated_music),
            "error_message": generated_music.error_message,
            "file_info": generated_music.get_download_info() if generated_music.is_completed() else None
        }

    async def retry_failed_generation(self, music_id: str) -> Optional[GeneratedMusic]:
        """
        실패한 음악 생성 재시도

        Args:
            music_id: 재시도할 음악 ID

        Returns:
            업데이트된 GeneratedMusic 객체 또는 None
        """
        generated_music = await self.get_music_by_id(music_id)
        if not generated_music or not generated_music.is_failed():
            return None

        # 재시도를 위해 상태 초기화
        generated_music.start_generation(generated_music.ai_model_version or "musicgen-1.0")

        # 음악 프롬프트 조회
        music_prompt = await self._get_music_prompt(generated_music.prompt_id)
        if not music_prompt:
            return None

        # 재생성 시도
        await self._process_music_generation(generated_music, music_prompt, use_mock=False)

        return generated_music

    async def cancel_generation(self, music_id: str) -> bool:
        """
        진행 중인 음악 생성 취소

        Args:
            music_id: 취소할 음악 ID

        Returns:
            취소 성공 여부
        """
        generated_music = await self.get_music_by_id(music_id)
        if not generated_music or not generated_music.is_generating():
            return False

        # 취소 처리 (실제로는 AI 서비스 취소 API 호출)
        generated_music.fail_generation("Generation cancelled by user")

        # 데이터베이스 업데이트
        if self.db_session:
            session = self.db_session
        else:
            async with get_async_session() as session:
                session.add(generated_music)
                await session.commit()
                return True

        session.add(generated_music)
        await session.commit()
        return True

    async def get_session_generation_summary(
        self,
        session_id: str
    ) -> Dict[str, Any]:
        """
        세션의 음악 생성 요약 정보

        Args:
            session_id: 사용자 세션 ID

        Returns:
            생성 요약 딕셔너리
        """
        music_list = await self.get_music_by_session(session_id)

        if not music_list:
            return {
                "session_id": session_id,
                "total_generated": 0,
                "summary": "No music generated yet"
            }

        # 상태별 개수 계산
        status_counts = {}
        total_generation_time = 0
        successful_generations = 0

        for music in music_list:
            status = music.status
            status_counts[status] = status_counts.get(status, 0) + 1

            if music.generation_time:
                total_generation_time += float(music.generation_time)

            if music.is_completed():
                successful_generations += 1

        # 평균 생성 시간
        avg_generation_time = (
            total_generation_time / successful_generations
            if successful_generations > 0 else 0
        )

        # 성공률
        success_rate = (
            successful_generations / len(music_list) * 100
            if len(music_list) > 0 else 0
        )

        return {
            "session_id": session_id,
            "total_generated": len(music_list),
            "status_distribution": status_counts,
            "successful_generations": successful_generations,
            "success_rate": round(success_rate, 1),
            "average_generation_time": round(avg_generation_time, 2),
            "total_generation_time": round(total_generation_time, 2)
        }

    async def cleanup_old_files(self, days_old: int = 7) -> int:
        """
        오래된 음악 파일 정리

        Args:
            days_old: 정리 대상 기준 일수

        Returns:
            정리된 파일 개수
        """
        # 실제 구현에서는 파일 스토리지 시스템과 연동
        # 여기서는 데이터베이스 정리만 수행
        from datetime import datetime, timedelta

        cutoff_date = datetime.utcnow() - timedelta(days=days_old)

        if self.db_session:
            session = self.db_session
        else:
            async with get_async_session() as session:
                result = await session.execute(
                    select(GeneratedMusic).where(
                        GeneratedMusic.created_at < cutoff_date
                    )
                )
                old_music = result.scalars().all()

                # TODO: 실제 파일 스토리지에서 파일 삭제

                # 데이터베이스에서 레코드 삭제
                for music in old_music:
                    await session.delete(music)

                await session.commit()
                return len(old_music)

        result = await session.execute(
            select(GeneratedMusic).where(
                GeneratedMusic.created_at < cutoff_date
            )
        )
        old_music = result.scalars().all()

        # 데이터베이스에서 레코드 삭제
        for music in old_music:
            await session.delete(music)

        await session.commit()
        return len(old_music)

    async def _process_music_generation(
        self,
        generated_music: GeneratedMusic,
        music_prompt: MusicPrompt,
        use_mock: bool = False
    ) -> None:
        """AI 음악 생성 처리 (내부 메소드)"""
        try:
            # AI 연동 요청 데이터 준비
            generation_request = MusicGenerationRequest(
                text_prompt=music_prompt.enhanced_prompt or music_prompt.text_prompt,
                emotion_profile=music_prompt.emotion_profile.to_dict(),
                duration=music_prompt.generation_parameters.get("duration", 45),
                format=AudioFormat(music_prompt.generation_parameters.get("format", "wav")),
                additional_params=music_prompt.generation_parameters
            )

            if use_mock:
                # Mock 모드
                result = self.ai_connector.create_mock_response(generation_request)
            else:
                # 실제 AI 서비스 호출
                result = await self.ai_connector.generate_music(generation_request)

            # 생성 성공 처리
            if result.status.value == "completed":
                generated_music.complete_generation(
                    file_url=result.file_url,
                    file_size=result.file_size or 0,
                    duration=generation_request.duration,
                    format=generation_request.format.value,
                    sample_rate=generation_request.sample_rate,
                    generation_time=result.generation_time or 0,
                    quality_score=result.metadata.get("quality_score") if result.metadata else None
                )
            else:
                # 생성 실패 처리
                generated_music.fail_generation(
                    result.error_message or "Unknown generation error"
                )

        except Exception as e:
            # 예외 처리
            generated_music.fail_generation(str(e))

        finally:
            # 데이터베이스 업데이트
            if self.db_session:
                session = self.db_session
            else:
                async with get_async_session() as session:
                    session.add(generated_music)
                    await session.commit()
                    return

            session.add(generated_music)
            await session.commit()

    async def _validate_session_exists(self, session_id: str) -> bool:
        """세션 존재 여부 확인"""
        if self.db_session:
            session = self.db_session
        else:
            async with get_async_session() as session:
                result = await session.execute(
                    select(UserSession).where(UserSession.id == session_id)
                )
                return result.scalar_one_or_none() is not None

        result = await session.execute(
            select(UserSession).where(UserSession.id == session_id)
        )
        return result.scalar_one_or_none() is not None

    async def _get_emotion_profile(self, emotion_profile_id: str) -> Optional[EmotionProfile]:
        """감정 프로필 조회"""
        if self.db_session:
            session = self.db_session
        else:
            async with get_async_session() as session:
                result = await session.execute(
                    select(EmotionProfile).where(EmotionProfile.id == emotion_profile_id)
                )
                return result.scalar_one_or_none()

        result = await session.execute(
            select(EmotionProfile).where(EmotionProfile.id == emotion_profile_id)
        )
        return result.scalar_one_or_none()

    async def _get_music_prompt(self, prompt_id: str) -> Optional[MusicPrompt]:
        """음악 프롬프트 조회"""
        if self.db_session:
            session = self.db_session
        else:
            async with get_async_session() as session:
                result = await session.execute(
                    select(MusicPrompt).where(MusicPrompt.id == prompt_id)
                )
                return result.scalar_one_or_none()

        result = await session.execute(
            select(MusicPrompt).where(MusicPrompt.id == prompt_id)
        )
        return result.scalar_one_or_none()

    async def _get_generated_music_by_prompt(self, prompt_id: str) -> Optional[GeneratedMusic]:
        """프롬프트 ID로 생성된 음악 조회"""
        if self.db_session:
            session = self.db_session
        else:
            async with get_async_session() as session:
                result = await session.execute(
                    select(GeneratedMusic).where(GeneratedMusic.prompt_id == prompt_id)
                )
                return result.scalar_one_or_none()

        result = await session.execute(
            select(GeneratedMusic).where(GeneratedMusic.prompt_id == prompt_id)
        )
        return result.scalar_one_or_none()

    def _calculate_progress(self, generated_music: GeneratedMusic) -> float:
        """생성 진행률 계산 (추정)"""
        if generated_music.is_completed():
            return 100.0
        elif generated_music.is_failed():
            return 0.0
        elif generated_music.is_generating():
            # 실제로는 AI 서비스에서 진행률을 받아와야 함
            # 여기서는 시간 기반 추정
            from datetime import datetime
            elapsed = (datetime.utcnow() - generated_music.created_at).total_seconds()
            estimated_total = 45  # 예상 총 시간 (초)
            return min(elapsed / estimated_total * 100, 95.0)  # 최대 95%까지만
        else:
            return 0.0

    def _estimate_remaining_time(self, generated_music: GeneratedMusic) -> Optional[float]:
        """남은 생성 시간 추정 (초)"""
        if not generated_music.is_generating():
            return None

        from datetime import datetime
        elapsed = (datetime.utcnow() - generated_music.created_at).total_seconds()
        estimated_total = 45  # 예상 총 시간
        remaining = max(0, estimated_total - elapsed)
        return remaining