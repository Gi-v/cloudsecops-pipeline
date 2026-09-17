<div align="center">

<img width="100%" src="./.github/assets/banner.svg" alt="CloudSecOps Pipeline — collect, evaluate, evidence, broadcast, alert" />

<a href="https://github.com/Gi-v/cloudsecops-pipeline/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Gi-v/cloudsecops-pipeline/ci.yml?branch=main&style=for-the-badge&label=CI&labelColor=0f0f1a&color=5b6af0" alt="CI status" /></a>
<img src="https://img.shields.io/badge/backend-111%20tests-5b6af0?style=for-the-badge&labelColor=0f0f1a" alt="backend tests" />
<img src="https://img.shields.io/badge/frontend-109%20tests-5b6af0?style=for-the-badge&labelColor=0f0f1a" alt="frontend tests" />
<img src="https://img.shields.io/badge/license-MIT-5b6af0?style=for-the-badge&labelColor=0f0f1a" alt="MIT license" />

<br/>

<img src="https://img.shields.io/badge/Python-3.13-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python 3.13" />
<img src="https://img.shields.io/badge/FastAPI-0.141-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI" />
<img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=101010" alt="React 19" />
<img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
<img src="https://img.shields.io/badge/Kafka-7.9-231F20?style=flat-square&logo=apachekafka&logoColor=white" alt="Kafka" />
<img src="https://img.shields.io/badge/OPA-1.20-7B61FF?style=flat-square&logo=opsgenie&logoColor=white" alt="Open Policy Agent" />
<img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" />
<img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker Compose" />

<br/><br/>

<a href="https://readme-typing-svg.demolab.com/">
  <img src="https://readme-typing-svg.demolab.com/?font=JetBrains+Mono&size=16&duration=2600&pause=1100&color=8C7CFF&center=true&vCenter=true&multiline=true&repeat=true&width=750&height=60&lines=collect+%E2%86%92+publish+%E2%86%92+evaluate+%E2%86%92+enrich+%E2%86%92+broadcast;AWS+%2F+GCP+%2F+Azure+%E2%86%92+Kafka+%E2%86%92+OPA%2FRego+%E2%86%92+hash-chained+evidence" alt="pipeline typing animation" />
</a>

</div>

<p align="center"><b>Hareem Ahmad</b> · ArZens Security Engineering Internship 2025</p>

<p align="center">
Continuously inventories AWS/GCP/Azure resources, evaluates every one against
CIS Benchmark v2, NIST CSF, and ISO 27001 controls through an OPA/Rego policy engine,
and writes every finding to a tamper-evident SHA-256 hash-chained evidence store —
replacing a manual, spreadsheet-driven cloud audit with a real-time event pipeline.
</p>

<p align="center">
  <a href="#-live-dashboard">Screenshots</a> ·
  <a href="#-quick-start">Quick start</a> ·
  <a href="#-architecture">Architecture</a> ·
  <a href="#-what-it-does">Features</a> ·
  <a href="#-verification">Verification</a> ·
  <a href="ARCHITECTURE.md">Full design doc</a>
</p>

---

## 📸 Live dashboard

<table>
<tr>
<td width="50%">

**Compliance Dashboard**
Security score (colored by its own compliance band, not a fixed color), a real "N min ago" last-scan time, a real critical-count trend chip, severity breakdown, framework coverage, a score-over-time trend with a real resources-scanned sparkline, top-risk resources, and a live WebSocket findings feed — every number on this page comes from a real scan, including the small ones.

</td>
<td width="50%">

**Findings**
Filter by severity, search, bulk-resolve, export to CSV — every row backed by an OPA-evaluated policy violation.

</td>
</tr>
<tr>
<td><img src="./.github/assets/dashboard.png" width="100%" alt="Dashboard screenshot" /></td>
<td><img src="./.github/assets/findings.png" width="100%" alt="Findings table screenshot" /></td>
</tr>
<tr>
<td width="50%">

**Policy Simulator**
Paste any resource JSON and watch it evaluate live against all 21 active Rego controls — no scan required.

</td>
<td width="50%">

**Evidence Chain**
SHA-256 hash-chain verification per resource — tamper-evident by construction, not by policy (ADR-003).

