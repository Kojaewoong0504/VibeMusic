"""
VibeMusic WebSocket API

감정 기반 AI 음악 생성 서비스의 실시간 WebSocket 엔드포인트
- 실시간 타이핑 데이터 수신
- 세션 기반 연결 관리
- 감정 분석 결과 실시간 전송
- 음악 생성 상태 업데이트
"""

import json
import logging
from datetime import datetime
from typing import Dict, Set, Optional, Any
import asyncio
from uuid import uuid4

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from fastapi.websockets import WebSocketState
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.connection import get_async_session
from src.cache import get_redis, CacheService
from src.services.realtime_processor import RealtimeProcessor
from src.models.user_session import UserSession
from src.config import settings

logger = logging.getLogger(__name__)

# ============================================================================
# WebSocket Connection Manager
# ============================================================================

class ConnectionManager:
    """
    WebSocket 연결 관리자
    세션별 연결 추적, 메시지 브로드캐스트, 연결 상태 관리
    """

    def __init__(self):
        # 활성 연결: session_id -> WebSocket
        self.active_connections: Dict[str, WebSocket] = {}
        # 연결 메타데이터: session_id -> 연결 정보
        self.connection_metadata: Dict[str, Dict[str, Any]] = {}
        # 연결별 세션 ID: connection_id -> session_id
        self.connection_sessions: Dict[str, str] = {}

    async def connect(self, websocket: WebSocket, session_id: str) -> bool:
        """WebSocket 연결 수립"""
        try:
            await websocket.accept()

            # 기존 연결이 있으면 종료
            if session_id in self.active_connections:
                await self.disconnect(session_id, "새 연결로 교체됨")

            # 연결 정보 저장
            connection_id = str(uuid4())
            self.active_connections[session_id] = websocket
            self.connection_sessions[connection_id] = session_id
            self.connection_metadata[session_id] = {
                'connection_id': connection_id,
                'connected_at': datetime.utcnow(),
                'last_activity': datetime.utcnow(),
                'client_info': websocket.headers,
                'message_count': 0
            }

            logger.info("WebSocket 연결 수립: session_id=%s, connection_id=%s",
                       session_id, connection_id)
            return True

        except Exception as e:
            logger.error("WebSocket 연결 실패: session_id=%s, error=%s", session_id, str(e))
            return False

    async def disconnect(self, session_id: str, reason: str = "정상 종료") -> None:
        """WebSocket 연결 종료"""
        try:
            if session_id in self.active_connections:
                websocket = self.active_connections[session_id]

                # WebSocket 연결이 열려있으면 종료 메시지 전송
                if websocket.client_state == WebSocketState.CONNECTED:
                    await websocket.close(code=1000, reason=reason)

                # 연결 정보 정리
                connection_id = self.connection_metadata.get(session_id, {}).get('connection_id')
                if connection_id:
                    self.connection_sessions.pop(connection_id, None)

                self.active_connections.pop(session_id, None)
                self.connection_metadata.pop(session_id, None)

                logger.info("WebSocket 연결 종료: session_id=%s, reason=%s", session_id, reason)

        except Exception as e:
            logger.error("WebSocket 연결 종료 중 오류: session_id=%s, error=%s", session_id, str(e))

    async def send_personal_message(self, session_id: str, message: Dict[str, Any]) -> bool:
        """특정 세션에 메시지 전송"""
        try:
            if session_id not in self.active_connections:
                logger.warning("활성 연결을 찾을 수 없음: session_id=%s", session_id)
                return False

            websocket = self.active_connections[session_id]

            # 연결 상태 확인
            if websocket.client_state != WebSocketState.CONNECTED:
                logger.warning("WebSocket 연결이 활성화되지 않음: session_id=%s", session_id)
                await self.disconnect(session_id, "비활성 연결")
                return False

            # 메시지에 타임스탬프 추가
            message_with_timestamp = {
                **message,
                'timestamp': datetime.utcnow().isoformat(),
                'session_id': session_id
            }

            await websocket.send_text(json.dumps(message_with_timestamp, ensure_ascii=False))

            # 활동 시간 및 메시지 카운트 업데이트
            if session_id in self.connection_metadata:
                self.connection_metadata[session_id]['last_activity'] = datetime.utcnow()
                self.connection_metadata[session_id]['message_count'] += 1

            return True

        except Exception as e:
            logger.error("메시지 전송 실패: session_id=%s, error=%s", session_id, str(e))
            await self.disconnect(session_id, "메시지 전송 실패")
            return False

    async def broadcast_message(self, message: Dict[str, Any], exclude_session: Optional[str] = None) -> int:
        """모든 활성 연결에 메시지 브로드캐스트"""
        sent_count = 0

        for session_id in list(self.active_connections.keys()):
            if exclude_session and session_id == exclude_session:
                continue

            if await self.send_personal_message(session_id, message):
                sent_count += 1

        return sent_count

    def get_active_connections_count(self) -> int:
        """활성 연결 수 반환"""
        return len(self.active_connections)

    def get_connection_info(self, session_id: str) -> Optional[Dict[str, Any]]:
        """연결 정보 조회"""
        return self.connection_metadata.get(session_id)

    async def cleanup_inactive_connections(self) -> int:
        """비활성 연결 정리"""
        cleaned_count = 0
        current_time = datetime.utcnow()

        for session_id in list(self.active_connections.keys()):
            metadata = self.connection_metadata.get(session_id)
            if not metadata:
                continue

            # 30분 이상 비활성 연결 정리
            time_diff = current_time - metadata['last_activity']
            if time_diff.total_seconds() > 1800:  # 30 minutes
                await self.disconnect(session_id, "장시간 비활성")
                cleaned_count += 1

        return cleaned_count


