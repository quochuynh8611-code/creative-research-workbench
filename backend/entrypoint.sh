#!/bin/sh
set -e

# Fail-fast guard: Ensure DATABASE_URL is present and non-empty
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set or empty. Exiting." >&2
  exit 1
fi

echo "==> Running runtime migration verification and upgrade..."
python -m app.infrastructure.migrations.runner

echo "==> Starting application server..."
exec "$@"
