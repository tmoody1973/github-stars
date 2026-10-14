import { MAX_PAGES, PER_PAGE, USERNAME, normalizeGitHubStar } from "./taxonomy.js";

export async function fetchGitHubStars() {
  const all = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = new URL(`https://api.github.com/users/${USERNAME}/starred`);
    url.searchParams.set("sort", "created");
    url.searchParams.set("direction", "desc");
    url.searchParams.set("per_page", String(PER_PAGE));
    url.searchParams.set("page", String(page));

    const headers = {
      Accept: "application/vnd.github.star+json",
      "User-Agent": "github-stars-index"
    };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

    const response = await fetch(url, { headers });
    if (!response.ok) {
      const remaining = response.headers.get("x-ratelimit-remaining");
      throw new Error(`GitHub returned ${response.status}. Remaining API calls: ${remaining ?? "unknown"}.`);
    }

    const pageItems = await response.json();
    all.push(...pageItems.map(normalizeGitHubStar));

    if (pageItems.length < PER_PAGE) break;
  }

  const seen = new Map();
  all.forEach((repo) => {
    if (!seen.has(repo.id)) seen.set(repo.id, repo);
  });

  return [...seen.values()];
}

const README_MAX_CHARS = 6000;

function githubHeaders(accept) {
  const headers = { Accept: accept, "User-Agent": "github-stars-index" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

// 404/410 = deleted, 451 = legally blocked, 403 without a rate-limit signal = disabled by GitHub.
// Treating these as "gone" lets the picker skip them; a real rate limit still throws.
function isGone(response) {
  if ([404, 410, 451].includes(response.status)) return true;
  if (response.status !== 403) return false;
  const rateLimited = response.headers.get("x-ratelimit-remaining") === "0" || response.headers.has("retry-after");
  return !rateLimited;
}

export async function fetchRepoDetails(fullName) {
  const repoResponse = await fetch(`https://api.github.com/repos/${fullName}`, {
    headers: githubHeaders("application/vnd.github+json")
  });
  if (isGone(repoResponse)) return null;
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
