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
- `/api/refresh` refreshes GitHub stars when called with `GITHUB_STARS_REFRESH_TOKEN`

Required environment variables:

- `DATABASE_URL`: Neon Postgres connection string
- `OPENAI_API_KEY`: optional, required for real semantic embeddings
- `GITHUB_TOKEN`: optional, raises GitHub API rate limits during refresh
- `GITHUB_STARS_REFRESH_TOKEN`: required for production refresh endpoint access

Local database commands:

```bash
npm run db:migrate
npm run db:ingest
```

## Local development

```bash
npm run dev
```

Then open `http://localhost:4173`.

## Deployment

The app is static and can be deployed directly to Vercel. This repo is designed to be pushed to Buzz-hosted git so Buzz can browse the files.

## Notes

GitHub's unauthenticated public API has rate limits. If the API limit is hit, the app displays the error state instead of inventing data.
