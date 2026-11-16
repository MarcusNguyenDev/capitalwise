FROM node:24-slim AS base

WORKDIR /api

# curl for the healthcheck, git so the dev container's Source Control panel
# works, procps so ps/kill exist when you debug inside the container.
# Add whatever the app shells out to (poppler-utils, ffmpeg, imagemagick...).
RUN apt-get update && apt-get install -y curl git procps unzip

RUN npm install -g bun

RUN bun upgrade

# Optional: a CLI API-test runner, so `bru run` works inside the container.
RUN bun install -g @usebruno/cli

ENV PATH="/root/.bun/bin:$PATH"

FROM base AS development

# The repo root is bind-mounted at /workspaces; pre-create the node_modules
# mount point so the named volume comes up owned by `node`, and let git accept
# a worktree that belongs to the host user.
RUN mkdir -p /workspaces/core/node_modules \
    && chown -R node:node /workspaces \
    && git config --system --add safe.directory /workspaces

WORKDIR /workspaces/core
USER node
EXPOSE 3001
CMD ["bun", "run", "dev"]

FROM base AS test
COPY . .
RUN bun install --frozen-lockfile
RUN bun run test


FROM base AS builder

COPY . .

RUN bun install --frozen-lockfile

RUN bun run build

FROM base AS production

COPY --from=builder /api/dist ./dist
# Content read at runtime: the agent prompt, simulator scripts and hero calls.
COPY --from=builder /api/prompts ./prompts
COPY --from=builder /api/simulations ./simulations
COPY --from=builder /api/scripted_calls ./scripted_calls
COPY --from=builder /api/package.json ./package.json
COPY --from=builder /api/tsconfig.json ./tsconfig.json
# --frozen-lockfile has nothing to freeze against without this.
COPY --from=builder /api/bun.lock ./bun.lock

RUN NODE_ENV=production bun install --frozen-lockfile --production

ENV NODE_ENV=production
ENV PORT=80

EXPOSE 80

# No .env is baked in: the deploy supplies the runtime env through compose's
# `env_file`, so no secret lives in a layer.
CMD ["bun", "run", "start:prod"]
