# Code Audit — revme-ai server surface (tenant API, auth, operator desk)

**2026-09-17** · Scope: `src/middleware.ts`, `src/lib/**`, `src/routes/api/**`, `src/routes/qr`, `src/routes/review`, the public review page's redirect logic, and the untracked operator desk in `app/` · Stack: SolidStart 2 RC / Nitro, better-auth 1.6.25 (admin, emailOTP, twoFactor plugins), Prisma 7 on Postgres, DeepSeek via LangChain; desk is React Router 7 · **Threat model (inferred):** an internet-facing multi-tenant SaaS. Signup is open, so "authenticated attacker" means anyone with an email address. Anonymous visitors can reach the public review, booking, QR and AI-suggestion endpoints. The app stores business PII, guest contact details and encrypted Google OAuth tokens (Business Profile + Meet scopes).

## Summary

The tenant API is mostly careful. Tenant scoping, invitation and join-request state machines, OAuth state handling, and token encryption are all well built. The biggest problem is **one design collision rather than a missing check**: the app stores its per-team role in `User.role`, and better-auth's `admin()` plugin reads that same column to decide who is a *platform* administrator. Any user who is a team "admin" is therefore a global admin of the whole product. Any new signup can reach that state in a few minutes and then take over every account. The second serious issue is stored XSS: a business owner's review link is navigated to automatically on the public review page, with no scheme check. **Next action: stop team roles from granting better-auth admin rights (F-01) before anything else ships.** Then audit production for `user.role = 'admin'` rows and for sessions with `impersonated_by` set.

| Critical | High | Medium | Low |
|---|---|---|---|
| 1 | 1 | 5 | 4 |

**Ship recommendation: Block.** F-01 lets any self-registered user impersonate any user, reset anyone's password and list every user. It is reachable today through the normal team-invite UI.

## Findings

### F-01 — Team role "admin" is also better-auth's platform-admin role, so any team admin can impersonate and take over every account

**Severity:** Critical · **Confidence:** Confirmed (traced through app code and the installed `better-auth@1.6.25` dist) · **CWE-269** (Improper Privilege Management), **CWE-863** · OWASP A01 · `src/lib/auth.ts:113`, `src/lib/roles.ts:2`, `src/routes/api/team/invite.ts:72`, `src/routes/api/team/members/[id].ts:52`

```ts
// src/lib/auth.ts
plugins: [
  admin(),            // defaults: adminRoles ["admin"], roles { admin: adminAc, user: userAc }
  ...
// src/lib/roles.ts — team roles, written to the same User.role column
export const ROLE_DEFINITIONS = [
  { value: "admin", label: "Admin", description: "Full access to all features" },
```

`admin()` authorizes its endpoints with `hasPermission({ role: session.user.role, ... })` (`node_modules/better-auth/dist/plugins/admin/has-permission.mjs`). The role string `"admin"` maps to `adminAc`, which grants `user: [create, list, set-role, ban, impersonate, delete, set-password, set-email, get, update]` and `session: [list, revoke, delete]`. `session.user.role` is the Prisma `User.role` column (`schema.prisma:21`). The app writes team roles into that same column in several places:

- invite accept: `team/accept-invite.ts:204` (`role: invitation.role`)
- member role change: `team/members/[id].ts:54`
- join-request approval: `team/join-requests/[id].ts:204`
- the desk's `setUserRole`

**Exploit path (no special access):**
1. Sign up as A and create a business in onboarding. A is now an owner, and `canManageTeam` returns true.
2. `POST /api/team/invite {email: "b@attacker-mailbox", role: "admin"}`. Log in as B and accept. B's `User.role` is now `"admin"`.
3. As B, call better-auth's own endpoints. None of these routes check the tenant:
   - `GET /api/auth/admin/list-users` returns every user and email.
   - `POST /api/auth/admin/impersonate-user {userId}` gives a session as any non-admin user, which covers every business owner, since owners keep the default `member` role.
   - `POST /api/auth/admin/set-user-password {userId, newPassword}` has no admin-target guard, so it works against anyone, including other admins.
   - `set-role`, `remove-user` and `ban-user` also work.

