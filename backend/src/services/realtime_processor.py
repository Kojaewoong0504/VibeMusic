"""
T005: 실시간 타이핑 데이터 처리 서비스 (임시 모킹 버전)
WebSocket으로 받은 타이핑 데이터를 처리하고 감정 분석 결과 반환
"""

import logging
import random
import asyncio
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

@dataclass
class ProcessingResult:
    """처리 결과 클래스"""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

@dataclass
class TypingEvent:
    """타이핑 이벤트 클래스"""
    timestamp: datetime
    char: str
    key_code: str
    duration: float
    interval: float

@dataclass
class TypingMetrics:
    """타이핑 메트릭 클래스"""
    wpm: float
    accuracy: float
    rhythm_stability: float
    pause_frequency: float

@dataclass
class EmotionSnapshot:
    """감정 스냅샷 클래스"""
    energy: float
    tension: float
    focus: float
    stress: float
    timestamp: datetime

class RealtimeProcessor:
    """실시간 타이핑 데이터 처리기"""

    def __init__(self, cache_service, db_session: AsyncSession):
        self.cache_service = cache_service
        self.db_session = db_session
        self.session_buffers: Dict[str, List[Dict[str, Any]]] = {}

    async def process_typing_event(self, session_id: str, typing_data: Dict[str, Any]) -> Dict[str, Any]:
        """타이핑 이벤트 처리"""
        try:
            logger.info(f"타이핑 이벤트 처리: session_id={session_id}, data={typing_data}")

            # 세션 버퍼 초기화
            if session_id not in self.session_buffers:
                self.session_buffers[session_id] = []

            # 타이핑 데이터를 버퍼에 저장
            self.session_buffers[session_id].append({
                **typing_data,
                'processed_at': datetime.utcnow().isoformat()
            })

            # 버퍼 크기 제한 (최대 100개 이벤트)
            if len(self.session_buffers[session_id]) > 100:
                self.session_buffers[session_id] = self.session_buffers[session_id][-100:]

            buffer_size = len(self.session_buffers[session_id])

            # 간단한 패턴 감지 (모킹)
            patterns_detected = self._detect_patterns(self.session_buffers[session_id])

            # 감정 분석 트리거 조건 (버퍼에 5개 이상 이벤트가 있으면)
            trigger_emotion_analysis = buffer_size >= 5 and buffer_size % 5 == 0

            # 기본 감정 점수 계산 (모킹)
            emotion_score = self._calculate_basic_emotion(self.session_buffers[session_id]) if buffer_size >= 3 else None

            return {
                'success': True,
                'buffer_size': buffer_size,
                'patterns_detected': patterns_detected,
                'emotion_score': emotion_score,
                'trigger_emotion_analysis': trigger_emotion_analysis
            }

        except Exception as e:
            logger.error(f"타이핑 이벤트 처리 실패: session_id={session_id}, error={str(e)}")
            return {
                'success': False,
                'error': f'타이핑 이벤트 처리 실패: {str(e)}'
            }

    async def trigger_emotion_analysis(self, session_id: str) -> Dict[str, Any]:
        """
        감정 분석 트리거
        """
        try:
            # 타이핑 버퍼에서 데이터 조회
            typing_buffer = await self.cache.get_typing_buffer(
                session_id,
                limit=self.BUFFER_SIZE_LIMIT
            )

            if len(typing_buffer) < self.MIN_EVENTS_FOR_ANALYSIS:
                return ProcessingResult(
                    success=False,
                    error="감정 분석을 위한 충분한 데이터가 없습니다"
                )

            # 타이핑 패턴 분석
            pattern_result = await self._analyze_typing_patterns(typing_buffer)
            if not pattern_result['success']:
                return ProcessingResult(
                    success=False,
                    error="타이핑 패턴 분석 실패"
                )

            # 감정 매핑
            emotion_result = await self._map_emotion_from_patterns(pattern_result['patterns'])
            if not emotion_result['success']:
                return ProcessingResult(
                    success=False,
                    error="감정 매핑 실패"
                )

            # 감정 데이터 캐싱
            emotion_snapshot = emotion_result['emotion']
            cache_success = await self.cache.cache_emotion_analysis(
                session_id,
                emotion_snapshot.__dict__
            )

            if cache_success:
                logger.info("감정 분석 완료 및 캐시됨: session_id=%s", session_id)

            # 데이터베이스에 감정 프로필 저장
            await self._save_emotion_profile(session_id, emotion_snapshot)

            return ProcessingResult(
                success=True,
                data={
                    'emotion': emotion_snapshot.__dict__,
                    'patterns': pattern_result['patterns'],
                    'analysis_metadata': {
                        'events_analyzed': len(typing_buffer),
                        'analysis_timestamp': datetime.utcnow().isoformat(),
                        'confidence': emotion_snapshot.confidence
                    }
                }
            )

        except Exception as e:
            logger.error("감정 분석 실패: session_id=%s, error=%s", session_id, str(e))
            return ProcessingResult(
                success=False,
                error=f"감정 분석 중 오류 발생: {str(e)}"
            )

    async def trigger_music_generation(self, session_id: str, websocket_manager=None) -> ProcessingResult:
        """
        음악 생성 트리거
        """
        try:
            # 캐시된 감정 데이터 조회
            emotion_data = await self.cache.get_cached_emotion(session_id)
            if not emotion_data:
                # 감정 분석이 없으면 먼저 실행
                emotion_result = await self.trigger_emotion_analysis(session_id)
                if not emotion_result.success:
                    return ProcessingResult(
                        success=False,
                        error="감정 분석 데이터가 없습니다"
                    )
                emotion_data = emotion_result.data['emotion']

            # 음악 생성 시작 알림
            if websocket_manager:
                await websocket_manager.send_personal_message(session_id, {
                    'type': 'music_generation_progress',
                    'stage': 'analyzing',
                    'progress': 10,
                    'message': '감정 데이터를 분석하고 있습니다...'
                })

            # AI 음악 생성 요청
            music_prompt = await self._create_music_prompt(emotion_data)

            if websocket_manager:
                await websocket_manager.send_personal_message(session_id, {
                    'type': 'music_generation_progress',
                    'stage': 'generating',
                    'progress': 50,
                    'message': 'AI가 음악을 생성하고 있습니다...'
                })

            generation_result = await self._generate_music_with_ai(
                session_id, music_prompt, websocket_manager
            )

            if generation_result['success']:
                if websocket_manager:
                    await websocket_manager.send_personal_message(session_id, {
                        'type': 'music_generation_complete',
                        'data': generation_result['data']
                    })

                return ProcessingResult(
                    success=True,
                    data=generation_result['data']
                )
            else:
                if websocket_manager:
                    await websocket_manager.send_personal_message(session_id, {
                        'type': 'music_generation_failed',
                        'error': generation_result.get('error', '음악 생성 실패')
                    })

                return ProcessingResult(
                    success=False,
                    error=generation_result.get('error', '음악 생성 실패')
                )

        except Exception as e:
            logger.error("음악 생성 실패: session_id=%s, error=%s", session_id, str(e))

            if websocket_manager:
                await websocket_manager.send_personal_message(session_id, {
                    'type': 'music_generation_failed',
                    'error': '음악 생성 중 오류가 발생했습니다'
                })

            return ProcessingResult(
                success=False,
                error=f"음악 생성 중 오류 발생: {str(e)}"
            )

    # ========================================================================
    # Helper Methods
    # ========================================================================

    def _parse_typing_event(self, event_data: Dict[str, Any]) -> Optional[TypingEvent]:
        """타이핑 이벤트 데이터 파싱"""
        try:
            return TypingEvent(
                keystroke=event_data.get('keystroke', ''),
                timestamp=float(event_data.get('timestamp', 0)),
                interval=float(event_data.get('interval', 0)),
                key_code=event_data.get('key_code'),
                is_special=event_data.get('is_special', False),
                session_time=float(event_data.get('session_time', 0))
            )
        except (ValueError, TypeError) as e:
            logger.warning("타이핑 이벤트 파싱 실패: %s", str(e))
            return None

    async def _analyze_realtime_patterns(self, session_id: str, buffer: List[Dict[str, Any]]) -> List[str]:
        """실시간 패턴 분석"""
        try:
            if len(buffer) < 10:  # 최소 10개 이벤트 필요
                return []

            # 최근 데이터만 사용 (마지막 50개 이벤트)
            recent_buffer = buffer[-50:] if len(buffer) > 50 else buffer

            patterns = []

            # 타이핑 속도 패턴
            intervals = [float(event.get('interval', 0)) for event in recent_buffer]
            if intervals:
                avg_interval = np.mean(intervals)
                if avg_interval < 100:  # 100ms 미만
                    patterns.append('fast_typing')
                elif avg_interval > 500:  # 500ms 초과
                    patterns.append('slow_typing')
                else:
                    patterns.append('normal_typing')

                # 리듬 일관성
                rhythm_variance = np.std(intervals) if len(intervals) > 1 else 0
                if rhythm_variance < 50:
                    patterns.append('consistent_rhythm')
                elif rhythm_variance > 200:
                    patterns.append('irregular_rhythm')

            # 일시정지 패턴 감지
            long_pauses = [interval for interval in intervals if interval > 1000]  # 1초 이상
            if len(long_pauses) > len(intervals) * 0.2:  # 20% 이상이 긴 일시정지
                patterns.append('frequent_pauses')

            return patterns

        except Exception as e:
            logger.error("실시간 패턴 분석 실패: session_id=%s, error=%s", session_id, str(e))
            return []

    async def _calculate_realtime_metrics(self, buffer: List[Dict[str, Any]]) -> Dict[str, float]:
        """실시간 메트릭스 계산"""
        try:
            if not buffer:
                return {}

            # 타이핑 속도 계산 (WPM)
            total_time = 0
            total_chars = 0
            intervals = []

            for event in buffer:
                interval = float(event.get('interval', 0))
                keystroke = event.get('keystroke', '')

                intervals.append(interval)
                total_time += interval
                if keystroke and not event.get('is_special', False):
                    total_chars += 1

            # WPM 계산 (5글자 = 1단어 가정)
            wpm = (total_chars / 5) / (total_time / 60000) if total_time > 0 else 0

            # 기타 메트릭스
            metrics = {
                'wpm': round(wpm, 2),
                'total_keystrokes': len(buffer),
                'session_duration': total_time / 1000,  # 초 단위
                'average_interval': np.mean(intervals) if intervals else 0,
                'rhythm_variance': np.std(intervals) if len(intervals) > 1 else 0
            }

            return metrics

        except Exception as e:
            logger.error("실시간 메트릭스 계산 실패: %s", str(e))
            return {}

    async def _should_trigger_emotion_analysis(self, session_id: str, buffer_size: int,
                                             patterns: List[str]) -> bool:
        """감정 분석 트리거 조건 확인"""
        try:
            # 버퍼 크기 기준
            if buffer_size >= self.EMOTION_ANALYSIS_THRESHOLD:
                return True

            # 특정 패턴 감지 시 트리거
            trigger_patterns = ['irregular_rhythm', 'frequent_pauses', 'fast_typing']
            if any(pattern in patterns for pattern in trigger_patterns):
                return True

            # 시간 기반 트리거 (마지막 분석으로부터 일정 시간 경과)
            last_emotion = await self.cache.get_cached_emotion(session_id)
            if last_emotion:
                # 캐시된 감정 데이터가 10분 이상 오래된 경우
                cached_at = last_emotion.get('cached_at')
                if cached_at:
                    cache_time = datetime.fromisoformat(cached_at)
                    if datetime.utcnow() - cache_time > timedelta(minutes=10):
                        return True

            return False

        except Exception as e:
            logger.error("감정 분석 트리거 조건 확인 실패: session_id=%s, error=%s", session_id, str(e))
            return False

    async def _should_trigger_music_generation(self, session_id: str, patterns: List[str]) -> bool:
        """음악 생성 트리거 조건 확인"""
        try:
            # 감정 데이터 존재 여부 확인
            emotion_data = await self.cache.get_cached_emotion(session_id)
            if not emotion_data:
                return False

            # 특정 패턴 또는 조건에서 음악 생성 트리거
            # (실제로는 사용자의 명시적 요청에 의해 트리거되는 경우가 많음)

            return False  # 기본적으로 수동 트리거

        except Exception as e:
            logger.error("음악 생성 트리거 조건 확인 실패: session_id=%s, error=%s", session_id, str(e))
            return False

    async def _analyze_typing_patterns(self, typing_buffer: List[Dict[str, Any]]) -> Dict[str, Any]:
        """타이핑 패턴 심화 분석"""
        try:
            # PatternAnalyzer를 사용한 패턴 분석
            analysis_result = await self.pattern_analyzer.analyze_typing_patterns({
                'events': typing_buffer,
                'session_id': 'temp',  # 임시 세션 ID
                'timestamp': datetime.utcnow().isoformat()
            })

            if analysis_result.get('success', False):
                return {
                    'success': True,
                    'patterns': analysis_result.get('patterns', {})
                }
            else:
                return {
                    'success': False,
                    'error': '패턴 분석 실패'
                }

        except Exception as e:
            logger.error("타이핑 패턴 분석 실패: %s", str(e))
            return {
                'success': False,
                'error': f'패턴 분석 중 오류: {str(e)}'
            }

    async def _map_emotion_from_patterns(self, patterns: Dict[str, Any]) -> Dict[str, Any]:
        """패턴에서 감정 매핑"""
        try:
            # EmotionMapper를 사용한 감정 매핑
            emotion_result = await self.emotion_mapper.map_patterns_to_emotion(patterns)

            if emotion_result.get('success', False):
                emotion_data = emotion_result.get('emotion', {})

                emotion_snapshot = EmotionSnapshot(
                    energy=emotion_data.get('energy', 0.5),
                    valence=emotion_data.get('valence', 0.0),
                    tension=emotion_data.get('tension', 0.5),
                    focus=emotion_data.get('focus', 0.5),
                    confidence=emotion_data.get('confidence', 0.5),
                    dominant_emotion=emotion_data.get('dominant_emotion', 'neutral'),
                    timestamp=datetime.utcnow()
                )

                return {
                    'success': True,
                    'emotion': emotion_snapshot
                }
            else:
                return {
                    'success': False,
                    'error': '감정 매핑 실패'
                }

        except Exception as e:
            logger.error("감정 매핑 실패: %s", str(e))
            return {
                'success': False,
                'error': f'감정 매핑 중 오류: {str(e)}'
            }

    async def _save_emotion_profile(self, session_id: str, emotion: EmotionSnapshot) -> None:
        """감정 프로필을 데이터베이스에 저장"""
        try:
            # UserSession 조회
            result = await self.db.execute(
                select(UserSession).where(UserSession.session_id == session_id)
            )
            user_session = result.scalar_one_or_none()

            if user_session:
                # 새 EmotionProfile 생성
                emotion_profile = EmotionProfile(
                    session_id=user_session.id,
                    energy_level=emotion.energy,
                    valence_score=emotion.valence,
                    tension_level=emotion.tension,
                    focus_level=emotion.focus,
                    dominant_emotion=emotion.dominant_emotion,
                    confidence_score=emotion.confidence,
                    analysis_timestamp=emotion.timestamp
                )

                self.db.add(emotion_profile)
                await self.db.commit()

                logger.info("감정 프로필 저장됨: session_id=%s", session_id)

        except Exception as e:
            logger.error("감정 프로필 저장 실패: session_id=%s, error=%s", session_id, str(e))
            await self.db.rollback()

    async def _create_music_prompt(self, emotion_data: Dict[str, Any]) -> str:
        """감정 데이터를 기반으로 음악 프롬프트 생성"""
        try:
            energy = emotion_data.get('energy', 0.5)
            valence = emotion_data.get('valence', 0.0)
            tension = emotion_data.get('tension', 0.5)
            focus = emotion_data.get('focus', 0.5)
            dominant_emotion = emotion_data.get('dominant_emotion', 'neutral')

            # 감정 기반 음악 스타일 결정
            if energy > 0.7 and valence > 0.3:
                mood = "energetic and positive"
                tempo = "fast"
                genre = "electronic or pop"
            elif energy < 0.3 and valence < -0.3:
                mood = "calm and melancholic"
                tempo = "slow"
                genre = "ambient or classical"
            elif tension > 0.7:
                mood = "tense and dramatic"
                tempo = "moderate to fast"
                genre = "cinematic or rock"
            elif focus > 0.7:
                mood = "focused and contemplative"
                tempo = "moderate"
                genre = "minimal or instrumental"
            else:
                mood = "balanced and neutral"
                tempo = "moderate"
                genre = "acoustic or indie"

            prompt = f"""
            Create a {tempo}-tempo {genre} piece with a {mood} atmosphere.

            Musical characteristics:
            - Energy level: {energy:.1f}/1.0
            - Emotional valence: {valence:.1f} (negative to positive)
            - Tension: {tension:.1f}/1.0
            - Focus: {focus:.1f}/1.0
            - Dominant emotion: {dominant_emotion}

            Duration: 60-90 seconds
            Style: Instrumental, suitable for background listening
            """

            return prompt.strip()

        except Exception as e:
            logger.error("음악 프롬프트 생성 실패: %s", str(e))
            return "Create a moderate-tempo instrumental piece suitable for background listening."

    async def _generate_music_with_ai(self, session_id: str, prompt: str,
                                    websocket_manager=None) -> Dict[str, Any]:
        """AI를 사용하여 음악 생성"""
        try:
            # 진행 상황 업데이트
            if websocket_manager:
                await websocket_manager.send_personal_message(session_id, {
                    'type': 'music_generation_progress',
                    'stage': 'processing',
                    'progress': 75,
                    'message': 'AI 서버에서 음악을 처리하고 있습니다...'
                })

            # AIConnector를 사용한 음악 생성
            generation_result = await self.ai_connector.generate_music({
                'prompt': prompt,
                'session_id': session_id,
                'duration': 60,  # 60초 기본
                'format': 'mp3'
            })

            if generation_result.get('success', False):
                music_data = generation_result.get('music', {})

                # 임시 음악 데이터 캐싱
                await self.cache.set_temp_music_data(
                    music_data.get('id', session_id),
                    music_data,
                    ttl=1800  # 30분 TTL
                )

                return {
                    'success': True,
                    'data': {
                        'music_id': music_data.get('id'),
                        'title': music_data.get('title', '생성된 음악'),
                        'duration': music_data.get('duration', 60),
                        'url': music_data.get('url'),
                        'metadata': music_data.get('metadata', {})
                    }
                }
            else:
                return {
                    'success': False,
                    'error': generation_result.get('error', 'AI 음악 생성 실패')
                }

        except Exception as e:
            logger.error("AI 음악 생성 실패: session_id=%s, error=%s", session_id, str(e))
            return {
                'success': False,
                'error': f'AI 음악 생성 중 오류: {str(e)}'
            }

    # ========================================================================
    # Session Management
    # ========================================================================

    async def cleanup_session_data(self, session_id: str) -> bool:
        """세션 데이터 정리"""
        try:
            # Redis 캐시 정리
            await self.cache.clear_typing_buffer(session_id)
            await self.cache.delete_session(session_id)

            # 처리 상태 정리
            self.processing_sessions.pop(session_id, None)

            logger.info("세션 데이터 정리 완료: session_id=%s", session_id)
            return True

        except Exception as e:
            logger.error("세션 데이터 정리 실패: session_id=%s, error=%s", session_id, str(e))
            return False

    async def get_session_statistics(self, session_id: str) -> Dict[str, Any]:
        """세션 통계 조회"""
        try:
            # 타이핑 버퍼 통계
            typing_buffer = await self.cache.get_typing_buffer(session_id)

            # 캐시된 감정 데이터
            emotion_data = await self.cache.get_cached_emotion(session_id)

            # 통계 계산
            metrics = await self._calculate_realtime_metrics(typing_buffer)

            return {
                'session_id': session_id,
                'typing_events': len(typing_buffer),
                'metrics': metrics,
                'emotion_data': emotion_data,
                'last_analysis': emotion_data.get('cached_at') if emotion_data else None,
                'timestamp': datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.error("세션 통계 조회 실패: session_id=%s, error=%s", session_id, str(e))
            return {}


# Export for use in other modules
__all__ = ["RealtimeProcessor", "TypingEvent", "TypingMetrics", "EmotionSnapshot", "ProcessingResult"]