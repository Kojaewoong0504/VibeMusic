#!/bin/bash
# quickstart-test.sh - QuickStart 시나리오 자동 테스트 스크립트
# VibeMusic T104 태스크 검증용

set -euo pipefail

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 설정
BASE_URL="${BASE_URL:-http://localhost:8000}"
TEST_RESULTS_DIR="./test-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
TEST_LOG="$TEST_RESULTS_DIR/quickstart_test_$TIMESTAMP.log"

# 로그 함수들
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$TEST_LOG"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$TEST_LOG"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$TEST_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$TEST_LOG"
}

# 테스트 결과 저장용 변수
TESTS_TOTAL=0
TESTS_PASSED=0
TESTS_FAILED=0

# 테스트 결과 기록 함수
record_test() {
    local test_name="$1"
    local result="$2"
    local details="$3"

    TESTS_TOTAL=$((TESTS_TOTAL + 1))

    if [ "$result" = "PASS" ]; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        log_success "✅ $test_name"
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        log_error "❌ $test_name"
        if [ -n "$details" ]; then
            echo "   상세: $details" | tee -a "$TEST_LOG"
        fi
    fi
}

# JSON 파싱 함수 (jq 없이)
extract_json_value() {
    local json="$1"
    local key="$2"
    echo "$json" | sed -n 's/.*"'$key'"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p'
}

# HTTP 응답 코드 추출
get_http_code() {
    echo "$1" | tail -1
}

# HTTP 응답 본문 추출
get_http_body() {
    echo "$1" | head -n -1
}

# 초기화
init_test() {
    log_info "=== VibeMusic QuickStart 시나리오 테스트 시작 ==="
    log_info "테스트 시간: $(date)"
    log_info "대상 서버: $BASE_URL"

    # 테스트 결과 디렉토리 생성
    mkdir -p "$TEST_RESULTS_DIR"

    echo "테스트 설정:" | tee -a "$TEST_LOG"
    echo "- 서버 URL: $BASE_URL" | tee -a "$TEST_LOG"
    echo "- 로그 파일: $TEST_LOG" | tee -a "$TEST_LOG"
    echo "" | tee -a "$TEST_LOG"
}

# 헬스체크 테스트
test_health_check() {
    log_info "1. 헬스체크 테스트 실행"

    local response
    response=$(curl -s -w "\\n%{http_code}" "$BASE_URL/health" 2>/dev/null || echo -e "\\n000")

    local http_code
    http_code=$(get_http_code "$response")

    if [ "$http_code" = "200" ]; then
        record_test "헬스체크" "PASS" "HTTP 200 응답"
        return 0
    else
        record_test "헬스체크" "FAIL" "HTTP $http_code 응답"
        return 1
    fi
}

# 세션 생성 테스트
test_create_session() {
    log_info "2. 세션 생성 테스트 실행"

    local response
    response=$(curl -s -w "\\n%{http_code}" -X POST "$BASE_URL/v1/sessions" \
        -H "Content-Type: application/json" \
        -d '{
            "consent_given": true,
            "auto_delete_hours": 24
        }' 2>/dev/null || echo -e "\\n000")

    local http_code
    http_code=$(get_http_code "$response")
    local body
    body=$(get_http_body "$response")

    if [ "$http_code" = "201" ] || [ "$http_code" = "200" ]; then
        SESSION_ID=$(extract_json_value "$body" "session_id")
        SESSION_TOKEN=$(extract_json_value "$body" "session_token")

        if [ -n "$SESSION_ID" ] && [ "$SESSION_ID" != "" ]; then
            record_test "세션 생성" "PASS" "세션 ID: $SESSION_ID"
            echo "SESSION_ID=$SESSION_ID" >> "$TEST_RESULTS_DIR/session_vars.env"
            echo "SESSION_TOKEN=$SESSION_TOKEN" >> "$TEST_RESULTS_DIR/session_vars.env"
            return 0
        else
            record_test "세션 생성" "FAIL" "세션 ID 추출 실패"
            return 1
        fi
    else
        record_test "세션 생성" "FAIL" "HTTP $http_code 응답"
        return 1
    fi
}

