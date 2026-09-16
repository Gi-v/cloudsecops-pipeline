"""Async consumer loop. Reads `findings.raw`, evaluates each resource through
the policy engine, persists results, and republishes to `findings.enriched`.

Falls back to draining the producer's in-memory queue when no real Kafka
broker is reachable, so the full collect → evaluate → enrich → dashboard loop
works in a zero-dependency local dev run.
"""
import asyncio
import contextlib
from collections.abc import Callable, Coroutine
from typing import TYPE_CHECKING, Any

import orjson

from app.core.config import get_settings
from app.core.logging import get_logger
from app.kafka.producer import producer_client

if TYPE_CHECKING:
    from aiokafka import AIOKafkaConsumer

logger = get_logger(__name__)

Handler = Callable[[dict[str, Any]], Coroutine[Any, Any, None]]


class KafkaConsumerClient:
    def __init__(self, topic: str, group_id: str) -> None:
        self.settings = get_settings()
        self.topic = topic
        self.group_id = group_id
        self._consumer: "AIOKafkaConsumer | None" = None
        self._task: asyncio.Task | None = None

    async def _consume_real(self, handler: Handler) -> None:
        from aiokafka import AIOKafkaConsumer

        self._consumer = AIOKafkaConsumer(
            self.topic,
            bootstrap_servers=self.settings.kafka_bootstrap_servers,
            group_id=self.group_id,
            value_deserializer=lambda v: orjson.loads(v),
            auto_offset_reset="earliest",
        )
        await self._consumer.start()
        logger.info("kafka_consumer_connected", topic=self.topic, group=self.group_id)
        try:
            async for msg in self._consumer:
                await handler(msg.value)
        finally:
            await self._consumer.stop()

    async def _consume_fallback(self, handler: Handler) -> None:
        queue = producer_client.get_fallback_queue(self.topic)
        logger.info("kafka_consumer_fallback_mode", topic=self.topic)
        while True:
            value = await queue.get()
            await handler(value)

    def start(self, handler: Handler) -> None:
        async def runner():
            if producer_client.is_connected:
                try:
                    await self._consume_real(handler)
                    return
                except Exception as exc:
                    logger.warning("kafka_consumer_failed_falling_back", error=str(exc))
            await self._consume_fallback(handler)

        self._task = asyncio.create_task(runner())

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
        if self._consumer is not None:
            with contextlib.suppress(Exception):
                await self._consumer.stop()
