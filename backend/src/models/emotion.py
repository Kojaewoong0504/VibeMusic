"""
T006: 기본 감정 분석 엔진 - 감정 데이터 모델
타이핑 패턴에서 추출한 감정 상태를 표현하는 데이터 모델
"""

from datetime import datetime
from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field, validator
from dataclasses import dataclass
import statistics


@dataclass
class TypingEvent:
    """타이핑 이벤트 데이터 구조"""
    key: str
    timestamp: int  # milliseconds
    duration: float  # key press duration in ms
    interval: float  # interval from previous key in ms
    is_backspace: bool


@dataclass
class TypingPattern:
    """타이핑 패턴 분석 결과"""
    events: List[TypingEvent]
    average_speed: float  # WPM
    rhythm_variation: float  # rhythm variation coefficient
    pause_pattern: List[float]  # pause intervals
    error_rate: float  # backspace ratio
    consistency_score: float  # typing consistency


class EmotionData(BaseModel):
    """감정 분석 결과 데이터 모델"""
    energy: float = Field(..., ge=0.0, le=1.0, description="에너지 레벨 (0-1)")
    valence: float = Field(..., ge=-1.0, le=1.0, description="감정가 (-1~1, 부정적~긍정적)")
    tension: float = Field(..., ge=0.0, le=1.0, description="긴장도 (0-1)")
    focus: float = Field(..., ge=0.0, le=1.0, description="집중도 (0-1)")
    confidence: float = Field(..., ge=0.0, le=1.0, description="분석 신뢰도 (0-1)")
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # 메타데이터
    sample_size: int = Field(..., gt=0, description="분석에 사용된 이벤트 수")
    processing_time_ms: Optional[float] = Field(None, description="처리 시간 (ms)")

    @validator('energy', 'tension', 'focus', 'confidence')
    def validate_positive_range(cls, v):
        """0-1 범위 검증"""
        if not 0.0 <= v <= 1.0:
            raise ValueError("값은 0.0과 1.0 사이여야 합니다")
        return v

    @validator('valence')
    def validate_valence_range(cls, v):
        """-1~1 범위 검증"""
        if not -1.0 <= v <= 1.0:
            raise ValueError("감정가는 -1.0과 1.0 사이여야 합니다")
        return v


class EmotionAnalysisRequest(BaseModel):
    """감정 분석 요청 데이터 모델"""
    events: List[Dict[str, Any]] = Field(..., min_items=1, description="타이핑 이벤트 목록")
    session_id: str = Field(..., description="세션 ID")
    analysis_window_size: Optional[int] = Field(20, description="분석 윈도우 크기")

    @validator('events')
    def validate_events(cls, v):
        """이벤트 데이터 검증"""
        if not v:
            raise ValueError("최소 1개 이상의 이벤트가 필요합니다")

        required_fields = ['keystroke', 'timestamp', 'duration', 'interval', 'isBackspace']
        for event in v:
            for field in required_fields:
                if field not in event:
                    raise ValueError(f"이벤트에 '{field}' 필드가 누락되었습니다")

        return v


class EmotionAnalysisResponse(BaseModel):
    """감정 분석 응답 데이터 모델"""
    success: bool = Field(..., description="분석 성공 여부")
    emotion_data: Optional[EmotionData] = Field(None, description="감정 분석 결과")
    error_message: Optional[str] = Field(None, description="에러 메시지")
    debug_info: Optional[Dict[str, Any]] = Field(None, description="디버그 정보")


class EmotionHistory(BaseModel):
    """감정 변화 히스토리"""
    session_id: str
    emotions: List[EmotionData] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    def add_emotion(self, emotion: EmotionData) -> None:
        """새로운 감정 데이터 추가"""
        self.emotions.append(emotion)

        # 최대 100개 히스토리 유지
        if len(self.emotions) > 100:
            self.emotions = self.emotions[-100:]

    def get_emotion_trend(self, metric: str = 'energy', window: int = 5) -> Optional[float]:
        """감정 변화 추세 계산 (최근 window개 데이터 기준)"""
        if len(self.emotions) < window:
            return None

        recent_values = [getattr(emotion, metric) for emotion in self.emotions[-window:]]

        # 선형 회귀를 통한 추세 계산 (간단한 버전)
        if len(recent_values) < 2:
            return 0.0

        # 최근 데이터와 이전 데이터 비교
        recent_avg = statistics.mean(recent_values[-window//2:])
        previous_avg = statistics.mean(recent_values[:window//2])

        return recent_avg - previous_avg

    def get_average_emotion(self, window: int = 10) -> Optional[EmotionData]:
        """최근 N개 감정 데이터의 평균"""
        if len(self.emotions) < 1:
            return None

        recent_emotions = self.emotions[-window:]

        return EmotionData(
            energy=statistics.mean([e.energy for e in recent_emotions]),
            valence=statistics.mean([e.valence for e in recent_emotions]),
            tension=statistics.mean([e.tension for e in recent_emotions]),
            focus=statistics.mean([e.focus for e in recent_emotions]),
            confidence=statistics.mean([e.confidence for e in recent_emotions]),
            sample_size=sum([e.sample_size for e in recent_emotions]),
            timestamp=datetime.utcnow()
        )