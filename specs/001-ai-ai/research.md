# 기술 연구 - 바이브뮤직 감정 기반 AI 음악 생성

**Phase 0 Output** | **Date**: 2025-09-14 | **Feature**: 001-ai-ai

## 키보드 타이핑 패턴 실시간 캡처 기술

**Decision**: JavaScript KeyboardEvent와 WebSocket을 이용한 실시간 타이핑 패턴 캡처

**Rationale**: 
- 브라우저에서 키보드 이벤트의 타임스탬프를 정확히 캡처 가능 (performance.now() 사용)
- WebSocket을 통해 실시간으로 백엔드에 데이터 전송 (<50ms 레이턴시 달성 가능)
- 브라우저 간 호환성 우수 (Chrome, Firefox, Safari 모두 지원)

**Alternatives considered**:
- HTTP 폴링: 레이턴시가 높아 실시간 패턴 캡처에 부적합
- Server-Sent Events: 단방향 통신으로 실시간 인터랙션 제한
- Socket.IO: 추가 의존성으로 복잡성 증가

**Implementation Details**:
```javascript
// 타이핑 패턴 캡처 예시
document.addEventListener('keydown', (event) => {
  const timestamp = performance.now();
  const pattern = {
    key: event.key,
    timestamp: timestamp,
    type: 'keydown'
  };
  websocket.send(JSON.stringify(pattern));
});
```

## 타이핑 패턴에서 감정 추출 알고리즘

**Decision**: 통계적 분석 기반 감정 매핑 + 기계학습 분류 모델

**Rationale**:
- 타이핑 속도, 리듬 변화, 일시정지 패턴을 통계적으로 분석
- 기존 연구에서 타이핑 패턴과 감정 상태 간 상관관계 입증됨
- scikit-learn을 이용한 간단한 분류 모델로 시작 가능

**Alternatives considered**:
- 딥러닝 모델: 초기 데이터 부족으로 오버피팅 위험
- 규칙 기반 시스템: 개인차를 반영하기 어려움
- 외부 감정 분석 API: 타이핑 패턴 특화 모델 부재

**Emotion Mapping Strategy**:
- 빠른 타이핑 → 흥분, 급함, 에너지
- 느린 타이핑 → 차분함, 사색적, 우울
- 불규칙한 리듬 → 불안, 스트레스
- 긴 일시정지 → 집중, 고민, 망설임

## AI 음악 생성 API 선택 및 연동

**Decision**: MusicGen (Facebook/Meta) API 또는 OpenAI의 Jukebox 활용

**Rationale**:
- MusicGen: 프롬프트 기반 음악 생성에 최적화, 30초 내 생성 가능
- 상업적 이용 가능한 라이선스
- REST API 형태로 쉬운 통합 가능
- 품질 높은 오디오 출력 (44.1kHz)

**Alternatives considered**:
- AIVA: 비용이 높고 API 제한 많음
- Amper Music: 서비스 종료됨
- MuseNet (OpenAI): 더 이상 공개 API 제공하지 않음
- 자체 모델 훈련: 리소스와 시간 부족

**Integration Approach**:
```python
# AI 음악 생성 연동 예시
async def generate_music(prompt: str, emotion_data: dict):
    combined_prompt = f"{prompt} [tempo:{emotion_data['tempo']}] [mood:{emotion_data['mood']}]"
    response = await musicgen_client.generate(
        prompt=combined_prompt,
        duration=30,
        format="wav"
    )
    return response.audio_url
```

## WebSocket을 이용한 실시간 데이터 처리

**Decision**: FastAPI WebSocket + Redis 기반 실시간 처리 아키텍처

**Rationale**:
- FastAPI의 내장 WebSocket 지원으로 간단한 구현
- Redis를 버퍼로 사용하여 실시간 데이터 처리 성능 최적화
- 수평 확장 가능한 아키텍처

**Alternatives considered**:
- Django Channels: FastAPI보다 복잡하고 성능 낮음
- Socket.IO with Node.js: Python 생태계와 별도 관리 필요
- gRPC streaming: 웹 브라우저 지원 제한적

**Architecture Pattern**:
```
Browser → WebSocket → FastAPI → Redis → Pattern Analyzer → Emotion Mapper
```

## FastAPI + React 모노레포 배포

**Decision**: Docker Compose를 이용한 모노레포 배포 + Nginx 리버스 프록시

**Rationale**:
- 단일 저장소에서 백엔드/프론트엔드 관리 용이
- Docker로 환경 일관성 보장
- Nginx로 정적 파일 서빙과 API 라우팅 분리

**Alternatives considered**:
- Kubernetes: 초기 복잡성 대비 이점 부족
- Vercel/Netlify 분리 배포: 개발 환경 복잡성 증가
- 단일 FastAPI에서 정적 파일 서빙: 성능 이슈

**Deployment Structure**:
```yaml
# docker-compose.yml
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
  nginx:
    image: nginx:alpine
    ports: ["80:80"]
  postgres:
    image: postgres:15
  redis:
    image: redis:alpine
```

## 브라우저별 키보드 이벤트 호환성

**Decision**: 표준 KeyboardEvent API 사용 + 브라우저별 polyfill

**Rationale**:
- 모든 주요 브라우저에서 KeyboardEvent 지원
- performance.now()로 고정밀 타이밍 측정 가능
- 크로스 브라우저 라이브러리로 호환성 보장

**Browser Support Matrix**:
- Chrome 88+ : 완전 지원
- Firefox 85+ : 완전 지원  
- Safari 14+ : 완전 지원
- Edge 88+ : 완전 지원

**Compatibility Strategy**:
```javascript
// 브라우저 호환성 처리
const getTimestamp = () => {
  return performance.now ? performance.now() : Date.now();
};

const isKeyEventSupported = () => {
  return 'KeyboardEvent' in window && 'key' in KeyboardEvent.prototype;
};
```

## 성능 최적화 전략

**Decision**: 클라이언트 사이드 버퍼링 + 서버 사이드 배치 처리

**Rationale**:
- 모든 키 입력을 실시간 전송하면 네트워크 오버헤드 발생
- 100ms 단위로 버퍼링하여 배치 전송으로 효율성 개선
- 서버에서 Redis를 이용한 비동기 처리로 응답성 확보

**Performance Targets**:
- 키 입력 레이턴시: <50ms
- WebSocket 연결 유지: >1시간
- 동시 연결 지원: 1,000개
- 음악 생성 응답: <30초

## 보안 고려사항

**Decision**: HTTPS 필수 + 사용자 세션 토큰 기반 인증

**Rationale**:
- 타이핑 패턴은 민감한 개인 정보로 간주
- WebSocket 연결에 대한 인증 필요
- GDPR/개인정보보호법 준수를 위한 데이터 암호화

**Security Measures**:
- TLS 1.3 암호화 통신
- JWT 토큰 기반 세션 관리
- 타이핑 데이터 수집 동의 절차
- 24시간 후 자동 데이터 삭제 옵션

---

**Research Complete**: 모든 주요 기술적 의사결정 완료  
**Next Phase**: Design & Contracts (data-model.md, contracts/, quickstart.md)