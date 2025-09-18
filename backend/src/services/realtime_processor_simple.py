"""
T006: 실시간 타이핑 데이터 처리 서비스 (기본 감정 분석 엔진 적용)
WebSocket으로 받은 타이핑 데이터를 처리하고 BasicEmotionAnalyzer로 감정 분석 결과 반환
"""

import logging
import asyncio
from datetime import datetime
from typing import Dict, List, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from .emotion_analyzer import BasicEmotionAnalyzer
from ..models.emotion import EmotionData

logger = logging.getLogger(__name__)

class RealtimeProcessor:
    """실시간 타이핑 데이터 처리기 (T006 감정 분석 엔진 적용)"""

    def __init__(self, cache_service, db_session: AsyncSession):
        self.cache_service = cache_service
        self.db_session = db_session
        self.session_buffers: Dict[str, List[Dict[str, Any]]] = {}

        # T006: BasicEmotionAnalyzer 초기화
        self.emotion_analyzer = BasicEmotionAnalyzer({
            'smoothing_factor': 0.3,
            'confidence_threshold': 0.5,
            'min_events_required': 3
        })

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
        """T006: 기본 감정 분석 엔진을 사용한 감정 분석 트리거"""
        try:
            logger.info(f"감정 분석 트리거: session_id={session_id}")

            if session_id not in self.session_buffers or len(self.session_buffers[session_id]) < 3:
                return {
                    'success': False,
                    'error': '감정 분석을 위한 충분한 데이터가 없습니다'
                }

            # T006: BasicEmotionAnalyzer로 감정 분석 실행
            analysis_response = self.emotion_analyzer.analyze_events(self.session_buffers[session_id])

            if not analysis_response.success:
                return {
                    'success': False,
                    'error': analysis_response.error_message
                }

            emotion_data = analysis_response.emotion_data
            return {
                'success': True,
                'data': {
                    'energy': emotion_data.energy,
                    'valence': emotion_data.valence,
                    'tension': emotion_data.tension,
                    'focus': emotion_data.focus,
                    'confidence': emotion_data.confidence,
                    'timestamp': emotion_data.timestamp.isoformat(),
                    'sample_size': emotion_data.sample_size,
                    'processing_time_ms': emotion_data.processing_time_ms
                },
                'debug_info': analysis_response.debug_info
            }

        except Exception as e:
            logger.error(f"감정 분석 실패: session_id={session_id}, error={str(e)}")
            return {
                'success': False,
                'error': f'감정 분석 실패: {str(e)}'
            }

    async def trigger_music_generation(self, session_id: str, manager) -> Dict[str, Any]:
        """음악 생성 트리거 (비동기)"""
        try:
            logger.info(f"음악 생성 트리거: session_id={session_id}")

            # 음악 생성 시뮬레이션 (3초 지연)
            await asyncio.sleep(3.0)

            # 성공 메시지 전송
            await manager.send_personal_message(session_id, {
                'type': 'music_generation_completed',
                'data': {
                    'music_url': f'https://example.com/music/{session_id}.mp3',
                    'duration': 30,
                    'genre': 'ambient',
                    'mood': 'calm'
                }
            })

            return {
                'success': True,
                'message': '음악 생성 완료'
            }

        except Exception as e:
            logger.error(f"음악 생성 실패: session_id={session_id}, error={str(e)}")

            # 실패 메시지 전송
            await manager.send_personal_message(session_id, {
                'type': 'music_generation_failed',
                'error': str(e)
            })

            return {
                'success': False,
                'error': f'음악 생성 실패: {str(e)}'
            }

    def _detect_patterns(self, events: List[Dict[str, Any]]) -> List[str]:
        """패턴 감지 (모킹)"""
        patterns = []

        if len(events) < 2:
            return patterns

        # 최근 5개 이벤트 분석
        recent_events = events[-5:]

        # 간격 패턴 분석
        intervals = [event.get('interval', 0) for event in recent_events if event.get('interval') is not None]
        if intervals:
            avg_interval = sum(intervals) / len(intervals)
            if avg_interval < 100:
                patterns.append('fast_typing')
            elif avg_interval > 500:
                patterns.append('slow_typing')
            else:
                patterns.append('normal_typing')

        # 지속시간 패턴 분석
        durations = [event.get('duration', 0) for event in recent_events if event.get('duration') is not None]
        if durations:
            avg_duration = sum(durations) / len(durations)
            if avg_duration > 150:
                patterns.append('heavy_press')
            elif avg_duration < 50:
                patterns.append('light_press')

        # 백스페이스 패턴 분석
        backspace_count = sum(1 for event in recent_events if event.get('isBackspace', False))
        if backspace_count > 2:
            patterns.append('high_correction')

        return patterns

    def _calculate_basic_emotion(self, events: List[Dict[str, Any]]) -> Dict[str, float]:
        """
        T006: 기본 감정 분석 엔진으로 대체됨
        하위 호환성을 위해 BasicEmotionAnalyzer 결과를 반환
        """
        try:
            analysis_response = self.emotion_analyzer.analyze_events(events)
            if analysis_response.success and analysis_response.emotion_data:
                emotion = analysis_response.emotion_data
                return {
                    'energy': emotion.energy,
                    'tension': emotion.tension,
                    'focus': emotion.focus,
                    'calculated_at': emotion.timestamp.isoformat()
                }
        except Exception as e:
            logger.warning(f"기본 감정 계산 중 오류: {str(e)}")

        # 실패 시 기본값
        return {
            'energy': 0.5,
            'tension': 0.3,
            'focus': 0.7,
            'calculated_at': datetime.utcnow().isoformat()
        }