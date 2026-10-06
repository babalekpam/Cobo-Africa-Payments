# IAPAY — Deployment guide (any country, any client)

Nothing in the platform is tied to a country, bank or currency. A client installs it, names their institution, and onboards
their banks through the operator API. No code changes.

> **Read first — what has and has not been verified.** The install steps below were rehearsed step by step on a clean machine
> (empty database → schema → build → first-run bootstrap → production API → bank onboarding → certification) and the money path
> is covered by automated tests against real PostgreSQL. The **Docker packaging itself has not been built** in the environment
> where this was prepared (no Docker daemon available) — run `docker compose build` once and fix anything it reports before
> relying on it. The platform has **not** had an independent penetration test, certification or regulator approval; see
> "Before real money" at the end.

## 1. Install (about 15 minutes)

You need a Linux host with Docker (Compose v2), a DNS name, and TLS in front (load balancer, Caddy, Traefik, or nginx + certificates).

```bash
git clone <repo> iapay && cd iapay
cp .env.example .env          # fill in the REQUIRED section (secrets: openssl rand -base64 48)
docker compose up -d --build  # database -> schema + first admin -> API -> web
open http://<host>/           # log in with ADMIN_EMAIL / ADMIN_PASSWORD, then put TLS in front
```

What starts: `db` (PostgreSQL, private), `migrate` (applies the schema, creates the first administrator once, exits), `api`
(private, health-checked), `web` (nginx: the app and the `/api` proxy — the only published port).

**Required settings** (see `.env.example` for every option): `PUBLIC_URL`, `POSTGRES_PASSWORD`, `JWT_SECRET`, `ADMIN_EMAIL`,
`ADMIN_PASSWORD`, `GATEWAY_SECRETS_KEY`, and `EXCHANGERATE_API_KEY`.
**Your scheme:** `SCHEME_NAME`, `SCHEME_HOME_PARTICIPANT_NAME`, `SCHEME_HOME_COUNTRY`, `SCHEME_HOME_CURRENCY`; keep
`SCHEME_SEED_DEMO_PARTICIPANTS=false` (true creates fictional banks).

A fresh install contains exactly one administrator and one operator institution — no sample users, merchants or transactions.
The server prints a warning at startup for every unsafe production setting.

## 2. Onboard your first bank (operator API — no restart, no environment edits)

```bash
BASE=https://pay.example.com
TOKEN=$(curl -s $BASE/api/auth/login -H 'content-type: application/json' \
  -d '{"email":"admin@example.com","password":"…"}' | jq -r .token)

# 1. Create the participant — the response contains its gateway secret ONCE (stored encrypted, never shown again).
curl -s $BASE/api/scheme/participants -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{
  "code":"BANKXGHA","name":"Bank X Ghana","type":"bank","country":"GH","currency":"GHS",
  "api_url":"https://api.bankx.example/iapay","net_debit_cap_usd":10000 }'

# 2. Later: raise/lower the cap, suspend, change its endpoint, rotate its secret
curl -s -X PUT  $BASE/api/scheme/participants/BANKXGHA -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"net_debit_cap_usd":50000}'
curl -s -X PUT  $BASE/api/scheme/participants/BANKXGHA -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"status":"suspended"}'
curl -s -X POST $BASE/api/scheme/participants/BANKXGHA/rotate-secret -H "authorization: Bearer $TOKEN"
curl -s $BASE/api/scheme/admin/participants -H "authorization: Bearer $TOKEN"   # list (never shows secrets)
```

Hand the bank its secret over a secure channel together with `docs/IAPAY-participant-integration.md`. A bank cannot send until
you set its cap (default 0 — fail closed). Every action is written to the audit log.

## 3. Certify the bank's integration

The repository ships a dependency-free tool (Node 18+):

```bash
# against a deployment, as the bank (sends small test payments to --key, a key held by the operator):
node tools/iapay-certify.mjs certify --url https://pay.example.com --code BANKXGHA --secret <secret> --key <operator-held key> --currency GHS

# a stand-in bank endpoint, to test the switch -> bank direction before the bank's real endpoint exists:
node tools/iapay-certify.mjs mock-bank --port 9090 --operator IAPAYPAN --secret <secret>
```

`certify` checks: forged/stale signatures rejected, a valid payment accepted, replays are idempotent, status query, rejection of
unknown keys / fractional cents / spoofed debtor agent, and key registration/duplicate/delete. It exits non-zero on any failure.

## 4. Operations

* **Health:** `GET /api/healthz` (used by the container health check).
* **Sandbox or live:** `IAPAY_ENVIRONMENT=sandbox` gives a client a test installation: self-service test funding, simulated
  payouts and checkout payments, and a "SANDBOX — test money only" banner on every page (`GET /api/environment`). `live` (the
  default in production) refuses all of those: money enters only through approved deposits, incoming payments or a provider.
  Never put real customers on a sandbox; never point a sandbox at real provider or bank credentials.
* **Payout desk:** on a live installation a bank transfer holds the customer's funds until the payout is confirmed.
  `GET /api/admin/payouts` lists pending payouts (bank payouts, and mobile-money payouts whose provider never answered);
  after checking the bank or provider statement, resolve each one once with `POST /api/admin/payouts/{reference}/complete`
  or `/fail` and a `note` (the statement reference). `fail` returns the held funds to the customer.
* **Unresolved payments:** `GET /api/scheme/unresolved` (admin) — a payment whose bank outcome is unknown stays held until you
  confirm with the bank and resolve it once (`POST /api/scheme/transfers/{reference}/resolve`). Alert on any row here.
* **Backups:** back up the `pgdata` volume with `pg_dump` on a schedule you can restore from (test a restore), the `objects` volume
  (KYC documents — encrypt the disk), and `GATEWAY_SECRETS_KEY` **separately** from the database. Losing the key means rotating
  every stored participant secret.
* **Upgrades:** `git pull && docker compose up -d --build`. The schema step is non-destructive by design: if an upgrade would
  drop or rename data it refuses and the deploy stops for a human to review.
* **Secrets rotation:** `JWT_SECRET` (logs everyone out), participant secrets (API above), `GATEWAY_SECRETS_KEY` (re-issue every participant secret).
* **Documents storage:** KYC uploads use the local `objects` volume in this packaging (`OBJECT_STORAGE=local`). They are served
  only to logged-in users, validated by real file type, 10 MB max, single-use signed upload links.

## 5. Security checklist for go-live

TLS everywhere (set HSTS at your edge) · restrict the gateway paths (`/api/gateway/*`) to your banks' IP ranges at the edge, ideally
with mTLS · egress rules so the API can only reach your banks and providers (the app blocks private/internal URLs but cannot stop
DNS rebinding) · database not reachable from outside · `.env` readable only by root/ops · log shipping and alerting · regular patching
of images · an on-call process for unresolved payments.

## 6. Known limits (be honest with your client)

* Rate limits, sign-in/PIN/OTP lockouts and Idempotency-Key records are stored in Postgres, so several API instances can run behind a load balancer. The settlement scheduler and reconciliation sweeper run in every instance; they are idempotent, but for clarity run them in one.
* Settlement computes who owes whom each cycle but does **not** move money between bank settlement accounts; a bank's exposure is released when a batch is marked settled. Tie this to your real settlement process.
* Bank authentication is a per-bank shared secret (HMAC). mTLS/asymmetric signatures and HSM/KMS key custody are not built in.
* Sanctions screening is a stopgap matcher with a short built-in list; use a licensed provider for production.
* The wallet rails outside the IAPAY scheme (P2P, FX swap, bank and mobile-money payouts, deposits, checkout, USSD) now move money only through atomic, exactly-once ledger operations with regression tests for races, replays and double approvals — but, like the rest of the platform, they have not been independently audited.
* Mobile app identifiers (`com.cobo.africa`) and some package/folder names still use the old name; renaming them is a separate release.

## 7. Before real money

Independent penetration test and code audit · SOC 2 / ISO 27001 programme · licensed sanctions provider · mTLS and key custody ·
settlement-account and collateral arrangements · legal participation agreement and rulebook · regulator approval for operating a payment
switch in each country · load/failure testing at target volume · high-availability and disaster-recovery design · 24x7 monitoring.
