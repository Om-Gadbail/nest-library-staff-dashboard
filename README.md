# Nest Library — Staff Dashboard (Final System)

Staff dashboard for the Prime Fitness × Nest Library business system:
**React → FastAPI → Auth/RBAC/Tenant → Services → PostgreSQL.**

## Stack

- Frontend: React 19 + TypeScript + Vite 8, react-router (lazy routes), Tailwind v4,
  TanStack Query, axios (central `apiClient` only), RHF + Zod, TanStack Table,
  recharts (lazy), date-fns, sonner, cmdk, zustand (UI state only), motion,
  MSW (dev/test adapter only), Vitest + Testing Library.
- Backend (`backend/`): FastAPI modular monolith, SQLAlchemy 2, Alembic,
  bcrypt + JWT (HttpOnly cookies), APScheduler jobs, SSE realtime, pytest.

## Run it

```bash
# 1. Backend (SQLite dev)
cd backend
py -m pip install -r requirements.txt
py scripts/seed.py --reset
py -m uvicorn app.main:app --reload --port 8000

# 2. Frontend (real API mode)
cd ..
npm install
cp .env.example .env.development   # set VITE_ENABLE_MSW=false for real API
npm run dev                        # http://localhost:5173
```

Demo logins (seed only): `owner@nestlibrary.in` / `rahul@nestlibrary.in` /
`priya@nestlibrary.in`, password `Nest@123`. Prime owner:
`prime.owner@primefitness.in`.

PostgreSQL (production-like):

```bash
# backend/.env: DATABASE_URL=postgresql+pg8000://nest:SECRET@localhost:5432/nest
cd backend && alembic upgrade head
# or: docker compose up --build
```

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` / `npm run build` / `npm run preview` | Frontend |
| `npm run lint` / `npm run typecheck` / `npm run test` | Frontend gates |
| `cd backend && py -m pytest -q` | Backend gates (20 tests) |
| `cd backend && py scripts/seed.py --reset` | Deterministic Nest + Prime seed |

## Architecture

```
src/
  app/         router (protected, permission-guarded), providers, query-client, store
  api/         client (cookie sessions, error contract), services (FastAPI calls)
  features/    dashboard, customers, admissions, memberships, renewals, payments,
               leads, bookings, tasks, notifications, analytics, staff, settings, auth
  lib/         business-queries (backend-first + offline fallback), analytics,
               date-range, format (en-IN/₹), query-keys, timeline
  mock/        dev/test adapter mirroring the REST contract (never production)
backend/
  app/core     config, db, security, deps (auth/RBAC/tenant), permissions, timezone
  app/models   all tables, every business row carries business_id + indexes
  app/schemas  Pydantic contracts, Page<T> pagination, consistent errors
  app/api/v1   auth, customers/admissions, leads, billing, bookings, ops,
               analytics, admin (staff/settings/whatsapp/search/realtime/jobs)
  app/services workflows (transactional), whatsapp (log|meta), scheduler (idempotent)
  alembic/     migrations · scripts/seed.py · tests/ (auth/RBAC/tenant/flows)
```

Rules:

- Components never call axios directly: component → feature hook → `api/services` → `apiClient`.
- Zustand holds UI state only. Server state = TanStack Query with targeted invalidation.
- No tokens in localStorage — HttpOnly cookies (`nest_at`/`nest_rt`) + Bearer fallback.
- Business context is derived server-side from staff memberships, never from headers.
- Revenue/analytics always derive from payment records — no magic numbers.

## Responsive targets

375 / 390 / 430 / 768 / 1024 / 1280 / 1440 / 1920. Mobile uses bottom nav,
bottom sheets, stacked cards; tables collapse to cards under `md`.
