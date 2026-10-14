# 006 — Send back any post that leaves programmer jargon unexplained

**Decision** — The quality check that every post passes before publishing now also looks for a fixed list of programmer-only terms (CLI, API, GPU, MCP, tmux, Docker and similar). Each one must be explained in brackets near its first use, like "MCP servers (add-ons that let AI apps work with maps)", or replaced with everyday words. A draft that fails gets its one rewrite; if the rewrite fails, nothing publishes that day.

**Why this came up** — Decision 005 told the writer to use plain English. Three test posts got much plainer on average (technical acronyms fell from 32 to between 4 and 7), but one still said "CLI", "AppKit" and "tmux" with no explanation. The writer follows instructions most of the time, not every time, and nothing was checking.

**Options**
- **Instructions only** — free. Cost: some posts will still lose non-technical readers.
- **Automatic check on a fixed term list** — catches the listed terms every time. Cost: more drafts need a rewrite, and occasionally a day gets no post; terms not on the list still slip through.
- **A second AI pass that rewrites for plain English** — catches more. Cost: another model call every day, and an AI judging AI's jargon is harder to verify.

**What we chose and why** — The fixed-list check. Claude recommended it and Tarik approved it. It is predictable, testable, and free to run, and the list is easy to extend when a new term slips through.

**What we gave up** — Some posting days, and coverage of jargon that isn't on the list.

**How we'll know if this was right** — Over the next month, fewer than two weekdays are skipped because of this check, and posts stop containing unexplained terms from the list.

**What actually happened** —
