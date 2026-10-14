# 004 — Check every post with the humanize scorer before it publishes

**Decision** — Every generated post is scored by sloplint, the scorer that ships with the soundshuman humanize skill. A post publishes only if it scores 25 or lower and contains no em or en dashes; otherwise the writer gets one rewrite with the specific problems, and if that fails, nothing publishes that day.

**Why this came up** — The posts are written by an AI model and published automatically, with nobody checking them before they appear on the blog. Posts that read as AI-written get scrolled past on LinkedIn and reflect on Tarik. Telling the model to "sound human" in its instructions doesn't guarantee it.

**Options**
- **Rules in the prompt only** — cheapest. Cost: nothing catches the days the model ignores them.
- **Rules in the prompt plus an automatic score gate** — the scorer flags 41 known patterns (stock phrases, em dashes, uniform sentence lengths) and gives a number. Cost: an occasional day with no post, and a second model call on days that need a rewrite.
- **Hold every post as a draft until Tarik approves it** — the safest. Cost: it isn't automatic anymore, and a missed morning means a missed post.

**What we chose and why** — Prompt rules plus the gate. Claude proposed it and Tarik approved the design. The scorer has no dependencies and an MIT license, so a copy can live in the app. Tarik still reads each post before pasting it into LinkedIn, so he remains the final check.

**What we gave up** — Some days may publish nothing. The scorer also catches patterns, not meaning: a post can pass and still be dull or wrong.

**How we'll know if this was right** — Track the `attempts` column. Most posts should pass on the first try, fewer than two weekdays a month should be blocked, and Tarik should rarely need to edit more than a sentence.

**What actually happened** —
