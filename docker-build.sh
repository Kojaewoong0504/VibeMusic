#!/bin/bash
# VibeMusic Docker 이미지 빌드 및 실행 스크립트

set -e

echo "🎵 VibeMusic Docker 관리 스크립트"
echo "================================="

# 함수 정의
show_help() {
    echo "사용법: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  build-dev        개발 환경 빌드"
    echo "  build-prod       프로덕션 환경 빌드"
    echo "  run-dev          개발 환경 실행"
    echo "  run-prod         프로덕션 환경 실행"
    echo "  stop             모든 컨테이너 중지"
    echo "  clean            사용하지 않는 이미지/볼륨 정리"
    echo "  logs [service]   서비스 로그 확인"
    echo "  help             도움말 표시"
    echo ""
    echo "Examples:"
    echo "  $0 build-dev"
    echo "  $0 run-prod"
    echo "  $0 logs api"
    echo "  $0 clean"
}

build_dev() {
    echo "🔨 개발 환경 이미지 빌드 중..."
    docker-compose build api-dev frontend-dev
    echo "✅ 개발 환경 빌드 완료"
}

build_prod() {
    echo "🔨 프로덕션 환경 이미지 빌드 중..."
    docker-compose --profile production build api frontend
    echo "✅ 프로덕션 환경 빌드 완료"
}

run_dev() {
    echo "🚀 개발 환경 실행 중..."
    docker-compose --profile development up -d
    echo "✅ 개발 환경 실행 완료"
    echo "🌐 Frontend: http://localhost:3000"
    echo "🔌 API: http://localhost:8000"
    echo "📊 API Docs: http://localhost:8000/docs"
}

run_prod() {
    echo "🚀 프로덕션 환경 실행 중..."
    docker-compose --profile production up -d
    echo "✅ 프로덕션 환경 실행 완료"
    echo "🌐 Frontend: http://localhost:80"
    echo "📊 API Docs는 프로덕션에서는 비활성화됩니다"
}

stop_all() {
    echo "⏹️ 모든 컨테이너 중지 중..."
    docker-compose --profile development --profile production down
    echo "✅ 모든 컨테이너가 중지되었습니다"
}

clean_up() {
    echo "🧹 사용하지 않는 Docker 리소스 정리 중..."
    docker system prune -f --volumes
    docker image prune -f
    echo "✅ 정리 완료"
}

show_logs() {
    local service=$1
    if [ -z "$service" ]; then
        echo "📋 모든 서비스 로그 출력"
        docker-compose logs -f
    else
        echo "📋 $service 서비스 로그 출력"
        docker-compose logs -f "$service"
    fi
}

# 메인 로직
case "$1" in
    "build-dev")
        build_dev
        ;;
    "build-prod")
        build_prod
        ;;
    "run-dev")
        build_dev
        run_dev
        ;;
    "run-prod")
        build_prod
        run_prod
        ;;
    "stop")
        stop_all
        ;;
    "clean")
        clean_up
        ;;
    "logs")
        show_logs "$2"
        ;;
    "help"|"--help"|"-h")
        show_help
        ;;
    "")
        echo "❌ 명령어를 지정해주세요."
        show_help
        exit 1
        ;;
    *)
        echo "❌ 알 수 없는 명령어: $1"
        show_help
        exit 1
        ;;
esac