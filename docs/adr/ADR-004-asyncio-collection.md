# ADR-004: asyncio for Cloud Resource Collection

**Status:** Accepted

## Context

The initial collector implementation called cloud provider APIs sequentially: list EC2
instances, then S3 buckets, then IAM roles, then KMS keys, per region. A full scan of a
single AWS account across 4 resource types and 3 regions took ~42 seconds — too slow for
the near-real-time compliance dashboard the pipeline is meant to feed.

## Decision

Rewrite all collectors using Python's `asyncio` with `TaskGroup` (Python 3.11+) to batch
independent API calls concurrently. Each resource-type fetch (EC2, S3, IAM, KMS) runs as a
separate task within a `TaskGroup`; results are gathered once all tasks complete, then
flattened and published to Kafka as a single batch.

```python
async def collect_aws(session) -> list[dict]:
    async with asyncio.TaskGroup() as tg:
        ec2_task = tg.create_task(get_ec2_instances(session))
        s3_task  = tg.create_task(get_s3_buckets(session))
        iam_task = tg.create_task(get_iam_roles(session))
        kms_task = tg.create_task(get_kms_keys(session))
    return flatten([ec2_task.result(), s3_task.result(),
                     iam_task.result(), kms_task.result()])
```

## Consequences

**Positive**
- Scan time dropped from ~42s to ~4.1s — a 10× improvement — with no change to downstream
  consumers (the Kafka message shape is identical).
- `TaskGroup`'s structured concurrency means one failing sub-task cancels the group
  cleanly and surfaces the real exception, instead of silently dropping partial results.
- Memory footprint stays roughly constant since each collector still processes one
  region/account at a time — only the resource types within a region run concurrently.

**Negative**
- Requires Python 3.11+ (`TaskGroup` was added in 3.11); pinned in `pyproject.toml`.
- Concurrent API calls can trip cloud provider rate limits faster than sequential calls did.
  Mitigated with a semaphore-based concurrency cap (`COLLECTOR_MAX_CONCURRENCY`, default 8)
  shared across all in-flight requests per provider session.
