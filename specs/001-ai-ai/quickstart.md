# QuickStart - 바이브뮤직 사용법

**Phase 1 Output** | **Date**: 2025-09-14 | **Feature**: 001-ai-ai

## 빠른 시작 가이드

### 1. 개발 환경 설정

```bash
# 저장소 클론
git clone https://github.com/vibemusic/vibemusic.git
cd vibemusic

# Docker로 개발 환경 시작 (개발 프로필 사용)
docker-compose --profile development up -d

# 또는 환경별 Docker Compose 파일 사용
# docker-compose -f docker-compose.development.yml up -d

# 백엔드 의존성 설치 (Python 3.12+)
cd backend
pip install -r requirements.txt
pip install -r requirements-dev.txt

# 프론트엔드 의존성 설치 (Node.js 18+)
cd ../frontend  
npm install

# 데이터베이스 마이그레이션
cd ../backend
python -m alembic upgrade head

# 개발 서버 시작
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 새 터미널에서 프론트엔드 시작
cd frontend
npm start
```

### 2. API 사용 예시

#### 세션 생성

```bash
curl -X POST http://localhost:8000/v1/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "consent_given": true,
    "auto_delete_hours": 24
  }'
```

**응답:**
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "session_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "auto_delete_at": "2025-09-15T21:00:00Z"
}
```

#### WebSocket 연결 (JavaScript)

```javascript
const sessionId = "550e8400-e29b-41d4-a716-446655440000";
const sessionToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...";

const ws = new WebSocket(
  `ws://localhost:8000/ws/typing/${sessionId}?session_token=${sessionToken}`
);

ws.onopen = function() {
  console.log("WebSocket 연결 성공");
  
  // 연결 초기화
  ws.send(JSON.stringify({
    type: "connect",
    session_token: sessionToken,
    client_info: {
      user_agent: navigator.userAgent,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen_resolution: `${screen.width}x${screen.height}`
    }
  }));
};

// 타이핑 패턴 캡처 예시
let keystrokeBuffer = [];
let sequenceId = 0;

document.addEventListener('keydown', (event) => {
  const keystroke = {
    key: event.key,
    timestamp: performance.now(),
    event_type: 'keydown',
    modifiers: []
  };
  
  if (event.ctrlKey) keystroke.modifiers.push('ctrl');
  if (event.altKey) keystroke.modifiers.push('alt');
  if (event.shiftKey) keystroke.modifiers.push('shift');
  if (event.metaKey) keystroke.modifiers.push('meta');
  
  keystrokeBuffer.push(keystroke);
});

// 100ms마다 배치 전송
setInterval(() => {
  if (keystrokeBuffer.length > 0) {
    ws.send(JSON.stringify({
      type: "typing_pattern",
      sequence_id: sequenceId++,
      timestamp: performance.now(),
      keystrokes: keystrokeBuffer,
      text_buffer: document.getElementById('prompt-input').value.slice(-100)
    }));
    
    keystrokeBuffer = [];
  }
}, 100);
```

#### 타이핑 패턴 분석

```bash
curl -X POST http://localhost:8000/v1/sessions/550e8400-e29b-41d4-a716-446655440000/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..." \
  -d '{
    "keystrokes": [
      {"key": "H", "timestamp": 1000.0, "type": "keydown"},
      {"key": "e", "timestamp": 1150.0, "type": "keydown"},
      {"key": "l", "timestamp": 1300.0, "type": "keydown"},
      {"key": "l", "timestamp": 1450.0, "type": "keydown"},
      {"key": "o", "timestamp": 1600.0, "type": "keydown"}
    ],
    "text_content": "Hello world, I want to create a peaceful and calming music"
  }'
```

**응답:**
```json
{
  "pattern_id": "123e4567-e89b-12d3-a456-426614174000",
  "emotion_profile": {
    "id": "456e7890-e89b-12d3-a456-426614174001",
    "tempo_score": 0.65,
    "rhythm_consistency": 0.78,
    "pause_intensity": 0.42,
    "emotion_vector": {
      "energy": 0.3,
      "valence": 0.7,
      "tension": 0.2,
      "focus": 0.8
    },
    "confidence_score": 0.85
  }
}
```

#### AI 음악 생성

```bash
curl -X POST http://localhost:8000/v1/sessions/550e8400-e29b-41d4-a716-446655440000/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..." \
  -d '{
    "text_prompt": "peaceful and calming music for meditation",
    "emotion_profile_id": "456e7890-e89b-12d3-a456-426614174001",
    "generation_parameters": {
      "duration": 30,
      "format": "wav",
      "genre_hint": "ambient"
    }
  }'
