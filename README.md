# GitHub Stars

A small static web app that turns Tarik Moody's GitHub stars into a searchable, filterable index.

## What it does

- Fetches public starred repositories from `GET /users/tmoody1973/starred`
- Groups and filters by language, topic, and owner
- Adds plain-English categories such as AI & LLMs, Web apps, Dev tools, and Design/UI
- Writes easy-to-read summaries for each repo from the public GitHub metadata
- Supports a Neon-backed saved index through Vercel API routes
- Supports semantic search when `OPENAI_API_KEY` is configured and embeddings have been refreshed
- Sorts by starred date, repository activity, star count, or name
- Opens a keyboard-friendly command palette with `⌘K` / `Ctrl+K`

## Semantic search direction

The app includes the backend path for real semantic search:

- Neon/Postgres stores repos, categories, summaries, and optional embeddings
- `/api/stars` returns the saved index
- `/api/search` performs vector search when embeddings are present, otherwise it falls back to database keyword search
- `/api/refresh` refreshes GitHub stars for manual sync and Vercel cron polling
- `vercel.json` runs `/api/refresh` daily at 11:00 UTC; unchanged repos keep their existing embeddings

Required environment variables:

- `DATABASE_URL`: Neon Postgres connection string
- `OPENAI_API_KEY`: optional, required for real semantic embeddings
- `GITHUB_TOKEN`: optional, raises GitHub API rate limits during refresh
- `GITHUB_STARS_REFRESH_TOKEN`: required for production refresh endpoint access
- `CRON_SECRET`: required for Vercel cron bearer-token authorization
- `ALLOW_PUBLIC_REFRESH`: set to `1` to let the frontend Refresh button trigger a throttled production refresh
- `POSTS_ADMIN_TOKEN`: required for manual runs of `/api/generate-post` (sent as the `x-admin-token` header)
- `OPENAI_WRITER_MODEL`: optional, the model that writes daily posts (default `gpt-5`)
- `GITHUB_TOKEN`: recommended; daily picks make about a dozen GitHub calls per run

Local database commands:

```bash
npm run db:migrate
npm run db:ingest
```

## Daily picks

Every weekday at 12:00 UTC a cron calls `/api/generate-post`. It picks the newest unused star plus its four
most similar unused stars, reads their READMEs, has OpenAI write a LinkedIn-ready post, checks it with the
vendored sloplint scorer (score 25 or lower, no em or en dashes), and saves it. Posts appear at `/blog`
with a Copy for LinkedIn button and a downloadable 1080x1350 title card.

- `GET /api/posts` lists published posts, newest first.
- `POST /api/generate-post` runs it manually; add `?dryRun=1` to see a post without saving it.
- Design: `docs/plans/2026-10-14-daily-picks-design.md`. Decisions: `docs/decisions/002` to `004`.
- `TEST_DATABASE_URL=<neon branch> npm test` also runs the database integration test.

## Local development

```bash
npm run dev
```

Then open `http://localhost:4173`.

## Deployment

The app is static and can be deployed directly to Vercel. This repo is designed to be pushed to Buzz-hosted git so Buzz can browse the files.

## Notes

GitHub's unauthenticated public API has rate limits. If the API limit is hit, the app displays the error state instead of inventing data.
