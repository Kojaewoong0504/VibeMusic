"""
TypingPattern 모델 - 키보드 입력 패턴 저장
"""
from typing import Optional, List, Dict, Any

from sqlalchemy import ForeignKey, Text, CheckConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class TypingPattern(Base):
    """타이핑 패턴 모델"""

    __tablename__ = "typing_patterns"

    # 세션 관계
    session_id: Mapped[str] = mapped_column(
        ForeignKey("user_sessions.id", ondelete="CASCADE"),
        nullable=False,
        comment="연관된 사용자 세션 ID"
    )

    # 키스트로크 데이터
    keystrokes: Mapped[List[Dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=False,
        comment="키 입력 데이터 배열"
    )

    # 입력된 텍스트 내용
    text_content: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="입력된 텍스트 내용"
    )

    # 관계 설정
    session = relationship(
        "UserSession",
        back_populates="typing_patterns",
        lazy="selectin"
    )

    emotion_profile = relationship(
        "EmotionProfile",
        back_populates="typing_pattern",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="selectin"
    )

    # 제약 조건
    __table_args__ = (
        CheckConstraint(
            "jsonb_array_length(keystrokes) >= 10",
            name="check_minimum_keystrokes"
        ),
    )

    def validate_keystrokes(self) -> bool:
        """키스트로크 데이터 유효성 검증"""
        if not self.keystrokes or len(self.keystrokes) < 10:
            return False

        required_fields = {'key', 'timestamp', 'duration', 'type'}
        valid_types = {'keydown', 'keyup'}

        # 이전 타임스탬프 추적 (단조 증가 확인)
        prev_timestamp = 0

        for keystroke in self.keystrokes:
            # 필수 필드 확인
            if not all(field in keystroke for field in required_fields):
                return False

            # 타입 검증
            if keystroke['type'] not in valid_types:
                return False

            # 타임스탬프 검증 (단조 증가)
            current_timestamp = keystroke['timestamp']
            if current_timestamp <= prev_timestamp:
                return False
            prev_timestamp = current_timestamp

            # 지속 시간 검증 (양수)
            if keystroke['duration'] < 0:
                return False

        return True

    def get_typing_statistics(self) -> Dict[str, Any]:
        """타이핑 통계 계산"""
        if not self.keystrokes:
            return {}

        keydown_events = [
            ks for ks in self.keystrokes
            if ks['type'] == 'keydown'
        ]

        if len(keydown_events) < 2:
            return {}

        # 타이핑 속도 계산 (WPM)
        total_time_seconds = (
            keydown_events[-1]['timestamp'] - keydown_events[0]['timestamp']
        ) / 1000.0

        if total_time_seconds <= 0:
            return {}

        words_count = len(self.text_content.split()) if self.text_content else 0
        wpm = (words_count / total_time_seconds) * 60 if total_time_seconds > 0 else 0

        # 키 간격 분석
        intervals = []
        for i in range(1, len(keydown_events)):
            interval = keydown_events[i]['timestamp'] - keydown_events[i-1]['timestamp']
            intervals.append(interval)

        avg_interval = sum(intervals) / len(intervals) if intervals else 0

        # 일시정지 감지 (500ms 이상 간격)
        pauses = [interval for interval in intervals if interval > 500]
        pause_count = len(pauses)
        total_pause_time = sum(pauses)

        # 키 지속 시간 통계
        durations = [ks['duration'] for ks in keydown_events]
        avg_duration = sum(durations) / len(durations) if durations else 0

        return {
            "total_keystrokes": len(self.keystrokes),
            "keydown_count": len(keydown_events),
            "total_time_seconds": total_time_seconds,
            "words_per_minute": round(wpm, 2),
            "average_interval_ms": round(avg_interval, 2),
            "average_duration_ms": round(avg_duration, 2),
            "pause_count": pause_count,
            "total_pause_time_ms": total_pause_time,
            "rhythm_consistency": self._calculate_rhythm_consistency(intervals),
            "typing_speed_score": min(wpm / 100.0, 1.0),  # 0-1 정규화
        }

    def _calculate_rhythm_consistency(self, intervals: List[float]) -> float:
        """리듬 일관성 계산 (0-1 점수)"""
        if len(intervals) < 3:
            return 0.0

        # 표준편차를 이용한 일관성 측정
        mean_interval = sum(intervals) / len(intervals)
        variance = sum((x - mean_interval) ** 2 for x in intervals) / len(intervals)
        std_dev = variance ** 0.5

        # 변동 계수 (Coefficient of Variation)
        cv = std_dev / mean_interval if mean_interval > 0 else 1.0

        # 1에서 변동 계수를 빼서 일관성 점수 계산 (높을수록 일관적)
        consistency = max(0.0, 1.0 - min(cv, 1.0))
        return round(consistency, 3)

    def extract_text_content(self) -> str:
        """키스트로크에서 텍스트 내용 추출"""
        if not self.keystrokes:
            return ""

        # keydown 이벤트만 필터링하고 특수키 제외
        text_chars = []
        for keystroke in self.keystrokes:
            if keystroke['type'] == 'keydown':
                key = keystroke['key']

                # 일반 문자 및 숫자만 포함
                if len(key) == 1 and (key.isalnum() or key in ' .,!?;:-_()[]{}'):
                    text_chars.append(key)
                elif key == 'Space':
                    text_chars.append(' ')

        return ''.join(text_chars)

    def to_dict(self) -> dict:
        """타이핑 패턴 정보를 딕셔너리로 변환"""
        stats = self.get_typing_statistics()

        return {
            "id": self.id,
            "session_id": self.session_id,
            "text_content": self.text_content,
            "keystroke_count": len(self.keystrokes) if self.keystrokes else 0,
            "statistics": stats,
            "is_valid": self.validate_keystrokes(),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

    def __repr__(self) -> str:
        keystroke_count = len(self.keystrokes) if self.keystrokes else 0
        text_preview = (self.text_content[:20] + "..."
                       if self.text_content and len(self.text_content) > 20
                       else self.text_content or "")

        return f"<TypingPattern(id={self.id}, keystrokes={keystroke_count}, text='{text_preview}')>"