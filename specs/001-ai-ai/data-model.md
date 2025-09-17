# 데이터 모델 - 바이브뮤직

**Phase 1 Output** | **Date**: 2025-09-14 | **Feature**: 001-ai-ai

## 핵심 엔티티

### TypingPattern (타이핑 패턴)

**목적**: 사용자의 키보드 입력 타이밍과 리듬 데이터를 저장

**필드**:
- `id` (UUID): 고유 식별자
- `session_id` (UUID): 연관된 사용자 세션 ID
- `keystrokes` (JSON Array): 키 입력 데이터 배열
  - `key`: 입력된 키
  - `timestamp`: 정확한 타이밍 (밀리초)
  - `duration`: 키를 누른 지속 시간
  - `type`: 'keydown' | 'keyup'
- `created_at` (DateTime): 생성 시간
- `text_content` (Text): 입력된 텍스트 내용

**검증 규칙**:
- keystrokes 배열은 최소 10개 이상의 키 입력 포함
- timestamp는 단조 증가 순서
- session_id는 유효한 UserSession 참조

**상태 전이**:
```
capturing → analyzing → processed
```

### EmotionProfile (감정 프로필)

**목적**: 타이핑 패턴에서 추출된 감정적 특성을 저장

**필드**:
- `id` (UUID): 고유 식별자
- `pattern_id` (UUID): 연관된 TypingPattern ID
- `tempo_score` (Float): 타이핑 속도 점수 (0.0-1.0)
- `rhythm_consistency` (Float): 리듬 일관성 (0.0-1.0)
- `pause_intensity` (Float): 일시정지 강도 (0.0-1.0)
- `emotion_vector` (JSON): 감정 벡터
  - `energy`: 에너지 레벨 (0.0-1.0)
  - `valence`: 감정 긍정도 (-1.0-1.0)
  - `tension`: 긴장도 (0.0-1.0)
  - `focus`: 집중도 (0.0-1.0)
- `confidence_score` (Float): 분석 신뢰도 (0.0-1.0)
- `created_at` (DateTime): 생성 시간

**검증 규칙**:
- 모든 점수는 지정된 범위 내
- emotion_vector의 모든 값은 유효한 범위 내
- confidence_score가 0.3 미만이면 경고 표시

**관계**:
- TypingPattern과 1:1 관계

### MusicPrompt (음악 프롬프트)

**목적**: 텍스트 프롬프트와 감정 메타데이터를 결합한 음악 생성 입력

**필드**:
- `id` (UUID): 고유 식별자
- `session_id` (UUID): 연관된 사용자 세션 ID
- `text_prompt` (Text): 사용자가 입력한 텍스트
- `emotion_profile_id` (UUID): 연관된 감정 프로필 ID
- `enhanced_prompt` (Text): 감정 데이터가 추가된 최종 프롬프트
- `generation_parameters` (JSON): 음악 생성 파라미터
  - `duration`: 생성할 음악 길이 (초)
  - `genre_hint`: 장르 힌트
  - `tempo_bpm`: 예상 BPM
  - `mood_tags`: 무드 태그 배열
- `created_at` (DateTime): 생성 시간

**검증 규칙**:
- text_prompt는 10자 이상 500자 이하
- emotion_profile_id는 유효한 EmotionProfile 참조
- duration은 15-120초 범위

**관계**:
- UserSession과 N:1 관계
- EmotionProfile과 1:1 관계

### GeneratedMusic (생성된 음악)

**목적**: AI에 의해 생성된 음악 파일과 메타데이터를 저장

**필드**:
- `id` (UUID): 고유 식별자
- `prompt_id` (UUID): 연관된 MusicPrompt ID
- `file_url` (String): 음악 파일 URL
- `file_size` (Integer): 파일 크기 (바이트)
- `duration` (Integer): 실제 음악 길이 (초)
- `format` (String): 파일 형식 ('wav', 'mp3', 'flac')
- `sample_rate` (Integer): 샘플링 레이트 (Hz)
- `generation_time` (Float): 생성 소요 시간 (초)
- `ai_model_version` (String): 사용된 AI 모델 버전
- `quality_score` (Float): 음질 점수 (0.0-1.0, optional)
- `status` (String): 'generating' | 'completed' | 'failed'
- `error_message` (String, nullable): 실패 시 오류 메시지
- `created_at` (DateTime): 생성 시작 시간
- `completed_at` (DateTime, nullable): 생성 완료 시간

