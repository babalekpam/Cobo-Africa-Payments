# IAPAY (Inter-Africa Pay) Platform

## Overview

IAPAY (Inter-Africa Pay) — full-stack pan-African payment platform for managing payments, wallets, FX exchange, and transfers across Africa. Built as a pnpm monorepo with Express API + React frontend. Features a cream/warm white theme with gold accents, dark sidebar, and Plus Jakarta Sans/DM Sans fonts.

## Admin Credentials
- Email: `abel@argilette.com`
- Password: stored in ADMIN_PASSWORD secret

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite, custom CSS (no Tailwind/shadcn)
- **Auth**: JWT (stored in localStorage as `iapay_token`)
- **HTTP client**: custom api.ts fetch wrapper with auto-injected Bearer token
- **2FA**: speakeasy (TOTP) + qrcode
- **Email**: nodemailer (graceful no-op when SMTP not configured)

## Architecture

```
artifacts/
  api-server/        — Express API server (port 8080)
  cobo-payments/     — React/Vite frontend (routed at /)
lib/
  db/                — Drizzle ORM schema + migrations
```

## Design Theme

- Cream/warm white theme with gold accents and dark sidebar
- Colors: --bg: #FAF7F2, --surface: #FFFFFF, --surface2: #F5F0E8, --gold: #C98A1A, --gold-light: #E8A940, --green: #1B9E5A, --red: #D93636, --blue: #2A7CC7, --text: #2C2416, --text-dim: #7A6E58
- Sidebar: ocean blue gradient (#0F2B4C → #143A5C → #0C2340) with dedicated vars: --sidebar-bg, --sidebar-text (#E8F0F8), --sidebar-text-dim (#8BADC4), --sidebar-border, --sidebar-surface
- Fonts: Plus Jakarta Sans (headings, 700 weight), DM Sans (body)
- Custom CSS classes: .card, .btn, .btn-primary, .input, .select, .badge, .stat-card, .table-wrap, .empty, .spinner, .fade-in, .grid-2/3/4, .page, .page-title, .modal-overlay

## Frontend Pages

- `/` — Public landing page (hero, features, currencies, developer API, CTA, footer); logged-in users redirect to dashboard
- `/login` — Login with "Forgot password?" link, Terms/Privacy links, 2FA code field
- `/register` — Registration with first/last name, country, phone, business
- `/dashboard` — Stats cards (clickable), wallet breakdown bar chart, monthly transaction activity chart, quick-action buttons (Send/Deposit/Exchange/Payment Link), recent transactions (clickable rows → detail)
- `/wallets` — Multi-currency wallet management (add wallets, set default)
- `/send` — Send money globally: US, Canada, 16 European countries, and 53 African countries with FX conversion, bank transfers, mobile money
- `/deposit` — Deposit/receive money with 3 methods: Bank Transfer (account details with SWIFT/branch info), Card Payment (Visa/Mastercard form with card number, expiry, CVC), Mobile Money (M-Pesa, MTN MoMo, etc. with provider selector per currency); wallet selector; deposit history
- `/transactions` — Transaction history with filters, Export CSV button, receipt buttons, clickable rows → detail page
- `/transactions/:id` — Full transaction detail view with reference, amount, status badge, copy reference, view receipt buttons
- `/exchange` — FX exchange with rate quotes and currency swap
- `/payment-links` — Create and manage payment link pages
- `/beneficiaries` — Saved recipients for quick transfers
- `/verification` — KYC document submission with file upload (JPEG/PNG/WebP/PDF up to 10MB via object storage), document number input, progress bar, verification tips, 3 level cards with limits
- `/notifications` — Notification center with read/unread management
- `/merchants` — Merchant management with stats, search, create/delete modal, clickable rows → detail
- `/merchants/:id` — Merchant detail with profile info, volume/txn stats, status update, recent transactions
- `/reports` — Reports & Analytics with status breakdown, volume by type/country, payment methods, top merchants table, export report
- `/developer` — API documentation and key management
- `/admin` — Admin panel (admin role only) with tabs: Overview, Users, Deposits (approve/reject), KYC Review (approve/reject per user), Compliance (OFAC screening, BSA/AML status, CTR/SAR/EDD stats, quick links), Transactions
- `/compliance` — Compliance Center (admin only): Overview stats, KYC review queue, OFAC/SDN screening (Jaro-Winkler fuzzy matching), SAR reports, CTR management (auto-generated at $10K threshold), EDD reviews
- `/aml-policy` — Public BSA/AML Compliance Policy (13 sections, FinCEN MSB framework)
- `/settings` — Profile editing, password change, 2FA setup/disable (Security tab)
- `/forgot-password` — Password reset request (public)
- `/reset-password` — Set new password with token (public)
- `/terms` — Terms of Service (public or with sidebar when logged in)
- `/privacy` — Privacy Policy (public or with sidebar when logged in)
- `/activity-log` — Audit log of user actions
- `/pay/:sessionId` — Hosted checkout page (public, Stripe-like)

## i18n (Multi-language)

- Languages: English (en), French (fr), Portuguese (pt), Arabic (ar), Swahili (sw)
- LangProvider wraps app, language stored as `iapay_lang` in localStorage
- LanguageSwitcher select in sidebar footer
- All sidebar nav labels use `t()` translation function

## Backend API Routes

All prefixed with `/api`:
- `POST /api/auth/login` — Login, returns JWT + user + wallets (supports `totp_code` for 2FA)
- `POST /api/auth/register` — Register new user with wallets
- `GET /api/auth/me` — Current user + wallets
- `PUT /api/auth/profile` — Update profile
- `POST /api/auth/change-password` — Change password
- `GET /api/auth/dashboard` — Dashboard stats + recent transactions
- `POST /api/auth/forgot-password` — Request password reset email
- `POST /api/auth/reset-password` — Reset password with hashed token
- `POST /api/auth/2fa/setup` — Generate 2FA secret + QR code
- `POST /api/auth/2fa/verify` — Verify TOTP code and enable 2FA
- `POST /api/auth/2fa/disable` — Disable 2FA (requires password)
- `GET /api/auth/audit-log` — Get user's audit log entries
- `GET /api/wallets` — List user wallets
- `POST /api/wallets` — Create wallet
- `PUT /api/wallets/:id/default` — Set default wallet
- `POST /api/wallets/fund` — Fund wallet (sandbox)
- `POST /api/transfers/bank` — Bank transfer (KYC daily limits enforced)
- `POST /api/transfers/mobile` — Mobile money transfer (KYC daily limits enforced)
- `POST /api/transfers/internal` — Internal IAPAY user transfer (KYC daily limits enforced)
- `GET /api/exchange/rates` — FX rates
- `POST /api/exchange/convert` — Get conversion quote
- `POST /api/exchange/swap` — Execute currency swap
- `GET /api/beneficiaries` — List beneficiaries
- `POST /api/beneficiaries` — Add beneficiary
- `DELETE /api/beneficiaries/:id` — Remove beneficiary
- `GET /api/payment-links` — List payment links
- `POST /api/payment-links` — Create payment link
- `GET /api/notifications` — List notifications
- `GET /api/notifications/unread-count` — Unread count
- `PUT /api/notifications/:id/read` — Mark as read
- `PUT /api/notifications/read-all` — Mark all as read
- `GET /api/kyc/documents` — List KYC documents
- `POST /api/kyc/upload-url` — Get presigned upload URL for KYC document files
- `POST /api/kyc/submit` — Submit KYC document (supports file_path for uploaded files)
- `GET /api/compliance/overview` — Compliance dashboard stats (admin only)
- `POST /api/compliance/kyc/:userId/review` — Approve/reject user KYC (admin only)
- `GET/POST /api/storage/uploads/request-url` — Object storage presigned upload URLs
- `GET /api/storage/objects/*` — Serve uploaded objects (authenticated)
- `GET /api/storage/public-objects/*` — Serve public assets
- `GET /api/transactions` — List transactions
- `GET /api/exports/transactions.csv` — CSV export (auth via query token)
- `GET /api/exports/transactions.json` — JSON export (auth via query token)
- `GET /api/exports/receipt/:txId` — Printable receipt HTML (auth via query token)
- `POST /api/developer/api-keys` — Create API key (test/live mode)
- `GET /api/developer/api-keys` — List API keys
- `DELETE /api/developer/api-keys/:id` — Revoke API key
- `POST /api/checkout/sessions` — Create checkout session (API key auth)
- `GET /api/checkout/sessions/:id` — Get checkout session (API key auth)
- `GET /api/checkout/sessions` — List checkout sessions (API key auth)
- `GET /api/pay/:sessionId/info` — Get checkout info (public)
- `POST /api/pay/:sessionId/complete` — Complete payment (public)

## IAPAY — Pan-African Instant Payment Scheme

The platform operates the **IAPAY scheme** (Inter-Africa Pay), a Pix/UnionPay-style payment rail for Africa:

- **IAPAY Keys** (like Pix keys): users register up to 5 aliases — phone, email, national ID, merchant ID, or random UUID — in a network-wide directory. A key resolves to the holder's institution + account; lookups return masked holder names for privacy. **Ownership is verified**: phone/email keys require a 6-digit OTP delivered to the claimed phone/email (SHA-256-hashed, 15-min expiry; `POST /api/scheme/aliases/:id/verify`; sandbox returns `dev_code` outside production); national ID keys require verified KYC; only `active` keys resolve or generate QRs. SMS goes via `services/sms.ts` (Africa's Talking `AT_API_KEY`/`AT_USERNAME` or Twilio `TWILIO_*` env vars; console no-op otherwise).
- **Instant switch**: `POST /api/scheme/pay` clears payments 24/7 with zero fees, cross-currency FX at scheme rates, OFAC screening at the switch, ISO 20022-style end-to-end IDs (`E<participant><date><uuid>`), WebSocket + email notifications. **Hardened**: KYC daily limits enforced in USD terms (shared `lib/limits.ts`, same tiers as all other rails); clearing runs in a single DB transaction with `SELECT ... FOR UPDATE` on the sender wallet + set-based balance increments (no double-spend, no half-cleared payments); `Idempotency-Key` header support (scoped per user) so client retries never clear twice; `transferRateLimit` on pay and `directoryLookupRateLimit` (15/min) on `/api/scheme/resolve` to prevent directory scraping.
- **IAPAY QR**: EMVCo merchant-presented-mode compatible TLV QR standard (GUI `africa.iapay`) with CRC-16/CCITT-FALSE — like Brazil's BR Code. Static (any amount) and dynamic (fixed amount) codes.
- **Participants**: 15 seeded member institutions (banks, mobile money operators, fintechs) across KE, NG, GH, UG, CI, ZA, ET, SN, TZ, RW, MA, EG. Seeded idempotently at server boot (`ensureSchemeParticipants`). Admins can add more.
- **Clearing & settlement**: cleared transfers accumulate in an open settlement batch; multilateral netting per participant per currency (deferred net settlement, like card schemes/PAPSS) updates participants' USD settlement balances. Cycles close **automatically** every `SETTLEMENT_INTERVAL_HOURS` (default 4h; ≤0 disables; `services/scheme/scheduler.ts`) — empty batches stay open. Manual close remains at `POST /api/scheme/settlement/close` (admin). Netting math is pure/unit-tested in `services/scheme/netting.ts`.
- **Returns & disputes** (Pix devolução + MED equivalent, `services/scheme/returns.ts`): the recipient can voluntarily return a payment within 90 days (`POST /api/scheme/transfers/:reference/return`) — money travels back along the original path in an atomic reverse transfer (`RTN-*`), and the original is marked `returned`. The sender can open a dispute (`POST /api/scheme/transfers/:reference/dispute`, reasons: fraud/error/duplicate/other); the scheme operator resolves via `POST /api/scheme/disputes/:id/resolve` with `action: refund|deny` — refund forces the return. `GET /api/scheme/disputes` lists own disputes (admins: `?all=1`). DB table: `scheme_disputes`.
- **USSD**: main menu option 5 "IAPAY Instant Pay" — pay any IAPAY key or list your keys from a feature phone; payments go through the same switch engine (limits, OFAC, atomic clearing).
- **Web QR scanning**: Scan tab on `/iapay` uses the camera (jsQR + getUserMedia) to read IAPAY QR codes and prefill the payment form; manual payload paste as fallback. Recent-activity list has "Return payment" (recipient) and "Report a problem" (sender → dispute) actions.
- **Mobile**: cobo-mobile has an IAPAY tab (`app/(app)/iapay.tsx`) — pay-by-key with directory lookup and key management incl. OTP verification; idempotency key sent via `idempotency_key` body field (the pay endpoint accepts header or body).
- **Tests**: `pnpm --filter @workspace/api-server run test` — node:test suites (bundled with esbuild) covering the IAPAY QR codec (round-trip, CRC tamper, foreign-GUI rejection, CCITT-FALSE known vector) and multilateral netting invariants.

