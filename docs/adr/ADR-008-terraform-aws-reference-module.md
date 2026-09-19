# ADR-008: Terraform AWS Reference Module — Validated, Not Applied

**Status:** Accepted

## Context

Nothing in this project expressed what its cloud footprint would actually look like — no
Terraform, Pulumi, or CloudFormation existed anywhere in the repository before this change.
The Helm chart (`infra/k8s/`) is genuinely deployable, but only once a Kubernetes cluster and
its surrounding cloud resources (network, managed database, object storage) already exist;
nothing showed how those would be provisioned for real.

## Decision

A Terraform reference module for AWS, under `infra/terraform/`, structured as
`modules/{network,eks,data,kafka}` plus a root `environments/prod` that wires them together —
see `infra/terraform/README.md` for the full resource-to-component mapping and cost estimate.
Three choices worth recording:

**IRSA over static credentials.** The evidence store's production counterpart (an S3 bucket,
replacing MinIO — `values.yaml`'s own comment already flagged this as the intended swap) is
reached via a real IAM role the backend's Kubernetes ServiceAccount assumes through OIDC
federation (`modules/eks`'s `backend_irsa` role), not a static access/secret key pair sitting
in a Secret. This mirrors the same "no long-lived credential where a scoped, assumable role
will do" reasoning as ADR-007's JWT design.

**Strimzi-on-EKS over Amazon MSK.** Documented in full in `modules/kafka/main.tf`'s own header
comment and `infra/terraform/README.md`: MSK is the lower-operational-burden choice, but it's
a second control plane and billing line this project's modest Kafka usage (three topics,
already proven to run as a single broker in the local docker-compose stack) doesn't need to
justify. Strimzi runs Kafka as ordinary pods on the same EKS node group already being paid
for. `modules/kafka` installs only the Strimzi operator — the actual `Kafka` custom resource
(broker count, storage class) is left for a follow-up once real node capacity is known, since
a one-size-fits-all default baked into a reference module is more likely wrong than helpful.

**Validated, never applied.** Verification for this module is deliberately limited to
`terraform fmt -check` and `terraform validate` — never `plan` or `apply` against a real AWS
account. This session has no cloud credentials, and provisioning real infrastructure is
exactly the kind of real-cost, real-credentials action that needs a human's own explicit
go-ahead against their own account, not something to do unilaterally. This project's actual,
live-verified deploy target remains the local `kind` cluster documented in
`infra/k8s/README.md`.

## Consequences

**Positive**
- A reviewer can see exactly what "deploy this for real" would provision, at what rough cost,
  and why each major choice (IRSA, Strimzi-vs-MSK) was made — not left to guesswork.
- IRSA is wired correctly at the IAM/OIDC level from day one, rather than being a retrofit
  once someone reaches for static credentials as the path of least resistance.

**Negative**
- Never having been planned or applied against a real account, this module's correctness is
  bounded by what `validate` can catch (internal consistency, type errors, provider schema
  conformance) — it does not guarantee a clean `apply` would succeed against a real account's
  actual quotas, existing resources, or IAM permission boundaries. Treat it as a strong
  starting point for a real deployment, reviewed and planned against a real (ideally
  non-production) account before ever being applied anywhere real.
- The IRSA role this module creates isn't yet wired to the Helm chart itself — the backend
  Deployment doesn't create or annotate a dedicated ServiceAccount with
  `eks.amazonaws.com/role-arn`. Called out explicitly in `infra/terraform/README.md` as a real
  remaining step, not silently implied as finished.
