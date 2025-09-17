/**
 * Playwright 전역 정리
 *
 * 모든 테스트 완료 후 수행되는 정리 작업
 */
import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('\n🧹 VibeMusic E2E 테스트 정리 시작...');

  try {
    // 테스트 실행 시간 계산
    const startTime = process.env.TEST_START_TIME;
    if (startTime) {
      const endTime = new Date();
      const duration = endTime.getTime() - new Date(startTime).getTime();
      const minutes = Math.floor(duration / 60000);
      const seconds = Math.floor((duration % 60000) / 1000);
      console.log(`⏱️ 총 테스트 실행 시간: ${minutes}분 ${seconds}초`);
    }

    // 테스트 결과 요약
    console.log('📊 테스트 완료 요약:');
    console.log('- HTML 리포트: test-results/html-report/index.html');
    console.log('- JUnit 결과: test-results/junit.xml');
    console.log('- 스크린샷 및 비디오: test-results/');

    // 환경 변수 정리
    delete process.env.E2E_SETUP_COMPLETE;
    delete process.env.TEST_START_TIME;

    console.log('✅ 테스트 환경 정리 완료');

  } catch (error) {
    console.error('❌ 글로벌 정리 실패:', error);
  }
}

export default globalTeardown;