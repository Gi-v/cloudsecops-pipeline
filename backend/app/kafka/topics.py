"""Kafka topic name constants — the contract shared by every producer/consumer."""
from app.core.config import get_settings

settings = get_settings()

FINDINGS_RAW = settings.kafka_topic_findings_raw
FINDINGS_ENRICHED = settings.kafka_topic_findings_enriched
ALERTS_CRITICAL = settings.kafka_topic_alerts
