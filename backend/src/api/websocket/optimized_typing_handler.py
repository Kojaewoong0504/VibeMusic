"""
Optimized WebSocket Typing Handler

T092: 타이핑 패턴 실시간 처리 성능 튜닝
- 50ms 미만 메시지 처리 목표
- 백프레셔 및 플로우 컨트롤
- 배치 처리와 압축으로 대역폭 최적화
- 연결별 QoS 관리
"""
import asyncio
import time
import json
import gzip
from typing import Dict, Any, Optional, List, Set
from dataclasses import dataclass
from collections import defaultdict, deque
from weakref import WeakSet

from fastapi import WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from src.services.optimized_pattern_processor import OptimizedPatternProcessor
from src.cache.optimized_cache_strategies import OptimizedCacheManager


class TypingEventMessage(BaseModel):
    """타이핑 이벤트 메시지 스키마"""
    type: str = Field(..., description="메시지 타입 (typing_event)")
    session_id: str = Field(..., description="세션 ID")
    event: Dict[str, Any] = Field(..., description="타이핑 이벤트 데이터")
    timestamp: float = Field(default_factory=time.time)
    sequence: Optional[int] = Field(None, description="시퀀스 번호")


class PatternUpdateMessage(BaseModel):
    """패턴 업데이트 메시지 스키마"""
    type: str = "pattern_update"
    session_id: str
    pattern: Dict[str, Any]
    confidence: float
    timestamp: float = Field(default_factory=time.time)


@dataclass
class ConnectionMetrics:
    """연결별 성능 메트릭"""
    messages_received: int = 0
    messages_sent: int = 0
    bytes_received: int = 0
    bytes_sent: int = 0
    avg_latency_ms: float = 0.0
    max_latency_ms: float = 0.0
    connection_start: float = 0.0
    last_activity: float = 0.0
    error_count: int = 0

    def update_latency(self, latency_ms: float) -> None:
        """레이턴시 메트릭 업데이트"""
        if self.messages_received == 0:
            self.avg_latency_ms = latency_ms
        else:
            # 지수 이동 평균
            alpha = 0.1
            self.avg_latency_ms = (
                (1 - alpha) * self.avg_latency_ms + alpha * latency_ms
            )

        if latency_ms > self.max_latency_ms:
            self.max_latency_ms = latency_ms

        self.last_activity = time.time()


@dataclass
class QoSConfig:
    """서비스 품질 설정"""
    max_messages_per_second: int = 100
    max_buffer_size: int = 1000
    compression_threshold: int = 1024  # bytes
    batch_size: int = 10
    batch_timeout_ms: int = 50
    max_latency_ms: int = 50