**검증 규칙**:
- file_url은 status가 'completed'일 때 필수
- generation_time은 양수
- 지원되는 format: wav, mp3, flac

**상태 전이**:
```
generating → completed
generating → failed
```

### UserSession (사용자 세션)

**목적**: 프롬프트 생성부터 음악 완성까지의 완전한 사용자 상호작용을 추적

**필드**:
- `id` (UUID): 고유 식별자
- `user_agent` (String): 브라우저 정보
- `ip_address` (String): 사용자 IP (개인정보 보호를 위해 해시처리)
- `session_token` (String): 세션 인증 토큰
- `start_time` (DateTime): 세션 시작 시간
- `end_time` (DateTime, nullable): 세션 종료 시간
- `status` (String): 'active' | 'completed' | 'abandoned'
- `total_typing_time` (Integer): 총 타이핑 시간 (초)
- `total_music_generated` (Integer): 생성된 음악 개수
- `consent_given` (Boolean): 데이터 수집 동의 여부
- `auto_delete_at` (DateTime): 자동 삭제 예정 시간
- `metadata` (JSON): 추가 세션 메타데이터

**검증 규칙**:
- session_token은 고유값
- consent_given이 false면 데이터 수집 불가
- auto_delete_at은 생성 후 24시간 후 설정

**관계**:
- TypingPattern과 1:N 관계
- MusicPrompt와 1:N 관계
- GeneratedMusic과 1:N 관계 (through MusicPrompt)

## 데이터베이스 스키마

### PostgreSQL DDL

```sql
-- 사용자 세션
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_agent VARCHAR(512),
    ip_address_hash VARCHAR(64),
    session_token VARCHAR(128) UNIQUE NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'active',
    total_typing_time INTEGER DEFAULT 0,
    total_music_generated INTEGER DEFAULT 0,
    consent_given BOOLEAN DEFAULT FALSE,
    auto_delete_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB
);

-- 타이핑 패턴
CREATE TABLE typing_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES user_sessions(id) ON DELETE CASCADE,
    keystrokes JSONB NOT NULL,
    text_content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 감정 프로필
CREATE TABLE emotion_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_id UUID REFERENCES typing_patterns(id) ON DELETE CASCADE,
    tempo_score DECIMAL(3,2),
    rhythm_consistency DECIMAL(3,2),
    pause_intensity DECIMAL(3,2),
    emotion_vector JSONB NOT NULL,
    confidence_score DECIMAL(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 음악 프롬프트
CREATE TABLE music_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES user_sessions(id) ON DELETE CASCADE,
    emotion_profile_id UUID REFERENCES emotion_profiles(id),
    text_prompt TEXT NOT NULL,
    enhanced_prompt TEXT,
    generation_parameters JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 생성된 음악
CREATE TABLE generated_music (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_id UUID REFERENCES music_prompts(id) ON DELETE CASCADE,
    file_url VARCHAR(512),
    file_size BIGINT,
    duration INTEGER,
    format VARCHAR(10),
    sample_rate INTEGER,
    generation_time DECIMAL(5,2),
    ai_model_version VARCHAR(50),
    quality_score DECIMAL(3,2),
    status VARCHAR(20) DEFAULT 'generating',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 인덱스
CREATE INDEX idx_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_sessions_auto_delete ON user_sessions(auto_delete_at);
CREATE INDEX idx_patterns_session ON typing_patterns(session_id);
CREATE INDEX idx_emotions_pattern ON emotion_profiles(pattern_id);
CREATE INDEX idx_prompts_session ON music_prompts(session_id);
CREATE INDEX idx_music_prompt ON generated_music(prompt_id);
CREATE INDEX idx_music_status ON generated_music(status);
```

## 데이터 보관 정책

**개인정보 보호**:
- 사용자 동의 없이 데이터 수집 금지
- IP 주소는 해시 처리하여 저장
- 24시간 후 자동 삭제 옵션 제공

**성능 최적화**:
- Redis를 이용한 실시간 데이터 캐싱
- 완료된 세션 데이터는 별도 아카이브 테이블로 이관
- 30일 후 자동 물리적 삭제

---

**Next**: API 계약 정의 (contracts/) 및 quickstart 시나리오