# revme-ai

AI-powered Google Business Profile review management and local SEO optimization tool. Built with SolidJS and LangChain.

## Features

- **Review Inbox** -- Browse, filter, and respond to Google Business reviews in one place
- **AI Sentiment Analysis** -- Automatically analyzes review sentiment, customer intent, and key topics
- **AI-Drafted Replies** -- Generates professional, friendly, or formal reply drafts based on review sentiment
- **AI Review Suggestions** -- Transforms rough drafts into 3 polished review variants (Simple, Professional, Casual)
- **SEO Dashboard** -- Tracks profile optimization strength with actionable recommendations
- **Google OAuth Integration** -- Securely connects to your Google Business Profile via OAuth 2.0
- **Settings Management** -- Configure business profile details, integrations, and platform preferences

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | SolidJS + SolidStart |
| Build | Vite 8 + Nitro |
| Styling | Tailwind CSS v4 |
| UI Components | Ark UI (Solid), Lucide Icons |
| AI/LLM | LangChain + OpenRouter (`openai/gpt-oss-20b:free`) |
| Validation | Zod v4 |
| Package Manager | pnpm |

## Prerequisites

- Node.js >= 24
- pnpm
- A [Google Cloud](https://console.cloud.google.com/) project with the **Google Business Profile API** enabled
- An [OpenRouter](https://openrouter.ai/) API key (free tier available)

## Environment Setup

1. Copy the example env file:

```bash
cp .env.example .env
```

2. Fill in the required variables:

| Variable | Description | Where to get it |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID | [Google Cloud Console > Credentials](https://console.cloud.google.com/apis/credentials) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret | Same page as above |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL (default: `http://localhost:3000/api/google/callback`) | Must match the redirect URI in your OAuth credentials |
| `GOOGLE_PLACE_ID` | Your Google Business Profile Place ID | [Google Place ID Finder](https://developers.google.com/maps/documentation/places/web-service/place-id) |
| `OPENROUTER_API_KEY` | API key for OpenRouter LLM access | [OpenRouter Keys](https://openrouter.ai/keys) |

## Installation

```bash
pnpm install
```

## Development

```bash
pnpm dev
```

The app will be available at `http://localhost:3000`.

## Build & Deploy

```bash
# Build for production
pnpm build

# Start the production server
pnpm start
```

## Project Structure

```
src/
├── app.tsx                          # Root app with layout and routing
├── entry-client.tsx                 # Client-side entry point
├── entry-server.tsx                 # Server-side entry point
├── components/
│   ├── layout/                      # SideNav, TopAppBar, BottomNav, MobileSideDrawer
│   ├── review/                      # Review inbox and review redirect components
│   ├── seo/                         # SEO dashboard (PageHeader, ProgressTracker, ActionList)
│   └── ui/                          # Shared UI primitives (UserAvatar, IconButton, progress)
├── constants/                       # Navigation, branding, and action item data
├── features/settings/               # Settings page and form components
├── lib/
│   ├── agents/
│   │   ├── pipeline.ts              # Orchestrates sentiment + reply/suggestion pipelines
│   │   ├── sentiment-analyzer.ts    # LLM-based sentiment analysis agent
│   │   └── review-drafter.ts        # LLM-based reply drafting and review suggestion agents
│   ├── cn.ts                        # className utility
│   └── google-tokens.ts            # OAuth token storage and refresh
├── routes/
│   ├── index.tsx                    # SEO dashboard home
│   ├── inbox.tsx                    # Review inbox
│   ├── review-redirect.tsx          # Customer review redirect page
│   ├── settings.tsx                 # Settings page
│   └── api/
│       ├── google/
│       │   ├── auth.ts              # Initiates Google OAuth flow
│       │   ├── callback.ts          # Handles OAuth callback and token exchange
│       │   ├── locations.ts         # Fetches Google Business locations
│       │   └── reviews.ts          # Fetches reviews for a given location
│       └── ai/
│           ├── draft-reply.ts       # POST: AI-generates a reply to a review
│           └── suggest-review.ts   # POST: AI-generates 3 improved review variants
├── stores/
│   ├── settings-store.ts            # Settings context and hooks
│   └── SettingsProvider.tsx          # Settings context provider
└── types/
    ├── index.ts                     # App-wide TypeScript types
    └── google.ts                    # Google API response types
```

## API Routes

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/google/auth` | Redirects to Google OAuth consent screen |
| `GET` | `/api/google/callback` | Handles OAuth callback, exchanges code for tokens |
| `GET` | `/api/google/locations` | Returns all Google Business locations for the authenticated user |
| `GET` | `/api/google/reviews?accountId=...&locationId=...` | Returns reviews for a specific location |
| `POST` | `/api/ai/draft-reply` | Generates an AI-drafted reply to a customer review |
| `POST` | `/api/ai/suggest-review` | Generates 3 improved versions of a draft review |

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
  "starRating": 3
}
```

Returns: `{ sentiment, suggestedReviews: [simple, professional, casual] }`
