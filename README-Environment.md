# VibeMusic 환경 설정 가이드

## 🚨 보안 주의사항

**중요: 실제 환경 변수 파일들은 절대 Git에 커밋하지 마세요!**

현재 `.gitignore`에 다음 파일들이 제외되어 있습니다:
- `.env.development`
- `.env.staging`
- `.env.production`
- `secrets/` 디렉토리 전체

## 환경 설정 순서

### 1. 개발 환경 설정

```bash
# 환경 설정 스크립트 사용
./scripts/environment-setup.sh init dev

# 또는 수동으로
cp .env.example .env.development
# .env.development 파일을 편집하여 개발용 값들로 변경
```

### 2. 스테이징 환경 설정

```bash
# 환경 설정 스크립트 사용
./scripts/environment-setup.sh init staging

# 비밀 키 생성
./scripts/environment-setup.sh secrets staging

# 설정 검증
./scripts/environment-setup.sh validate staging
```

### 3. 프로덕션 환경 설정

```bash
# 환경 설정 스크립트 사용
./scripts/environment-setup.sh init production

# 강력한 비밀 키 생성
./scripts/environment-setup.sh secrets production --force

# 보안 검증 (엄격한 검사)
./scripts/environment-setup.sh validate production --verbose
```

## 환경 전환

```bash
# 개발 환경으로 전환
./scripts/environment-setup.sh switch dev

# 프로덕션 환경으로 전환
./scripts/environment-setup.sh switch prod

# 현재 환경 상태 확인
./scripts/environment-setup.sh status
```

## Docker Compose 환경별 실행

### 개발 환경
```bash
# 개발 환경 실행 (핫 리로드 포함)
docker-compose -f docker-compose.development.yml up -d

# 개발 도구 포함 실행
docker-compose -f docker-compose.development.yml --profile tools up -d
```

### 프로덕션 환경
```bash
# 프로덕션 환경 실행
docker-compose -f docker-compose.production.yml up -d

# 모니터링 포함 실행
docker-compose -f docker-compose.production.yml --profile monitoring up -d
```

## 필수 변경사항

### 개발 환경 (.env.development)
- 기본값 그대로 사용 가능
- 로컬 데이터베이스 연결 정보만 확인

### 스테이징 환경 (.env.staging)
- 모든 `CHANGE_ME_STAGING_*` 값들을 실제 값으로 변경
- 데이터베이스 호스트를 실제 스테이징 서버로 변경
- SSL 인증서 경로 설정

### 프로덕션 환경 (.env.production)
- **모든** `CHANGE_ME_PRODUCTION_*` 값들을 강력한 실제 값으로 변경
- 64자 이상의 무작위 비밀 키 사용
- 데이터베이스 호스트를 실제 프로덕션 서버로 변경
- SSL 인증서 경로 설정
- CORS 도메인을 실제 도메인으로 변경

## 비밀 키 관리

### 자동 생성 (권장)
```bash
# 환경별 비밀 키 자동 생성
./scripts/environment-setup.sh secrets production

# 생성된 파일들:
# - secrets/db_password.txt
# - secrets/redis_password.txt
# - secrets/jwt_secret.txt
# - secrets/app_secret.txt
```

### 수동 생성
```bash
# 데이터베이스 비밀번호 (32자)
openssl rand -base64 32

# JWT 비밀 키 (64자)
openssl rand -base64 64

# 애플리케이션 비밀 키 (64자)
openssl rand -base64 64
```

## 보안 체크리스트

### 개발 환경
- [ ] `.env.development` 파일이 Git에 커밋되지 않음
- [ ] 기본 비밀번호가 아닌 값 사용

### 스테이징 환경
- [ ] `.env.staging` 파일이 Git에 커밋되지 않음
- [ ] 모든 `CHANGE_ME` 값들이 변경됨
- [ ] SSL 인증서가 설정됨
- [ ] 실제 외부 서비스 API 키 사용

### 프로덕션 환경
- [ ] `.env.production` 파일이 Git에 커밋되지 않음
- [ ] 64자 이상의 강력한 비밀 키 사용
- [ ] 복잡한 데이터베이스 비밀번호 사용
- [ ] DEBUG 모드 비활성화 확인
- [ ] SSL 강제 사용 설정
- [ ] 제한적 CORS 도메인 설정
- [ ] 보안 헤더 모든 설정 활성화
- [ ] Rate limiting 엄격하게 설정

## 환경별 특징

| 환경 | 포트 | 로그 레벨 | SSL | 디버깅 | Rate Limit |
|------|------|-----------|-----|--------|------------|
| Development | 3000, 8000 | debug | 비활성화 | 활성화 | 완화 |
| Staging | 80, 443 | info | 활성화 | 비활성화 | 보통 |
| Production | 80, 443 | warning | 활성화 | 비활성화 | 엄격 |

## 문제 해결

### 환경 변수 오류
```bash
# 환경 설정 검증
./scripts/environment-setup.sh validate [env] --verbose

# 누락된 변수 확인
grep "CHANGE_ME" .env.production
```

### Docker 빌드 오류
```bash
# Docker Compose 설정 검증
docker-compose -f docker-compose.production.yml config
```

### 권한 오류
```bash
# secrets 디렉토리 권한 수정
chmod 700 secrets/
chmod 600 secrets/*.txt
```