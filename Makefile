.PHONY: help up down build logs backend-shell frontend-dev backend-dev test test-backend test-frontend test-policies lint fmt migrate seed

help:
	@echo "CloudSecOps Pipeline — common commands"
	@echo ""
	@echo "  make up              Start the full stack (docker compose)"
	@echo "  make down            Stop the full stack"
	@echo "  make build           Rebuild all images"
	@echo "  make logs            Tail logs from all services"
	@echo "  make backend-dev     Run the backend locally (no Docker) with uvicorn --reload"
	@echo "  make frontend-dev    Run the frontend locally (no Docker) with vite"
	@echo "  make test            Run backend + policy tests"
	@echo "  make test-backend    Run backend pytest suite"
	@echo "  make test-policies   Run OPA policy unit tests"
	@echo "  make lint            Run ruff (backend) + tsc (frontend)"
	@echo "  make migrate         Apply Alembic migrations"
	@echo "  make seed            Trigger a manual scan against a running backend"

up:
	docker compose up --build

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

backend-dev:
	cd backend && uvicorn app.main:app --reload

frontend-dev:
	cd frontend && npm run dev

test: test-backend test-policies

test-backend:
	cd backend && pytest -v --cov=app --cov-report=term-missing

test-frontend:
	cd frontend && npm run test

test-policies:
	opa test policies/ -v

lint:
	cd backend && ruff check app
	cd frontend && npx tsc -b --noEmit

migrate:
	cd backend && alembic upgrade head

seed:
	curl -X POST http://localhost:8000/api/scan -H "Content-Type: application/json" -d "{}"
