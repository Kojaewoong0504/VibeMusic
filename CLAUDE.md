# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language Preference

**모든 대화는 한국어로 진행합니다.** Claude Code는 이 저장소에서 작업할 때 항상 한국어로 응답해야 합니다.

## Project Overview

VibeMusic is a specification-driven project using the .specify framework for feature development. The repository is structured around a formal specification and planning workflow that enforces Test-Driven Development (TDD) and systematic feature implementation.

## Core Architecture

### .specify Framework
This project uses a specification-first development approach:
- **Feature specifications** are written before any code
- **Implementation plans** generate technical designs from specifications
- **Task generation** creates dependency-ordered development workflows
- **TDD enforcement** through the constitution and templates

### Directory Structure
```
.specify/
├── memory/constitution.md          # Core development principles and constraints
├── templates/                      # Templates for specs, plans, and tasks
│   ├── spec-template.md           # Feature specification template
│   ├── plan-template.md           # Implementation planning template
│   └── tasks-template.md          # Task generation template
└── scripts/bash/                  # Automation scripts for workflow
specs/                              # Generated feature specifications (created on demand)
.claude/commands/                   # Custom Claude Code commands
```

## Development Workflow

### 1. Feature Creation
```bash
/specify "feature description in natural language"
```
This command:
- Creates a new git branch (e.g., `001-feature-name`)
- Generates a feature specification using the template
- Sets up the directory structure in `specs/`

### 2. Implementation Planning
```bash
/plan "implementation details and technical context"
```
This command:
- Generates technical design artifacts from the specification
- Creates data models, API contracts, and integration tests
- Follows constitutional principles for TDD

### 3. Task Generation
```bash
/tasks "context for task execution"
```
This command:
- Creates dependency-ordered development tasks
- Marks parallelizable tasks with [P]
- Generates specific, executable instructions

## Important Development Principles

### Test-Driven Development (Mandatory)
- Tests MUST be written before implementation
- Red-Green-Refactor cycle is strictly enforced
- Each contract requires a corresponding test task marked [P]

### Library-First Approach
- Features start as standalone libraries
- Libraries must be self-contained and independently testable
- Clear purpose required for all libraries

### CLI Interface Standard
- Every library exposes functionality via CLI
- Text in/out protocol: stdin/args → stdout, errors → stderr
- Support both JSON and human-readable formats

## Custom Commands

The project includes three custom Claude Code commands in `.claude/commands/`:

- **`/specify`**: Create feature specifications from natural language descriptions
- **`/plan`**: Generate implementation plans and technical artifacts
- **`/tasks`**: Generate executable task lists with dependency ordering

## File Naming Conventions

- Feature branches: `###-kebab-case-name` (e.g., `001-user-authentication`)
- Specifications: `specs/###-feature-name/spec.md`
- Task numbering: `T001`, `T002`, etc. in generated task files

## Key Templates

### Specification Template
- Focuses on WHAT users need and WHY (no implementation details)
- Written for business stakeholders, not developers  
- Uses `[NEEDS CLARIFICATION: question]` markers for ambiguities
- Includes testable acceptance scenarios and functional requirements

### Implementation Planning
- Generates technical artifacts from business specifications
- Creates data models, API contracts, and test scenarios
- Follows constitutional constraints and TDD principles

## Script Integration

The `.specify/scripts/bash/` directory contains workflow automation:
- `create-new-feature.sh`: Sets up new feature branches and directories
- `setup-plan.sh`: Initializes implementation planning workflow
- `check-task-prerequisites.sh`: Validates prerequisites for task generation

## Constitutional Requirements

The project follows a constitution-based development approach where core principles supersede other practices. All development must comply with the principles defined in `.specify/memory/constitution.md`, including mandatory TDD, library-first architecture, and CLI interface standards.

## VibeMusic Project Context

### Current Feature: 감정 기반 AI 음악 생성 (Branch: 001-ai-ai)

**프로젝트 개요**: 사용자의 키보드 타이핑 패턴(속도, 리듬, 일시정지)을 실시간으로 분석하여 감정을 추출하고, 이를 AI 음악 생성에 반영하는 웹 서비스

**기술 스택**:
- **백엔드**: FastAPI (Python 3.12+), PostgreSQL, Redis
- **프론트엔드**: React 18+, TypeScript, WebSocket
- **AI 통합**: MusicGen API 또는 유사한 음악 생성 AI 서비스
- **배포**: Docker Compose, Nginx 리버스 프록시

**모노레포 구조**:
```
backend/          # FastAPI 백엔드
frontend/         # React 프론트엔드  
shared/types/     # TypeScript 타입 공유
```

**핵심 기능**:
1. **실시간 타이핑 캡처**: WebSocket을 통한 키보드 이벤트 실시간 수집
2. **감정 분석**: 타이핑 패턴에서 tempo, rhythm, 감정 벡터 추출
3. **AI 음악 생성**: 텍스트 프롬프트 + 감정 데이터 결합하여 개인화된 음악 생성
4. **실시간 미리보기**: 타이핑 중 실시간 감정 상태 시각화

**독립 라이브러리**:
- `vibemusic-pattern-analyzer`: 키보드 패턴 분석 (CLI 지원)
- `vibemusic-emotion-mapper`: 감정 프로필 매핑 (CLI 지원)
- `vibemusic-ai-connector`: AI 음악 생성 API 연동 (CLI 지원)

**성능 요구사항**:
- 키 입력 레이턴시: <50ms
- 음악 생성 시간: <30초
- 동시 사용자: 1,000명 지원
- WebSocket 연결 유지: >1시간

**개발 가이드라인**:
- TDD 필수: Contract → Integration → E2E → Unit 테스트 순서
- 실시간 데이터는 Redis 버퍼 사용
- 개인정보 보호: 24시간 후 자동 삭제, 데이터 수집 동의 필수
- 브라우저 호환성: Chrome/Firefox/Safari 최신 버전

**최근 업데이트** (2025-09-14):
- Phase 0: 기술 연구 완료 (research.md)
- Phase 1: 데이터 모델 및 API 계약 설계 완료 (data-model.md, contracts/)
- 다음 단계: `/tasks` 명령어로 구현 태스크 생성 예정