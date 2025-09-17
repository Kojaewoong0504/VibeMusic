/**
 * Playwright 전역 설정
 *
 * 모든 테스트 실행 전에 수행되는 초기화 작업
 */
import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 VibeMusic E2E 테스트 환경 설정 시작...');

  const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:3000';

  try {
    // 브라우저 인스턴스 생성
    const browser = await chromium.launch();
    const page = await browser.newPage();

    console.log(`📡 애플리케이션 상태 확인: ${baseURL}`);

    // 애플리케이션 응답 확인
    const response = await page.goto(baseURL, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    if (!response?.ok()) {
      throw new Error(`애플리케이션이 응답하지 않습니다: ${response?.status()}`);
    }

    // 기본 요소들이 로드되었는지 확인
    await page.waitForSelector('body', { timeout: 10000 });

    console.log('✅ 애플리케이션 상태 정상');

    // 테스트용 백엔드 서버 상태 확인
    const backendURL = process.env.API_BASE_URL || 'http://localhost:8000';

    try {
      const healthResponse = await page.request.get(`${backendURL}/health`);
      if (healthResponse.ok()) {
        console.log('✅ 백엔드 서버 상태 정상');
      } else {
        console.warn('⚠️ 백엔드 서버 응답 이상, 일부 테스트가 실패할 수 있습니다');
      }
    } catch (error) {
      console.warn('⚠️ 백엔드 서버 연결 실패, 일부 테스트가 실패할 수 있습니다');
    }

    await browser.close();

    // 테스트 환경 변수 설정
    process.env.E2E_SETUP_COMPLETE = 'true';
    process.env.TEST_START_TIME = new Date().toISOString();

    console.log('🎭 Playwright 테스트 환경 설정 완료\n');

  } catch (error) {
    console.error('❌ 글로벌 설정 실패:', error);
    throw error;
  }
}

export default globalSetup;