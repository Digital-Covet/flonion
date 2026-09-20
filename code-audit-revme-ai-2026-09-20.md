# Code Audit — revme-ai (Flonion)

**Date:** 2026-09-20 · **Scope:** `src/` — server surface read in depth (`src/routes/api/**`, `src/lib/**`, `src/server/**`, `src/middleware.ts`, `src/services/**`) · **Stack:** SolidStart 2.0.0-rc.10 / Nitro 3 beta / Node ≥24, Prisma 7 + PostgreSQL, better-auth 1.7.5, DeepSeek via LangChain, ZeptoMail · **Threat model (inferred, not stated):** internet-facing multi-tenant SaaS. Untrusted anonymous visitors reach the QR, public review, company booking and AI-suggestion endpoints; authenticated tenants are mutually untrusting; the app holds business PII, customer review content, team member emails, and encrypted Google OAuth refresh tokens. A single Node process serves all tenants.

## Summary

This is careful, security-aware code. Authorization is enforced consistently — every mutating API route resolves a session and scopes its query by business, the multi-tenant `where` clauses include `businessId` on the update paths where it matters, signed capability tokens back the anonymous flows, and the crypto module is genuinely well built. I worked backwards from five attacker goals and could not reach any of them: no IDOR, no privilege escalation, no injection, no token theft path.

The problems are on the availability side, and they are the kind that static analysis cannot see. Two of them let an unprivileged caller take the whole server down: an unbounded loop in the iCalendar generator reachable from an unauthenticated booking form, and a fire-and-forget promise in the auth config that turns a mail-provider failure into `process.exit(1)`. Both are confirmed by reproduction. The rest are hardening gaps — a cache-control guard that does not cover the page it was written for, spoofable rate-limit keys, and several unbounded inputs.

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 2 |
| Medium | 4 |
| Low | 4 |

**Ship recommendation: Fix-then-ship.** F-01 and F-02 are both one-request denial of service against a single-process deployment, and both fixes are a few lines. Nothing found blocks on design. This recommendation rests on the reading in §4 of the audit, not on the clean scanner runs — semgrep and TruffleHog returning empty says nothing about authorization or business logic.

---

## Findings

### F-01 — Unbounded loop in ICS line folding lets an unauthenticated visitor crash the server

**Severity:** High · **Confidence:** Confirmed · **CWE-835** (Infinite Loop), **CWE-400** (Uncontrolled Resource Consumption) · [`src/lib/ics.ts:69`](src/lib/ics.ts:69)

```js
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let remaining = line;
  while (remaining.length > 75) {
    let cutAt = 75;
    while (cutAt > 0 && (remaining.charCodeAt(cutAt) & 0xc0) === 0x80) {
      cutAt--;
    }
    parts.push(remaining.slice(0, cutAt));
    remaining = ` ${remaining.slice(cutAt)}`;
  }
```

The inner loop is meant to avoid cutting a UTF-8 sequence, but `charCodeAt` returns UTF-16 code units, not UTF-8 bytes. `(unit & 0xc0) === 0x80` is true for any code point in `U+0080–U+00BF` (and `U+0180–U+01BF`, and so on) — ordinary printable characters such as `»` (U+00BB), `«`, `°`, `±`, `¼`. Fed a run of them, `cutAt` walks to `0`, the slice is empty, `remaining` gains a leading space, and the outer condition never becomes false. `parts` grows once per iteration with no bound.

The reachable path is fully anonymous:

1. `POST /api/company/:username/bookings` accepts `message` up to `MAX_MESSAGE_LENGTH = 1000` with no character restriction ([`bookings.ts:81`](src/routes/api/company/[username]/bookings.ts:81)) and stores it on the `MeetingRequest`.
2. The owner accepts the request (emailed link or dashboard) → [`decideMeeting`](src/lib/meeting-decision.ts:99) → `sendDecisionEmails`.
3. `DESCRIPTION` is built as `` `Message: ${meeting.message}` `` and passed to `generateIcsInvite` ([`meeting-decision.ts:229`](src/lib/meeting-decision.ts:229)), whose `lines.map(foldLine)` never returns.

`guestName` (100 chars, into `SUMMARY`) is a second trigger for the same loop.

Reproduced against the unmodified `src/lib/ics.ts` under `node --max-old-space-size=300`: a benign invite generated normally (650 bytes), then the same call with `description` containing `"»".repeat(100)` spun ~7.7M iterations before V8 aborted with a fatal `JavaScript heap out of memory` at ~8s. Node is single-threaded, so the event loop is blocked for every tenant from the first iteration and the process then dies.

