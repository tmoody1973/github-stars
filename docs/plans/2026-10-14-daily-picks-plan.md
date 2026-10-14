# Daily Picks Blog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every weekday, publish a themed post of five of Tarik's starred GitHub repos to `/blog`, ready to copy into LinkedIn with a matching downloadable title card.

**Architecture:** A weekday Vercel cron calls `/api/generate-post`. It picks five similar unused repos from Neon using the existing embeddings, fetches their READMEs, asks OpenAI for structured copy, assembles the plain-text post in code (URLs from the database), gates it with a vendored copy of sloplint, and saves it in one SQL statement. A static `/blog` page lists posts and draws each title card on a canvas.

**Tech Stack:** Vanilla JS ES modules, Vercel Functions (Node 22), `@neondatabase/serverless` (already installed), pgvector (already enabled), OpenAI Chat Completions over `fetch`, `node:test`. No new npm dependencies.

**Spec:** `docs/plans/2026-10-14-daily-picks-design.md`

## Global Constraints

- No new npm dependencies. Use `fetch`, `node:test`, `node:assert/strict`, `node:crypto`, `node:module`.
- Five entries per post, numbered 1 to 5.
- Hook: 210 characters or fewer. Post: 3,000 characters or fewer.
- Sloplint score of 25 or lower, computed on the post with URL-only lines removed.
- Zero U+2014 (em dash) or U+2013 (en dash) characters in any published post.
- The writing model never writes a URL. URLs come from `repos.url`.
- One post per date, where the date is today in `America/Chicago`.
- Cron schedule: `0 12 * * 1-5`.
- Manual runs authenticate with `POSTS_ADMIN_TOKEN` in the `x-admin-token` header, never in a query string.
- Similarity thresholds start at 0.80 (seed vs recent seeds) and 0.45 (neighbor minimum) and live as named constants.
- The writer model is `process.env.OPENAI_WRITER_MODEL || "gpt-5"`. Do not send `temperature` (gpt-5 models reject it).
- Blog page styling uses only `tokens.css` custom properties plus the card palette hex values listed in Task 8.
- 2-space indentation, double quotes, semicolons, matching the existing `api/` files.
- Commit messages: Conventional Commits, ending with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- `main` is protected; all work lands through a PR with the `check` job green.

## Review Focus

1. **Thin or missing README.** Expected: the writer gets "(no README)" and is told to write a shorter blurb rather than invent detail. Pinned in Task 4 (`buildMessages` test).
2. **The writer returns the wrong repos** (unknown id, duplicate id, four entries). Expected: the gate treats it as a failure, retries once, never publishes. Pinned in Task 3.
3. **The gate fails twice.** Expected: nothing saved, a 422 response listing the problems, and the blog keeps showing older posts. Pinned in Task 3 (compose) and Task 7 (handler returns 422 without calling save).
4. **The cron fires twice, or cron and a manual run overlap.** Expected: one post for the day; the second save fails and leaves the first untouched. Pinned in Task 5 (integration test on a Neon branch).
5. **A run just after midnight UTC.** Expected: the post is dated by Central time, so a 00:30 UTC run belongs to the previous Central day. Pinned in Task 5 (`todayInChicago` test).

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `api/_lib/sloplint/sloplint.cjs` | create (vendored) | Upstream scorer, unchanged |
| `api/_lib/sloplint/slop-rules.json` | create (vendored) | Upstream rules, unchanged |
| `api/_lib/sloplint/LICENSE` | create (vendored) | Upstream MIT license |
| `api/_lib/slop.js` | create | ESM wrapper: `scoreProse`, `bannedWords` |
| `api/_lib/post-format.js` | create | Pure: assemble post text, check rules |
| `api/_lib/compose.js` | create | Write → gate → one rewrite loop |
| `api/_lib/writer.js` | create | Prompt, JSON schema, OpenAI call |
| `api/_lib/dates.js` | create | `todayInChicago` |
| `api/_lib/post-store.js` | create | Posts schema, save, find, list |
| `api/_lib/picker.js` | create | Seed + neighbors SQL, archived filter |
| `api/_lib/github.js` | modify | Add `fetchRepoDetails` |
| `api/_lib/auth.js` | create | `isAuthorizedCron`, `isAuthorizedAdmin` |
| `api/refresh.js` | modify | Import `isAuthorizedCron` from `auth.js` |
| `api/generate-post.js` | create | Daily run endpoint |
| `api/posts.js` | create | Public list endpoint |
| `scripts/migrate.mjs` | modify | Also create posts tables |
| `scripts/preview-picks.mjs` | create | Simulate N days of picks on a test DB |
| `vercel.json` | modify | Add weekday cron |
| `blog.html`, `blog.js`, `card.js`, `blog.css` | create | Blog page and title card |
| `index.html` | modify | "Daily picks" nav link |
| `package.json`, `.github/workflows/check.yml` | modify | `npm test` script and CI step |
| `tests/*.test.mjs`, `tests/integration/*.test.mjs` | create | Tests |

---

### Task 1: Vendor sloplint and wire up the test runner

**Files:**
- Create: `api/_lib/sloplint/sloplint.cjs`, `api/_lib/sloplint/slop-rules.json`, `api/_lib/sloplint/LICENSE`
- Create: `api/_lib/slop.js`
- Modify: `package.json` (scripts), `.github/workflows/check.yml`
- Test: `tests/slop.test.mjs`

**Interfaces:**
- Produces: `scoreProse(text: string): { score: number, findings: Array<{ id: string, match: string }> }`
- Produces: `bannedWords(): string[]` (tier-1 and tier-2 vocabulary from the rules file)

- [ ] **Step 0: Rename the branch.** The spec commits live on `docs/daily-picks-spec`; the feature ships from the same branch under its final name:

```bash
git branch -m docs/daily-picks-spec feat/daily-picks
```

- [ ] **Step 1: Copy the upstream files**

```bash
D=~/.claude/plugins/cache/soundshuman/soundshuman/1.0.0
mkdir -p api/_lib/sloplint
cp $D/bin/sloplint.js api/_lib/sloplint/sloplint.cjs
cp $D/rules/slop-rules.json api/_lib/sloplint/slop-rules.json
cp $D/LICENSE api/_lib/sloplint/LICENSE
```

- [ ] **Step 2: Add the test script and CI step**

In `package.json` scripts add `"test": "node --test"`. In `.github/workflows/check.yml`, replace the ponytail comment and the single run step with:

```yaml
      - run: npm run check
      - run: npm test
```

- [ ] **Step 3: Write the failing test** at `tests/slop.test.mjs`

```js
import test from "node:test";
import assert from "node:assert/strict";
import { scoreProse, bannedWords } from "../api/_lib/slop.js";

test("obvious AI prose scores above the gate", () => {
  const { score, findings } = scoreProse(
    "This framework is a game-changer — it seamlessly empowers developers to unlock robust, cutting-edge workflows. Additionally, it serves as a testament to innovation."
  );
  assert.ok(score > 25, `expected > 25, got ${score}`);
  assert.ok(findings.some((finding) => finding.id === "em-dash"));
});

test("plain prose scores well under the gate", () => {
  const { score } = scoreProse("The tool reads a CSV file and draws a chart. I tried it on our station logs last week.");
  assert.ok(score <= 25, `expected <= 25, got ${score}`);
});

test("banned words come from the rules file", () => {
  const words = bannedWords();
  assert.ok(words.includes("delve"));
  assert.ok(words.length > 50);
});
```

- [ ] **Step 4: Run it and see it fail**

Run: `npm test`
Expected: FAIL, `Cannot find module '.../api/_lib/slop.js'`

- [ ] **Step 5: Write `api/_lib/slop.js`**

```js
import { createRequire } from "node:module";

// Vendored from soundshuman 1.0.0 (MIT, see sloplint/LICENSE). Rules are passed in as data so the
// scorer never reads a file path at runtime, which keeps Vercel's bundler from missing the JSON.
const require = createRequire(import.meta.url);
const { analyzeText } = require("./sloplint/sloplint.cjs");
const rules = require("./sloplint/slop-rules.json");

export function scoreProse(text) {
  const { score, findings } = analyzeText(text, rules);
  return { score, findings };
}

export function bannedWords() {
  const vocabulary = rules.vocabulary || {};
  return [...(vocabulary.tier1?.words || []), ...(vocabulary.tier2?.words || [])];
}
```

- [ ] **Step 6: Run the tests and the syntax check**

Run: `npm test && npm run check`
Expected: 3 tests pass; check prints nothing and exits 0.

- [ ] **Step 7: Commit**

```bash
git add api/_lib/sloplint api/_lib/slop.js tests/slop.test.mjs package.json .github/workflows/check.yml
git commit -m "feat: vendor sloplint scorer and add test runner"
```

---

### Task 2: Assemble and check a post

**Files:**
- Create: `api/_lib/post-format.js`
- Create: `tests/fixtures/sample-draft.mjs`
- Test: `tests/post-format.test.mjs`

**Interfaces:**
- Consumes: `scoreProse` from Task 1
- Produces: constants `MAX_POST_CHARS = 3000`, `HOOK_MAX_CHARS = 210`, `MAX_SLOP_SCORE = 25`, `MAX_TITLE_CHARS = 60`
- Produces: `assemblePost({ hook, intro, question, entries: Array<{ title, blurb, url }> }): string`
- Produces: `checkPost({ hook, intro, question, entries, bodyText }): { ok: boolean, score: number, problems: string[] }`

- [ ] **Step 1: Write the fixture** at `tests/fixtures/sample-draft.mjs`. This text scored 24 with the same rules on 2026-10-14.

