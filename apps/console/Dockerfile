# resili Console — production container image.
#
# Multi-stage build producing Next.js "standalone" output (see next.config.ts),
# so the runtime image ships only the compiled server + minimal node_modules.
# Honours the platform-provided $PORT (Heroku, Render, Cloud Run, …).
#
# NEXT_PUBLIC_* values are inlined at build time, so the gateway URL and Mapbox
# token are passed as build args. Never bake secret keys here — the Mapbox
# "pk." token is a public, URL-restricted token by design.

# ---- deps ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
ARG NEXT_PUBLIC_MAPBOX_TOKEN=""
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_MAPBOX_TOKEN=${NEXT_PUBLIC_MAPBOX_TOKEN}
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runtime ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# Next's standalone server reads PORT/HOSTNAME from the environment. Heroku
# injects $PORT; default to 3000 for local `docker run`.
ENV HOSTNAME=0.0.0.0
CMD ["sh", "-c", "PORT=${PORT:-3000} node server.js"]
