"""Central application settings, loaded from environment / .env."""
from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    app_env: Literal["development", "staging", "production"] = "development"
    app_secret_key: str = "change-me-in-production"
    log_level: str = "INFO"

    # Postgres
    database_url: str = (
        "postgresql+asyncpg://cloudsecops:cloudsecops_dev_password@localhost:5432/cloudsecops"
    )

    # Kafka
    kafka_bootstrap_servers: str = "localhost:9092"
    kafka_topic_findings_raw: str = "findings.raw"
    kafka_topic_findings_enriched: str = "findings.enriched"
    kafka_topic_alerts: str = "alerts.critical"
    kafka_consumer_group: str = "policy-engine"

    # MinIO
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "cloudsecops"
    minio_secret_key: str = "cloudsecops_dev_secret"
    minio_bucket: str = "evidence-store"
    minio_secure: bool = False

    # OPA
    opa_url: str = "http://localhost:8181"
    opa_policy_path: str = "/v1/data/cloudsecops"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Collectors
    collector_mode: Literal["simulate", "live"] = "simulate"
    collector_max_concurrency: int = 8
    auto_seed_on_startup: bool = True
    rate_limit_scan_per_minute: int = 6

    # Auth (mutating endpoints only — see app/core/auth.py)
    api_auth_enabled: bool = False
    api_key: str = ""

    # CORS — comma-separated origin list. "*" cannot be combined with
    # allow_credentials=True (browsers reject the resulting preflight, per
    # the Fetch spec), so the default is the Vite dev server's own origin
    # rather than a wildcard.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    # Alerting
    alert_webhook_url: str = ""
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_default_region: str = "us-east-1"
    gcp_project_id: str = ""
    gcp_credentials_json: str = ""
    azure_subscription_id: str = ""
    azure_tenant_id: str = ""
    azure_client_id: str = ""
    azure_client_secret: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
