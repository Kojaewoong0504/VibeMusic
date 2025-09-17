# Implementation Plan: 바이브뮤직 - 감정 기반 AI 음악 생성

**Branch**: `001-ai-ai` | **Date**: 2025-09-14 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-ai-ai/spec.md`

## Execution Flow (/plan command scope)

```
1. Load feature spec from Input path
   → SUCCESS: Feature spec loaded - 감정 캡처 기반 AI 음악 생성 서비스
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Project Type: WEB (FastAPI backend + React frontend)
   → Structure Decision: Option 2 - 모노레포 웹 애플리케이션
3. Evaluate Constitution Check section below
   → Constitution는 템플릿 상태로 일반 원칙 적용
   → Update Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md
   → 키보드 패턴 분석, AI 음악 생성, 실시간 처리 기술 연구
5. Execute Phase 1 → contracts, data-model.md, quickstart.md
6. Re-evaluate Constitution Check section
   → Update Progress Tracking: Post-Design Constitution Check
7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
8. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

바이브뮤직은 사용자의 키보드 타이핑 패턴(속도, 리듬, 일시정지)을 실시간으로 캡처하여 감정적 맥락을 분석하고, 이를 AI 음악 생성에 반영하는 웹 기반 서비스입니다. FastAPI 백엔드에서 실시간 패턴 분석과 AI 모델 연동을 처리하고, React 프론트엔드에서 직관적인 타이핑 인터페이스와 음악 미리보기를 제공합니다.

## Technical Context

**Language/Version**: Python 3.12 (FastAPI), TypeScript/JavaScript (React 18+)  
**Primary Dependencies**: FastAPI, React, WebSocket (실시간 타이핑 캡처), NumPy/SciPy (패턴 분석), AI 음악 생성 API  
**Storage**: PostgreSQL (사용자 세션, 타이핑 패턴 프로필), Redis (실시간 세션 캐시)  
**Testing**: pytest (백엔드), Jest/React Testing Library (프론트엔드), Playwright (E2E)  
**Target Platform**: 웹 브라우저 (Chrome, Firefox, Safari), Linux/Docker 서버  
**Project Type**: web - FastAPI 백엔드 + React 프론트엔드 모노레포  
**Performance Goals**: 키 입력 레이턴시 <50ms, 음악 생성 <30초, 실시간 패턴 분석  
**Constraints**: 브라우저 호환성, 실시간 데이터 처리, AI 모델 응답 시간  
**Scale/Scope**: 동시 사용자 1,000명, 일일 음악 생성 10,000곡, 타이핑 패턴 실시간 분석

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 2 (backend-fastapi, frontend-react)
- Using framework directly? (FastAPI 직접 사용, React hooks 기반)
- Single data model? (통합 데이터 모델, API 직렬화용 Pydantic만 사용)
- Avoiding patterns? (Repository 패턴 사용하지 않음, SQLAlchemy ORM 직접 사용)

**Architecture**:
- EVERY feature as library? (타이핑 패턴 분석, 감정 매핑, 음악 생성 연동을 독립 라이브러리로)
- Libraries listed: 
  - `vibemusic-pattern-analyzer` (키보드 패턴 분석)
  - `vibemusic-emotion-mapper` (감정 프로필 매핑)  
  - `vibemusic-ai-connector` (AI 음악 생성 API 연동)
- CLI per library: 각 라이브러리는 독립 CLI 지원 (--help/--version/--format)
- Library docs: llms.txt format planned

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? (테스트 먼저 작성, 실패 확인 후 구현)
- Git commits show tests before implementation? (커밋 순서로 TDD 검증)
- Order: Contract→Integration→E2E→Unit strictly followed
- Real dependencies used? (실제 PostgreSQL, Redis, WebSocket 연결)
- Integration tests for: WebSocket 연결, AI API 통합, 데이터베이스 계층

**Observability**:
- Structured logging included? (FastAPI + 구조화된 로깅)
- Frontend logs → backend? (React 에러를 백엔드로 전송)
- Error context sufficient? (타이핑 패턴, 세션 ID, 타임스탬프 포함)

**Versioning**:
- Version number assigned? (1.0.0 - 초기 릴리스)
- BUILD increments on every change? (패치 버전 자동 증가)
- Breaking changes handled? (API 버전 관리, 마이그레이션 계획)

## Project Structure

### Documentation (this feature)

```
specs/001-ai-ai/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)

```
# Option 2: Web application - 모노레포 구조
backend/
├── src/
│   ├── models/          # SQLAlchemy 모델 (typing_pattern, user_session, etc.)
│   ├── services/        # 비즈니스 로직 (패턴 분석, AI 연동)
│   ├── api/            # FastAPI 엔드포인트
│   └── lib/            # 독립 라이브러리들
└── tests/
    ├── contract/       # API 계약 테스트
    ├── integration/    # 데이터베이스, WebSocket 통합 테스트
    └── unit/          # 단위 테스트

