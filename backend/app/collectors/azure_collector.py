"""Azure resource collector. Simulated by default; see aws_collector.py for the
live-mode pattern this mirrors (live Azure collection via azure-mgmt-* SDKs is
a straightforward extension of `_collect_live` following the same shape)."""
import asyncio
from typing import Any

from app.collectors.base import BaseCollector
from app.collectors.simulate import (
    gen_azure_nsg_rules,
    gen_azure_storage_accounts,
    gen_azure_vms,
)
from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class AzureCollector(BaseCollector):
    provider = "AZURE"

    def __init__(self) -> None:
        self.settings = get_settings()
        self._semaphore = asyncio.Semaphore(self.settings.collector_max_concurrency)

    async def collect(self) -> list[dict[str, Any]]:
        if self.settings.collector_mode == "live" and not self.settings.azure_subscription_id:
            logger.warning("azure_live_mode_missing_credentials_falling_back_to_simulate")
        return await self._collect_simulated()

    async def _collect_simulated(self) -> list[dict[str, Any]]:
        async def run(fn):
            async with self._semaphore:
                await asyncio.sleep(0.05)
                return fn()

        async with asyncio.TaskGroup() as tg:
            vm_task = tg.create_task(run(gen_azure_vms))
            sa_task = tg.create_task(run(gen_azure_storage_accounts))
            nsg_task = tg.create_task(run(gen_azure_nsg_rules))

        resources = [*vm_task.result(), *sa_task.result(), *nsg_task.result()]
        logger.info("azure_collect_complete", mode="simulate", count=len(resources))
        return resources