High rather than Critical because the crash fires on the owner's accept rather than on the attacker's own request — one step of social engineering, against a button the owner is expected to press.

**Fix** — fold by UTF-8 octets, which is what RFC 5545 §3.1 actually specifies, and guarantee forward progress:

```ts
function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf-8");
  if (bytes.length <= 75) return line;

  const parts: string[] = [];
  let offset = 0;
  let limit = 75; // first line gets 75 octets, continuations 74 (leading space)

  while (offset < bytes.length) {
    let end = Math.min(offset + limit, bytes.length);
    // Never split a multi-byte sequence: back up off continuation octets.
    while (end > offset + 1 && end < bytes.length && (bytes[end] & 0xc0) === 0x80) {
      end--;
    }
    parts.push(bytes.subarray(offset, end).toString("utf-8"));
    offset = end;
    limit = 74;
  }

  return parts.join("\r\n ");
}
```

`end > offset + 1` is the guard that matters: it guarantees at least one octet is consumed per iteration, so the loop terminates on any input. Add a defensive length cap on `description`/`summary` in `meeting-decision.ts` as well — an invite does not need a 1000-character message body.

---

### F-02 — Unhandled promise rejection in change-email verification exits the process

**Severity:** High · **Confidence:** Confirmed · **CWE-248** (Uncaught Exception), **CWE-754** (Improper Check for Unusual Conditions) · [`src/lib/auth.ts:51`](src/lib/auth.ts:51)

```ts
sendChangeEmailVerification: async ({ user, newEmail, url }) => {
  const { html, text } = renderEmailVerificationEmail({ /* ... */ });

  void sendEmail({          // <- discarded, never awaited, no .catch()
    to: newEmail,
    subject: `Verify your new ${COMPANY_NAME} email`,
    text,
    html,
  });
},
```

`sendEmail` throws on every ZeptoMail failure path — missing config, a rejected payload, an API error ([`email.ts:92`](src/services/email.ts:92), [`email.ts:153`](src/services/email.ts:153)). `void` discards the promise, so the rejection has no handler. Node has defaulted to `--unhandled-rejections=throw` since v15, the project pins `engines.node >= 24`, and nothing in `package.json`, `vite.config`, or the start script overrides it.

So any authenticated user who submits a change-email request for an address the provider rejects — a domain ZeptoMail refuses, a recipient on a suppression list, or simply a provider outage — terminates the Node process, dropping every in-flight request for every tenant. Verified locally with a minimal mirror of the call shape: the process exited with code 1 and the subsequent timer never ran.

This is the only unguarded fire-and-forget rejection on the server; `writeLedger` looks the same at its call sites but swallows its own errors internally ([`ledger.ts:92`](src/lib/agents/ledger.ts:92)), and every other `sendEmail` call is awaited inside a `try` or chained with `.catch()`.

High, not Critical: it needs an authenticated account, and the account need not be privileged in any way.

**Fix** — await it inside the handler (better-auth will surface the failure to the caller as an error, which is the honest outcome), or keep it best-effort with an explicit handler:

```ts
await sendEmail({
  to: newEmail,
  subject: `Verify your new ${COMPANY_NAME} email`,
  text,
  html,
});
```

I would await: a change-email flow that silently fails to send the verification leaves the user stuck with no signal. If best-effort is preferred, `void sendEmail({...}).catch((err) => console.error("[auth] change-email verification failed:", err));`.

As defence in depth, add a top-level `process.on("unhandledRejection", ...)` that logs instead of exiting — but that is a net, not the fix.

---

### F-03 — Authenticated company profile pages are classified public, so the no-store cache guard never applies to them

**Severity:** Medium · **Confidence:** Confirmed · **CWE-525** (Web Browser Cache Containing Sensitive Information) · [`src/middleware.ts:33`](src/middleware.ts:33)

```ts
const PUBLIC_PREFIXES = [
  // ...
  "/company/",
  // ...
];

// Allow public access to /company/*/review and /company/*/bookings sub-routes while protecting
// the /company/:companyname profile page itself.
const companyReviewMatch = pathname.match(/^\/company\/[^/]+\/review(?:\/.*)?$/);
if (companyReviewMatch) return true;
```

The bare `"/company/"` prefix matches the entire subtree, so `isPublicPath("/company/acme")` is `true`. Two consequences:

- The `companyReviewMatch` and `companyBookingsMatch` regexes below it are dead code, and the comment claiming the profile page is protected is inverted.
- `onBeforeResponse` only sets `Cache-Control: private, no-store` when `!isPublicPath(pathname)` ([`middleware.ts:140`](src/middleware.ts:140)), so the company profile response ships with no cache directive at all.

Verified by extracting `isPublicPath` and running it: `/company/acme` → `true`, `/dashboard` → `false`, `/settings` → `false`.

That page is signed-in content. `getCompanyPage` fans out to `getCompanyContacts`, which selects `name`, `role`, `email` for every contact ([`company-profile.ts:109`](src/lib/company-profile.ts:109)), and the page is server-rendered, so those addresses are in the first HTML. Without `no-store`, a CDN, corporate proxy, or shared browser cache may store and re-serve it. The middleware comment names exactly this risk — "Nothing signed-in may be stored by a shared cache. This is the guard that makes marking the public pages cacheable safe" — and this is the page that escapes it.

Not an authorization bypass: `getCompanyPage` calls `requireSession()` itself ([`server/company.ts:32`](src/server/company.ts:32)), so an anonymous request still redirects to `/login`. Medium reflects cached-PII exposure, not unauthenticated access.

**Fix** — drop the over-broad prefix and let the two specific regexes do the work they were written for:

```ts
const PUBLIC_PREFIXES = [
  "/api/auth",
  "/api/reviews/share",
  "/api/reviews/track",
  "/api/ai/suggest-review",
  "/api/company/",
  "/api/marketplace/partner",
  "/api/operator/impersonate",
  // "/company/" removed: only the /review and /bookings sub-routes are public,
  // and the regexes below match them precisely.
  "/qr/",
  "/review/",
];
```

Worth adding a test that asserts `isPublicPath("/company/acme") === false` and `isPublicPath("/company/acme/review") === true`, since the two rules disagree silently.

---

### F-04 — Per-IP rate limits key on a client-controlled header

**Severity:** Medium · **Confidence:** Probable · **CWE-807** (Reliance on Untrusted Inputs in a Security Decision), **CWE-770** · [`src/lib/rate-limit.ts:53`](src/lib/rate-limit.ts:53)

```ts
export function getClientIp(request: Request): string {
  const chain = (request.headers.get("x-forwarded-for") ?? "")
    .split(",").map((p) => p.trim()).filter(Boolean);
  return (
    chain[chain.length - trustedProxyHops()] ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
```

The whole `X-Forwarded-For` chain arrives from the network. Taking the entry `TRUSTED_PROXY_HOPS` from the right is correct *only* when exactly that many appending proxies sit in front of the app and each one overwrites or appends rather than passing the client's value through. `TRUSTED_PROXY_HOPS` defaults to `1`. If the app is ever reached directly, or the real hop count differs, the selected entry is attacker-chosen and every per-IP limit becomes a free-for-all: rotate the header, get a fresh bucket.

What that unlocks: `POST /api/ai/suggest-review` is unauthenticated and spends money on the project's DeepSeek key, capped at `IP_RATE_LIMIT = 30/hour` ([`suggest-review.ts:126`](src/routes/api/ai/suggest-review.ts:126)); anonymous review creation at 30/hour ([`share.ts:143`](src/routes/api/reviews/share.ts:143)); anonymous bookings at 5/hour ([`bookings.ts:91`](src/routes/api/company/[username]/bookings.ts:91)). The daily token budget is the only remaining backstop on the AI endpoint, and it has its own lag (F-08).

Marked Probable rather than Confirmed because the deciding fact — the production proxy topology — is outside the repository. If there is exactly one appending proxy that sanitises inbound `X-Forwarded-For`, this is correct as written and the finding drops to Info.

Worth noting the inconsistency: better-auth, which protects the same origin, deliberately does *not* trust comma-separated forwarded chains and requires either `advanced.ipAddress.ipAddressHeaders` or `trustedProxies` to be configured behind a proxy. Neither is set in [`src/lib/auth.ts`](src/lib/auth.ts:24), so the two rate limiters on this app disagree about who the client is.

**Fix** — name the single header your proxy sets, rather than counting hops:

```ts
/** The one header the edge proxy sets and always overwrites. Never a chain. */
const CLIENT_IP_HEADER = process.env.CLIENT_IP_HEADER ?? "x-real-ip";

export function getClientIp(request: Request): string {
  return request.headers.get(CLIENT_IP_HEADER)?.trim() || "unknown";
}
```