```js
export const sampleRepos = [
  { id: 1, fullName: "opengeos/GeoLibre", url: "https://github.com/opengeos/GeoLibre" },
  { id: 2, fullName: "opengeos/RustGIS", url: "https://github.com/opengeos/RustGIS" },
  { id: 3, fullName: "sparkgeo/geo-mcp-servers", url: "https://github.com/sparkgeo/geo-mcp-servers" },
  { id: 4, fullName: "marceloprates/prettymaps", url: "https://github.com/marceloprates/prettymaps" },
  { id: 5, fullName: "digitalhen/blocklight", url: "https://github.com/digitalhen/blocklight" }
];

export const sampleDraft = {
  theme: "Open-source GIS",
  hook: "Five open-source GIS projects I starred this month, and one of them is a list of MCP servers for maps.",
  intro: "Most of these run in a browser. Two of them keep your data on your own machine.",
  question: "Which of these would you open first, and what do you use for maps today?",
  entries: [
    { repoId: 1, title: "GeoLibre", blurb: "A lightweight, cloud-native GIS platform for visualizing, exploring, and analyzing geospatial data. It runs in the web browser, on the desktop, on mobile, and inside Jupyter notebooks." },
    { repoId: 2, title: "RustGIS", blurb: "A fast, free and open-source GIS in pure Rust for mapping, analyzing and sharing geospatial data. Native on Windows, macOS and Linux, and in your web browser. Your data stays on your machine unless you send it to an AI model you choose, and every action is a command you can script." },
    { repoId: 3, title: "Geospatial MCP Servers", blurb: "A curated, tracked list of Model Context Protocol (MCP) servers for geospatial, GIS, mapping, and earth-observation work: geocoding, routing, PostGIS, STAC imagery, QGIS and ArcGIS, weather, and the commercial location platforms." },
    { repoId: 4, title: "prettymaps", blurb: "Draws pretty maps from OpenStreetMap data with a small Python library. You pick a place and a style preset and it renders a poster." },
    { repoId: 5, title: "Blocklight", blurb: "Shows city blocks lit up by data. I could not tell from the README how far along it is, which is part of why it caught my eye." }
  ]
};

export function sampleEntries() {
  return sampleDraft.entries.map((entry) => ({
    ...entry,
    url: sampleRepos.find((repo) => repo.id === entry.repoId).url
  }));
}
```

- [ ] **Step 2: Write the failing tests** at `tests/post-format.test.mjs`

```js
import test from "node:test";
import assert from "node:assert/strict";
import { assemblePost, checkPost, HOOK_MAX_CHARS } from "../api/_lib/post-format.js";
import { sampleDraft, sampleEntries } from "./fixtures/sample-draft.mjs";

function samplePost(overrides = {}) {
  const draft = { ...sampleDraft, entries: sampleEntries(), ...overrides };
  return { ...draft, bodyText: assemblePost(draft) };
}

test("assembles hook, intro, numbered entries with URLs, then the question", () => {
  const text = assemblePost({ ...sampleDraft, entries: sampleEntries() });
  const blocks = text.split("\n\n");
  assert.equal(blocks[0], sampleDraft.hook);
  assert.equal(blocks[1], sampleDraft.intro);
  assert.equal(blocks[2], `1. GeoLibre: ${sampleDraft.entries[0].blurb}\nhttps://github.com/opengeos/GeoLibre`);
  assert.ok(blocks[6].startsWith("5. Blocklight: "));
  assert.equal(blocks[7], sampleDraft.question);
});

test("the sample post passes every check", () => {
  const result = checkPost(samplePost());
  assert.deepEqual(result.problems, []);
  assert.equal(result.ok, true);
  assert.ok(result.score <= 25);
});

test("rejects an em dash", () => {
  const result = checkPost(samplePost({ intro: "Most of these run in a browser — two keep data local." }));
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((problem) => problem.includes("em dash")));
});

test("rejects an en dash", () => {
  const result = checkPost(samplePost({ intro: "Pages 1–3 cover setup." }));
  assert.equal(result.ok, false);
});

test("rejects a hook longer than the LinkedIn fold", () => {
  const result = checkPost(samplePost({ hook: "a".repeat(HOOK_MAX_CHARS + 1) }));
  assert.ok(result.problems.some((problem) => problem.startsWith("Hook is")));
});

test("rejects a post over 3000 characters", () => {
  const long = "Words that go on. ".repeat(200);
  const result = checkPost(samplePost({ intro: long }));
  assert.ok(result.problems.some((problem) => problem.includes("3000")));
});

test("rejects a URL written by the model", () => {
  const entries = sampleEntries();
  entries[0] = { ...entries[0], blurb: "See https://example.com for more." };
  const result = checkPost(samplePost({ entries }));
  assert.ok(result.problems.some((problem) => problem.includes("URL")));
});

test("rejects markdown bold", () => {
  const result = checkPost(samplePost({ intro: "These are **really** good." }));
  assert.ok(result.problems.some((problem) => problem.includes("markdown")));
});

test("rejects an empty blurb", () => {
  const entries = sampleEntries();
  entries[2] = { ...entries[2], blurb: "  " };
  const result = checkPost(samplePost({ entries }));
  assert.ok(result.problems.some((problem) => problem.includes("blurb")));
});

test("rejects a sloppy post and names what was flagged", () => {
  const result = checkPost(samplePost({
    intro: "These groundbreaking tools seamlessly empower you to delve into a vibrant tapestry of robust, transformative, cutting-edge geospatial workflows."
  }));
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((problem) => problem.startsWith("Sloplint score")));
});
```

- [ ] **Step 3: Run and see them fail**

Run: `npm test`
Expected: FAIL, cannot find `post-format.js`.

- [ ] **Step 4: Write `api/_lib/post-format.js`**

```js
import { scoreProse } from "./slop.js";

export const MAX_POST_CHARS = 3000;
export const HOOK_MAX_CHARS = 210;
export const MAX_SLOP_SCORE = 25;
export const MAX_TITLE_CHARS = 60;

const DASHES = /[–—]/;
const URL_PATTERN = /https?:\/\//i;
const URL_LINE = /^https?:\/\/\S+$/;
const MARKDOWN = /\*\*|__|^#{1,6}\s/m;

export function assemblePost({ hook, intro, question, entries }) {
  const list = entries.map((entry, index) => `${index + 1}. ${entry.title.trim()}: ${entry.blurb.trim()}\n${entry.url}`);
  return [hook.trim(), intro.trim(), ...list, question.trim()].join("\n\n");
}

export function checkPost({ hook, intro, question, entries, bodyText }) {
  const problems = [];
  const written = [hook, intro, question, ...entries.flatMap((entry) => [entry.title, entry.blurb])];

  if (!hook.trim()) problems.push("Hook is empty.");
  if (hook.trim().length > HOOK_MAX_CHARS) {
    problems.push(`Hook is ${hook.trim().length} characters; keep it to ${HOOK_MAX_CHARS} so it shows before "see more".`);
  }
  if (!question.trim()) problems.push("Closing question is empty.");
  entries.forEach((entry, index) => {
    if (!entry.title.trim()) problems.push(`Entry ${index + 1} has an empty title.`);
    if (entry.title.trim().length > MAX_TITLE_CHARS) problems.push(`Entry ${index + 1} title is over ${MAX_TITLE_CHARS} characters.`);
    if (!entry.blurb.trim()) problems.push(`Entry ${index + 1} has an empty blurb.`);
  });
  if (written.some((text) => URL_PATTERN.test(text))) problems.push("Remove every URL from your text; links are added automatically.");
  if (written.some((text) => MARKDOWN.test(text))) problems.push("Remove markdown formatting (** or #); LinkedIn shows it as literal symbols.");
  if (DASHES.test(bodyText)) problems.push("Replace every em dash and en dash with a period, comma, colon, or parentheses.");
  if (bodyText.length > MAX_POST_CHARS) problems.push(`Post is ${bodyText.length} characters; LinkedIn allows ${MAX_POST_CHARS}.`);

  const { score, findings } = scoreProse(proseForScoring(bodyText));
  if (score > MAX_SLOP_SCORE) {
    problems.push(`Sloplint score ${score} is above ${MAX_SLOP_SCORE}. Rewrite these: ${describeFindings(findings)}.`);
  }

  return { ok: problems.length === 0, score, problems };
}

function proseForScoring(text) {
  return text.split("\n").filter((line) => !URL_LINE.test(line.trim())).join("\n");
}

function describeFindings(findings) {
  const labels = [...new Set(findings.map((finding) => `${finding.id} ("${finding.match}")`))];
  return labels.slice(0, 10).join("; ");
}
```

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: all pass. If "the sample post passes every check" fails on score, print `checkPost(samplePost()).score` and the findings, and fix the fixture text (not the threshold).

- [ ] **Step 6: Commit**

```bash
git add api/_lib/post-format.js tests/post-format.test.mjs tests/fixtures/sample-draft.mjs
git commit -m "feat: assemble LinkedIn post text and check it against the gate"
```

---

### Task 3: Write, gate, rewrite once

**Files:**
- Create: `api/_lib/compose.js`
- Test: `tests/compose.test.mjs`

**Interfaces:**
- Consumes: `assemblePost`, `checkPost` from Task 2
- Produces: `composePost({ repos: Array<{ id, fullName, url }>, write: ({ repos, feedback }) => Promise<Draft> })` resolving to `{ ok: true, attempts, draft, entries, bodyText, score }` or `{ ok: false, attempts: 2, problems }`
- `Draft` is `{ theme, hook, intro, question, entries: Array<{ repoId: number, title, blurb }> }`
- `feedback` is `null` on attempt 1, else `{ problems: string[], previous: Draft }`
- Produces: `matchEntries(draft, repos): { list: Array<{ repoId, fullName, url, title, blurb }>, problems: string[] }`

- [ ] **Step 1: Write the failing tests** at `tests/compose.test.mjs`

```js
import test from "node:test";
import assert from "node:assert/strict";
import { composePost } from "../api/_lib/compose.js";
import { sampleDraft, sampleRepos } from "./fixtures/sample-draft.mjs";

function writerReturning(...drafts) {
  const calls = [];
  const write = async (input) => {
    calls.push(input);
    return drafts[Math.min(calls.length - 1, drafts.length - 1)];
  };
  return { write, calls };
}

const sloppy = {
  ...sampleDraft,
  intro: "These groundbreaking tools seamlessly empower you to delve into a vibrant tapestry of robust, transformative workflows — truly game-changing."
};

test("publishes on the first attempt when the draft passes", async () => {
  const { write, calls } = writerReturning(sampleDraft);
  const result = await composePost({ repos: sampleRepos, write });
  assert.equal(result.ok, true);
  assert.equal(result.attempts, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].feedback, null);
  assert.ok(result.bodyText.includes("https://github.com/opengeos/RustGIS"));
});

test("rewrites once with the problems and the previous draft", async () => {
  const { write, calls } = writerReturning(sloppy, sampleDraft);
  const result = await composePost({ repos: sampleRepos, write });
  assert.equal(result.ok, true);
  assert.equal(result.attempts, 2);
  assert.ok(calls[1].feedback.problems.length > 0);
  assert.equal(calls[1].feedback.previous, sloppy);
});

test("gives up after two failing drafts", async () => {
  const { write, calls } = writerReturning(sloppy, sloppy, sampleDraft);
  const result = await composePost({ repos: sampleRepos, write });
  assert.equal(result.ok, false);
  assert.equal(result.attempts, 2);
  assert.equal(calls.length, 2);
  assert.ok(result.problems.length > 0);
});

test("treats an unknown repo id as a failure", async () => {
  const bad = { ...sampleDraft, entries: [...sampleDraft.entries.slice(0, 4), { repoId: 999, title: "X", blurb: "Y." }] };
  const { write } = writerReturning(bad, bad);
  const result = await composePost({ repos: sampleRepos, write });
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((problem) => problem.includes("999")));
});

test("treats a duplicated repo as a failure", async () => {
  const bad = { ...sampleDraft, entries: [...sampleDraft.entries.slice(0, 4), sampleDraft.entries[0]] };
  const { write } = writerReturning(bad, bad);
  const result = await composePost({ repos: sampleRepos, write });
  assert.equal(result.ok, false);
});

test("treats four entries as a failure", async () => {
  const bad = { ...sampleDraft, entries: sampleDraft.entries.slice(0, 4) };
  const { write } = writerReturning(bad, bad);
  const result = await composePost({ repos: sampleRepos, write });
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((problem) => problem.includes("Expected 5")));
});
```

- [ ] **Step 2: Run and see them fail**

Run: `npm test`
Expected: FAIL, cannot find `compose.js`.

- [ ] **Step 3: Write `api/_lib/compose.js`**

```js
import { assemblePost, checkPost } from "./post-format.js";

const MAX_ATTEMPTS = 2;

export async function composePost({ repos, write }) {
  let feedback = null;
  let problems = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const draft = await write({ repos, feedback });
    const matched = matchEntries(draft, repos);

    if (matched.problems.length) {
      problems = matched.problems;
    } else {
      const parts = { hook: draft.hook, intro: draft.intro, question: draft.question, entries: matched.list };
      const bodyText = assemblePost(parts);
      const check = checkPost({ ...parts, bodyText });
      if (check.ok) return { ok: true, attempts: attempt, draft, entries: matched.list, bodyText, score: check.score };
      problems = check.problems;
    }

    feedback = { problems, previous: draft };
  }

  return { ok: false, attempts: MAX_ATTEMPTS, problems };
}

export function matchEntries(draft, repos) {
  const byId = new Map(repos.map((repo) => [Number(repo.id), repo]));
  const seen = new Set();
  const list = [];
  const problems = [];

  for (const entry of draft.entries || []) {
    const repo = byId.get(Number(entry.repoId));
    if (!repo) {
      problems.push(`Entry uses repoId ${entry.repoId}, which is not one of the five repos.`);
      continue;
    }
    if (seen.has(repo.id)) {
      problems.push(`repoId ${entry.repoId} appears more than once.`);
      continue;
    }
    seen.add(repo.id);
    list.push({
      repoId: Number(repo.id),
      fullName: repo.fullName,
      url: repo.url,
      title: String(entry.title || ""),
      blurb: String(entry.blurb || "")
    });
  }

  if (list.length !== repos.length) problems.push(`Expected ${repos.length} entries, one per repo; got ${list.length}.`);
  return { list, problems };
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/compose.js tests/compose.test.mjs
git commit -m "feat: gate drafts and allow one rewrite with feedback"
```

---

### Task 4: The writer prompt and OpenAI call

**Files:**
- Create: `api/_lib/writer.js`
- Test: `tests/writer.test.mjs`

**Interfaces:**
- Consumes: `bannedWords` from Task 1; `HOOK_MAX_CHARS`, `MAX_POST_CHARS` from Task 2
- Produces: `WRITER_MODEL: string`
- Produces: `buildMessages({ repos: Array<{ id, fullName, description, topics, starredAt, readme }>, feedback }): Array<{ role, content }>`
- Produces: `parseDraft(completionJson): Draft` (throws on refusal or missing content)
- Produces: `writeDraft({ repos, feedback }): Promise<Draft>` (the `write` function for Task 3)

- [ ] **Step 1: Write the failing tests** at `tests/writer.test.mjs`

```js
import test from "node:test";
import assert from "node:assert/strict";
import { buildMessages, parseDraft } from "../api/_lib/writer.js";
import { sampleDraft } from "./fixtures/sample-draft.mjs";

const repos = [
  { id: 1, fullName: "opengeos/GeoLibre", description: "Cloud-native GIS", topics: ["gis"], starredAt: "2026-10-13T18:23:24.000Z", readme: "# GeoLibre\nRuns in Jupyter." },
  { id: 2, fullName: "someone/empty", description: "Thin repo", topics: [], starredAt: "2026-10-12T10:00:00.000Z", readme: "" }
];

test("system prompt carries the core rules", () => {
  const [system] = buildMessages({ repos, feedback: null });
  assert.equal(system.role, "system");
  for (const rule of ["em dash", "Never write a URL", "only facts", "never claim Tarik used", "210", "delve"]) {
    assert.ok(system.content.includes(rule), `missing rule: ${rule}`);
  }
});

test("user prompt includes every repo id, README and starred date", () => {
  const [, user] = buildMessages({ repos, feedback: null });
  assert.ok(user.content.includes("Repo id: 1"));
  assert.ok(user.content.includes("Runs in Jupyter."));
  assert.ok(user.content.includes("2026-10-13"));
});

test("a missing README is marked so the writer stays short", () => {
  const [, user] = buildMessages({ repos, feedback: null });
  assert.ok(user.content.includes("(no README)"));
});

test("feedback adds the previous draft and the problems", () => {
  const messages = buildMessages({ repos, feedback: { problems: ["Hook is 300 characters"], previous: sampleDraft } });
  const last = messages.at(-1).content;
  assert.ok(last.includes("Hook is 300 characters"));
  assert.ok(last.includes(sampleDraft.hook));
});

test("parseDraft returns the JSON content", () => {
  const draft = parseDraft({ choices: [{ message: { content: JSON.stringify(sampleDraft) } }] });
  assert.equal(draft.theme, sampleDraft.theme);
});

test("parseDraft throws on refusal", () => {
  assert.throws(() => parseDraft({ choices: [{ message: { refusal: "no" } }] }), /refused/);
});

test("parseDraft throws on empty content", () => {
  assert.throws(() => parseDraft({ choices: [] }), /no content/);
});
```

- [ ] **Step 2: Run and see them fail**

Run: `npm test`
Expected: FAIL, cannot find `writer.js`.

- [ ] **Step 3: Write `api/_lib/writer.js`**

```js
import { bannedWords } from "./slop.js";
import { HOOK_MAX_CHARS, MAX_POST_CHARS } from "./post-format.js";

export const WRITER_MODEL = process.env.OPENAI_WRITER_MODEL || "gpt-5";

const FORMAT_EXAMPLE = `1. GeoLibre: A lightweight, cloud-native GIS platform for visualizing, exploring, and analyzing geospatial data. It runs in the web browser, on the desktop, on mobile, and inside Jupyter notebooks.
https://github.com/opengeos/GeoLibre

2. RustGIS: A fast, free and open-source GIS in pure Rust for mapping, analyzing and sharing geospatial data. Native on Windows, macOS and Linux, and in your web browser. Your data stays on your machine unless you send it to an AI model you choose, and every action is a command you can script.
https://github.com/opengeos/RustGIS`;

const DRAFT_SCHEMA = {
  name: "daily_picks_draft",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["theme", "hook", "intro", "entries", "question"],
    properties: {
      theme: { type: "string", description: "2 to 5 words naming what the five projects share. Sentence case. 40 characters or fewer." },
      hook: { type: "string", description: `The opening line of the post. ${HOOK_MAX_CHARS} characters or fewer.` },
      intro: { type: "string", description: "1 to 3 short sentences after the hook." },
      entries: {
        type: "array",
        description: "One entry per repo, in the order you want them read.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["repoId", "title", "blurb"],
          properties: {
            repoId: { type: "integer" },
            title: { type: "string", description: "The project's name as its README writes it. No tagline." },
            blurb: { type: "string", description: "1 to 3 sentences, 320 characters or fewer." }
          }
        }
      },
      question: { type: "string", description: "One specific closing question readers can answer from experience." }
    }
  }
};

function systemPrompt() {
  return `You write a weekday LinkedIn post for Tarik Moody: five GitHub projects from his starred repos that share a theme.

The post reads like a person who saves interesting projects and is passing along the good ones. Plain, specific, a little opinionated. Not a press release.

What you return is assembled into this shape by code:
{hook}

{intro}

1. {title}: {blurb}
{url added by code}
...

{question}

Here is Tarik's own format for the entries:
${FORMAT_EXAMPLE}

Rules:
- The hook is the only part people see before LinkedIn's "see more" cut. Keep it to ${HOOK_MAX_CHARS} characters. Make it concrete: say what these five have in common or what surprised you. No questions as hooks, no "Here are 5".
- The intro says why these five belong together in 1 to 3 short sentences.
- Each blurb starts with what the project is, then gives one or two specific details from its README.
- Use only facts found in that repo's README, description or topics. If a README is thin or missing, write a shorter blurb. Never fill gaps with guesses.
- You may react ("this one caught my eye", "I want to try this on our station logs") but never claim Tarik used, tested or deployed a project. He starred it; that is all you know.
- The starred date is real data. You may say "starred this week" only when the dates support it.
- Never write a URL. Links are added automatically.
- Plain text only. No markdown, no bold, no headings, no emojis, no hashtags.
- Never use an em dash or en dash. Use a period, comma, colon, or parentheses.
- Avoid three-item lists written for rhythm; two items often read better. Do not copy triplets from READMEs word for word.
- Vary sentence length. Repeat the clearest word instead of cycling synonyms.
- No "not just X, it's Y", no "Here's the thing", no "Let's dive in", no generic upbeat ending, no "game-changer".
- Never use these words: ${bannedWords().join(", ")}.
- The question is specific and answerable from experience, such as which one readers would open first or what they use instead. Not "What do you think?".
- The whole post must stay under ${MAX_POST_CHARS} characters including links. Aim for 1,200 to 2,000.`;
}

function repoBlock(repo) {
  const readme = repo.readme?.trim() ? repo.readme.trim() : "(no README)";
  return [
    `Repo id: ${repo.id}`,
    `Full name: ${repo.fullName}`,
    `Description: ${repo.description || "(none)"}`,
    `Topics: ${(repo.topics || []).join(", ") || "(none)"}`,
    `Starred on: ${String(repo.starredAt || "").slice(0, 10) || "(unknown)"}`,
    "README excerpt:",
    "<<<",
    readme,
    ">>>"
  ].join("\n");
}

export function buildMessages({ repos, feedback }) {
  const messages = [
    { role: "system", content: systemPrompt() },
    {
      role: "user",
      content: `Today's five repos. Use each repoId exactly once.\n\n${repos.map(repoBlock).join("\n\n")}`
    }
  ];

  if (feedback) {
    messages.push({
      role: "user",
      content: `Your previous draft failed these checks:\n${feedback.problems.map((problem) => `- ${problem}`).join("\n")}\n\nPrevious draft:\n${JSON.stringify(feedback.previous, null, 2)}\n\nReturn a corrected draft. Fix every problem and keep what already worked.`
    });
  }

  return messages;
}

export function parseDraft(json) {
  const message = json?.choices?.[0]?.message;
  if (message?.refusal) throw new Error(`Writer refused: ${message.refusal}`);
  if (!message?.content) throw new Error("Writer returned no content.");
  return JSON.parse(message.content);
}

export async function writeDraft({ repos, feedback = null }) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured.");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: WRITER_MODEL,
      messages: buildMessages({ repos, feedback }),
      response_format: { type: "json_schema", json_schema: DRAFT_SCHEMA }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI writer request failed: ${response.status} ${body.slice(0, 240)}`);
  }

  return parseDraft(await response.json());
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/writer.js tests/writer.test.mjs
git commit -m "feat: add the post writer prompt and OpenAI call"
```

---

### Task 5: Dates and post storage

**Files:**
- Create: `api/_lib/dates.js`, `api/_lib/post-store.js`
- Modify: `scripts/migrate.mjs`
- Test: `tests/dates.test.mjs`, `tests/integration/post-store.test.mjs`

**Interfaces:**
- Produces: `todayInChicago(now?: Date): string` (`YYYY-MM-DD`)
- Produces: `initPostSchema(db?): Promise<void>`
- Produces: `findPostByDate(date: string, db?): Promise<Post | null>`
- Produces: `listPosts({ limit = 20 } = {}, db?): Promise<Post[]>` newest first
- Produces: `savePost(post: NewPost, db?): Promise<number>` (post id)
- `NewPost` is `{ date, theme, hook, bodyText, entries, seedRepoId, score, attempts, writerModel }`
- `Post` is `{ id, date, theme, hook, bodyText, entries, score, attempts }`

- [ ] **Step 1: Write the failing date tests** at `tests/dates.test.mjs`

```js
import test from "node:test";
import assert from "node:assert/strict";
import { todayInChicago } from "../api/_lib/dates.js";

test("00:30 UTC belongs to the previous Central day", () => {
  assert.equal(todayInChicago(new Date("2026-10-15T00:30:00Z")), "2026-10-14");
});

test("noon UTC is the same Central day", () => {
  assert.equal(todayInChicago(new Date("2026-12-15T12:00:00Z")), "2026-12-15");
});
```

- [ ] **Step 2: Run and see them fail**, then write `api/_lib/dates.js`

```js
export function todayInChicago(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}
```

Run: `npm test`. Expected: date tests pass.

- [ ] **Step 3: Create a throwaway Neon branch for integration tests**

Use the Neon MCP (`list_projects`, then `create_branch` named `daily-picks-test` from the production branch, then `get_connection_string` for it). The branch starts as a copy of the real `repos` data. Save the connection string only in the shell, never in a file in the repo:

```bash
export TEST_DATABASE_URL='<branch connection string>'
```

- [ ] **Step 4: Write the failing integration test** at `tests/integration/post-store.test.mjs`

```js
import test from "node:test";
import assert from "node:assert/strict";

const enabled = Boolean(process.env.TEST_DATABASE_URL);
if (enabled) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const { sql } = await import("../../api/_lib/db.js");
const store = await import("../../api/_lib/post-store.js");

function newPost(date, repoIds) {
  return {
    date,
    theme: "Test theme",
    hook: "Hook",
    bodyText: "Body",
    entries: repoIds.map((repoId, index) => ({ repoId, title: `T${index}`, blurb: "B", url: `https://github.com/x/${repoId}`, fullName: `x/${repoId}` })),
    seedRepoId: repoIds[0],
    score: 10,
    attempts: 1,
    writerModel: "test"
  };
}

test("saves a post and marks its repos used, atomically", { skip: !enabled }, async () => {
  const db = sql();
  await store.initPostSchema();
  await db`DELETE FROM posts WHERE post_date >= '2099-01-01'`;

  const id = await store.savePost(newPost("2099-01-01", [9000000001, 9000000002, 9000000003, 9000000004, 9000000005]));
  assert.ok(id > 0);
  const found = await store.findPostByDate("2099-01-01");
  assert.equal(found.entries.length, 5);
  assert.equal(found.date, "2099-01-01");

  await assert.rejects(store.savePost(newPost("2099-01-01", [9000000006, 9000000007, 9000000008, 9000000009, 9000000010])));
  await assert.rejects(store.savePost(newPost("2099-01-02", [9000000001, 9000000011, 9000000012, 9000000013, 9000000014])));

  const [{ count: posts }] = await db`SELECT COUNT(*)::int AS count FROM posts WHERE post_date >= '2099-01-01'`;
  const [{ count: used }] = await db`SELECT COUNT(*)::int AS count FROM post_repos WHERE repo_id >= 9000000000`;
  assert.equal(posts, 1, "the duplicate date and the reused repo must not create posts");
  assert.equal(used, 5, "a failed save must not leave repos marked used");

  const latest = await store.listPosts({ limit: 1 });
  assert.equal(latest[0].date, "2099-01-01");

  await db`DELETE FROM posts WHERE post_date >= '2099-01-01'`;
});
```

Run: `TEST_DATABASE_URL="$TEST_DATABASE_URL" npm test`. Expected: FAIL, cannot find `post-store.js`.

- [ ] **Step 5: Write `api/_lib/post-store.js`**

```js
import { sql } from "./db.js";

export async function initPostSchema(db = sql()) {
  await db`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      post_date DATE NOT NULL UNIQUE,
      theme TEXT NOT NULL,
      hook TEXT NOT NULL,
      body_text TEXT NOT NULL,
      entries JSONB NOT NULL,
      seed_repo_id BIGINT NOT NULL,
      sloplint_score INTEGER NOT NULL,
      attempts SMALLINT NOT NULL,
      writer_model TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  // No foreign key to repos on purpose: a future cleanup of unstarred repos must never be blocked
  // by an old post. The primary key alone guarantees a repo is featured at most once.
  await db`
    CREATE TABLE IF NOT EXISTS post_repos (
      repo_id BIGINT PRIMARY KEY,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      position SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 5)
    )
  `;
}

// One statement, so the post and its five "used" rows are saved together or not at all.
export async function savePost(post, db = sql()) {
  const picks = JSON.stringify(post.entries.map((entry, index) => ({ repo_id: entry.repoId, position: index + 1 })));
  const rows = await db`
    WITH new_post AS (
      INSERT INTO posts (post_date, theme, hook, body_text, entries, seed_repo_id, sloplint_score, attempts, writer_model)
      VALUES (
        ${post.date}::date, ${post.theme}, ${post.hook}, ${post.bodyText}, ${JSON.stringify(post.entries)}::jsonb,
        ${post.seedRepoId}, ${post.score}, ${post.attempts}, ${post.writerModel}
      )
      RETURNING id
    )
    INSERT INTO post_repos (repo_id, post_id, position)
    SELECT pick.repo_id, new_post.id, pick.position
    FROM new_post, jsonb_to_recordset(${picks}::jsonb) AS pick(repo_id BIGINT, position SMALLINT)
    RETURNING post_id
  `;
  return rows[0].post_id;
}

export async function findPostByDate(date, db = sql()) {
  const rows = await db`
    SELECT id, post_date::text AS post_date, theme, hook, body_text, entries, sloplint_score, attempts
    FROM posts
    WHERE post_date = ${date}::date
  `;
  return rows[0] ? rowToPost(rows[0]) : null;
}

export async function listPosts({ limit = 20 } = {}, db = sql()) {
  const rows = await db`
    SELECT id, post_date::text AS post_date, theme, hook, body_text, entries, sloplint_score, attempts
    FROM posts
    ORDER BY post_date DESC
    LIMIT ${limit}
  `;
  return rows.map(rowToPost);
}

function rowToPost(row) {
  return {
    id: row.id,
    date: row.post_date,
    theme: row.theme,
    hook: row.hook,
    bodyText: row.body_text,
    entries: typeof row.entries === "string" ? JSON.parse(row.entries) : row.entries,
    score: row.sloplint_score,
    attempts: row.attempts
  };
}
```

- [ ] **Step 6: Add the tables to the migrate script.** Replace `scripts/migrate.mjs` with:

```js
import { initSchema, repoStats } from "../api/_lib/repo-store.js";
import { initPostSchema } from "../api/_lib/post-store.js";

await initSchema();
await initPostSchema();
const stats = await repoStats();
console.log(JSON.stringify({ ok: true, ...stats }, null, 2));
```

- [ ] **Step 7: Run unit and integration tests**

Run: `npm test && TEST_DATABASE_URL="$TEST_DATABASE_URL" npm test`
Expected: unit tests pass with the integration test reported as skipped; then everything passes with the integration test run.

- [ ] **Step 8: Commit**

```bash
git add api/_lib/dates.js api/_lib/post-store.js scripts/migrate.mjs tests/dates.test.mjs tests/integration/post-store.test.mjs
git commit -m "feat: store posts and enforce one use per repo in the database"
```

---

### Task 6: The picker

**Files:**
- Create: `api/_lib/picker.js`, `scripts/preview-picks.mjs`
- Modify: `api/_lib/github.js` (append `fetchRepoDetails`)
- Test: `tests/picker.test.mjs`

**Interfaces:**
- Produces (picker.js): constants `PICK_COUNT = 5`, `SEED_RECENT_MAX_SIMILARITY = 0.8`, `NEIGHBOR_MIN_SIMILARITY = 0.45`, `MAX_SEEDS_TRIED = 20`
- Produces: `keepActive(candidates, detailsFor, count): Promise<Array<Candidate & { readme }> | null>` where the seed is `candidates[0]` and must survive
- Produces: `pickRepos({ db?, detailsFor? }): Promise<{ seedRepoId: number, repos: Array<{ id, fullName, name, description, topics, url, starredAt, readme }> }>`
- Produces (github.js): `fetchRepoDetails(fullName): Promise<{ archived: boolean, readme: string } | null>` (`null` when the repo is gone)

- [ ] **Step 1: Write the failing tests** at `tests/picker.test.mjs`

```js
import test from "node:test";
import assert from "node:assert/strict";
import { keepActive } from "../api/_lib/picker.js";

const candidates = ["seed", "a", "b", "c", "d", "e", "f"].map((name, index) => ({ id: index + 1, fullName: `x/${name}` }));

function details(map) {
  return async (fullName) => (fullName in map ? map[fullName] : { archived: false, readme: `readme ${fullName}` });
}

test("keeps the seed and the first four active neighbors", async () => {
  const kept = await keepActive(candidates, details({}), 5);
  assert.deepEqual(kept.map((repo) => repo.fullName), ["x/seed", "x/a", "x/b", "x/c", "x/d"]);
  assert.equal(kept[0].readme, "readme x/seed");
});

test("skips archived and deleted neighbors", async () => {
  const kept = await keepActive(candidates, details({ "x/a": { archived: true, readme: "" }, "x/b": null }), 5);
  assert.deepEqual(kept.map((repo) => repo.fullName), ["x/seed", "x/c", "x/d", "x/e", "x/f"]);
});

test("rejects the whole set when the seed is archived", async () => {
  assert.equal(await keepActive(candidates, details({ "x/seed": { archived: true, readme: "" } }), 5), null);
});

test("returns null when too few neighbors survive", async () => {
  const archived = { archived: true, readme: "" };
  const kept = await keepActive(candidates, details({ "x/a": archived, "x/b": archived, "x/c": archived }), 5);
  assert.equal(kept, null);
});
```

- [ ] **Step 2: Run and see them fail**

Run: `npm test`. Expected: FAIL, cannot find `picker.js`.

- [ ] **Step 3: Append `fetchRepoDetails` to `api/_lib/github.js`**

```js
const README_MAX_CHARS = 6000;

function githubHeaders(accept) {
  const headers = { Accept: accept, "User-Agent": "github-stars-index" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

export async function fetchRepoDetails(fullName) {
  const repoResponse = await fetch(`https://api.github.com/repos/${fullName}`, {
    headers: githubHeaders("application/vnd.github+json")
  });
  if (repoResponse.status === 404) return null;
  if (!repoResponse.ok) {
    const remaining = repoResponse.headers.get("x-ratelimit-remaining");
    throw new Error(`GitHub returned ${repoResponse.status} for ${fullName}. Remaining API calls: ${remaining ?? "unknown"}. Set GITHUB_TOKEN to raise the limit.`);
  }
  const repo = await repoResponse.json();

  const readmeResponse = await fetch(`https://api.github.com/repos/${fullName}/readme`, {
    headers: githubHeaders("application/vnd.github.raw+json")
  });
  const readme = readmeResponse.ok ? await readmeResponse.text() : "";

  return { archived: Boolean(repo.archived || repo.disabled), readme: readme.slice(0, README_MAX_CHARS) };
}
```

- [ ] **Step 4: Write `api/_lib/picker.js`**

```js
import { sql } from "./db.js";
import { fetchRepoDetails } from "./github.js";

export const PICK_COUNT = 5;
// Starting values from the spec; tuned with scripts/preview-picks.mjs before launch.
export const SEED_RECENT_MAX_SIMILARITY = 0.8;
export const NEIGHBOR_MIN_SIMILARITY = 0.45;
export const MAX_SEEDS_TRIED = 20;
const NEIGHBOR_POOL = 8;

export async function pickRepos({ db = sql(), detailsFor = fetchRepoDetails } = {}) {
  const seeds = await findSeedCandidates(db);
  for (const seed of seeds) {
    const neighbors = await findNeighbors(db, seed.id);
    const kept = await keepActive([seed, ...neighbors], detailsFor, PICK_COUNT);
    if (kept) return { seedRepoId: seed.id, repos: kept };
  }
  throw new Error(`No unused theme found after trying ${seeds.length} seed repos.`);
}

export async function keepActive(candidates, detailsFor, count) {
  const kept = [];
  for (const [index, repo] of candidates.entries()) {
    if (kept.length === count) break;
    const details = await detailsFor(repo.fullName);
    const active = details && !details.archived;
    if (!active && index === 0) return null;
    if (active) kept.push({ ...repo, readme: details.readme });
  }
  return kept.length === count ? kept : null;
}

async function findSeedCandidates(db) {
  const rows = await db`
    SELECT r.id, r.full_name, r.name, r.description, r.topics, r.url, r.starred_at
    FROM repos r
    WHERE r.embedding IS NOT NULL
      AND r.description <> ''
      AND NOT EXISTS (SELECT 1 FROM post_repos used WHERE used.repo_id = r.id)
      AND NOT EXISTS (
        SELECT 1
        FROM (SELECT seed_repo_id FROM posts ORDER BY post_date DESC LIMIT 3) recent
        JOIN repos s ON s.id = recent.seed_repo_id
        WHERE 1 - (s.embedding <=> r.embedding) > ${SEED_RECENT_MAX_SIMILARITY}
      )
    ORDER BY r.starred_at DESC NULLS LAST
    LIMIT ${MAX_SEEDS_TRIED}
  `;
  return rows.map(rowToCandidate);
}

async function findNeighbors(db, seedId) {
  // "+ 0" forces an exact scan instead of the approximate index, matching searchRepos; 992 rows is cheap.
  const rows = await db`
    SELECT r.id, r.full_name, r.name, r.description, r.topics, r.url, r.starred_at
    FROM repos r, repos s
    WHERE s.id = ${seedId}
      AND r.id <> s.id
      AND r.embedding IS NOT NULL
      AND r.description <> ''
      AND NOT EXISTS (SELECT 1 FROM post_repos used WHERE used.repo_id = r.id)
      AND 1 - (r.embedding <=> s.embedding) >= ${NEIGHBOR_MIN_SIMILARITY}
    ORDER BY (r.embedding <=> s.embedding) + 0
    LIMIT ${NEIGHBOR_POOL}
  `;
  return rows.map(rowToCandidate);
}

