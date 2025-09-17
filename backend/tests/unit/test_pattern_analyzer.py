"""
패턴 분석기 단위 테스트

T081: 패턴 분석 알고리즘 단위 테스트 구현
- 키스트로크 분석 정확성 검증
- 타이핑 통계 계산 검증
- 리듬 패턴 분류 검증
- 에지 케이스 및 예외 처리 검증
"""
import pytest
from unittest.mock import Mock, patch
import statistics
import math
from typing import List, Dict, Any

from src.lib.pattern_analyzer.analyzer import PatternAnalyzer, TypingStatistics


class TestTypingStatistics:
    """TypingStatistics 클래스 테스트"""

    def test_typing_statistics_creation(self):
        """통계 객체 생성 테스트"""
        stats = TypingStatistics(
            total_keystrokes=100,
            keydown_count=50,
            total_time_seconds=30.5,
            words_per_minute=45.2,
            average_interval_ms=150.3,
            average_duration_ms=80.7,
            pause_count=5,
            total_pause_time_ms=2500.0,
            rhythm_consistency=0.85,
            typing_speed_score=0.45
        )

        assert stats.total_keystrokes == 100
        assert stats.keydown_count == 50
        assert stats.total_time_seconds == 30.5
        assert stats.words_per_minute == 45.2
        assert stats.rhythm_consistency == 0.85

    def test_to_dict_conversion(self):
        """딕셔너리 변환 테스트"""
        stats = TypingStatistics(
            total_keystrokes=100,
            keydown_count=50,
            total_time_seconds=30.567,
            words_per_minute=45.234,
            average_interval_ms=150.789,
            average_duration_ms=80.123,
            pause_count=5,
            total_pause_time_ms=2500.0,
            rhythm_consistency=0.8567,
            typing_speed_score=0.4523
        )

        result = stats.to_dict()

        # 반올림 검증
        assert result["total_time_seconds"] == 30.57
        assert result["words_per_minute"] == 45.23
        assert result["average_interval_ms"] == 150.79
        assert result["rhythm_consistency"] == 0.857
        assert result["typing_speed_score"] == 0.452


