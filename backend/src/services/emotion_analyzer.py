"""
T006: 기본 감정 분석 엔진
타이핑 패턴에서 기본 감정 상태를 추출하는 분석 엔진
"""

import time
import logging
import statistics
from datetime import datetime
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from ..models.emotion import (
    TypingEvent, TypingPattern, EmotionData,
    EmotionAnalysisRequest, EmotionAnalysisResponse
)

logger = logging.getLogger(__name__)


class BasicEmotionAnalyzer:
    """기본 감정 분석 엔진"""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        감정 분석기 초기화

        Args:
            config: 분석기 설정
                - smoothing_factor: 스무딩 계수 (0.1-0.9, 기본값: 0.3)
                - confidence_threshold: 신뢰도 임계값 (기본값: 0.5)
                - min_events_required: 최소 이벤트 수 (기본값: 3)
        """
        self.config = config or {}
        self.smoothing_factor = self.config.get('smoothing_factor', 0.3)
        self.confidence_threshold = self.config.get('confidence_threshold', 0.5)
        self.min_events_required = self.config.get('min_events_required', 3)

        # 이전 감정 상태 (스무딩용)
        self.previous_emotion: Optional[EmotionData] = None

        logger.info(f"BasicEmotionAnalyzer 초기화: smoothing_factor={self.smoothing_factor}")

    def analyze_typing_pattern(self, pattern: TypingPattern) -> EmotionData:
        """
        타이핑 패턴에서 감정 상태 분석

        Args:
            pattern: 타이핑 패턴 데이터

        Returns:
            EmotionData: 감정 분석 결과
        """
        start_time = time.time()

        try:
            # 1. 에너지 레벨 계산 (타이핑 속도 기반)
            energy = self._calculate_energy_level(pattern)

            # 2. 긴장도 계산 (리듬 변화 기반)
            tension = self._calculate_tension_level(pattern)

            # 3. 집중도 계산 (일시정지 패턴 기반)
            focus = self._calculate_focus_level(pattern)

            # 4. 감정가 계산 (에너지와 긴장도 조합)
            valence = self._calculate_valence(energy, tension)

            # 5. 신뢰도 계산 (데이터 품질 기반)
            confidence = self._calculate_confidence(pattern)

            # 6. 원시 감정 데이터 생성
            raw_emotion = EmotionData(
                energy=energy,
                valence=valence,
                tension=tension,
                focus=focus,
                confidence=confidence,
                sample_size=len(pattern.events),
                processing_time_ms=(time.time() - start_time) * 1000,
                timestamp=datetime.utcnow()
            )

            # 7. 스무딩 적용
            smoothed_emotion = self._apply_smoothing(raw_emotion)

            # 8. 이전 상태 업데이트
            self.previous_emotion = smoothed_emotion

            logger.debug(f"감정 분석 완료: energy={energy:.3f}, valence={valence:.3f}, "
                        f"tension={tension:.3f}, focus={focus:.3f}, confidence={confidence:.3f}")

            return smoothed_emotion

        except Exception as e:
            logger.error(f"감정 분석 중 오류 발생: {str(e)}")
            raise

    def _calculate_energy_level(self, pattern: TypingPattern) -> float:
        """
        에너지 레벨 계산 (타이핑 속도 기반)

        Args:
            pattern: 타이핑 패턴

        Returns:
            float: 에너지 레벨 (0-1)
        """
        # WPM을 에너지로 변환 (100 WPM = 1.0 에너지)
        base_energy = min(pattern.average_speed / 100.0, 1.0)

        # 키 누름 지속시간을 고려한 보정
        if pattern.events:
            avg_duration = statistics.mean([event.duration for event in pattern.events])
            # 짧은 키 누름 = 높은 에너지 (50ms 기준)
            duration_factor = max(0.5, min(1.5, 100 / max(avg_duration, 10)))
            base_energy *= duration_factor

        return max(0.0, min(1.0, base_energy))

    def _calculate_tension_level(self, pattern: TypingPattern) -> float:
        """
        긴장도 계산 (리듬 변화 기반)

        Args:
            pattern: 타이핑 패턴

        Returns:
            float: 긴장도 (0-1)
        """
        # 리듬 변화도를 긴장도로 변환 (100 = 1.0 긴장도로 조정)
        base_tension = min(pattern.rhythm_variation / 100.0, 1.0)

        # 백스페이스 비율을 고려한 보정 (오타로 인한 긴장)
        error_tension = min(pattern.error_rate * 1.0, 0.3)  # 계수 조정

        # 타이핑 간격 불규칙성 고려 (개선된 로직)
        if pattern.events and len(pattern.events) > 1:
            intervals = [event.interval for event in pattern.events[1:]]  # 첫 번째는 제외
            if intervals and len(intervals) > 1:
                interval_std = statistics.stdev(intervals)
                # 표준편차가 클 때만 긴장도 추가 (50ms 이상의 변동)
                if interval_std > 50:
                    interval_tension = min((interval_std - 50) / 200.0 * 0.2, 0.2)
                    base_tension += interval_tension

        total_tension = base_tension + error_tension
        return max(0.0, min(1.0, total_tension))

    def _calculate_focus_level(self, pattern: TypingPattern) -> float:
        """
        집중도 계산 (일시정지 패턴 기반)

        Args:
            pattern: 타이핑 패턴

        Returns:
            float: 집중도 (0-1)
        """
        if not pattern.pause_pattern:
            return 0.5  # 기본값

        # 적절한 일시정지는 집중도를 높임
        optimal_pause_range = (200, 800)  # 200-800ms가 적절한 사고 시간

        optimal_pauses = [
            pause for pause in pattern.pause_pattern
            if optimal_pause_range[0] <= pause <= optimal_pause_range[1]
        ]

        # 적절한 일시정지 비율
        optimal_ratio = len(optimal_pauses) / len(pattern.pause_pattern)

        # 너무 긴 일시정지는 집중도를 낮춤 (3초 이상)
        long_pauses = [pause for pause in pattern.pause_pattern if pause > 3000]
        long_pause_penalty = min(len(long_pauses) * 0.1, 0.4)

        # 타이핑 일관성 고려
        consistency_bonus = max(0, 1.0 - pattern.rhythm_variation / 30.0) * 0.3

        focus_score = (optimal_ratio * 0.7) + consistency_bonus - long_pause_penalty

        return max(0.0, min(1.0, focus_score))

    def _calculate_valence(self, energy: float, tension: float) -> float:
        """
        감정가 계산 (에너지와 긴장도 조합)

        Args:
            energy: 에너지 레벨
            tension: 긴장도

        Returns:
            float: 감정가 (-1 to 1)
        """
        # 높은 에너지 + 낮은 긴장 = 긍정적
        # 낮은 에너지 + 높은 긴장 = 부정적
        valence = (energy - tension) * 1.5

        # -1 ~ 1 범위로 제한
        return max(-1.0, min(1.0, valence))

    def _calculate_confidence(self, pattern: TypingPattern) -> float:
        """
        분석 신뢰도 계산 (데이터 품질 기반)

        Args:
            pattern: 타이핑 패턴

        Returns:
            float: 신뢰도 (0-1)
        """
        # 기본 신뢰도: 데이터 양에 따라
        sample_confidence = min(len(pattern.events) / 20.0, 1.0)

        # 일관성 보너스: 패턴이 일관적일수록 높은 신뢰도
        consistency_bonus = max(0, (30.0 - pattern.rhythm_variation) / 30.0) * 0.3

        # 에러율 페널티: 너무 많은 오타는 신뢰도를 낮춤
        error_penalty = min(pattern.error_rate, 0.3)

        confidence = (sample_confidence * 0.7) + consistency_bonus - error_penalty

        return max(0.1, min(1.0, confidence))  # 최소 0.1 신뢰도 보장

    def _apply_smoothing(self, current_emotion: EmotionData) -> EmotionData:
        """
        감정 데이터 스무딩 적용

        Args:
            current_emotion: 현재 감정 데이터

        Returns:
            EmotionData: 스무딩된 감정 데이터
        """
        if self.previous_emotion is None:
            return current_emotion

        # 지수 가중 이동 평균 적용
        alpha = self.smoothing_factor

        smoothed_energy = (alpha * current_emotion.energy) + ((1 - alpha) * self.previous_emotion.energy)
        smoothed_valence = (alpha * current_emotion.valence) + ((1 - alpha) * self.previous_emotion.valence)
        smoothed_tension = (alpha * current_emotion.tension) + ((1 - alpha) * self.previous_emotion.tension)
        smoothed_focus = (alpha * current_emotion.focus) + ((1 - alpha) * self.previous_emotion.focus)

        return EmotionData(
            energy=smoothed_energy,
            valence=smoothed_valence,
            tension=smoothed_tension,
            focus=smoothed_focus,
            confidence=current_emotion.confidence,  # 신뢰도는 스무딩하지 않음
            sample_size=current_emotion.sample_size,
            processing_time_ms=current_emotion.processing_time_ms,
            timestamp=current_emotion.timestamp
        )

    def analyze_events(self, events: List[Dict[str, Any]]) -> EmotionAnalysisResponse:
        """
        이벤트 목록에서 감정 분석

        Args:
            events: 타이핑 이벤트 목록

        Returns:
            EmotionAnalysisResponse: 분석 결과
        """
        try:
            if len(events) < self.min_events_required:
                return EmotionAnalysisResponse(
                    success=False,
                    error_message=f"최소 {self.min_events_required}개 이상의 이벤트가 필요합니다"
                )

            # 이벤트를 TypingEvent로 변환
            typing_events = []
            for event_data in events:
                typing_event = TypingEvent(
                    key=event_data.get('keystroke', ''),
                    timestamp=event_data.get('timestamp', 0),
                    duration=event_data.get('duration', 0.0),
                    interval=event_data.get('interval', 0.0),
                    is_backspace=event_data.get('isBackspace', False)
                )
                typing_events.append(typing_event)

            # 타이핑 패턴 생성
            pattern = self._create_typing_pattern(typing_events)

            # 감정 분석 실행
            emotion_data = self.analyze_typing_pattern(pattern)

            return EmotionAnalysisResponse(
                success=True,
                emotion_data=emotion_data,
                debug_info={
                    'pattern_stats': {
                        'average_speed': pattern.average_speed,
                        'rhythm_variation': pattern.rhythm_variation,
                        'error_rate': pattern.error_rate,
                        'consistency_score': pattern.consistency_score
                    }
                }
            )

        except Exception as e:
            logger.error(f"이벤트 분석 중 오류: {str(e)}")
            return EmotionAnalysisResponse(
                success=False,
                error_message=f"분석 중 오류가 발생했습니다: {str(e)}"
            )

    def _create_typing_pattern(self, events: List[TypingEvent]) -> TypingPattern:
        """
        타이핑 이벤트에서 패턴 생성

        Args:
            events: 타이핑 이벤트 목록

        Returns:
            TypingPattern: 분석된 패턴
        """
        if not events:
            raise ValueError("빈 이벤트 목록")

        # 평균 타이핑 속도 계산 (WPM)
        if len(events) > 1:
            total_time = (events[-1].timestamp - events[0].timestamp) / 1000.0  # seconds
            if total_time > 0:
                # 5글자를 1단어로 가정
                words_typed = len([e for e in events if not e.is_backspace]) / 5.0
                average_speed = (words_typed / total_time) * 60.0  # WPM
            else:
                average_speed = 0.0
        else:
            average_speed = 0.0

        # 리듬 변화도 계산
        intervals = [event.interval for event in events[1:]]  # 첫 번째 제외
        if len(intervals) > 1:
            rhythm_variation = statistics.stdev(intervals)
        else:
            rhythm_variation = 0.0

        # 일시정지 패턴 (500ms 이상의 간격)
        pause_pattern = [interval for interval in intervals if interval >= 500]

        # 오타율 계산
        total_keys = len(events)
        backspace_keys = len([e for e in events if e.is_backspace])
        error_rate = backspace_keys / total_keys if total_keys > 0 else 0.0

        # 일관성 점수 계산 (간격의 변동 계수의 역수)
        if intervals and statistics.mean(intervals) > 0:
            cv = statistics.stdev(intervals) / statistics.mean(intervals)
            consistency_score = max(0.0, min(1.0, 1.0 - cv))
        else:
            consistency_score = 0.5

        return TypingPattern(
            events=events,
            average_speed=average_speed,
            rhythm_variation=rhythm_variation,
            pause_pattern=pause_pattern,
            error_rate=error_rate,
            consistency_score=consistency_score
        )