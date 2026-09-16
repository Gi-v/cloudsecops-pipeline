"""Liveness/readiness endpoints — used by Docker healthchecks and k8s probes."""
from fastapi import APIRouter

from app.kafka.producer import producer_client
from app.policy_engine.opa_client import opa_client

router = APIRouter(tags=["health"])


@router.get("/healthz")
async def healthz() -> dict:
    return {"status": "ok"}


@router.get("/readyz")
async def readyz() -> dict:
    opa_ok = await opa_client.health_check()
    return {
        "status": "ready",
        "kafka_connected": producer_client.is_connected,
        "opa_connected": opa_ok,
    }
