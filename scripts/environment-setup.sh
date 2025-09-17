#!/bin/bash
# VibeMusic 환경별 설정 관리 스크립트
# Environment-specific configuration management script

set -euo pipefail

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# 사용법 출력
show_usage() {
    cat << EOF
VibeMusic 환경 설정 관리 도구

사용법:
    $0 <command> [environment] [options]

명령어:
    init [env]          - 지정된 환경 초기화 (env: dev, staging, prod)
    switch [env]        - 환경 전환
    validate [env]      - 환경 설정 검증
    backup [env]        - 환경 설정 백업
    restore [env]       - 환경 설정 복원
    secrets [env]       - 비밀 키 생성/관리
    status              - 현재 환경 상태 확인

환경:
    dev, development    - 개발 환경
    staging, stage      - 스테이징 환경
    prod, production    - 프로덕션 환경

옵션:
    --force             - 강제 실행 (확인 없이)
    --verbose           - 상세 출력
    --help              - 도움말 표시

예시:
    $0 init dev                    # 개발 환경 초기화
    $0 switch prod                 # 프로덕션 환경으로 전환
    $0 validate staging --verbose  # 스테이징 환경 검증 (상세)
    $0 secrets prod --force        # 프로덕션 비밀 키 생성

EOF
}

# 환경 정규화
normalize_env() {
    local env="$1"
    case "$env" in
        dev|development)
            echo "development"
            ;;
        staging|stage)
            echo "staging"
            ;;
        prod|production)
            echo "production"
            ;;
        *)
            log_error "지원되지 않는 환경: $env"
            log_error "지원되는 환경: dev, staging, prod"
            exit 1
            ;;
    esac
}

# 환경 초기화
init_environment() {
    local env="$1"
    local force="${2:-false}"

    log_info "환경 초기화 시작: $env"

    # .env 파일 존재 확인
    if [[ -f ".env.$env" ]]; then
        if [[ "$force" != "true" ]]; then
            log_warning ".env.$env 파일이 이미 존재합니다."
            read -p "덮어쓰시겠습니까? (y/N): " confirm
            if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
                log_info "초기화가 취소되었습니다."
                return 0
            fi
        fi
    fi

    # 환경별 디렉토리 생성
    create_env_directories "$env"

    # Docker Compose 파일 확인
    check_docker_compose_files "$env"

    # 비밀 키 생성 (프로덕션의 경우)
    if [[ "$env" == "production" ]]; then
        generate_secrets "$env" "$force"
    fi

    log_success "환경 초기화 완료: $env"
}

# 환경별 디렉토리 생성
create_env_directories() {
    local env="$1"

    log_info "환경별 디렉토리 생성: $env"

    # 로그 디렉토리
    mkdir -p "logs/$env"

    # 업로드 디렉토리
    mkdir -p "uploads/$env"

    # 백업 디렉토리
    mkdir -p "backup/$env"

    # 환경별 설정 디렉토리
    mkdir -p "config/$env"

    # 비밀 키 디렉토리 (프로덕션용)
    if [[ "$env" == "production" ]]; then
        mkdir -p "secrets"
        chmod 700 "secrets"
    fi

    log_success "디렉토리 생성 완료"
}

# Docker Compose 파일 확인
check_docker_compose_files() {
    local env="$1"

    log_info "Docker Compose 파일 확인: $env"

    local compose_file="docker-compose.$env.yml"

    if [[ ! -f "$compose_file" ]]; then
        log_warning "$compose_file 파일이 없습니다."
        log_info "기본 docker-compose.yml을 사용합니다."
    else
        log_success "$compose_file 파일 확인 완료"
    fi
}

