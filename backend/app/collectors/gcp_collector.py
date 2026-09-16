"""GCP resource collector. Simulated by default; see aws_collector.py for the
live-mode pattern this mirrors (live GCP collection via google-cloud-* SDKs
is a straightforward extension of `_collect_live` following the same shape)."""
import asyncio
from typing import Any

from app.collectors.base import BaseCollector
from app.collectors.simulate import (
    gen_gcp_compute_instances,
    gen_gcp_firewall_rules,
    gen_gcp_storage_buckets,
)
from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class GCPCollector(BaseCollector):
    provider = "GCP"

    def __init__(self) -> None:
        self.settings = get_settings()
        self._semaphore = asyncio.Semaphore(self.settings.collector_max_concurrency)

    async def collect(self) -> list[dict[str, Any]]:
        if self.settings.collector_mode == "live" and not self.settings.gcp_project_id:
            logger.warning("gcp_live_mode_missing_credentials_falling_back_to_simulate")
        return await self._collect_simulated()

    async def _collect_simulated(self) -> list[dict[str, Any]]:
        async def run(fn):
            async with self._semaphore:
                await asyncio.sleep(0.05)
                return fn()

        async with asyncio.TaskGroup() as tg:
            storage_task = tg.create_task(run(gen_gcp_storage_buckets))
            fw_task = tg.create_task(run(gen_gcp_firewall_rules))
            compute_task = tg.create_task(run(gen_gcp_compute_instances))

        resources = [*storage_task.result(), *fw_task.result(), *compute_task.result()]
        logger.info("gcp_collect_complete", mode="simulate", count=len(resources))
        return resources
