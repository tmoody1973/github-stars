# 002 — Choose each day's theme from similar repos, not from category labels

**Decision** — Each day's five projects are chosen by starting from a recently starred repo and finding the four repos most similar in meaning to it, instead of rotating through the app's category labels.

**Why this came up** — The blog needs a theme every weekday. The app already sorts repos into eleven categories, which looked like a ready-made rotation. But the split is lopsided: 560 of 992 repos are "AI & LLMs". A category rotation would make most days an AI post, and a five-repo sample from 560 loosely related repos wouldn't feel like a theme at all.

**Options**
- **Rotate categories** — simplest. Cost: AI dominates the week, and "AI & LLMs" is too broad to read as one theme.
- **Hand-written theme list** — Tarik or Claude writes a list such as "geospatial", "local-first", and the job fills each one. Cost: someone has to maintain the list, and some themes won't have five good unused repos.
- **Similar-repo clusters from embeddings** — an embedding is a list of numbers that places repos with similar meaning close together. Start from the newest unused star and take its four nearest neighbors. Cost: themes are emergent, so you can't plan Tuesday's topic ahead of time; a bad similarity threshold could produce a loose grouping.

**What we chose and why** — Similar-repo clusters. Claude recommended it and Tarik approved the design. The embeddings already exist for search, the themes come out specific ("geospatial tools", not "AI"), and starting from the newest star keeps the posts tied to what Tarik is finding right now. Only Tarik's own stars are used (Tarik's call), so every pick is something he chose to save.

**What we gave up** — Control over the schedule of topics. Also the pool runs down: at 25 repos a week, the 992 current stars last about 40 weeks, extended by new stars.

**How we'll know if this was right** — Read the first ten themes. If more than two feel forced or repeat a recent day, the thresholds or the approach need changing.

**What actually happened** —
