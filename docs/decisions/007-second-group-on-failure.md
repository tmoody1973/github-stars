# 007 — When a group of projects fails the quality check, try one more group

**Decision** — If the five projects picked for the day fail the quality check twice (the first draft and its one rewrite), the daily run sets all five aside and picks a second group from the remaining stars. It tries at most two groups, and only starts the second one if less than 150 seconds have passed.

**Why this came up** — After the jargon check (decision 006) went live, a test run on 2026-10-14 picked five deep developer tools for terminals and coding agents. The draft and its rewrite both failed: seven listed terms (CLI, API, MCP, tmux, AppKit, Electron, worktree) went unexplained. The picker always starts from the newest unused star, so the next morning would pick the same group, probably fail again, and keep doing so until a new star arrived. The blog could stop posting for days.

**Options**
- **Do nothing** — free. Cost: a hard-to-explain group can stall the blog indefinitely.
- **Try a second group in the same run (no memory between days)** — small change. Cost: about a minute and a few cents of extra AI writing on bad days, and the failed group is tried again first the next morning.
- **Try a second group and remember failed groups in the database** — skips a known-bad group entirely. Cost: a schema change and more code to maintain, for a saving of about a minute a day.

**What we chose and why** — The second group, with no memory. Claude recommended it and Tarik approved it. It removes the stall with the smallest change. The failed group isn't banned forever: the writing differs each time and may pass another day.

**What we gave up** — A run with two failing groups uses roughly twice the AI writing. A group that fails every day costs one wasted attempt every morning. Setting aside all five projects, rather than just the first, means a single hard project takes four easier neighbors with it for that day.

**How we'll know if this was right** — Over the next month, no weekday is skipped because one group failed, and the Vercel log shows how often the second group was needed. If the same group fails first more than three mornings running, add the database list.

**What actually happened** —
