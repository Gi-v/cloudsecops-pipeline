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


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """The headers every response should carry regardless of route —
    deliberately just the ones that are safe to add blind, with no risk of
    breaking the app or the /docs Swagger UI this same API serves:

    - X-Content-Type-Options: stops a browser from MIME-sniffing a response
      into something more dangerous than its declared Content-Type.
    - X-Frame-Options: this API (including /docs) has no reason to ever be
      framed by another site — DENY closes off clickjacking on it.
    - Referrer-Policy: don't leak the full request URL (which can carry a
      resource URN or a search query) to a third party a response links out
      to.
    - Permissions-Policy: this API and its Swagger UI never need camera/
      microphone/geolocation — turn them off rather than leave them to
      whatever the browser's own default is.

    A real Content-Security-Policy and HSTS are deliberately left out here:
    CSP needs to be tuned against every page (Swagger UI's own inline
    scripts included) to avoid silently breaking something, and HSTS only
    makes sense once TLS is actually guaranteed — this chart's `ingress.tls`
    is optional (see infra/k8s/templates/ingress.yaml), so this app-level
    middleware can't assume it's on. Both are real follow-ups, not
    silently skipped.
    """

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        return response
