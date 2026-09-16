"""HTTP client for Open Policy Agent's REST API, with a local pure-Python
fallback (see local_fallback.py) so the pipeline runs end-to-end even
without an OPA server available — useful for `uvicorn app.main:app` without
Docker Compose.
"""
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger
from app.policy_engine.local_fallback import evaluate_local

logger = get_logger(__name__)


class OPAClient:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._client = httpx.AsyncClient(base_url=self.settings.opa_url, timeout=5.0)
        self._opa_reachable: bool | None = None

    async def health_check(self) -> bool:
        try:
            resp = await self._client.get("/health")
            self._opa_reachable = resp.status_code == 200
        except Exception:
            self._opa_reachable = False
        return self._opa_reachable

    async def evaluate(self, resource: dict[str, Any]) -> dict[str, Any]:
        """Returns {"violations": [...], "passed_controls": [...]}."""
        try:
            resp = await self._client.post(
                f"{self.settings.opa_policy_path}/evaluate",
                json={"input": resource},
            )
            resp.raise_for_status()
            result = resp.json().get("result")
            if result is not None:
                return result
            logger.warning("opa_empty_result_falling_back")
        except Exception as exc:
            logger.warning("opa_unreachable_using_local_fallback", error=str(exc))

        return evaluate_local(resource)

    async def aclose(self) -> None:
        await self._client.aclose()


opa_client = OPAClient()