```

**응답:**
```json
{
  "music_id": "789e0123-e89b-12d3-a456-426614174002",
  "estimated_completion_time": 25
}
```

#### 생성 상태 확인

```bash
curl -X GET http://localhost:8000/v1/sessions/550e8400-e29b-41d4-a716-446655440000/music/789e0123-e89b-12d3-a456-426614174002 \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
```

**생성 중 응답:**
```json
{
  "status": "generating",
  "progress": 65
}
```

**완료 후 응답:**
```json
{
  "id": "789e0123-e89b-12d3-a456-426614174002",
  "file_url": "https://storage.vibemusic.app/music/789e0123-e89b-12d3-a456-426614174002.wav",
  "file_size": 1536000,
  "duration": 30,
  "format": "wav",
  "sample_rate": 44100,
  "generation_time": 23.5,
  "quality_score": 0.92,
  "status": "completed",
  "created_at": "2025-09-14T15:30:00Z",
  "completed_at": "2025-09-14T15:30:23Z"
}
```

## 사용자 시나리오 테스트

### 시나리오 1: 차분한 명상 음악 생성

**목표**: 느린 타이핑으로 차분한 감정을 캡처하여 명상 음악 생성

**단계**:
1. 새 세션 생성 (`POST /sessions`)
2. WebSocket 연결 설정
3. "peaceful meditation music in nature"를 천천히 타이핑 (키 간격 200-300ms)
4. 타이핑 패턴 분석 (`POST /analyze`)
5. 감정 프로필 확인 (낮은 energy, 높은 valence 예상)
6. AI 음악 생성 요청 (`POST /generate`)
7. 생성된 음악 다운로드 및 재생

**예상 결과**:
- 감정 프로필: `energy: 0.2-0.4, valence: 0.6-0.8, tension: 0.1-0.3`
- 생성된 음악: 느린 템포, 자연 소리, 차분한 멜로디

### 시나리오 2: 에너지틱한 운동 음악 생성

**목표**: 빠른 타이핑으로 활기찬 감정을 캡처하여 운동 음악 생성

**단계**:
1. 새 세션 생성
2. WebSocket 연결
3. "energetic workout music with strong beat"를 빠르게 타이핑 (키 간격 80-120ms)
4. 타이핑 패턴 분석
5. 감정 프로필 확인 (높은 energy와 tempo_score 예상)
6. AI 음악 생성 (duration: 60초)
7. 음악 품질 평가

**예상 결과**:
- 감정 프로필: `energy: 0.8-1.0, tempo_score: 0.7-0.9`
- 생성된 음악: 빠른 템포, 강한 비트, 활기찬 멜로디

### 시나리오 3: 불안정한 리듬으로 복잡한 감정 표현

**목표**: 불규칙한 타이핑 패턴으로 복잡한 감정의 음악 생성

**단계**:
1. 세션 생성 및 연결
2. "complex emotional journey through music"를 불규칙하게 타이핑
   - 단어마다 다른 속도 사용
   - 중간에 긴 일시정지 포함
3. 패턴 분석 (높은 pause_intensity, 낮은 rhythm_consistency 예상)
4. 음악 생성 (장르: experimental)
5. 생성된 음악의 복잡성 평가

**예상 결과**:
- 감정 프로필: `rhythm_consistency: 0.3-0.5, pause_intensity: 0.6-0.8`
- 생성된 음악: 복잡한 리듬, 다양한 악기, 실험적 요소

## 통합 테스트 체크리스트

### 기능 테스트
- [ ] 세션 생성 및 토큰 발급
- [ ] WebSocket 연결 및 실시간 데이터 전송
- [ ] 타이핑 패턴 수집 및 저장
- [ ] 감정 분석 알고리즘 정확도
- [ ] AI 음악 생성 API 연동
- [ ] 파일 다운로드 및 재생

### 성능 테스트
- [ ] WebSocket 레이턴시 <50ms
- [ ] 동시 연결 1,000개 지원
- [ ] 음악 생성 시간 <30초
- [ ] 파일 다운로드 속도 최적화

### 보안 테스트
- [ ] 세션 토큰 검증
- [ ] HTTPS/WSS 암호화 통신
- [ ] 개인정보 보호 (24시간 후 자동 삭제)
- [ ] Rate limiting 적용

### 호환성 테스트
- [ ] Chrome 88+ 브라우저 테스트
- [ ] Firefox 85+ 브라우저 테스트
- [ ] Safari 14+ 브라우저 테스트
- [ ] 모바일 브라우저 기본 동작

## 개발 도구

### 디버깅 도구

**WebSocket 연결 테스트:**
```javascript
// 브라우저 콘솔에서 실행
const testWebSocket = (sessionId, token) => {
  const ws = new WebSocket(`ws://localhost:8000/ws/typing/${sessionId}?session_token=${token}`);
  
  ws.onopen = () => console.log('✅ WebSocket 연결 성공');
  ws.onmessage = (event) => console.log('📨 메시지:', JSON.parse(event.data));
  ws.onerror = (error) => console.error('❌ 오류:', error);
  ws.onclose = (event) => console.log('🔌 연결 종료:', event.code, event.reason);
  
  return ws;
};
```

**타이핑 패턴 시뮬레이터:**
```javascript
const simulateTyping = (text, baseInterval = 150) => {
  const keystrokes = [];
  const startTime = performance.now();
  
  for (let i = 0; i < text.length; i++) {
    const variance = Math.random() * 100 - 50; // ±50ms 변동
    const timestamp = startTime + (i * baseInterval) + variance;
    
    keystrokes.push({
      key: text[i],
      timestamp: timestamp,
      event_type: 'keydown',
      modifiers: []
    });
  }
  
  return keystrokes;
};
```

### 모니터링

**실시간 성능 모니터링:**
```bash
# WebSocket 연결 수 확인
curl http://localhost:8000/metrics | grep websocket_connections

# 음악 생성 큐 상태
curl http://localhost:8000/metrics | grep generation_queue

# 데이터베이스 연결 상태
curl http://localhost:8000/health
```

---

**Next Step**: `/tasks` 명령어로 구체적인 구현 태스크 생성