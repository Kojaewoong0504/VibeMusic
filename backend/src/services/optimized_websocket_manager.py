"""
최적화된 WebSocket 연결 풀 및 메모리 관리

고성능 실시간 통신을 위한 연결 풀, 메모리 관리, 백프레셔 제어
"""
import asyncio
import weakref
import logging
from typing import Dict, List, Optional, Set, Any, Callable, TypeVar
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict, deque
import psutil
import gc

from fastapi import WebSocket, WebSocketDisconnect
from fastapi.websockets import WebSocketState

from ..utils.logging import get_logger

logger = get_logger(__name__)

T = TypeVar('T')


class ConnectionState(str, Enum):
    """연결 상태"""
    CONNECTING = "connecting"
    CONNECTED = "connected"
    ACTIVE = "active"
    IDLE = "idle"
    CLOSING = "closing"
    CLOSED = "closed"
    ERROR = "error"


class MessagePriority(int, Enum):
    """메시지 우선순위"""
    CRITICAL = 1
    HIGH = 2
    NORMAL = 3
    LOW = 4


@dataclass
class ConnectionMetrics:
    """연결 메트릭"""
    connected_at: datetime = field(default_factory=datetime.utcnow)
    last_activity: datetime = field(default_factory=datetime.utcnow)
    messages_sent: int = 0
    messages_received: int = 0
    bytes_sent: int = 0
    bytes_received: int = 0
    errors: int = 0
    ping_count: int = 0
    avg_latency_ms: float = 0.0

    def update_activity(self):
        """활동 시간 업데이트"""
        self.last_activity = datetime.utcnow()

    def add_message_sent(self, size: int):
        """전송 메시지 통계 업데이트"""
        self.messages_sent += 1
        self.bytes_sent += size
        self.update_activity()

    def add_message_received(self, size: int):
        """수신 메시지 통계 업데이트"""
        self.messages_received += 1
        self.bytes_received += size
        self.update_activity()

    def add_error(self):
        """에러 수 증가"""
        self.errors += 1

    def get_idle_time(self) -> float:
        """유휴 시간 계산 (초)"""
        return (datetime.utcnow() - self.last_activity).total_seconds()


@dataclass
class QueuedMessage:
    """큐 메시지"""
    data: Any
    priority: MessagePriority = MessagePriority.NORMAL
    timestamp: datetime = field(default_factory=datetime.utcnow)
    retry_count: int = 0
    max_retries: int = 3

    def should_retry(self) -> bool:
        """재시도 가능 여부"""
        return self.retry_count < self.max_retries

    def increment_retry(self):
        """재시도 횟수 증가"""
        self.retry_count += 1