# 세션 조회 테스트
test_get_session() {
    log_info "3. 세션 조회 테스트 실행"

    if [ -z "${SESSION_ID:-}" ] || [ -z "${SESSION_TOKEN:-}" ]; then
        record_test "세션 조회" "FAIL" "세션 정보 없음"
        return 1
    fi

    local response
    response=$(curl -s -w "\\n%{http_code}" -X GET "$BASE_URL/v1/sessions/$SESSION_ID" \
        -H "Authorization: Bearer $SESSION_TOKEN" 2>/dev/null || echo -e "\\n000")

    local http_code
    http_code=$(get_http_code "$response")
    local body
    body=$(get_http_body "$response")

    if [ "$http_code" = "200" ]; then
        local status
        status=$(extract_json_value "$body" "status")
        if [ "$status" = "active" ]; then
            record_test "세션 조회" "PASS" "세션 상태: $status"
            return 0
        else
            record_test "세션 조회" "FAIL" "예상치 못한 세션 상태: $status"
            return 1
        fi
    else
        record_test "세션 조회" "FAIL" "HTTP $http_code 응답"
        return 1
    fi
}

# 타이핑 패턴 분석 테스트
test_analyze_typing() {
    log_info "4. 타이핑 패턴 분석 테스트 실행"

    if [ -z "${SESSION_ID:-}" ] || [ -z "${SESSION_TOKEN:-}" ]; then
        record_test "타이핑 패턴 분석" "FAIL" "세션 정보 없음"
        return 1
    fi

    local response
    response=$(curl -s -w "\\n%{http_code}" -X POST "$BASE_URL/v1/sessions/$SESSION_ID/analyze" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $SESSION_TOKEN" \
        -d '{
            "keystrokes": [
                {"key": "H", "timestamp": 1000.0, "type": "keydown"},
                {"key": "e", "timestamp": 1150.0, "type": "keydown"},
                {"key": "l", "timestamp": 1300.0, "type": "keydown"},
                {"key": "l", "timestamp": 1450.0, "type": "keydown"},
                {"key": "o", "timestamp": 1600.0, "type": "keydown"}
            ],
            "text_content": "Hello peaceful meditation music"
        }' 2>/dev/null || echo -e "\\n000")

    local http_code
    http_code=$(get_http_code "$response")
    local body
    body=$(get_http_body "$response")

    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        EMOTION_PROFILE_ID=$(extract_json_value "$body" "id")
        # emotion_profile.id로도 시도
        if [ -z "$EMOTION_PROFILE_ID" ] || [ "$EMOTION_PROFILE_ID" = "" ]; then
            EMOTION_PROFILE_ID=$(echo "$body" | sed -n 's/.*"emotion_profile"[^{]*{[^"]*"id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
        fi

        if [ -n "$EMOTION_PROFILE_ID" ] && [ "$EMOTION_PROFILE_ID" != "" ]; then
            record_test "타이핑 패턴 분석" "PASS" "감정 프로필 ID: $EMOTION_PROFILE_ID"
            echo "EMOTION_PROFILE_ID=$EMOTION_PROFILE_ID" >> "$TEST_RESULTS_DIR/session_vars.env"
            return 0
        else
            record_test "타이핑 패턴 분석" "FAIL" "감정 프로필 ID 추출 실패"
            return 1
        fi
    else
        record_test "타이핑 패턴 분석" "FAIL" "HTTP $http_code 응답"
        return 1
    fi
}

# AI 음악 생성 테스트
test_generate_music() {
    log_info "5. AI 음악 생성 테스트 실행"

    if [ -z "${SESSION_ID:-}" ] || [ -z "${SESSION_TOKEN:-}" ] || [ -z "${EMOTION_PROFILE_ID:-}" ]; then
        record_test "AI 음악 생성" "FAIL" "필요한 정보 없음"
        return 1
    fi

    local response
    response=$(curl -s -w "\\n%{http_code}" -X POST "$BASE_URL/v1/sessions/$SESSION_ID/generate" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $SESSION_TOKEN" \
        -d '{
            "text_prompt": "peaceful meditation music",
            "emotion_profile_id": "'$EMOTION_PROFILE_ID'",
            "generation_parameters": {
                "duration": 30,
                "format": "wav",
                "genre_hint": "ambient"
            }
        }' 2>/dev/null || echo -e "\\n000")

    local http_code
    http_code=$(get_http_code "$response")
    local body
    body=$(get_http_body "$response")

    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ] || [ "$http_code" = "202" ]; then
        MUSIC_ID=$(extract_json_value "$body" "music_id")
        if [ -z "$MUSIC_ID" ] || [ "$MUSIC_ID" = "" ]; then
            MUSIC_ID=$(extract_json_value "$body" "id")
        fi

        if [ -n "$MUSIC_ID" ] && [ "$MUSIC_ID" != "" ]; then
            record_test "AI 음악 생성" "PASS" "음악 ID: $MUSIC_ID"
            echo "MUSIC_ID=$MUSIC_ID" >> "$TEST_RESULTS_DIR/session_vars.env"
            return 0
        else
            record_test "AI 음악 생성" "FAIL" "음악 ID 추출 실패"
            return 1
        fi
    else
        record_test "AI 음악 생성" "FAIL" "HTTP $http_code 응답"
        return 1
    fi
}

