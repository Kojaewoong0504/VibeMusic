#!/usr/bin/env python3
"""
T005: WebSocket 실시간 통신 테스트 스크립트
백엔드 WebSocket 엔드포인트 기능 검증
"""

import asyncio
import json
import websockets
import time
from typing import Optional

class WebSocketTester:
    def __init__(self, url: str, session_id: str):
        self.url = url
        self.session_id = session_id
        self.websocket: Optional[websockets.WebSocketServerProtocol] = None

    async def connect(self):
        """WebSocket 연결"""
        try:
            self.websocket = await websockets.connect(f"{self.url}/typing/{self.session_id}")
            print(f"✅ WebSocket 연결 성공: {self.url}/typing/{self.session_id}")
            return True
        except Exception as e:
            print(f"❌ WebSocket 연결 실패: {e}")
            return False

    async def send_typing_data(self, keystroke: str, duration: float = 100.0, interval: float = 200.0, is_backspace: bool = False):
        """타이핑 데이터 전송"""
        if not self.websocket:
            print("❌ WebSocket이 연결되지 않았습니다")
            return False

        message = {
            "type": "typing_data",
            "session_id": self.session_id,
            "data": {
                "keystroke": keystroke,
                "timestamp": int(time.time() * 1000),
                "duration": duration,
                "interval": interval,
                "isBackspace": is_backspace
            }
        }

        try:
            await self.websocket.send(json.dumps(message))
            print(f"📤 타이핑 데이터 전송: '{keystroke}' (duration={duration}ms, interval={interval}ms)")
            return True
        except Exception as e:
            print(f"❌ 메시지 전송 실패: {e}")
            return False

    async def send_heartbeat(self):
        """하트비트 전송"""
        if not self.websocket:
            print("❌ WebSocket이 연결되지 않았습니다")
            return False

        message = {
            "type": "heartbeat",
            "session_id": self.session_id
        }

        try:
            await self.websocket.send(json.dumps(message))
            print("💓 하트비트 전송")
            return True
        except Exception as e:
            print(f"❌ 하트비트 전송 실패: {e}")
            return False

    async def listen_for_messages(self, timeout: float = 5.0):
        """서버 메시지 수신"""
        if not self.websocket:
            print("❌ WebSocket이 연결되지 않았습니다")
            return

        print(f"👂 메시지 수신 대기 중... (timeout: {timeout}초)")

        try:
            while True:
                message = await asyncio.wait_for(self.websocket.recv(), timeout=timeout)
                data = json.loads(message)
                print(f"📨 메시지 수신: {data.get('type', 'unknown')} - {data}")

                # 특정 메시지 타입별 처리
                if data.get('type') == 'connection_established':
                    print(f"🎉 연결 확인: {data.get('message', '')}")
                elif data.get('type') == 'emotion_update':
                    emotion = data.get('data', {})
                    print(f"💭 감정 데이터: E={emotion.get('energy', 0):.2f}, V={emotion.get('valence', 0):.2f}, T={emotion.get('tension', 0):.2f}, F={emotion.get('focus', 0):.2f}")
                elif data.get('type') == 'typing_data_processed':
                    stats = data.get('data', {})
                    print(f"📊 처리 통계: 버퍼={stats.get('buffer_size', 0)}, 패턴={len(stats.get('patterns_detected', []))}개")
                elif data.get('type') == 'error':
                    print(f"❌ 서버 에러: {data.get('message', '')}")

        except asyncio.TimeoutError:
            print(f"⏰ 메시지 수신 타임아웃 ({timeout}초)")
        except Exception as e:
            print(f"❌ 메시지 수신 오류: {e}")

    async def disconnect(self):
        """WebSocket 연결 해제"""
        if self.websocket:
            await self.websocket.close()
            print("🔌 WebSocket 연결 해제")

    async def test_typing_sequence(self, text: str = "Hello WebSocket!"):
        """타이핑 시퀀스 테스트"""
        print(f"\n🎯 타이핑 시퀀스 테스트 시작: '{text}'")

        for i, char in enumerate(text):
            # 타이핑 패턴 시뮬레이션
            duration = 80 + (i % 3) * 20  # 80-120ms 키 누름 시간
            interval = 150 + (i % 4) * 50  # 150-300ms 키 간격
            is_backspace = char == '\b'

            success = await self.send_typing_data(
                keystroke=char,
                duration=duration,
                interval=interval,
                is_backspace=is_backspace
            )

            if not success:
                break

            # 실제 타이핑 속도 시뮬레이션
            await asyncio.sleep(interval / 1000.0)

        print("✅ 타이핑 시퀀스 완료")

async def main():
    """메인 테스트 함수"""
    print("🧪 WebSocket 실시간 통신 테스트 시작")
    print("=" * 50)

    # 테스트 설정
    ws_url = "ws://localhost:8000/ws"
    session_id = f"test-session-{int(time.time())}"

    # WebSocket 테스터 초기화
    tester = WebSocketTester(ws_url, session_id)

    try:
        # 1. WebSocket 연결 테스트
        print("\n1️⃣ WebSocket 연결 테스트")
        if not await tester.connect():
            return

        # 2. 초기 메시지 수신 대기
        print("\n2️⃣ 초기 연결 메시지 확인")
        await tester.listen_for_messages(timeout=2.0)

        # 3. 하트비트 테스트
        print("\n3️⃣ 하트비트 테스트")
        await tester.send_heartbeat()
        await tester.listen_for_messages(timeout=1.0)

        # 4. 단일 타이핑 이벤트 테스트
        print("\n4️⃣ 단일 타이핑 이벤트 테스트")
        await tester.send_typing_data("H", duration=100, interval=0)
        await tester.listen_for_messages(timeout=2.0)

        # 5. 타이핑 시퀀스 테스트
        print("\n5️⃣ 타이핑 시퀀스 테스트")
        await tester.test_typing_sequence("Hello!")
        await tester.listen_for_messages(timeout=3.0)

        # 6. 백스페이스 테스트
        print("\n6️⃣ 백스페이스 테스트")
        await tester.send_typing_data("Backspace", duration=120, interval=200, is_backspace=True)
        await tester.listen_for_messages(timeout=2.0)

        # 7. 연속 메시지 테스트
        print("\n7️⃣ 연속 메시지 테스트")
        for i in range(5):
            await tester.send_typing_data(f"msg{i}", duration=90 + i*10, interval=180 + i*20)
            await asyncio.sleep(0.1)
        await tester.listen_for_messages(timeout=3.0)

        print("\n✅ 모든 테스트 완료!")

    except KeyboardInterrupt:
        print("\n⏹️ 사용자에 의해 테스트 중단")
    except Exception as e:
        print(f"\n❌ 테스트 중 오류 발생: {e}")
    finally:
        # 정리
        await tester.disconnect()
        print("\n🏁 테스트 종료")

if __name__ == "__main__":
    asyncio.run(main())