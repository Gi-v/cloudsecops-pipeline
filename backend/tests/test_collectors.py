"""Collector tests — verify the synthetic generators produce well-formed
resource documents matching what the policy engine expects."""
import asyncio

import pytest

from app.collectors.aws_collector import AWSCollector
from app.collectors.azure_collector import AzureCollector
from app.collectors.gcp_collector import GCPCollector
from app.core.config import get_settings

REQUIRED_KEYS = {"resource_urn", "provider", "resource_type", "region", "account_id", "config"}


@pytest.mark.asyncio
async def test_aws_collector_returns_well_formed_resources():
    resources = await AWSCollector().collect()
    assert len(resources) > 0
    for r in resources:
        assert REQUIRED_KEYS <= r.keys()
        assert r["provider"] == "AWS"
        assert isinstance(r["config"], dict)


@pytest.mark.asyncio
async def test_gcp_collector_returns_well_formed_resources():
    resources = await GCPCollector().collect()
    assert len(resources) > 0
    for r in resources:
        assert REQUIRED_KEYS <= r.keys()
        assert r["provider"] == "GCP"


@pytest.mark.asyncio
async def test_azure_collector_returns_well_formed_resources():
    resources = await AzureCollector().collect()
    assert len(resources) > 0
    for r in resources:
        assert REQUIRED_KEYS <= r.keys()
        assert r["provider"] == "AZURE"


@pytest.mark.asyncio
async def test_all_collectors_run_concurrently_without_error():
    results = await asyncio.gather(
        AWSCollector().collect(),
        GCPCollector().collect(),
        AzureCollector().collect(),
    )
    assert all(len(r) > 0 for r in results)


@pytest.mark.asyncio
async def test_live_mode_without_boto3_raises_a_helpful_error():
    """boto3 isn't a base dependency (see pyproject.toml's live-collectors
    extra) and isn't installed in this test environment — exactly the
    situation COLLECTOR_MODE=live hits on a fresh `pip install -r
    requirements.txt` with no extras. Should fail with a clear, actionable
    message telling the caller how to fix it, not a raw ImportError
    traceback three frames from anything meaningful."""
    settings = get_settings()
    orig_mode = settings.collector_mode
    settings.collector_mode = "live"
    try:
        with pytest.raises(RuntimeError, match="live-collectors"):
            await AWSCollector().collect()
    finally:
        settings.collector_mode = orig_mode
