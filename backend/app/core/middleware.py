"""Request-scoped middleware: correlation ID + structured access logging.

Every response carries an `X-Request-ID` header. If the caller supplies one,
it's echoed back (useful for tracing a request across a load balancer); if
not, one is generated. The ID is bound into structlog's contextvars for the
lifetime of the request, so every log line emitted while handling it —
including from deep inside the evaluator or evidence store — carries the
same request_id without threading it through every function signature.
"""
import time
import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.types import ASGIApp

from app.core.logging import get_logger

logger = get_logger("access")


class RequestContextMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", uuid.uuid4().hex[:16])
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        start = time.monotonic()
        response = await call_next(request)
        duration_ms = round((time.monotonic() - start) * 1000, 1)

        response.headers["X-Request-ID"] = request_id
        logger.info(
            "request",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=duration_ms,
        )
        return response
