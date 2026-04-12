# COBO Africa Payments Platform

## Overview

Full-stack fintech admin dashboard for managing payments, transactions, merchants, and users across Africa. Built as a pnpm monorepo with Express API + React frontend.

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
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec at `lib/api-spec/openapi.yaml`)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS v4
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Charts**: Recharts
- **Auth**: JWT (stored in localStorage as `cobo_token`)
- **HTTP client**: custom-fetch.ts with auto-injected Bearer token

## Architecture

```
artifacts/
  api-server/        — Express API server (port 8080 via $PORT)
  cobo-payments/     — React/Vite frontend (routed at /)
lib/
  api-spec/          — OpenAPI YAML spec
  api-client-react/  — Generated React Query hooks (Orval codegen)
  db/                — Drizzle ORM schema + migrations
```

## Frontend Pages

- `/login` — Auth login page (redirects to /dashboard on success)
- `/dashboard` — KPI stats, volume charts, recent transactions, top merchants
- `/transactions` — Paginated transaction list with search/filter, click to detail
- `/transactions/:id` — Transaction detail with status update
- `/merchants` — Merchant grid cards with Add/Delete, click to detail
- `/merchants/:id` — Merchant detail with status update + recent transactions
- `/users` — User table with Add/Delete/status update
- `/settings` — Profile, security, notification settings

## Backend API Routes

All prefixed with `/api`:
- `POST /api/auth/login` — returns JWT
- `GET /api/auth/me` — current user
- `GET|POST /api/users` — list/create users
- `GET|PATCH|DELETE /api/users/:id` — single user
- `GET|POST /api/merchants` — list/create merchants
- `GET|PATCH|DELETE /api/merchants/:id` — single merchant
- `GET|POST /api/transactions` — list/create transactions
- `GET|PATCH /api/transactions/:id` — single transaction
- `GET /api/dashboard/summary` — KPI summary
- `GET /api/dashboard/recent-transactions` — recent txns
- `GET /api/dashboard/volume-by-country` — country volume breakdown
- `GET /api/dashboard/monthly-volume` — monthly chart data
- `GET /api/dashboard/top-merchants` — top merchants by volume

## Database

PostgreSQL with tables: `users`, `merchants`, `transactions`
- Seeded with: 1 admin user, 4 regular users, 8 merchants, 90 transactions

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Design

- Deep navy dark theme: `hsl(222 47% 11%)` background
- Green primary: `hsl(142 71% 45%)`
- Amber accent: `hsl(38 95% 56%)`
- Font: Inter (sans), JetBrains Mono (mono)