Scheme routes (all under `/api`):
- `GET/POST /api/scheme/aliases`, `DELETE /api/scheme/aliases/:id` — manage IAPAY keys
- `GET /api/scheme/resolve?key=` — directory lookup (masked)
- `POST /api/scheme/pay` — instant payment by key
- `GET /api/scheme/transfers`, `GET /api/scheme/transfers/:reference` — scheme transfer history/status
- `POST /api/scheme/qr/generate`, `POST /api/scheme/qr/decode` — IAPAY QR
- `GET /api/scheme/participants`, `GET /api/scheme/stats` — network registry & stats
- Admin: `POST /api/scheme/participants`, `POST /api/scheme/settlement/close`, `GET /api/scheme/settlement/batches[/:id]`

DB tables: `scheme_participants`, `payment_aliases`, `scheme_transfers`, `settlement_batches`, `settlement_positions` (schema in `lib/db/src/schema/scheme.ts`; DDL also in deploy.sh migration block).
Backend code: `api-server/src/services/scheme/` (directory.ts, switchEngine.ts, settlement.ts, qrStandard.ts, participants.ts) + `routes/scheme.ts`.
Frontend: `/iapay` page (⚡ nav item) with tabs: Pay a key, My keys, Receive (IAPAY QR), Network.

## Checkout API (Stripe-like)

