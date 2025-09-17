#!/bin/bash

# VibeMusic 개발 환경 시작 스크립트
# quickstart.md의 Docker 실행 문제 해결

set -euo pipefail

# 색상 정의
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# 로그 함수들
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 현재 디렉토리가 프로젝트 루트인지 확인
check_project_root() {
    if [[ ! -f "docker-compose.yml" ]] || [[ ! -d "backend" ]] || [[ ! -d "frontend" ]]; then
        log_error "프로젝트 루트 디렉토리에서 실행해주세요"
        log_info "올바른 위치: vibemusic/ 디렉토리"
        exit 1
    fi
}

# Docker 및 Docker Compose 확인
check_dependencies() {
    log_info "의존성 확인 중..."

    if ! command -v docker >/dev/null 2>&1; then
        log_error "Docker가 설치되지 않았습니다"
        log_info "Docker Desktop을 설치하세요: https://docs.docker.com/get-docker/"
        exit 1
    fi

    if ! command -v docker-compose >/dev/null 2>&1; then
        log_error "Docker Compose가 설치되지 않았습니다"
        log_info "Docker Compose를 설치하세요: https://docs.docker.com/compose/install/"
        exit 1
    fi

    # Docker 데몬 실행 확인
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker 데몬이 실행되지 않았습니다"
        log_info "Docker Desktop을 시작하세요"
        exit 1
    fi

    log_success "의존성 확인 완료"
}

# 환경 설정 파일 확인
check_environment() {
    log_info "환경 설정 확인 중..."

    if [[ ! -f ".env.development" ]]; then
        log_warning ".env.development 파일이 없습니다. 생성 중..."

        if [[ -f ".env.example" ]]; then
            cp .env.example .env.development
            log_success ".env.development 생성 완료"
        else
            log_error ".env.example 파일을 찾을 수 없습니다"
            exit 1
        fi
    fi

    log_success "환경 설정 확인 완료"
}

# Docker 이미지 빌드 확인
check_docker_images() {
    log_info "Docker 이미지 확인 중..."

    # 백엔드 개발 Dockerfile 확인
    if [[ ! -f "backend/Dockerfile.dev" ]]; then
        log_warning "backend/Dockerfile.dev가 없습니다. Dockerfile을 복사합니다"
        if [[ -f "backend/Dockerfile" ]]; then
            cp backend/Dockerfile backend/Dockerfile.dev
            log_success "backend/Dockerfile.dev 생성 완료"
        fi
    fi

    # 프론트엔드 개발 Dockerfile 확인
    if [[ ! -f "frontend/Dockerfile.dev" ]]; then
        log_warning "frontend/Dockerfile.dev가 없습니다. 기본 개발용 Dockerfile을 생성합니다"
        cat > frontend/Dockerfile.dev << 'EOF'
FROM node:18-alpine

WORKDIR /app

# package.json 복사 및 의존성 설치
COPY package*.json ./
RUN npm install

# 소스 코드 복사
COPY . .

# 개발 서버 시작
EXPOSE 3000
CMD ["npm", "run", "dev"]
EOF
        log_success "frontend/Dockerfile.dev 생성 완료"
    fi
}

# 기존 컨테이너 정리
cleanup_containers() {
    log_info "기존 컨테이너 정리 중..."

    # 실행 중인 컨테이너 확인
    local running_containers
    running_containers=$(docker-compose ps -q 2>/dev/null || echo "")

    if [[ -n "$running_containers" ]]; then
        log_warning "기존 컨테이너를 정리합니다..."
        docker-compose down
        log_success "기존 컨테이너 정리 완료"
    fi
}

# 개발 환경 시작
start_development() {
    log_info "개발 환경 시작 중..."

    # 개발 프로필로 Docker Compose 실행
    log_info "Docker Compose 실행: development 프로필"

    if docker-compose --profile development up -d; then
        log_success "개발 환경 시작 완료"
    else
        log_error "개발 환경 시작 실패"
        log_info "환경별 파일로 재시도 중..."

        if [[ -f "docker-compose.development.yml" ]]; then
            if docker-compose -f docker-compose.development.yml up -d; then
                log_success "환경별 Docker Compose로 시작 완료"
            else
                log_error "환경별 Docker Compose도 실패했습니다"
                show_troubleshooting
                exit 1
            fi
        else
            log_error "docker-compose.development.yml 파일을 찾을 수 없습니다"
            show_troubleshooting
            exit 1
        fi
    fi
}

