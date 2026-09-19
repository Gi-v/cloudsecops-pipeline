.PHONY: help up down build logs backend-shell frontend-dev backend-dev test test-backend test-frontend test-policies lint fmt migrate seed k8s-up k8s-down

KIND_CLUSTER := cloudsecops
K8S_NAMESPACE := cloudsecops
BACKEND_IMAGE := cloudsecops/backend:1.0.0
FRONTEND_IMAGE := cloudsecops/frontend:1.0.0

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
	@echo "  make k8s-up          Create a kind cluster and helm-install the full chart (see infra/k8s/README.md)"
	@echo "  make k8s-down        Delete the kind cluster created by k8s-up"

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
	curl -X POST http://localhost:8000/api/v1/scan -H "Content-Type: application/json" -d "{}"

k8s-up:
	@if ! kind get clusters | grep -qx "$(KIND_CLUSTER)"; then \
		echo "==> Creating kind cluster $(KIND_CLUSTER)"; \
		kind create cluster --name $(KIND_CLUSTER); \
	else \
		echo "==> kind cluster $(KIND_CLUSTER) already exists"; \
	fi
	@echo "==> Building backend image"
	docker build -t $(BACKEND_IMAGE) ./backend
	@echo "==> Building frontend image (prod target)"
	docker build --target prod -t $(FRONTEND_IMAGE) ./frontend
	@echo "==> Loading images into kind"
	kind load docker-image $(BACKEND_IMAGE) --name $(KIND_CLUSTER)
	kind load docker-image $(FRONTEND_IMAGE) --name $(KIND_CLUSTER)
	@echo "==> Seeding OPA policy ConfigMap"
	kubectl create namespace $(K8S_NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	@# kubectl create configmap --from-file=<dir> does NOT recurse into
	@# subdirectories (policies/cis, policies/nist, policies/iso27001 would
	@# silently be dropped, leaving only policies/main.rego) — flatten first.
	@# Every policy file declares `package cloudsecops` regardless of which
	@# subdirectory it's organized under (see policies/*.rego), so OPA
	@# doesn't care that the directory structure is gone once loaded; the
	@# path is rewritten into the ConfigMap key (cis_network.rego,
	@# iso27001_network.rego, ...) only so two identically-named files in
	@# different subdirectories don't collide.
	@rm -rf /tmp/cloudsecops-policies-flat && mkdir -p /tmp/cloudsecops-policies-flat
	@find policies -name "*.rego" -not -path "*/tests/*" | while read -r f; do \
		key=$$(echo "$$f" | sed -e 's#^policies/##' -e 's#/#_#g'); \
		cp "$$f" "/tmp/cloudsecops-policies-flat/$$key"; \
	done
	kubectl create configmap cloudsecops-policies --from-file=/tmp/cloudsecops-policies-flat -n $(K8S_NAMESPACE) \
		--dry-run=client -o yaml | kubectl apply -f -
	@echo "==> helm upgrade --install"
	helm upgrade --install $(KIND_CLUSTER) infra/k8s -n $(K8S_NAMESPACE) \
		--set backend.image.repository=cloudsecops/backend \
		--set backend.image.tag=1.0.0 \
		--set backend.image.pullPolicy=IfNotPresent \
		--set frontend.image.repository=cloudsecops/frontend \
		--set frontend.image.tag=1.0.0 \
		--set frontend.image.pullPolicy=IfNotPresent \
		--set ingress.enabled=false
	@echo "==> Waiting for rollout"
	kubectl rollout status deployment/$(KIND_CLUSTER)-backend -n $(K8S_NAMESPACE) --timeout=180s
	kubectl rollout status deployment/$(KIND_CLUSTER)-frontend -n $(K8S_NAMESPACE) --timeout=180s
	@echo ""
	@echo "==> Up. Access it with:"
	@echo "    kubectl port-forward -n $(K8S_NAMESPACE) svc/$(KIND_CLUSTER)-frontend 8080:80"
	@echo "    kubectl port-forward -n $(K8S_NAMESPACE) svc/$(KIND_CLUSTER)-backend 8000:80"
	@echo "    kubectl port-forward -n $(K8S_NAMESPACE) svc/$(KIND_CLUSTER)-grafana 3001:3000"

k8s-down:
	kind delete cluster --name $(KIND_CLUSTER)
