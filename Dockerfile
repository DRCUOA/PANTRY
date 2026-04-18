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

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# The standalone output produces a server.js at the root
CMD ["node", "server.js"]