Developers can generate API keys and use IAPAY's Checkout API to collect payments from their platforms:
1. Create an API key from the Developer page (test or live mode)
2. `POST /api/checkout/sessions` with Bearer API key to create a checkout session
3. Redirect customers to the `checkout_url` — a hosted payment page
4. Receive webhook notifications at your `webhook_url` when payment completes
5. Verify payment status via `GET /api/checkout/sessions/:id`

Sessions expire after 30 minutes. Webhook payloads include HMAC-SHA256 signature via `X-IAPAY-Signature` header, `X-IAPAY-Timestamp`, and `X-IAPAY-Delivery` (unique ID). Webhooks retry up to 5 times with exponential backoff (0s, 5s, 30s, 2min, 10min).
DB tables: `api_keys` (hashed key storage), `checkout_sessions`, `webhook_events`.

## MSB Compliance (FinCEN)

- **OFAC/SDN Screening**: Real-time name screening with Jaro-Winkler fuzzy matching against 180+ real SDN entries (terrorist orgs, sanctioned individuals, banks, state entities); screens at transfer time
- **Country Sanctions**: High-risk countries (KP, IR, SY, CU, VE, MM, BY, RU) blocked; medium-risk get enhanced screening
- **CTR (Currency Transaction Reports)**: Auto-generated for single transactions >$10K USD or aggregate daily >$10K; deduplicated per user per day; admin filing workflow
- **SAR (Suspicious Activity Reports)**: Manual filing by compliance officers; risk levels; resolution tracking
- **EDD (Enhanced Due Diligence)**: Reviews for PEPs, high-risk jurisdictions, unusual patterns; source of funds, expected volume tracking
- **BSA/AML Policy**: Public 13-section policy page covering CIP, CDD, transaction monitoring, CTR/SAR filing, OFAC compliance, recordkeeping, training
- **Compliance libs**: `lib/ctr.ts` (CTR generation), `lib/ofac.ts` (SDN screening + country risk), `lib/refgen.ts` (UUID-based refs)
- **DB tables**: `ctr_reports`, `edd_reviews`, `sanctions_screening`, `suspicious_activity`

## Security Features

- **2FA (TOTP)**: Setup via QR code, verify with authenticator app, disable with password
- **Password reset**: Hashed tokens (SHA-256), 1-hour expiry
- **KYC daily limits**: Level 0 = $100/day, Level 1 = $5,000/day, Level 2 = $50,000/day
- **Audit logging**: All auth events, transfers, settings changes logged
- **Export auth**: Separate `requireAuthOrQueryToken` middleware only for export endpoints
- **HTML escaping**: All dynamic fields in receipt HTML are escaped to prevent XSS
- **OFAC transfer blocking**: All transfers screened against SDN list and country risk; high-risk countries blocked

## Database

PostgreSQL with tables: `users`, `merchants`, `transactions`, `wallets`, `beneficiaries`, `notifications`, `payment_links`, `kyc_documents`, `audit_logs`, `api_keys`, `checkout_sessions`, `webhook_events`, `sanctions_screening`, `suspicious_activity`, `ctr_reports`, `edd_reviews`, `deposits`
- Users table extended with: firstName, lastName, businessName, businessType, kycStatus, kycLevel, isActive, twoFaSecret, twoFaEnabled, passwordResetToken, passwordResetExpires
- Audit logs table: userId, action, ip, meta (jsonb), createdAt
- Seeded with: admin user (Abel Nkawula) with 4 wallets (USD, NGN, XOF, GHS), merchants, and sample transactions

