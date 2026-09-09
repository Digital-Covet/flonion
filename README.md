# Flonion

AI-powered review collection and local SEO optimization platform for businesses. Collect customer reviews via shareable QR-coded links, draft AI-enhanced replies, and optimize your online presence -- all from one dashboard.

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

## Prerequisites

- Node.js >= 24
- pnpm
- PostgreSQL database
- A [DeepSeek](https://platform.deepseek.com/) API key
- A [Google Cloud](https://console.cloud.google.com/) project with the **Google Business Profile API** enabled (optional -- for Google Business integration)
- The **Google Meet API** enabled on the same project, with the `meetings.space.created` scope (optional -- for Meet links on meetings)
- A [ZeptoMail](https://www.zoho.com/zeptomail/) account (for transactional emails)

## Environment Setup

1. Copy the example env file:

```bash
cp .env.example .env
```

2. Fill in the required variables:

| Variable | Description | Where to get it |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Your PostgreSQL host (e.g. `postgresql://user:pass@localhost:5432/flonion`) |
| `DEEPSEEK_API_KEY` | API key for DeepSeek LLM access | [DeepSeek Platform](https://platform.deepseek.com/) |
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
| `NODE_ENV` | `development` or `production` | Controls cookie security and image optimization |

## Installation

```bash
pnpm install
```

## Development

```bash
pnpm dev
```

The app will be available at `http://localhost:3000`.

New users are redirected to `/onboarding` before accessing the dashboard. There they either run the four-step setup wizard, accept a pending team invitation, or request to join an existing business.

## Build & Deploy

```bash
# Generate Prisma client and build for production
pnpm build

# Start the production server
pnpm start
```

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
├── components/
│   ├── auth/                            # Auth UI: sign-in, sign-up, forgot/reset password, 2FA, verification
│   ├── company/bookings/                # BookingForm, PublicScheduleCalendar, PublicScheduleHeader
│   ├── dashboard/                       # QuickActions, RecentActivity
│   ├── landing/                         # Hero, Features, Testimonials, FAQ, CTA, Navbar, Footer, MobileMenu
│   ├── layout/                          # AppSidebar, MobileNavigation
│   ├── marketplace/                     # PartnerCard
│   │   ├── collaborations/
│   │   │   ├── meeting-schedular/       # Weekly calendar, bookable windows, load overview, meeting modals
│   │   │   └── task-workload/           # Task board, columns, cards, dialog, daily workload, meeting cards
│   │   └── portfolio/                   # Company profile primitives: hero, service/project tiles, scheduler, stats
│   ├── onboarding/                      # BasicsStep, PlatformsStep, ReviewStep, InviteTeamStep, ChooseStartStep, JoinTeamStep, JoinPendingStep, ProgressStepper, LogoUpload
│   ├── review/                          # Review composer, QR display, metrics, charts, suggestion cards
│   ├── seo/                             # ActionItems, KeywordRecommendations, CompetitorCard, PhotoStatus, ProgressTracker
│   └── ui/                              # Shared primitives: IconButton, UserAvatar, Progress
│
├── constants/                           # Navigation items, branding, landing page data, marketplace categories
│
├── db/
│   └── prisma.ts                        # Prisma client singleton
│
├── features/
│   ├── account/                         # AccountPage + components (2FA, change email/password, backup codes)
│   ├── dashboard/                       # DashboardPage with metrics, charts, quick actions
│   ├── feedback/                        # FeedbackPage for user feedback submission
│   ├── marketing/                       # AnalyticsPage for campaign tracking
│   ├── onboarding/                      # OnboardingPage (create wizard plus invite and join branches)
│   ├── reviews/                         # Mock data and type definitions for reviews
│   ├── seo/                             # SeoOptimizerPage with business info, keywords, competitors
│   ├── settings/                        # SettingsPage + components (form fields, toggles, Google Business/Meet cards)
│   └── team/                            # TeamPage (members, invitations, join-request review)
│
├── hooks/
│   └── useReducedMotion.ts              # Respects prefers-reduced-motion
│
├── lib/
│   ├── agents/
│   │   ├── pipeline.ts                  # Orchestrates sentiment + reply/suggestion pipelines
│   │   ├── sentiment-analyzer.ts        # LLM-based sentiment analysis agent
│   │   └── review-drafter.ts            # LLM-based reply drafting and review suggestion agents
│   ├── auth.ts                          # better-auth server config (email+password, 2FA, OTP, verification)
│   ├── auth-client.ts                   # better-auth client config
│   ├── auth-errors.ts                   # better-auth error codes and message extraction
│   ├── business-context.ts              # Resolves a user's active business, role, and ownership
│   ├── cn.ts                            # ClassName utility
│   ├── company-profile.ts               # Public company profile reads (SSR-safe)
│   ├── company-schedule.ts              # Public booking schedule reads (SSR-safe)
│   ├── constants.ts                     # App domain, company name, support email
│   ├── cookies.ts                       # Cookie parsing and serialization
│   ├── crypto.ts                        # HMAC signing, AES-256-GCM encrypt/decrypt, random tokens
│   ├── empty-business.ts                # Inspects whether an owned business can be discarded
│   ├── google-business-rating.ts        # Fetches cached rating and review count from the Business Profile API
│   ├── google-meet.ts                   # Creates Google Meet spaces via the Meet REST API
│   ├── google-tokens.ts                 # Google OAuth token storage/refresh (encrypted at rest)
│   ├── ics.ts                           # RFC 5545 iCalendar invite generator
│   ├── invite-redirect.ts               # Carries an invite token across the sign-up funnel
│   ├── oauth-state.ts                   # Google OAuth CSRF state cookie management
│   ├── partners-query.ts                # Marketplace partner search, filtering, and paging
│   ├── rate-limit.ts                    # In-memory rate limiter
│   ├── review-claim.ts                  # Signed capability tokens for anonymous review submission
│   ├── roles.ts                         # Team role definitions and validation
│   ├── server-auth.ts                   # Server-side session extraction from headers
│   ├── slug.ts                          # URL slug generator
│   └── trusted-origins.ts               # Trusted origins for CSRF protection
│
├── routes/
│   ├── index.tsx                        # Landing page (/)
│   ├── pricing.tsx                      # /pricing (plans, comparison table, FAQ)
│   ├── accept-invite.tsx                # /accept-invite (team invitation landing)
│   ├── (app).tsx                        # App layout (sidebar + header)
│   ├── (app)/
│   │   ├── dashboard.tsx                # /dashboard
│   │   ├── account.tsx                  # /account
│   │   ├── feedback.tsx                 # /feedback
│   │   ├── settings/
│   │   │   ├── index.tsx                # /settings
│   │   │   └── team.tsx                 # /settings/team
│   │   ├── reviews/
│   │   │   ├── new.tsx                  # /reviews/new (ask for review)
│   │   │   └── inbox.tsx               # /reviews/inbox
│   │   ├── marketing/
│   │   │   ├── seo.tsx                  # /marketing/seo
│   │   │   └── analytics.tsx            # /marketing/analytics
│   │   ├── marketplace/
│   │   │   ├── index.tsx                # /marketplace (partner directory)
│   │   │   └── projects/index.tsx       # /marketplace/projects (task board)
│   │   ├── collaborations/
│   │   │   └── meeting-schedular.tsx    # /collaborations/meeting-schedular
│   │   └── company/[companyname]/       # /company/:companyname (partner profile)
│   ├── (auth).tsx                       # Auth layout
│   ├── (auth)/
│   │   ├── login.tsx                    # /login
│   │   ├── signup.tsx                   # /signup
│   │   ├── verify-email.tsx             # /verify-email
│   │   ├── forgot-password.tsx          # /forgot-password
│   │   ├── reset-password.tsx           # /reset-password
│   │   └── 2fa.tsx                      # /2fa
│   ├── (onboarding).tsx                 # Onboarding layout
│   ├── (onboarding)/
│   │   └── onboarding.tsx               # /onboarding
│   ├── review/[id].tsx                  # /review/:id (redirect to canonical URL)
│   ├── qr/[id].ts                       # /qr/:id (business QR redirect, counts scans)
│   ├── company/[username]/review/       # Public review page
│   ├── company/[username]/bookings/     # Public booking page
│   └── api/
│       ├── [...auth].ts                 # /api/auth/* (better-auth catch-all)
│       ├── business.ts                  # /api/business (GET/POST business profile)
│       ├── feedback.ts                  # /api/feedback (POST feedback)
│       ├── google/
│       │   ├── auth.ts                  # /api/google/auth (initiate Google OAuth)
│       │   ├── callback.ts              # /api/google/callback (OAuth callback)
│       │   ├── locations.ts             # /api/google/locations (fetch GBP locations)
│       │   ├── reviews.ts              # /api/google/reviews (fetch Google reviews)
│       │   ├── status.ts                # /api/google/status (connection state)
│       │   └── disconnect.ts            # /api/google/disconnect (revoke stored grant)
│       ├── company/[username]/
│       │   ├── schedule.ts              # /api/company/:username/schedule (public availability)
│       │   └── bookings.ts              # /api/company/:username/bookings (public booking submit)
│       ├── marketplace/
│       │   ├── partners.ts              # /api/marketplace/partners (directory search)
│       │   ├── partner.ts               # /api/marketplace/partner (single profile)
│       │   ├── favorites.ts             # /api/marketplace/favorites (saved partners)
│       │   ├── services.ts              # /api/marketplace/services (portfolio services)
│       │   ├── projects.ts              # /api/marketplace/projects (portfolio projects)
│       │   ├── contacts.ts              # /api/marketplace/contacts (portfolio contacts)
│       │   ├── load.ts                  # /api/marketplace/load (weekly workload overview)
│       │   ├── meetings/                # /api/marketplace/meetings (list, create, decide)
│       │   ├── schedule-settings/       # /api/marketplace/schedule-settings (working hours)
│       │   └── slots/                   # /api/marketplace/slots (list, generate, mine)
│       ├── team/
│       │   ├── invite.ts                # /api/team/invite (send invitation)
│       │   ├── invitations.ts           # /api/team/invitations (list, cancel)
│       │   ├── check-invite.ts          # /api/team/check-invite (inspect a token)
│       │   ├── accept-invite.ts         # /api/team/accept-invite
│       │   ├── decline-invite.ts        # /api/team/decline-invite
│       │   ├── find-business.ts         # /api/team/find-business (join lookup)
│       │   ├── join-request.ts          # /api/team/join-request (submit, read, withdraw)
│       │   ├── join-requests.ts         # /api/team/join-requests (admin queue, review)
│       │   └── members.ts               # /api/team/members (list, re-role, remove)
│       ├── tasks/                       # /api/tasks (list, create, update, delete, reorder)
│       ├── team-meetings/               # /api/team-meetings (list, create, update, delete)
│       ├── meet/
│       │   └── create.ts                # /api/meet/create (Google Meet link)
│       ├── reviews/
│       │   ├── share.ts                 # /api/reviews/share (GET/POST shared reviews)
│       │   ├── track.ts                 # /api/reviews/track (POST analytics events)
│       │   └── analytics.ts             # /api/reviews/analytics (GET aggregated analytics)
│       └── ai/
│           ├── suggest-review.ts        # /api/ai/suggest-review (POST AI review suggestions)
│           └── draft-reply.ts           # /api/ai/draft-reply (POST AI reply drafting)
│
├── services/
│   ├── email.ts                         # ZeptoMail email sender
│   └── email-templates.ts              # HTML/text email templates (verification, reset, OTP, 2FA,
│                                        #   team invites, join requests, meeting requests/decisions)
│
├── stores/
│   ├── settings-store.ts                # Settings context definition and hook
│   ├── SettingsProvider.tsx             # Settings context provider
│   ├── task-store.ts                    # Task and team-meeting context definition
│   └── TaskProvider.tsx                 # Task context provider (tasks, meetings, members)
│
└── types/
    ├── index.ts                         # App-wide TypeScript types
    ├── google.ts                        # Google API response types
    ├── landing.ts                       # Landing page types
    ├── marketplace.ts                   # Partner, filter, and sort types
    └── auth-ui.ts                       # Auth UI form types
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
npx prisma migrate dev
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
| `SharedReview` | Shared review requests with text, rating, keywords |
| `ReviewAnalytics` | Analytics per shared review (visits, reviews, QR scans, redirects, AI copies) |
| `Feedback` | User feedback submissions |
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
