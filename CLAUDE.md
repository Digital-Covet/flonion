# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Flonion (repo name `revme-ai`): a multi-tenant SolidStart app for review collection (QR → public review page → platform redirect), DeepSeek-drafted reviews/replies, Google Business Profile sync, a partner marketplace with bookings, team/task management, and Cashfree subscriptions. `README.md` has the full feature list, env var table and API route table.

## Commands

pnpm, Node >= 24.

```bash
pnpm dev                     # vite dev on http://localhost:3000
pnpm build                   # prisma generate && vite build (Nitro output in .output/)
pnpm start                   # run the built server
pnpm typecheck               # tsc --noEmit (TypeScript 7)
pnpm check                   # biome check --write (lint + format + organize imports)
pnpm test                    # vitest run (all src/**/*.test.ts)
pnpm test src/routes/api/billing/cancel.test.ts   # one file
pnpm test -t "403s a plain member"                # one test by name
pnpm exec prisma migrate dev # apply/create migrations (uses DATABASE_URL_UNPOOLED)
pnpm exec prisma generate    # regenerate the client after schema edits
```

The Prisma client is generated to `generated/prisma` (gitignored) and imported as `@generated/prisma/client`; run `prisma generate` on a fresh checkout or after editing `prisma/schema.prisma`. Runtime uses `DATABASE_URL` (pooled, via `@prisma/adapter-pg`); `prisma.config.ts` uses `DATABASE_URL_UNPOOLED` for migrations.

`vitest.config.ts` is standalone (no SolidStart/Nitro plugins) and only shares the `~`/`@`/`@generated` aliases, so tests cover server code, not components.

## Architecture

### Request pipeline — `src/middleware.ts`
Every request passes through one middleware that does, in order: CSRF origin check on state-changing `/api/*` (except `/api/auth`, which better-auth checks itself); session loading; the auth gate (401 JSON for API, 302 to `/login` for pages); suspension gate; onboarding gate (`/onboarding` until `User.onboardingCompleted`); security headers and `Cache-Control: private, no-store` on everything non-public. Server functions (`/_server`) are never redirected — they get `event.locals.session` and each query decides.

**Public routes must be added to `PUBLIC_PATHS` / `PUBLIC_PREFIXES` / the regexes in `isPublicPath`**, otherwise they 401/redirect. Routes made public there (webhooks, cron, operator handoff, signed meeting links) authenticate themselves.

### Server layer — Effect v4 (`src/server/effect/`)
All API routes and server-side data loading run as Effect programs on one `ManagedRuntime` (`runtime.ts`, cached on `globalThis` — **editing a service layer requires restarting the dev server**). The pinned version is `effect@4.0.0-rc`, whose APIs differ from Effect 3 (`Context.Service`, `Schema.TaggedError`, `Effect.fn.Return`, `Schema.Literals`); follow existing code rather than v3 memory.

- **Services** (`services/`): `Db` (Prisma via `db.use(p => ...)` / `db.transaction`), `Auth`, `RateLimiter`, `Billing` (+ `cashfree.ts`), `Google`, `Mailer` (ZeptoMail), `LlmModel` (DeepSeek). A service with missing env vars must fail only its own feature, never layer construction.
- **API routes** (`src/routes/api/**`): `export const POST = handler("name", Effect.gen(function* () { ... }))` from `http.ts`. Compose guards from `guards.ts` (`requireSession`, `requireBusinessContext`, `requireTeamManager`, `rateLimit`, `decodeJsonBody`, `recoverAll`, ...). A returned `Response` is sent as-is; anything else becomes JSON.
- **Errors** (`errors.ts`): routes may only fail with `HttpError | DbError` (`Unauthorized`, `Forbidden`, `NotFound`, `BadRequest`, `Conflict`, `RateLimited`, `UpstreamError`, `RawResponse`, `Redirect`). Domain errors (e.g. `CashfreeFailure`) must be mapped explicitly — the type system enforces it. Responses keep the `{ error: message }` body the client reads. `DbError`/defects log and return a bare 500.
- **Server functions for pages**: a `query(...)` with `"use server"` in `src/server/*.ts` (e.g. `business.ts`) dynamically imports a `*-data.ts` module that runs an Effect via `runServerFn` (`server-fn.ts`). `Redirect` failures become router redirects.
- **Client/server boundary is lint-enforced**: Biome's `noRestrictedImports` forbids importing `effect` or `~/server/effect/**` statically from components, routes `.tsx`, `features/`, and the query wrapper files. Reach server code only through `await import(...)` inside a `"use server"` body.

### Tests
Route tests mock `~/server/effect/runtime` to return `testRuntime.current`, then build a runtime from fakes in `src/server/effect/testing.ts` (`useRuntime`, `fakeDb` with a partial Prisma shape, `fakeAuth`, `fakeSession`, `fakeBilling`, `fakeMailer`, `fakeLlm`, `fakeEvent`). See `src/routes/api/billing/cancel.test.ts` for the pattern: `vi.mock` first, then `await import` the route.

### Tenancy and roles
A user reaches a business either as owner (`Business.userId`, `User.business`) or as a member (`User.businessId` → `User.team`), never both. Always resolve through `requireBusinessContext` / `~/lib/business-context.ts` — owning a business elsewhere confers no rights in a team. Team management (and billing) is owner/admin only; members may only edit tasks assigned to them (`src/server/task-rules.ts`).

### Other cross-cutting pieces
- **Auth**: better-auth (`src/lib/auth.ts`, client `auth-client.ts`) mounted at `/api/[...auth].ts`; email/password with verification, 2FA, email OTP; emails normalized and disposable domains rejected (`src/lib/email-validation.ts`). A better-auth docs MCP and skills in `.agents/skills/` are available.
- **AI**: `src/lib/agents/` (sentiment → draft pipeline) runs on `LlmModel`; every LLM call writes an `AiUsage` ledger row (`ledger.ts`, `server/effect/ai-ledger.ts`). Model id/pricing in `src/lib/agents/model.ts`.
- **Billing**: Cashfree subscriptions (`src/lib/payments/`, `services/billing.ts`); `/api/webhooks/cashfree` verifies the HMAC and re-reads state from Cashfree's API before acting. Plans in `src/lib/plans.ts`.
- **Soft delete**: deleted records are archived for a year; `/api/cron/purge-deleted-records` (Vercel cron, `vercel.json`, checks `CRON_SECRET`) purges them.
- **Security helpers**: Google tokens AES-256-GCM encrypted (`lib/crypto.ts`), signed OAuth state, HMAC-signed meeting accept/reject email links, signed review-claim tokens, in-memory rate limiting.
- **Operator console**: a separate React Router app (`app/`, excluded in `tsconfig.json`, not in this repo) shares the database and hands off impersonation via `/api/operator/impersonate` (HMAC with `OPERATOR_HANDOFF_SECRET`, single-use nonce in `Verification`).

### Frontend
SolidJS + SolidStart 2 file routing: `src/routes/(app)/` is the signed-in shell (`(app).tsx`), public pages are `company/[username]/review|bookings`, `qr/[id].ts`, `review/[id].tsx`. UI is Ark UI (Solid) + Tailwind v4 + Tabler icons; feature components live in `src/components/<feature>/` (`data.ts` for client data/helpers, `widgets.tsx`/`panels.tsx` for UI). Design tokens and UX rules are in `flonion-design-system.md` (e.g. always label AI drafts as editable drafts; never colour-only status). `vite.config.ts` rewrites `@tabler/icons-solidjs` barrel imports into per-icon imports — keep using named imports from the package.

## Notes
- `README.md`'s project-structure tree is partly stale (mentions `stores/`, `hooks/`, `(auth)/` groups and an in-repo `app/` that don't exist); trust the filesystem.
- Validation uses Effect `Schema` (`src/server/effect/schemas.ts`), not Zod.
- Commits follow conventional commits with scopes (`feat(billing): ...`, `fix(ui): ...`).
