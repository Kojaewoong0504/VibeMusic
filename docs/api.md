# VibeMusic API 문서

## 개요

VibeMusic은 사용자의 타이핑 패턴을 실시간으로 분석하여 감정을 추출하고, 이를 기반으로 개인화된 AI 음악을 생성하는 서비스입니다.

### API 기본 정보

- **베이스 URL**: `http://localhost:8000`
- **API 버전**: v1
- **문서 URL**: `/docs` (Swagger UI), `/redoc` (ReDoc)
- **API 프리픽스**: `/v1`

## 인증

VibeMusic API는 세션 기반 인증을 사용합니다.

### 세션 토큰 사용법

1. `POST /v1/sessions/`로 새 세션을 생성하여 `session_token`을 받습니다
2. 모든 인증이 필요한 요청에 다음 헤더를 포함합니다:
   ```
   Authorization: Bearer <session_token>
   ```

## 세션 관리 API

### 새 세션 생성

**POST** `/v1/sessions/`

새로운 사용자 세션을 생성하고 세션 토큰을 반환합니다.

#### 요청 본문

```json
{
  "consent_given": true,
  "metadata": {
    "browser": "Chrome",
    "platform": "Windows",
    "timezone": "Asia/Seoul"
  }
}
```

#### 응답 (201 Created)

```json
{
  "id": "ses_1234567890abcdef",
  "session_token": "tok_abcdef1234567890",
  "status": "active",
  "consent_given": true,
  "created_at": "2024-01-15T10:30:00Z",
  "auto_delete_at": "2024-01-16T10:30:00Z",
  "total_typing_time": 0,
  "music_generated_count": 0,
  "metadata": {
    "browser": "Chrome",
    "platform": "Windows",
    "timezone": "Asia/Seoul"
  }
}
```

### 세션 정보 조회

**GET** `/v1/sessions/{session_id}`

특정 세션의 정보를 조회합니다.

#### 경로 파라미터

- `session_id` (string): 세션 ID

#### 헤더

- `Authorization: Bearer <session_token>` (필수)

#### 응답 (200 OK)

```json
{
  "id": "ses_1234567890abcdef",
  "session_token": "tok_abcdef1234567890",
  "status": "active",
  "consent_given": true,
  "created_at": "2024-01-15T10:30:00Z",
  "auto_delete_at": "2024-01-16T10:30:00Z",
  "total_typing_time": 300,
  "music_generated_count": 2,
  "metadata": {
    "browser": "Chrome",
    "platform": "Windows"
  }
}
```

## 패턴 분석 API

### 타이핑 패턴 분석

**POST** `/v1/sessions/{session_id}/analyze`

사용자의 키스트로크 데이터를 분석하여 타이핑 패턴과 감정 프로필을 생성합니다.

#### 경로 파라미터

- `session_id` (string): 세션 ID

#### 헤더

- `Authorization: Bearer <session_token>` (필수)

#### 요청 본문

```json
{
  "keystroke_data": [
    {
      "key": "h",
      "timestamp": 1705310400000,
      "duration": 120,
      "interval": 0
    },
    {
      "key": "e",
      "timestamp": 1705310400200,
      "duration": 100,
      "interval": 200
    },
    {
      "key": "l",
      "timestamp": 1705310400350,
      "duration": 110,
      "interval": 150
    }
  ],
  "text_content": "hello world",
  "typing_context": {
    "input_type": "text",
    "language": "ko",
    "session_duration": 30
  }
}
```

#### 응답 (200 OK)

```json
{
  "analysis_id": "ana_1234567890abcdef",
  "session_id": "ses_1234567890abcdef",
  "typing_pattern": {
    "wpm": 45.8,
    "rhythm_score": 0.75,
    "consistency": 0.68,
    "key_intervals": {
      "mean": 180.5,
      "std": 45.2,
      "distribution": "normal"
    },
    "pressure_patterns": {
      "light": 0.3,
      "medium": 0.5,
      "heavy": 0.2
    }
  },
  "emotion_profile": {
    "dominant_emotion": "calm",
    "intensity": 0.65,
    "stability": 0.72,
    "emotional_vector": {
      "valence": 0.6,
      "arousal": 0.4,
      "dominance": 0.7
    },
    "secondary_emotions": [
      {
        "emotion": "focused",
        "confidence": 0.8
      },
      {
        "emotion": "creative",
        "confidence": 0.6
      }
    ]
  },
  "analysis_metadata": {
    "algorithm_version": "v2.1",
    "confidence_score": 0.85,
    "data_quality": "high",
    "processed_at": "2024-01-15T10:35:00Z"
  }
}
```

## 음악 생성 API

### AI 음악 생성

**POST** `/v1/sessions/{session_id}/generate`

타이핑 패턴과 감정 프로필을 기반으로 개인화된 AI 음악을 생성합니다.

