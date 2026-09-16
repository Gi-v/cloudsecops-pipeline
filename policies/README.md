# Policies

Rego policy-as-code, organized by compliance framework. All files share
`package cloudsecops` and contribute to the same `violation[v]` / `passed[control_id]`
multi-value rules; `main.rego` aggregates them into the `evaluate` response the backend
calls via OPA's REST API.

```
policies/
├── main.rego            aggregation entrypoint (evaluate := {...})
├── cis/                 CIS AWS Foundations Benchmark v2
│   ├── s3_buckets.rego
│   ├── iam.rego
│   └── network.rego
├── nist/                NIST CSF 2.0
│   ├── data_protection.rego
│   ├── access_control.rego
│   └── logging_monitoring.rego
├── iso27001/             ISO/IEC 27001 Annex A
│   ├── storage.rego
│   └── network.rego
└── tests/                conftest / opa test unit tests
    ├── s3_buckets_test.rego
    └── network_test.rego
```

## Running policy tests

With the OPA CLI installed:

```bash
opa test policies/ -v
```

Or with [conftest](https://www.conftest.dev/) (used in CI, see
`infra/github-actions/ci.yml`):

```bash
conftest verify --policy policies/
```

## Evaluating a resource manually

Once OPA is running (`docker compose up opa`, or `opa run --server policies/`):

```bash
curl -X POST http://localhost:8181/v1/data/cloudsecops/evaluate \
  -H "Content-Type: application/json" \
  -d '{"input": {"resource_type": "aws_s3_bucket", "config": {"bucket_name": "demo", "acl": "public-read"}}}'
```

## Adding a new control

1. Pick the framework directory (`cis/`, `nist/`, `iso27001/`) or create a new one.
2. Add a `violation[v] { ... }` rule (fires when the control is violated) and a matching
   `passed[control_id] { ... }` rule (fires when the resource satisfies the control).
3. Add a test case in `tests/` with a fixture resource for both the pass and fail path.
4. No backend redeploy is required — OPA hot-reloads the policy bundle directory. This is
   the entire point of ADR-002.
