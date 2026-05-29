#!/bin/sh
# Container entrypoint:
# 1. apply any pending DB migrations
# 2. exec the Next.js standalone server
#
# If migrations fail we exit non-zero so the container restarts and the
# failure is visible in logs, instead of starting an app pointed at a broken
# schema.
set -e

if [ -n "$DATABASE_URL" ] && [ -d ./db/migrations ]; then
  echo "[entrypoint] running DB migrations…"
  node scripts/migrate.mjs
else
  echo "[entrypoint] skipping migrations (no DATABASE_URL or migrations folder)"
fi

echo "[entrypoint] starting server…"
exec node server.js
