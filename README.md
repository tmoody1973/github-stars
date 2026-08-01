# GitHub Stars

A small static web app that turns Tarik Moody's GitHub stars into a searchable, filterable index.

## What it does

- Fetches public starred repositories from `GET /users/tmoody1973/starred`
- Groups and filters by language, topic, and owner
- Sorts by starred date, repository activity, star count, or name
- Opens a keyboard-friendly command palette with `⌘K` / `Ctrl+K`

## Local development

```bash
npm run dev
```

Then open `http://localhost:4173`.

## Deployment

The app is static and can be deployed directly to Vercel. This repo is designed to be pushed to Buzz-hosted git so Buzz can browse the files.

## Notes

GitHub's unauthenticated public API has rate limits. If the API limit is hit, the app displays the error state instead of inventing data.
