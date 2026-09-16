"""Policy catalog + ad-hoc evaluation endpoint (powers the frontend's Policy
Simulator — paste a resource JSON, see it evaluated live against every rule).
"""
from datetime import UTC, datetime

from fastapi import APIRouter

from app.policy_engine.catalog import CONTROL_CATALOG, SAMPLE_RESOURCES
from app.policy_engine.opa_client import opa_client
from app.schemas.schemas import PolicyEvalRequest, PolicyEvalResult

router = APIRouter(prefix="/api/policies", tags=["policies"])


@router.get("")
async def list_controls() -> list[dict[str, str]]:
    return CONTROL_CATALOG


@router.get("/samples")
async def list_sample_resources() -> dict[str, dict]:
    """Example resource documents for each supported resource_type — used to
    seed the frontend policy simulator's dropdown."""
    return SAMPLE_RESOURCES


@router.post("/evaluate", response_model=PolicyEvalResult)
async def evaluate_resource(req: PolicyEvalRequest) -> PolicyEvalResult:
    result = await opa_client.evaluate(req.resource)
    fallback_urn = req.resource.get("config", {}).get("bucket_name", "ad-hoc")
    return PolicyEvalResult(
        resource_urn=req.resource.get("resource_urn", fallback_urn),
        violations=result.get("violations", []),
        passed_controls=result.get("passed_controls", []),
        evaluated_at=datetime.now(UTC),
    )
