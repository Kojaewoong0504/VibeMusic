"""
WebSocketService - 실시간 WebSocket 연결 및 통신 관리 서비스

이 서비스는 클라이언트와의 WebSocket 연결을 관리하고 실시간 타이핑 데이터를 처리합니다.
"""
import json
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any, Set
from enum import Enum

from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.session_service import SessionService


class MessageType(str, Enum):
    """WebSocket 메시지 타입 정의"""
    TYPING_DATA = "typing_data"
    EMOTION_UPDATE = "emotion_update"
    MUSIC_STATUS = "music_status"
    ERROR = "error"
    PING = "ping"
    PONG = "pong"


class ConnectionInfo:
    """WebSocket 연결 정보"""

    def __init__(self, websocket: WebSocket, session_id: str, connection_id: str):
        self.websocket = websocket
        self.session_id = session_id
        self.connection_id = connection_id
        self.connected_at = datetime.utcnow()
        self.last_activity = datetime.utcnow()
        self.is_active = True


class WebSocketService:
    """실시간 WebSocket 연결 및 통신 관리 서비스"""

    def __init__(self, db_session: Optional[AsyncSession] = None):
        """
        WebSocket 서비스 초기화

        Args:
            db_session: 데이터베이스 세션 (의존성 주입용)
        """
        self.db_session = db_session
        self.session_service = SessionService(db_session)

        # 연결 관리
        self.connections: Dict[str, ConnectionInfo] = {}  # connection_id -> ConnectionInfo
        self.session_connections: Dict[str, Set[str]] = {}  # session_id -> set of connection_ids

        # 타이핑 데이터 임시 버퍼
        self.typing_buffers: Dict[str, List[Dict[str, Any]]] = {}  # session_id -> typing data list

    async def connect_client(
        self,
        websocket: WebSocket,
        session_id: str,
        session_token: Optional[str] = None
    ) -> str:
        """
        새로운 클라이언트 WebSocket 연결 등록

        Args:
            websocket: FastAPI WebSocket 객체
            session_id: 사용자 세션 ID
            session_token: 세션 토큰 (인증용)

        Returns:
            생성된 연결 ID

        Raises:
            ValueError: 유효하지 않은 세션
            RuntimeError: 연결 실패
        """
        # 세션 유효성 검증
        if session_token:
            session = await self.session_service.validate_session(session_token)
            if not session or session.id != session_id:
                raise ValueError(f"Invalid session or token for session_id: {session_id}")
        else:
            session = await self.session_service.get_session_by_id(session_id)
            if not session:
                raise ValueError(f"Session not found: {session_id}")

        # WebSocket 연결 수락
        await websocket.accept()

        # 연결 정보 생성
        connection_id = str(uuid.uuid4())
        connection_info = ConnectionInfo(websocket, session_id, connection_id)

        # 연결 등록
        self.connections[connection_id] = connection_info

        if session_id not in self.session_connections:
            self.session_connections[session_id] = set()
        self.session_connections[session_id].add(connection_id)

        # 타이핑 버퍼 초기화
        if session_id not in self.typing_buffers:
            self.typing_buffers[session_id] = []

        # 연결 성공 메시지 전송
        await self.send_message(connection_id, {
            "type": MessageType.PING,
            "message": "Connected successfully",
            "connection_id": connection_id,
            "timestamp": datetime.utcnow().isoformat()
        })

        return connection_id

    async def disconnect_client(self, connection_id: str) -> bool:
        """
        클라이언트 연결 해제

        Args:
            connection_id: 연결 ID

        Returns:
            연결 해제 성공 여부
        """
        if connection_id not in self.connections:
            return False

        connection_info = self.connections[connection_id]
        session_id = connection_info.session_id

        # 연결 정보 제거
        del self.connections[connection_id]

        # 세션별 연결 목록에서 제거
        if session_id in self.session_connections:
            self.session_connections[session_id].discard(connection_id)

            # 세션에 연결된 클라이언트가 없으면 세션 정보도 정리
            if not self.session_connections[session_id]:
                del self.session_connections[session_id]
                if session_id in self.typing_buffers:
                    del self.typing_buffers[session_id]

        return True

    async def send_message(
        self,
        connection_id: str,
        message: Dict[str, Any]
    ) -> bool:
        """
        특정 연결에 메시지 전송

        Args:
            connection_id: 대상 연결 ID
            message: 전송할 메시지

        Returns:
            전송 성공 여부
        """
        if connection_id not in self.connections:
            return False

        connection_info = self.connections[connection_id]

        try:
            await connection_info.websocket.send_text(json.dumps(message))
            connection_info.last_activity = datetime.utcnow()
            return True
        except Exception:
            # 연결이 끊어진 경우 자동 정리
            await self.disconnect_client(connection_id)
            return False

    async def broadcast_to_session(
        self,
        session_id: str,
        message: Dict[str, Any],
        exclude_connection: Optional[str] = None
    ) -> int:
        """
        세션 내 모든 클라이언트에게 메시지 브로드캐스트

        Args:
            session_id: 대상 세션 ID
            message: 전송할 메시지
            exclude_connection: 제외할 연결 ID

        Returns:
            성공적으로 전송된 클라이언트 수
        """
        if session_id not in self.session_connections:
            return 0

        sent_count = 0
        connection_ids = list(self.session_connections[session_id])

        for connection_id in connection_ids:
            if exclude_connection and connection_id == exclude_connection:
                continue

            success = await self.send_message(connection_id, message)
            if success:
                sent_count += 1

        return sent_count

    async def handle_typing_data(
        self,
        connection_id: str,
        typing_data: Dict[str, Any]
    ) -> bool:
        """
        실시간 타이핑 데이터 처리

        Args:
            connection_id: 데이터를 보낸 연결 ID
            typing_data: 타이핑 데이터

        Returns:
            처리 성공 여부
        """
        if connection_id not in self.connections:
            return False

        connection_info = self.connections[connection_id]
        session_id = connection_info.session_id

        # 타이핑 데이터 검증
        required_fields = ['key', 'timestamp', 'type']
        if not all(field in typing_data for field in required_fields):
            await self.send_message(connection_id, {
                "type": MessageType.ERROR,
                "message": "Invalid typing data format",
                "required_fields": required_fields
            })
            return False

        # 타이핑 데이터를 버퍼에 추가
        self.typing_buffers[session_id].append(typing_data)

        # 다른 클라이언트들에게 타이핑 상태 브로드캐스트
        await self.broadcast_to_session(session_id, {
            "type": MessageType.TYPING_DATA,
            "data": typing_data,
            "session_id": session_id
        }, exclude_connection=connection_id)

        # 활동 시간 업데이트
        connection_info.last_activity = datetime.utcnow()

        return True

    async def send_emotion_update(
        self,
        session_id: str,
        emotion_data: Dict[str, Any]
    ) -> int:
        """
        감정 분석 결과를 세션의 모든 클라이언트에게 전송

        Args:
            session_id: 대상 세션 ID
            emotion_data: 감정 분석 결과

        Returns:
            전송된 클라이언트 수
        """
        message = {
            "type": MessageType.EMOTION_UPDATE,
            "data": emotion_data,
            "timestamp": datetime.utcnow().isoformat()
        }

        return await self.broadcast_to_session(session_id, message)

    async def send_music_status_update(
        self,
        session_id: str,
        status: str,
        music_data: Optional[Dict[str, Any]] = None
    ) -> int:
        """
        음악 생성 상태 업데이트를 세션의 모든 클라이언트에게 전송

        Args:
            session_id: 대상 세션 ID
            status: 음악 생성 상태 (generating, completed, failed)
            music_data: 음악 데이터 (완료시)

        Returns:
            전송된 클라이언트 수
        """
        message = {
            "type": MessageType.MUSIC_STATUS,
            "status": status,
            "data": music_data,
            "timestamp": datetime.utcnow().isoformat()
        }

        return await self.broadcast_to_session(session_id, message)

    async def get_session_connections(self, session_id: str) -> List[Dict[str, Any]]:
        """
        세션의 활성 연결 목록 조회

        Args:
            session_id: 세션 ID

        Returns:
            연결 정보 리스트
        """
        if session_id not in self.session_connections:
            return []

        connections = []
        for connection_id in self.session_connections[session_id]:
            if connection_id in self.connections:
                connection_info = self.connections[connection_id]
                connections.append({
                    "connection_id": connection_id,
                    "session_id": session_id,
                    "connected_at": connection_info.connected_at.isoformat(),
                    "last_activity": connection_info.last_activity.isoformat(),
                    "is_active": connection_info.is_active
                })

        return connections

    async def get_typing_buffer(self, session_id: str) -> List[Dict[str, Any]]:
        """
        세션의 타이핑 데이터 버퍼 조회

        Args:
            session_id: 세션 ID

        Returns:
            타이핑 데이터 리스트
        """
        return self.typing_buffers.get(session_id, [])

    async def clear_typing_buffer(self, session_id: str) -> bool:
        """
        세션의 타이핑 데이터 버퍼 초기화

        Args:
            session_id: 세션 ID

        Returns:
            초기화 성공 여부
        """
        if session_id in self.typing_buffers:
            self.typing_buffers[session_id] = []
            return True
        return False

    async def is_session_connected(self, session_id: str) -> bool:
        """
        세션에 활성 연결이 있는지 확인

        Args:
            session_id: 세션 ID

        Returns:
            연결 상태 여부
        """
        return session_id in self.session_connections and len(self.session_connections[session_id]) > 0

    async def get_connection_count(self) -> Dict[str, int]:
        """
        전체 연결 통계 조회

        Returns:
            연결 통계 딕셔너리
        """
        total_connections = len(self.connections)
        active_sessions = len(self.session_connections)

        return {
            "total_connections": total_connections,
            "active_sessions": active_sessions,
            "average_connections_per_session": (
                total_connections / active_sessions if active_sessions > 0 else 0
            )
        }

    async def cleanup_inactive_connections(self, timeout_minutes: int = 60) -> int:
        """
        비활성 연결 정리

        Args:
            timeout_minutes: 타임아웃 시간 (분)

        Returns:
            정리된 연결 수
        """
        current_time = datetime.utcnow()
        cleaned_count = 0

        # 비활성 연결 찾기
        inactive_connections = []
        for connection_id, connection_info in self.connections.items():
            time_diff = current_time - connection_info.last_activity
            if time_diff.total_seconds() > (timeout_minutes * 60):
                inactive_connections.append(connection_id)

        # 비활성 연결 제거
        for connection_id in inactive_connections:
            success = await self.disconnect_client(connection_id)
            if success:
                cleaned_count += 1

        return cleaned_count

    async def handle_websocket_disconnect(self, connection_id: str) -> None:
        """
        WebSocket 연결 해제 처리 (예외 발생시 사용)

        Args:
            connection_id: 연결 ID
        """
        await self.disconnect_client(connection_id)

    def get_service_status(self) -> Dict[str, Any]:
        """
        WebSocket 서비스 상태 정보 반환

        Returns:
            서비스 상태 딕셔너리
        """
        return {
            "service_name": "WebSocketService",
            "version": "1.0.0",
            "active_connections": len(self.connections),
            "active_sessions": len(self.session_connections),
            "buffer_sessions": len(self.typing_buffers),
            "status": "healthy" if len(self.connections) >= 0 else "error"
        }