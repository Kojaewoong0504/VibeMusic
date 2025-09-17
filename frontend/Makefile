.PHONY: help install dev build lint format test clean

help:
	@echo "사용 가능한 명령어:"
	@echo "  install    - 의존성 설치"
	@echo "  dev        - 개발 서버 실행"
	@echo "  build      - 프로덕션 빌드"
	@echo "  lint       - 코드 린팅 검사"
	@echo "  format     - 코드 포맷팅"
	@echo "  test       - 테스트 실행"
	@echo "  clean      - 캐시 및 빌드 파일 삭제"

install:
	npm install

dev:
	npm run dev

build:
	npm run build

lint:
	npm run lint
	npm run type-check

format:
	npm run format

test:
	npm run test

clean:
	rm -rf node_modules/.cache
	rm -rf dist
	rm -rf build
	rm -rf coverage