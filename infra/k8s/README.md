# Deploying CloudSecOps Pipeline to Kubernetes

This Helm chart (`infra/k8s/`) is fully self-contained: every dependency the app needs
(Postgres, Redis, Kafka+Zookeeper, OPA, MinIO, Prometheus+Grafana) has its own template and
deploys in-cluster by default. No external services are required to get a working install.

## Prerequisites

- A Kubernetes cluster and `kubectl` pointed at it (`kubectl config current-context`)
- [Helm](https://helm.sh/) 3.x
- For local verification: [`kind`](https://kind.sigs.k8s.io/) (or minikube) + Docker
- Both application images built and available to the cluster (see below)

## Quickstart (local, via `kind`)

```bash
make k8s-up      # creates a kind cluster, builds + loads both images, installs the chart
```

This is the fastest way to get a real, running deployment on a laptop. Under the hood it:
1. Creates a `kind` cluster named `cloudsecops` if one doesn't already exist.
2. Builds the backend (`./backend/Dockerfile`, default target) and frontend
   (`./frontend/Dockerfile`, `prod` target — the nginx-served static build, not the dev
   server docker-compose.yml uses).
3. `kind load docker-image`s both into the cluster (no registry needed for local dev).
4. Seeds the `cloudsecops-policies` ConfigMap from `./policies/` (OPA hot-reloads it — see
   ADR-002 — so policy updates never need a backend rollout).
5. `helm upgrade --install`s this chart.
6. Waits for both Deployments to report `Available`, then prints how to reach the app.

Tear down with:

```bash
make k8s-down     # deletes the kind cluster entirely
```

## Installing against a real cluster

```bash
# Build and push both images somewhere the cluster can pull from
docker build -t your-registry/cloudsecops-backend:1.0.0 ./backend
docker build --target prod -t your-registry/cloudsecops-frontend:1.0.0 ./frontend
docker push your-registry/cloudsecops-backend:1.0.0
docker push your-registry/cloudsecops-frontend:1.0.0

# Seed the OPA policy ConfigMap (or wire this into your CD pipeline).
# NOT a plain `--from-file=policies/`: that flag doesn't recurse into
# subdirectories, so it silently drops every file under policies/cis,
# policies/nist, and policies/iso27001, leaving OPA with only main.rego.
# Flatten first — every policy file declares `package cloudsecops`
# regardless of which subdirectory organizes it, so OPA doesn't care that
# the directory structure is gone once loaded (see the Makefile's k8s-up
# target, which does exactly this):
kubectl create namespace cloudsecops
rm -rf /tmp/cloudsecops-policies-flat && mkdir -p /tmp/cloudsecops-policies-flat
find policies -name "*.rego" -not -path "*/tests/*" | while read -r f; do
  cp "$f" "/tmp/cloudsecops-policies-flat/$(echo "$f" | sed -e 's#^policies/##' -e 's#/#_#g')"
done
kubectl create configmap cloudsecops-policies --from-file=/tmp/cloudsecops-policies-flat -n cloudsecops

helm upgrade --install cloudsecops infra/k8s \
  --namespace cloudsecops \
  --set backend.image.repository=your-registry/cloudsecops-backend \
  --set backend.image.tag=1.0.0 \
  --set frontend.image.repository=your-registry/cloudsecops-frontend \
  --set frontend.image.tag=1.0.0 \
  --set ingress.host=cloudsecops.yourdomain.com
```

## Secret overrides — do this before any real deployment

`templates/secrets.yaml`, `templates/postgres.yaml`, `templates/minio.yaml`, and
`templates/grafana.yaml` all ship with literal `CHANGE_ME` / `CHANGE_ME_IN_PRODUCTION_*`
placeholders — enough for `helm template`/`helm lint` to render and for a local `kind` demo to
run, but never appropriate to leave as-is anywhere real:

| Value | Where | Override with |
|---|---|---|
| Postgres password | `postgres.yaml` env + `secrets.yaml`'s `DATABASE_URL` | `--set-file` or a pre-created Secret + `--set postgres.existingSecret=...` (not yet wired — see Known Limitations) |
| `APP_SECRET_KEY` (also the JWT signing secret) | `secrets.yaml` | A real random 32+ byte value, e.g. `openssl rand -hex 32` |
| MinIO root credentials | `minio.yaml` env + `secrets.yaml`'s `MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY` | Real credentials, kept in sync between both |
| Grafana admin password | `grafana.yaml`'s Secret, from `values.yaml`'s `observability.grafana.adminPassword` | `--set observability.grafana.adminPassword=...` |
| API key (optional service-account auth) | Not set by default — `api_auth_enabled` defaults `false` | Add `API_KEY`/`API_AUTH_ENABLED` to `secrets.yaml`/`configmap.yaml` if you need the legacy service-account path (ADR-007) |

The simplest correct approach for a real environment is a secrets manager integration
(External Secrets Operator, Sealed Secrets, or your cloud provider's CSI secret store) that
populates `{{ .Release.Name }}-backend-secrets` from a real vault instead of this chart's
inline `stringData` — the Secret's *name* and *keys* are the actual contract other templates
depend on, not how it gets populated.

## What's demo-only vs. production-shaped

- **Kafka+Zookeeper** (`kafka.yaml`, `zookeeper.yaml`): single broker, replication factor 1 —
  fine for a demo, not for anything with real durability requirements. Set
  `kafka.externalBootstrapServers` to point at a managed Kafka (MSK, Confluent Cloud) instead;
  both templates skip themselves entirely when that's set.
- **Postgres, MinIO** (`postgres.yaml`, `minio.yaml`): single-instance StatefulSets with a PVC
  each — no replication, no automated backups. Point `DATABASE_URL` at RDS/Cloud SQL and
  `MINIO_ENDPOINT` at real S3 for anything real (see `infra/terraform/` for what that looks
  like on AWS).
- **Prometheus, Grafana** (`prometheus.yaml`, `grafana.yaml`, gated by
  `observability.enabled`): single replica each, one dashboard, anonymous Grafana viewer
  access enabled — matches this project's "frictionless by default" demo posture (see
  ADR-006). Disable anonymous access and set a real admin password before exposing this
  outside a trusted network.

## Verifying a deployment

```bash
kubectl get pods -n cloudsecops                          # everything should reach Running/Ready
kubectl port-forward -n cloudsecops svc/cloudsecops-frontend 8080:80 &
kubectl port-forward -n cloudsecops svc/cloudsecops-backend 8000:80 &
kubectl port-forward -n cloudsecops svc/cloudsecops-grafana 3001:3000 &
curl http://localhost:8000/healthz                        # {"status": "ok"}
open http://localhost:8080                                 # dashboard — log in as the seeded admin
open http://localhost:3001                                 # Grafana — anonymous viewer access
```

Full smoke test: log in as the seeded admin (`SEED_ADMIN_USERNAME`/`SEED_ADMIN_PASSWORD`,
defaults `admin`/`change-me-on-first-login`), trigger a scan, confirm a viewer account gets a
real 403 on the same action, and confirm the Grafana dashboard's panels populate after the scan.

## Troubleshooting

- **Backend `CrashLoopBackOff`** — check `kubectl logs -n cloudsecops deploy/cloudsecops-backend`.
  The most common cause locally is Postgres not yet ready; the Deployment's `livenessProbe`
  hitting `/healthz` should still let it come up once Postgres is (the backend itself doesn't
  hard-fail on a slow-starting database).
- **OPA never becomes ready / policy evaluation always uses the fallback** — `opa.yaml`
  intentionally has no probes (the official OPA image has no shell to exec a healthcheck
  command in — see that template's own comment); check
  `kubectl logs -n cloudsecops deploy/cloudsecops-opa` directly instead, and confirm the
  `cloudsecops-policies` ConfigMap was actually seeded (`kubectl get configmap
  cloudsecops-policies -n cloudsecops -o yaml`).
- **`helm install` succeeds but nothing is reachable via Ingress** — this chart's Ingress
  assumes an ingress-nginx controller is already installed in the cluster; `kind` doesn't ship
  one by default. For local verification, use `kubectl port-forward` (above) instead of relying
  on `ingress.yaml`.

## Known limitations

- No `existingSecret`-style override wired up yet for Postgres/MinIO credentials — today,
  changing them means editing `values.yaml` (or `--set`-ing the literal value) in more than one
  place, since the password appears both in the dependency's own Deployment/StatefulSet env
  and in `backend-secrets`' connection string. A follow-up should thread a single
  `values.yaml`-level secret name through both instead of duplicating the literal.
- No automated check ties the Grafana dashboard JSON to the metric names it queries — a
  renamed or removed Prometheus metric won't be caught until someone opens the dashboard and
  sees an empty panel.
