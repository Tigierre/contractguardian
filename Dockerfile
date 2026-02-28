# Stage 1: Install dependencies
# Uses libc6-compat for native module compatibility on Alpine (musl libc)
FROM node:20-alpine AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build the application
FROM node:20-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

# Copy installed dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build Next.js — produces .next/standalone/ when output: 'standalone' is set
RUN npm run build

# Stage 3: Production runner (minimal image)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Runtime system dependencies for sharp (image processing) and Tesseract.js
RUN apk add --no-cache libvips-dev

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

# Set ownership of .next directory to the non-root user
RUN chown -R nextjs:nodejs .next

# Switch to non-root user
USER nextjs

# Expose port — can be overridden at runtime via --env PORT=XXXX
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the standalone server (not `next start` or `npm start`)
CMD ["node", "server.js"]
