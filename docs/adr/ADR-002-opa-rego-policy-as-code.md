# ADR-002: OPA/Rego for Policy-as-Code

**Status:** Accepted

## Context

Compliance rules (CIS Benchmarks, NIST CSF 2.0 controls, ISO 27001 Annex A) change on a
different cadence than application code and are typically owned by a security/compliance
team, not the engineering team shipping the scanner. Hard-coding rule logic in Python would
force a full backend deploy for every rule change and make it hard to reason about which
rules were active at the time a given finding was produced.

## Decision

Use Open Policy Agent with Rego policies as the single source of truth for compliance
logic. Policies live under `policies/<framework>/*.rego`, are mounted read-only into the
OPA container, and are hot-reloaded — OPA watches the policy bundle directory. The FastAPI
backend never encodes compliance logic itself; it only calls OPA's REST API with a resource
document and receives structured violations back.

Each policy is unit-tested with `conftest` against fixture resources (`policies/tests/`)
and run in CI before merge.

## Consequences

**Positive**
- Security team updates a policy by editing a `.rego` file and merging a PR — no
  engineering deploy cycle.
- Policies are independently version-controlled and diffable; a PR reviewer sees exactly
  which control changed.
- The same policy bundle can be evaluated identically in CI (`conftest test`), locally, and
  in production — no drift between "what CI checked" and "what prod enforces."

**Negative**
- Rego has a learning curve distinct from the team's primary language (Python).
- Complex cross-resource policies (e.g., "flag an EC2 instance if its attached security
  group AND its IAM role are both overly permissive") require careful input document design
  since Rego evaluates one input at a time.

**Mitigation:** the collector's enrichment step pre-joins related resources (e.g., attaches
security group rules to the EC2 instance document) before evaluation, so most policies stay
single-document and simple.
