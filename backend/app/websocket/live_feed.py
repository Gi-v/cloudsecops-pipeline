"""WebSocket connection manager. The `findings.enriched` consumer callback
in app.main broadcasts every evaluated resource to all connected dashboard
clients — no polling.
"""
from typing import Any

import orjson
from fastapi import WebSocket

from app.core.logging import get_logger

logger = get_logger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.add(ws)
        logger.info("ws_client_connected", total=len(self._connections))

    def disconnect(self, ws: WebSocket) -> None:
        self._connections.discard(ws)
        logger.info("ws_client_disconnected", total=len(self._connections))

    async def broadcast(self, message: dict[str, Any]) -> None:
        if not self._connections:
            return
        payload = orjson.dumps(message)
        dead: list[WebSocket] = []
        for ws in self._connections:
            try:
                await ws.send_bytes(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()