</td>
</tr>
<tr>
<td><img src="./.github/assets/policy-simulator.png" width="100%" alt="Policy Simulator screenshot" /></td>
<td><img src="./.github/assets/evidence.png" width="100%" alt="Evidence chain screenshot" /></td>
</tr>
</table>

<details>
<summary><b>Resources inventory</b> (click to expand)</summary>
<br/>
<img src="./.github/assets/resources.png" width="100%" alt="Resources screenshot" />
</details>

---

## 🧭 Architecture

```mermaid
flowchart LR
    subgraph Collectors["Collectors (async)"]
        AWS[AWS]
        GCP[GCP]
        AZ[Azure]
    end

    subgraph Kafka["Kafka"]
        RAW([findings.raw])
        ENR([findings.enriched])
        ALERT([alerts.critical])
    end

    OPA{{"OPA / Rego\n21 controls · 3 frameworks"}}
    FALLBACK["pure-Python fallback\n(OPA unreachable)"]
    PG[(PostgreSQL)]
    MINIO[(MinIO\nSHA-256 hash chain)]
    REDIS[(Redis\nrate limiter)]
    WS[/WebSocket/]
    API[FastAPI]
    DASH["React Dashboard\ntrend + top-risk analytics"]
    HOOK[[Webhook / Log alert]]

    AWS & GCP & AZ --> RAW
    RAW --> OPA
    OPA -.unreachable.-> FALLBACK
    OPA --> PG
    OPA --> MINIO
    OPA --> ENR
    ENR --> WS --> DASH
    ENR -- CRITICAL --> ALERT --> HOOK
    API -- rate limits scans --> REDIS
    API --> WS
    DASH -.REST.-> API

    style Kafka fill:#121218,stroke:#5b6af0,color:#ededf0
    style OPA fill:#1a1a22,stroke:#5b6af0,color:#ededf0
    style DASH fill:#0d0d10,stroke:#5b6af0,color:#ededf0
    style FALLBACK fill:#0d0d10,stroke:#3e3e50,color:#7a7a8c,stroke-dasharray: 4 3
```

Six independently-scaling stages connected by Kafka rather than direct calls, so a slow
policy evaluation never blocks collection and a dashboard reconnect never blocks
evaluation. Every external dependency degrades gracefully instead of taking the pipeline
down with it: OPA unreachable falls back to an equivalent pure-Python evaluator, MinIO
unreachable falls back to local-disk evidence storage, Redis unreachable falls back to
in-memory rate limiting — the demo runs end-to-end even with zero infra containers up.
Every architectural choice — Kafka as the backbone, Rego as policy-as-code, the
hash-chain evidence design, `asyncio` for collection — has a written decision record in
[`docs/adr/`](docs/adr):

| ADR | Decision |
|---|---|
| [001](docs/adr/ADR-001-kafka-event-backbone.md) | Kafka as the event backbone |
| [002](docs/adr/ADR-002-opa-rego-policy-as-code.md) | OPA/Rego for policy-as-code |
| [003](docs/adr/ADR-003-evidence-store-hash-chain.md) | MinIO + SHA-256 hash chain for evidence |
| [004](docs/adr/ADR-004-asyncio-collection.md) | `asyncio` for cloud resource collection |

Full system design, data flow, and failure-mode handling: **[ARCHITECTURE.md](ARCHITECTURE.md)**.

---

## ✨ What it does

<table>
<tr>
<td width="33%" valign="top">

### 🔍 Collect
Async AWS/GCP/Azure collectors inventory resources concurrently and publish each one to Kafka — no synchronous, region-by-region API crawling.

</td>
<td width="33%" valign="top">

### ⚖️ Evaluate
Every resource is checked against **21 Rego controls** across **CIS v2, NIST CSF, and ISO 27001** by a real OPA server, with a pure-Python fallback if OPA is unreachable.

</td>
<td width="33%" valign="top">

### 🔐 Prove it
Every finding is archived to MinIO as `sha256(payload + prev_hash)` — an append-only chain per resource that a single altered byte anywhere breaks detectably.

</td>
</tr>
<tr>
<td width="33%" valign="top">

### 📡 Broadcast
Enriched findings push to every connected dashboard over a **single shared WebSocket** the moment they're evaluated — no polling, ever.

</td>
<td width="33%" valign="top">

### 🚨 Alert
CRITICAL violations fan out to a dedicated Kafka topic and deliver via webhook (Slack/Discord-compatible) or structured log — never silently dropped.

</td>
<td width="33%" valign="top">

### 🧪 Simulate
The Policy Simulator evaluates arbitrary pasted JSON against the live control catalog instantly — draft a fix and verify it before touching real infrastructure.

</td>
</tr>
</table>

---

## 🚀 Quick start

**Full stack, one command:**

```bash
cp .env.example .env
docker compose up --build
```

| Service | URL |
|---|---|
| 🖥️ Dashboard | http://localhost:5173 |
| 📘 API docs (Swagger) | http://localhost:8000/docs |
| ⚖️ OPA console | http://localhost:8181 |
| 🪣 MinIO console | http://localhost:9001 |

<details>
<summary><b>Backend only, no Docker</b> — everything gracefully falls back to in-process/local-disk when Kafka/OPA/MinIO aren't running</summary>

```bash
cd backend
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

See [`backend/README.md`](backend/README.md) for details.
</details>

<details>
<summary><b>Frontend only</b></summary>

```bash
cd frontend
npm install
npm run dev
```
</details>

### Try it

1. Open the dashboard and click **Run Scan** — triggers `POST /api/scan`, which runs all
   three simulated collectors, publishes to `findings.raw`, evaluates every resource
   against the Rego bundle, and republishes enriched results to `findings.enriched`.
2. Watch findings stream into the **Live Findings Feed** in real time — no polling.
3. Open **Findings** to filter by severity, search, or bulk-resolve.
4. Open **Policy Simulator** and paste any resource JSON to see it evaluated against
   every active control instantly.
5. Open **Evidence Chain**, paste a resource URN (copy one from **Resources**), and click
   **Lookup** to see its hash chain and verification result.

---

## 🎭 What's real vs. simulated

| | |
|---|---|
| ✅ **Real** | The FastAPI backend, Kafka pub/sub, OPA policy evaluation (21 Rego controls, unit-tested), the SHA-256 evidence hash chain, the Postgres schema, the WebSocket live feed, and the full React dashboard all run and do exactly what they claim. |
| 🧪 **Simulated by default** | The AWS/GCP/Azure collectors generate a realistic synthetic resource inventory instead of calling real cloud APIs, so the whole pipeline runs and demos with zero cloud accounts. Set `COLLECTOR_MODE=live` and supply credentials to point the AWS collector at a real account — the collector contract is identical either way. |

---

## ✅ Verification

```bash
# Backend — 111/111 passing, 92% coverage (78 need nothing; 33 exercise
# findings/resources/evidence/scan/metrics/the evaluator against a real
# cloudsecops_test Postgres database — `docker compose up -d postgres`
# first, then create it once:
#   PGPASSWORD=cloudsecops_dev_password psql -h localhost -U cloudsecops \
#     -d cloudsecops -c "CREATE DATABASE cloudsecops_test"
cd backend && pytest -q
ruff check app && mypy app

# Frontend — 109/109 passing
cd frontend && npm test
npx tsc -b --noEmit && npx eslint . && npm run build
```

Every dependency in this repo is pinned to its current stable release (FastAPI 0.141,
React 19, Vite 8, OPA 1.20, ...) and the whole stack was driven live in a real browser to
confirm it — not just type-checked. That pass caught and fixed a real bug: upgrading
`framer-motion` broke `AnimatePresence`'s exit-animation tracking app-wide, which silently
froze every client-side page navigation. Full write-up of what broke and how it was
diagnosed is in the commit history.

---

## 📁 Repository layout

```
cloudsecops-pipeline/
├── backend/            FastAPI service — collectors, Kafka, policy evaluation, evidence store, REST/WS API
├── policies/            Rego policy source (CIS / NIST / ISO 27001) + unit tests
├── frontend/            React + TypeScript compliance dashboard
├── infra/
│   ├── k8s/               Helm chart for production deployment
│   └── github-actions/    CI/CD workflow (mirrored to .github/workflows/ci.yml)
├── docs/adr/             Architecture Decision Records
├── portfolio/            Standalone single-page portfolio/marketing site
└── docker-compose.yml   Full local stack
```

---

## 🤝 Contributing

Issues and PRs are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

## 📄 License

MIT — see [LICENSE](LICENSE).

<div align="center">

<img width="100%" src="./.github/assets/footer.svg" alt="" />

</div>