class OptimizedConnection:
    """최적화된 WebSocket 연결 래퍼"""

    def __init__(
        self,
        websocket: WebSocket,
        connection_id: str,
        session_id: str,
        max_queue_size: int = 1000,
        max_idle_time: int = 300  # 5분
    ):
        self.websocket = websocket
        self.connection_id = connection_id
        self.session_id = session_id
        self.state = ConnectionState.CONNECTING
        self.metrics = ConnectionMetrics()

        # 메시지 큐 및 제한
        self.max_queue_size = max_queue_size
        self.max_idle_time = max_idle_time
        self.message_queue: deque[QueuedMessage] = deque(maxlen=max_queue_size)
        self.send_lock = asyncio.Lock()

        # 백프레셔 제어
        self.pending_sends = 0
        self.max_pending_sends = 10
        self.throttle_enabled = False

        # 리소스 관리
        self._cleanup_callbacks: List[Callable] = []

    async def send_message(self, data: Any, priority: MessagePriority = MessagePriority.NORMAL) -> bool:
        """메시지 전송 (큐 기반)"""
        if self.state not in [ConnectionState.CONNECTED, ConnectionState.ACTIVE]:
            return False

        # 백프레셔 체크
        if self.pending_sends >= self.max_pending_sends:
            logger.warning(f"연결 {self.connection_id} 백프레셔 활성화")
            self.throttle_enabled = True
            return False

        # 큐 크기 체크
        if len(self.message_queue) >= self.max_queue_size:
            # 낮은 우선순위 메시지 제거
            self._evict_low_priority_messages()

        message = QueuedMessage(data, priority)
        self.message_queue.append(message)

        # 즉시 전송 시도
        return await self._process_queue()

    async def _process_queue(self) -> bool:
        """메시지 큐 처리"""
        if not self.message_queue or self.pending_sends >= self.max_pending_sends:
            return False

        async with self.send_lock:
            if self.websocket.client_state != WebSocketState.CONNECTED:
                self.state = ConnectionState.ERROR
                return False

            message = self.message_queue.popleft()
            try:
                self.pending_sends += 1
                serialized_data = self._serialize_message(message.data)

                await self.websocket.send_text(serialized_data)

                self.metrics.add_message_sent(len(serialized_data))
                self.state = ConnectionState.ACTIVE
                return True

            except Exception as e:
                logger.error(f"메시지 전송 실패 {self.connection_id}: {e}")
                self.metrics.add_error()

                # 재시도 로직
                if message.should_retry():
                    message.increment_retry()
                    self.message_queue.appendleft(message)

                self.state = ConnectionState.ERROR
                return False

            finally:
                self.pending_sends = max(0, self.pending_sends - 1)
                if self.pending_sends < self.max_pending_sends // 2:
                    self.throttle_enabled = False

    def _evict_low_priority_messages(self):
        """낮은 우선순위 메시지 제거"""
        # 우선순위가 낮은 메시지부터 제거
        eviction_count = min(10, len(self.message_queue) // 4)
        temp_queue = deque()

        for _ in range(len(self.message_queue)):
            if eviction_count > 0:
                msg = self.message_queue.popleft()
                if msg.priority >= MessagePriority.NORMAL:
                    eviction_count -= 1
                    continue  # 제거
                else:
                    temp_queue.append(msg)
            else:
                temp_queue.append(self.message_queue.popleft())

        self.message_queue = temp_queue
        logger.debug(f"연결 {self.connection_id} 메시지 {eviction_count}개 제거")

    def _serialize_message(self, data: Any) -> str:
        """메시지 직렬화"""
        import json
        return json.dumps(data, ensure_ascii=False)

    async def receive_message(self) -> Optional[Any]:
        """메시지 수신"""
        try:
            if self.websocket.client_state != WebSocketState.CONNECTED:
                return None

            raw_data = await self.websocket.receive_text()
            self.metrics.add_message_received(len(raw_data))
            self.state = ConnectionState.ACTIVE

            return self._deserialize_message(raw_data)

        except WebSocketDisconnect:
            self.state = ConnectionState.CLOSED
            return None
        except Exception as e:
            logger.error(f"메시지 수신 실패 {self.connection_id}: {e}")
            self.metrics.add_error()
            self.state = ConnectionState.ERROR
            return None

    def _deserialize_message(self, data: str) -> Any:
        """메시지 역직렬화"""
        import json
        return json.loads(data)

    async def ping(self) -> bool:
        """핑 전송"""
        ping_data = {
            "type": "ping",
            "timestamp": datetime.utcnow().isoformat(),
            "connection_id": self.connection_id
        }
        success = await self.send_message(ping_data, MessagePriority.HIGH)
        if success:
            self.metrics.ping_count += 1
        return success

    def is_idle(self) -> bool:
        """유휴 상태 확인"""
        return self.metrics.get_idle_time() > self.max_idle_time

    def add_cleanup_callback(self, callback: Callable):
        """정리 콜백 추가"""
        self._cleanup_callbacks.append(callback)

    async def close(self):
        """연결 종료 및 정리"""
        self.state = ConnectionState.CLOSING

        try:
            if self.websocket.client_state == WebSocketState.CONNECTED:
                await self.websocket.close()
        except Exception as e:
            logger.error(f"연결 종료 실패 {self.connection_id}: {e}")

        # 정리 콜백 실행
        for callback in self._cleanup_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback()
                else:
                    callback()
            except Exception as e:
                logger.error(f"정리 콜백 실패: {e}")

        self.state = ConnectionState.CLOSED


class WebSocketConnectionPool:
    """WebSocket 연결 풀 관리자"""

    def __init__(
        self,
        max_connections: int = 10000,
        cleanup_interval: int = 60,
        memory_threshold: float = 0.8  # 80% 메모리 사용률
    ):
        self.max_connections = max_connections
        self.cleanup_interval = cleanup_interval
        self.memory_threshold = memory_threshold

        # 연결 저장소
        self.connections: Dict[str, OptimizedConnection] = {}
        self.session_connections: Dict[str, Set[str]] = defaultdict(set)

        # 성능 모니터링
        self.total_connections = 0
        self.peak_connections = 0
        self.total_messages_sent = 0
        self.total_messages_received = 0

        # 백그라운드 작업
        self._cleanup_task: Optional[asyncio.Task] = None
        self._monitoring_task: Optional[asyncio.Task] = None
        self._shutdown_event = asyncio.Event()

        # 약한 참조 사용 (메모리 누수 방지)
        self._weak_refs: Set[weakref.ref] = set()

    async def start(self):
        """풀 시작"""
        logger.info("WebSocket 연결 풀 시작")
        self._cleanup_task = asyncio.create_task(self._cleanup_worker())
        self._monitoring_task = asyncio.create_task(self._monitoring_worker())

    async def stop(self):
        """풀 종료"""
        logger.info("WebSocket 연결 풀 종료 중...")
        self._shutdown_event.set()

        # 모든 연결 종료
        tasks = []
        for connection in list(self.connections.values()):
            tasks.append(asyncio.create_task(connection.close()))

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

        # 백그라운드 작업 종료
        if self._cleanup_task:
            self._cleanup_task.cancel()
        if self._monitoring_task:
            self._monitoring_task.cancel()

        self.connections.clear()
        self.session_connections.clear()

    async def add_connection(
        self,
        websocket: WebSocket,
        connection_id: str,
        session_id: str
    ) -> OptimizedConnection:
        """연결 추가"""
        # 연결 수 제한 체크
        if len(self.connections) >= self.max_connections:
            await self._enforce_connection_limit()

        connection = OptimizedConnection(websocket, connection_id, session_id)

        # 정리 콜백 등록
        cleanup_callback = lambda: self._remove_connection_references(connection_id, session_id)
        connection.add_cleanup_callback(cleanup_callback)

        # 연결 등록
        self.connections[connection_id] = connection
        self.session_connections[session_id].add(connection_id)

        # 약한 참조 등록
        weak_ref = weakref.ref(connection, self._weak_ref_callback)
        self._weak_refs.add(weak_ref)

        # 통계 업데이트
        self.total_connections += 1
        self.peak_connections = max(self.peak_connections, len(self.connections))

        connection.state = ConnectionState.CONNECTED
        logger.debug(f"연결 추가: {connection_id} (세션: {session_id})")

        return connection

    def _remove_connection_references(self, connection_id: str, session_id: str):
        """연결 참조 제거"""
        self.connections.pop(connection_id, None)
        if session_id in self.session_connections:
            self.session_connections[session_id].discard(connection_id)
            if not self.session_connections[session_id]:
                del self.session_connections[session_id]

    def _weak_ref_callback(self, ref: weakref.ref):
        """약한 참조 콜백 (가비지 컬렉션 시 호출)"""
        self._weak_refs.discard(ref)

    async def remove_connection(self, connection_id: str) -> bool:
        """연결 제거"""
        connection = self.connections.get(connection_id)
        if not connection:
            return False

        await connection.close()
        return True

    def get_connection(self, connection_id: str) -> Optional[OptimizedConnection]:
        """연결 조회"""
        return self.connections.get(connection_id)

    def get_session_connections(self, session_id: str) -> List[OptimizedConnection]:
        """세션별 연결 목록"""
        connection_ids = self.session_connections.get(session_id, set())
        return [
            self.connections[cid] for cid in connection_ids
            if cid in self.connections
        ]

    async def broadcast_to_session(
        self,
        session_id: str,
        data: Any,
        priority: MessagePriority = MessagePriority.NORMAL
    ) -> int:
        """세션에 속한 모든 연결에 브로드캐스트"""
        connections = self.get_session_connections(session_id)
        if not connections:
            return 0

        tasks = []
        for connection in connections:
            if connection.state in [ConnectionState.CONNECTED, ConnectionState.ACTIVE]:
                tasks.append(connection.send_message(data, priority))

        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            return sum(1 for result in results if result is True)

        return 0

    async def _cleanup_worker(self):
        """정리 작업 워커"""
        while not self._shutdown_event.is_set():
            try:
                await self._cleanup_idle_connections()
                await self._cleanup_closed_connections()
                await self._check_memory_usage()

                await asyncio.sleep(self.cleanup_interval)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"정리 작업 오류: {e}")
                await asyncio.sleep(5)

    async def _cleanup_idle_connections(self):
        """유휴 연결 정리"""
        idle_connections = [
            conn for conn in self.connections.values()
            if conn.is_idle() and conn.state != ConnectionState.CLOSED
        ]

        if idle_connections:
            logger.info(f"유휴 연결 {len(idle_connections)}개 정리 중")
            for connection in idle_connections:
                await connection.close()

    async def _cleanup_closed_connections(self):
        """종료된 연결 정리"""
        closed_connection_ids = [
            cid for cid, conn in self.connections.items()
            if conn.state == ConnectionState.CLOSED or
               conn.websocket.client_state != WebSocketState.CONNECTED
        ]

        for connection_id in closed_connection_ids:
            connection = self.connections.get(connection_id)
            if connection:
                self._remove_connection_references(connection_id, connection.session_id)

        if closed_connection_ids:
            logger.debug(f"종료된 연결 {len(closed_connection_ids)}개 정리")

    async def _check_memory_usage(self):
        """메모리 사용량 확인"""
        memory_percent = psutil.virtual_memory().percent / 100.0

        if memory_percent > self.memory_threshold:
            logger.warning(f"메모리 사용률 높음: {memory_percent:.1%}")

            # 강제 가비지 컬렉션
            gc.collect()

            # 추가 정리가 필요한 경우 가장 오래된 연결부터 종료
            if memory_percent > 0.9:  # 90% 이상
                await self._emergency_cleanup()

    async def _emergency_cleanup(self):
        """응급 메모리 정리"""
        # 오래된 연결부터 정리 (25% 정도)
        cleanup_count = max(1, len(self.connections) // 4)

        sorted_connections = sorted(
            self.connections.values(),
            key=lambda conn: conn.metrics.last_activity
        )

        logger.warning(f"응급 메모리 정리: {cleanup_count}개 연결 종료")

        for connection in sorted_connections[:cleanup_count]:
            await connection.close()

    async def _enforce_connection_limit(self):
        """연결 수 제한 강제"""
        if len(self.connections) < self.max_connections:
            return

        # 가장 오래된 연결 종료
        oldest_connection = min(
            self.connections.values(),
            key=lambda conn: conn.metrics.connected_at
        )

        logger.info(f"연결 제한 초과, 가장 오래된 연결 종료: {oldest_connection.connection_id}")
        await oldest_connection.close()

    async def _monitoring_worker(self):
        """모니터링 워커"""
        while not self._shutdown_event.is_set():
            try:
                stats = self.get_pool_statistics()

                # 주요 메트릭 로깅 (필요시)
                if len(self.connections) > 0:
                    logger.debug(
                        f"연결 풀 상태 - 활성: {stats['active_connections']}, "
                        f"유휴: {stats['idle_connections']}, "
                        f"메모리: {stats['memory_usage_percent']:.1f}%"
                    )

                await asyncio.sleep(30)  # 30초마다 모니터링

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"모니터링 오류: {e}")
                await asyncio.sleep(10)

    def get_pool_statistics(self) -> Dict[str, Any]:
        """풀 통계 조회"""
        active_connections = sum(
            1 for conn in self.connections.values()
            if conn.state == ConnectionState.ACTIVE
        )

        idle_connections = sum(
            1 for conn in self.connections.values()
            if conn.is_idle()
        )

        total_messages = sum(
            conn.metrics.messages_sent + conn.metrics.messages_received
            for conn in self.connections.values()
        )

        memory_info = psutil.virtual_memory()

        return {
            'total_connections': len(self.connections),
            'active_connections': active_connections,
            'idle_connections': idle_connections,
            'peak_connections': self.peak_connections,
            'total_messages_processed': total_messages,
            'memory_usage_percent': memory_info.percent,
            'memory_available_mb': memory_info.available // 1024 // 1024,
            'sessions_count': len(self.session_connections),
            'average_queue_size': sum(
                len(conn.message_queue) for conn in self.connections.values()
            ) / len(self.connections) if self.connections else 0
        }


# 글로벌 연결 풀 인스턴스
_global_connection_pool: Optional[WebSocketConnectionPool] = None


def get_connection_pool() -> WebSocketConnectionPool:
    """글로벌 연결 풀 반환"""
    global _global_connection_pool
    if _global_connection_pool is None:
        _global_connection_pool = WebSocketConnectionPool()
    return _global_connection_pool


async def init_connection_pool(**kwargs) -> WebSocketConnectionPool:
    """연결 풀 초기화"""
    global _global_connection_pool
    _global_connection_pool = WebSocketConnectionPool(**kwargs)
    await _global_connection_pool.start()
    return _global_connection_pool


async def shutdown_connection_pool():
    """연결 풀 종료"""
    global _global_connection_pool
    if _global_connection_pool:
        await _global_connection_pool.stop()
        _global_connection_pool = None