and set the matching `advanced.ipAddress.ipAddressHeaders: [CLIENT_IP_HEADER]` on `betterAuth` so both limiters agree. Whichever header you pick, the proxy must overwrite it on every inbound request; if it merely appends, a client can still supply the first value.

---

### F-05 — Several write endpoints accept unbounded arrays and unbounded strings

**Severity:** Medium · **Confidence:** Confirmed · **CWE-770** (Allocation of Resources Without Limits)

Array parameters reach `createMany` with only an "at least one" check:

- [`marketplace/contacts.ts:41`](src/routes/api/marketplace/contacts.ts:41) — `contacts`
- [`marketplace/projects.ts:41`](src/routes/api/marketplace/projects.ts:41) — `projects`
- `marketplace/services.ts` — `services`, same shape
- [`marketplace/slots/index.ts:66`](src/routes/api/marketplace/slots/index.ts:66) — `slots`

```ts
if (!Array.isArray(contacts) || contacts.length === 0) {
  return Response.json({ error: "At least one contact is required" }, { status: 400 });
}
// ... no upper bound
const created = await prisma.businessContact.createMany({ data: contacts.map(/* ... */) });
```

Separately, `POST /api/business` stores `businessName`, `phone`, `address`, `sector`, `keywords`, `description`, `placeId` and `logo` with a type check and no length check ([`business.ts:169`](src/routes/api/business.ts:169)). The schema declares them as unbounded `String?`. Contrast the same file's careful `MAX_USERNAME_LENGTH` on `username`, and the explicit caps in `bookings.ts`, `feedback.ts` and `share.ts` — the ceiling is enforced everywhere it was thought about, and absent here.

Any authenticated owner can therefore write a single multi-megabyte row, or 100k rows in one request, per call. These rows are then read back on the marketplace listing and the company profile, so the cost recurs on every reader. No request body size limit is configured at the Nitro layer either.

**Fix** — cap both dimensions at the edge of each handler:

```ts
const MAX_CONTACTS = 50;
const MAX_FIELD = 2000;

if (!Array.isArray(contacts) || contacts.length === 0 || contacts.length > MAX_CONTACTS) {
  return Response.json(
    { error: `Between 1 and ${MAX_CONTACTS} contacts are required` },
    { status: 400 },
  );
}
```

Given how many endpoints parse bodies by hand, `zod` is already a dependency and would be the durable answer: one schema per route, `.max()` on every string, `.max()` on every array. That also closes the gap where `contacts.map((c: {name: string, ...}) => ...)` asserts a shape TypeScript erases at runtime — today a non-string `name` reaches Prisma and surfaces as a generic 400 from the catch-all.

---

### F-06 — `logo` bypasses the URL validation applied to every other link field

**Severity:** Medium · **Confidence:** Confirmed · **CWE-20** (Improper Input Validation) · [`src/routes/api/business.ts:173`](src/routes/api/business.ts:173)

```ts
// Review links are navigated to on the public review page, so anything
// other than an http(s) URL (e.g. `javascript:`) is stored XSS.
const safeReviewLink = httpUrl(reviewLink);
// ...
const data = {
  // ...
  logo: typeof logo === "string" ? logo : null,   // <- no httpUrl()
```

`reviewLink` and every entry in `reviewLinks` go through `httpUrl()` / `sanitizeReviewLinks()`. `logo` — which is rendered on the public review page, the public-facing company profile, and every marketplace card — gets a bare `typeof` check. It accepts any string: an arbitrary scheme, a `data:` URI of unbounded size, or an off-origin tracking URL that fires on every visitor's page load.

Rated Medium for the privacy and payload-size consequences rather than for script execution: the value lands in `<img src>`, where neither `javascript:` nor `data:text/html` executes. But `httpUrl()` exists precisely for this, is used two lines above, and is missing here.

**Fix:**

```ts
const safeLogo = httpUrl(logo);
if (typeof logo === "string" && logo.trim() && !safeLogo) {
  return Response.json(
    { error: "Logo must be a full http(s) URL" },
    { status: 400 },
  );
}

const data = {
  // ...
  logo: safeLogo,
```

The same applies to `avatarUrl` in `marketplace/contacts.ts` and `imageUrl` in `marketplace/projects.ts`, which are stored unvalidated and rendered the same way. If you intend to support inline `data:` logos, cap the length explicitly and allowlist the image MIME types rather than leaving the field open.

---

### F-07 — No outbound `fetch` sets a timeout