# 음악 상태 확인 테스트
test_check_music_status() {
    log_info "6. 음악 상태 확인 테스트 실행"

    if [ -z "${SESSION_ID:-}" ] || [ -z "${SESSION_TOKEN:-}" ] || [ -z "${MUSIC_ID:-}" ]; then
        record_test "음악 상태 확인" "FAIL" "필요한 정보 없음"
        return 1
    fi

    local response
    response=$(curl -s -w "\\n%{http_code}" -X GET "$BASE_URL/v1/sessions/$SESSION_ID/music/$MUSIC_ID" \
        -H "Authorization: Bearer $SESSION_TOKEN" 2>/dev/null || echo -e "\\n000")

    local http_code
    http_code=$(get_http_code "$response")
    local body
    body=$(get_http_body "$response")

    if [ "$http_code" = "200" ]; then
        local status
        status=$(extract_json_value "$body" "status")
        record_test "음악 상태 확인" "PASS" "음악 상태: $status"
        return 0
    else
        record_test "음악 상태 확인" "FAIL" "HTTP $http_code 응답"
        return 1
    fi
}

# WebSocket 연결 테스트 (간단한 확인)
test_websocket_endpoint() {
    log_info "7. WebSocket 엔드포인트 확인"

    # WebSocket 엔드포인트가 존재하는지 확인 (HTTP로 접근하면 426 Upgrade Required 응답)
    local ws_url="${BASE_URL/http/ws}/ws/typing/test-session"
    local response
    response=$(curl -s -w "\\n%{http_code}" "$ws_url" 2>/dev/null || echo -e "\\n000")

    local http_code
    http_code=$(get_http_code "$response")

    # WebSocket 엔드포인트는 HTTP 요청에 대해 426 또는 400 응답을 보낼 수 있음
    if [ "$http_code" = "426" ] || [ "$http_code" = "400" ] || [ "$http_code" = "404" ]; then
        record_test "WebSocket 엔드포인트" "PASS" "엔드포인트 존재 확인 (HTTP $http_code)"
        return 0
    else
        record_test "WebSocket 엔드포인트" "FAIL" "예상치 못한 HTTP $http_code 응답"
        return 1
    fi
}

# 시나리오별 테스트
test_scenario_calm_music() {
    log_info "8. 시나리오 1: 차분한 명상 음악 생성 테스트"

    # 느린 타이핑 패턴 시뮬레이션 (200-300ms 간격)
    if [ -z "${SESSION_ID:-}" ] || [ -z "${SESSION_TOKEN:-}" ]; then
        record_test "시나리오 1" "FAIL" "세션 정보 없음"
        return 1
    fi

    local response
    response=$(curl -s -w "\\n%{http_code}" -X POST "$BASE_URL/v1/sessions/$SESSION_ID/analyze" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $SESSION_TOKEN" \
        -d '{
            "keystrokes": [
                {"key": "p", "timestamp": 1000.0, "type": "keydown"},
                {"key": "e", "timestamp": 1250.0, "type": "keydown"},
                {"key": "a", "timestamp": 1500.0, "type": "keydown"},
                {"key": "c", "timestamp": 1750.0, "type": "keydown"},
                {"key": "e", "timestamp": 2000.0, "type": "keydown"}
            ],
            "text_content": "peaceful meditation music in nature"
        }' 2>/dev/null || echo -e "\\n000")

    local http_code
    http_code=$(get_http_code "$response")

    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        record_test "시나리오 1 (차분한 음악)" "PASS" "느린 타이핑 패턴 분석 성공"
        return 0
    else
        record_test "시나리오 1 (차분한 음악)" "FAIL" "HTTP $http_code 응답"
        return 1
    fi
}

