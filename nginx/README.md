# VibeMusic Nginx 설정 가이드

## 📋 개요

VibeMusic 프로젝트를 위한 고성능 Nginx 리버스 프록시 설정입니다. HTTP/HTTPS 트래픽 관리, WebSocket 지원, SSL/TLS 보안, 그리고 성능 최적화가 포함되어 있습니다.

## 📁 디렉토리 구조

```
nginx/
├── nginx.conf                 # 메인 Nginx 설정 파일
├── conf.d/
│   └── vibemusic.conf         # VibeMusic 사이트별 설정
├── ssl/
│   ├── .gitkeep               # SSL 인증서 디렉토리
│   ├── generate-dev-cert.sh   # 개발용 자체 서명 인증서 생성 스크립트
│   └── letsencrypt-setup.yml  # Let's Encrypt SSL 설정
└── README.md                  # 이 파일
```

## 🚀 사용 방법

### 개발 환경 설정

#### 1. 개발용 SSL 인증서 생성

```bash
cd nginx/ssl
./generate-dev-cert.sh
```

#### 2. 개발 서버 실행

```bash
# 개발 프로파일 (프론트엔드 포트 3000, API 포트 8000)
docker-compose --profile development up -d

# 브라우저에서 접속
# - 프론트엔드: http://localhost:3000
# - API 문서: http://localhost:8000/docs
```

### 프로덕션 환경 설정

#### 1. SSL 인증서 준비

**옵션 A: 자체 서명 인증서 (테스트용)**
```bash
cd nginx/ssl
./generate-dev-cert.sh
```

**옵션 B: Let's Encrypt (권장)**
```bash
# 도메인 설정 후 Let's Encrypt 컨테이너 실행
docker-compose --profile ssl up certbot
```

#### 2. 프로덕션 서버 실행

```bash
# 프로덕션 프로파일 (Nginx 리버스 프록시)
docker-compose --profile production up -d

# 브라우저에서 접속
# - HTTPS: https://localhost
# - HTTP (HTTPS로 리디렉션): http://localhost
```

## 🔧 설정 세부사항

### 라우팅 구조

```
┌─────────────────┐    ┌──────────────────┐
│                 │    │                  │
│   사용자 요청    │────▶│   Nginx (443)    │
│                 │    │                  │
└─────────────────┘    └──────────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
                ▼               ▼               ▼
        ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
        │             │ │             │ │             │
        │ 정적 파일    │ │ API 요청    │ │ WebSocket   │
        │ (/)         │ │ (/v1/*)     │ │ (/v1/ws/*)  │
        │             │ │             │ │             │
        └─────────────┘ └─────────────┘ └─────────────┘
                │               │               │
                ▼               ▼               ▼
        ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
        │ Frontend    │ │ FastAPI     │ │ FastAPI     │
        │ (React SPA) │ │ (REST API)  │ │ (WebSocket) │
        │ Port 80     │ │ Port 8000   │ │ Port 8000   │
        └─────────────┘ └─────────────┘ └─────────────┘
```

### 주요 기능

#### 🔒 보안 기능
- **SSL/TLS**: TLS 1.2/1.3 지원, 강력한 암호화 설정
- **보안 헤더**: XSS 보호, CSRF 방지, 콘텐츠 타입 보안
- **Rate Limiting**: API 요청 속도 제한 (10req/s)
- **HSTS**: HTTP Strict Transport Security 적용
- **CSP**: Content Security Policy 설정

#### ⚡ 성능 최적화
- **Gzip 압축**: 텍스트 기반 컨텐츠 압축
- **정적 파일 캐싱**: 1년 캐시 + immutable 설정
- **Keep-Alive**: 연결 재사용으로 지연시간 단축
- **업스트림 로드밸런싱**: Least connections 알고리즘
- **버퍼링**: 프록시 응답 최적화

