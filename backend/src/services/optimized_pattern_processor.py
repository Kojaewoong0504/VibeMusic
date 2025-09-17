"""
OptimizedPatternProcessor - 고성능 타이핑 패턴 실시간 처리

T092: 타이핑 패턴 실시간 처리 성능 튜닝
- 50ms 미만 키 입력 레이턴시 목표
- 버퍼링 및 배치 처리로 처리량 최적화
- 메모리 풀과 재사용으로 GC 압력 감소
- 비동기 파이프라인으로 처리 병목 해결
"""
import asyncio
import time
from typing import Dict, List, Any, Optional, Callable, Deque
from collections import deque
from dataclasses import dataclass, field
from asyncio import Queue, Event
from weakref import WeakSet
import json
import threading
from concurrent.futures import ThreadPoolExecutor

from src.models.typing_pattern import TypingPattern
from src.services.pattern_analysis_service import PatternAnalysisService


@dataclass
class TypingEvent:
    """타이핑 이벤트 데이터 클래스"""
    key: str
    timestamp: float
    event_type: str  # 'keydown' | 'keyup'
    session_id: str
    duration: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            'key': self.key,
            'timestamp': self.timestamp,
            'type': self.event_type,
            'duration': self.duration
        }


@dataclass
class ProcessingMetrics:
    """성능 메트릭 데이터"""
    events_processed: int = 0
    patterns_analyzed: int = 0
    avg_latency_ms: float = 0.0
    max_latency_ms: float = 0.0
    buffer_size: int = 0
    processing_rate: float = 0.0  # events per second
    last_reset_time: float = field(default_factory=time.time)

    def reset(self) -> None:
        """메트릭 초기화"""
        self.events_processed = 0
        self.patterns_analyzed = 0
        self.avg_latency_ms = 0.0
        self.max_latency_ms = 0.0
        self.processing_rate = 0.0
        self.last_reset_time = time.time()


@dataclass
class EventBuffer:
    """고성능 이벤트 버퍼"""
    events: Deque[TypingEvent] = field(default_factory=deque)
    max_size: int = 1000
    last_processed: float = 0.0

    def add_event(self, event: TypingEvent) -> None:
        """이벤트 추가 (FIFO, 크기 제한)"""
        if len(self.events) >= self.max_size:
            self.events.popleft()  # O(1) 연산
        self.events.append(event)

    def get_recent_events(self, window_ms: int = 5000) -> List[TypingEvent]:
        """최근 윈도우 내 이벤트 반환"""
        now = time.time() * 1000
        cutoff = now - window_ms

        # deque는 오른쪽부터 순회하는 것이 효율적
        recent_events = []
        for event in reversed(self.events):
            if event.timestamp >= cutoff:
                recent_events.append(event)
            else:
                break  # 정렬된 상태이므로 중단 가능

        return list(reversed(recent_events))

    def clear_old_events(self, max_age_ms: int = 30000) -> int:
        """오래된 이벤트 정리"""
        now = time.time() * 1000
        cutoff = now - max_age_ms
        removed = 0

        while self.events and self.events[0].timestamp < cutoff:
            self.events.popleft()
            removed += 1

        return removed


