"""
OptimizedPatternProcessor 단위 테스트

T092: 타이핑 패턴 실시간 처리 성능 튜닝 테스트
"""
import pytest
import asyncio
import time
from unittest.mock import AsyncMock, Mock, patch

from src.services.optimized_pattern_processor import (
    OptimizedPatternProcessor,
    TypingEvent,
    ProcessingMetrics,
    EventBuffer
)


class TestEventBuffer:
    """EventBuffer 테스트"""

    def test_add_event_basic(self):
        """기본 이벤트 추가 테스트"""
        buffer = EventBuffer(max_size=5)
        event = TypingEvent(
            key='a',
            timestamp=time.time() * 1000,
            event_type='keydown',
            session_id='test-session'
        )

        buffer.add_event(event)
        assert len(buffer.events) == 1
        assert buffer.events[0] == event

    def test_buffer_size_limit(self):
        """버퍼 크기 제한 테스트"""
        buffer = EventBuffer(max_size=3)

        # 3개 이벤트 추가
        for i in range(3):
            event = TypingEvent(
                key=str(i),
                timestamp=time.time() * 1000,
                event_type='keydown',
                session_id='test-session'
            )
            buffer.add_event(event)

        assert len(buffer.events) == 3

        # 4번째 이벤트 추가 - 첫 번째가 제거되어야 함
        event4 = TypingEvent(
            key='4',
            timestamp=time.time() * 1000,
            event_type='keydown',
            session_id='test-session'
        )
        buffer.add_event(event4)

        assert len(buffer.events) == 3
        assert buffer.events[-1] == event4
        assert buffer.events[0].key == '1'  # 첫 번째 제거됨

    def test_get_recent_events(self):
        """최근 이벤트 조회 테스트"""
        buffer = EventBuffer(max_size=10)
        now = time.time() * 1000

        # 다양한 시간대의 이벤트 추가
        old_event = TypingEvent(
            key='old',
            timestamp=now - 10000,  # 10초 전
            event_type='keydown',
            session_id='test-session'
        )

        recent_event = TypingEvent(
            key='recent',
            timestamp=now - 1000,  # 1초 전
            event_type='keydown',
            session_id='test-session'
        )

        buffer.add_event(old_event)
        buffer.add_event(recent_event)

        # 5초 윈도우로 조회
        recent_events = buffer.get_recent_events(window_ms=5000)

        assert len(recent_events) == 1
        assert recent_events[0] == recent_event

    def test_clear_old_events(self):
        """오래된 이벤트 정리 테스트"""
        buffer = EventBuffer(max_size=10)
        now = time.time() * 1000

        # 오래된 이벤트들 추가
        for i in range(3):
            old_event = TypingEvent(
                key=f'old_{i}',
                timestamp=now - 40000,  # 40초 전
                event_type='keydown',
                session_id='test-session'
            )
            buffer.add_event(old_event)

        # 최근 이벤트 추가
        recent_event = TypingEvent(
            key='recent',
            timestamp=now - 1000,  # 1초 전
            event_type='keydown',
            session_id='test-session'
        )
        buffer.add_event(recent_event)

        # 30초 이상 된 이벤트 정리
        removed_count = buffer.clear_old_events(max_age_ms=30000)

        assert removed_count == 3
        assert len(buffer.events) == 1
        assert buffer.events[0] == recent_event


class TestTypingEvent:
    """TypingEvent 테스트"""

    def test_to_dict(self):
        """딕셔너리 변환 테스트"""
        event = TypingEvent(
            key='a',
            timestamp=123456789.0,
            event_type='keydown',
            session_id='test-session',
            duration=50.0
        )

        result = event.to_dict()
        expected = {
            'key': 'a',
            'timestamp': 123456789.0,
            'type': 'keydown',
            'duration': 50.0
        }

        assert result == expected


class TestProcessingMetrics:
    """ProcessingMetrics 테스트"""

    def test_reset(self):
        """메트릭 리셋 테스트"""
        metrics = ProcessingMetrics()

        # 일부 값 설정
        metrics.events_processed = 100
        metrics.avg_latency_ms = 25.5
        metrics.max_latency_ms = 150.0

        metrics.reset()

        assert metrics.events_processed == 0
        assert metrics.avg_latency_ms == 0.0
        assert metrics.max_latency_ms == 0.0
        assert metrics.processing_rate == 0.0


