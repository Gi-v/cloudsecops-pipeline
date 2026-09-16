# ADR-001: Apache Kafka as the Event Backbone

**Status:** Accepted

## Context

Six independent scanners (AWS, GCP, Azure resource collectors, plus future scanners for
container registries, IaC repos, etc.) each produce findings at different rates. If each
scanner called the policy engine directly, adding a scanner would mean modifying the policy
engine's ingress code, and scaling the policy engine would require coordinating with every
producer. This creates O(N×M) coupling between collectors and consumers.

## Decision

Adopt Apache Kafka as the sole integration layer between services. Producers publish to
well-known topics (`findings.raw`, `findings.enriched`, `alerts.critical`) without knowledge
of consumers. Consumer groups allow the policy engine to scale horizontally by adding
instances — Kafka handles partition rebalancing automatically.

## Consequences

**Positive**
- New collectors ship by writing a producer and pointing it at `findings.raw` — zero
  changes to the policy engine.
- The policy engine scales independently by adding consumer instances to the same group.
- Kafka's durability means a policy engine restart doesn't lose in-flight findings —
  consumption resumes from the last committed offset.

**Negative**
- Adds operational complexity: a Kafka + ZooKeeper cluster to run and monitor.
- Debugging a multi-hop pipeline requires correlating messages across topics rather than
  reading a single call stack.

**Mitigation:** every message carries a `correlation_id` set by the originating collector,
propagated through enrichment, so a single resource's full evaluation history can be
reconstructed from `correlation_id` alone.
