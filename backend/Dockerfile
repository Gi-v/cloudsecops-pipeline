FROM python:3.13-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# `apt-get upgrade` picks up whatever Debian security patches already exist
# in the repos as of build time but aren't yet baked into the upstream
# python:3.13-slim image (that image only gets rebuilt periodically, so it
# regularly lags a few days behind Debian's own security advisories).
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# Same lag applies to pip/setuptools themselves — the base image's bundled
# versions are what get scanned (and flagged) regardless of app dependencies.
RUN pip install --upgrade pip setuptools && pip install -r requirements.txt

COPY app ./app

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
    CMD curl -f http://localhost:8000/healthz || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
