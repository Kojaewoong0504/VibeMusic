.PHONY: help install format lint test clean

help:
	@echo "사용 가능한 명령어:"
	@echo "  install    - 의존성 설치"
	@echo "  format     - 코드 포맷팅 (black, isort)"
	@echo "  lint       - 코드 린팅 (ruff, mypy)"
	@echo "  test       - 테스트 실행"
	@echo "  clean      - 캐시 및 임시 파일 삭제"

install:
	pip install -r requirements.txt
	pip install -e .[dev]
	pre-commit install

format:
	black src tests
	isort src tests

lint:
	ruff check src tests
	mypy src

test:
	pytest

clean:
	rm -rf .pytest_cache
	rm -rf .mypy_cache
	rm -rf .ruff_cache
	rm -rf htmlcov
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -name "*.pyc" -delete