# 전역 연결 관리자 인스턴스
manager = ConnectionManager()

# ============================================================================
# WebSocket Router
# ============================================================================

router = APIRouter(prefix="/ws", tags=["websocket"])

# ============================================================================
# WebSocket Dependencies
# ============================================================================

async def get_session_from_token(session_id: str, db: AsyncSession) -> Optional[UserSession]:
    """세션 ID로 유효한 세션 조회"""
    try:
        from sqlalchemy import select

        result = await db.execute(
            select(UserSession).where(
                UserSession.id == session_id,
                UserSession.status == "active"
            )
        )

        session = result.scalar_one_or_none()
        return session

    except Exception as e:
        logger.error("세션 조회 실패: session_id=%s, error=%s", session_id, str(e))
        return None


# ============================================================================
# WebSocket Endpoints
# ============================================================================

@router.websocket("/typing/{session_id}")
async def websocket_typing_endpoint(
    websocket: WebSocket,
    session_id: str,
    db: AsyncSession = Depends(get_async_session)
):
    """
    실시간 타이핑 데이터 처리 WebSocket 엔드포인트

    클라이언트로부터 실시간 키보드 입력 데이터를 수신하고,
    감정 분석 및 음악 생성 과정을 관리합니다.
    """

    # 세션 유효성 검증 (임시 비활성화 - 테스트용)
    # user_session = await get_session_from_token(session_id, db)
    # if not user_session:
    #     await websocket.close(code=4004, reason="유효하지 않은 세션")
    #     return

    # 임시: 모든 세션 허용 (테스트용)
    print(f"WebSocket 연결 허용: session_id={session_id}")

    # Redis 캐시 서비스 초기화 (임시 우회)
    try:
        redis_client = await get_redis()
        cache_service = CacheService(redis_client)
        realtime_processor = RealtimeProcessor(cache_service, db)
    except Exception as e:
        logger.warning("Redis 연결 실패, 모킹 모드로 계속 진행: %s", str(e))
        # 임시: Redis 없이 진행 (테스트용)
        cache_service = None
        realtime_processor = None

    # 연결 수립
    if not await manager.connect(websocket, session_id):
        await websocket.close(code=4006, reason="연결 실패")
        return

    # 연결 성공 메시지 전송
    await manager.send_personal_message(session_id, {
        'type': 'connection_established',
        'message': 'WebSocket 연결이 설정되었습니다',
        'session_id': session_id
    })

    try:
        while True:
            # 클라이언트로부터 메시지 수신
            try:
                data = await websocket.receive_text()
                message = json.loads(data)

            except WebSocketDisconnect:
                logger.info("클라이언트 연결 종료: session_id=%s", session_id)
                break

            except json.JSONDecodeError as e:
                logger.warning("잘못된 JSON 메시지: session_id=%s, error=%s", session_id, str(e))
                await manager.send_personal_message(session_id, {
                    'type': 'error',
                    'message': '잘못된 메시지 형식입니다'
                })
                continue

            except Exception as e:
                logger.error("메시지 수신 오류: session_id=%s, error=%s", session_id, str(e))
                break

            # 메시지 타입별 처리
            try:
                message_type = message.get('type', 'unknown')

                if message_type == 'typing_data':
                    # 실시간 타이핑 데이터 처리
                    await handle_typing_data(session_id, message, realtime_processor, manager)

                elif message_type == 'heartbeat':
                    # 하트비트 응답
                    await manager.send_personal_message(session_id, {
                        'type': 'heartbeat_response',
                        'message': 'pong'
                    })

                elif message_type == 'request_emotion_analysis':
                    # 감정 분석 요청
                    await handle_emotion_analysis_request(session_id, message, realtime_processor, manager)

                elif message_type == 'request_music_generation':
                    # 음악 생성 요청
                    await handle_music_generation_request(session_id, message, realtime_processor, manager)

                else:
                    logger.warning("알 수 없는 메시지 타입: session_id=%s, type=%s", session_id, message_type)
                    await manager.send_personal_message(session_id, {
                        'type': 'error',
                        'message': f'지원하지 않는 메시지 타입: {message_type}'
                    })

            except Exception as e:
                logger.error("메시지 처리 오류: session_id=%s, type=%s, error=%s",
                           session_id, message.get('type'), str(e))
                await manager.send_personal_message(session_id, {
                    'type': 'error',
                    'message': '메시지 처리 중 오류가 발생했습니다'
                })

    except Exception as e:
        logger.error("WebSocket 연결 처리 중 예상치 못한 오류: session_id=%s, error=%s", session_id, str(e))

    finally:
        # 연결 정리
        await manager.disconnect(session_id, "세션 종료")