## Email Service

- Uses nodemailer with multi-provider support: SMTP (SMTP_HOST/PORT/USER/PASS), SendGrid (SENDGRID_API_KEY), Mailgun (MAILGUN_SMTP_PASSWORD)
- Graceful no-op: logs to console when no provider configured
- Templates: welcome, password reset/changed, transfer sent/received, login alert, deposit approved/rejected, KYC approved/rejected, SAR alert, CTR filed

## Object Storage

- Replit Object Storage for KYC document file uploads
- Presigned URL upload flow: client requests URL, uploads directly to GCS, stores object path
- Supported file types: JPEG, PNG, WebP, PDF (max 10MB)
- Files: `lib/objectStorage.ts`, `lib/objectAcl.ts`, `routes/storage.ts`

## VPS Deployment

- Script: `deploy.sh` — builds frontend + API, deploys to VPS at 74.208.166.77
- Usage: `./deploy.sh`, `./deploy.sh --frontend-only`, `./deploy.sh --api-only`
- Frontend: Vite build → scp to `/var/www/vhosts/cob-o.com/httpdocs/`
- API: esbuild bundle → scp to `/opt/cobo-africa/api/dist/`, PM2 restart

## Key Commands

- `pnpm --filter @workspace/db run push` — Push DB schema changes
- `pnpm --filter @workspace/api-server run dev` — Run API server
- `pnpm --filter @workspace/cobo-payments run dev` — Run frontend