**Severity:** Low · **Confidence:** Confirmed · **CWE-400** · [`google/locations.ts:103`](src/routes/api/google/locations.ts:103), [`google/reviews.ts:43`](src/routes/api/google/reviews.ts:43), [`google-business-rating.ts:24`](src/lib/google-business-rating.ts:24), [`google-tokens.ts:117`](src/lib/google-tokens.ts:117)

`rg "AbortSignal|AbortController"` over `src/` returns nothing. Every call to Google's token, Business Profile and Reviews APIs, and every LangChain call to DeepSeek, runs without a deadline. A hung upstream connection holds the request handler indefinitely.

It compounds in one place. `locationsCache` shares a single in-flight promise across concurrent callers for the same key ([`cache.ts:40`](src/server/cache.ts:40)) — correct for avoiding a thundering herd, but it means one wedged `walkAccounts` wedges every later caller for that user until the connection eventually drops.

`fetchWithRetry` adds a second unbounded wait: `parseInt(retryAfter, 10) * 1000` is fed straight to `setTimeout` with no ceiling ([`locations.ts:107`](src/routes/api/google/locations.ts:107)), so an upstream `Retry-After: 999999` parks the handler for eleven days. Low because the upstream is Google rather than an attacker.

**Fix** — a deadline on every outbound call, and a ceiling on the backoff:

```ts
const response = await fetch(url, { ...options, signal: AbortSignal.timeout(10_000) });
```

```ts
const delay = Math.min(
  retryAfter ? parseInt(retryAfter, 10) * 1000 : baseDelay * 2 ** attempt,
  30_000,
);
```

`AbortSignal.timeout` is available on Node ≥18 and needs no extra dependency. LangChain's `ChatDeepSeek` takes its own `timeout` option — set it in [`agents/model.ts`](src/lib/agents/model.ts).

---

### F-08 — The daily AI token budget can be overshot by a concurrent burst

**Severity:** Low · **Confidence:** Confirmed · [`suggest-review.ts:25`](src/routes/api/ai/suggest-review.ts:25)

`isDailyBudgetExhausted` is the documented backstop for when per-IP limits are evaded, on the one endpoint that is both unauthenticated and spends money. Two properties let it be passed:

- The aggregate is cached for `BUDGET_CACHE_MS = 60_000`, so every request in a 60-second window decides against the same stale total.
- The rows it aggregates are written fire-and-forget *after* the LLM call returns (`void writeLedger(...)`, [`suggest-review.ts:170`](src/routes/api/ai/suggest-review.ts:170)), so spend in flight is invisible to it regardless of the cache.

A burst therefore only has to clear the check once. The magnitude depends on concurrency rather than on the budget, and under F-04 the per-IP limit that would otherwise shape the burst is not a constraint.

Low on its own — this is a cost control, not a security boundary, and the loss is bounded by what DeepSeek will serve in a minute.

**Fix** — reserve before spending rather than accounting after. The cheapest version is an in-process counter incremented at admission and reconciled against the ledger each time the cache refreshes:

```ts
let reservedSinceFetch = 0;      // reset whenever budgetCache is refilled
const ESTIMATED_TOKENS_PER_CALL = 2_000;

// in the refresh branch, after setting budgetCache:
reservedSinceFetch = 0;

return budgetCache.tokens + reservedSinceFetch >= budget;
```

incrementing `reservedSinceFetch += ESTIMATED_TOKENS_PER_CALL` immediately after the check passes. Shortening `BUDGET_CACHE_MS` to ~10s narrows the window further at the cost of one extra aggregate query per 10 seconds. If the deployment ever runs more than one instance, neither this nor `checkRateLimit`'s in-process `Map` holds across processes — the ledger aggregate would need to become the source of truth.

---

### F-09 — ICS text escaping omits carriage return

**Severity:** Low · **Confidence:** Probable · **CWE-93** (CRLF Injection) · [`src/lib/ics.ts:58`](src/lib/ics.ts:58)

```ts
function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");     // \r is not handled
}
```

RFC 5545 separates content lines with CRLF, and `generateIcsInvite` joins on `"\r\n"`. A `\r` in visitor-supplied `guestName`, `guestPhone` or `message` survives escaping intact and lands inside `SUMMARY` / `DESCRIPTION`. A parser that treats a bare CR as a line break would see the remainder as a new iCalendar property — an injected `ATTENDEE`, `URL` or `ORGANIZER` in an invite the business owner's calendar client is about to import.

Probable, not Confirmed: whether a bare CR is a separator is parser-dependent, and I did not test Outlook, Gmail or Apple Calendar against a crafted file. Two further gaps in the same function are unambiguous — `organizer.email` and `attendee.email` are interpolated *without* `escapeText` at [`ics.ts:142`](src/lib/ics.ts:142) and [`ics.ts:147`](src/lib/ics.ts:147), and `attendee.email` carries the visitor-supplied `guestEmail`. The regex in `bookings.ts` (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) does exclude whitespace, so that particular field is constrained today — but the escaping, not the caller, should be what guarantees it.

**Fix** — normalise line endings before escaping and escape the addresses too:

```ts
function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}
```

```ts
lines.push(
  `ORGANIZER;CN=${escapeText(organizer.name)}:mailto:${escapeText(organizer.email)}`,
);
```

---

### F-10 — Authenticated marketplace listing is served with `Cache-Control: public`

**Severity:** Low · **Confidence:** Confirmed · **CWE-525** · [`src/routes/api/marketplace/partners.ts:15`](src/routes/api/marketplace/partners.ts:15)

```ts
return Response.json(payload, {
  headers: {
    "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    "X-Cache": cached ? "HIT" : "MISS",
  },
});
```

`/api/marketplace/partners` is not in `PUBLIC_PREFIXES` — note that the `/api/marketplace/partner` entry does not match it, since the prefix check appends a `/` for non-slash-terminated entries — so middleware answers 401 to anonymous callers. The route then marks its 200 as `public`, which invites any shared cache to store it and hand it to a caller that would otherwise have been refused.

The payload is the same for every user (no favorites or per-tenant fields in `getPartners`), so the exposure is limited to the partner directory: business names, addresses and phone numbers that signing up would reveal anyway. Hence Low. Note also that the middleware's `private, no-store` guard cannot correct this — `onBeforeResponse` writes to `event.response.headers` and only copies *security* headers onto a returned `Response` body ([`middleware.ts:144`](src/middleware.ts:144)), so a route's own `Cache-Control` wins.

**Fix** — `private` keeps the browser-side caching benefit without offering the response to shared caches:

```ts
"Cache-Control": "private, max-age=60, stale-while-revalidate=300",
```

If the directory is genuinely meant to be public, the better change is to add `/api/marketplace/partners` to `PUBLIC_PREFIXES` deliberately, so the header and the auth posture agree.

---

## Positive observations

Worth naming so nobody "simplifies" them later:

- **`src/lib/crypto.ts`** is the best file in the repository. HKDF-derived, purpose-scoped subkeys from one root secret; AES-256-GCM with a per-message IV and a pinned 16-byte auth tag length; `timingSafeEqual` with an explicit length pre-check on every signature comparison; `decrypt` returning `null` rather than throwing so callers cannot accidentally treat tampering as an outage. Every capability token in the app (`oauth-state`, `review-claim`, `meeting-decision`) is built on it correctly.
- **`admin({ adminRoles: [PLATFORM_ADMIN_ROLE] })`** in [`auth.ts:110`](src/lib/auth.ts:110), paired with `isValidRole` excluding `platform_admin` from `ROLE_DEFINITIONS`. Left at better-auth's defaults, a team `"admin"` would have carried platform-admin permissions, reachable by any signup that invites a second account. The comment explains the trap; keep it.
- **Conditional-update claim patterns** used consistently for state transitions — `deleteMany` with a `value` match to consume the impersonation nonce atomically ([`impersonate.ts:66`](src/routes/api/operator/impersonate.ts:66)), `updateMany ... where: { status: "pending" }` then checking `count` in `decideMeeting` and the join-request approval, `update where: { id, businessId }` on every marketplace mutation. Several carry comments recording the bug that motivated them.
- **Raw SQL is parameterised.** Both `$executeRaw` call sites ([`track.ts:68`](src/routes/api/reviews/track.ts:68), [`qr/[id].ts:104`](src/routes/qr/[id].ts:104)) are tagged templates with the JSON key additionally allowlisted against `PLATFORM_SLUGS`. There is no `$queryRawUnsafe` anywhere.

---

## Appendix A — Speculative leads

Plausible, unproven, each with what would settle it.

