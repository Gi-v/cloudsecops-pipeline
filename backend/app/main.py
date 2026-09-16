"""CloudSecOps Pipeline — FastAPI application entrypoint.

Wires together: collectors -> Kafka (findings.raw) -> policy engine consumer
-> Postgres + evidence store -> Kafka (findings.enriched) -> WebSocket
broadcast to the dashboard, plus a critical-alert side channel
(findings.enriched -> alerts.critical -> webhook/log delivery).
See ARCHITECTURE.md for the full data flow.
"""
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator
from slowapi.errors import RateLimitExceeded

from app.alerting.notifier import deliver_alert, extract_critical_alerts
from app.api.routes import evidence, findings, health, metrics, policies, resources, scan
from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger
from app.core.middleware import RequestContextMiddleware
from app.core.rate_limit import limiter
from app.db.database import AsyncSessionLocal, init_models
from app.kafka.consumer import KafkaConsumerClient
from app.kafka.producer import producer_client
from app.kafka.topics import ALERTS_CRITICAL, FINDINGS_ENRICHED, FINDINGS_RAW
from app.policy_engine.evaluator import evaluate_and_persist
from app.websocket.live_feed import manager

configure_logging()
logger = get_logger(__name__)
settings = get_settings()

_raw_consumer: KafkaConsumerClient | None = None
_enriched_consumer: KafkaConsumerClient | None = None
_alert_consumer: KafkaConsumerClient | None = None


async def handle_raw_finding(message: dict) -> None:
    """Consumer callback for `findings.raw`: evaluate + persist, then
    republish the enriched result."""
    correlation_id = message.pop("correlation_id", "unknown")
    async with AsyncSessionLocal() as db:
        try:
            enriched = await evaluate_and_persist(db, message, correlation_id)
            await producer_client.send(FINDINGS_ENRICHED, enriched, key=enriched["resource_urn"])
        except Exception:
            await db.rollback()
            logger.exception("finding_evaluation_failed", resource_urn=message.get("resource_urn"))


async def handle_enriched_finding(message: dict) -> None:
    """Consumer callback for `findings.enriched`: push to connected
    dashboards, and fan out any CRITICAL violations to the alert topic."""
    await manager.broadcast({"type": "finding.enriched", "data": message})

    for alert in extract_critical_alerts(message):
        await producer_client.send(ALERTS_CRITICAL, alert, key=alert["resource_urn"])


async def handle_critical_alert(message: dict) -> None:
    """Consumer callback for `alerts.critical`: deliver via webhook/log."""
    await deliver_alert(message)


async def _auto_seed() -> None:
    """Runs one scan shortly after startup so the dashboard is never staring
    at an empty state on first load — a small but real UX difference between
    a demo that "works if you know to click Run Scan" and one that's alive
    the moment you open it. Controlled by AUTO_SEED_ON_STARTUP.
    """
    from app.api.routes.scan import run_scan_standalone

    await asyncio.sleep(2)  # let consumers finish subscribing first
    try:
        scan_run = await run_scan_standalone(provider=None)
        logger.info("auto_seed_complete", resources=scan_run.resources_scanned)
    except Exception:
        logger.exception("auto_seed_failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _raw_consumer, _enriched_consumer, _alert_consumer

    await init_models()
    await producer_client.start()

    _raw_consumer = KafkaConsumerClient(FINDINGS_RAW, group_id="policy-engine")
    _raw_consumer.start(handle_raw_finding)

    _enriched_consumer = KafkaConsumerClient(FINDINGS_ENRICHED, group_id="dashboard-broadcaster")
    _enriched_consumer.start(handle_enriched_finding)

    _alert_consumer = KafkaConsumerClient(ALERTS_CRITICAL, group_id="alert-notifier")
    _alert_consumer.start(handle_critical_alert)

    seed_task: asyncio.Task | None = None
    if settings.auto_seed_on_startup:
        seed_task = asyncio.create_task(_auto_seed())

    logger.info("cloudsecops_backend_started", env=settings.app_env)
    yield

    if seed_task:
        seed_task.cancel()
    if _raw_consumer:
        await _raw_consumer.stop()
    if _enriched_consumer:
        await _enriched_consumer.stop()
    if _alert_consumer:
        await _alert_consumer.stop()
    await producer_client.stop()
    logger.info("cloudsecops_backend_stopped")


app = FastAPI(
    title="CloudSecOps Pipeline API",
    description="Event-driven cloud compliance automation — AWS/GCP/Azure collectors, "
                 "OPA policy evaluation, tamper-evident evidence store.",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={
            "error": "rate_limited",
            "detail": f"Too many scan requests — limit is {exc.detail}. Try again shortly.",
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("unhandled_exception", path=str(request.url))
    return JSONResponse(
        status_code=500,
        content={"error": "internal_error", "detail": "An unexpected error occurred."},
    )


app.add_middleware(RequestContextMiddleware)

app.add_middleware(
    CORSMiddleware,
    # allow_origins=["*"] combined with allow_credentials=True is invalid per
    # the Fetch spec — browsers refuse to honor a wildcard
    # Access-Control-Allow-Origin on a credentialed request, so it silently
    # breaks any cross-origin call that sends cookies/auth headers instead of
    # actually being permissive. Use the explicit configured origin list.
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count", "X-Request-ID"],
)

# /metrics — Prometheus scrape endpoint (request count/latency histograms by
# route). Exposed automatically; no app code needs to touch it.
Instrumentator().instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)

app.include_router(health.router)
app.include_router(scan.router)
app.include_router(resources.router)
app.include_router(findings.router)
app.include_router(policies.router)
app.include_router(evidence.router)
app.include_router(metrics.router)


@app.websocket("/ws/live")
async def ws_live_findings(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        while True:
            # Client doesn't need to send anything; keep the connection open
            # and drop it cleanly on disconnect.
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.get("/")
async def root() -> dict:
    return {
        "service": "CloudSecOps Pipeline API",
        "docs": "/docs",
        "websocket": "/ws/live",
        "health": "/healthz",
        "metrics": "/metrics",
    }