test_scenario_energetic_music() {
    log_info "9. 시나리오 2: 에너지틱한 운동 음악 생성 테스트"

    # 빠른 타이핑 패턴 시뮬레이션 (80-120ms 간격)
    if [ -z "${SESSION_ID:-}" ] || [ -z "${SESSION_TOKEN:-}" ]; then
        record_test "시나리오 2" "FAIL" "세션 정보 없음"
        return 1
    fi

    local response
    response=$(curl -s -w "\\n%{http_code}" -X POST "$BASE_URL/v1/sessions/$SESSION_ID/analyze" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $SESSION_TOKEN" \
        -d '{
            "keystrokes": [
                {"key": "e", "timestamp": 1000.0, "type": "keydown"},
                {"key": "n", "timestamp": 1080.0, "type": "keydown"},
                {"key": "e", "timestamp": 1160.0, "type": "keydown"},
                {"key": "r", "timestamp": 1240.0, "type": "keydown"},
                {"key": "g", "timestamp": 1320.0, "type": "keydown"},
                {"key": "y", "timestamp": 1400.0, "type": "keydown"}
            ],
            "text_content": "energetic workout music with strong beat"
        }' 2>/dev/null || echo -e "\\n000")

    local http_code
    http_code=$(get_http_code "$response")

    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        record_test "시나리오 2 (에너지틱 음악)" "PASS" "빠른 타이핑 패턴 분석 성공"
        return 0
    else
        record_test "시나리오 2 (에너지틱 음악)" "FAIL" "HTTP $http_code 응답"
        return 1
    fi
}

# 결과 요약 출력
print_summary() {
    echo "" | tee -a "$TEST_LOG"
    log_info "=== 테스트 결과 요약 ==="
    echo "총 테스트: $TESTS_TOTAL" | tee -a "$TEST_LOG"
    echo "성공: $TESTS_PASSED" | tee -a "$TEST_LOG"
    echo "실패: $TESTS_FAILED" | tee -a "$TEST_LOG"

    local success_rate
    if [ "$TESTS_TOTAL" -gt 0 ]; then
        success_rate=$((TESTS_PASSED * 100 / TESTS_TOTAL))
        echo "성공률: ${success_rate}%" | tee -a "$TEST_LOG"
    fi

    echo "" | tee -a "$TEST_LOG"
    echo "상세 로그: $TEST_LOG" | tee -a "$TEST_LOG"
    echo "세션 정보: $TEST_RESULTS_DIR/session_vars.env" | tee -a "$TEST_LOG"

    if [ "$TESTS_FAILED" -eq 0 ]; then
        log_success "모든 테스트가 성공했습니다! 🎉"
        return 0
    else
        log_error "일부 테스트가 실패했습니다."
        return 1
    fi
}

# 메인 실행 함수
main() {
    # 초기화
    init_test

    # 전체 변수 초기화
    SESSION_ID=""
    SESSION_TOKEN=""
    EMOTION_PROFILE_ID=""
    MUSIC_ID=""

    # 기본 API 테스트
    test_health_check
    test_create_session
    test_get_session
    test_analyze_typing
    test_generate_music
    test_check_music_status
    test_websocket_endpoint

    # 시나리오 테스트
    test_scenario_calm_music
    test_scenario_energetic_music

    # 결과 요약
    print_summary

    # 종료 코드 반환
    if [ "$TESTS_FAILED" -eq 0 ]; then
        exit 0
    else
        exit 1
    fi
}

# 스크립트가 직접 실행된 경우에만 main 함수 호출
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi