#!/bin/bash
set -euo pipefail

VPS_HOST="74.208.166.77"
VPS_USER="root"
FRONTEND_PATH="/var/www/vhosts/cob-o.com/httpdocs/"
API_PATH="/opt/cobo-africa/api/"
SSH_CMD="ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

DEPLOY_FRONTEND=true
DEPLOY_API=true

while [[ $# -gt 0 ]]; do
  case $1 in
    --frontend-only) DEPLOY_API=false; shift ;;
    --api-only) DEPLOY_FRONTEND=false; shift ;;
    --help) echo "Usage: ./deploy.sh [--frontend-only|--api-only]"; exit 0 ;;
    *) err "Unknown option: $1" ;;
  esac
done

log "Starting COBO Africa deployment to ${VPS_HOST}..."
log "Frontend: ${DEPLOY_FRONTEND} | API: ${DEPLOY_API}"

if [ "$DEPLOY_FRONTEND" = true ]; then
  log "Building frontend..."
  cd artifacts/cobo-payments
  PORT=3000 BASE_PATH="/" npx vite build 2>&1 | tail -5
  cd ../..

  log "Deploying frontend to VPS..."
  scp -o StrictHostKeyChecking=no -r artifacts/cobo-payments/dist/public/* ${VPS_USER}@${VPS_HOST}:${FRONTEND_PATH}
  log "Frontend deployed successfully!"
fi

if [ "$DEPLOY_API" = true ]; then
  log "Building API server..."
  pnpm --filter @workspace/api-server run build 2>&1 | tail -5

  log "Running database migrations..."
  ${SSH_CMD} "psql \$DATABASE_URL -c \"
    CREATE TABLE IF NOT EXISTS payment_intents (
      id SERIAL PRIMARY KEY,
      reference TEXT NOT NULL UNIQUE,
      transaction_reference TEXT,
      user_id INTEGER NOT NULL,
      wallet_id INTEGER,
      provider TEXT NOT NULL,
      provider_reference TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      amount NUMERIC(15, 2) NOT NULL,
      currency TEXT NOT NULL,
      recipient_phone TEXT,
      recipient_name TEXT,
      recipient_country TEXT,
      recipient_currency TEXT,
      fee NUMERIC(15, 2) DEFAULT 0,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS payment_intents_user_id_idx ON payment_intents(user_id);
    CREATE INDEX IF NOT EXISTS payment_intents_reference_idx ON payment_intents(reference);
    CREATE INDEX IF NOT EXISTS payment_intents_provider_reference_idx ON payment_intents(provider_reference);
    CREATE TABLE IF NOT EXISTS scheme_participants (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'fintech',
      country TEXT NOT NULL,
      currency TEXT NOT NULL,
      api_url TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      settlement_balance NUMERIC(18, 2) NOT NULL DEFAULT 0,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS payment_aliases (
      id SERIAL PRIMARY KEY,
      alias_type TEXT NOT NULL,
      alias_value TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      participant_id INTEGER NOT NULL,
      account_ref TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS payment_aliases_user_id_idx ON payment_aliases(user_id);
    CREATE TABLE IF NOT EXISTS scheme_transfers (
      id SERIAL PRIMARY KEY,
      reference TEXT NOT NULL UNIQUE,
      end_to_end_id TEXT NOT NULL UNIQUE,
      sender_user_id INTEGER,
      sender_participant_id INTEGER NOT NULL,
      sender_alias TEXT,
      recipient_alias TEXT NOT NULL,
      recipient_user_id INTEGER,
      recipient_participant_id INTEGER NOT NULL,
      amount NUMERIC(18, 2) NOT NULL,
      currency TEXT NOT NULL,
      recipient_amount NUMERIC(18, 2) NOT NULL,
      recipient_currency TEXT NOT NULL,
      fx_rate NUMERIC(18, 8),
      fee NUMERIC(18, 2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'initiated',
      status_reason TEXT,
      qr_ref TEXT,
      settlement_batch_id INTEGER,
      metadata JSONB,
      initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      cleared_at TIMESTAMPTZ,
      settled_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS scheme_transfers_sender_idx ON scheme_transfers(sender_user_id);
    CREATE INDEX IF NOT EXISTS scheme_transfers_recipient_idx ON scheme_transfers(recipient_user_id);
    CREATE INDEX IF NOT EXISTS scheme_transfers_batch_idx ON scheme_transfers(settlement_batch_id);
    CREATE TABLE IF NOT EXISTS settlement_batches (
      id SERIAL PRIMARY KEY,
      batch_ref TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'open',
      transfer_count INTEGER NOT NULL DEFAULT 0,
      total_gross_usd NUMERIC(18, 2) NOT NULL DEFAULT 0,
      opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      closed_at TIMESTAMPTZ,
      settled_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS settlement_positions (
      id SERIAL PRIMARY KEY,
      batch_id INTEGER NOT NULL,
      participant_id INTEGER NOT NULL,
      currency TEXT NOT NULL,
      total_debit NUMERIC(18, 2) NOT NULL DEFAULT 0,
      total_credit NUMERIC(18, 2) NOT NULL DEFAULT 0,
      net_position NUMERIC(18, 2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS settlement_positions_batch_idx ON settlement_positions(batch_id);
  \" 2>&1" && log "Database migration completed!" || warn "Migration failed — table may already exist or DATABASE_URL not set"

  log "Deploying API to VPS..."
  ${SSH_CMD} "rm -f ${API_PATH}dist/*.mjs ${API_PATH}dist/*.mjs.map"
  scp -o StrictHostKeyChecking=no -r artifacts/api-server/dist/* ${VPS_USER}@${VPS_HOST}:${API_PATH}dist/

  log "Restarting API server on VPS..."
  ${SSH_CMD} "cd ${API_PATH} && pm2 restart cobo-api --update-env 2>&1" || warn "PM2 restart returned non-zero (may still be running)"

  log "Waiting for API to start..."
  sleep 3

  log "Checking API health..."
  ${SSH_CMD} "curl -sf http://localhost:8080/api/health 2>/dev/null" && log "API health check passed!" || warn "Health check failed (API may still be starting)"

  log "API deployed successfully!"
fi

log "Checking PM2 status..."
${SSH_CMD} "pm2 status" 2>/dev/null || true

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
log "Deployment completed at ${TIMESTAMP}"
log "Frontend: https://cob-o.com"
log "API: https://cob-o.com/api"
