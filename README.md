# NowLanding

NowLanding tracks movie and series release dates and sends useful alerts through the web app or Telegram.

## What it does

- Shows theatrical, digital, and physical movie releases by region.
- Shows series premieres, season premieres, and episodes.
- Lets users follow titles and see their dates in one timeline.
- Sends announcements, reminders, release-day alerts, and date-change alerts.
- Physical releases follow the same notification flow as digital releases: announcement, one-week reminder, release day, and date changes.
- Keeps every alert in the web notification feed, even when Telegram is not connected.

## Stack

- Next.js 16 App Router with plain CSS
- Supabase Postgres, Auth, and Edge Functions
- TMDB for release data
- Telegram Bot API for optional alerts
- Vitest for unit tests

## Local development

### Requirements

Node.js 20+, pnpm, Docker, the [Supabase CLI](https://supabase.com/docs/guides/cli), a [TMDB read token](https://developer.themoviedb.org), and a Telegram bot token if Telegram delivery is needed.

### Install and configure

```bash
pnpm install
supabase start
cp .env.example .env.local
cp supabase/functions/.env.example supabase/functions/.env
```

Fill in the environment files with the values printed by `supabase status` and your TMDB and Telegram credentials.

Start the web app:

```bash
pnpm dev
```

The app runs at [http://localhost:3001](http://localhost:3001).

The local Supabase Auth server auto-confirms new accounts. Hosted Supabase projects may send confirmation emails.

### Load local release data

The database starts empty. Run discovery and refresh once:

```bash
KEY=$(supabase status -o env | grep '^SECRET_KEY' | cut -d'"' -f2)

curl -X POST http://127.0.0.1:54321/functions/v1/sync-tmdb \
  -H "apikey: $KEY" \
  -H "Content-Type: application/json" \
  -d '{"mode":"discover"}'

curl -X POST http://127.0.0.1:54321/functions/v1/sync-tmdb \
  -H "apikey: $KEY" \
  -H "Content-Type: application/json" \
  -d '{"mode":"refresh"}'
```

The Edge Functions expect the secret key in the `apikey` header.

## Useful commands

```bash
pnpm dev       # Start Next.js on port 3001
pnpm build     # Create a production build
pnpm start     # Serve the production build
pnpm lint      # Run ESLint
pnpm test      # Run Vitest
```

## Project layout

```text
app/                    Next.js routes, actions, and styles
components/             Shared UI components
lib/                    Data access, formatting, TMDB, and Supabase clients
supabase/migrations/    Database schema, RLS, and schedules
supabase/functions/     Sync, event detection, Telegram, and shared logic
```

## Deployment

1. Create and link a Supabase project, then run `supabase db push`.
2. Deploy the Edge Functions with `supabase functions deploy`.
3. Configure Supabase Auth providers and redirect URLs.
4. Set the variables from `.env.example` in Vercel.
5. Configure the Telegram webhook and function secrets if Telegram alerts are enabled.

## Data notes

- TMDB does not separate Blu-ray and DVD, so both are stored as one physical release type.
- Series dates are not region-specific. Movie dates use the user’s region with a US fallback.
- Popularity is used as the proxy for anticipated titles because TMDB does not expose an anticipated flag.
- Cached TMDB data is periodically refreshed and stale untracked titles are removed.

## License and attribution

This project is licensed under the [MIT License](LICENSE).

This product uses the TMDB API but is not endorsed or certified by TMDB.