The `/api/auth` prefix bypasses the app's origin middleware, and better-auth accepts same-origin requests from the logged-in browser or any non-browser client. This is Critical, not High: the "authenticated" precondition is just a free signup, and the result is full cross-tenant account takeover, including connected Google Business/Meet tokens. **It also means every legitimate customer "Admin" is a platform admin right now.**

**Fix.** Team authorization and platform authorization must not share a column. I'd do both of the following.

1. Pin the plugin to a role name the tenant app can never write:
```ts
import { adminAc, userAc } from "better-auth/plugins/admin/access";
admin({
  adminRoles: ["platform_admin"],
  roles: { platform_admin: adminAc, user: userAc }, // "admin", "member", ... now carry no permissions
}),
```
2. Move team roles to their own column so the two concepts can't drift back together. Add `teamRole String @default("member")` and migrate with `UPDATE "user" SET team_role = role`. Point `roles.ts`, `business-context.ts`, the team routes, `TeamPage.tsx` and the desk's `setUserRole` at it. Then reset `role` to `user` for everyone except named platform staff.

If nothing actually uses better-auth's admin endpoints (the desk writes to the DB directly, and impersonation is broken anyway — see F-11), removing `admin()` entirely is the smallest safe change. After fixing, check production for `session.impersonated_by IS NOT NULL` and `account.updated_at` changes you can't explain.

---

### F-02 — Stored XSS: a business owner's review link is navigated to automatically on the public review page

**Severity:** High · **Confidence:** Confirmed by trace (not executed in a browser; `location.href = "javascript:…"` executing in the current document is standard browser behavior) · **CWE-79** · OWASP A03 · `src/routes/api/business.ts:190-198`, `src/routes/company/[username]/review/index.tsx:381,396,479,504`

```ts
// api/business.ts — stored as-is
reviewLink: typeof reviewLink === "string" ? reviewLink : null,
reviewLinks: typeof reviewLinks === "object" && reviewLinks !== null && !Array.isArray(reviewLinks) ? reviewLinks : undefined,
// company/[username]/review/index.tsx
const primaryRedirect = () => orderedPlatforms()[0]?.[1] ?? "https://search.google.com/local/writereview";
...
onRedirect={() => { trackRedirect("google"); window.location.href = primaryRedirect(); }}   // auto, after 5s
<a href={redirectUrl} target="_blank" ...>
```

Any signed-up owner can save `reviewLink: "javascript:fetch('/api/…',{method:'POST',credentials:'include',…})"`. A visitor who submits a review on `/company/<owner>/review` gets a 5-second countdown, then the payload runs on the app's origin. The same goes for clicking any `reviewLinks` button. Session cookies are HttpOnly, but the script can make credentialed same-origin API calls as the victim. That includes the F-01 admin endpoints when the victim is any team admin. The CSP can't stop this: it is report-only and allows `'unsafe-inline'`. This is High rather than Critical because the victim has to complete a review on the attacker's page, which a targeted link or QR code makes easy.

**Fix.** Validate on write, and render defensively:
```ts
function httpUrl(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  try { const u = new URL(v.trim()); return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null; }
  catch { return null; }
}
// POST /api/business
reviewLink: httpUrl(reviewLink),
reviewLinks: sanitizeLinks(reviewLinks), // keep only known slugs + CUSTOM_LABEL_KEY; run values through httpUrl, cap length
```
Pass values through `httpUrl` again in `orderedPlatforms()` before rendering, because existing rows are already stored. Also run a one-off query for `review_link NOT ILIKE 'http%'` to find payloads that are already saved.

---

### F-03 — Operator desk uses the bearer token as the operator's identity and persists it to the audit log and Verification table

**Severity:** Medium (High once the desk is deployed) · **Confidence:** Confirmed · **CWE-532**, **CWE-598** · `app/prisma/operator.ts:30-33`, `app/prisma/audit.ts:32`, `app/routes/impersonate.tsx:55-60`, `app/routes/console.unlock.tsx:18`

```ts
map.set(token.trim(), { id: token.trim(), name: rest.join(":").trim() });   // id === secret
...
operatorId: operator.id,                                                     // audit row
value: operator.id,                                                          // verification row
```

Every audited desk action writes the operator's live bearer credential into `ConsoleAuditLog.operatorId`, and the audit page displays it. Every impersonation handoff writes it into `verification.value`. That table sits in the tenant database and is readable by anything with DB access. Anyone who can read either table can mint an operator session. The unlock flow also puts the token in the query string (`/console.unlock?token=…`), where proxy logs and browser history keep it. Token comparison uses `===`.

**Fix.** Separate the identifier from the secret. Store `DESK_OPERATORS="op_jane:<sha256(token)>"`, compare the SHA-256 of the presented token with `timingSafeEqual`, and use `op_jane` as `operator.id`. Take the token through a POST form, not a query parameter. The `.env.example` already describes an `operator_id:token` format, but the parser reads the first field as the token.

---

### F-04 — Public AI endpoint and all IP rate limits key on client-controlled `X-Forwarded-For`, allowing unbounded LLM spend and metric inflation

**Severity:** Medium · **Confidence:** Probable — unverified link: whether the production proxy *replaces* or *appends to* `X-Forwarded-For` · **CWE-770**, **CWE-348** · `src/lib/rate-limit.ts:42-48`, `src/routes/api/ai/suggest-review.ts:45-80`

```ts
return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
```

Most proxies (nginx `$proxy_add_x_forwarded_for`, most load balancers) append the connecting IP, so element `[0]` is whatever the client sent. `/api/ai/suggest-review` needs no auth. Its per-review limit is skipped by leaving out `reviewId`, and its per-IP limit (30/h) resets whenever the header changes. `draftText`, `keywords` and `businessName` have no length caps, so each call can send a large prompt to DeepSeek on your key. The same trick defeats the limits on `/api/reviews/track`, `/qr/[id]`, `/review/[id]` and the join-request IP cap. Every new fake IP also adds an entry to the in-memory `store` Map, which is only swept every 10 minutes. On a multi-instance deployment the limits are per-process anyway.

**Fix.** Derive the client IP from the rightmost untrusted hop, using a configured number of trusted proxies:
```ts
const TRUSTED_HOPS = Number(process.env.TRUSTED_PROXY_HOPS ?? 1);
const chain = (request.headers.get("x-forwarded-for") ?? "").split(",").map(s => s.trim()).filter(Boolean);
return chain[chain.length - TRUSTED_HOPS] ?? "unknown";
```
Also cap input sizes in `suggest-review` (for example `draftText ≤ 2000`, `keywords ≤ 500`, `businessName ≤ 120`). Add a global daily token budget checked against `ai-usage` ledger totals. Move rate-limit state to Postgres or Redis before scaling beyond one instance.

---

### F-05 — Anonymous booking and review-creation endpoints have no abuse controls: any business's calendar can be exhausted and its public page flooded

**Severity:** Medium · **Confidence:** Confirmed · **CWE-799**, **CWE-770** · `src/routes/api/company/[username]/bookings.ts:11`, `src/routes/api/reviews/share.ts:109-148`

`POST /api/company/:username/bookings` is public. It has no rate limit, CAPTCHA or email verification, and no length caps on `name`, `phone` or `message`. A loop over `GET /api/company/:username/schedule` can book every open slot for 30 days ahead, one request per slot. Each booking marks the slot `isBooked` and emails the owner, so the owner's inbox gets flooded along with the calendar. Legitimate visitors then see no availability until the owner rejects each fake request by hand.

The anonymous `POST /api/reviews/share` path likewise creates `SharedReview` rows (text up to 5000 chars, any rating 0–5) for any business, with no limit. Those rows feed the business's analytics and public review surface.

**Fix.** Rate-limit both endpoints by a trustworthy IP (see F-04) and per business, for example 5 bookings/hour per IP and 20 per business per day. Add caps like `name ≤ 100`, `message ≤ 1000`, `phone ≤ 32`. For bookings, consider holding the slot only after the guest confirms through an emailed link, so an unverified request doesn't lock inventory.

---

### F-06 — Every accepted meeting sends a calendar invite with `NaN` start/end times, and the meeting date is dropped

**Severity:** Medium · **Confidence:** Confirmed (reproduced: `new Date("T09:30")` is Invalid Date, and `toUtcDatetime` renders `NaNNaN…TNaN…Z`) · `src/routes/api/marketplace/meetings/[id].ts:146-147` and `:398-399`

```ts
start: new Date(`T${meeting.slot.startTime}`),
end: new Date(`T${meeting.slot.endTime}`),
```

The `.ics` attached to both confirmation emails has `DTSTART:NaNNaNNaNTNaNNaNNaNZ`. Gmail and Outlook reject or ignore it, so neither the guest nor the owner gets a usable calendar entry. Even a string that parsed would ignore `slot.date` and the business `timezone`.

**Fix.** Build the instant from the slot date, the time and the business timezone:
```ts
const day = meeting.slot.date.toISOString().slice(0, 10);          // slot.date is stored as the calendar day
const start = Temporal.PlainDateTime.from(`${day}T${meeting.slot.startTime}`)
  .toZonedDateTime(business.timezone).toInstant();
```
Or compute the UTC offset for `business.timezone` by hand if Temporal isn't available on the server. Select `timezone` in the query, and move the duplicated accept/reject block (GET and PATCH are copies) into one function so the fix lands once.

---

### F-07 — Meeting accept/reject is a state-changing GET authorized only by a non-expiring signed link, so email link scanners can accept or reject requests

**Severity:** Medium · **Confidence:** Probable — unverified link: whether the owner's mail provider pre-fetches links (Outlook Safe Links, Mimecast and Proofpoint commonly do) · **CWE-352**-adjacent, **CWE-613** · `src/routes/api/marketplace/meetings/[id].ts:15-105`

`GET /api/marketplace/meetings/:id?action=accept&sig=…` changes state, creates a Google Meet space on the owner's account, and sends emails. The email carries both the accept *and* the reject link. Whichever one a scanner fetches first wins, and the signature never expires. The `status !== "pending"` check followed by the update is not atomic either, so two concurrent fetches can each create a Meet link and send duplicate emails.

**Fix.** Make the GET render a confirmation page with a button that POSTs the same `sig`. Include an expiry in the signed payload (`${id}:${action}:${exp}`). Claim the transition atomically:
```ts
const claimed = await tx.meetingRequest.updateMany({ where: { id, status: "pending" }, data: { status: newStatus } });
if (claimed.count === 0) return alreadyDecided();
```

---

### F-08 — Unescaped business name written into a same-origin print window

**Severity:** Low · **Confidence:** Confirmed (flagged by semgrep, then traced) · **CWE-79** · `src/routes/(app)/reviews/new.tsx:313-317`

`win.document.write(\`…<h1>${settings.businessName()}</h1>…\`)` runs in an `about:blank` window that inherits the app's origin. Only the owner can set the name (`POST /api/business` rejects members), so the realistic victims are that owner's own team members. That makes this Low today, but F-01 raises its value as a way to reach admins. **Fix:** HTML-escape `businessName()` and `url` before interpolating, or build the document with `createElement` and `textContent`.

### F-09 — CSV export of tenant-controlled fields enables formula injection against operators

**Severity:** Low · **Confidence:** Confirmed · **CWE-1236** · `app/routes/export-businesses.tsx:55-59`

`csvEscape` quotes commas, quotes and newlines, but doesn't neutralize a leading `= + - @ \t \r`. Business and owner names are tenant-controlled. **Fix:** `if (/^[=+\-@\t\r]/.test(value)) value = "'" + value;` before quoting.

### F-10 — Unbounded, attacker-chosen keys in `platformRedirects` JSON, with lost updates under concurrency

**Severity:** Low · **Confidence:** Confirmed · **CWE-770** · `src/routes/api/reviews/track.ts:55-80`

`platform` is any string of any length, so every public `redirect` event can add a new key to the review's JSON column. Combined with F-04, that column can grow without bound and bloat `/api/reviews/analytics` responses. The read-modify-write also drops increments when requests overlap. **Fix:** allow only the slugs in `features/settings/review-platforms.ts`, and increment with `jsonb_set` in one `UPDATE`, or store redirects in a `(review_id, platform)` counter table.

### F-11 — Impersonation handoff is broken in four places; the fixes need a stated design first

**Severity:** Low (fails closed today) · **Confidence:** Confirmed · `src/routes/api/operator/impersonate.ts`, `app/routes/impersonate.tsx:83`, `src/middleware.ts:124`

The flow cannot currently succeed:
1. The desk redirects to `/operator/impersonate`, but the route is `/api/operator/impersonate`.
2. Middleware returns 401 on `/api/*` without a tenant session.
3. `verification.value` holds the operator id but is compared with `parts[0]`, the *target user* id.
4. `auth.api.impersonateUser` is called without `returnHeaders: true`, so no `Set-Cookie` is copied. It also requires the caller to already hold an admin session.

Don't fix these piecemeal. Once F-01 is fixed, create the session server-side on a verified handoff, without depending on a better-auth admin session. Consume the nonce atomically (`deleteMany({ where: { identifier, expiresAt: { gt: now } } })` and check `count === 1`; the current `findFirst` then `delete` lets two requests pass), and bind it to the target user id. Separately, the desk's `console.unlock` route sits inside the layout whose loader redirects to `/console.unlock`, and the unlock cookie is set raw while `currentOperator` parses it as a React Router encoded cookie. So the desk can't authenticate at all right now.

## Positive observations

- **Tenant scoping on object IDs is consistently correct** in tasks, team meetings, invitations, join requests, members, services, projects and contacts. Each route loads the row, compares its `businessId` to the caller's, and returns the same 404 for "missing" and "someone else's". The update in `services.ts:113` is also scoped `where: { id, businessId }`, which closes the confused-deputy variant.
- **The review-claim token (`lib/review-claim.ts`) and OAuth state (`lib/oauth-state.ts`) are built properly**: HKDF purpose-scoped keys, constant-time comparison, expiry, and allowlisted return paths. The invite and join-request transitions use guarded `updateMany` with a `count` check inside transactions, which is how races should be handled.
- **Google tokens are encrypted with AES-256-GCM** and a random 12-byte IV, and the code never reflects OAuth errors into HTML.

## Appendix A — Speculative leads

- **GCM tag length not pinned** (`src/lib/crypto.ts:113`, semgrep). `createDecipheriv` without `{ authTagLength: 16 }` may accept truncated tags, depending on the Node version. Exploiting it needs write access to `google_token` rows, so it's hardening only. To confirm, pass a 4-byte tag on the deployed Node version. Pinning `authTagLength: 16` costs nothing.
- **Public schedule leaks internal team-meeting titles and times** (`lib/company-schedule.ts:128-138`). `TeamMeeting.title` is published as the slot title on the public booking page. Whether that matters depends on what teams put in titles. Replace it with `"Busy"`.
- **`POST /api/marketplace/slots` accepts unbounded arrays with unvalidated `startTime`/`endTime` strings**, which end up on the public schedule. This is a lead only because the owner can already write their own schedule.
- **`auth.ts` passes `user.changeEmail.sendChangeEmailVerification`**, which is not an option name in better-auth 1.6.25. The custom template is dead code, and the default verification email goes to the new address. Not a vulnerability (`updateEmailWithoutVerification` is unset), but confirm the email change UX behaves as intended.

## Appendix B — Coverage

**Reviewed in full:** `src/middleware.ts`; `src/lib/{auth,server-auth,business-context,roles,crypto,oauth-state,review-claim,rate-limit,cookies,trusted-origins,invite-redirect,google-tokens,company-schedule}.ts`; every file under `src/routes/api/team/**`, `api/reviews/**`, `api/ai/**`, `api/google/**`, `api/company/**`, `api/operator/**`, `api/tasks/**`, `api/team-meetings/**`, `api/business.ts`, `api/feedback.ts`, `api/meet/create.ts`, `api/marketplace/meetings/**`, `api/marketplace/slots/generate.ts`, `api/marketplace/partner.ts`; `src/routes/qr/[id].ts`, `src/routes/review/[id].ts`; desk `app/prisma/{operator,db}.ts`, `app/routes/{layout,console.unlock,impersonate,export-businesses,user-detail,reviews}.tsx`. Also the better-auth admin plugin (`has-permission.mjs`, `access/statement.mjs`, `routes.mjs` for impersonate and set-password) and `change-email` in the installed dist.

**Skimmed** (auth and ownership checks only): `api/marketplace/{services,projects,contacts,slots/index,slots/mine,schedule-settings,load,favorites,partners}.ts`, `lib/company-profile.ts`, `lib/partners-query.ts` (no raw SQL), `services/email-templates.ts` (confirmed `escapeHtml` is applied to user-supplied fields in the meeting and join templates), `app/prisma/{audit,users,marketplace}.ts`.

**Not reviewed:** most client components and pages (only the review page redirect logic and the `reviews/new.tsx` print sink were traced); `src/lib/agents/**` prompt construction (output only goes back to the requester); `services/email.ts` transport; the remaining desk routes and their `app/prisma/*` query helpers; `prisma/migrations` beyond schema lookups; `scripts/`. `dist/` and `node_modules/` are generated.

**Attacker goals pursued:**
1. *Read or modify another tenant's data.* No IDOR found in the app's own routes. **Path found through better-auth's admin endpoints (F-01).**
2. *Escalate from signup to platform control.* **Found (F-01).** The desk's operator gate fails closed today (F-11), but its credential handling is unsafe (F-03).
3. *Run script in another user's browser.* **Found (F-02, F-08).** OAuth callback reflection was checked and ruled out.
4. *Abuse public endpoints for cost or denial of service.* **Found (F-04, F-05, F-10).**
5. *Hijack invitations and join requests* (accept someone else's invite, change email to match an invite, race an accept). **Ruled out.** Acceptance requires the session's email to match; change-email requires verification; transitions are guarded `updateMany` inside transactions.
6. *Forge meeting decisions or review-claim tokens.* **Ruled out.** Both are HMAC with constant-time comparison; the invalid-signature fallback correctly re-checks ownership. The operational weakness is F-07.

**Baseline tooling run:**
- `semgrep --config p/security-audit --config p/typescript` on `src app scripts`: 5 results (4 × `document.write` in `reviews/new.tsx` → F-08; 1 × GCM tag length → Appendix A). There were **649 parse errors**, mostly TSX that the rulesets didn't parse, so semgrep coverage of `.tsx` is effectively partial.
- `osv-scanner` on `pnpm-lock.yaml`: 10 advisories in 6 packages (mysql2, fast-uri ×4, deepmerge-ts, nanoid, sharp, esbuild). Reachability was checked with `pnpm why`:
  - mysql2 comes in through better-auth/db0 optional drivers, and the app uses Postgres.
  - fast-uri and deepmerge-ts come in through Prisma CLI tooling.
  - nanoid and esbuild are build-time only, through Vite.
  - sharp is a devDependency.
  - None is plausibly reachable at runtime, so none became a finding. Bumping them is still cheap.
- `trufflehog git --only-verified`: **0 verified secrets in history.**
- `trufflehog filesystem --only-verified` on the working tree: **the local, gitignored `.env` contains verified-live credentials** (a Postgres connection string for the `neondb_owner` role, and DeepSeek and OpenRouter API keys). They are not committed, so this is not a code finding. Two notes: the app connects to the database as the owner role, where a least-privilege role would be better; and any copy of this directory, such as a repomix bundle or a zip, carries the keys.

**Deep analysis run:** none. One local reproduction confirmed F-06 (`node`, Invalid Date → `NaN` iCalendar fields).

**Tooling unavailable or not used:**
- No CodeQL. A custom "route reaches Prisma read without `businessId` comparison" query would turn the manual IDOR sweep into a guarantee. The manual sweep covered every `api/` route, so no finding's confidence was capped by this.
- No `eslint-plugin-security` run, and `tsc` was not run.
- F-01 was not reproduced end-to-end: the only configured database is a live remote Neon instance and was deliberately not touched. It is marked Confirmed because the full authorization path was read in both the app and the installed library.

**What this audit could not assess:**
- The production proxy's `X-Forwarded-For` behavior (decides F-04's confidence).
- Whether production already has `role = 'admin'` users or impersonated sessions (decides F-01's historical impact).
- Hosting-level request body limits.
- better-auth's built-in rate limiter configuration in production.
- Email provider link-scanning behavior (F-07).
- Google Cloud OAuth client configuration.
- Whether the desk will be deployed on a separate origin, and with what network restrictions.
