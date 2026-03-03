# ===========================
# Stage 1: Build web package
FROM node:22-bookworm AS builder

ENV BUN_INSTALL=/opt/bun
ENV PATH="/opt/bun/bin:${PATH}"

# Install build tools and Bun
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl python3 make g++ ca-certificates unzip \
  && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://bun.sh/install | bash

WORKDIR /app

ARG APP_VERSION=dev

# Copy package files first for better caching
COPY package.json bun.lock ./
COPY packages/server/package.json ./packages/server/
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/web/package.json ./packages/web/

# Install dependencies
RUN bun install

# Copy source code
COPY . .

ENV APP_VERSION=${APP_VERSION}
RUN bun run build:web

# ===========================
# Stage 2: Production server
FROM node:22-bookworm-slim AS production

ENV BUN_INSTALL=/opt/bun
ENV UV_INSTALL_DIR=/opt/uv
ENV PATH="/opt/bun/bin:/opt/uv:/opt/uv/bin:${PATH}"

# Install skill required tools: uv, bun
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates python3 python3-venv unzip \
  && rm -rf /var/lib/apt/lists/*

# Install bun
RUN curl -fsSL https://bun.sh/install | bash

# Install uv
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
RUN if [ -x /opt/uv/uv ]; then ln -s /opt/uv/uv /usr/local/bin/uv; \
  elif [ -x /opt/uv/bin/uv ]; then ln -s /opt/uv/bin/uv /usr/local/bin/uv; \
  fi

WORKDIR /app

# Copy node_modules from builder to avoid build tools in slim image
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/packages/server/node_modules ./packages/server/node_modules
COPY --from=builder --chown=node:node /app/package.json ./
COPY --from=builder --chown=node:node /app/bun.lock ./

# Copy server source code and config
COPY --from=builder --chown=node:node /app/packages/server/package.json ./packages/server/package.json
COPY --from=builder --chown=node:node /app/packages/server/src ./packages/server/src
COPY --from=builder --chown=node:node /app/packages/server/prompts ./packages/server/prompts
COPY --from=builder --chown=node:node /app/packages/server/tsconfig.json ./packages/server/tsconfig.json

# Copy built web assets to where server expects them
COPY --from=builder --chown=node:node /app/packages/web/dist ./packages/server/dist/static

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

USER node

CMD ["bun", "run", "--cwd", "packages/server", "src/index.ts"]
