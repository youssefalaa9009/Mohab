# syntax=docker/dockerfile:1

# Pin a concrete minor before launch so rebuilds are reproducible.
FROM node:22-alpine AS base
WORKDIR /app
ENV CI=1

# ─── Dependencies ─────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ─── Build (client bundle, SSR renderer, Fastify server) ─────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ─── Runtime dependencies only ────────────────────────────────────────────
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ─── Ops image: migrations (compose runs it before the app starts) and ──────
# one-off tasks such as creating a staff account:
#   docker compose run --rm -it migrate npx tsx scripts/create-admin.ts --email you@example.com
FROM base AS migrator
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY drizzle ./drizzle
COPY server ./server
COPY src ./src
COPY scripts ./scripts
CMD ["node_modules/.bin/tsx", "scripts/migrate.ts"]

# ─── Runtime ──────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    UPLOADS_DIR=/app/uploads
# The uploads dir is owned by the app user, so the named volume mounted there inherits it.
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs quattro \
 && mkdir -p /app/uploads && chown quattro:nodejs /app/uploads

COPY --from=prod-deps --chown=quattro:nodejs /app/node_modules ./node_modules
COPY --from=builder   --chown=quattro:nodejs /app/dist ./dist
COPY --chown=quattro:nodejs package.json ./

USER quattro
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# dist/node/index.js resolves dist/client and dist/server relative to the CWD.
CMD ["node", "dist/node/index.js"]
