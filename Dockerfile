# ──────────────────────────────────────────────────────────────
# Multi-stage Dockerfile for PANTRY (Next.js 16 standalone)
# ──────────────────────────────────────────────────────────────

# ── 1. Base ──────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ── 2. Install dependencies ─────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# ── 3. Build ─────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# next.config.ts sets output: "standalone"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── 4. Production image ─────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy only what the standalone server needs
COPY --from=builder /app/public                                  ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone  ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static      ./.next/static

# Copy migration runner + SQL files (lightweight — no drizzle-kit needed)
COPY --from=builder /app/scripts/migrate.mjs                     ./scripts/migrate.mjs
COPY --from=builder /app/drizzle                                 ./drizzle

# The standalone trace doesn't include `postgres` for migrate.mjs — copy it explicitly
COPY --from=deps /app/node_modules/postgres                      ./node_modules/postgres

# Startup script: migrate then serve
COPY --from=builder /app/scripts/start.sh                        ./start.sh

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "start.sh"]
