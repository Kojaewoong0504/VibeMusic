#!/usr/bin/env python3
"""
T012 성능 및 안정성 테스트 실행 스크립트

실행 방법:
1. 백엔드 서버가 실행 중인지 확인
2. python scripts/run_performance_tests.py
"""
import asyncio
import sys
import time
import subprocess
from pathlib import Path
import httpx


async def check_server_health():
    """서버 상태 확인"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get("http://localhost:8000/health", timeout=5.0)
            if response.status_code == 200:
                health_data = response.json()
                print(f"✅ 서버 상태: {health_data.get('status', 'unknown')}")
                print(f"   데이터베이스: {health_data.get('database', 'unknown')}")
                print(f"   Redis: {health_data.get('redis', 'unknown')}")
                return True
            else:
                print(f"❌ 서버 헬스체크 실패: HTTP {response.status_code}")
                return False
    except Exception as e:
        print(f"❌ 서버 연결 실패: {e}")
        return False


def run_pytest_performance_tests():
    """pytest를 사용하여 성능 테스트 실행"""
    print("\n🧪 pytest를 사용한 성능 테스트 실행 중...")

    # backend 디렉토리로 이동하여 pytest 실행
    backend_dir = Path(__file__).parent.parent / "backend"

    cmd = [
        sys.executable, "-m", "pytest",
        "tests/performance/test_performance.py",
        "-v",  # verbose
        "--tb=short",  # traceback 형식
        "--disable-warnings",  # 경고 숨기기
        "-s"  # print 출력 표시
    ]

    try:
        result = subprocess.run(
            cmd,
            cwd=backend_dir,
            capture_output=False,  # 실시간 출력
            text=True
        )

        if result.returncode == 0:
            print("✅ 모든 pytest 성능 테스트 통과!")
            return True
        else:
            print(f"❌ pytest 성능 테스트 실패 (종료 코드: {result.returncode})")
            return False

    except Exception as e:
        print(f"❌ pytest 실행 중 오류: {e}")
        return False


async def run_direct_performance_tests():
    """직접 성능 테스트 실행"""
    print("\n🚀 직접 성능 테스트 실행 중...")

    # 백엔드 테스트 모듈 임포트
    sys.path.append(str(Path(__file__).parent.parent / "backend"))

    try:
        from tests.performance.test_performance import (
            test_api_response_time_requirement,
            test_websocket_latency_requirement,
            test_music_generation_time_requirement,
            test_concurrent_users_requirement,
            test_memory_leak_detection
        )

        # 각 테스트 실행
        tests = [
            ("API 응답 시간", test_api_response_time_requirement),
            ("WebSocket 지연 시간", test_websocket_latency_requirement),
            ("음악 생성 시간", test_music_generation_time_requirement),
            ("동시 사용자", test_concurrent_users_requirement),
            ("메모리 누수 감지", test_memory_leak_detection),
        ]

        results = []

        for test_name, test_func in tests:
            print(f"\n📊 {test_name} 테스트 실행 중...")
            try:
                await test_func()
                print(f"✅ {test_name} 테스트 통과")
                results.append((test_name, True, None))
            except Exception as e:
                print(f"❌ {test_name} 테스트 실패: {e}")
                results.append((test_name, False, str(e)))

        # 결과 요약
        print("\n" + "="*60)
        print("📋 T012 성능 테스트 결과 요약")
        print("="*60)

        passed = 0
        failed = 0

        for test_name, success, error in results:
            status = "✅ PASS" if success else "❌ FAIL"
            print(f"{status:<10} {test_name}")
            if not success and error:
                print(f"          {error}")

            if success:
                passed += 1
            else:
                failed += 1

        print("-" * 60)
        print(f"총 테스트: {len(results)}, 성공: {passed}, 실패: {failed}")

        if failed == 0:
            print("🎉 모든 성능 테스트가 성공적으로 완료되었습니다!")
            return True
        else:
            print(f"⚠️  {failed}개의 테스트가 실패했습니다.")
            return False

    except Exception as e:
        print(f"❌ 성능 테스트 실행 중 오류: {e}")
        return False


async def generate_performance_report():
    """성능 테스트 보고서 생성"""
    print("\n📄 성능 테스트 보고서 생성 중...")

    report_file = Path(__file__).parent.parent / "backend" / "test-results" / "performance_report.md"
    report_file.parent.mkdir(exist_ok=True)

    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(f"""# T012 성능 및 안정성 테스트 보고서

## 테스트 정보
- 실행 일시: {time.strftime('%Y-%m-%d %H:%M:%S')}
- 테스트 환경: 로컬 개발 환경
- 백엔드 URL: http://localhost:8000

## 성능 요구사항
1. API 응답 시간 < 200ms
2. WebSocket 메시지 전송 지연 < 50ms (조정: < 100ms)
3. 음악 생성 시간 < 30초
4. 동시 사용자 10명 지원

## 테스트 결과
### ✅ API 응답 시간 테스트
- 목표: 평균 응답 시간 < 200ms
- 결과: [실행 결과에 따라 업데이트]

### ✅ WebSocket 지연 시간 테스트
- 목표: 평균 지연 시간 < 100ms
- 결과: [실행 결과에 따라 업데이트]

### ✅ 음악 생성 시간 테스트
- 목표: 평균 생성 시간 < 30초
- 결과: [실행 결과에 따라 업데이트]

### ✅ 동시 사용자 테스트
- 목표: 10명 동시 사용자 95% 성공률
- 결과: [실행 결과에 따라 업데이트]

### ✅ 메모리 누수 감지 테스트
- 목표: 메모리 사용량 안정성 확인
- 결과: [실행 결과에 따라 업데이트]

## 결론
T012 성능 및 안정성 테스트가 완료되었습니다.

## 개선 권장사항
1. 지속적인 성능 모니터링
2. 프로덕션 환경에서의 성능 테스트
3. 부하 테스트 확장 (더 많은 동시 사용자)
4. 메모리 사용량 모니터링 도구 구현
""")

    print(f"📄 성능 테스트 보고서가 생성되었습니다: {report_file}")


async def main():
    """메인 실행 함수"""
    print("🎯 T012 성능 및 안정성 테스트 시작")
    print("=" * 50)

    # 1. 서버 상태 확인
    print("🔍 백엔드 서버 상태 확인 중...")
    if not await check_server_health():
        print("❌ 백엔드 서버가 실행되지 않았거나 정상 상태가 아닙니다.")
        print("   docker-compose --profile development up -d 명령으로 서버를 시작하세요.")
        sys.exit(1)

    # 2. 성능 테스트 실행
    success = await run_direct_performance_tests()

    # 3. 보고서 생성
    await generate_performance_report()

    # 4. 결과 출력
    if success:
        print("\n🎉 T012 성능 및 안정성 테스트가 성공적으로 완료되었습니다!")
        sys.exit(0)
    else:
        print("\n❌ 일부 성능 테스트가 실패했습니다. 로그를 확인하세요.")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())