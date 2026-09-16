"""Thin async wrapper around aiokafka's AIOKafkaProducer with JSON serialization
and a graceful in-memory fallback for local dev without a running Kafka broker.
"""
import asyncio
import contextlib
from typing import TYPE_CHECKING, Any

import orjson

from app.core.config import get_settings
from app.core.logging import get_logger

if TYPE_CHECKING:
    from aiokafka import AIOKafkaProducer

logger = get_logger(__name__)


class KafkaProducerClient:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._producer: AIOKafkaProducer | None = None
        self._fallback_queues: dict[str, asyncio.Queue] = {}
        self._connected = False

    async def start(self) -> None:
        try:
            from aiokafka import AIOKafkaProducer

            self._producer = AIOKafkaProducer(
                bootstrap_servers=self.settings.kafka_bootstrap_servers,
                value_serializer=lambda v: orjson.dumps(v),
            )
            await self._producer.start()
            self._connected = True
            logger.info("kafka_producer_connected", servers=self.settings.kafka_bootstrap_servers)
        except Exception as exc:
            logger.warning("kafka_unavailable_using_in_memory_fallback", error=str(exc))
            self._connected = False

    async def stop(self) -> None:
        if self._producer is not None:
            with contextlib.suppress(Exception):
                await self._producer.stop()

    async def send(self, topic: str, value: dict[str, Any], key: str | None = None) -> None:
        if self._connected and self._producer is not None:
            await self._producer.send_and_wait(
                topic, value=value, key=key.encode() if key else None
            )
        else:
            # In-memory fallback so the pipeline is fully runnable without Docker.
            queue = self._fallback_queues.setdefault(topic, asyncio.Queue())
            await queue.put(value)

    def get_fallback_queue(self, topic: str) -> asyncio.Queue:
        return self._fallback_queues.setdefault(topic, asyncio.Queue())

    @property
    def is_connected(self) -> bool:
        return self._connected


producer_client = KafkaProducerClient()
