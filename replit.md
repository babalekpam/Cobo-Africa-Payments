# COBO Africa Payments Platform

## Overview

Full-stack fintech wallet platform for managing payments, wallets, FX exchange, and transfers across Africa. Built as a pnpm monorepo with Express API + React frontend. Features a cream/warm white theme with gold accents, dark sidebar, and Plus Jakarta Sans/DM Sans fonts.

## Admin Credentials
- Email: `admin@cobo.africa`
- Password: `CoboAdmin2024!`

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
- **Auth**: JWT (stored in localStorage as `cobo_token`)
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
- `/deposit` — Deposit/receive money with 3 methods: Bank Transfer (account details), Card Top-Up (form), Mobile Money (collection number); wallet selector; sandbox fund endpoint
- `/transactions` — Transaction history with filters, Export CSV button, receipt buttons, clickable rows → detail page
- `/transactions/:id` — Full transaction detail view with reference, amount, status badge, copy reference, view receipt buttons
- `/exchange` — FX exchange with rate quotes and currency swap
- `/payment-links` — Create and manage payment link pages
- `/beneficiaries` — Saved recipients for quick transfers
- `/verification` — KYC document submission and verification levels
- `/notifications` — Notification center with read/unread management
- `/merchants` — Merchant management with stats, search, create/delete modal, clickable rows → detail
- `/merchants/:id` — Merchant detail with profile info, volume/txn stats, status update, recent transactions
- `/reports` — Reports & Analytics with status breakdown, volume by type/country, payment methods, top merchants table, export report
- `/developer` — API documentation and key management
- `/admin` — Admin panel (admin role only) with user management
- `/compliance` — Compliance Center (admin only): KYC review queue, sanctions screening, SAR reports, compliance dashboard
- `/settings` — Profile editing, password change, 2FA setup/disable (Security tab)
- `/forgot-password` — Password reset request (public)
- `/reset-password` — Set new password with token (public)
- `/terms` — Terms of Service (public or with sidebar when logged in)
- `/privacy` — Privacy Policy (public or with sidebar when logged in)
- `/activity-log` — Audit log of user actions
- `/pay/:sessionId` — Hosted checkout page (public, Stripe-like)

## i18n (Multi-language)

- Languages: English (en), French (fr), Portuguese (pt), Arabic (ar), Swahili (sw)
- LangProvider wraps app, language stored as `cobo_lang` in localStorage
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
- `POST /api/transfers/internal` — Internal COBO user transfer (KYC daily limits enforced)
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
- `POST /api/kyc/submit` — Submit KYC document
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

## Checkout API (Stripe-like)

Developers can generate API keys and use COBO's Checkout API to collect payments from their platforms:
1. Create an API key from the Developer page (test or live mode)
2. `POST /api/checkout/sessions` with Bearer API key to create a checkout session
3. Redirect customers to the `checkout_url` — a hosted payment page
4. Receive webhook notifications at your `webhook_url` when payment completes
5. Verify payment status via `GET /api/checkout/sessions/:id`

Sessions expire after 30 minutes. Webhook payloads include HMAC-SHA256 signature via `X-COBO-Signature` header.
DB tables: `api_keys` (hashed key storage), `checkout_sessions`, `webhook_events`.

## Security Features

- **2FA (TOTP)**: Setup via QR code, verify with authenticator app, disable with password
- **Password reset**: Hashed tokens (SHA-256), 1-hour expiry
- **KYC daily limits**: Level 0 = $100/day, Level 1 = $5,000/day, Level 2 = $50,000/day
- **Audit logging**: All auth events, transfers, settings changes logged
- **Export auth**: Separate `requireAuthOrQueryToken` middleware only for export endpoints
- **HTML escaping**: All dynamic fields in receipt HTML are escaped to prevent XSS

## Database

PostgreSQL with tables: `users`, `merchants`, `transactions`, `wallets`, `beneficiaries`, `notifications`, `payment_links`, `kyc_documents`, `audit_logs`, `api_keys`, `checkout_sessions`, `webhook_events`
- Users table extended with: firstName, lastName, businessName, businessType, kycStatus, kycLevel, isActive, twoFaSecret, twoFaEnabled, passwordResetToken, passwordResetExpires
- Audit logs table: userId, action, ip, meta (jsonb), createdAt
- Seeded with: admin user (Abel Nkawula) with 4 wallets (USD, NGN, XOF, GHS), merchants, and sample transactions

## Email Service

- Uses nodemailer, configured via SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS env vars
- Graceful no-op: logs to console when no SMTP configured (SMTP_HOST required)
- Sends: welcome emails, password reset links, password changed confirmations, transfer notifications

## Key Commands

- `pnpm --filter @workspace/db run push` — Push DB schema changes
- `pnpm --filter @workspace/api-server run dev` — Run API server
- `pnpm --filter @workspace/cobo-payments run dev` — Run frontend
