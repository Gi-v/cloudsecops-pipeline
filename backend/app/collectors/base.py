"""Shared collector interface. Every provider collector (real or simulated)
implements `collect()` and returns a flat list of resource documents ready
to publish to Kafka's `findings.raw` topic.
"""
from abc import ABC, abstractmethod
from typing import Any


class BaseCollector(ABC):
    provider: str

    @abstractmethod
    async def collect(self) -> list[dict[str, Any]]:
        """Return a list of resource documents:
        {
            "resource_urn": "arn:aws:s3:::prod-data-lake",
            "provider": "AWS",
            "resource_type": "s3_bucket",
            "region": "us-east-1",
            "account_id": "123456789012",
            "config": { ... resource-type-specific fields consumed by Rego policies ... },
        }
        """
        raise NotImplementedError
