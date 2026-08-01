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
