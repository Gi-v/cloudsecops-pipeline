"""Custom Prometheus metrics — supplements the automatic HTTP request
metrics from prometheus-fastapi-instrumentator (request count/latency by
route) with domain-specific counters/gauges incremented from inside
business logic. Defined once here, in one module-import, so re-importing a
service during tests never triggers prometheus_client's "Duplicated
timeseries" registration error.
"""
from prometheus_client import Counter, Gauge

scans_triggered_total = Counter(
    "scans_triggered_total",
    "Number of collection+evaluation scans triggered",
    ["provider"],
)

findings_created_total = Counter(
    "findings_created_total",
    "Number of findings persisted by the policy evaluator",
    ["severity"],
)

evidence_chain_verifications_total = Counter(
    "evidence_chain_verifications_total",
    "Number of evidence hash-chain verification checks",
    ["result"],
)

security_score_current = Gauge(
    "security_score_current",
    "Most recently computed dashboard security score (0-100)",
)
