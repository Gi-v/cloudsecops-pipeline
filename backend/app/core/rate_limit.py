"""Rate limiting via slowapi. Prefers Redis-backed storage (shared across
backend replicas — the correct behavior in the k8s deployment where
`autoscaling.enabled` runs multiple pods); falls back to in-memory storage
when Redis isn't reachable, consistent with every other component's
graceful-degradation pattern in this codebase.
"""
import redis
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import get_settings
from app.core.logging import get_logger

settings = get_settings()
logger = get_logger(__name__)


def _pick_storage_uri() -> str:
    try:
        client = redis.from_url(settings.redis_url, socket_connect_timeout=1)
        client.ping()
        logger.info("rate_limit_using_redis", url=settings.redis_url)
        return settings.redis_url
    except Exception as exc:
        logger.warning("rate_limit_redis_unavailable_using_in_memory", error=str(exc))
        return "memory://"


limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=_pick_storage_uri(),
    default_limits=[],
)
