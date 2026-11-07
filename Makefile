# Prosper Challenge — run everything from the repo root.
# Dependencies are managed with uv (https://docs.astral.sh/uv/).

PROJECT := backend
FRONTEND := frontend

.PHONY: help install run editor test test-backend test-frontend clean

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

install: ## Install backend (uv.lock) and frontend (package-lock.json) dependencies
	uv sync --directory $(PROJECT)
	npm --prefix $(FRONTEND) install

run: ## Run the voice agent (then open http://localhost:7860/client)
	uv run --directory $(PROJECT) python bot.py

editor: ## Run the agent editor (then open http://localhost:5173); needs `make run` too
	npm --prefix $(FRONTEND) run dev

test: test-backend test-frontend ## Run every test with coverage (fails under 100%)

test-backend: ## Backend tests with coverage
	uv run --directory $(PROJECT) pytest --cov

test-frontend: ## Frontend lint, tests and coverage
	npm --prefix $(FRONTEND) run lint
	npm --prefix $(FRONTEND) test

clean: ## Remove the venv and Python caches
	rm -rf $(PROJECT)/.venv
	find $(PROJECT) -type d -name __pycache__ -prune -exec rm -rf {} +
