#!/usr/bin/env python3
"""
WebSocket 연결 테스트 스크립트
"""
import asyncio
import websockets
import json
import time

async def test_websocket_connection():
    """WebSocket 연결 테스트"""
    print("🔗 WebSocket 연결 테스트 시작...")

    # 테스트용 세션 ID (임시)
    session_id = "test-session-123"
    uri = f"ws://localhost:8000/ws/typing/{session_id}"

    try:
        print(f"📡 연결 시도: {uri}")

        # WebSocket 연결
        start_time = time.time()
        async with websockets.connect(uri) as websocket:
            connection_time = (time.time() - start_time) * 1000
            print(f"✅ WebSocket 연결 성공! 연결 시간: {connection_time:.2f}ms")

            # 연결 확인 메시지 수신
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                message = json.loads(response)
                print(f"📨 수신 메시지: {message}")

                # Ping 테스트
                ping_start = time.time()
                ping_message = json.dumps({"type": "heartbeat", "message": "ping"})
                await websocket.send(ping_message)

                pong_response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                ping_time = (time.time() - ping_start) * 1000

                pong_message = json.loads(pong_response)
                print(f"🏓 Ping/Pong 테스트: {ping_time:.2f}ms")
                print(f"📥 Pong 응답: {pong_message}")

                return True, connection_time, ping_time

            except asyncio.TimeoutError:
                print("⏰ 메시지 수신 시간 초과")
                return False, connection_time, 999

    except websockets.exceptions.ConnectionClosedError as e:
        print(f"❌ WebSocket 연결 실패: {e}")
        return False, 999, 999

    except Exception as e:
        print(f"❌ 예상치 못한 오류: {e}")
        return False, 999, 999

async def main():
    """메인 테스트 함수"""
    print("🧪 VibeMusic WebSocket 연결 테스트")
    print("=" * 50)

    success, connection_time, ping_time = await test_websocket_connection()

    print("\n📊 테스트 결과:")
    print(f"  - 연결 성공: {'✅' if success else '❌'}")
    print(f"  - 연결 시간: {connection_time:.2f}ms")
    print(f"  - Ping 시간: {ping_time:.2f}ms")

    if success:
        print("\n🎉 WebSocket 연결 테스트 성공!")
        if ping_time < 50:
            print("⚡ 지연시간이 기준치(50ms) 이하로 우수합니다.")
        else:
            print("⚠️ 지연시간이 기준치(50ms)를 초과했습니다.")
    else:
        print("\n💥 WebSocket 연결 테스트 실패!")
        print("🔍 문제 해결 방법:")
        print("  1. 백엔드 서버가 실행 중인지 확인")
        print("  2. 유효한 세션이 데이터베이스에 있는지 확인")
        print("  3. WebSocket 엔드포인트가 올바르게 등록되었는지 확인")

if __name__ == "__main__":
    asyncio.run(main())