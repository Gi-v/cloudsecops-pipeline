"""Collector tests — verify the synthetic generators produce well-formed
resource documents matching what the policy engine expects."""
import asyncio

import pytest

from app.collectors.aws_collector import AWSCollector
from app.collectors.azure_collector import AzureCollector
from app.collectors.gcp_collector import GCPCollector

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