# 환경 전환
switch_environment() {
    local env="$1"
    local force="${2:-false}"

    log_info "환경 전환: $env"

    # 현재 .env 파일 백업
    if [[ -f ".env" ]] && [[ "$force" != "true" ]]; then
        log_info "현재 .env 파일을 .env.backup으로 백업합니다."
        cp ".env" ".env.backup"
    fi

    # 새로운 환경 파일 복사
    if [[ -f ".env.$env" ]]; then
        cp ".env.$env" ".env"
        log_success "환경 전환 완료: $env"

        # 환경 확인
        log_info "현재 환경 설정:"
        grep "ENVIRONMENT=" ".env" || log_warning "ENVIRONMENT 변수가 설정되지 않았습니다."
    else
        log_error ".env.$env 파일이 존재하지 않습니다."
        log_error "먼저 'init $env' 명령어로 환경을 초기화하세요."
        exit 1
    fi
}

# 환경 설정 검증
validate_environment() {
    local env="$1"
    local verbose="${2:-false}"

    log_info "환경 설정 검증: $env"

    local env_file=".env.$env"
    if [[ ! -f "$env_file" ]]; then
        log_error "$env_file 파일이 존재하지 않습니다."
        return 1
    fi

    # 필수 변수 확인
    local required_vars=(
        "ENVIRONMENT"
        "DATABASE_URL"
        "REDIS_URL"
        "SECRET_KEY"
        "JWT_SECRET_KEY"
    )

    local missing_vars=()
    for var in "${required_vars[@]}"; do
        if ! grep -q "^$var=" "$env_file"; then
            missing_vars+=("$var")
        fi
    done

    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        log_error "누락된 필수 변수들:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        return 1
    fi

    # 보안 검사 (프로덕션용)
    if [[ "$env" == "production" ]]; then
        validate_production_security "$env_file" "$verbose"
    fi

    # Docker Compose 파일 문법 검사
    local compose_file="docker-compose.$env.yml"
    if [[ -f "$compose_file" ]]; then
        if command -v docker-compose >/dev/null 2>&1; then
            if docker-compose -f "$compose_file" config >/dev/null 2>&1; then
                log_success "Docker Compose 설정 검증 통과"
            else
                log_error "Docker Compose 설정에 오류가 있습니다."
                return 1
            fi
        else
            log_warning "docker-compose를 찾을 수 없습니다. 문법 검사를 건너뜁니다."
        fi
    fi

    log_success "환경 설정 검증 완료: $env"
}

# 프로덕션 보안 검증
validate_production_security() {
    local env_file="$1"
    local verbose="$2"

    log_info "프로덕션 보안 설정 검증"

    # 기본 비밀번호 체크
    local weak_passwords=(
        "password"
        "123456"
        "admin"
        "secret"
        "changeme"
        "CHANGE_ME"
    )

    for weak in "${weak_passwords[@]}"; do
        if grep -i "$weak" "$env_file" >/dev/null 2>&1; then
            log_error "보안 위험: 약한 비밀번호 또는 기본값이 발견되었습니다."
            if [[ "$verbose" == "true" ]]; then
                grep -i "$weak" "$env_file"
            fi
            return 1
        fi
    done

    # DEBUG 모드 체크
    if grep -q "DEBUG=true" "$env_file"; then
        log_error "보안 위험: 프로덕션에서 DEBUG 모드가 활성화되어 있습니다."
        return 1
    fi

    # SSL 설정 체크
    if ! grep -q "SSL_ENABLED=true" "$env_file"; then
        log_warning "SSL이 비활성화되어 있습니다."
    fi

    log_success "보안 검증 통과"
}

# 비밀 키 생성
generate_secrets() {
    local env="$1"
    local force="${2:-false}"

    log_info "비밀 키 생성: $env"

    # 비밀 키 디렉토리 확인
    if [[ ! -d "secrets" ]]; then
        mkdir -p "secrets"
        chmod 700 "secrets"
    fi

    # 데이터베이스 비밀번호
    local db_password_file="secrets/db_password.txt"
    if [[ ! -f "$db_password_file" ]] || [[ "$force" == "true" ]]; then
        openssl rand -base64 32 > "$db_password_file"
        chmod 600 "$db_password_file"
        log_success "데이터베이스 비밀번호 생성 완료"
    fi

    # Redis 비밀번호
    local redis_password_file="secrets/redis_password.txt"
    if [[ ! -f "$redis_password_file" ]] || [[ "$force" == "true" ]]; then
        openssl rand -base64 32 > "$redis_password_file"
        chmod 600 "$redis_password_file"
        log_success "Redis 비밀번호 생성 완료"
    fi

    # JWT 비밀 키
    local jwt_secret_file="secrets/jwt_secret.txt"
    if [[ ! -f "$jwt_secret_file" ]] || [[ "$force" == "true" ]]; then
        openssl rand -base64 64 > "$jwt_secret_file"
        chmod 600 "$jwt_secret_file"
        log_success "JWT 비밀 키 생성 완료"
    fi

    # 애플리케이션 비밀 키
    local app_secret_file="secrets/app_secret.txt"
    if [[ ! -f "$app_secret_file" ]] || [[ "$force" == "true" ]]; then
        openssl rand -base64 64 > "$app_secret_file"
        chmod 600 "$app_secret_file"
        log_success "애플리케이션 비밀 키 생성 완료"
    fi

    log_warning "생성된 비밀 키들을 안전한 곳에 백업하세요!"
}

# 현재 상태 확인
show_status() {
    log_info "VibeMusic 환경 상태"

    echo "----------------------------------------"

    # 현재 활성 환경
    if [[ -f ".env" ]]; then
        local current_env=$(grep "ENVIRONMENT=" ".env" 2>/dev/null | cut -d'=' -f2 || echo "Unknown")
        echo "현재 활성 환경: $current_env"
    else
        echo "현재 활성 환경: 설정되지 않음"
    fi

    echo "----------------------------------------"

    # 사용 가능한 환경 파일들
    echo "사용 가능한 환경 설정:"
    for env_file in .env.*; do
        if [[ -f "$env_file" ]] && [[ "$env_file" != ".env.example" ]]; then
            local env_name=$(basename "$env_file" .env)
            env_name=${env_name#.}
            echo "  ✓ $env_name"
        fi
    done

    echo "----------------------------------------"

    # Docker Compose 파일들
    echo "Docker Compose 파일:"
    for compose_file in docker-compose.*.yml; do
        if [[ -f "$compose_file" ]]; then
            echo "  ✓ $compose_file"
        fi
    done

    echo "----------------------------------------"
}

# 메인 실행 로직
main() {
    # 파라미터 파싱
    local command="${1:-}"
    local environment="${2:-}"
    local force=false
    local verbose=false

    # 옵션 파싱
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force)
                force=true
                shift
                ;;
            --verbose)
                verbose=true
                shift
                ;;
            --help)
                show_usage
                exit 0
                ;;
            *)
                shift
                ;;
        esac
    done

    # 명령어 실행
    case "$command" in
        init)
            if [[ -z "$environment" ]]; then
                log_error "환경을 지정해주세요. (dev, staging, prod)"
                show_usage
                exit 1
            fi
            environment=$(normalize_env "$environment")
            init_environment "$environment" "$force"
            ;;
        switch)
            if [[ -z "$environment" ]]; then
                log_error "환경을 지정해주세요. (dev, staging, prod)"
                show_usage
                exit 1
            fi
            environment=$(normalize_env "$environment")
            switch_environment "$environment" "$force"
            ;;
        validate)
            if [[ -z "$environment" ]]; then
                log_error "환경을 지정해주세요. (dev, staging, prod)"
                show_usage
                exit 1
            fi
            environment=$(normalize_env "$environment")
            validate_environment "$environment" "$verbose"
            ;;
        secrets)
            if [[ -z "$environment" ]]; then
                log_error "환경을 지정해주세요. (dev, staging, prod)"
                show_usage
                exit 1
            fi
            environment=$(normalize_env "$environment")
            generate_secrets "$environment" "$force"
            ;;
        status)
            show_status
            ;;
        *)
            log_error "알 수 없는 명령어: $command"
            show_usage
            exit 1
            ;;
    esac
}

# 스크립트가 직접 실행된 경우에만 main 함수 호출
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi