---
title: "Daily Picks Blog Design"
tags: [github-stars, blog, linkedin, humanize]
status: proposed
created: 2026-10-14
---

# Daily Picks Blog Design

## Goal

Every weekday the app publishes one post: a short intro and five GitHub projects from Tarik's
stars that share a theme. Tarik copies the post into LinkedIn with one click and downloads a
matching image. The posts should be worth saving and sharing, and they should not read as
AI-written.

## Agreed decisions

| Question | Answer | Who decided |
|---|---|---|
| Where projects come from | Tarik's starred repos only | Tarik |
| Feature image | Branded title card, drawn by code in the site's style | Tarik |
| Links in the LinkedIn post | Inline, one under each entry | Tarik |
| How themes are chosen | From embeddings (similarity), not the category labels | Claude, approved by Tarik |
| Text quality | Automatic humanize gate using the sloplint scorer | Claude, approved by Tarik |

Out of scope for this version: posting to LinkedIn automatically, editing posts in the app,
regenerating a post, newsletters, analytics.

## Post format

Plain text, because LinkedIn ignores markdown. This matches the example Tarik supplied:

```
{hook: one or two lines, the part shown before "...see more"}

{rest of the intro: 1 to 3 short sentences}

1. {Title}: {blurb, 1 to 3 sentences}
{GitHub URL}

2. ...

{closing question that invites replies}
```

Rules every published post meets:

- Exactly five entries, numbered 1 to 5.
- The hook fits in the first 210 characters, the point where LinkedIn cuts the post off.
- The full post is 3,000 characters or fewer (LinkedIn's limit).
- Every URL comes from the database. The writing model never produces a URL.
- Every fact in a blurb comes from that repo's README or its GitHub description.
- No em dashes or en dashes anywhere.
- A sloplint score of 25 or lower.

## The daily run, in order

A cron (a job Vercel runs on a schedule) calls `/api/generate-post` at 12:00 UTC, Monday to
Friday. That is 7am Central in summer and 6am in winter. On the Hobby plan a cron can fire
anywhere inside its hour, so the run is placed a full hour after the 11:00 star refresh to keep the
two from overlapping.

1. **Skip if done.** If a post already exists for today's date (Central time), return it and stop.
   Running the job twice never makes two posts.
2. **Pick a seed.** Take the most recently starred repo that has a description, has an embedding
   (the list of numbers that places similar repos near each other), and has not appeared in any post.
   Skip it if its embedding is too similar to the seeds of the last three posts, so two days in a row
   don't cover the same ground.
3. **Find neighbors.** Find the four unused repos closest to the seed. If fewer than four pass the
   minimum similarity, try the next seed. Give up after 20 seeds and log why.
4. **Check GitHub.** For each of the five, ask GitHub whether the repo is archived and fetch its
   README. Archived repos are swapped for the next-closest neighbor. READMEs are cut to their first
   6,000 characters.
5. **Write.** Send the five READMEs, descriptions, titles and the writing rules to the OpenAI model.
   It returns structured fields only: `theme`, `hook`, `intro`, a `title` and `blurb` per repo (keyed
   by repo id), and `question`.
6. **Assemble.** Code builds the post text from those fields, adding numbers and database URLs.
7. **Gate.** Check the rules above. If any fail, send the findings back to the model for one rewrite
   and check again. If it still fails, publish nothing, return the reasons, and log them.
8. **Save.** In one database transaction (all of it succeeds or none of it does), insert the post
   and record its five repos as used.

Starting values for the similarity thresholds (seed against recent seeds: 0.80; neighbor minimum:
0.45) get checked with a dry run against the real data before launch. The final values live as
named constants in `api/_lib/picker.js`.

## Writing rules given to the model

The prompt is built from primary sources, not from a summary:

- The soundshuman humanize skill: its pattern list, its tier-1 vocabulary, and the worked examples
  in `references/examples.md` and `references/style-guide.md`.
- Tarik's GeoLibre / RustGIS / Geospatial MCP example as the format reference.
- The no-fabrication rule: describe only what the README or description says. If a README is thin,
  write a shorter blurb rather than filling the gap.
- LinkedIn constraints: hook first, plain text, one closing question, no hashtag walls, no emojis.

When Tarik supplies writing samples, they are added as a voice reference. Humanize's own rule
applies: a sample outranks the default style.

The model name comes from `OPENAI_WRITER_MODEL`, with a default confirmed against the account
during the build. The key is the existing `OPENAI_API_KEY`.

## Data

Two new tables, created by the existing migrate script:

**posts**
- `id` (serial), `post_date` (date, unique: one post per day)
- `theme`, `hook`, `body_text` (the exact LinkedIn text)
- `entries` (JSON: repo id, title, blurb, url, in order)
- `seed_repo_id`, `sloplint_score`, `attempts` (1 or 2), `writer_model`
- `created_at`

**post_repos**
- `repo_id` (primary key): because it is the primary key, the database itself refuses to use a
  repo twice, even if the code has a bug. There is deliberately no foreign key to `repos`, so a
  future cleanup of unstarred repos can never be blocked by an old post. Each post stores its own
  titles and URLs in `entries`.
- `post_id` (references `posts`), `position` (1 to 5)

## Endpoints

| Endpoint | Who can call it | What it does |
|---|---|---|
| `GET /api/generate-post` | Vercel cron, with `CRON_SECRET` | The daily run |
| `POST /api/generate-post` | Tarik, with `POSTS_ADMIN_TOKEN` in an `x-admin-token` header | Manual run; `?dryRun=1` returns a post without saving it |
| `GET /api/posts` | Anyone | Published posts, newest first, 20 per page |

The cron check is shared with `/api/refresh`. Manual runs use a new `POSTS_ADMIN_TOKEN` because
Vercel stores the existing refresh token as a secret nobody can read back, which would make test
runs impossible. The token travels in a header, never in the URL, so it stays out of request logs.

## Blog page

`/blog` (a new `blog.html` and `blog.js`, styled with the existing `tokens.css` and `styles.css`).
The main nav gets a "Daily picks" link.

Each post shows, newest first:

- The title card.
- The date and theme.
- The post text, with links clickable. Text is inserted as text, never as raw HTML.
- **Copy for LinkedIn**: puts `body_text` on the clipboard exactly as stored, line breaks included,
  and shows "Copied".
- **Download image**: saves the card as a PNG.

Each post has an anchor (`/blog#2026-10-15`) so a single day can be linked.

## Title card

Drawn in the browser on a canvas (a drawable area of the page), so the server never makes or stores
an image.

- 1080 x 1350 pixels: LinkedIn's 4:5 portrait size, the largest a single image shows in the
  mobile feed.
- Cobalt palette and the Space Grotesk / Inter / JetBrains Mono fonts from `tokens.css`. The fonts
  are fully loaded before drawing, so the card never falls back to a default font.
- Content: "DAILY PICKS" and the date, the theme in large type, the five titles numbered, and a
  footer with the blog address.
- The same post always produces the same card.

Trade-off: when someone shares a `/blog` link, the preview won't show the card. Tarik's LinkedIn
posts aren't affected because he uploads the image himself.

## Errors

- No OpenAI key, no database, or GitHub unreachable: the run returns an error with the reason and
  writes nothing.
- The gate fails twice: no post that day; the response and the Vercel log say which rules failed.
- No usable seed left (pool exhausted): the run returns "no unused theme found"; the blog keeps
  showing past posts.
- The blog page cannot load posts: it shows an error message instead of an empty page.

## Testing

- Unit tests with Node's built-in test runner (`node --test`, no new dependency) for post
  assembly, the dash check, the length check, the hook-length check, the sloplint threshold, and the
  rewrite-once logic, with the writing model stubbed out.
- CI runs `npm test` alongside the existing syntax check.
- Before merge: a dry run on the preview deployment against real data, read by Tarik.
- After merge: one manual real run to publish the first post, checked on `/blog`, copied into a
  LinkedIn draft to confirm line breaks survive, and the card downloaded and opened.

## How we'll know it works

- Over the first four weeks, at least 18 of 20 weekdays publish a post with no manual fix.
- No repo appears twice (the database enforces this; a query confirms it).
- Most posts pass the gate on the first attempt (from the `attempts` column).
- Tarik posts them with no more than a sentence of editing. Tarik judges this.

## Decision records

- `docs/decisions/002-themes-from-embeddings.md`
- `docs/decisions/003-title-card-drawn-in-browser.md`
- `docs/decisions/004-automatic-humanize-gate.md`