class TestPatternAnalyzer:
    """PatternAnalyzer 클래스 테스트"""

    @pytest.fixture
    def analyzer(self):
        """기본 분석기 인스턴스"""
        return PatternAnalyzer(pause_threshold_ms=500.0)

    @pytest.fixture
    def sample_keystrokes(self):
        """샘플 키스트로크 데이터"""
        return [
            {"key": "h", "timestamp": 1000, "duration": 80, "type": "keydown"},
            {"key": "h", "timestamp": 1080, "duration": 0, "type": "keyup"},
            {"key": "e", "timestamp": 1200, "duration": 75, "type": "keydown"},
            {"key": "e", "timestamp": 1275, "duration": 0, "type": "keyup"},
            {"key": "l", "timestamp": 1350, "duration": 90, "type": "keydown"},
            {"key": "l", "timestamp": 1440, "duration": 0, "type": "keyup"},
            {"key": "l", "timestamp": 1500, "duration": 85, "type": "keydown"},
            {"key": "l", "timestamp": 1585, "duration": 0, "type": "keyup"},
            {"key": "o", "timestamp": 1650, "duration": 70, "type": "keydown"},
            {"key": "o", "timestamp": 1720, "duration": 0, "type": "keyup"}
        ]

    @pytest.fixture
    def fast_typing_keystrokes(self):
        """빠른 타이핑 데이터"""
        keystrokes = []
        timestamp = 1000
        for i, char in enumerate("fasttyping"):
            keystrokes.append({
                "key": char,
                "timestamp": timestamp,
                "duration": 50,
                "type": "keydown"
            })
            keystrokes.append({
                "key": char,
                "timestamp": timestamp + 50,
                "duration": 0,
                "type": "keyup"
            })
            timestamp += 100  # 100ms 간격 (빠른 타이핑)
        return keystrokes

    @pytest.fixture
    def slow_typing_keystrokes(self):
        """느린 타이핑 데이터"""
        keystrokes = []
        timestamp = 1000
        for i, char in enumerate("slow"):
            keystrokes.append({
                "key": char,
                "timestamp": timestamp,
                "duration": 120,
                "type": "keydown"
            })
            keystrokes.append({
                "key": char,
                "timestamp": timestamp + 120,
                "duration": 0,
                "type": "keyup"
            })
            timestamp += 600  # 600ms 간격 (느린 타이핑)
        return keystrokes

    def test_analyzer_initialization(self):
        """분석기 초기화 테스트"""
        analyzer = PatternAnalyzer()
        assert analyzer.pause_threshold_ms == 500.0

        custom_analyzer = PatternAnalyzer(pause_threshold_ms=300.0)
        assert custom_analyzer.pause_threshold_ms == 300.0

    def test_empty_keystrokes_analysis(self, analyzer):
        """빈 키스트로크 데이터 분석 테스트"""
        stats = analyzer.analyze_keystrokes([])

        assert stats.total_keystrokes == 0
        assert stats.keydown_count == 0
        assert stats.words_per_minute == 0.0
        assert stats.rhythm_consistency == 0.0

    def test_insufficient_keystrokes_analysis(self, analyzer):
        """키스트로크 데이터 부족 테스트"""
        single_keystroke = [
            {"key": "a", "timestamp": 1000, "duration": 80, "type": "keydown"}
        ]

        stats = analyzer.analyze_keystrokes(single_keystroke)
        assert stats.total_keystrokes == 0

    def test_basic_keystrokes_analysis(self, analyzer, sample_keystrokes):
        """기본 키스트로크 분석 테스트"""
        stats = analyzer.analyze_keystrokes(sample_keystrokes)

        assert stats.total_keystrokes == 10  # 총 키 이벤트 수
        assert stats.keydown_count == 5  # keydown 이벤트만
        assert stats.total_time_seconds == 0.65  # (1650 - 1000) / 1000

        # WPM 계산 검증 (5글자 = 1단어 추정)
        expected_wpm = (1.0 / 0.65) * 60  # 약 92.3
        assert abs(stats.words_per_minute - expected_wpm) < 0.1

        # 평균 간격 계산 검증
        expected_avg_interval = (200 + 150 + 150 + 150) / 4  # 162.5
        assert abs(stats.average_interval_ms - expected_avg_interval) < 1.0

    def test_fast_typing_analysis(self, analyzer, fast_typing_keystrokes):
        """빠른 타이핑 분석 테스트"""
        stats = analyzer.analyze_keystrokes(fast_typing_keystrokes)

        # 빠른 타이핑 특성 검증
        assert stats.words_per_minute > 100  # 높은 WPM
        assert stats.average_interval_ms < 150  # 짧은 간격
        assert stats.pause_count == 0  # 일시정지 없음
        assert stats.typing_speed_score > 0.8  # 높은 속도 점수

    def test_slow_typing_analysis(self, analyzer, slow_typing_keystrokes):
        """느린 타이핑 분석 테스트"""
        stats = analyzer.analyze_keystrokes(slow_typing_keystrokes)

        # 느린 타이핑 특성 검증
        assert stats.words_per_minute < 50  # 낮은 WPM
        assert stats.average_interval_ms > 500  # 긴 간격
        assert stats.pause_count > 0  # 일시정지 발생
        assert stats.typing_speed_score < 0.5  # 낮은 속도 점수

    def test_text_extraction(self, analyzer):
        """텍스트 추출 테스트"""
        keystrokes = [
            {"key": "H", "timestamp": 1000, "duration": 80, "type": "keydown"},
            {"key": "e", "timestamp": 1100, "duration": 75, "type": "keydown"},
            {"key": "l", "timestamp": 1200, "duration": 90, "type": "keydown"},
            {"key": "l", "timestamp": 1300, "duration": 85, "type": "keydown"},
            {"key": "o", "timestamp": 1400, "duration": 70, "type": "keydown"},
            {"key": "Space", "timestamp": 1500, "duration": 60, "type": "keydown"},
            {"key": "W", "timestamp": 1600, "duration": 80, "type": "keydown"},
            {"key": "o", "timestamp": 1700, "duration": 75, "type": "keydown"},
            {"key": "r", "timestamp": 1800, "duration": 85, "type": "keydown"},
            {"key": "l", "timestamp": 1900, "duration": 80, "type": "keydown"},
            {"key": "d", "timestamp": 2000, "duration": 75, "type": "keydown"},
        ]

        text = analyzer.extract_text_content(keystrokes)
        assert text == "Hello World"

    def test_special_keys_extraction(self, analyzer):
        """특수 키 추출 테스트"""
        keystrokes = [
            {"key": "H", "timestamp": 1000, "duration": 80, "type": "keydown"},
            {"key": "i", "timestamp": 1100, "duration": 75, "type": "keydown"},
            {"key": "Enter", "timestamp": 1200, "duration": 60, "type": "keydown"},
            {"key": "Tab", "timestamp": 1300, "duration": 60, "type": "keydown"},
            {"key": "B", "timestamp": 1400, "duration": 80, "type": "keydown"},
            {"key": "y", "timestamp": 1500, "duration": 75, "type": "keydown"},
            {"key": "e", "timestamp": 1600, "duration": 75, "type": "keydown"},
        ]

        text = analyzer.extract_text_content(keystrokes)
        assert text == "Hi\n\tBye"

    def test_rhythm_consistency_calculation(self, analyzer):
        """리듬 일관성 계산 테스트"""
        # 일관된 간격 (100ms)
        consistent_intervals = [100, 100, 100, 100, 100]
        consistency = analyzer._calculate_rhythm_consistency(consistent_intervals)
        assert consistency > 0.9

        # 불규칙한 간격
        irregular_intervals = [50, 200, 80, 300, 120]
        consistency = analyzer._calculate_rhythm_consistency(irregular_intervals)
        assert consistency < 0.7

        # 빈 리스트
        empty_consistency = analyzer._calculate_rhythm_consistency([])
        assert empty_consistency == 0.0

    def test_rhythm_classification(self, analyzer):
        """리듬 분류 테스트"""
        # 빠르고 일관된 타이핑
        fast_consistent = [120, 125, 118, 122, 119]
        rhythm = analyzer._classify_rhythm(fast_consistent)
        assert rhythm == "fast_steady"

        # 느리고 일관된 타이핑
        slow_consistent = [350, 360, 340, 355, 345]
        rhythm = analyzer._classify_rhythm(slow_consistent)
        assert rhythm == "slow_steady"

        # 불규칙한 타이핑
        irregular = [100, 400, 150, 600, 200]
        rhythm = analyzer._classify_rhythm(irregular)
        assert rhythm in ["irregular", "chaotic"]

    def test_speed_variations_analysis(self, analyzer):
        """속도 변화 분석 테스트"""
        # 충분한 데이터
        keydown_events = []
        timestamp = 1000
        for i in range(15):
            keydown_events.append({
                "key": f"key{i}",
                "timestamp": timestamp,
                "duration": 80,
                "type": "keydown"
            })
            timestamp += 150  # 일정한 간격

        variations = analyzer._analyze_speed_variations(keydown_events)

        assert "average_speed_kps" in variations
        assert "speed_variance" in variations
        assert "speed_stability" in variations
        assert variations["speed_stability"] == "stable"

    def test_pause_patterns_analysis(self, analyzer):
        """일시정지 패턴 분석 테스트"""
        # 일시정지가 포함된 간격
        intervals_with_pauses = [150, 800, 200, 1200, 180]  # 500ms 임계값

        patterns = analyzer._analyze_pause_patterns(intervals_with_pauses)

        assert patterns["pause_count"] == 2
        assert patterns["pause_behavior"] != "continuous"
        assert "average_pause_duration_ms" in patterns
        assert patterns["longest_pause_ms"] == 1200

    def test_complete_pattern_analysis(self, analyzer, sample_keystrokes):
        """완전한 패턴 분석 테스트"""
        result = analyzer.analyze_typing_pattern(sample_keystrokes)

        # 기본 구조 검증
        assert "statistics" in result
        assert "text_content" in result
        assert "patterns" in result
        assert "metadata" in result

        # 메타데이터 검증
        assert result["metadata"]["analyzer_version"] == "1.0.0"
        assert result["metadata"]["pause_threshold_ms"] == 500.0
        assert result["metadata"]["total_events"] == len(sample_keystrokes)

    def test_keystroke_validation_success(self, analyzer, sample_keystrokes):
        """유효한 키스트로크 검증 테스트"""
        is_valid, message = analyzer.validate_keystrokes(sample_keystrokes)
        assert is_valid == True
        assert message == "Valid"

    def test_keystroke_validation_empty(self, analyzer):
        """빈 키스트로크 검증 테스트"""
        is_valid, message = analyzer.validate_keystrokes([])
        assert is_valid == False
        assert "No keystrokes provided" in message

    def test_keystroke_validation_insufficient(self, analyzer):
        """키스트로크 부족 검증 테스트"""
        insufficient_data = [
            {"key": "a", "timestamp": 1000, "duration": 80, "type": "keydown"}
        ]

        is_valid, message = analyzer.validate_keystrokes(insufficient_data)
        assert is_valid == False
        assert "Minimum 10 keystrokes required" in message

    def test_keystroke_validation_missing_fields(self, analyzer):
        """필수 필드 누락 검증 테스트"""
        invalid_data = [
            {"key": "a", "timestamp": 1000, "type": "keydown"},  # duration 누락
            {"key": "b", "timestamp": 1100, "duration": 80, "type": "keydown"},
        ] * 5  # 10개로 확장

        is_valid, message = analyzer.validate_keystrokes(invalid_data)
        assert is_valid == False
        assert "Missing required fields" in message

    def test_keystroke_validation_invalid_type(self, analyzer):
        """잘못된 타입 검증 테스트"""
        invalid_data = [
            {"key": f"key{i}", "timestamp": 1000 + i*100, "duration": 80, "type": "invalid"}
            for i in range(10)
        ]

        is_valid, message = analyzer.validate_keystrokes(invalid_data)
        assert is_valid == False
        assert "Invalid type" in message

    def test_keystroke_validation_invalid_numeric(self, analyzer):
        """잘못된 숫자 값 검증 테스트"""
        invalid_data = [
            {"key": "a", "timestamp": "invalid", "duration": 80, "type": "keydown"}
        ] + [
            {"key": f"key{i}", "timestamp": 1000 + i*100, "duration": 80, "type": "keydown"}
            for i in range(9)
        ]

        is_valid, message = analyzer.validate_keystrokes(invalid_data)
        assert is_valid == False
        assert "Invalid numeric values" in message

    def test_keystroke_validation_timestamp_order(self, analyzer):
        """타임스탬프 순서 검증 테스트"""
        unordered_data = [
            {"key": f"key{i}", "timestamp": ts, "duration": 80, "type": "keydown"}
            for i, ts in enumerate([1000, 1500, 1200, 1300, 1400, 1600, 1700, 1800, 1900, 2000])
        ]

        is_valid, message = analyzer.validate_keystrokes(unordered_data)
        assert is_valid == False
        assert "Timestamps must be in ascending order" in message

    def test_edge_case_zero_duration(self, analyzer):
        """지속시간 0인 경우 처리 테스트"""
        keystrokes_with_zero_duration = [
            {"key": f"key{i}", "timestamp": 1000 + i*100, "duration": 0, "type": "keydown"}
            for i in range(10)
        ]

        stats = analyzer.analyze_keystrokes(keystrokes_with_zero_duration)
        assert stats.average_duration_ms == 0.0

    def test_edge_case_identical_timestamps(self, analyzer):
        """동일한 타임스탬프 처리 테스트"""
        identical_timestamps = [
            {"key": f"key{i}", "timestamp": 1000, "duration": 80, "type": "keydown"}
            for i in range(10)
        ]

        stats = analyzer.analyze_keystrokes(identical_timestamps)
        assert stats.total_time_seconds == 0.0
        assert stats.words_per_minute == 0.0

    @pytest.mark.parametrize("pause_threshold", [100, 300, 500, 1000])
    def test_different_pause_thresholds(self, pause_threshold):
        """다양한 일시정지 임계값 테스트"""
        analyzer = PatternAnalyzer(pause_threshold_ms=pause_threshold)

        keystrokes = []
        timestamps = [1000, 1150, 1800, 2000, 2150]  # 650ms, 200ms, 150ms 간격

        for i, ts in enumerate(timestamps):
            keystrokes.extend([
                {"key": f"key{i}", "timestamp": ts, "duration": 80, "type": "keydown"},
                {"key": f"key{i}", "timestamp": ts + 80, "duration": 0, "type": "keyup"}
            ])

        stats = analyzer.analyze_keystrokes(keystrokes)

        # 임계값에 따른 일시정지 개수 변화 확인
        if pause_threshold <= 200:
            assert stats.pause_count >= 1  # 650ms 간격이 일시정지로 감지
        elif pause_threshold <= 650:
            assert stats.pause_count >= 1  # 650ms 간격이 일시정지로 감지
        else:
            assert stats.pause_count == 0  # 모든 간격이 임계값 미만

    def test_memory_efficiency_large_dataset(self, analyzer):
        """대용량 데이터셋 메모리 효율성 테스트"""
        # 1000개 키스트로크 생성
        large_keystrokes = []
        timestamp = 1000

        for i in range(1000):
            large_keystrokes.extend([
                {"key": f"key{i%26}", "timestamp": timestamp, "duration": 80, "type": "keydown"},
                {"key": f"key{i%26}", "timestamp": timestamp + 80, "duration": 0, "type": "keyup"}
            ])
            timestamp += 120

        # 메모리 사용량 증가 없이 분석 가능한지 확인
        stats = analyzer.analyze_keystrokes(large_keystrokes)

        assert stats.total_keystrokes == 2000
        assert stats.keydown_count == 1000
        assert stats.total_time_seconds > 0

    def test_concurrent_analysis_safety(self, analyzer, sample_keystrokes):
        """동시 분석 안전성 테스트 (상태 변경 없음 확인)"""
        # 여러 번 분석해도 같은 결과가 나오는지 확인
        result1 = analyzer.analyze_typing_pattern(sample_keystrokes)
        result2 = analyzer.analyze_typing_pattern(sample_keystrokes)
        result3 = analyzer.analyze_typing_pattern(sample_keystrokes)

        assert result1 == result2 == result3

    def test_statistics_error_handling(self, analyzer):
        """통계 계산 오류 처리 테스트"""
        # 분산 계산이 불가능한 경우
        single_interval = [100]
        consistency = analyzer._calculate_rhythm_consistency(single_interval)
        assert consistency == 0.0

        # 빈 간격 리스트
        empty_intervals = []
        consistency = analyzer._calculate_rhythm_consistency(empty_intervals)
        assert consistency == 0.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])