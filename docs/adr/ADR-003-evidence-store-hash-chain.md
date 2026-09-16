# ADR-003: MinIO + SHA-256 Hash Chain for Evidence Store

**Status:** Accepted

## Context

Audit evidence must be tamper-evident: if an attacker (or a well-meaning engineer under
deadline pressure) compromises the scanner or its database, they should not be able to
retroactively edit a finding to hide a past violation without that edit being detectable.
Standard database rows with access control (`UPDATE` permissions revoked) are not
sufficient — an admin-level compromise or a direct database edit bypasses the application
layer entirely.

## Decision

Every evaluated finding is written as an immutable blob to MinIO (S3-compatible object
storage), addressed by `sha256(finding_json)`. Each blob's metadata includes
`prev_hash` — the hash of the previous evidence record for that same resource — forming a
per-resource hash chain, conceptually similar to a blockchain's block-linking but without
consensus overhead (this is a single-writer system, not a distributed ledger).

Postgres stores only the index (resource_id → current hash, timestamp, severity) for fast
querying; the evidentiary content lives exclusively in MinIO and is never mutated after
write.

`GET /api/evidence/{resource_id}/verify` walks the chain from genesis and recomputes every
hash, returning `valid: true` only if every link matches — any modification, insertion, or
deletion breaks the chain at that point and is reported.

## Consequences

**Positive**
- Tampering is cryptographically detectable, not just access-controlled.
- Audit prep time dropped from a manual evidence-gathering exercise to
  `GET /api/evidence/export?range=...` — the chain doubles as an auto-assembled audit
  package.
- Immutability is enforced at the storage layer (write-once semantics), not just by
  application logic that could have a bug.

**Negative**
- No in-place correction. A finding later determined to be a false positive is not deleted;
  a new "superseded" record is appended, and the chain is queried for the *current* state,
  which is always the most recent link.
- Storage grows monotonically. Mitigated by MinIO lifecycle policies that move
  records older than the compliance retention window to cold storage (glacier-tier), never
  deleting them outright.

## Verification Sketch

```
hash_0 = sha256(finding_0)
hash_1 = sha256(finding_1 + hash_0)
hash_2 = sha256(finding_2 + hash_1)
...
```

Any change to `finding_i` for `i < n` changes `hash_i`, which no longer matches what
`finding_{i+1}` recorded as `prev_hash` — the break is localized to the exact tampered
record.
