# Flonion

[![Last commit](https://img.shields.io/github/last-commit/Digital-Covet/flonion)](https://github.com/Digital-Covet/flonion/commits/main)
[![Issues](https://img.shields.io/github/issues/Digital-Covet/flonion)](https://github.com/Digital-Covet/flonion/issues)
[![Node](https://img.shields.io/badge/node-%3E%3D24-brightgreen)](https://nodejs.org/en/download)
[![SolidStart](https://img.shields.io/badge/SolidStart-2.0-blue)](https://start.solidjs.com)
[![PostgreSQL + Prisma](https://img.shields.io/badge/PostgreSQL-Prisma-336791)](https://www.prisma.io)
[![Biome](https://img.shields.io/badge/lint-Biome-60a5fa)](https://biomejs.dev)

AI-powered review collection and local SEO optimization platform for businesses. Collect customer reviews via shareable QR-coded links, draft AI-enhanced replies, and optimize your online presence -- all from one dashboard.

## Overview

Flonion is a full-stack business reputation workspace: a SolidStart tenant app where each business gets public review/booking pages (`/company/:username/...`), a QR pipeline for in-store review capture, DeepSeek-powered review drafting and reply assistance with per-call usage metering, Google Business Profile sync, a partner marketplace with meeting scheduling, and team/task management. A separate operator console in `app/` (React Router, same Postgres database) handles moderation, audit logging, and user impersonation. See [`app/README.md`](app/README.md) for the console setup.

## Features

### Authentication & Account

- **Email/Password Auth** -- Secure sign-up and sign-in with email verification required before first login
- **Two-Factor Authentication** -- TOTP-based 2FA via authenticator apps with backup codes
- **Password Reset** -- Email-based password recovery flow
- **Email Change** -- Update your email with re-verification

### Review Collection & Management

- **Review Composer** -- Create review requests with pre-selected rating and text
- **AI Review Suggestions** -- Generate 3 tone-varied review drafts (Simple, Professional, Casual) from a rough draft or from scratch
- **QR Code Generation** -- Generate shareable QR codes for each review request
- **Shared Review Pages** -- Public-facing `/company/:username/review` pages where visitors can rate, write, and submit reviews
- **Multi-Platform Redirects** -- After submitting, visitors are redirected to configured review platforms (Google, Yelp, Facebook, TripAdvisor, JustDial, or custom links)
- **Review Inbox** -- View and manage all reviews in one place
- **QR Scan Counting** -- `/qr/:id` resolves a business by username or ID, counts the scan, and redirects to its review page
- **Review Claim Tokens** -- Signed capability tokens let an anonymous visitor finish only the review row they created

### AI Features

- **Sentiment Analysis** -- Analyzes review text for sentiment, score, key topics, and customer intent using DeepSeek
- **Review Reply Drafter** -- Generates professional, friendly, or formal replies based on sentiment analysis
- **Review Suggestion Engine** -- Produces 3 distinct review variations with different tones, weaving in business keywords
- **Rate Limiting** -- Per-review and per-IP rate limits on AI endpoints with client-side cooldown

### SEO & Marketing

- **Profile Optimization Scoring** -- Weighted scoring across business profile completeness categories
- **Keyword Recommendations** -- Search volume and relevance-based keyword suggestions
- **Competitor Analysis** -- Rating, review count, profile completeness, and distance comparisons
- **Photo Status Tracking** -- Category breakdown with actionable recommendations
- **Campaign Analytics** -- Track page visits, review submissions, QR scans, platform redirects, and AI copy usage per shared review
- **Action Items** -- Prioritized tasks (photos, descriptions, attributes, phone consistency, review responses, hours)

### Team & Roles

- **Team Members** -- View, re-role, and remove members of a business from `/settings/team`
- **Role Definitions** -- Six roles (Admin, Member, Designer, Developer, Manager, Marketing); team management is limited to the owner and admins
- **Email Invitations** -- Invite by email with a random 64-character token, expiry, and an `/accept-invite` landing page
- **Join Requests** -- Users without a team can search for a business and request to join; owners and admins approve or reject from a review queue
- **Empty Business Discard** -- A user who owns an untouched business can consent to delete it in order to accept an invite or join request
- **Business Context** -- Ownership and membership are resolved separately so owning a business elsewhere confers no rights inside a team

### Marketplace

- **Partner Directory** -- Browse businesses with keyword search, category filter, rating range, sorting, and pagination
- **Category Matching** -- Businesses are mapped to 10 fixed marketplace categories by sector and keyword matching
- **Favorites** -- Save partners to a per-user favorites list
- **Company Profiles** -- Signed-in `/company/:companyname` pages with hero, stats, services, projects, and contacts
- **Business Username** -- Claim a unique URL handle with reserved-word and availability checks
- **Portfolio Management** -- Owners add, edit, reorder, and delete their services, projects, and contact rows

### Scheduling & Meetings

- **Schedule Settings** -- Working days, working hours, bookable window, slot duration, and timezone per business
- **Slot Generation** -- Generate bookable availability slots across a date range from the schedule settings
- **Public Booking Page** -- Visitors book a slot at `/company/:username/bookings` as a guest or signed-in user
- **Meeting Scheduler** -- Weekly calendar, upcoming meetings, bookable windows, and load overview at `/collaborations/meeting-schedular`
- **Meeting Classification** -- Requests are labeled incoming or outgoing and categorized as team or partner
- **Signed Email Decisions** -- Accept and reject links in notification emails carry an HMAC signature so owners can decide without signing in
- **Google Meet Links** -- Creates a Meet space for accepted meetings using the owner's Google grant
- **Calendar Invites** -- RFC 5545 iCalendar attachments on meeting confirmation emails

### Tasks & Team Meetings

- **Task Board** -- Kanban columns with priority, due date, assignee, and drag-to-reorder positions
- **Assignee Permissions** -- The owner and admins manage any task; members may only edit tasks assigned to them
- **Daily Workload** -- Per-employee and whole-team views of task load
- **Team Meetings** -- Schedule internal meetings with date, time, and location, optionally with a Meet link

### Onboarding & Settings

- **Onboarding Wizard** -- Four steps when creating a business: Business Basics, Review Platforms, Review Settings, Invite Team
- **Onboarding Branches** -- Users arriving with an invite, or choosing to join an existing team, skip the create wizard
- **Business Profile Settings** -- Name, phone, address, sector, keywords, logo upload
- **Google Business Profile Integration** -- OAuth 2.0 connection with automatic token refresh and location selection
- **Multi-Platform Review Links** -- Configure links for Google, Yelp, Facebook, TripAdvisor, JustDial, and custom platforms
- **Google Connection Status** -- Connection state is read from the stored grant, with an explicit disconnect flow
- **Cached Google Rating** -- Average rating and review count are pulled from the Business Profile API and stored on the business
- **Pricing Page** -- `/pricing` page with plan comparison table and FAQ

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | SolidJS + SolidStart |
| Build | Vite 8 + Nitro |
| Styling | Tailwind CSS v4 |
| UI Components | Ark UI (Solid), Lucide Icons |
| Database | PostgreSQL via Prisma ORM |
| Database Driver | node-postgres (`pg`) through `@prisma/adapter-pg` |
| Auth | better-auth (email/password, 2FA, OTP, email verification) |
| AI/LLM | LangChain + DeepSeek |
| Email | ZeptoMail (Zoho) |
| QR Codes | qrcode |
| Validation | Zod v4 |
| Video Calls | Google Meet REST API |
| Calendar Invites | Hand-rolled RFC 5545 iCalendar generator |
| Date Handling | `@internationalized/date` |
| Lint & Format | Biome |
| Image Optimization | sharp + vite-plugin-image-optimizer |
| Fonts | Jost, Rubik |
| Package Manager | pnpm |
| Operator Console (`app/`) | React 19 + React Router v7 (same Postgres database) |

## Prerequisites

- Node.js >= 24 (per `engines` in the root `package.json`; the `app/` desk console lists >= 20)
- pnpm
- PostgreSQL database (both apps share one database; migrations run from the repo root)
- A [DeepSeek](https://platform.deepseek.com/) API key
- A [Google Cloud](https://console.cloud.google.com/) project with the **Google Business Profile API** enabled (optional -- for Google Business integration)
- The **Google Meet API** enabled on the same project, with the `meetings.space.created` scope (optional -- for Meet links on meetings)
- A [ZeptoMail](https://www.zoho.com/zeptomail/) account (for transactional emails)

## Environment Setup

There is no `.env.example` at the repo root (only `app/.env.example` for the
operator console), so create `.env` manually:

```bash
touch .env
```

Fill in the required variables:

| Variable | Description | Where to get it |
|---|---|---|
| `DATABASE_URL` | Pooled PostgreSQL connection string used by the app at runtime | Your PostgreSQL host (e.g. `postgresql://user:pass@localhost:5432/flonion`) |
| `DATABASE_URL_UNPOOLED` | Direct (non-pooled) connection string used by `prisma.config.ts` for migrations | Same host, without the pooler |
| `DEEPSEEK_API_KEY` | API key for DeepSeek LLM access | [DeepSeek Platform](https://platform.deepseek.com/) |
| `AI_MODEL_ID` | Override for the DeepSeek model id (default: `deepseek-v4-flash`) | Optional -- see pricing in `src/lib/agents/model.ts` |
| `BETTER_AUTH_SECRET` | Secret key for session signing | Generate a random string (e.g. `openssl rand -hex 32`) |
| `TOKEN_ENCRYPTION_KEY` | AES-256-GCM key for encrypting Google tokens at rest | Generate a random 64-char hex string |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID | [Google Cloud Console > Credentials](https://console.cloud.google.com/apis/credentials) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret | Same page as above |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL (default: `http://localhost:3000/api/google/callback`) | Must match the redirect URI in your OAuth credentials |
| `ZEPTOMAIL_URL` | ZeptoMail API endpoint | [ZeptoMail Dashboard](https://www.zoho.com/zeptomail/) |
| `ZEPTOMAIL_TOKEN` | ZeptoMail API token | Same dashboard |
| `ZEPTOMAIL_SENDER_ADDRESS` | Sender email address for transactional emails | Must be a verified sender in ZeptoMail |
| `APP_URL` | Public app URL (e.g. `http://localhost:3000`) | Used for trusted origins and email links |
| `BETTER_AUTH_URL` | Base URL used to build invite, join-request, and meeting action links | Defaults to `http://localhost:3000` |
| `VITE_APP_URL` | Client-visible app URL used for copied links and trusted origins | Defaults to `http://localhost:3000` |
| `COOKIE_SECRET` | Legacy fallback for `TOKEN_ENCRYPTION_KEY` | Optional -- only for deployments predating `TOKEN_ENCRYPTION_KEY` |
| `EMAIL_LOGO_URL` | Publicly reachable PNG used as the logo in transactional emails | Optional -- any public asset URL |
| `OPERATOR_HANDOFF_SECRET` | HMAC secret the desk console uses to sign impersonation tokens (>= 32 chars) | Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`; required only if you run the `app/` console |
| `DESK_APP_URL` | Where `GET /api/operator/stop-impersonation` redirects (default: `http://localhost:5174`) | URL of your running desk console |
| `NODE_ENV` | `development` or `production` | Controls cookie security and image optimization |

## Installation

```bash
pnpm install
pnpm exec prisma migrate dev
```

`prisma.config.ts` reads `DATABASE_URL_UNPOOLED` for migrations; the runtime
client in `src/db/prisma.ts` uses `DATABASE_URL`.

## Development

```bash
pnpm dev
```

The app will be available at `http://localhost:3000`.

```bash
pnpm typecheck   # tsc --noEmit
pnpm lint        # biome lint --write
pnpm format      # biome format --write
pnpm check       # biome check --write
```

New users are redirected to `/onboarding` before accessing the dashboard. There they either run the four-step setup wizard, accept a pending team invitation, or request to join an existing business.

## Build & Deploy

```bash
# Generate Prisma client and build for production
pnpm build

# Start the production server
pnpm start
```

## Operator Console (`app/`)

`app/` is a separate React Router v7 app (`flonion-desk`) that shares the same
Postgres database. It provides user/business/review moderation, AI-usage and
audit-log inspection, the support inbox, and HMAC-signed user impersonation.
Full setup lives in [`app/README.md`](app/README.md); the short version:

```bash
cd app
cp .env.example .env   # set DATABASE_URL, DESK_OPERATOR_TOKENS, TENANT_APP_URL, OPERATOR_HANDOFF_SECRET
pnpm install
pnpm dev               # serves on http://localhost:5174 per app/package.json
```

Impersonation flow: the desk mints a one-time HMAC-signed token, redirects to
`GET /api/operator/impersonate?token=...&sig=...` on the tenant app (verified
against `OPERATOR_HANDOFF_SECRET`, single-use nonce stored in `Verification`),
and the tenant creates an impersonated session (`Session.impersonatedBy`).
`GET /api/operator/stop-impersonation` destroys it and redirects to
`DESK_APP_URL`. The tenant-side API is documented below; every console write
lands in `AuditLog` and AI spend in `AiUsage`.

## Project Structure

```
src/
├── app.tsx                              # Root app: SettingsProvider + Router + MetaProvider
├── app.css                              # Global styles
├── middleware.ts                         # Auth guard, CSRF protection, onboarding redirect
├── entry-client.tsx                     # Client-side hydration entry
├── entry-server.tsx                     # Server-side rendering entry
│
├── assets/                              # Logo components (logomark, wordmark, combination marks)
│
├── components/                        # auth, bookings, dashboard, landing, layout, marketplace
│                                       # (incl. meeting-schedular, task-workload, portfolio),
│                                       # onboarding, review, seo, ui primitives
│
├── constants/                           # Navigation items, branding, landing page data, marketplace categories
│
├── db/
│   └── prisma.ts                        # Prisma client singleton
│
├── features/                            # Page-level features: account, dashboard, feedback, marketing,
│                                       # onboarding, reviews, seo, settings, team
│
├── hooks/                               # useReducedMotion (prefers-reduced-motion)
│
├── lib/
│   ├── agents/                          # sentiment-analyzer, review-drafter, pipeline, model (DeepSeek)
│   ├── auth.ts / auth-client.ts         # better-auth server + client config
│   ├── crypto.ts / google-tokens.ts     # HMAC/AES helpers, encrypted Google token storage
│   ├── ics.ts / google-meet.ts          # iCalendar invites, Meet space creation
│   └── ...                              # business-context, rate-limit, review-claim, roles,
│                                       # trusted-origins, oauth-state, partners-query, etc.
│
├── routes/
│   ├── index.tsx / pricing.tsx / accept-invite.tsx   # Landing, pricing, invite landing
│   ├── (app)/                       # Authed layout: dashboard, account, feedback, settings (+team),
│   │                               # reviews/new, reviews/inbox, marketing/seo, marketing/analytics,
│   │                               # marketplace, marketplace/projects, collaborations/meeting-schedular,
│   │                               # company/[companyname] profile
│   ├── (auth)/                      # login, signup, verify-email, forgot/reset-password, 2fa
│   ├── (onboarding)/onboarding.tsx  # /onboarding wizard + invite/join branches
│   ├── review/[id].ts / qr/[id].ts  # Canonical review redirect / QR scan-count redirect
│   ├── company/[username]/review/ + /bookings/      # Public review + booking pages
│   └── api/                         # [...auth], business, feedback, google/*, company/*,
│                                   # marketplace/*, team/*, tasks, team-meetings, meet/create,
│                                   # reviews/*, ai/*, operator/* (see API Routes below)
│
├── services/                        # ZeptoMail sender + HTML/text email templates
├── stores/                          # Settings + task/team-meeting context providers
├── types/                           # App-wide, Google, landing, marketplace, auth-ui types
│
├── app/                             # Operator console (flonion-desk, React Router) -- see app/README.md
├── prisma/                          # schema.prisma + migrations
└── scripts/                         # backfill-review-business-id.sql, cleanup-shared-reviews.ts
```

## API Routes

### Authentication

All auth routes are handled by the better-auth catch-all at `/api/auth/*`. This includes sign-up, sign-in, sign-out, session management, email verification, password reset, 2FA enrollment/verification, and OTP flows.

### Business Profile

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/business` | Yes | Fetch the authenticated user's business profile |
| `POST` | `/api/business` | Yes | Create or update business profile; marks onboarding as completed |
| `PATCH` | `/api/business` | Yes | Check whether a business username is available and valid |

### Google Business Profile Integration

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/google/auth` | Yes | Redirects to Google OAuth consent screen |
| `GET` | `/api/google/callback` | Yes | Handles OAuth callback, exchanges code for tokens, stores encrypted |
| `GET` | `/api/google/locations` | Yes | Returns all Google Business accounts and locations |
| `GET` | `/api/google/reviews` | Yes | Returns reviews for a specific account/location (paginated) |
| `GET` | `/api/google/status` | Yes | Reports whether a live Google grant is stored for this user |
| `POST` | `/api/google/disconnect` | Yes | Deletes the stored Google grant for this user |
| `DELETE` | `/api/google/disconnect` | Yes | Same as `POST`, for clients that prefer the verb |

### Review Sharing & Analytics

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/reviews/share?id=...` | No | Fetch a shared review by ID (includes business info) |
| `POST` | `/api/reviews/share` | Conditional | Create or update a shared review; returns canonical URL |
| `POST` | `/api/reviews/track` | No | Track analytics events (visit, review, redirect, ai_copy) |
| `GET` | `/api/reviews/analytics` | Yes | Aggregated analytics across all shared reviews |

### AI Features

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/ai/draft-reply` | Yes | Generate an AI-drafted reply to a customer review |
| `POST` | `/api/ai/suggest-review` | No | Generate 3 AI-enhanced review suggestions (rate-limited) |

### POST `/api/ai/draft-reply`

```json
{
  "comment": "Great service, but the wait was a bit long.",
  "starRating": 4,
  "reviewerName": "Jane Doe",
  "tone": "professional"
}
```

Returns: `{ sentiment, draftReply }`

### POST `/api/ai/suggest-review`

```json
{
  "draftText": "Good food but slow service",
  "starRating": 3,
  "keywords": "restaurant, food, service",
  "businessName": "Swaad Restaurant"
}
```

Returns: `{ sentiment, suggestedReviews: [simple, professional, casual] }`

### Marketplace

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/marketplace/partners` | Yes | Partner directory with search, category, rating, sort, and paging (cached 60s) |
| `GET` | `/api/marketplace/partner?username=...` | No | Single company profile by username or ID |
| `GET` | `/api/marketplace/favorites` | Yes | Business IDs the caller has favorited |
| `POST` | `/api/marketplace/favorites` | Yes | Toggle a partner in the caller's favorites |
| `GET` | `/api/marketplace/services` | Yes | List the caller's portfolio services |
| `POST` | `/api/marketplace/services` | Yes | Add one or more portfolio services |
| `PATCH` | `/api/marketplace/services` | Yes | Update or reorder a portfolio service |
| `DELETE` | `/api/marketplace/services` | Yes | Delete a portfolio service |
| `GET` | `/api/marketplace/projects` | Yes | List the caller's portfolio projects |
| `POST` | `/api/marketplace/projects` | Yes | Add one or more portfolio projects |
| `PATCH` | `/api/marketplace/projects` | Yes | Update or reorder a portfolio project |
| `DELETE` | `/api/marketplace/projects` | Yes | Delete a portfolio project |
| `GET` | `/api/marketplace/contacts` | Yes | List the caller's portfolio contacts |
| `POST` | `/api/marketplace/contacts` | Yes | Add one or more portfolio contacts |
| `PATCH` | `/api/marketplace/contacts` | Yes | Update or reorder a portfolio contact |
| `DELETE` | `/api/marketplace/contacts` | Yes | Delete a portfolio contact |

### Scheduling & Meetings

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/marketplace/schedule-settings` | Yes | Working days, hours, bookable window, slot duration, timezone |
| `PUT` | `/api/marketplace/schedule-settings` | Yes | Update schedule settings |
| `GET` | `/api/marketplace/slots?businessId=...` | Yes | Availability slots for a business, optionally for one date |
| `POST` | `/api/marketplace/slots` | Yes | Create a single availability slot |
| `POST` | `/api/marketplace/slots/generate` | Yes | Generate slots across a date range (max 90 days) from schedule settings |
| `GET` | `/api/marketplace/slots/mine` | Yes | Availability slots for the caller's own business |
| `GET` | `/api/marketplace/meetings` | Yes | Meeting requests, filterable by direction and team/partner category |
| `POST` | `/api/marketplace/meetings` | Yes | Request a meeting in another business's slot |
| `GET` | `/api/marketplace/meetings/:id?action=accept\|reject&sig=...` | Signed link or session | Accept or reject a meeting; sends confirmation emails with an ICS attachment |
| `PATCH` | `/api/marketplace/meetings/:id` | Yes | Update a meeting owned by the caller's business |
| `GET` | `/api/marketplace/load` | Yes | Weekly workload overview for the caller's business |
| `GET` | `/api/meet/create` | Yes | Create a Google Meet space using the caller's Google grant |

### Public Company Pages

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/company/:username/schedule` | No | Public availability for a booking page (max 30-day range) |
| `POST` | `/api/company/:username/bookings` | No | Submit a guest booking request; emails the owner signed accept/reject links |

### Team & Roles

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/team/members` | Yes | List members of the caller's business |
| `PATCH` | `/api/team/members/:id` | Yes (owner/admin) | Change a member's role |
| `DELETE` | `/api/team/members/:id` | Yes (owner/admin) | Remove a member from the business |
| `POST` | `/api/team/invite` | Yes (owner/admin) | Send an email invitation with a random token and expiry (rate-limited) |
| `GET` | `/api/team/invitations` | Yes (owner/admin) | List pending invitations |
| `DELETE` | `/api/team/invitations/:id` | Yes (owner/admin) | Cancel a pending invitation |
| `GET` | `/api/team/check-invite?token=...` | Yes | Inspect an invitation token before accepting |
| `POST` | `/api/team/accept-invite` | Yes | Accept an invitation, optionally discarding an empty owned business |
| `POST` | `/api/team/decline-invite` | Yes | Decline an invitation |
| `GET` | `/api/team/find-business` | Yes | Look up a business to request to join (rate-limited) |
| `POST` | `/api/team/join-request` | Yes | Submit a join request (rate-limited per user and per IP) |
| `GET` | `/api/team/join-request` | Yes | Read the caller's own pending join request |
| `DELETE` | `/api/team/join-request` | Yes | Withdraw the caller's pending join request |
| `GET` | `/api/team/join-requests` | Yes (owner/admin) | Review queue of join requests for the business |
| `PATCH` | `/api/team/join-requests/:id` | Yes (owner/admin) | Approve or reject a join request and email the requester |

### Tasks & Team Meetings

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/tasks` | Yes | Tasks for the caller's business |
| `POST` | `/api/tasks` | Yes | Create a task with assignee, priority, and due date |
| `GET` | `/api/tasks/:id` | Yes | Fetch a single task |
| `PATCH` | `/api/tasks/:id` | Yes | Update a task; members may only edit tasks assigned to them |
| `DELETE` | `/api/tasks/:id` | Yes | Delete a task, subject to the same assignee rule |
| `PATCH` | `/api/tasks/reorder` | Yes (owner/admin) | Persist column and position after a drag |
| `GET` | `/api/team-meetings` | Yes | Internal meetings for the caller's business |
| `POST` | `/api/team-meetings` | Yes | Create an internal meeting, optionally with a Meet link |
| `GET` | `/api/team-meetings/:id` | Yes | Fetch a single internal meeting |
| `PATCH` | `/api/team-meetings/:id` | Yes | Update an internal meeting |
| `DELETE` | `/api/team-meetings/:id` | Yes | Delete an internal meeting |

### Feedback

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/feedback` | Yes | Submit user feedback (name, email, category, rating, message) |

### Operator (desk console handoff)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/operator/impersonate?token=...&sig=...` | HMAC (`OPERATOR_HANDOFF_SECRET`) | Validate the one-time desk token and create an impersonated session, then redirect to `/dashboard` |
| `GET` | `/api/operator/stop-impersonation` | Yes (impersonated session) | Destroy the impersonated session and redirect to `DESK_APP_URL` |

## Authentication

Flonion uses [better-auth](https://www.better-auth.com/) for authentication with the following features:

- **Email + Password** -- Standard sign-up/sign-in with required email verification
- **Two-Factor Auth** -- TOTP-based 2FA with authenticator apps; includes backup codes and lockout protection
- **Email OTP** -- One-time passwords for sign-in, email verification, and password reset flows
- **Session Management** -- Server-side sessions with IP and user agent tracking
- **Onboarding Gate** -- New users are redirected to `/onboarding` until business profile setup is complete

Emails (verification, password reset, OTP, 2FA codes) are delivered via ZeptoMail.

## Database

PostgreSQL via Prisma ORM. Run migrations with:

```bash
pnpm exec prisma migrate dev
```

### Schema Overview

| Model | Purpose |
|---|---|
| `User` | User accounts with email verification, 2FA flag, onboarding status |
| `Session` | Auth sessions with IP and user agent tracking |
| `Account` | OAuth provider accounts linked to users |
| `Verification` | Email verification and OTP tokens |
| `TwoFactor` | 2FA secrets, backup codes, lockout tracking |
| `Business` | Business profiles (name, username, phone, address, sector, keywords, logo, description, review links, cached Google rating, QR scan count, schedule settings) |
| `GoogleToken` | Encrypted Google OAuth tokens per user (AES-256-GCM) |
| `SharedReview` | Shared review requests with text, rating, keywords (`status`: visible/hidden/flagged for console moderation) |
| `ReviewAnalytics` | Analytics per shared review (visits, reviews, QR scans, redirects, AI copies) |
| `Feedback` | User feedback submissions (triage `status`, assignee, operator note for the console inbox) |
| `AvailabilitySlot` | Bookable time slots per business, with booked state and optional label |
| `MeetingRequest` | Meeting bookings against a slot, from a member or a guest, with status and Meet link |
| `Task` | Kanban tasks with column, priority, due date, position, and assignee |
| `TeamMeeting` | Internal team meetings with date, time, location, and optional Meet link |
| `Invitation` | Email team invitations with token, role, status, and expiry |
| `JoinRequest` | Requests to join a business, with a pending-unique constraint and approval audit trail |
| `Service` | Ordered portfolio services shown on a company profile |
| `Project` | Ordered portfolio project images shown on a company profile |
| `BusinessContact` | Ordered contact rows shown on a company profile |
| `FavoritePartner` | Marketplace partners a user has saved |
| `AiUsage` | One row per LLM call (endpoint, stage, model, token counts, cost, latency) -- no user FK so deleting a user keeps the spend ledger |
| `AuditLog` | Operator-console audit trail (operator id, action, entity, before/after diff, IP) |

## Security

- **AES-256-GCM Encryption** -- Google OAuth tokens are encrypted at rest in the database
- **HMAC-SHA256 Signing** -- OAuth state cookies are signed with constant-time comparison
- **CSRF Protection** -- Origin header validation on all state-changing API requests
- **Trusted Origins** -- Allowlisted origins configurable via environment variables
- **Secure Cookies** -- HttpOnly, SameSite=Lax, Secure in production
- **Rate Limiting** -- In-memory rate limiting on AI, tracking, QR scan, invite, join-request, and business-lookup endpoints
- **Security Headers** -- `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and HSTS in production
- **Report-Only CSP** -- A Content Security Policy is shipped in report-only mode while inline hydration scripts are replaced with nonces
- **Signed Meeting Links** -- Accept and reject links are HMAC-signed; an invalid signature falls back to session ownership checks rather than passing
- **Review Claim Tokens** -- Anonymous review rows are writable only by the caller holding the signed 24-hour claim token that created them
- **Business-Scoped Mutations** -- Marketplace, task, and team writes are scoped to the caller's own business
- **Role-Based Access** -- Team, invitation, join-request, and task reordering writes require the business owner or an admin
- **Email Verification Required** -- Users must verify email before accessing the app
- **Onboarding Gate** -- Unauthenticated users and incomplete profiles are redirected appropriately
- **Impersonation Handoff** -- Desk tokens are HMAC-signed, single-use (nonce in `Verification`, 60s TTL), and create sessions flagged with `Session.impersonatedBy`
