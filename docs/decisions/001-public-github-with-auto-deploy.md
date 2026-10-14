# 001 — Move the code to a public GitHub repo and deploy from it

**Decision** — Host the code in a public GitHub repo and let Vercel deploy automatically from it, with a basic check that runs on every push.

**Why this came up** — The app was already live at github-stars-self.vercel.app and refreshes itself every 5 minutes, but the code lived only on a laptop and a community git server we couldn't verify. Every deploy was done by hand from the laptop. If the laptop died, or a broken file went out, there was no backup and no safety net. Before building new features on top, the foundation needed fixing.

**Options**
- **Private GitHub repo, auto-deploy, check** — backup and safety net, nothing public. Cost: the work stays invisible to anyone looking at a portfolio.
- **Private GitHub repo only, keep deploying by hand** — fastest. Cost: nothing stops a broken file reaching the live site.
- **Public GitHub repo, auto-deploy, check** — same safety net, plus the code is visible as portfolio work. Cost: anyone can read how the app works, including how its refresh and search endpoints behave.

**What we chose and why** — Public, with auto-deploy and a check. Tarik made the call; Claude had recommended private. Public makes the work visible. Before publishing, the full git history was scanned for keys, tokens, and database passwords (none found; secrets live only in Vercel settings and an ignored local file).

**What we gave up** — Privacy of the code. The commit author email is public. Also, a push to `main` now goes straight to the live site, so `main` has to stay healthy; changes should go through a branch and its preview link first.

**How we'll know if this was right** — Over the next month: every change reaches the live site through a GitHub push (no hand deploys), the check catches at least one broken change before it ships, and no secret ever shows up in the repo.

**What actually happened** —
