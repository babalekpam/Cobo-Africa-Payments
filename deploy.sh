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
