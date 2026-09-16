# Multi-stage build.
#
#   docker build --target dev  -t cloudsecops-frontend:dev  .   # hot-reload dev server (what docker-compose.yml uses)
#   docker build --target prod -t cloudsecops-frontend:prod .   # static build served by nginx (what the Helm chart deploys)
#
# `docker build .` with no --target builds the last stage (prod) by default.

# Node 22+ — required by vite 8 / vitest 5's engines range; node:20-alpine
# no longer satisfies them.
# ── dev ──────────────────────────────────────────
FROM node:22-alpine AS dev
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ── build ────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
# VITE_* vars are baked into the JS bundle at build time, not read at
# container-start time — pass them as build args if they differ from the
# defaults baked into vite.config.ts / .env.
ARG VITE_API_BASE_URL=http://localhost:8000
ARG VITE_WS_URL=ws://localhost:8000/ws/live
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_WS_URL=${VITE_WS_URL}
RUN npm run build

# ── prod ─────────────────────────────────────────
# nginxinc/nginx-unprivileged, not nginx:alpine — the Helm chart runs this
# container as a non-root user with a read-only root filesystem (see
# infra/k8s security contexts), and the plain nginx image's default config
# both binds port 80 (root-only) and writes to paths under / at startup.
# The unprivileged image is built to work under exactly those constraints
# out of the box.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=5 \
    CMD wget -qO- http://localhost:8080/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
