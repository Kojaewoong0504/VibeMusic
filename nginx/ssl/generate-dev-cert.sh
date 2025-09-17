#!/bin/bash

# VibeMusic 개발용 자체 서명 SSL 인증서 생성 스크립트
# 주의: 프로덕션 환경에서는 사용하지 마세요!

set -e

echo "🔐 VibeMusic 개발용 SSL 인증서 생성 중..."

# 현재 스크립트 디렉토리로 이동
cd "$(dirname "$0")"

# OpenSSL이 설치되어 있는지 확인
if ! command -v openssl &> /dev/null; then
    echo "❌ OpenSSL이 설치되어 있지 않습니다."
    echo "   macOS: brew install openssl"
    echo "   Ubuntu/Debian: sudo apt-get install openssl"
    echo "   CentOS/RHEL: sudo yum install openssl"
    exit 1
fi

# 기존 인증서 파일 백업 (있다면)
if [ -f "vibemusic.crt" ] || [ -f "vibemusic.key" ]; then
    echo "⚠️  기존 인증서 파일을 백업합니다..."
    timestamp=$(date +%Y%m%d_%H%M%S)
    [ -f "vibemusic.crt" ] && mv "vibemusic.crt" "vibemusic.crt.backup_$timestamp"
    [ -f "vibemusic.key" ] && mv "vibemusic.key" "vibemusic.key.backup_$timestamp"
fi

# 인증서 설정 파일 생성
cat > vibemusic.conf << EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = KR
ST = Seoul
L = Seoul
O = VibeMusic Development
OU = Development Team
CN = localhost

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
DNS.3 = vibemusic.local
DNS.4 = *.vibemusic.local
IP.1 = 127.0.0.1
IP.2 = ::1
EOF

# 개인 키 생성 (4096비트 RSA)
echo "🔑 개인 키 생성 중..."
openssl genrsa -out vibemusic.key 4096

# 인증서 서명 요청(CSR) 생성
echo "📄 인증서 서명 요청 생성 중..."
openssl req -new -key vibemusic.key -out vibemusic.csr -config vibemusic.conf

# 자체 서명 인증서 생성 (10년 유효)
echo "📋 자체 서명 인증서 생성 중..."
openssl x509 -req -in vibemusic.csr -signkey vibemusic.key -out vibemusic.crt -days 3650 -extensions v3_req -extfile vibemusic.conf

# 권한 설정
echo "🔒 파일 권한 설정 중..."
chmod 600 vibemusic.key
chmod 644 vibemusic.crt

# 임시 파일 정리
rm -f vibemusic.conf vibemusic.csr

# 인증서 정보 출력
echo ""
echo "✅ SSL 인증서 생성 완료!"
echo ""
echo "📁 생성된 파일:"
echo "   - vibemusic.key (개인 키)"
echo "   - vibemusic.crt (인증서)"
echo ""
echo "📋 인증서 정보:"
openssl x509 -in vibemusic.crt -text -noout | grep -A 3 "Subject:"
echo ""
openssl x509 -in vibemusic.crt -text -noout | grep -A 10 "X509v3 Subject Alternative Name:"
echo ""
echo "📅 유효기간:"
openssl x509 -in vibemusic.crt -noout -dates
echo ""
echo "⚠️  주의사항:"
echo "   - 이 인증서는 개발용으로만 사용하세요"
echo "   - 브라우저에서 보안 경고가 표시될 수 있습니다"
echo "   - 프로덕션에서는 Let's Encrypt 또는 상용 인증서를 사용하세요"
echo ""
echo "🚀 사용 방법:"
echo "   1. Docker Compose 실행: docker-compose --profile production up -d"
echo "   2. 브라우저에서 https://localhost 접속"
echo "   3. 보안 경고 시 '고급' → '안전하지 않음으로 이동' 클릭"