- **A business owner can rewrite a customer's submitted review.** In `POST /api/reviews/share`, anonymously created rows are stored with `userId: business.userId` ([`share.ts:168`](src/routes/api/reviews/share.ts:168)), so the owner satisfies `isOwner` on the update path and may overwrite `text` and `rating` on a review a customer already submitted, which then renders on the public review page. This may be exactly what the composer flow intends. *Settles it:* a product decision — should a submitted review become immutable once `text` is non-empty?
- **Prompt injection into the review suggester.** `draftText`, `keywords` and `businessName` reach the DeepSeek prompt unescaped from a public endpoint. The output is text returned to the same caller, so I could not construct a consequence beyond wasted tokens and an unhelpful suggestion. *Settles it:* reading `review-drafter.ts` for anything that treats model output as structured (JSON parsed into a DB write, a URL, a command).
- **In-process rate-limit and cache state under horizontal scaling.** `checkRateLimit`, `locationsCache`, `connectedCache`, `budgetCache` and the partners cache are all per-process `Map`s. With N instances every limit is effectively N× and every invalidation reaches one instance. The comment in [`cache.ts:11`](src/server/cache.ts:11) acknowledges this for caching. *Settles it:* the deployment's instance count. At one instance this is correct; above one it needs shared storage.
- **`RESERVED_USERNAMES` guards nothing.** Usernames only ever appear nested under `/company/:username`, `/qr/:id` and API query parameters, so a username colliding with a top-level route name is not reachable. The list is also missing most current routes. *Settles it:* confirming no future route plans to mount a business at the path root.

---

## Appendix B — Coverage

**Reviewed in full** — `src/middleware.ts`; `src/db/prisma.ts`; all of `src/lib/` bearing on authentication, authorization, crypto, URL handling and scheduling (`auth.ts`, `server-auth.ts`, `roles.ts`, `business-context.ts`, `impersonation.ts`, `crypto.ts`, `oauth-state.ts`, `review-claim.ts`, `meeting-decision.ts`, `rate-limit.ts`, `cookies.ts`, `safe-url.ts`, `trusted-origins.ts`, `post-login-redirect.ts`, `invite-redirect.ts`, `slug.ts`, `google-tokens.ts`, `company-profile.ts`, `public-review.ts`, `feedback.ts`, `ics.ts`, `partners-query.ts`); all of `src/server/`; `src/services/email.ts`; and the API routes for operator impersonation, team management, reviews, AI, Google OAuth, marketplace, tasks, bookings, QR and feedback.

**Skimmed** — `src/services/email-templates.ts` (2387 lines; checked the escaping helpers and confirmed `escapeHtml`/`escapeHtmlAttr` are applied at every interpolation, did not read each template); `src/lib/agents/*` (read the pipeline and ledger, skimmed the prompt builders); `src/routes/api/marketplace/services.ts`, `favorites.ts`, `load.ts`, `slots/generate.ts`, `slots/mine.ts`, `team-meetings/*` (verified the session-and-scope pattern via the sweep below, read representative handlers in full).

**Not reviewed** — the ~25k lines of `src/components/**` and `src/routes/(app)/**` UI, beyond grepping every file for `innerHTML` / `eval` / `new Function` / `dangerouslySetInnerHTML`. Solid escapes interpolated text by default and the single `innerHTML` use ([`PageMeta.tsx:83`](src/components/meta/PageMeta.tsx:83)) is JSON-LD with `<` escaped to `<`, which is correct. `prisma/schema.prisma` was consulted for specific columns, not audited for constraints, indexes or cascade behaviour. No infrastructure, Dockerfile or CI config is present in the repository.

**Attacker goals pursued**

| Goal | Outcome |
|---|---|
| Read or write another tenant's business, reviews, tasks, contacts or meetings | **Ruled out** for every API route. A scripted sweep of all 78 handlers classified each by session check and scoping; every apparent gap was read in full and explained (the four unauthenticated ones are deliberate public endpoints; `tasks/[id]` PATCH/DELETE route through the shared `getEditableTask` guard). The marketplace mutation routes match on `where: { id, businessId }` rather than `id` alone, with a comment recording the earlier bug. |
| Escalate to `platform_admin`, or to team admin in someone else's team | **Ruled out.** `isValidRole` rejects `platform_admin`, and `ROLE_DEFINITIONS` is the only source a team route can write from. Role writes are gated on `canManageTeam(ctx)` where `ctx.isOwner` compares `Business.userId` against `User.businessId` by id, so owning a business elsewhere confers nothing inside the team being acted on. `/api/operator/impersonate` refuses a target holding `platform_admin` and re-checks the ban state better-auth would otherwise check only inside its own endpoints. |
| Forge the operator impersonation handoff | **Ruled out** within this repository. HMAC verified before parsing with a length pre-check and `timingSafeEqual`; nonce consumed by a single `deleteMany` whose `value` binds it to the user it was minted for, with `count !== 1` rejected; expiry inside the signed token. The desk application that mints the token is out of scope and I could not read it — the security of this flow rests equally on how it protects `OPERATOR_HANDOFF_SECRET`. |
| Steal or replay Google OAuth tokens | **Ruled out.** Tokens are AES-256-GCM encrypted at rest under a derived key, never leave the server, and are keyed per user. The authorization flow binds `state` to a signed HttpOnly cookie nonce, and the callback requires a session. `refreshAccessToken` deletes stored tokens only on an explicit `invalid_grant`, so a Google 5xx cannot disconnect an owner. |
| Deny service to all tenants from one request | **Path found — F-01 and F-02.** Both reproduced. |

