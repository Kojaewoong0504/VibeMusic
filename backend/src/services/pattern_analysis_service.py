"""
PatternAnalysisService - 타이핑 패턴 분석 서비스

이 서비스는 키스트로크 데이터를 분석하여 타이핑 패턴과 감정 프로필을 생성합니다.
"""
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from src.models.typing_pattern import TypingPattern
from src.models.emotion_profile import EmotionProfile
from src.models.user_session import UserSession
from src.database.connection import get_async_session
from src.lib.pattern_analyzer.analyzer import PatternAnalyzer
from src.lib.emotion_mapper.mapper import EmotionMapper


class PatternAnalysisService:
    """타이핑 패턴 분석 및 감정 프로필 생성 서비스"""

    def __init__(self, db_session: Optional[AsyncSession] = None):
        """
        패턴 분석 서비스 초기화

        Args:
            db_session: 데이터베이스 세션 (의존성 주입용)
        """
        self.db_session = db_session
        self.pattern_analyzer = PatternAnalyzer()
        self.emotion_mapper = EmotionMapper()

    async def analyze_typing_pattern(
        self,
        session_id: str,
        keystrokes: List[Dict[str, Any]],
        text_content: Optional[str] = None
    ) -> Tuple[TypingPattern, EmotionProfile]:
        """
        키스트로크 데이터를 분석하여 타이핑 패턴과 감정 프로필 생성

        Args:
            session_id: 사용자 세션 ID
            keystrokes: 키 입력 데이터 리스트
            text_content: 입력된 텍스트 (선택사항)

        Returns:
            (TypingPattern, EmotionProfile) 튜플

        Raises:
            ValueError: 유효하지 않은 키스트로크 데이터
            RuntimeError: 세션을 찾을 수 없음
        """
        # 1. 세션 존재 확인
        if not await self._validate_session_exists(session_id):
            raise RuntimeError(f"Session not found: {session_id}")

        # 2. 키스트로크 데이터 유효성 검증
        is_valid, error_message = self.pattern_analyzer.validate_keystrokes(keystrokes)
        if not is_valid:
            raise ValueError(f"Invalid keystrokes data: {error_message}")

        # 3. 타이핑 패턴 분석
        analysis_result = self.pattern_analyzer.analyze_typing_pattern(keystrokes)

        # 4. 텍스트 내용 추출 (제공되지 않은 경우)
        if not text_content:
            text_content = analysis_result.get('text_content', '')

        # 5. TypingPattern 모델 생성 및 저장
        typing_pattern = await self._create_typing_pattern(
            session_id=session_id,
            keystrokes=keystrokes,
            text_content=text_content
        )

        # 6. 감정 프로필 생성
        emotion_profile = await self._create_emotion_profile(
            typing_pattern_id=typing_pattern.id,
            analysis_result=analysis_result
        )

        return typing_pattern, emotion_profile

    async def get_pattern_by_id(self, pattern_id: str) -> Optional[TypingPattern]:
        """
        ID로 타이핑 패턴 조회

        Args:
            pattern_id: 타이핑 패턴 ID

        Returns:
            TypingPattern 객체 또는 None
        """
        if self.db_session:
            session = self.db_session
        else:
            async with get_async_session() as session:
                result = await session.execute(
                    select(TypingPattern).where(TypingPattern.id == pattern_id)
                )
                return result.scalar_one_or_none()

        result = await session.execute(
            select(TypingPattern).where(TypingPattern.id == pattern_id)
        )
        return result.scalar_one_or_none()

    async def get_patterns_by_session(
        self,
        session_id: str,
        limit: int = 50,
        offset: int = 0
    ) -> List[TypingPattern]:
        """
        세션별 타이핑 패턴 목록 조회

        Args:
            session_id: 사용자 세션 ID
            limit: 최대 반환 개수
            offset: 시작 위치

        Returns:
            타이핑 패턴 리스트
        """
        if self.db_session:
            session = self.db_session
        else:
            async with get_async_session() as session:
                result = await session.execute(
                    select(TypingPattern)
                    .where(TypingPattern.session_id == session_id)
                    .order_by(TypingPattern.created_at.desc())
                    .limit(limit)
                    .offset(offset)
                )
                return result.scalars().all()

        result = await session.execute(
            select(TypingPattern)
            .where(TypingPattern.session_id == session_id)
            .order_by(TypingPattern.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return result.scalars().all()

    async def get_emotion_profile_by_pattern(
        self,
        pattern_id: str
    ) -> Optional[EmotionProfile]:
        """
        타이핑 패턴 ID로 감정 프로필 조회

        Args:
            pattern_id: 타이핑 패턴 ID

        Returns:
            EmotionProfile 객체 또는 None
        """
        if self.db_session:
            session = self.db_session
        else:
            async with get_async_session() as session:
                result = await session.execute(
                    select(EmotionProfile).where(EmotionProfile.pattern_id == pattern_id)
                )
                return result.scalar_one_or_none()

        result = await session.execute(
            select(EmotionProfile).where(EmotionProfile.pattern_id == pattern_id)
        )
        return result.scalar_one_or_none()

    async def reanalyze_pattern(self, pattern_id: str) -> Optional[EmotionProfile]:
        """
        기존 타이핑 패턴 재분석하여 감정 프로필 업데이트

        Args:
            pattern_id: 재분석할 타이핑 패턴 ID

        Returns:
            업데이트된 EmotionProfile 객체 또는 None
        """
        # 1. 기존 타이핑 패턴 조회
        typing_pattern = await self.get_pattern_by_id(pattern_id)
        if not typing_pattern:
            return None

        # 2. 키스트로크 데이터 재분석
        analysis_result = self.pattern_analyzer.analyze_typing_pattern(
            typing_pattern.keystrokes
        )

        # 3. 기존 감정 프로필 조회
        existing_emotion_profile = await self.get_emotion_profile_by_pattern(pattern_id)

        if existing_emotion_profile:
            # 기존 프로필 업데이트
            updated_profile = await self._update_emotion_profile(
                existing_emotion_profile, analysis_result
            )
            return updated_profile
        else:
            # 새 감정 프로필 생성
            new_profile = await self._create_emotion_profile(
                typing_pattern_id=pattern_id,
                analysis_result=analysis_result
            )
            return new_profile

    async def get_session_analysis_summary(
        self,
        session_id: str
    ) -> Dict[str, Any]:
        """
        세션의 전체 분석 요약 정보 조회

        Args:
            session_id: 사용자 세션 ID

        Returns:
            분석 요약 딕셔너리
        """
        # 세션의 모든 패턴 조회
        patterns = await self.get_patterns_by_session(session_id)

        if not patterns:
            return {
                "session_id": session_id,
                "total_patterns": 0,
                "analysis_summary": "No patterns analyzed yet"
            }

        # 감정 프로필 수집
        emotion_profiles = []
        for pattern in patterns:
            emotion_profile = await self.get_emotion_profile_by_pattern(pattern.id)
            if emotion_profile:
                emotion_profiles.append(emotion_profile)

        # 통계 계산
        total_keystrokes = sum(len(p.keystrokes) for p in patterns)
        total_text_length = sum(len(p.text_content or '') for p in patterns)

        # 감정 분포 계산
        emotion_distribution = {}
        if emotion_profiles:
            for profile in emotion_profiles:
                emotion = profile.get_dominant_emotion()
                emotion_distribution[emotion] = emotion_distribution.get(emotion, 0) + 1

        # 평균 감정 벡터 계산
        avg_emotion_vector = {}
        if emotion_profiles:
            emotion_keys = ['energy', 'valence', 'tension', 'focus']
            for key in emotion_keys:
                values = [
                    profile.emotion_vector.get(key, 0)
                    for profile in emotion_profiles
                    if profile.emotion_vector
                ]
                avg_emotion_vector[key] = sum(values) / len(values) if values else 0

        # 신뢰도 평균
        avg_confidence = 0
        if emotion_profiles:
            confidences = [float(profile.confidence_score) for profile in emotion_profiles]
            avg_confidence = sum(confidences) / len(confidences)

        return {
            "session_id": session_id,
            "total_patterns": len(patterns),
            "total_keystrokes": total_keystrokes,
            "total_text_length": total_text_length,
            "emotion_distribution": emotion_distribution,
            "average_emotion_vector": avg_emotion_vector,
            "average_confidence": round(avg_confidence, 3),
            "most_common_emotion": max(emotion_distribution, key=emotion_distribution.get) if emotion_distribution else "unknown",
            "analysis_complete": len(emotion_profiles) == len(patterns)
        }

    async def delete_pattern(self, pattern_id: str) -> bool:
        """
        타이핑 패턴 및 관련 감정 프로필 삭제

        Args:
            pattern_id: 삭제할 타이핑 패턴 ID

        Returns:
            삭제 성공 여부
        """
        try:
            if self.db_session:
                session = self.db_session
            else:
                async with get_async_session() as session:
                    # 타이핑 패턴 조회
                    result = await session.execute(
                        select(TypingPattern).where(TypingPattern.id == pattern_id)
                    )
                    pattern = result.scalar_one_or_none()

                    if not pattern:
                        return False

                    # CASCADE 설정으로 감정 프로필도 자동 삭제됨
                    await session.delete(pattern)
                    await session.commit()
                    return True

            # 타이핑 패턴 조회
            result = await session.execute(
                select(TypingPattern).where(TypingPattern.id == pattern_id)
            )
            pattern = result.scalar_one_or_none()

            if not pattern:
                return False

            # CASCADE 설정으로 감정 프로필도 자동 삭제됨
            await session.delete(pattern)
            await session.commit()
            return True

        except Exception:
            return False

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

    async def _create_typing_pattern(
        self,
        session_id: str,
        keystrokes: List[Dict[str, Any]],
        text_content: str
    ) -> TypingPattern:
        """타이핑 패턴 모델 생성 및 저장"""
        typing_pattern = TypingPattern(
            session_id=session_id,
            keystrokes=keystrokes,
            text_content=text_content
        )

        if self.db_session:
            session = self.db_session
        else:
            async with get_async_session() as session:
                session.add(typing_pattern)
                await session.commit()
                await session.refresh(typing_pattern)
                return typing_pattern

        session.add(typing_pattern)
        await session.commit()
        await session.refresh(typing_pattern)
        return typing_pattern

    async def _create_emotion_profile(
        self,
        typing_pattern_id: str,
        analysis_result: Dict[str, Any]
    ) -> EmotionProfile:
        """감정 프로필 생성 및 저장"""
        # 타이핑 통계에서 감정 프로필 생성
        statistics = analysis_result.get('statistics', {})
        patterns = analysis_result.get('patterns', {})

        # statistics와 patterns를 결합
        combined_stats = {**statistics}
        if patterns and 'error' not in patterns:
            combined_stats['patterns'] = patterns

        # 감정 매퍼로 감정 프로필 생성
        emotion_profile_data = self.emotion_mapper.map_typing_to_emotion(combined_stats)

        # EmotionProfile 모델 생성
        emotion_profile = EmotionProfile(
            pattern_id=typing_pattern_id,
            tempo_score=emotion_profile_data.tempo_score,
            rhythm_consistency=emotion_profile_data.rhythm_consistency,
            pause_intensity=emotion_profile_data.pause_intensity,
            emotion_vector=emotion_profile_data.emotion_vector,
            confidence_score=emotion_profile_data.confidence_score
        )

        if self.db_session:
            session = self.db_session
        else:
            async with get_async_session() as session:
                session.add(emotion_profile)
                await session.commit()
                await session.refresh(emotion_profile)
                return emotion_profile

        session.add(emotion_profile)
        await session.commit()
        await session.refresh(emotion_profile)
        return emotion_profile

    async def _update_emotion_profile(
        self,
        emotion_profile: EmotionProfile,
        analysis_result: Dict[str, Any]
    ) -> EmotionProfile:
        """기존 감정 프로필 업데이트"""
        # 새로운 감정 프로필 데이터 생성
        statistics = analysis_result.get('statistics', {})
        patterns = analysis_result.get('patterns', {})

        combined_stats = {**statistics}
        if patterns and 'error' not in patterns:
            combined_stats['patterns'] = patterns

        emotion_profile_data = self.emotion_mapper.map_typing_to_emotion(combined_stats)

        # 기존 모델 업데이트
        emotion_profile.tempo_score = emotion_profile_data.tempo_score
        emotion_profile.rhythm_consistency = emotion_profile_data.rhythm_consistency
        emotion_profile.pause_intensity = emotion_profile_data.pause_intensity
        emotion_profile.emotion_vector = emotion_profile_data.emotion_vector
        emotion_profile.confidence_score = emotion_profile_data.confidence_score

        if self.db_session:
            session = self.db_session
        else:
            async with get_async_session() as session:
                session.add(emotion_profile)
                await session.commit()
                await session.refresh(emotion_profile)
                return emotion_profile

        session.add(emotion_profile)
        await session.commit()
        await session.refresh(emotion_profile)
        return emotion_profile

    async def analyze_batch_patterns(
        self,
        session_id: str,
        keystroke_batches: List[List[Dict[str, Any]]]
    ) -> List[Tuple[TypingPattern, EmotionProfile]]:
        """
        여러 키스트로크 배치를 한 번에 분석

        Args:
            session_id: 사용자 세션 ID
            keystroke_batches: 키스트로크 배치 리스트

        Returns:
            (TypingPattern, EmotionProfile) 튜플 리스트
        """
        results = []

        for i, keystrokes in enumerate(keystroke_batches):
            try:
                typing_pattern, emotion_profile = await self.analyze_typing_pattern(
                    session_id=session_id,
                    keystrokes=keystrokes,
                    text_content=None  # 자동 추출
                )
                results.append((typing_pattern, emotion_profile))

            except (ValueError, RuntimeError) as e:
                # 개별 배치 실패 시 로그만 남기고 계속 진행
                print(f"Failed to analyze batch {i}: {e}")
                continue

        return results

    def get_analysis_statistics(self) -> Dict[str, Any]:
        """
        분석기 설정 및 통계 정보 반환

        Returns:
            분석기 정보 딕셔너리
        """
        return {
            "pattern_analyzer": {
                "pause_threshold_ms": self.pattern_analyzer.pause_threshold_ms,
                "version": "1.0.0"
            },
            "emotion_mapper": {
                "emotion_thresholds": self.emotion_mapper.emotion_thresholds,
                "genre_mapping_count": len(self.emotion_mapper.genre_mapping),
                "version": "1.0.0"
            },
            "service_version": "1.0.0"
        }