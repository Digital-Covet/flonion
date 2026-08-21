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
- **Shared Review Pages** -- Public-facing `/company/:slug/review/:id` pages where visitors can rate, write, and submit reviews
- **Multi-Platform Redirects** -- After submitting, visitors are redirected to configured review platforms (Google, Yelp, Facebook, TripAdvisor, JustDial, or custom links)
- **Review Inbox** -- View and manage all reviews in one place

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

### Onboarding & Settings

- **3-Step Onboarding Wizard** -- Business Basics, Review Platforms, Review Settings
- **Business Profile Settings** -- Name, phone, address, sector, keywords, logo upload
- **Google Business Profile Integration** -- OAuth 2.0 connection with automatic token refresh and location selection
- **Multi-Platform Review Links** -- Configure links for Google, Yelp, Facebook, TripAdvisor, JustDial, and custom platforms

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | SolidJS + SolidStart |
| Build | Vite 8 + Nitro |
| Styling | Tailwind CSS v4 |
| UI Components | Ark UI (Solid), Lucide Icons |
| Database | PostgreSQL via Prisma ORM |
| Auth | better-auth (email/password, 2FA, OTP, email verification) |
| AI/LLM | LangChain + DeepSeek |
| Email | ZeptoMail (Zoho) |
| QR Codes | qrcode |
| Validation | Zod v4 |
| Fonts | Jost, Rubik |
| Package Manager | pnpm |

## Prerequisites

- Node.js >= 24
- pnpm
- PostgreSQL database
- A [DeepSeek](https://platform.deepseek.com/) API key
- A [Google Cloud](https://console.cloud.google.com/) project with the **Google Business Profile API** enabled (optional -- for Google Business integration)
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

New users are redirected to `/onboarding` to complete a 3-step setup wizard before accessing the dashboard.

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
│   ├── dashboard/                       # QuickActions, RecentActivity
│   ├── landing/                         # Hero, Features, Testimonials, FAQ, CTA, Navbar, Footer, MobileMenu
│   ├── layout/                          # AppSidebar, MobileNavigation
│   ├── onboarding/                      # BasicsStep, PlatformsStep, ReviewStep, ProgressStepper, LogoUpload
│   ├── review/                          # Review composer, QR display, metrics, charts, suggestion cards
│   ├── seo/                             # ActionItems, KeywordRecommendations, CompetitorCard, PhotoStatus, ProgressTracker
│   └── ui/                              # Shared primitives: IconButton, UserAvatar, Progress
│
├── constants/                           # Navigation items, branding, landing page data
│
├── db/
│   └── prisma.ts                        # Prisma client singleton
│
├── features/
│   ├── account/                         # AccountPage + components (2FA, change email/password, backup codes)
│   ├── dashboard/                       # DashboardPage with metrics, charts, quick actions
│   ├── feedback/                        # FeedbackPage for user feedback submission
│   ├── marketing/                       # AnalyticsPage for campaign tracking
│   ├── onboarding/                      # OnboardingPage (3-step wizard)
│   ├── reviews/                         # Mock data and type definitions for reviews
│   ├── seo/                             # SeoOptimizerPage with business info, keywords, competitors
│   └── settings/                        # SettingsPage + components (form fields, toggles, integration cards)
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
│   ├── cn.ts                            # ClassName utility
│   ├── constants.ts                     # App domain, company name, support email
│   ├── cookies.ts                       # Cookie parsing and serialization
│   ├── crypto.ts                        # HMAC signing, AES-256-GCM encrypt/decrypt, random tokens
│   ├── google-tokens.ts                 # Google OAuth token storage/refresh (encrypted at rest)
│   ├── oauth-state.ts                   # Google OAuth CSRF state cookie management
│   ├── rate-limit.ts                    # In-memory rate limiter
│   ├── server-auth.ts                   # Server-side session extraction from headers
│   ├── slug.ts                          # URL slug generator
│   └── trusted-origins.ts               # Trusted origins for CSRF protection
│
├── routes/
│   ├── index.tsx                        # Landing page (/)
│   ├── (app).tsx                        # App layout (sidebar + header)
│   ├── (app)/
│   │   ├── dashboard.tsx                # /dashboard
│   │   ├── settings.tsx                 # /settings
│   │   ├── account.tsx                  # /account
│   │   ├── feedback.tsx                 # /feedback
│   │   ├── reviews/
│   │   │   ├── new.tsx                  # /reviews/new (ask for review)
│   │   │   └── inbox.tsx               # /reviews/inbox
│   │   └── marketing/
│   │       ├── seo.tsx                  # /marketing/seo
│   │       └── analytics.tsx            # /marketing/analytics
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
│   ├── qr/[id].ts                       # /qr/:id (QR code redirect)
│   ├── company/[companyname]/review/[id].tsx  # Public review page
│   └── api/
│       ├── [...auth].ts                 # /api/auth/* (better-auth catch-all)
│       ├── business.ts                  # /api/business (GET/POST business profile)
│       ├── feedback.ts                  # /api/feedback (POST feedback)
│       ├── google/
│       │   ├── auth.ts                  # /api/google/auth (initiate Google OAuth)
│       │   ├── callback.ts              # /api/google/callback (OAuth callback)
│       │   ├── locations.ts             # /api/google/locations (fetch GBP locations)
│       │   └── reviews.ts              # /api/google/reviews (fetch Google reviews)
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
│   └── email-templates.ts              # HTML/text email templates (verification, reset, OTP, 2FA)
│
├── stores/
│   ├── settings-store.ts                # Settings context definition and hook
│   └── SettingsProvider.tsx             # Settings context provider
│
└── types/
    ├── index.ts                         # App-wide TypeScript types
    ├── google.ts                        # Google API response types
    ├── landing.ts                       # Landing page types
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

### Google Business Profile Integration

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/google/auth` | Yes | Redirects to Google OAuth consent screen |
| `GET` | `/api/google/callback` | Yes | Handles OAuth callback, exchanges code for tokens, stores encrypted |
| `GET` | `/api/google/locations` | Yes | Returns all Google Business accounts and locations |
| `GET` | `/api/google/reviews` | Yes | Returns reviews for a specific account/location (paginated) |

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
| `Business` | Business profiles (name, phone, address, sector, keywords, logo, review links) |
| `GoogleToken` | Encrypted Google OAuth tokens per user (AES-256-GCM) |
| `SharedReview` | Shared review requests with text, rating, keywords |
| `ReviewAnalytics` | Analytics per shared review (visits, reviews, QR scans, redirects, AI copies) |
| `Feedback` | User feedback submissions |

## Security

- **AES-256-GCM Encryption** -- Google OAuth tokens are encrypted at rest in the database
- **HMAC-SHA256 Signing** -- OAuth state cookies are signed with constant-time comparison
- **CSRF Protection** -- Origin header validation on all state-changing API requests
- **Trusted Origins** -- Allowlisted origins configurable via environment variables
- **Secure Cookies** -- HttpOnly, SameSite=Lax, Secure in production
- **Rate Limiting** -- In-memory rate limiting on AI endpoints (per-review and per-IP)
- **Email Verification Required** -- Users must verify email before accessing the app
- **Onboarding Gate** -- Unauthenticated users and incomplete profiles are redirected appropriately
