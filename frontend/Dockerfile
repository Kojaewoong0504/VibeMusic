# 멀티스테이지 빌드로 최적화된 React 프로덕션 Dockerfile

# Stage 1: 빌드 스테이지 (Node.js 빌드 환경)
FROM node:18-alpine as builder

# 작업 디렉토리 설정
WORKDIR /app

# Node.js 최적화 설정
ENV NODE_ENV=production
ENV CI=true
ENV GENERATE_SOURCEMAP=false

# 패키지 파일 복사 (의존성 캐싱 최적화)
COPY package*.json ./

# 프로덕션 의존성만 설치 (devDependencies 제외)
RUN npm ci --only=production --silent

# 빌드를 위한 devDependencies 설치
RUN npm ci --silent

# 소스 코드 복사
COPY . .

# TypeScript 타입 체크 및 빌드
RUN npm run type-check
RUN npm run build

# 빌드 결과물 최적화 (불필요한 파일 제거)
RUN npm prune --production

# Stage 2: 런타임 스테이지 (Nginx를 사용한 정적 파일 서빙)
FROM nginx:1.25-alpine as runtime

# 보안을 위한 non-root 유저 설정
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

# Nginx 설정 파일 복사
COPY nginx/default.conf* /etc/nginx/conf.d/default.conf

# 기본 Nginx 설정이 없다면 기본값 사용
RUN if [ ! -f /etc/nginx/conf.d/default.conf ]; then \
    cat > /etc/nginx/conf.d/default.conf << 'EOF' \
server { \
    listen 80; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html index.htm; \
    \
    # Gzip 압축 활성화 \
    gzip on; \
    gzip_vary on; \
    gzip_min_length 1024; \
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json; \
    \
    # 정적 파일 캐싱 \
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ { \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
    } \
    \
    # SPA를 위한 fallback \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    \
    # 헬스체크 엔드포인트 \
    location /health { \
        access_log off; \
        return 200 "healthy\n"; \
        add_header Content-Type text/plain; \
    } \
} \
EOF \
    ; fi

# 빌드 스테이지에서 빌드된 정적 파일 복사
COPY --from=builder /app/dist /usr/share/nginx/html

# 권한 설정
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d

# non-root 사용자로 실행하기 위한 설정
RUN touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# 헬스체크 추가
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:80/health || exit 1

# 포트 노출
EXPOSE 80

# non-root 사용자로 전환
USER nginx

# Nginx 실행
CMD ["nginx", "-g", "daemon off;"]