**Baseline tooling run**

- `semgrep --config=p/security-audit` over `src/routes src/lib src/server src/db src/middleware.ts src/services` — 126 files scanned, 0 parse errors, **0 findings**. This is not evidence of security; it says only that no pattern-matchable sink is present, and both High findings are invisible to it.
- `osv-scanner scan source --lockfile=pnpm-lock.yaml` — 755 packages, 3 advisories across 2 packages. Both **downgraded to Info after checking reachability**: `mysql2@3.15.3` (GHSA-3f6p-5ww8-9rcr, GHSA-rgwj-5xj2-c3m3) is an optional driver pulled in by `better-auth`, `db0` and `prisma`, and this app runs PostgreSQL through `@prisma/adapter-pg`; `deepmerge-ts@7.1.5` (GHSA-ggr8-5vv4-36mx) sits under `@prisma/config`, which is Prisma CLI tooling and not in the request path. Neither vulnerable code path is called. Upgrade them on the next routine bump, not as a security action.
- `trufflehog git file://. --only-verified` — 4189 chunks, 4.8 MB of history, **0 verified and 0 unverified secrets**. No `.env` file is tracked; every secret is read from `process.env`.
- Targeted greps for `eval` / `new Function` / `innerHTML` / `$queryRawUnsafe` / `$executeRawUnsafe` / disabled TLS verification / weak hashes / `AbortSignal` — only the results discussed above.
- A scripted classification of all 78 API handlers and all 6 `"use server"` functions by auth guard, used to direct the reading rather than as a finding source.

**Reproductions run** — F-01 against the unmodified `src/lib/ics.ts` under `node --max-old-space-size=300` (benign case succeeded, attacker case aborted with a V8 fatal OOM after ~7.7M iterations); F-02 against a minimal mirror of the `void sendEmail(...)` call shape on Node v26.8.2 (process exited 1); F-03 by extracting `isPublicPath` and evaluating it over a path table. All local, none against any running service.

**Deep analysis not run** — no interprocedural taint query (CodeQL/Joern), no fuzzing, no property tests, no sanitizer build. None was needed to reach the two High findings, both of which came from reading; a CodeQL authorization query over the 78 handlers would have been the natural next step had the manual sweep found gaps, and remains the right tool if handlers are added faster than they can be reviewed by hand.

**Tooling unavailable or not used** — no tool was requested and declined. `npm audit` was skipped in favour of `osv-scanner` against the pnpm lockfile (the project uses pnpm and has no `package-lock.json`). `tsc --noEmit` and `biome lint` were not run; both are project scripts and would likely surface the loose `body` destructuring noted in F-05 faster than reading does.

**What this audit could not assess**

- **Deployment configuration**, which decides F-04 outright and shapes several others: the proxy topology and whether inbound `X-Forwarded-For` is sanitised, the instance count (see Appendix A), whether `TOKEN_ENCRYPTION_KEY` is set or the `COOKIE_SECRET` fallback is in use, and whether a process supervisor restarts the app after the F-02 crash.
- **The operator desk application**, which mints impersonation tokens and holds `OPERATOR_HANDOFF_SECRET`. This repository's half of that protocol is sound; the other half is unread.
- **Database-level constraints** — column length limits, row-level security, and cascade behaviour on delete. F-05 assumes the schema's unbounded `String?` columns are genuinely unbounded in PostgreSQL, which matches Prisma's default mapping to `text`.
- **Runtime behaviour under load** — the rate limiter's `MAX_ENTRIES` eviction, the caches' `max` bounds, and Prisma connection-pool exhaustion were reasoned about from the code, not measured.
- **Email rendering** across real clients, which bears on F-09.