frontend/
├── src/
│   ├── components/     # React 컴포넌트 (TypingInterface, MusicPlayer)
│   ├── pages/         # 페이지 컴포넌트
│   ├── services/      # API 호출, WebSocket 관리
│   └── hooks/         # React hooks (타이핑 패턴 캡처)
└── tests/
    ├── integration/   # 컴포넌트 통합 테스트
    ├── e2e/          # Playwright E2E 테스트
    └── unit/         # Jest 단위 테스트

shared/
└── types/            # TypeScript 타입 정의 공유
```

**Structure Decision**: Option 2 - 웹 애플리케이션 모노레포 구조 (백엔드 + 프론트엔드 분리)

## Phase 0: Outline & Research

1. **Extract unknowns from Technical Context** above:
   - 키보드 타이핑 패턴 실시간 캡처 기술
   - 타이핑 패턴에서 감정 추출 알고리즘
   - AI 음악 생성 API 선택 및 연동 방법
   - WebSocket을 이용한 실시간 데이터 처리
   - 브라우저별 키보드 이벤트 호환성

2. **Generate and dispatch research agents**:
   ```
   Task: "Research keyboard event timing capture in web browsers for vibemusic"
   Task: "Find best practices for emotion detection from typing patterns"
   Task: "Research AI music generation APIs (MusicGen, Jukebox, etc.) for integration"
   Task: "Research WebSocket performance optimization for real-time typing data"
   Task: "Find patterns for FastAPI + React monorepo deployment"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [선택된 기술/방법]
   - Rationale: [선택 이유]
   - Alternatives considered: [검토된 다른 옵션들]

**Output**: research.md with all technical decisions resolved

## Phase 1: Design & Contracts

*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - TypingPattern (타이밍, 속도, 리듬 데이터)
   - EmotionProfile (감정 매핑 결과)
   - MusicPrompt (텍스트 + 패턴 메타데이터)
   - GeneratedMusic (생성된 음악 파일 정보)
   - UserSession (완전한 상호작용 세션)

2. **Generate API contracts** from functional requirements:
   - POST /api/sessions - 새 세션 시작
   - WebSocket /ws/typing - 실시간 타이핑 패턴 전송
   - POST /api/sessions/{id}/analyze - 패턴 분석 요청
   - POST /api/sessions/{id}/generate - 음악 생성 요청
   - GET /api/sessions/{id}/music - 생성된 음악 다운로드
   - Output OpenAPI schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - 각 엔드포인트별 테스트 파일
   - WebSocket 연결 및 메시지 스키마 검증
   - 테스트는 실패 상태로 시작 (구현 전)

4. **Extract test scenarios** from user stories:
   - 사용자 타이핑 → 패턴 캡처 → 음악 생성 전체 플로우
   - 다양한 타이핑 스타일에 대한 감정 매핑 검증
   - 실시간 미리보기 기능 테스트

5. **Update agent file incrementally** (O(1) operation):
   - CLAUDE.md에 바이브뮤직 관련 컨텍스트 추가
   - FastAPI + React 개발 가이드라인 추가
   - 타이핑 패턴 분석 도메인 지식 추가

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, updated CLAUDE.md

## Phase 2: Task Planning Approach

*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `/templates/tasks-template.md` as base
- 백엔드 설정 (FastAPI, PostgreSQL, Redis 설정)
- 프론트엔드 설정 (React, TypeScript, WebSocket 클라이언트)
- 각 라이브러리별 구현 태스크 (pattern-analyzer, emotion-mapper, ai-connector)
- API 계약 구현 태스크 (각 엔드포인트별)
- WebSocket 실시간 통신 구현
- E2E 테스트 시나리오 구현

**Ordering Strategy**:
- TDD order: Contract tests → Integration tests → 구현
- Dependency order: Models → Services → API → Frontend
- 병렬 실행 가능: [P] 각 독립 라이브러리, 프론트엔드 컴포넌트

**Estimated Output**: 30-35 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation

*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (TDD 원칙 따라 태스크 실행)  
**Phase 5**: Validation (테스트 실행, quickstart 검증, 성능 테스트)

## Complexity Tracking

*Constitution이 템플릿 상태이므로 복잡성 위반 없음*

## Progress Tracking

*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command) ✅ research.md
- [x] Phase 1: Design complete (/plan command) ✅ data-model.md, contracts/, quickstart.md, CLAUDE.md updated  
- [x] Phase 2: Task planning complete (/plan command - describe approach only) ✅
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS ✅
- [x] Post-Design Constitution Check: PASS ✅ 
- [x] All NEEDS CLARIFICATION resolved ✅
- [x] Complexity deviations documented (없음) ✅

---

*Based on general development principles - Constitution template pending*