function rowToCandidate(row) {
  return {
    id: Number(row.id),
    fullName: row.full_name,
    name: row.name,
    description: row.description,
    topics: Array.isArray(row.topics) ? row.topics : JSON.parse(row.topics || "[]"),
    url: row.url,
    starredAt: row.starred_at instanceof Date ? row.starred_at.toISOString() : row.starred_at
  };
}
```

- [ ] **Step 5: Run the unit tests**

Run: `npm test`. Expected: picker tests pass.

- [ ] **Step 6: Write `scripts/preview-picks.mjs`** to simulate the next N days on the test branch only

```js
// Simulates the next N weekday picks on a TEST database by marking picks as used.
// Usage: TEST_DATABASE_URL=... node scripts/preview-picks.mjs 10
if (!process.env.TEST_DATABASE_URL) {
  console.error("Set TEST_DATABASE_URL to a throwaway Neon branch. This script writes rows.");
  process.exit(1);
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const { sql } = await import("../api/_lib/db.js");
const { initPostSchema, savePost } = await import("../api/_lib/post-store.js");
const { pickRepos } = await import("../api/_lib/picker.js");

const days = Number(process.argv[2] || 10);
await initPostSchema();

for (let day = 0; day < days; day += 1) {
  const date = new Date(Date.UTC(2099, 5, 1 + day)).toISOString().slice(0, 10);
  const { seedRepoId, repos } = await pickRepos();
  console.log(`\n${date}  seed: ${repos[0].fullName}`);
  repos.forEach((repo) => console.log(`  - ${repo.fullName}: ${repo.description.slice(0, 90)}`));
  await savePost({
    date,
    theme: "preview",
    hook: "",
    bodyText: "",
    entries: repos.map((repo) => ({ repoId: repo.id, title: repo.name, blurb: "", url: repo.url, fullName: repo.fullName })),
    seedRepoId,
    score: 0,
    attempts: 0,
    writerModel: "preview"
  });
}

await sql()`DELETE FROM posts WHERE post_date >= '2099-01-01'`;
```

- [ ] **Step 7: Run the preview against the test branch and tune**

Run: `TEST_DATABASE_URL="$TEST_DATABASE_URL" node scripts/preview-picks.mjs 10`
Expected: 10 days, each with 5 repos that clearly share a subject, and no two consecutive days on the same subject. If groups look loose, raise `NEIGHBOR_MIN_SIMILARITY` by 0.05 and rerun; if consecutive days repeat a subject, lower `SEED_RECENT_MAX_SIMILARITY` by 0.05. Record the final values in the constants and paste the 10-day output into the PR description.

- [ ] **Step 8: Commit**

```bash
git add api/_lib/picker.js api/_lib/github.js scripts/preview-picks.mjs tests/picker.test.mjs
git commit -m "feat: pick five similar unused repos from embeddings"
```

---

### Task 7: Endpoints, auth and cron

**Files:**
- Create: `api/_lib/auth.js`, `api/generate-post.js`, `api/posts.js`
- Modify: `api/refresh.js` (remove local `isAuthorizedCron`, import it), `vercel.json`
- Test: `tests/auth.test.mjs`, `tests/generate-post.test.mjs`

**Interfaces:**
- Produces: `isAuthorizedCron(request): boolean`, `isAuthorizedAdmin(request): boolean`
- Produces: `createHandler(deps)` in `generate-post.js`, plus the default export built from real deps. `deps` is `{ hasDatabase, initSchemas, today, findPostByDate, pickRepos, composePost, write, savePost, writerModel }`.

- [ ] **Step 1: Write the failing auth tests** at `tests/auth.test.mjs`

```js
import test from "node:test";
import assert from "node:assert/strict";
import { isAuthorizedAdmin, isAuthorizedCron } from "../api/_lib/auth.js";

function withEnv(env, fn) {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  try { return fn(); } finally { process.env = saved; }
}

test("cron needs the bearer secret", () => withEnv({ CRON_SECRET: "s3cret" }, () => {
  assert.equal(isAuthorizedCron({ headers: { authorization: "Bearer s3cret" } }), true);
  assert.equal(isAuthorizedCron({ headers: { authorization: "Bearer nope" } }), false);
  assert.equal(isAuthorizedCron({ headers: {} }), false);
}));

test("admin needs the header token on Vercel", () => withEnv({ POSTS_ADMIN_TOKEN: "abc", VERCEL: "1" }, () => {
  assert.equal(isAuthorizedAdmin({ headers: { "x-admin-token": "abc" }, query: {} }), true);
  assert.equal(isAuthorizedAdmin({ headers: { "x-admin-token": "abd" }, query: {} }), false);
  assert.equal(isAuthorizedAdmin({ headers: {}, query: { token: "abc" } }), false);
}));

test("admin is refused on Vercel when no token is configured", () => withEnv({ POSTS_ADMIN_TOKEN: "", VERCEL: "1" }, () => {
  assert.equal(isAuthorizedAdmin({ headers: { "x-admin-token": "" }, query: {} }), false);
}));
```

- [ ] **Step 2: Run and see them fail**, then write `api/_lib/auth.js`

```js
import { timingSafeEqual } from "node:crypto";

function sameSecret(provided, expected) {
  if (!provided || !expected) return false;
  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(expected));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isAuthorizedCron(request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && sameSecret(request.headers.authorization, `Bearer ${secret}`);
}

// Local runs (no VERCEL env) with no token configured are allowed, matching /api/refresh.
export function isAuthorizedAdmin(request) {
  const token = process.env.POSTS_ADMIN_TOKEN;
  if (!token) return !process.env.VERCEL;
  return sameSecret(request.headers["x-admin-token"], token);
}
```

In `api/refresh.js`, delete the local `isAuthorizedCron` function and add `import { isAuthorizedCron } from "./_lib/auth.js";` at the top. Run `npm test`. Expected: auth tests pass.

- [ ] **Step 3: Write the failing handler tests** at `tests/generate-post.test.mjs`

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../api/generate-post.js";
import { sampleRepos } from "./fixtures/sample-draft.mjs";

function fakeResponse() {
  return {
    statusCode: 0, body: null, headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function deps(overrides = {}) {
  const saved = [];
  return {
    saved,
    hasDatabase: () => true,
    initSchemas: async () => {},
    today: () => "2026-10-15",
    findPostByDate: async () => null,
    pickRepos: async () => ({ seedRepoId: 1, repos: sampleRepos }),
    composePost: async () => ({ ok: true, attempts: 1, draft: { theme: "Open-source GIS", hook: "Hook" }, entries: [], bodyText: "Body", score: 12 }),
    write: async () => ({}),
    savePost: async (post) => { saved.push(post); return 7; },
    writerModel: "test-model",
    ...overrides
  };
}

const admin = (query = {}) => ({ method: "POST", headers: {}, query });

test("publishes and saves a passing post", async () => {
  const d = deps();
  const response = fakeResponse();
  await createHandler(d)(admin(), response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, "published");
  assert.equal(d.saved.length, 1);
  assert.equal(d.saved[0].date, "2026-10-15");
});

test("returns the existing post instead of making a second one", async () => {
  const d = deps({ findPostByDate: async () => ({ id: 3 }) });
  const response = fakeResponse();
  await createHandler(d)(admin(), response);
  assert.equal(response.body.status, "exists");
  assert.equal(d.saved.length, 0);
});

test("a failed gate returns 422 and saves nothing", async () => {
  const d = deps({ composePost: async () => ({ ok: false, attempts: 2, problems: ["Sloplint score 40"] }) });
  const response = fakeResponse();
  await createHandler(d)(admin(), response);
  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.body.problems, ["Sloplint score 40"]);
  assert.equal(d.saved.length, 0);
});

test("dry run returns the post without saving", async () => {
  const d = deps();
  const response = fakeResponse();
  await createHandler(d)(admin({ dryRun: "1" }), response);
  assert.equal(response.body.status, "dry-run");
  assert.equal(d.saved.length, 0);
});

test("GET without the cron secret is refused", async () => {
  const response = fakeResponse();
  await createHandler(deps())({ method: "GET", headers: {}, query: {} }, response);
  assert.equal(response.statusCode, 401);
});
```

Run: `npm test`. Expected: FAIL, cannot find `generate-post.js`.

- [ ] **Step 4: Write `api/generate-post.js`**

```js
import { hasDatabase } from "./_lib/db.js";
import { initSchema } from "./_lib/repo-store.js";
import { initPostSchema, findPostByDate, savePost } from "./_lib/post-store.js";
import { pickRepos } from "./_lib/picker.js";
import { composePost } from "./_lib/compose.js";
import { writeDraft, WRITER_MODEL } from "./_lib/writer.js";
import { todayInChicago } from "./_lib/dates.js";
import { isAuthorizedAdmin, isAuthorizedCron } from "./_lib/auth.js";

export function createHandler(deps) {
  return async function handler(request, response) {
    response.setHeader("Cache-Control", "no-store");

    if (!["GET", "POST"].includes(request.method)) {
      response.setHeader("Allow", "GET, POST");
      return response.status(405).json({ ok: false, error: "Method not allowed." });
    }

    const authorized = request.method === "GET" ? isAuthorizedCron(request) : isAuthorizedAdmin(request);
    if (!authorized) return response.status(401).json({ ok: false, error: "Unauthorized." });
    if (!deps.hasDatabase()) return response.status(501).json({ ok: false, error: "DATABASE_URL is not configured." });

    const dryRun = request.method === "POST" && request.query?.dryRun === "1";

    try {
      await deps.initSchemas();
      const date = deps.today();

      if (!dryRun) {
        const existing = await deps.findPostByDate(date);
        if (existing) return response.status(200).json({ ok: true, status: "exists", post: existing });
      }

      const picked = await deps.pickRepos();
      const composed = await deps.composePost({ repos: picked.repos, write: deps.write });

      if (!composed.ok) {
        console.error("generate-post: gate failed", { date, problems: composed.problems });
        return response.status(422).json({
          ok: false,
          status: "gate-failed",
          problems: composed.problems,
          repos: picked.repos.map((repo) => repo.fullName)
        });
      }

      const post = {
        date,
        theme: composed.draft.theme.trim(),
        hook: composed.draft.hook.trim(),
        bodyText: composed.bodyText,
        entries: composed.entries,
        seedRepoId: picked.seedRepoId,
        score: composed.score,
        attempts: composed.attempts,
        writerModel: deps.writerModel
      };

      if (dryRun) return response.status(200).json({ ok: true, status: "dry-run", post });

      const id = await deps.savePost(post);
      return response.status(200).json({ ok: true, status: "published", post: { id, ...post } });
    } catch (error) {
      console.error("generate-post: failed", error);
      return response.status(500).json({ ok: false, error: error.message });
    }
  };
}

export default createHandler({
  hasDatabase,
  initSchemas: async () => {
    await initSchema();
    await initPostSchema();
  },
  today: () => todayInChicago(),
  findPostByDate: (date) => findPostByDate(date),
  pickRepos: () => pickRepos(),
  composePost,
  write: writeDraft,
  savePost: (post) => savePost(post),
  writerModel: WRITER_MODEL
});
```

- [ ] **Step 5: Write `api/posts.js`**

```js
import { hasDatabase } from "./_lib/db.js";
import { initPostSchema, listPosts } from "./_lib/post-store.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ ok: false, error: "Method not allowed." });
  }
  if (!hasDatabase()) return response.status(501).json({ ok: false, error: "DATABASE_URL is not configured." });

  try {
    await initPostSchema();
    const posts = await listPosts({ limit: 20 });
    response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
    return response.status(200).json({ ok: true, posts });
  } catch (error) {
    response.setHeader("Cache-Control", "no-store");
    return response.status(500).json({ ok: false, error: error.message });
  }
}
```

- [ ] **Step 6: Add the cron to `vercel.json`**

```json
  "crons": [
    { "path": "/api/refresh", "schedule": "0 11 * * *" },
    { "path": "/api/generate-post", "schedule": "0 12 * * 1-5" }
  ]
```

- [ ] **Step 7: Run everything**

Run: `npm test && npm run check && node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8'))"`
Expected: all tests pass, check is silent, JSON parses.

- [ ] **Step 8: Commit**

```bash
git add api/_lib/auth.js api/generate-post.js api/posts.js api/refresh.js vercel.json tests/auth.test.mjs tests/generate-post.test.mjs
git commit -m "feat: add daily post endpoint, posts list, and weekday cron"
```

---

### Task 8: Blog page and title card

**Files:**
- Create: `blog.html`, `blog.js`, `card.js`, `blog.css`
- Modify: `index.html` (nav)

**Interfaces:**
- Consumes: `GET /api/posts` → `{ ok, posts: Post[] }` from Task 7
- Produces: `drawCard(canvas, post): Promise<void>` in `card.js`

- [ ] **Step 1: Write `card.js`.** Palette hex values are the `tokens.css` OKLCH colors converted to sRGB (graphite #161b22, paper #f8fafd, accent #0076ed, accent-soft #d8edff, soft #949ca7, rule-2 #a7b2c1).

```js
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

const PAD = 96;
const CONTENT_WIDTH = CARD_WIDTH - PAD * 2;
const COLORS = {
  background: "#161b22",
  title: "#f8fafd",
  accent: "#0076ed",
  accentSoft: "#d8edff",
  soft: "#949ca7",
  rule: "#a7b2c1"
};
const FONTS = ['700 92px "Space Grotesk"', '600 44px "Inter"', '500 30px "Inter"', '500 30px "JetBrains Mono"'];
const TITLE_SIZES = [92, 80, 68];

export async function drawCard(canvas, post) {
  await Promise.all(FONTS.map((font) => document.fonts.load(font)));
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.fillStyle = COLORS.accentSoft;
  ctx.font = '500 30px "JetBrains Mono"';
  ctx.fillText(`DAILY PICKS · ${eyebrowDate(post.date)}`, PAD, 150);
  ctx.fillStyle = COLORS.accent;
  ctx.fillRect(PAD, 182, 120, 8);

  const { lines, size } = fitTitle(ctx, post.theme);
  ctx.fillStyle = COLORS.title;
  ctx.font = `700 ${size}px "Space Grotesk"`;
  let y = 300;
  for (const line of lines) {
    ctx.fillText(line, PAD, y);
    y += Math.round(size * 1.08);
  }

  y += 56;
  post.entries.forEach((entry, index) => {
    ctx.fillStyle = COLORS.accent;
    ctx.font = '500 34px "JetBrains Mono"';
    ctx.fillText(String(index + 1).padStart(2, "0"), PAD, y);
    ctx.fillStyle = COLORS.title;
    ctx.font = '600 44px "Inter"';
    ctx.fillText(truncate(ctx, entry.title, CONTENT_WIDTH - 90), PAD + 90, y);
    y += 88;
  });

  ctx.fillStyle = COLORS.rule;
  ctx.fillRect(PAD, 1150, CONTENT_WIDTH, 2);
  ctx.fillStyle = COLORS.soft;
  ctx.font = '500 30px "Inter"';
  ctx.fillText("5 GitHub projects worth a look", PAD, 1214);
  ctx.font = '500 26px "JetBrains Mono"';
  ctx.fillText("github-stars-self.vercel.app/blog", PAD, 1256);
}

function fitTitle(ctx, text) {
  for (const size of TITLE_SIZES) {
    ctx.font = `700 ${size}px "Space Grotesk"`;
    const lines = wrap(ctx, text, CONTENT_WIDTH);
    if (lines.length <= 3) return { lines, size };
  }
  const size = TITLE_SIZES.at(-1);
  ctx.font = `700 ${size}px "Space Grotesk"`;
  return { lines: wrap(ctx, text, CONTENT_WIDTH).slice(0, 4), size };
}

function wrap(ctx, text, maxWidth) {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (!line || ctx.measureText(next).width <= maxWidth) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.map((item) => truncate(ctx, item, maxWidth));
}

function truncate(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

function eyebrowDate(iso) {
  return new Date(`${iso}T12:00:00`)
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
    .toUpperCase();
}
```

- [ ] **Step 2: Write `blog.js`**

```js
import { drawCard } from "./card.js";

const list = document.querySelector("#posts");
const status = document.querySelector("#posts-status");
const template = document.querySelector("#post-template");
const GITHUB_URL = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/;

loadPosts();

async function loadPosts() {
  try {
    const response = await fetch("/api/posts");
    const json = await response.json();
    if (!response.ok || !json.ok) throw new Error(json.error || `request failed (${response.status})`);
    if (!json.posts.length) {
      status.textContent = "No posts yet. The first one lands on the next weekday morning.";
      return;
    }
    status.hidden = true;
    json.posts.forEach((post) => list.append(renderPost(post)));
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  } catch (error) {
    status.textContent = `Couldn't load posts: ${error.message}`;
    status.classList.add("is-error");
  }
}

function renderPost(post) {
  const node = template.content.firstElementChild.cloneNode(true);
  node.id = post.date;
  node.querySelector("[data-field=date]").textContent = formatDate(post.date);
  node.querySelector("[data-field=theme]").textContent = post.theme;
  node.querySelector("[data-field=body]").append(renderBody(post.bodyText));

  const canvas = node.querySelector("canvas");
  canvas.setAttribute("aria-label", `Title card: ${post.theme}, ${post.entries.map((entry) => entry.title).join(", ")}`);
  drawCard(canvas, post).catch((error) => console.error("card failed", error));

  node.querySelector("[data-action=copy]").addEventListener("click", (event) => copyPost(event.currentTarget, post.bodyText));
  node.querySelector("[data-action=download]").addEventListener("click", () => downloadCard(canvas, post.date));
  return node;
}

function renderBody(text) {
  const fragment = document.createDocumentFragment();
  text.split("\n\n").forEach((block) => {
    const paragraph = document.createElement("p");
    block.split("\n").forEach((line, index) => {
      if (index) paragraph.append(document.createElement("br"));
      const trimmed = line.trim();
      if (GITHUB_URL.test(trimmed)) {
        const link = document.createElement("a");
        link.href = trimmed;
        link.textContent = trimmed;
        link.rel = "noreferrer";
        link.target = "_blank";
        paragraph.append(link);
      } else {
        paragraph.append(line);
      }
    });
    fragment.append(paragraph);
  });
  return fragment;
}

async function copyPost(button, text) {
  try {
    await navigator.clipboard.writeText(text);
    flash(button, "Copied");
  } catch {
    flash(button, "Copy failed, select the text instead");
  }
}

function flash(button, label) {
  button.dataset.label ||= button.textContent;
  button.textContent = label;
  setTimeout(() => { button.textContent = button.dataset.label; }, 2000);
}

function downloadCard(canvas, date) {
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `daily-picks-${date}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}

function formatDate(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}
```

- [ ] **Step 3: Write `blog.html`** (same head and nav pattern as `index.html`; no `reveal` classes, since those stay hidden without `app.js`)

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="Five GitHub projects from Tarik Moody's stars, every weekday, grouped by theme." />
    <title>Daily Picks · Tarik Moody</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="./tokens.css" />
    <link rel="stylesheet" href="./styles.css" />
    <link rel="stylesheet" href="./blog.css" />
  </head>
  <body>
    <a class="skip-link" href="#posts">Skip to posts</a>

    <header class="nav" id="top">
      <div class="nav__inner">
        <a class="brand" href="/" aria-label="Stars Index home">
          <span class="brand__mark">✦</span>
          <span>Stars Index</span>
        </a>
        <nav class="nav__right" aria-label="Page">
          <a href="/">Index</a>
          <a href="/blog" aria-current="page">Daily picks</a>
          <a href="https://github.com/tmoody1973?tab=stars" rel="noreferrer">GitHub ↗</a>
        </nav>
      </div>
    </header>

    <main class="blog">
      <div class="section-head">
        <p class="eyebrow">DAILY PICKS</p>
        <h1 class="blog__title">Five GitHub projects, every weekday</h1>
        <p>Grouped by theme from Tarik's starred repos. Each post copies straight into LinkedIn.</p>
      </div>
      <p class="posts-status" id="posts-status" role="status">Loading posts…</p>
      <div class="posts" id="posts"></div>
    </main>

    <footer class="foot-stmt">
      <p class="foot-stmt__line">A star list should work like memory, not archaeology.</p>
      <div class="foot-stmt__meta">
        <span class="brand brand--footer"><span class="brand__mark">✦</span> Stars Index</span>
        <span>Built from public GitHub data · 2026</span>
      </div>
    </footer>

    <template id="post-template">
      <article class="post">
        <canvas class="post__card" width="1080" height="1350" role="img"></canvas>
        <div class="post__content">
          <p class="post__date" data-field="date"></p>
          <h2 class="post__theme" data-field="theme"></h2>
          <div class="post__body" data-field="body"></div>
          <div class="post__actions">
            <button class="btn btn--primary" type="button" data-action="copy">Copy for LinkedIn</button>
            <button class="btn btn--ghost" type="button" data-action="download">Download image</button>
          </div>
        </div>
      </article>
    </template>

    <script type="module" src="./blog.js"></script>
  </body>
</html>
```

- [ ] **Step 4: Write `blog.css`**

```css
.blog {
  max-width: var(--page-max);
  margin: 0 auto;
  padding: var(--space-3xl) var(--page-gutter);
  display: grid;
  gap: var(--space-2xl);
}

.blog__title {
  margin: var(--space-xs) 0;
  font-family: var(--font-display);
  font-size: var(--text-3xl);
  line-height: 1.05;
  letter-spacing: -0.04em;
}

.posts {
  display: grid;
  gap: var(--space-3xl);
}

.posts-status.is-error {
  color: var(--color-error);
}

.post {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
  gap: var(--space-xl);
  align-items: start;
  border-top: var(--rule-hair) solid var(--color-rule);
  padding-top: var(--space-xl);
  scroll-margin-top: var(--space-4xl);
}

.post__card {
  width: 100%;
  height: auto;
  aspect-ratio: 1080 / 1350;
  border-radius: var(--radius-md);
  background: #161b22;
}

.post__date {
  margin: 0;
  color: var(--color-muted);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.post__theme {
  margin: var(--space-xs) 0 var(--space-md);
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  line-height: 1.1;
  letter-spacing: -0.03em;
}

.post__body p {
  margin: 0 0 var(--space-md);
  color: var(--color-ink-2);
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.post__body a {
  color: var(--color-accent);
}

.post__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  margin-top: var(--space-lg);
}

@media (max-width: 760px) {
  .post {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 5: Add the nav link in `index.html`.** In `<nav class="nav__right">`, insert `<a href="/blog">Daily picks</a>` before the GitHub link.

- [ ] **Step 6: Check it in a browser with fixture data.** The local Python server cannot run `/api`, so serve a copy of the static files with a fixture:

```bash
S=/private/tmp/claude-502/-Users-tarikmoody-Projects-github-stars/8115ecce-7035-42af-a35d-58ec5ee74975/scratchpad/blog-qa && rm -rf $S && mkdir -p $S/api
cp blog.html blog.js card.js blog.css tokens.css styles.css $S/
node --input-type=module -e '
import { sampleDraft, sampleEntries } from "./tests/fixtures/sample-draft.mjs";
import { assemblePost } from "./api/_lib/post-format.js";
const entries = sampleEntries();
const long = { ...sampleDraft, theme: "Self-hosted tools for people who keep everything on their own machines" };
const posts = [
  { id: 2, date: "2026-10-15", theme: long.theme, hook: long.hook, bodyText: assemblePost({ ...long, entries }), entries, score: 24, attempts: 1 },
  { id: 1, date: "2026-10-14", theme: sampleDraft.theme, hook: sampleDraft.hook, bodyText: assemblePost({ ...sampleDraft, entries }), entries, score: 24, attempts: 2 }
];
console.log(JSON.stringify({ ok: true, posts }));' > $S/api/posts
(cd $S && python3 -m http.server 4174 &)
```

Open `http://localhost:4174/blog.html` with ego-browser and take screenshots at desktop width. Use a Playwright script with `devices["iPhone 13"]` for the 390px view. Confirm:
- Both cards render in Space Grotesk, not a fallback font.
- The long theme wraps to at most 3 lines.
- Links are clickable.
- Copy puts text on the clipboard with blank lines between entries (read it back with `navigator.clipboard.readText()` in the page).
- Download saves `daily-picks-2026-10-15.png` at 1080×1350.
- The page has no horizontal scroll at 390px.

Stop the server afterward.

- [ ] **Step 7: Commit**

```bash
git add blog.html blog.js card.js blog.css index.html
git commit -m "feat: add daily picks blog page with LinkedIn copy and title card"
```

---

### Task 9: Configure, preview, ship

**Files:**
- Modify: `README.md` (endpoints, env vars, cron)

- [ ] **Step 1: Document it.** In `README.md`:
  - Add `POSTS_ADMIN_TOKEN`, `OPENAI_WRITER_MODEL` (optional) and `GITHUB_TOKEN` (now recommended) to the env list.
  - Add `/api/generate-post` and `/api/posts` to the endpoint list.
  - Fix the stale "every 5 minutes" line to read "daily at 11:00 UTC", and add "daily picks at 12:00 UTC on weekdays".
  - Commit `docs: document daily picks endpoints and settings`.

- [ ] **Step 2: Create the admin token** (outward-facing: changes Vercel settings; approved as part of this plan)

```bash
mkdir -p ~/.config/github-stars && openssl rand -hex 32 > ~/.config/github-stars/posts-admin-token && chmod 600 ~/.config/github-stars/posts-admin-token
vercel env add POSTS_ADMIN_TOKEN production < ~/.config/github-stars/posts-admin-token
vercel env add POSTS_ADMIN_TOKEN preview < ~/.config/github-stars/posts-admin-token
```

Ask Tarik whether to add a `GITHUB_TOKEN` (a fine-grained token with public read access only). Without one, each run makes about 12 unauthenticated GitHub calls from Vercel's shared addresses, which can hit GitHub's 60-per-hour limit.

- [ ] **Step 3: Push and open the PR**

Write `/private/tmp/claude-502/-Users-tarikmoody-Projects-github-stars/8115ecce-7035-42af-a35d-58ec5ee74975/scratchpad/pr-body.md` with four parts: a summary of what each task added, the test plan as a checklist (unit, integration on the Neon branch, browser QA, preview dry run), the 10-day picker output from Task 6 Step 7, and the closing line `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Then:

```bash
git push -u origin feat/daily-picks
gh pr create --title "feat: daily picks blog" --body-file /private/tmp/claude-502/-Users-tarikmoody-Projects-github-stars/8115ecce-7035-42af-a35d-58ec5ee74975/scratchpad/pr-body.md
```

Expected: `check` goes green (syntax and unit tests; integration tests skip in CI).

- [ ] **Step 4: Dry run on the preview deployment**

```bash
PREVIEW=$(gh pr view --json statusCheckRollup -q '.statusCheckRollup[] | select(.context=="Vercel") | .targetUrl')
curl -s -X POST "$PREVIEW/api/generate-post?dryRun=1" -H "x-admin-token: $(cat ~/.config/github-stars/posts-admin-token)" | python3 -m json.tool
```

Expected: `"status": "dry-run"` and a full post. If the response says the model doesn't exist, set `OPENAI_WRITER_MODEL` to a model the account has (`vercel env add OPENAI_WRITER_MODEL preview`) and repeat. If preview deployments are behind Vercel login, use `vercel curl` for the same request. Paste the post text into the PR for Tarik to read. Run it three times to see the gate's first-try rate.

- [ ] **Step 5: Tarik reads the dry-run posts and approves the merge.** Squash-merge only with `check` green.

- [ ] **Step 6: First real post in production**

```bash
curl -s -X POST "https://github-stars-self.vercel.app/api/generate-post" -H "x-admin-token: $(cat ~/.config/github-stars/posts-admin-token)" | python3 -m json.tool
curl -s https://github-stars-self.vercel.app/api/posts | python3 -c 'import json,sys;d=json.load(sys.stdin);print(len(d["posts"]), d["posts"][0]["theme"])'
```

Expected: `"status": "published"`, then `1 <theme>`. Open `https://github-stars-self.vercel.app/blog` with ego-browser and confirm the card, the text and both buttons work. Tarik pastes the copied text into a LinkedIn draft (not posted) to confirm the line breaks survive.

- [ ] **Step 7: Clean up.** Delete the `daily-picks-test` Neon branch with the Neon MCP `delete_branch`, after asking Tarik.
