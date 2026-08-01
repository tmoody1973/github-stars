# GitHub Stars

A small static web app that turns Tarik Moody's GitHub stars into a searchable, filterable index.

## What it does

- Fetches public starred repositories from `GET /users/tmoody1973/starred`
- Groups and filters by language, topic, and owner
- Adds plain-English categories such as AI & LLMs, Web apps, Dev tools, and Design/UI
- Writes easy-to-read summaries for each repo from the public GitHub metadata
- Sorts by starred date, repository activity, star count, or name
- Opens a keyboard-friendly command palette with `⌘K` / `Ctrl+K`

## Semantic search direction

The current app is static and uses explainable category/synonym matching. Real semantic search should be added with a backend:

- Store repos, categories, summaries, and embeddings in Postgres
- Refresh GitHub stars on a scheduled ingestion job
- Query stored embeddings from a Vercel function
- Keep manual summary/category edits in the database

## Local development

```bash
npm run dev
```

Then open `http://localhost:4173`.

## Deployment

The app is static and can be deployed directly to Vercel. This repo is designed to be pushed to Buzz-hosted git so Buzz can browse the files.

## Notes

GitHub's unauthenticated public API has rate limits. If the API limit is hit, the app displays the error state instead of inventing data.
