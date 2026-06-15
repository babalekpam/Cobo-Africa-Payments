---
name: COBO VPS deploy (deploy.sh)
description: How to deploy COBO Africa to the VPS from Replit, and the auth/migration gotchas.
---

# Deploying COBO Africa to the VPS

The VPS (cob-o.com) runs the API under PM2 process `cobo-api` at `/opt/cobo-africa/api/` and serves the static frontend from `/var/www/vhosts/cob-o.com/httpdocs/`. The same host runs other unrelated PM2 apps (argidrop, navimed, nevral, nt-fitness, raiz) — only ever touch `cobo-api`.

**Auth:** the VPS uses password SSH, not keys. Credentials are in secrets `VPS_SSH_HOST`, `VPS_SSH_USER`, `VPS_SSH_PASSWORD`. `deploy.sh` uses `sshpass -e` (reads `SSHPASS` env so the password never lands in process args). Plain `ssh`/`scp` will hang on an interactive password prompt — never run them bare from the agent (interactive input is impossible in the sandbox).

**Why the migration step failed once:** `deploy.sh` ran `psql $DATABASE_URL` over SSH, but a non-interactive SSH shell has no `DATABASE_URL`, so psql defaulted to connecting as user `root` → `FATAL: role "root" does not exist`. The DB connection string lives in `/opt/cobo-africa/api/.env`. Fix (applied): source that file first — `set -a; . /opt/cobo-africa/api/.env; set +a; psql "$DATABASE_URL" ...`. The PM2 process gets its env from `ecosystem.config.cjs` + that `.env`.

**Script's built-in health check is misleading:** it curls `http://localhost:8080/api/health`, but the real endpoint is `/api/healthz`, so it always warns "Health check failed". Verify production for real from outside: `curl https://cob-o.com/api/healthz` and a `POST /api/auth/login` — both should be 200.

**The migration in deploy.sh only creates `payment_intents`.** Other schema drift between branches is NOT handled by the script — check for new tables/columns separately when deploying a branch that changed the schema.
