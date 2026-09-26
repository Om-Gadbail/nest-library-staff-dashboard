# Nest Staff API (FastAPI + PostgreSQL)

Clean modular monolith for the Nest Library Staff Dashboard.

```
React API Layer → FastAPI → Auth/RBAC/Tenant → Services → PostgreSQL
```

## Quickstart (dev, SQLite)

```bash
cd backend
py -m pip install -r requirements.txt
py scripts/seed.py --reset
py -m uvicorn app.main:app --reload --port 8000
```

Frontend: set `VITE_API_BASE_URL=http://localhost:8000/api/v1` and
`VITE_ENABLE_MSW=false`, then `npm run dev`.

Demo logins (seed only, change immediately): `owner@nestlibrary.in`,
`rahul@nestlibrary.in`, `priya@nestlibrary.in` — password `Nest@123`.
Prime Fitness owner: `prime.owner@primefitness.in`.

## PostgreSQL (production-like)

```bash
# .env
DATABASE_URL=postgresql+pg8000://nest:SECRET@localhost:5432/nest
```

Run migrations with Alembic:

```bash
alembic upgrade head
```

Fresh DB: `alembic upgrade head && py scripts/seed.py` (seed is dev-only).

## Auth

- `POST /api/v1/auth/login` (rate-limited: 5 attempts / 5 min per IP+email)
- `GET /api/v1/auth/me`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`
- JWT access token via HttpOnly cookie `nest_at` (+ Bearer fallback);
  rotating refresh token via HttpOnly cookie `nest_rt` (server allow-list).
- Passwords: bcrypt. No tokens in localStorage.

## RBAC / tenant isolation

Roles: `owner` > `admin` > `staff` (`app/core/permissions.py`).
Business context is derived server-side from `user_businesses` memberships;
`X-Business-Id`/query params are only selectors, never grants.
Every resource query is scoped by `business_id`.

## Background jobs

In-process APScheduler runs the renewal check every 15 min.
Dedupe via `automation_runs(business_id, job, dedupe_key)`.
Manual trigger: `POST /api/v1/jobs/renewal-check` (owner/admin).

## WhatsApp

Provider abstraction in `app/services/whatsapp.py` (`log` | `meta` Cloud API).
If unconfigured, `POST /whatsapp/send` returns `503 WHATSAPP_NOT_CONFIGURED`
— delivery is never faked. Secrets are write-only (never returned by GET).

## Tests

```bash
py -m pytest -q
```