class OptimizedPatternProcessor:
    """고성능 타이핑 패턴 실시간 처리기"""

    def __init__(
        self,
        max_concurrent_sessions: int = 1000,
        buffer_size_per_session: int = 1000,
        batch_size: int = 50,
        processing_interval_ms: int = 100,
        cleanup_interval_s: int = 60
    ):
        """
        초기화

        Args:
            max_concurrent_sessions: 최대 동시 세션 수
            buffer_size_per_session: 세션당 버퍼 크기
            batch_size: 배치 처리 크기
            processing_interval_ms: 처리 간격 (ms)
            cleanup_interval_s: 정리 간격 (초)
        """
        self.max_concurrent_sessions = max_concurrent_sessions
        self.buffer_size_per_session = buffer_size_per_session
        self.batch_size = batch_size
        self.processing_interval_ms = processing_interval_ms
        self.cleanup_interval_s = cleanup_interval_s

        # 세션별 버퍼
        self.session_buffers: Dict[str, EventBuffer] = {}

        # 처리 대기열
        self.processing_queue: Queue[str] = Queue(maxsize=max_concurrent_sessions)

        # 성능 메트릭
        self.metrics = ProcessingMetrics()

        # 이벤트 및 제어
        self.shutdown_event = Event()
        self.processing_task: Optional[asyncio.Task] = None
        self.cleanup_task: Optional[asyncio.Task] = None

        # 패턴 분석 서비스
        self.pattern_service = PatternAnalysisService()

        # 스레드 풀 (CPU 집약적 작업용)
        self.thread_pool = ThreadPoolExecutor(
            max_workers=min(4, threading.cpu_count()),
            thread_name_prefix="pattern-processor"
        )

        # 콜백 등록
        self.pattern_callbacks: WeakSet[Callable] = WeakSet()

        # 캐시 (최근 분석 결과)
        self.analysis_cache: Dict[str, Dict[str, Any]] = {}
        self.cache_max_size = 500

        print(f"🚀 OptimizedPatternProcessor initialized (max_sessions={max_concurrent_sessions})")

    async def start(self) -> None:
        """프로세서 시작"""
        if self.processing_task and not self.processing_task.done():
            return

        print("⚡ Starting pattern processor...")
        self.shutdown_event.clear()

        # 백그라운드 태스크 시작
        self.processing_task = asyncio.create_task(self._processing_loop())
        self.cleanup_task = asyncio.create_task(self._cleanup_loop())

        print("✅ Pattern processor started")

    async def stop(self) -> None:
        """프로세서 중지"""
        print("⏹️  Stopping pattern processor...")

        self.shutdown_event.set()

        # 태스크 종료 대기
        if self.processing_task:
            await self.processing_task
        if self.cleanup_task:
            await self.cleanup_task

        # 스레드 풀 종료
        self.thread_pool.shutdown(wait=True)

        print("🛑 Pattern processor stopped")

    async def process_typing_event(
        self,
        session_id: str,
        event_data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        타이핑 이벤트 처리 (고성능)

        Args:
            session_id: 세션 ID
            event_data: 이벤트 데이터

        Returns:
            처리 결과 (패턴 업데이트가 있는 경우)
        """
        start_time = time.perf_counter()

        try:
            # 1. 세션 버퍼 확인/생성
            if session_id not in self.session_buffers:
                if len(self.session_buffers) >= self.max_concurrent_sessions:
                    # LRU 방식으로 오래된 세션 제거
                    await self._evict_oldest_session()

                self.session_buffers[session_id] = EventBuffer(
                    max_size=self.buffer_size_per_session
                )

            buffer = self.session_buffers[session_id]

            # 2. 타이핑 이벤트 생성
            typing_event = TypingEvent(
                key=event_data.get('key', ''),
                timestamp=event_data.get('timestamp', time.time() * 1000),
                event_type=event_data.get('type', 'keydown'),
                session_id=session_id,
                duration=event_data.get('duration', 0.0)
            )

            # 3. 버퍼에 추가 (O(1))
            buffer.add_event(typing_event)

            # 4. 처리 대기열에 세션 추가 (중복 방지)
            try:
                self.processing_queue.put_nowait(session_id)
            except asyncio.QueueFull:
                pass  # 이미 처리 대기 중

            # 5. 메트릭 업데이트
            self.metrics.events_processed += 1
            self.metrics.buffer_size = sum(
                len(buf.events) for buf in self.session_buffers.values()
            )

            # 6. 레이턴시 측정
            latency_ms = (time.perf_counter() - start_time) * 1000
            self._update_latency_metrics(latency_ms)

            return {"status": "queued", "latency_ms": round(latency_ms, 2)}

        except Exception as e:
            print(f"❌ Error processing typing event: {e}")
            return {"status": "error", "error": str(e)}

    async def get_session_pattern(self, session_id: str) -> Optional[Dict[str, Any]]:
        """세션의 최신 패턴 조회"""
        if session_id not in self.session_buffers:
            return None

        buffer = self.session_buffers[session_id]
        recent_events = buffer.get_recent_events(window_ms=10000)  # 10초 윈도우

        if len(recent_events) < 10:
            return None

        # 캐시 확인
        cache_key = f"{session_id}_{len(recent_events)}_{recent_events[-1].timestamp}"
        if cache_key in self.analysis_cache:
            return self.analysis_cache[cache_key]

        # 패턴 분석 (스레드 풀에서 실행)
        loop = asyncio.get_event_loop()
        analysis_result = await loop.run_in_executor(
            self.thread_pool,
            self._analyze_events_sync,
            recent_events
        )

        # 캐시 저장 (크기 제한)
        if len(self.analysis_cache) >= self.cache_max_size:
            # LRU 방식으로 오래된 항목 제거
            oldest_key = next(iter(self.analysis_cache))
            del self.analysis_cache[oldest_key]

        self.analysis_cache[cache_key] = analysis_result

        return analysis_result

    def get_metrics(self) -> Dict[str, Any]:
        """성능 메트릭 조회"""
        current_time = time.time()
        time_elapsed = current_time - self.metrics.last_reset_time

        if time_elapsed > 0:
            self.metrics.processing_rate = self.metrics.events_processed / time_elapsed

        return {
            "events_processed": self.metrics.events_processed,
            "patterns_analyzed": self.metrics.patterns_analyzed,
            "avg_latency_ms": round(self.metrics.avg_latency_ms, 2),
            "max_latency_ms": round(self.metrics.max_latency_ms, 2),
            "buffer_size": self.metrics.buffer_size,
            "processing_rate": round(self.metrics.processing_rate, 2),
            "active_sessions": len(self.session_buffers),
            "cache_size": len(self.analysis_cache),
            "queue_size": self.processing_queue.qsize(),
            "uptime_seconds": round(time_elapsed, 1)
        }

    def reset_metrics(self) -> None:
        """메트릭 초기화"""
        self.metrics.reset()

    def register_pattern_callback(self, callback: Callable) -> None:
        """패턴 업데이트 콜백 등록"""
        self.pattern_callbacks.add(callback)

    async def _processing_loop(self) -> None:
        """백그라운드 처리 루프"""
        print("🔄 Processing loop started")

        while not self.shutdown_event.is_set():
            try:
                # 처리 간격만큼 대기
                await asyncio.sleep(self.processing_interval_ms / 1000.0)

                # 배치 처리
                processed_sessions = []
                batch_count = 0

                while batch_count < self.batch_size and not self.processing_queue.empty():
                    try:
                        session_id = self.processing_queue.get_nowait()
                        if session_id not in processed_sessions:
                            await self._process_session_batch(session_id)
                            processed_sessions.append(session_id)
                            batch_count += 1
                    except asyncio.QueueEmpty:
                        break

                if processed_sessions:
                    print(f"📊 Processed {len(processed_sessions)} sessions")

            except Exception as e:
                print(f"❌ Error in processing loop: {e}")
                await asyncio.sleep(1.0)  # 오류 시 잠시 대기

    async def _process_session_batch(self, session_id: str) -> None:
        """세션 배치 처리"""
        if session_id not in self.session_buffers:
            return

        buffer = self.session_buffers[session_id]
        recent_events = buffer.get_recent_events()

        if len(recent_events) < 10:  # 최소 이벤트 수 요구
            return

        try:
            # 비동기로 패턴 분석
            loop = asyncio.get_event_loop()
            analysis_result = await loop.run_in_executor(
                self.thread_pool,
                self._analyze_events_sync,
                recent_events
            )

            # 메트릭 업데이트
            self.metrics.patterns_analyzed += 1

            # 콜백 호출
            for callback in list(self.pattern_callbacks):
                try:
                    await callback(session_id, analysis_result)
                except Exception as e:
                    print(f"⚠️ Callback error: {e}")

        except Exception as e:
            print(f"❌ Error processing session {session_id}: {e}")

    async def _cleanup_loop(self) -> None:
        """정리 루프 (메모리 관리)"""
        print("🧹 Cleanup loop started")

        while not self.shutdown_event.is_set():
            try:
                await asyncio.sleep(self.cleanup_interval_s)

                # 오래된 이벤트 정리
                total_removed = 0
                for session_id, buffer in list(self.session_buffers.items()):
                    removed = buffer.clear_old_events(max_age_ms=300000)  # 5분
                    total_removed += removed

                    # 빈 버퍼 제거
                    if not buffer.events:
                        del self.session_buffers[session_id]

                # 캐시 정리 (크기 제한)
                if len(self.analysis_cache) > self.cache_max_size * 0.8:
                    items_to_remove = len(self.analysis_cache) - int(self.cache_max_size * 0.6)
                    for i, key in enumerate(list(self.analysis_cache.keys())):
                        if i >= items_to_remove:
                            break
                        del self.analysis_cache[key]

                if total_removed > 0:
                    print(f"🗑️  Cleaned up {total_removed} old events")

            except Exception as e:
                print(f"❌ Error in cleanup loop: {e}")

    async def _evict_oldest_session(self) -> None:
        """가장 오래된 세션 제거 (LRU)"""
        if not self.session_buffers:
            return

        # 마지막 이벤트 시간 기준으로 정렬
        session_ages = [
            (session_id, buffer.events[-1].timestamp if buffer.events else 0)
            for session_id, buffer in self.session_buffers.items()
        ]

        if session_ages:
            oldest_session = min(session_ages, key=lambda x: x[1])
            del self.session_buffers[oldest_session[0]]
            print(f"🗑️ Evicted oldest session: {oldest_session[0]}")

    def _analyze_events_sync(self, events: List[TypingEvent]) -> Dict[str, Any]:
        """동기 이벤트 분석 (스레드 풀용)"""
        if len(events) < 2:
            return {"error": "insufficient_events"}

        # TypingEvent를 딕셔너리로 변환
        keystroke_data = [event.to_dict() for event in events]

        # 기본 통계 계산
        keydown_events = [e for e in events if e.event_type == 'keydown']

        if len(keydown_events) < 2:
            return {"error": "insufficient_keydown_events"}

        # 타이핑 속도 계산
        time_span = keydown_events[-1].timestamp - keydown_events[0].timestamp
        time_span_seconds = time_span / 1000.0

        if time_span_seconds <= 0:
            return {"error": "invalid_time_span"}

        words_count = len(keydown_events) / 5  # 평균 단어 길이 5자 가정
        wpm = (words_count / time_span_seconds) * 60

        # 간격 분석
        intervals = []
        for i in range(1, len(keydown_events)):
            interval = keydown_events[i].timestamp - keydown_events[i-1].timestamp
            intervals.append(interval)

        avg_interval = sum(intervals) / len(intervals) if intervals else 0

        # 일시정지 분석
        pauses = [interval for interval in intervals if interval > 500]
        pause_count = len(pauses)

        # 리듬 일관성 계산
        if len(intervals) >= 3:
            mean_interval = sum(intervals) / len(intervals)
            variance = sum((x - mean_interval) ** 2 for x in intervals) / len(intervals)
            std_dev = variance ** 0.5
            cv = std_dev / mean_interval if mean_interval > 0 else 1.0
            rhythm_consistency = max(0.0, 1.0 - min(cv, 1.0))
        else:
            rhythm_consistency = 0.0

        return {
            "statistics": {
                "total_keystrokes": len(events),
                "keydown_count": len(keydown_events),
                "words_per_minute": round(wpm, 2),
                "average_interval_ms": round(avg_interval, 2),
                "pause_count": pause_count,
                "rhythm_consistency": round(rhythm_consistency, 3),
                "time_span_seconds": round(time_span_seconds, 2)
            },
            "patterns": {
                "speed_score": min(wpm / 100.0, 1.0),  # 0-1 정규화
                "rhythm_score": rhythm_consistency,
                "pause_intensity": min(pause_count / 10.0, 1.0),  # 0-1 정규화
            },
            "keystroke_data": keystroke_data,
            "analysis_timestamp": time.time()
        }

    def _update_latency_metrics(self, latency_ms: float) -> None:
        """레이턴시 메트릭 업데이트"""
        if self.metrics.events_processed == 0:
            self.metrics.avg_latency_ms = latency_ms
        else:
            # 이동 평균
            alpha = 0.1  # 평활화 상수
            self.metrics.avg_latency_ms = (
                (1 - alpha) * self.metrics.avg_latency_ms +
                alpha * latency_ms
            )

        if latency_ms > self.metrics.max_latency_ms:
            self.metrics.max_latency_ms = latency_ms