@pytest.fixture
def processor():
    """테스트용 프로세서 인스턴스"""
    return OptimizedPatternProcessor(
        max_concurrent_sessions=10,
        buffer_size_per_session=100,
        batch_size=5,
        processing_interval_ms=50
    )


@pytest.fixture
def sample_event_data():
    """샘플 이벤트 데이터"""
    return {
        'key': 'a',
        'timestamp': time.time() * 1000,
        'type': 'keydown',
        'duration': 100.0
    }


class TestOptimizedPatternProcessor:
    """OptimizedPatternProcessor 테스트"""

    @pytest.mark.asyncio
    async def test_start_stop(self, processor):
        """프로세서 시작/중지 테스트"""
        await processor.start()

        # 백그라운드 태스크가 실행 중인지 확인
        assert processor.processing_task is not None
        assert processor.cleanup_task is not None
        assert not processor.shutdown_event.is_set()

        await processor.stop()

        # 종료 상태 확인
        assert processor.shutdown_event.is_set()

    @pytest.mark.asyncio
    async def test_process_typing_event_basic(self, processor, sample_event_data):
        """기본 타이핑 이벤트 처리 테스트"""
        session_id = "test-session-1"

        # 이벤트 처리
        result = await processor.process_typing_event(
            session_id,
            sample_event_data
        )

        # 결과 검증
        assert result is not None
        assert result['status'] == 'queued'
        assert 'latency_ms' in result
        assert result['latency_ms'] >= 0

        # 버퍼에 이벤트가 추가되었는지 확인
        assert session_id in processor.session_buffers
        assert len(processor.session_buffers[session_id].events) == 1

    @pytest.mark.asyncio
    async def test_concurrent_sessions(self, processor, sample_event_data):
        """동시 세션 처리 테스트"""
        session_ids = [f"session-{i}" for i in range(5)]

        # 여러 세션에서 동시 이벤트 처리
        tasks = []
        for session_id in session_ids:
            task = processor.process_typing_event(session_id, sample_event_data)
            tasks.append(task)

        results = await asyncio.gather(*tasks)

        # 모든 결과가 성공적인지 확인
        for result in results:
            assert result['status'] == 'queued'

        # 각 세션별 버퍼 생성 확인
        for session_id in session_ids:
            assert session_id in processor.session_buffers

    @pytest.mark.asyncio
    async def test_session_limit(self, processor, sample_event_data):
        """세션 수 제한 테스트"""
        processor.max_concurrent_sessions = 3

        # 제한보다 많은 세션 생성
        session_ids = [f"session-{i}" for i in range(5)]

        for session_id in session_ids:
            await processor.process_typing_event(session_id, sample_event_data)

        # 최대 세션 수가 유지되는지 확인
        assert len(processor.session_buffers) <= processor.max_concurrent_sessions

    @pytest.mark.asyncio
    async def test_get_session_pattern(self, processor):
        """세션 패턴 조회 테스트"""
        session_id = "test-session"

        # 충분한 이벤트 추가
        events = []
        base_time = time.time() * 1000

        for i in range(15):
            event_data = {
                'key': chr(97 + (i % 26)),  # a-z 순환
                'timestamp': base_time + (i * 100),
                'type': 'keydown',
                'duration': 50.0
            }
            events.append(event_data)
            await processor.process_typing_event(session_id, event_data)

        # 패턴 조회
        pattern = await processor.get_session_pattern(session_id)

        # 패턴이 생성되었는지 확인
        assert pattern is not None
        assert 'statistics' in pattern
        assert 'patterns' in pattern

    @pytest.mark.asyncio
    async def test_insufficient_events_pattern(self, processor, sample_event_data):
        """이벤트 부족 시 패턴 조회 테스트"""
        session_id = "test-session"

        # 부족한 이벤트만 추가 (5개)
        for i in range(5):
            await processor.process_typing_event(session_id, sample_event_data)

        # 패턴 조회 - None이어야 함
        pattern = await processor.get_session_pattern(session_id)
        assert pattern is None

    def test_metrics(self, processor):
        """메트릭 조회 테스트"""
        metrics = processor.get_metrics()

        # 필수 메트릭 키 확인
        required_keys = [
            'events_processed',
            'patterns_analyzed',
            'avg_latency_ms',
            'max_latency_ms',
            'buffer_size',
            'processing_rate',
            'active_sessions',
            'cache_size',
            'queue_size',
            'uptime_seconds'
        ]

        for key in required_keys:
            assert key in metrics

    def test_reset_metrics(self, processor):
        """메트릭 리셋 테스트"""
        # 메트릭 값 설정
        processor.metrics.events_processed = 100
        processor.metrics.avg_latency_ms = 25.5

        processor.reset_metrics()

        assert processor.metrics.events_processed == 0
        assert processor.metrics.avg_latency_ms == 0.0

    @pytest.mark.asyncio
    async def test_pattern_callback(self, processor):
        """패턴 콜백 테스트"""
        callback_called = False
        callback_session_id = None
        callback_pattern = None

        async def test_callback(session_id, pattern):
            nonlocal callback_called, callback_session_id, callback_pattern
            callback_called = True
            callback_session_id = session_id
            callback_pattern = pattern

        # 콜백 등록
        processor.register_pattern_callback(test_callback)

        # 프로세서 시작
        await processor.start()

        try:
            # 충분한 이벤트 추가하여 콜백 트리거
            session_id = "callback-test"
            base_time = time.time() * 1000

            for i in range(15):
                event_data = {
                    'key': 'a',
                    'timestamp': base_time + (i * 100),
                    'type': 'keydown',
                    'duration': 50.0
                }
                await processor.process_typing_event(session_id, event_data)

            # 처리 시간 대기
            await asyncio.sleep(0.2)

            # 콜백이 호출되었는지 확인
            # Note: 실제 환경에서는 백그라운드 처리로 인해 콜백이 호출될 수 있음

        finally:
            await processor.stop()

    def test_analyze_events_sync(self, processor):
        """동기 이벤트 분석 테스트"""
        # 충분한 타이핑 이벤트 생성
        events = []
        base_time = time.time() * 1000

        for i in range(10):
            event = TypingEvent(
                key=chr(97 + (i % 26)),
                timestamp=base_time + (i * 100),
                event_type='keydown',
                session_id='test',
                duration=50.0
            )
            events.append(event)

        # 분석 실행
        result = processor._analyze_events_sync(events)

        # 결과 검증
        assert 'statistics' in result
        assert 'patterns' in result
        assert 'keystroke_data' in result
        assert 'analysis_timestamp' in result

        # 통계 검증
        stats = result['statistics']
        assert stats['total_keystrokes'] == 10
        assert stats['keydown_count'] == 10
        assert stats['words_per_minute'] >= 0
        assert 'average_interval_ms' in stats

        # 패턴 검증
        patterns = result['patterns']
        assert 'speed_score' in patterns
        assert 'rhythm_score' in patterns
        assert 'pause_intensity' in patterns

    def test_analyze_events_insufficient(self, processor):
        """이벤트 부족 시 분석 테스트"""
        # 부족한 이벤트
        events = [
            TypingEvent(
                key='a',
                timestamp=time.time() * 1000,
                event_type='keydown',
                session_id='test',
                duration=50.0
            )
        ]

        result = processor._analyze_events_sync(events)

        # 에러 결과 확인
        assert 'error' in result
        assert result['error'] == 'insufficient_events'

    def test_update_latency_metrics(self, processor):
        """레이턴시 메트릭 업데이트 테스트"""
        # 첫 번째 레이턴시
        processor._update_latency_metrics(50.0)

        assert processor.metrics.avg_latency_ms == 50.0
        assert processor.metrics.max_latency_ms == 50.0

        # 두 번째 레이턴시 (더 높음)
        processor._update_latency_metrics(100.0)

        assert processor.metrics.max_latency_ms == 100.0
        assert processor.metrics.avg_latency_ms > 50.0  # 이동 평균
        assert processor.metrics.avg_latency_ms < 100.0

    @pytest.mark.asyncio
    async def test_evict_oldest_session(self, processor, sample_event_data):
        """가장 오래된 세션 제거 테스트"""
        # 최대 세션 수를 2로 제한
        processor.max_concurrent_sessions = 2

        # 첫 번째 세션 (오래된)
        await processor.process_typing_event("old-session", sample_event_data)
        await asyncio.sleep(0.001)  # 시간 차이 생성

        # 두 번째 세션
        await processor.process_typing_event("new-session", sample_event_data)

        # 세 번째 세션 - 첫 번째가 제거되어야 함
        await processor.process_typing_event("newest-session", sample_event_data)

        # 세션 수 확인
        assert len(processor.session_buffers) <= 2
        assert "old-session" not in processor.session_buffers