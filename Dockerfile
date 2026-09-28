# Stage 1: Install dependencies
# Uses libc6-compat for native module compatibility on Alpine (musl libc)
FROM node:22-alpine AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build the application
# The build needs no secrets: DB and OpenAI clients are created on first use,
# not at import time, so `next build` runs without DATABASE_URL/OPENAI_API_KEY.
FROM node:22-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

# Copy installed dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build Next.js — produces .next/standalone/ when output: 'standalone' is set
RUN npm run build

# Stage 3: Production runner (minimal image)
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Commit the image is built from, reported by GET /api/health as `versione`.
# Pass it at build time: docker build --build-arg SOURCE_COMMIT=$(git rev-parse HEAD) .
# (many deploy systems pass SOURCE_COMMIT automatically). It is baked into the
# image, so the running container can always tell which code it runs. If the
# build does not receive it the variable is defined but empty: the app then
# falls back to GIT_COMMIT_SHA at runtime, and otherwise reports "sconosciuta".
ARG SOURCE_COMMIT=""
ENV SOURCE_COMMIT=${SOURCE_COMMIT}

# Runtime system dependencies for sharp (image processing) and Tesseract.js.
# Note: Alpine renamed libvips-dev to vips-dev starting from Alpine 3.20.
RUN apk add --no-cache vips-dev

# Create non-root user and group for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the standalone output (includes a bundled server and only production node_modules)
COPY --from=builder /app/.next/standalone ./

# Copy static assets into the standalone directory
COPY --from=builder /app/.next/static ./.next/static

# Copy public directory (favicon, images, etc.)
COPY --from=builder /app/public ./public

# Copy messages directory required by next-intl i18n at runtime
COPY --from=builder /app/messages ./messages

# Copy DB migrations + boot-time migration runner from the build context
# (not from --from=builder, which can lose non-traced files in some setups).
# Next.js standalone does NOT include .sql files or arbitrary scripts/.
# The entrypoint applies pending migrations on every boot.
COPY db/migrations ./db/migrations
COPY scripts/migrate.mjs ./scripts/migrate.mjs
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh \
 && echo "[build] migrations folder contents:" \
 && ls -1 ./db/migrations

# Next.js standalone bundles drizzle-orm + postgres into server.js but does
# NOT copy them as separate packages, so our standalone migrate.mjs script
# cannot resolve them at runtime. Copy the two packages explicitly from the
# deps stage. Both are zero-runtime-deps, so no transitive copies needed.
COPY --from=deps /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=deps /app/node_modules/postgres ./node_modules/postgres

# Set ownership of .next directory to the non-root user
RUN chown -R nextjs:nodejs .next db scripts docker-entrypoint.sh

# Switch to non-root user
USER nextjs

# Expose port — can be overridden at runtime via --env PORT=XXXX
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Container health from inside the container, without extra packages (no curl):
# Node's built-in fetch against /api/health, which answers 503 when the database
# is unreachable. start-period covers the migrations applied at boot.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

# Apply migrations, then start the standalone server.
CMD ["./docker-entrypoint.sh"]