#### 경로 파라미터

- `session_id` (string): 세션 ID

#### 헤더

- `Authorization: Bearer <session_token>` (필수)

#### 요청 본문

```json
{
  "user_prompt": "차분하고 집중할 수 있는 피아노 음악",
  "generation_options": {
    "duration": 60,
    "style": "classical",
    "instruments": ["piano", "strings"],
    "tempo": "moderate"
  },
  "use_latest_analysis": true
}
```

#### 응답 (201 Created)

```json
{
  "generation_id": "gen_1234567890abcdef",
  "session_id": "ses_1234567890abcdef",
  "status": "processing",
  "estimated_completion_time": 30,
  "emotion_summary": {
    "dominant_emotion": "calm",
    "intensity": 0.65,
    "musical_interpretation": {
      "tempo": "andante",
      "key": "C major",
      "mood": "peaceful"
    }
  },
  "music_prompt": {
    "ai_prompt": "Generate a calm, peaceful piano piece in C major with gentle string accompaniment, tempo andante, expressing tranquility and focus",
    "generation_parameters": {
      "model": "musicgen-large",
      "duration": 60,
      "sample_rate": 44100,
      "guidance_scale": 3.5
    }
  },
  "progress": {
    "current_stage": "prompt_processing",
    "completion_percentage": 15,
    "stages": [
      "prompt_processing",
      "ai_generation",
      "audio_processing",
      "file_preparation"
    ]
  },
  "created_at": "2024-01-15T10:40:00Z"
}
```

## 음악 조회 및 다운로드 API

### 생성된 음악 정보 조회

**GET** `/v1/sessions/{session_id}/music/{music_id}`

생성된 음악의 상세 정보를 조회합니다.

#### 경로 파라미터

- `session_id` (string): 세션 ID
- `music_id` (string): 음악 ID

#### 헤더

- `Authorization: Bearer <session_token>` (필수)

#### 응답 (200 OK)

```json
{
  "id": "mus_1234567890abcdef",
  "generation_id": "gen_1234567890abcdef",
  "session_id": "ses_1234567890abcdef",
  "status": "completed",
  "file_info": {
    "filename": "vibemusic_calm_20240115_103500.wav",
    "file_size": 5242880,
    "duration": 60.5,
    "format": "wav",
    "sample_rate": 44100,
    "channels": 2,
    "bit_depth": 16
  },
  "generation_progress": {
    "current_stage": "completed",
    "completion_percentage": 100,
    "started_at": "2024-01-15T10:40:00Z",
    "completed_at": "2024-01-15T10:40:28Z",
    "total_duration": 28
  },
  "prompt_info": {
    "user_prompt": "차분하고 집중할 수 있는 피아노 음악",
    "ai_prompt": "Generate a calm, peaceful piano piece in C major...",
    "emotion_context": {
      "dominant_emotion": "calm",
      "intensity": 0.65,
      "musical_mapping": {
        "tempo": "andante",
        "key": "C major",
        "instruments": ["piano", "strings"]
      }
    }
  },
  "created_at": "2024-01-15T10:40:00Z",
  "download_url": "/v1/sessions/ses_1234567890abcdef/music/mus_1234567890abcdef/download"
}
```

### 음악 파일 다운로드

**GET** `/v1/sessions/{session_id}/music/{music_id}/download`

생성된 음악 파일을 다운로드합니다.

#### 경로 파라미터

- `session_id` (string): 세션 ID
- `music_id` (string): 음악 ID

#### 헤더

- `Authorization: Bearer <session_token>` (필수)

#### 응답 (200 OK)

음악 파일 바이너리 데이터 (Content-Type: audio/wav)

## WebSocket API

### 실시간 타이핑 캡처

**WebSocket** `/v1/ws/{session_id}`

실시간 키보드 이벤트 수집을 위한 WebSocket 연결입니다.

#### 연결 파라미터

- `session_id` (string): 세션 ID
- `token` (query parameter): 세션 토큰

#### 연결 URL 예시

```
ws://localhost:8000/v1/ws/ses_1234567890abcdef?token=tok_abcdef1234567890
```

#### 메시지 형식

**클라이언트 → 서버**

```json
{
  "type": "keystroke",
  "data": {
    "key": "a",
    "timestamp": 1705310400000,
    "duration": 120,
    "interval": 180,
    "metadata": {
      "shift": false,
      "ctrl": false,
      "alt": false
    }
  }
}
```

**서버 → 클라이언트**

```json
{
  "type": "analysis_update",
  "data": {
    "current_emotion": "focused",
    "confidence": 0.8,
    "suggestions": {
      "music_style": "ambient",
      "tempo": "slow"
    }
  }
}
```

## 헬스 체크 API

### 전체 서비스 상태

**GET** `/`