# 서비스 상태 확인
check_services() {
    log_info "서비스 상태 확인 중..."

    # 5초 대기 (서비스 시작 시간)
    sleep 5

    # 각 서비스 상태 확인
    local services=("db" "redis")
    local dev_services=("api-dev" "frontend-dev")

    # 기본 서비스 확인
    for service in "${services[@]}"; do
        if docker-compose ps "$service" | grep -q "Up"; then
            log_success "$service 서비스 정상 실행"
        else
            log_warning "$service 서비스 확인 필요"
        fi
    done

    # 개발 서비스 확인
    for service in "${dev_services[@]}"; do
        if docker-compose ps "$service" 2>/dev/null | grep -q "Up"; then
            log_success "$service 서비스 정상 실행"
        else
            log_warning "$service 서비스 확인 필요"
        fi
    done

    # 헬스체크
    log_info "헬스체크 수행 중..."

    # PostgreSQL 연결 테스트
    if docker-compose exec -T db pg_isready -U vibemusic -d vibemusic >/dev/null 2>&1; then
        log_success "PostgreSQL 연결 정상"
    else
        log_warning "PostgreSQL 연결 확인 필요"
    fi

    # Redis 연결 테스트
    if docker-compose exec -T redis redis-cli ping >/dev/null 2>&1; then
        log_success "Redis 연결 정상"
    else
        log_warning "Redis 연결 확인 필요"
    fi

    # API 헬스체크 (30초 대기 후)
    log_info "API 서버 시작 대기 중... (최대 30초)"
    local wait_count=0
    while [[ $wait_count -lt 30 ]]; do
        if curl -s http://localhost:8000/health >/dev/null 2>&1; then
            log_success "API 서버 헬스체크 정상"
            break
        fi
        sleep 1
        ((wait_count++))
    done

    if [[ $wait_count -eq 30 ]]; then
        log_warning "API 서버 헬스체크 타임아웃 (정상 시작 시간이 더 필요할 수 있습니다)"
    fi
}

# 접속 정보 출력
show_access_info() {
    log_info "개발 환경 접속 정보:"
    echo ""
    echo "🌐 프론트엔드: http://localhost:3000"
    echo "🔧 백엔드 API: http://localhost:8000"
    echo "📚 API 문서: http://localhost:8000/docs"
    echo "🗄️ PostgreSQL: localhost:5432"
    echo "🔄 Redis: localhost:6379"
    echo ""
    echo "📋 서비스 상태 확인: docker-compose ps"
    echo "📋 로그 확인: docker-compose logs -f [service_name]"
    echo "🛑 환경 종료: docker-compose down"
}

# 문제 해결 가이드
show_troubleshooting() {
    log_error "문제 해결 가이드:"
    echo ""
    echo "1. 포트 충돌 확인:"
    echo "   lsof -i :3000,8000,5432,6379"
    echo ""
    echo "2. Docker 로그 확인:"
    echo "   docker-compose logs"
    echo ""
    echo "3. 컨테이너 재시작:"
    echo "   docker-compose down && docker-compose --profile development up -d"
    echo ""
    echo "4. 볼륨 초기화 (데이터 손실 주의):"
    echo "   docker-compose down -v"
    echo ""
    echo "5. 이미지 재빌드:"
    echo "   docker-compose build --no-cache"
}

# 도움말 출력
show_help() {
    cat << EOF
VibeMusic 개발 환경 시작 도구

사용법: $0 [옵션]

옵션:
  -h, --help        이 도움말 출력
  --check-only      서비스 상태만 확인
  --cleanup         기존 컨테이너 정리 후 시작
  --rebuild         이미지 재빌드 후 시작
  --no-cache        캐시 없이 이미지 빌드

예제:
  $0                 # 개발 환경 시작
  $0 --check-only    # 서비스 상태만 확인
  $0 --cleanup       # 정리 후 재시작
  $0 --rebuild       # 이미지 재빌드 후 시작

참고: quickstart.md의 docker-compose up -d 대신 이 스크립트를 사용하세요.
EOF
}

# 메인 실행 함수
main() {
    local check_only=false
    local cleanup=false
    local rebuild=false
    local no_cache=false

    # 명령행 인수 처리
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            --check-only)
                check_only=true
                shift
                ;;
            --cleanup)
                cleanup=true
                shift
                ;;
            --rebuild)
                rebuild=true
                shift
                ;;
            --no-cache)
                no_cache=true
                shift
                ;;
            *)
                log_error "알 수 없는 옵션: $1"
                show_help
                exit 1
                ;;
        esac
    done

    log_info "VibeMusic 개발 환경 시작"

    # 기본 확인
    check_project_root
    check_dependencies
    check_environment
    check_docker_images

    # 상태만 확인하는 경우
    if [[ "$check_only" == true ]]; then
        check_services
        exit 0
    fi

    # 정리 옵션
    if [[ "$cleanup" == true ]]; then
        cleanup_containers
    fi

    # 이미지 재빌드
    if [[ "$rebuild" == true ]]; then
        log_info "Docker 이미지 재빌드 중..."
        local build_args=""
        if [[ "$no_cache" == true ]]; then
            build_args="--no-cache"
        fi

        docker-compose build $build_args
        log_success "이미지 재빌드 완료"
    fi

    # 개발 환경 시작
    start_development
    check_services
    show_access_info

    log_success "개발 환경 준비 완료!"
}

# 스크립트 실행
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi