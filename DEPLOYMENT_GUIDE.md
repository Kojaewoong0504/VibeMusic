# 🚀 VibeMusic 실제 배포 가이드

## 📋 필수 설정 항목

실제 서비스 배포를 위해 반드시 설정해야 하는 항목들입니다.

### 🔑 1. 필수 API 키 및 외부 서비스

#### AI 음악 생성 API (필수)
**현재 상태**: 목업 API 사용 중
**필요한 작업**: 실제 AI 음악 생성 서비스 연동

**권장 서비스**:
- **MusicGen (Meta)**: Hugging Face 또는 Replicate API
- **Suno AI**: 상업적 음악 생성 API
- **AIVA**: AI 작곡 플랫폼
- **OpenAI Jukebox**: 연구용 (상업적 사용 제한)

**설정 방법**:
```bash
# .env.prod 파일에서 설정
AI_MUSIC_API_URL="https://api.replicate.com/v1"  # 예시
AI_MUSIC_API_KEY="r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"  # 실제 API 키
AI_MUSIC_TIMEOUT=90
AI_MUSIC_MAX_REQUESTS_PER_MINUTE=100
```

#### Sentry 모니터링 (권장)
**용도**: 오류 추적 및 성능 모니터링
```bash
SENTRY_DSN="https://xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@sentry.io/xxxxxxx"
SENTRY_SAMPLE_RATE=0.1
```

### 🔐 2. 보안 설정 (필수)

#### JWT 시크릿 키 (필수)
```bash
# 강력한 시크릿 키 생성 (최소 64자)
SECRET_KEY="your-super-secure-secret-key-here-min-64-characters-long"
```

**생성 방법**:
```bash
# 파이썬으로 생성
python -c "import secrets; print(secrets.token_urlsafe(64))"

# OpenSSL로 생성
openssl rand -base64 64
```

#### 데이터베이스 비밀번호 (필수)
```bash
DATABASE_URL="postgresql+asyncpg://vibemusic_prod:YOUR_STRONG_DB_PASSWORD@prod-db:5432/vibemusic_prod"
```

#### Redis 비밀번호 (권장)
```bash
REDIS_URL="redis://:YOUR_REDIS_PASSWORD@prod-redis:6379/0"
REDIS_PASSWORD="YOUR_REDIS_PASSWORD"
```

### 🌐 3. 도메인 및 CORS 설정

#### 실제 도메인 설정
```bash
# 실제 도메인으로 변경
CORS_ORIGINS="https://yourdomain.com,https://www.yourdomain.com,https://api.yourdomain.com"
```

#### SSL/TLS 인증서 (프로덕션 필수)
```bash
SSL_CERT_PATH="/etc/ssl/certs/yourdomain.pem"
SSL_KEY_PATH="/etc/ssl/private/yourdomain.key"
```

### 📊 4. 데이터베이스 설정

#### PostgreSQL 설정
- **최소 권장 사양**: 2GB RAM, SSD 스토리지
- **연결풀 설정**: 프로덕션 환경에 맞게 조정
```bash
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=30
```

### 📱 5. 프론트엔드 환경변수

#### 백엔드 API URL 설정
```bash
# frontend/.env.production
VITE_API_BASE_URL=https://api.yourdomain.com
VITE_WS_BASE_URL=wss://api.yourdomain.com
VITE_ENVIRONMENT=production
```

## 🐳 배포 방법

### 방법 1: Docker Compose (권장)

#### 1. 환경 설정 파일 준비
```bash
# 프로덕션 환경변수 복사
cp backend/.env.prod backend/.env

# 필수 값들 수정
vi backend/.env
```

#### 2. 프로덕션 배포
```bash
# 프로덕션 프로필로 실행
docker-compose --profile production up -d

# 또는 개별적으로 빌드 후 실행
docker-compose build
docker-compose --profile production up -d
```

#### 3. 데이터베이스 마이그레이션
```bash
# 컨테이너 내에서 마이그레이션 실행
docker exec vibemusic-api python -m alembic upgrade head
```

### 방법 2: 개별 서비스 배포

#### 백엔드 배포
```bash
cd backend

# 의존성 설치
pip install -r requirements.txt

# 환경변수 설정
export $(cat .env.prod | xargs)

# 데이터베이스 마이그레이션
python -m alembic upgrade head

# 서버 실행 (Gunicorn 권장)
gunicorn src.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

#### 프론트엔드 배포
```bash
cd frontend

# 의존성 설치
npm install

# 프로덕션 빌드
npm run build

# 정적 파일 서빙 (Nginx 권장)
# dist 폴더를 웹 서버에 배포
```

## 📋 배포 체크리스트

### 🔐 보안 체크리스트
- [ ] JWT 시크릿 키 변경
- [ ] 데이터베이스 비밀번호 변경
- [ ] Redis 비밀번호 설정
- [ ] DEBUG=False 설정
- [ ] CORS_ORIGINS 실제 도메인으로 변경
- [ ] SSL/TLS 인증서 설정
- [ ] 보안 헤더 활성화

### 🌐 네트워크 체크리스트
- [ ] 도메인 DNS 설정
- [ ] 로드밸런서 설정 (필요시)
- [ ] 방화벽 규칙 설정
- [ ] CDN 설정 (정적 파일용)

### 📊 모니터링 체크리스트
- [ ] Sentry 오류 추적 설정
- [ ] 로그 수집 시스템 설정
- [ ] 성능 모니터링 설정
- [ ] 알림 시스템 설정

### 🗄️ 데이터 체크리스트
- [ ] 데이터베이스 백업 설정
- [ ] 개인정보 보관 정책 확인
- [ ] 임시 파일 정리 주기 설정

## 🔧 운영 명령어

### 상태 확인
```bash
# 서비스 상태 확인
curl https://api.yourdomain.com/health

# 컨테이너 상태 확인
docker-compose ps

# 로그 확인
docker-compose logs -f api
```

### 업데이트 배포
```bash
# 이미지 업데이트
docker-compose pull

# 서비스 재시작
docker-compose --profile production up -d

# 데이터베이스 마이그레이션 (필요시)
docker exec vibemusic-api python -m alembic upgrade head
```

### 백업
```bash
# 데이터베이스 백업
docker exec vibemusic-db pg_dump -U vibemusic_prod vibemusic_prod > backup.sql

# Redis 백업
docker exec vibemusic-redis redis-cli --rdb backup.rdb
```

## ⚠️ 주의사항

### 개인정보 보호
- 사용자 데이터는 24시간 후 자동 삭제됩니다
- 타이핑 패턴 데이터는 익명화하여 처리됩니다
- GDPR/개인정보보호법 준수가 필요합니다

### 비용 최적화
- AI 음악 생성 API 호출 비용을 모니터링하세요
- Redis 메모리 사용량을 주기적으로 확인하세요
- 불필요한 로그는 정리하세요

### 스케일링
- 동시 사용자 증가 시 워커 수 조정: `WORKERS=8`
- 데이터베이스 연결풀 크기 조정: `DATABASE_POOL_SIZE=50`
- Redis 클러스터링 고려

## 📞 지원

문제 발생 시:
1. `/health` 엔드포인트로 서비스 상태 확인
2. 로그 파일 확인: `docker-compose logs`
3. 성능 테스트 실행: `python scripts/run_performance_tests.py`

---

**중요**: 실제 배포 전에 스테이징 환경에서 충분한 테스트를 진행하시기 바랍니다!