서비스 전체 상태를 확인합니다.

#### 응답 (200 OK)

```json
{
  "message": "Welcome to VibeMusic!",
  "version": "1.0.0",
  "status": "healthy",
  "api_docs": "/docs",
  "api_v1": "/v1/"
}
```

### API 상태 확인

**GET** `/v1/health`

API 서비스 상태를 확인합니다.

#### 응답 (200 OK)

```json
{
  "status": "healthy",
  "service": "vibemusic-backend",
  "version": "1.0.0"
}
```

### 세션 API 상태 확인

**GET** `/v1/sessions/health`

세션 관리 API 상태를 확인합니다.

#### 응답 (200 OK)

```json
{
  "status": "healthy",
  "service": "sessions-api",
  "version": "1.0.0",
  "database": "connected",
  "session_statistics": {
    "total_sessions": 150,
    "active_sessions": 12,
    "total_music_generated": 89
  },
  "timestamp": "2024-01-15T10:45:00Z"
}
```

## 에러 응답 형식

모든 API 엔드포인트는 동일한 에러 응답 형식을 사용합니다.

### 표준 에러 응답

```json
{
  "error": "ERROR_CODE",
  "message": "사용자 친화적인 에러 메시지",
  "details": {
    "additional_info": "추가 정보"
  }
}
```

### 주요 에러 코드

| 상태 코드 | 에러 코드 | 설명 |
|-----------|-----------|------|
| 400 | `INVALID_REQUEST` | 잘못된 요청 파라미터 |
| 401 | `MISSING_TOKEN` | 세션 토큰이 없음 |
| 401 | `INVALID_TOKEN` | 유효하지 않은 세션 토큰 |
| 403 | `ACCESS_DENIED` | 접근 권한 없음 |
| 404 | `SESSION_NOT_FOUND` | 세션을 찾을 수 없음 |
| 404 | `MUSIC_NOT_FOUND` | 음악을 찾을 수 없음 |
| 422 | `VALIDATION_ERROR` | 데이터 검증 실패 |
| 500 | `INTERNAL_SERVER_ERROR` | 서버 내부 오류 |

## 요청/응답 예시

### 전체 워크플로우 예시

1. **세션 생성**
   ```bash
   curl -X POST "http://localhost:8000/v1/sessions/" \
     -H "Content-Type: application/json" \
     -d '{"consent_given": true}'
   ```

2. **타이핑 패턴 분석**
   ```bash
   curl -X POST "http://localhost:8000/v1/sessions/ses_123/analyze" \
     -H "Authorization: Bearer tok_abc" \
     -H "Content-Type: application/json" \
     -d '{
       "keystroke_data": [...],
       "text_content": "hello world"
     }'
   ```

3. **음악 생성**
   ```bash
   curl -X POST "http://localhost:8000/v1/sessions/ses_123/generate" \
     -H "Authorization: Bearer tok_abc" \
     -H "Content-Type: application/json" \
     -d '{
       "user_prompt": "차분한 피아노 음악",
       "use_latest_analysis": true
     }'
   ```

4. **음악 다운로드**
   ```bash
   curl -X GET "http://localhost:8000/v1/sessions/ses_123/music/mus_456/download" \
     -H "Authorization: Bearer tok_abc" \
     -o "generated_music.wav"
   ```

## 개발자 가이드

### API 클라이언트 구현 팁

1. **세션 토큰 관리**: 토큰을 안전하게 저장하고 만료 시 새로 발급받으세요
2. **에러 처리**: 모든 에러 응답에서 `error` 코드를 확인하여 적절히 처리하세요
3. **비동기 처리**: 음악 생성은 시간이 걸리므로 폴링 또는 WebSocket을 활용하세요
4. **파일 처리**: 음악 다운로드 시 적절한 MIME 타입과 파일 확장자를 설정하세요

### 성능 최적화

1. **연결 재사용**: HTTP 연결을 재사용하여 성능을 향상하세요
2. **압축 활용**: `Accept-Encoding: gzip` 헤더를 사용하세요
3. **캐싱**: 적절한 캐싱 정책을 구현하세요
4. **배치 처리**: 가능한 경우 여러 요청을 배치로 처리하세요

## 버전 관리

- **현재 버전**: v1.0.0
- **호환성**: 마이너 버전 업데이트는 하위 호환성 보장
- **업데이트 정책**: 주요 변경사항은 사전 공지 후 적용

## 지원 및 문의

- **개발자 문서**: `/docs` (Swagger UI)
- **API 참조**: `/redoc` (ReDoc)
- **이슈 리포트**: GitHub Issues
- **기술 지원**: dev@vibemusic.com

---

*이 문서는 VibeMusic API v1.0.0을 기준으로 작성되었습니다. 최신 정보는 `/docs` 페이지에서 확인하실 수 있습니다.*