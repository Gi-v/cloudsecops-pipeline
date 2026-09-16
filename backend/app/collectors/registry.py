"""Lookup table from provider name to collector instance."""
from app.collectors.aws_collector import AWSCollector
from app.collectors.azure_collector import AzureCollector
from app.collectors.base import BaseCollector
from app.collectors.gcp_collector import GCPCollector

_COLLECTORS: dict[str, type[BaseCollector]] = {
    "AWS": AWSCollector,
    "GCP": GCPCollector,
    "AZURE": AzureCollector,
}


def get_collector(provider: str) -> BaseCollector:
    cls = _COLLECTORS.get(provider.upper())
    if cls is None:
        raise ValueError(f"Unknown provider: {provider}")
    return cls()


def all_collectors() -> list[BaseCollector]:
    return [cls() for cls in _COLLECTORS.values()]