class OptimizedTypingHandler:
    """최적화된 타이핑 WebSocket 핸들러"""

    def __init__(
        self,
        pattern_processor: OptimizedPatternProcessor,
        cache_manager: Optional[OptimizedCacheManager] = None
    ):
        """
        초기화

        Args:
            pattern_processor: 최적화된 패턴 프로세서
            cache_manager: 캐시 관리자
        """
        self.pattern_processor = pattern_processor
        self.cache_manager = cache_manager or OptimizedCacheManager()

        # 연결 관리
        self.active_connections: Dict[str, WebSocket] = {}
        self.connection_metrics: Dict[str, ConnectionMetrics] = {}
        self.session_connections: Dict[str, Set[str]] = defaultdict(set)

        # 메시지 버퍼링
        self.message_buffers: Dict[str, deque] = defaultdict(lambda: deque(maxlen=1000))
        self.batch_timers: Dict[str, asyncio.Handle] = {}

        # QoS 관리
        self.qos_config = QoSConfig()
        self.rate_limiters: Dict[str, deque] = defaultdict(lambda: deque(maxlen=100))

        # 성능 모니터링
        self.global_metrics = {
            "connections": 0,
            "messages_per_second": 0,
            "avg_processing_latency": 0.0,
            "bandwidth_usage": 0.0,
            "compression_ratio": 0.0
        }

        # 백그라운드 작업
        self.cleanup_task: Optional[asyncio.Task] = None
        self.metrics_task: Optional[asyncio.Task] = None

        print("🚀 OptimizedTypingHandler initialized")

    async def start_background_tasks(self) -> None:
        """백그라운드 작업 시작"""
        self.cleanup_task = asyncio.create_task(self._cleanup_loop())
        self.metrics_task = asyncio.create_task(self._metrics_loop())
        print("⚡ Background tasks started")

    async def stop_background_tasks(self) -> None:
        """백그라운드 작업 중지"""
        if self.cleanup_task:
            self.cleanup_task.cancel()
        if self.metrics_task:
            self.metrics_task.cancel()
        print("🛑 Background tasks stopped")

    async def handle_connection(
        self,
        websocket: WebSocket,
        connection_id: str,
        session_id: str
    ) -> None:
        """
        WebSocket 연결 처리

        Args:
            websocket: WebSocket 연결
            connection_id: 연결 고유 ID
            session_id: 사용자 세션 ID
        """
        await websocket.accept()

        # 연결 등록
        self.active_connections[connection_id] = websocket
        self.connection_metrics[connection_id] = ConnectionMetrics(
            connection_start=time.time()
        )
        self.session_connections[session_id].add(connection_id)

        print(f"🔗 WebSocket connected: {connection_id} (session: {session_id})")

        try:
            # 연결 상태 메시지 전송
            await self._send_message(
                connection_id,
                {
                    "type": "connection_established",
                    "connection_id": connection_id,
                    "session_id": session_id,
                    "qos_config": {
                        "max_rate": self.qos_config.max_messages_per_second,
                        "batch_size": self.qos_config.batch_size,
                        "compression_enabled": True
                    }
                }
            )

            # 메시지 처리 루프
            await self._message_loop(websocket, connection_id, session_id)

        except WebSocketDisconnect:
            print(f"🔌 WebSocket disconnected: {connection_id}")
        except Exception as e:
            print(f"❌ WebSocket error for {connection_id}: {e}")
            if connection_id in self.connection_metrics:
                self.connection_metrics[connection_id].error_count += 1
        finally:
            await self._cleanup_connection(connection_id, session_id)

    async def _message_loop(
        self,
        websocket: WebSocket,
        connection_id: str,
        session_id: str
    ) -> None:
        """메시지 처리 루프"""
        while True:
            try:
                # 메시지 수신 (타임아웃 적용)
                message_data = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=30.0  # 30초 타임아웃
                )

                processing_start = time.perf_counter()

                # 레이트 리미팅 체크
                if not await self._check_rate_limit(connection_id):
                    await self._send_error(connection_id, "rate_limit_exceeded")
                    continue

                # 메시지 파싱
                try:
                    message = json.loads(message_data)
                except json.JSONDecodeError:
                    await self._send_error(connection_id, "invalid_json")
                    continue

                # 메시지 검증
                if not self._validate_message(message):
                    await self._send_error(connection_id, "invalid_message")
                    continue

                # 메트릭 업데이트
                metrics = self.connection_metrics[connection_id]
                metrics.messages_received += 1
                metrics.bytes_received += len(message_data.encode('utf-8'))

                # 메시지 타입별 처리
                await self._process_message(
                    connection_id,
                    session_id,
                    message,
                    processing_start
                )

            except asyncio.TimeoutError:
                # 핑 메시지 전송 (연결 유지)
                await self._send_ping(connection_id)
            except WebSocketDisconnect:
                break
            except Exception as e:
                print(f"❌ Error processing message from {connection_id}: {e}")
                await self._send_error(connection_id, f"processing_error: {str(e)}")

    async def _process_message(
        self,
        connection_id: str,
        session_id: str,
        message: Dict[str, Any],
        start_time: float
    ) -> None:
        """메시지 처리"""
        message_type = message.get("type")

        if message_type == "typing_event":
            await self._process_typing_event(
                connection_id,
                session_id,
                message,
                start_time
            )
        elif message_type == "batch_typing_events":
            await self._process_batch_typing_events(
                connection_id,
                session_id,
                message,
                start_time
            )
        elif message_type == "get_pattern":
            await self._process_pattern_request(
                connection_id,
                session_id
            )
        elif message_type == "ping":
            await self._send_message(connection_id, {"type": "pong"})
        else:
            await self._send_error(connection_id, f"unknown_message_type: {message_type}")

    async def _process_typing_event(
        self,
        connection_id: str,
        session_id: str,
        message: Dict[str, Any],
        start_time: float
    ) -> None:
        """타이핑 이벤트 처리"""
        event_data = message.get("event", {})
        if not event_data:
            await self._send_error(connection_id, "missing_event_data")
            return

        # 패턴 프로세서로 처리
        result = await self.pattern_processor.process_typing_event(
            session_id,
            event_data
        )

        # 처리 결과 전송
        if result:
            await self._send_message(
                connection_id,
                {
                    "type": "event_processed",
                    "status": result.get("status"),
                    "latency_ms": result.get("latency_ms")
                }
            )

        # 레이턴시 메트릭 업데이트
        processing_latency = (time.perf_counter() - start_time) * 1000
        self.connection_metrics[connection_id].update_latency(processing_latency)

        # 목표 레이턴시 초과 시 경고
        if processing_latency > self.qos_config.max_latency_ms:
            print(f"⚠️ High latency: {processing_latency:.2f}ms (connection: {connection_id})")

    async def _process_batch_typing_events(
        self,
        connection_id: str,
        session_id: str,
        message: Dict[str, Any],
        start_time: float
    ) -> None:
        """배치 타이핑 이벤트 처리"""
        events = message.get("events", [])
        if not events:
            await self._send_error(connection_id, "missing_events_data")
            return

        processed_count = 0
        for event_data in events:
            try:
                result = await self.pattern_processor.process_typing_event(
                    session_id,
                    event_data
                )
                if result and result.get("status") == "queued":
                    processed_count += 1
            except Exception as e:
                print(f"❌ Error processing batch event: {e}")

        # 배치 처리 결과 전송
        processing_latency = (time.perf_counter() - start_time) * 1000
        await self._send_message(
            connection_id,
            {
                "type": "batch_processed",
                "processed_count": processed_count,
                "total_count": len(events),
                "latency_ms": round(processing_latency, 2)
            }
        )

    async def _process_pattern_request(
        self,
        connection_id: str,
        session_id: str
    ) -> None:
        """패턴 조회 요청 처리"""
        pattern = await self.pattern_processor.get_session_pattern(session_id)

        if pattern:
            await self._send_message(
                connection_id,
                {
                    "type": "pattern_data",
                    "session_id": session_id,
                    "pattern": pattern
                }
            )
        else:
            await self._send_message(
                connection_id,
                {
                    "type": "pattern_not_ready",
                    "session_id": session_id
                }
            )

    async def _send_message(
        self,
        connection_id: str,
        message: Dict[str, Any],
        compress: bool = False
    ) -> bool:
        """메시지 전송 (최적화)"""
        if connection_id not in self.active_connections:
            return False

        websocket = self.active_connections[connection_id]

        try:
            message_json = json.dumps(message, separators=(',', ':'))
            message_bytes = message_json.encode('utf-8')

            # 압축 적용 (임계값 초과 시)
            if compress or len(message_bytes) >= self.qos_config.compression_threshold:
                compressed_data = gzip.compress(message_bytes)
                if len(compressed_data) < len(message_bytes):
                    await websocket.send_bytes(compressed_data)
                    message_bytes = compressed_data
                else:
                    await websocket.send_text(message_json)
            else:
                await websocket.send_text(message_json)

            # 메트릭 업데이트
            if connection_id in self.connection_metrics:
                metrics = self.connection_metrics[connection_id]
                metrics.messages_sent += 1
                metrics.bytes_sent += len(message_bytes)

            return True

        except Exception as e:
            print(f"❌ Error sending message to {connection_id}: {e}")
            return False

    async def _send_error(
        self,
        connection_id: str,
        error_message: str
    ) -> None:
        """에러 메시지 전송"""
        await self._send_message(
            connection_id,
            {
                "type": "error",
                "error": error_message,
                "timestamp": time.time()
            }
        )

    async def _send_ping(self, connection_id: str) -> None:
        """핑 메시지 전송"""
        await self._send_message(
            connection_id,
            {
                "type": "ping",
                "timestamp": time.time()
            }
        )

    async def _check_rate_limit(self, connection_id: str) -> bool:
        """레이트 리미팅 체크"""
        now = time.time()
        rate_limiter = self.rate_limiters[connection_id]

        # 1초 이전 요청 제거
        while rate_limiter and now - rate_limiter[0] > 1.0:
            rate_limiter.popleft()

        # 현재 요청 추가
        rate_limiter.append(now)

        # 제한 체크
        return len(rate_limiter) <= self.qos_config.max_messages_per_second

    def _validate_message(self, message: Dict[str, Any]) -> bool:
        """메시지 유효성 검증"""
        if not isinstance(message, dict):
            return False

        if "type" not in message:
            return False

        message_type = message["type"]

        if message_type == "typing_event":
            return "event" in message and isinstance(message["event"], dict)
        elif message_type == "batch_typing_events":
            return "events" in message and isinstance(message["events"], list)
        elif message_type in ["get_pattern", "ping"]:
            return True

        return False

    async def _cleanup_connection(
        self,
        connection_id: str,
        session_id: str
    ) -> None:
        """연결 정리"""
        # 연결 제거
        self.active_connections.pop(connection_id, None)
        self.connection_metrics.pop(connection_id, None)
        self.message_buffers.pop(connection_id, None)
        self.rate_limiters.pop(connection_id, None)

        # 세션 연결에서 제거
        if session_id in self.session_connections:
            self.session_connections[session_id].discard(connection_id)
            if not self.session_connections[session_id]:
                del self.session_connections[session_id]

        # 배치 타이머 정리
        if connection_id in self.batch_timers:
            self.batch_timers[connection_id].cancel()
            del self.batch_timers[connection_id]

        print(f"🧹 Connection cleaned up: {connection_id}")

    async def _cleanup_loop(self) -> None:
        """정리 루프"""
        while True:
            try:
                await asyncio.sleep(30)  # 30초마다 실행

                now = time.time()
                inactive_connections = []

                # 비활성 연결 찾기
                for connection_id, metrics in self.connection_metrics.items():
                    if now - metrics.last_activity > 300:  # 5분 비활성
                        inactive_connections.append(connection_id)

                # 비활성 연결 정리
                for connection_id in inactive_connections:
                    if connection_id in self.active_connections:
                        try:
                            await self.active_connections[connection_id].close()
                        except Exception:
                            pass  # 이미 닫힌 연결일 수 있음

                if inactive_connections:
                    print(f"🗑️  Cleaned up {len(inactive_connections)} inactive connections")

            except Exception as e:
                print(f"❌ Error in cleanup loop: {e}")

    async def _metrics_loop(self) -> None:
        """메트릭 수집 루프"""
        while True:
            try:
                await asyncio.sleep(10)  # 10초마다 실행

                # 글로벌 메트릭 업데이트
                self.global_metrics["connections"] = len(self.active_connections)

                # 평균 레이턴시 계산
                latencies = [
                    metrics.avg_latency_ms
                    for metrics in self.connection_metrics.values()
                    if metrics.avg_latency_ms > 0
                ]

                if latencies:
                    self.global_metrics["avg_processing_latency"] = sum(latencies) / len(latencies)

                # 대역폭 사용량 계산 (bytes per second)
                total_bytes = sum(
                    metrics.bytes_sent + metrics.bytes_received
                    for metrics in self.connection_metrics.values()
                )
                self.global_metrics["bandwidth_usage"] = total_bytes / 10.0  # 10초 간격

            except Exception as e:
                print(f"❌ Error in metrics loop: {e}")

    def get_metrics(self) -> Dict[str, Any]:
        """전체 메트릭 조회"""
        return {
            "global": self.global_metrics.copy(),
            "pattern_processor": self.pattern_processor.get_metrics(),
            "connections": {
                conn_id: {
                    "messages_received": metrics.messages_received,
                    "messages_sent": metrics.messages_sent,
                    "avg_latency_ms": round(metrics.avg_latency_ms, 2),
                    "max_latency_ms": round(metrics.max_latency_ms, 2),
                    "error_count": metrics.error_count,
                    "uptime_seconds": round(time.time() - metrics.connection_start, 1)
                }
                for conn_id, metrics in self.connection_metrics.items()
            }
        }

    async def broadcast_pattern_update(
        self,
        session_id: str,
        pattern_data: Dict[str, Any]
    ) -> int:
        """세션의 모든 연결에 패턴 업데이트 브로드캐스트"""
        if session_id not in self.session_connections:
            return 0

        message = {
            "type": "pattern_update",
            "session_id": session_id,
            "pattern": pattern_data,
            "timestamp": time.time()
        }

        sent_count = 0
        for connection_id in list(self.session_connections[session_id]):
            if await self._send_message(connection_id, message, compress=True):
                sent_count += 1

        return sent_count