# ============================================================================
# Message Handlers
# ============================================================================

async def handle_typing_data(session_id: str, message: Dict[str, Any],
                           processor: RealtimeProcessor, manager: ConnectionManager) -> None:
    """타이핑 데이터 처리"""
    try:
        typing_data = message.get('data', {})

        # 필수 필드 검증
        required_fields = ['keystroke', 'timestamp', 'interval']
        if not all(field in typing_data for field in required_fields):
            await manager.send_personal_message(session_id, {
                'type': 'error',
                'message': '타이핑 데이터의 필수 필드가 누락되었습니다'
            })
            return

        # 실시간 데이터 처리
        result = await processor.process_typing_event(session_id, typing_data)

        if result['success']:
            # 처리 성공 응답
            await manager.send_personal_message(session_id, {
                'type': 'typing_data_processed',
                'data': {
                    'buffer_size': result.get('buffer_size', 0),
                    'patterns_detected': result.get('patterns_detected', []),
                    'emotion_score': result.get('emotion_score')
                }
            })

            # 감정 분석 트리거 조건 확인
            if result.get('trigger_emotion_analysis', False):
                emotion_result = await processor.trigger_emotion_analysis(session_id)

                if emotion_result['success']:
                    await manager.send_personal_message(session_id, {
                        'type': 'emotion_analysis_result',
                        'data': emotion_result['data']
                    })

        else:
            await manager.send_personal_message(session_id, {
                'type': 'error',
                'message': result.get('error', '타이핑 데이터 처리 실패')
            })

    except Exception as e:
        logger.error("타이핑 데이터 처리 실패: session_id=%s, error=%s", session_id, str(e))
        await manager.send_personal_message(session_id, {
            'type': 'error',
            'message': '타이핑 데이터 처리 중 오류가 발생했습니다'
        })


async def handle_emotion_analysis_request(session_id: str, message: Dict[str, Any],
                                        processor: RealtimeProcessor, manager: ConnectionManager) -> None:
    """감정 분석 요청 처리"""
    try:
        result = await processor.trigger_emotion_analysis(session_id)

        if result['success']:
            await manager.send_personal_message(session_id, {
                'type': 'emotion_analysis_result',
                'data': result['data']
            })
        else:
            await manager.send_personal_message(session_id, {
                'type': 'error',
                'message': result.get('error', '감정 분석 실패')
            })

    except Exception as e:
        logger.error("감정 분석 요청 처리 실패: session_id=%s, error=%s", session_id, str(e))
        await manager.send_personal_message(session_id, {
            'type': 'error',
            'message': '감정 분석 중 오류가 발생했습니다'
        })


async def handle_music_generation_request(session_id: str, message: Dict[str, Any],
                                        processor: RealtimeProcessor, manager: ConnectionManager) -> None:
    """음악 생성 요청 처리"""
    try:
        # 음악 생성 비동기 처리 시작
        asyncio.create_task(
            processor.trigger_music_generation(session_id, manager)
        )

        # 즉시 응답
        await manager.send_personal_message(session_id, {
            'type': 'music_generation_started',
            'message': '음악 생성을 시작합니다'
        })

    except Exception as e:
        logger.error("음악 생성 요청 처리 실패: session_id=%s, error=%s", session_id, str(e))
        await manager.send_personal_message(session_id, {
            'type': 'error',
            'message': '음악 생성 중 오류가 발생했습니다'
        })


# ============================================================================
# Health Check Endpoint
# ============================================================================

@router.get("/health")
async def websocket_health():
    """WebSocket 서비스 상태 확인"""
    try:
        # 연결 통계
        stats = {
            'active_connections': manager.get_active_connections_count(),
            'service_status': 'healthy',
            'timestamp': datetime.utcnow().isoformat()
        }

        # 비활성 연결 정리
        cleaned = await manager.cleanup_inactive_connections()
        if cleaned > 0:
            stats['cleaned_connections'] = cleaned

        return stats

    except Exception as e:
        logger.error("WebSocket 헬스 체크 실패: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="WebSocket 서비스 상태 확인 실패"
        )


# ============================================================================
# Connection Statistics Endpoint
# ============================================================================

@router.get("/stats")
async def websocket_stats():
    """WebSocket 연결 통계"""
    try:
        connection_stats = []

        for session_id, metadata in manager.connection_metadata.items():
            connection_stats.append({
                'session_id': session_id,
                'connected_at': metadata['connected_at'].isoformat(),
                'last_activity': metadata['last_activity'].isoformat(),
                'message_count': metadata['message_count'],
                'connection_id': metadata['connection_id']
            })

        return {
            'total_connections': len(connection_stats),
            'connections': connection_stats,
            'timestamp': datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error("WebSocket 통계 조회 실패: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="WebSocket 통계 조회 실패"
        )


# Export router and manager for use in main application
__all__ = ["router", "manager"]