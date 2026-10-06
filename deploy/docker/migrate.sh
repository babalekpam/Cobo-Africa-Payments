#!/bin/sh
# One-shot job run before the API starts: apply the database schema, then first-run bootstrap.
#  * `push` (NOT --force): on a fresh database it applies cleanly; on an upgrade that would drop or
#    rename data it refuses (non-interactive) and the deploy stops so a human can review. Money
#    tables are never altered destructively by an unattended deploy.
#  * bootstrap is idempotent: it creates the first administrator only if none exists and never
#    touches an existing one.
set -eu
cd /app
pnpm --filter @workspace/db run push < /dev/null
node artifacts/api-server/dist/bootstrap.mjs
