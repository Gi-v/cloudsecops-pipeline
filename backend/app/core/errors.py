"""Shared error-response helpers. Every route's HTTPException is wrapped
into the same {"error": {"code", "message", "request_id"}} shape by the
handlers registered in app.main — this module just picks the `code` string
for a given HTTP status and reads back the request ID that
RequestContextMiddleware already bound into structlog's contextvars.
"""
import structlog

_STATUS_CODES = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    409: "conflict",
    422: "validation_error",
    429: "rate_limited",
    500: "internal_error",
}


def code_for_status(status_code: int) -> str:
    return _STATUS_CODES.get(status_code, "error")


def current_request_id() -> str | None:
    return structlog.contextvars.get_contextvars().get("request_id")
