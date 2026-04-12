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
- Sidebar: dark (#2C2416) with dedicated vars: --sidebar-bg, --sidebar-text, --sidebar-text-dim, --sidebar-border, --sidebar-surface
- Fonts: Plus Jakarta Sans (headings, 700 weight), DM Sans (body)
- Custom CSS classes: .card, .btn, .btn-primary, .input, .select, .badge, .stat-card, .table-wrap, .empty, .spinner, .fade-in, .grid-2/3/4, .page, .page-title, .modal-overlay

## Frontend Pages

- `/login` — Login page with dark gold theme
- `/register` — Registration with first/last name, country, phone, business
- `/dashboard` — Stats cards, wallet overview, recent transactions
- `/wallets` — Multi-currency wallet management (add wallets, set default)
- `/send` — Send money via bank transfer, mobile money, or internal COBO transfer
- `/transactions` — Transaction history with status/type filters
- `/exchange` — FX exchange with rate quotes and currency swap
- `/payment-links` — Create and manage payment link pages
- `/beneficiaries` — Saved recipients for quick transfers
- `/verification` — KYC document submission and verification levels
- `/notifications` — Notification center with read/unread management
- `/developer` — API documentation and key management
- `/admin` — Admin panel (admin role only) with user management
- `/settings` — Profile editing and password change

## Backend API Routes

All prefixed with `/api`:
- `POST /api/auth/login` — Login, returns JWT + user + wallets
- `POST /api/auth/register` — Register new user with wallets
- `GET /api/auth/me` — Current user + wallets
- `PUT /api/auth/profile` — Update profile
- `POST /api/auth/change-password` — Change password
- `GET /api/auth/dashboard` — Dashboard stats + recent transactions
- `GET /api/wallets` — List user wallets
- `POST /api/wallets` — Create wallet
- `PUT /api/wallets/:id/default` — Set default wallet
- `POST /api/wallets/fund` — Fund wallet (sandbox)
- `POST /api/transfers/bank` — Bank transfer
- `POST /api/transfers/mobile` — Mobile money transfer
- `POST /api/transfers/internal` — Internal COBO user transfer
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

## Database

PostgreSQL with tables: `users`, `merchants`, `transactions`, `wallets`, `beneficiaries`, `notifications`, `payment_links`, `kyc_documents`
- Users table extended with: firstName, lastName, businessName, businessType, kycStatus, kycLevel, isActive
- Seeded with: admin user (Abel Nkawula) with 4 wallets (USD, NGN, XOF, GHS), merchants, and sample transactions

## Key Commands

- `pnpm --filter @workspace/db run push` — Push DB schema changes
- `pnpm --filter @workspace/api-server run dev` — Run API server
- `pnpm --filter @workspace/cobo-payments run dev` — Run frontend