#### 🌐 WebSocket 지원
- **실시간 통신**: 타이핑 패턴 분석용 WebSocket 프록시
- **연결 업그레이드**: HTTP → WebSocket 자동 업그레이드
- **장시간 연결**: 24시간 연결 타임아웃 설정
- **Rate Limiting**: WebSocket 연결 속도 제한 (5req/s)

#### 📊 모니터링
- **헬스체크**: `/health` 엔드포인트 제공
- **Nginx 상태**: `/nginx_status` (내부 네트워크만)
- **상세 로그**: 요청 시간, 업스트림 응답 시간 기록
- **액세스 로그**: 성능 분석용 구조화된 로그

## 🛠️ 커스터마이징

### 도메인 변경
`nginx/conf.d/vibemusic.conf`에서 `server_name` 수정:
```nginx
server_name your-domain.com www.your-domain.com;
```

### Rate Limiting 조정
`nginx/nginx.conf`에서 제한 수치 변경:
```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=20r/s;  # 20req/s로 증가
```

### SSL 인증서 경로 변경
`nginx/conf.d/vibemusic.conf`에서 경로 수정:
```nginx
ssl_certificate /etc/nginx/ssl/your-cert.crt;
ssl_certificate_key /etc/nginx/ssl/your-key.key;
```

## 🚨 문제해결

### 일반적인 문제

#### 1. SSL 인증서 오류
```bash
# 인증서 유효성 확인
openssl x509 -in nginx/ssl/vibemusic.crt -text -noout

# 개발용 인증서 재생성
cd nginx/ssl && ./generate-dev-cert.sh
```

#### 2. 업스트림 서버 연결 실패
```bash
# 컨테이너 상태 확인
docker-compose ps

# 네트워크 연결 확인
docker network inspect vibemusic-network
```

#### 3. WebSocket 연결 문제
브라우저 개발자 도구에서 네트워크 탭 확인:
- 업그레이드 헤더: `Connection: upgrade`
- 프로토콜: `websocket`

### 로그 확인
```bash
# Nginx 로그 확인
docker-compose logs nginx

# 실시간 로그 모니터링
docker-compose logs -f nginx

# 에러 로그 확인
docker exec vibemusic-nginx tail -f /var/log/nginx/error.log
```

## 📈 성능 튜닝

### 고부하 환경 최적화
```nginx
# nginx.conf에서 워커 프로세스 증가
worker_processes auto;
worker_connections 4096;

# 업스트림에 추가 서버 추가
upstream vibemusic_api {
    least_conn;
    server api-1:8000 max_fails=3 fail_timeout=30s;
    server api-2:8000 max_fails=3 fail_timeout=30s;
    keepalive 64;
}
```

### 캐싱 최적화
```nginx
# 정적 파일 캐시 시간 증가
expires 2y;

# 프록시 캐싱 활성화
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m;
proxy_cache api_cache;
proxy_cache_valid 200 302 10m;
```

## 🔧 개발자 명령어

### SSL 인증서 관리
```bash
# 개발용 인증서 생성
./nginx/ssl/generate-dev-cert.sh

# Let's Encrypt 인증서 발급 (프로덕션)
docker-compose exec certbot certbot certonly \
  --webroot -w /var/www/certbot \
  -d your-domain.com

# 인증서 갱신
docker-compose exec certbot certbot renew
```

### 설정 검증
```bash
# Nginx 설정 문법 검사
docker-compose exec nginx nginx -t

# 설정 다시 로드 (무중단)
docker-compose exec nginx nginx -s reload
```

### 모니터링
```bash
# 실시간 액세스 로그
docker exec vibemusic-nginx tail -f /var/log/nginx/access.log

# Nginx 상태 확인 (컨테이너 내부에서)
curl http://localhost/nginx_status
```

## 📚 참고 자료

- [Nginx 공식 문서](https://nginx.org/en/docs/)
- [Let's Encrypt 가이드](https://letsencrypt.org/getting-started/)
- [Nginx WebSocket 프록시](https://nginx.org/en/docs/http/websocket.html)
- [Nginx 성능 튜닝](https://nginx.org/en/docs/http/ngx_http_core_module.html#optimization)