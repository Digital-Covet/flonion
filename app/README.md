# Flonion Desk

Operator console for managing businesses, users, reviews, meetings, marketplace listings, AI usage, and support tickets.

## Setup

### Prerequisites

- Node.js >= 20
- pnpm
- PostgreSQL (same database as the tenant app)
- A running tenant app instance (for impersonation handoff)

### 1. Install dependencies

```bash
cd app
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in `DATABASE_URL`, `DESK_OPERATORS`, `TENANT_APP_URL`, and `OPERATOR_HANDOFF_SECRET`.

### 3. Generate Prisma client

```bash
pnpm prisma generate
```

### 4. Start the dev server

```bash
pnpm dev
```

Opens at `http://localhost:5173`.

## Access

Navigate to `/console.unlock` and enter your operator token. `DESK_OPERATORS` holds only `operator_id:sha256(token)` pairs, and the audit log records the operator id, never the token. The token is stored in an HttpOnly cookie.

## Architecture

| Path | Purpose |
|------|---------|
| `app/prisma/` | Prisma client, query helpers, write helpers |
| `app/components/shell/` | Shared UI (DataTable, Pagination, FilterBar, StatRow) |
| `app/routes/` | React Router v7 routes |
| `app/routes.ts` | Route config |

## Impersonation

Operators can impersonate a user from the User Detail page. The flow:

1. Desk mints a one-time HMAC-signed token (60s TTL) bound to the target user and operator id.
2. Operator is redirected to `TENANT_APP_URL/api/operator/impersonate?token=...&sig=...`.
3. Tenant verifies the signature, consumes the nonce atomically, creates a one-hour session with `impersonatedBy` set, and redirects to `/dashboard`. Platform admins and banned users cannot be impersonated.
4. A yellow banner appears in the tenant UI with a "Stop Impersonation" link.
5. Stop impersonation clears the session and redirects back to the desk.

## Security

- All write operations require the `x-operator-id` header (set by the cookie-based auth).
- Every mutation is recorded in the `ConsoleAuditLog` table with operator ID, IP, before/after JSON, and timestamp.
- The desk Prisma client is **read-only** — no `@updatedAt` columns are used; writes explicitly set timestamps.
- Business username uniqueness is enforced at the database level; violations surface as field errors, not 500s.
- Delete dialogs require typed confirmation.
