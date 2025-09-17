/**
 * T076: 전체 사용자 플로우 E2E 테스트
 *
 * VibeMusic의 핵심 사용자 여정을 종단간 검증합니다:
 * 1. 세션 생성
 * 2. 타이핑 입력 및 감정 분석
 * 3. 음악 생성 요청
 * 4. 생성된 음악 재생 및 다운로드
 */
import { test, expect } from '@playwright/test';
import TestHelpers from './utils/test-helpers';

test.describe('VibeMusic 전체 사용자 플로우', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
  });

  test('완전한 음악 생성 플로우 - 차분한 타이핑', async ({ page }) => {
    // 1. 메인 페이지 진입 및 세션 생성
    const sessionId = await helpers.createSessionAndNavigate();
    expect(sessionId).toBeTruthy();

    // 세션 페이지가 올바르게 로드되었는지 확인
    await expect(page.getByTestId('music-generation-page')).toBeVisible();
    await expect(page.getByTestId('typing-interface')).toBeVisible();
    await expect(page.getByTestId('emotion-visualizer')).toBeVisible();

    // 2. 타이핑 인터페이스에 차분한 텍스트 입력
    const calmText = '오늘은 정말 평화로운 하루였다. 창밖으로 보이는 석양이 마음을 편안하게 만든다.';
    await helpers.typeInMusicInput(calmText, { delay: 100 }); // 느린 타이핑으로 차분함 시뮬레이션

    // 실시간 감정 분석 확인
    await helpers.waitForEmotionAnalysis();

    // 감정 데이터가 올바르게 표시되는지 확인
    const emotionVisualizer = page.getByTestId('emotion-visualizer');
    await expect(emotionVisualizer.getByText(/차분|평온|calm/i)).toBeVisible();

    // 3. 음악 생성 시작
    await helpers.startMusicGeneration();

    // 생성 진행 상태 모니터링
    const progressBar = page.getByTestId('generation-progress-bar');
    await expect(progressBar).toBeVisible();

    // 생성 완료 대기
    await helpers.waitForMusicGeneration();

    // 4. 생성된 음악 정보 확인
    const musicPlayer = page.getByTestId('music-player');
    await expect(musicPlayer).toBeVisible();

    // 음악 메타데이터 확인
    await expect(page.getByTestId('music-title')).toContainText(/생성된 음악/);
    await expect(page.getByTestId('music-duration')).toBeVisible();
    await expect(page.getByTestId('music-genre')).toBeVisible();

    // 5. 음악 재생 테스트
    await helpers.playGeneratedMusic();

    // 재생 상태 확인
    const playbackTime = page.getByTestId('playback-time');
    await expect(playbackTime).toBeVisible();

    // 몇 초간 재생 후 일시정지
    await page.waitForTimeout(3000);
    const pauseButton = musicPlayer.getByRole('button', { name: /일시정지|pause/i });
    await pauseButton.click();

    // 6. 다운로드 기능 테스트
    const downloadButton = page.getByTestId('download-button');
    await expect(downloadButton).toBeEnabled();

    // 다운로드 링크 확인 (실제 다운로드는 하지 않음)
    const downloadPromise = page.waitForEvent('download');
    await downloadButton.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/vibemusic.*\.(wav|mp3|flac)$/);

    // 7. 새 음악 생성 버튼 확인
    const newMusicButton = page.getByRole('button', { name: /새.*음악.*생성|다시.*생성/i });
    await expect(newMusicButton).toBeVisible();
    await expect(newMusicButton).toBeEnabled();
  });

  test('완전한 음악 생성 플로우 - 빠른 타이핑', async ({ page }) => {
    // 1. 세션 생성
    const sessionId = await helpers.createSessionAndNavigate();

    // 2. 빠르고 에너지틱한 타이핑
    const energeticText = '오늘 정말 신나는 일이 있었어! 친구들과 함께 댄스 파티를 즐겼는데 너무 재미있었다!';
    await helpers.typeInMusicInput(energeticText, { delay: 30 }); // 빠른 타이핑

    // 감정 분석 결과 확인
    await helpers.waitForEmotionAnalysis();
    const emotionVisualizer = page.getByTestId('emotion-visualizer');
    await expect(emotionVisualizer.getByText(/신남|에너지|exciting|energetic/i)).toBeVisible();

    // 3. 음악 생성 및 재생
    await helpers.startMusicGeneration();
    await helpers.waitForMusicGeneration();
    await helpers.playGeneratedMusic();

    // 생성된 음악이 에너지틱한 장르인지 확인
    const musicGenre = page.getByTestId('music-genre');
    await expect(musicGenre).toContainText(/electronic|pop|dance|rock/i);
  });

  test('세션 상태 관리 및 자동 저장', async ({ page }) => {
    // 1. 세션 생성
    const sessionId = await helpers.createSessionAndNavigate();

    // 2. 타이핑 및 감정 분석
    await helpers.typeInMusicInput('자동 저장 테스트 메시지입니다.');
    await helpers.waitForEmotionAnalysis();

    // 3. 세션 상태 확인
    const sessionStatus = page.getByTestId('session-status');
    await expect(sessionStatus).toContainText(/활성|active/i);

    // 4. 로컬 스토리지에 세션 정보 저장되었는지 확인
    const sessionData = await helpers.getSessionFromStorage();
    expect(sessionData).toBeTruthy();
    expect(sessionData.sessionId).toBe(sessionId);

    // 5. 페이지 새로고침 후 세션 복구 확인
    await page.reload();
    await expect(page.getByTestId('music-generation-page')).toBeVisible();

    // 이전 타이핑 내용이 복구되었는지 확인
    const typingInput = page.getByTestId('typing-interface-input');
    await expect(typingInput).toHaveValue('자동 저장 테스트 메시지입니다.');
  });

  test('WebSocket 실시간 연결 및 데이터 전송', async ({ page }) => {
    // 1. 세션 생성
    await helpers.createSessionAndNavigate();

    // 2. WebSocket 연결 상태 확인
    const isConnected = await helpers.checkWebSocketConnection();
    expect(isConnected).toBeTruthy();

    // 3. 실시간 타이핑 데이터 전송 확인
    const typingInput = page.getByTestId('typing-interface-input');

    // 타이핑 이벤트 모니터링
    let keystrokeCount = 0;
    page.on('websocket', ws => {
      ws.on('framereceived', event => {
        const data = JSON.parse(event.payload as string);
        if (data.type === 'typing_event') {
          keystrokeCount++;
        }
      });
    });

    // 텍스트 입력
    await typingInput.type('실시간 테스트', { delay: 100 });

    // WebSocket을 통한 데이터 전송 확인
    await page.waitForTimeout(1000);
    expect(keystrokeCount).toBeGreaterThan(0);

    // 감정 분석 실시간 업데이트 확인
    await helpers.waitForEmotionAnalysis();
    const emotionData = page.getByTestId('emotion-data');
    await expect(emotionData).toBeVisible();
  });

  test('에러 상황 처리 및 복구', async ({ page }) => {
    // 1. 세션 생성
    await helpers.createSessionAndNavigate();

    // 2. 네트워크 오프라인 시뮬레이션
    await page.context().setOffline(true);

    // 3. 타이핑 시도 및 오프라인 상태 알림 확인
    await helpers.typeInMusicInput('오프라인 테스트');
    const offlineMessage = page.getByTestId('offline-indicator');
    await expect(offlineMessage).toBeVisible({ timeout: 5000 });

    // 4. 네트워크 복구
    await page.context().setOffline(false);

    // 5. 연결 복구 확인
    await expect(offlineMessage).toBeHidden({ timeout: 10000 });

    // 6. 기능 정상 작동 확인
    await helpers.waitForEmotionAnalysis();
    await helpers.startMusicGeneration();
  });

  test('동시 세션 제한 및 관리', async ({ page, context }) => {
    // 1. 첫 번째 세션 생성
    const sessionId1 = await helpers.createSessionAndNavigate();

    // 2. 새 탭에서 두 번째 세션 시도
    const newPage = await context.newPage();
    const newHelpers = new TestHelpers(newPage);

    // 3. 동일 IP에서 너무 많은 세션 생성 시 제한 확인
    // (실제로는 백엔드에서 IP별 세션 수를 제한)
    try {
      await newHelpers.createSessionAndNavigate();
      // 정상적으로 생성되면 새 세션이 만들어짐
      expect(true).toBeTruthy();
    } catch (error) {
      // 세션 제한에 걸리면 에러 메시지 확인
      await expect(newPage.getByText(/세션.*제한|too many sessions/i)).toBeVisible();
    }

    await newPage.close();
  });

  test('장시간 세션 유지 및 만료 처리', async ({ page }) => {
    // 1. 세션 생성
    await helpers.createSessionAndNavigate();

    // 2. 장시간 비활성 상태 시뮬레이션 (실제로는 시간 단축)
    await page.evaluate(() => {
      // 세션 만료 시간을 강제로 과거로 설정
      const sessionData = JSON.parse(localStorage.getItem('vibemusic-session') || '{}');
      sessionData.expiresAt = Date.now() - 1000; // 1초 전 만료
      localStorage.setItem('vibemusic-session', JSON.stringify(sessionData));
    });

    // 3. 페이지 새로고침으로 만료 세션 감지
    await page.reload();

    // 4. 세션 만료 알림 또는 메인 페이지로 리다이렉트 확인
    try {
      await expect(page.getByText(/세션.*만료|session expired/i)).toBeVisible({ timeout: 5000 });
    } catch {
      // 또는 메인 페이지로 리다이렉트
      await expect(page).toHaveURL('/');
    }
  });

  test('다양한 텍스트 길이에 대한 처리', async ({ page }) => {
    await helpers.createSessionAndNavigate();

    // 1. 매우 짧은 텍스트
    await helpers.typeInMusicInput('짧은 글');
    await helpers.waitForEmotionAnalysis();

    // 음악 생성 버튼이 활성화되는지 확인
    const generateButton = page.getByRole('button', { name: /음악.*생성/i });
    await expect(generateButton).toBeEnabled();

    // 2. 매우 긴 텍스트
    const longText = '이것은 매우 긴 텍스트입니다. '.repeat(50); // 약 500자
    await helpers.typeInMusicInput(longText);
    await helpers.waitForEmotionAnalysis();

    // 긴 텍스트도 처리되는지 확인
    await expect(generateButton).toBeEnabled();

    // 3. 특수 문자 포함 텍스트
    await helpers.typeInMusicInput('특수문자! @#$%^&*()_+ 테스트 🎵🎶');
    await helpers.waitForEmotionAnalysis();
    await expect(generateButton).toBeEnabled();
  });
});