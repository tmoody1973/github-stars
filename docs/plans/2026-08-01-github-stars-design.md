---
title: "GitHub Stars App Design"
tags: [github-stars, hallmark, vercel, buzz-git]
status: active
created: 2026-08-01
---

# GitHub Stars App Design

## Inferred context

- Audience: public viewers plus Tarik.
- Use case: search and filter Tarik's starred repositories quickly.
- Tone: technical/editorial.

## Approach

Build a static client-side app first. This keeps the Buzz-hosted git proof simple, avoids dependency installation, and lets Vercel deploy the app directly. The app uses GitHub's public starred repositories endpoint with pagination and no credentials.

## Core flow

1. Fetch starred repositories for `tmoody1973` from GitHub.
2. Normalize each item into app data: name, owner, description, language, topics, stars, forks, updated date, starred date, homepage, and URL.
3. Compute filter options from the fetched data.
4. Render:
   - a stats overview,
   - featured high-signal repositories,
   - recent starred repositories,
   - the full searchable index.
5. Provide search, language filter, topic filter, owner filter, and sorting.
6. Provide a `⌘K` / `Ctrl+K` command palette for keyboard-first navigation.

## Design

Hallmark direction:

- Genre: modern-minimal.
- Macrostructure: Ecosystem Index.
- Theme: Cobalt-inspired technical interface.
- Navigation: N13 inline command/search pill.
- Footer: Ft5 statement.

The interface should read like a calm instrument panel, not a generic dashboard. Data drives the layout; no fake metrics or filler testimonials.

## Validation

- Static JS syntax check with `node --check app.js`.
- Manual local smoke test through a static server.
- Verify git trailers before push.
