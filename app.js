const USERNAME = "tmoody1973";
const MAX_PAGES = 10;
const PER_PAGE = 100;
const AUTO_REFRESH_INTERVAL_MS = 60_000;

const CATEGORY_RULES = [
  {
    name: "AI & LLMs",
    clue: "Models, prompts, agents, RAG, embeddings, and AI app building.",
    keywords: ["ai", "llm", "gpt", "openai", "anthropic", "claude", "agent", "agents", "rag", "embedding", "vector", "prompt", "langchain", "llama", "ollama", "mcp", "machine-learning", "semantic"]
  },
  {
    name: "Automation & agents",
    clue: "Tools that run workflows, browser actions, jobs, or agentic tasks.",
    keywords: ["automation", "workflow", "agent", "agents", "bot", "browser", "scrape", "crawler", "playwright", "puppeteer", "worker", "scheduler", "cron", "mcp", "autonomous"]
  },
  {
    name: "Web apps",
    clue: "Frameworks, starters, components, and full-stack app examples.",
    keywords: ["next", "nextjs", "react", "vue", "svelte", "astro", "remix", "tailwind", "frontend", "fullstack", "web", "app", "starter", "template", "typescript", "javascript"]
  },
  {
    name: "Design & UI",
    clue: "Interfaces, visual systems, components, motion, and product polish.",
    keywords: ["design", "ui", "ux", "component", "components", "animation", "motion", "figma", "css", "shadcn", "radix", "storybook", "visual", "tailwind"]
  },
  {
    name: "Data & scraping",
    clue: "APIs, datasets, extraction, enrichment, analytics, and structured data.",
    keywords: ["data", "database", "postgres", "sql", "analytics", "scrape", "scraper", "crawl", "crawler", "dataset", "etl", "api", "csv", "json", "firecrawl", "extract"]
  },
  {
    name: "Dev tools",
    clue: "CLIs, SDKs, libraries, testing, build tools, and developer workflow.",
    keywords: ["cli", "sdk", "developer", "devtool", "tooling", "build", "test", "testing", "lint", "vite", "webpack", "package", "library", "git", "github"]
  },
  {
    name: "Infrastructure",
    clue: "Deploy, hosting, auth, cloud, observability, and backend systems.",
    keywords: ["vercel", "deploy", "cloud", "server", "backend", "docker", "kubernetes", "auth", "oauth", "supabase", "clerk", "firebase", "observability", "monitoring"]
  },
  {
    name: "Media & content",
    clue: "Video, audio, images, publishing, storytelling, and content workflows.",
    keywords: ["video", "audio", "image", "media", "content", "cms", "markdown", "blog", "publishing", "remotion", "ffmpeg", "podcast", "newsletter"]
  },
  {
    name: "Business & productivity",
    clue: "CRM, sales, ops, finance, documents, and practical business tools.",
    keywords: ["crm", "sales", "finance", "billing", "invoice", "productivity", "notion", "spreadsheet", "docs", "document", "calendar", "email", "saas"]
  },
  {
    name: "Learning & reference",
    clue: "Guides, examples, courses, documentation, and repos saved to study later.",
    keywords: ["awesome", "learn", "learning", "course", "guide", "docs", "documentation", "examples", "example", "tutorial", "reference", "book"]
  }
];

const SEARCH_ALIASES = {
  "ai": ["AI & LLMs", "agent", "llm", "prompt", "rag"],
  "agents": ["Automation & agents", "AI & LLMs", "workflow", "mcp"],
  "agent": ["Automation & agents", "AI & LLMs", "workflow", "mcp"],
  "frontend": ["Web apps", "Design & UI", "react", "next", "css"],
  "front-end": ["Web apps", "Design & UI", "react", "next", "css"],
  "ui": ["Design & UI", "components", "interface", "frontend"],
  "design": ["Design & UI", "figma", "motion", "interface"],
  "scraping": ["Data & scraping", "crawler", "extract", "firecrawl"],
  "scrape": ["Data & scraping", "crawler", "extract", "firecrawl"],
  "data": ["Data & scraping", "analytics", "database", "api"],
  "backend": ["Infrastructure", "Data & scraping", "server", "api"],
  "deploy": ["Infrastructure", "vercel", "hosting", "cloud"],
  "video": ["Media & content", "remotion", "ffmpeg", "media"],
  "content": ["Media & content", "markdown", "cms", "publishing"],
  "business": ["Business & productivity", "crm", "sales", "finance"],
  "learn": ["Learning & reference", "guide", "examples", "docs"]
};

const state = {
  repos: [],
  filtered: [],
  commandIndex: 0,
  loading: false,
  error: null,
  filters: {
    search: "",
    category: "all",
    language: "all",
    topic: "all",
    owner: "all",
    sort: "starred"
  },
  semantic: {
    query: "",
    repos: null,
    mode: "local",
    timer: null,
    controller: null
  },
  dataSource: "github"
};

const elements = {
  loadState: document.querySelector("#load-state"),
  statusDot: document.querySelector(".status-dot"),
  apiNote: document.querySelector("#api-note"),
  metricTotal: document.querySelector("#metric-total"),
  metricCategories: document.querySelector("#metric-categories"),
  metricTopics: document.querySelector("#metric-topics"),
  featuredGrid: document.querySelector("#featured-grid"),
  categoryGrid: document.querySelector("#category-grid"),
  recentList: document.querySelector("#recent-list"),
  repoGrid: document.querySelector("#repo-grid"),
  resultCount: document.querySelector("#result-count"),
  searchInput: document.querySelector("#search-input"),
  categoryFilter: document.querySelector("#category-filter"),
  languageFilter: document.querySelector("#language-filter"),
  topicFilter: document.querySelector("#topic-filter"),
  ownerFilter: document.querySelector("#owner-filter"),
  sortFilter: document.querySelector("#sort-filter"),
  refreshButton: document.querySelector("#refresh-data"),
  openCommand: document.querySelector("#open-command"),
  cmdk: document.querySelector("#cmdk"),
  cmdkInput: document.querySelector("#cmdk-input"),
  cmdkResults: document.querySelector("#cmdk-results"),
  template: document.querySelector("#repo-card-template")
};

function formatNumber(value) {
  return new Intl.NumberFormat("en", { notation: value > 9999 ? "compact" : "standard" }).format(value || 0);
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function normalizeStar(item) {
  if (item.fullName && item.owner) {
    const base = {
      id: item.id,
      name: item.name || item.fullName.split("/").at(-1),
      fullName: item.fullName,
      owner: item.owner,
      description: item.description || "No description provided.",
      language: item.language || "Unspecified",
      topics: Array.isArray(item.topics) ? item.topics : [],
      stars: item.stars || 0,
      forks: item.forks || 0,
      issues: item.issues || 0,
      updatedAt: item.updatedAt,
      pushedAt: item.pushedAt,
      starredAt: item.starredAt,
      url: item.url,
      homepage: item.homepage,
      category: item.category,
      summary: item.summary,
      score: item.score,
      semanticMatch: item.semanticMatch,
      hasEmbedding: item.hasEmbedding
    };
    base.category ||= categorizeRepo(base);
    base.summary ||= summarizeRepo(base);
    return base;
  }

  const repo = item.repo || item;
  const base = {
    id: repo.id,
    name: repo.name || "Untitled",
    fullName: repo.full_name || `${repo.owner?.login || "unknown"}/${repo.name || "repo"}`,
    owner: repo.owner?.login || "unknown",
    description: repo.description || "No description provided.",
    language: repo.language || "Unspecified",
    topics: Array.isArray(repo.topics) ? repo.topics : [],
    stars: repo.stargazers_count || 0,
    forks: repo.forks_count || 0,
    issues: repo.open_issues_count || 0,
    updatedAt: repo.updated_at,
    pushedAt: repo.pushed_at,
    starredAt: item.starred_at || repo.created_at,
    url: repo.html_url,
    homepage: repo.homepage
  };
  base.category = categorizeRepo(base);
  base.summary = summarizeRepo(base);
  return base;
}

function searchableText(repo) {
  return [repo.fullName, repo.description, repo.language, repo.owner, repo.category, repo.summary, ...repo.topics]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function expandedSearchTokens(query) {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => [token, ...(SEARCH_ALIASES[token] || [])].join(" ").toLowerCase());
}

function categorizeRepo(repo) {
  const text = [repo.fullName, repo.description, repo.language, ...repo.topics].join(" ").toLowerCase();
  const scores = CATEGORY_RULES.map((rule) => {
    const score = rule.keywords.reduce((total, keyword) => (text.includes(keyword) ? total + 1 : total), 0);
    return { rule, score };
  }).sort((a, b) => b.score - a.score);

  return scores[0]?.score > 0 ? scores[0].rule.name : "General utilities";
}

function summarizeRepo(repo) {
  const category = repo.category || "General utilities";
  const language = repo.language && repo.language !== "Unspecified" ? `${repo.language} repo` : "repo";
  const topicHint = repo.topics.length ? ` It is tagged with ${repo.topics.slice(0, 3).join(", ")}.` : "";
  const description = repo.description && repo.description !== "No description provided." ? repo.description.trim() : "";

  if (description) {
    const cleaned = description.replace(/\s+/g, " ").replace(/[.。]+$/, "");
    return `${category}: ${cleaned}.${topicHint}`;
  }

  return `${category}: a ${language} from ${repo.owner} saved for later review.${topicHint}`;
}

async function fetchStars({ requestRefresh = false, silent = false } = {}) {
  state.loading = !silent;
  state.error = null;
  let refreshResult = null;
  if (!silent) updateLoadState(requestRefresh ? "Refreshing GitHub stars…" : "Loading saved stars…");

  try {
    if (requestRefresh) refreshResult = await requestSavedStarsRefresh();
    const saved = await fetchSavedStars();
    if (saved.length) {
      state.dataSource = "neon";
      state.repos = dedupeRepos(saved.map(normalizeStar));
      hydrateFilters();
      applyFilters();
      if (!silent) {
        const refreshMessage = formatRefreshResult(refreshResult);
        updateLoadState(refreshMessage || `Loaded ${state.repos.length} saved repos.`);
        elements.apiNote.textContent = refreshMessage
          ? "GitHub sync completed, then saved Neon data was reloaded without cache."
          : "Data loaded from Neon. Summaries and categories are saved; semantic search activates when embeddings are present.";
      }
      return;
    }
  } catch (error) {
    if (!silent) updateLoadState("Saved data unavailable. Falling back to GitHub…");
  }

  try {
    if (!silent) updateLoadState("Fetching GitHub stars…");
    const all = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const url = new URL(`https://api.github.com/users/${USERNAME}/starred`);
      url.searchParams.set("sort", "created");
      url.searchParams.set("direction", "desc");
      url.searchParams.set("per_page", String(PER_PAGE));
      url.searchParams.set("page", String(page));

      const response = await fetch(url, {
        headers: {
          Accept: "application/vnd.github.star+json"
        }
      });

      if (!response.ok) {
        const remaining = response.headers.get("x-ratelimit-remaining");
        const reset = response.headers.get("x-ratelimit-reset");
        const resetText = reset ? ` Reset ${formatDate(Number(reset) * 1000)}.` : "";
        throw new Error(`GitHub returned ${response.status}. Remaining API calls: ${remaining ?? "unknown"}.${resetText}`);
      }

      const pageItems = await response.json();
      all.push(...pageItems.map(normalizeStar));
      if (!silent) updateLoadState(`Fetched ${all.length} starred repos…`);

      if (pageItems.length < PER_PAGE) break;
    }

    state.repos = dedupeRepos(all);
    state.dataSource = "github";
    hydrateFilters();
    applyFilters();
    if (!silent) {
      updateLoadState(`Loaded ${state.repos.length} starred repos.`);
      elements.apiNote.textContent = "Data loaded live from GitHub because the saved Neon index was empty or unavailable.";
    }
  } catch (error) {
    state.error = error;
    state.repos = [];
    state.filtered = [];
    if (!silent) {
      renderError(error);
      updateLoadState("GitHub fetch failed.", true);
    }
  } finally {
    state.loading = false;
    elements.refreshButton.classList.remove("is-loading");
  }
}

async function requestSavedStarsRefresh() {
  const response = await fetch("/api/refresh", {
    method: "POST",
    headers: { Accept: "application/json" },
    cache: "no-store"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(data.error || `Refresh returned ${response.status}.`);
  return data;
}

function formatRefreshResult(result) {
  if (!result) return "";
  if (result.skipped) return "Refresh skipped; saved index was updated moments ago.";
  const embedded = result.embedded ? `, ${result.embedded} embedded` : "";
  return `Synced ${result.saved || result.fetched || 0} GitHub stars${embedded}.`;
}

async function fetchSavedStars() {
  const response = await fetch("/api/stars", {
    headers: { Accept: "application/json" },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Saved stars returned ${response.status}.`);
  const data = await response.json();
  if (!data.ok) throw new Error(data.error || "Saved stars failed.");
  return Array.isArray(data.repos) ? data.repos : [];
}

function dedupeRepos(repos) {
  const seen = new Map();
  repos.forEach((repo) => {
    if (!seen.has(repo.id)) seen.set(repo.id, repo);
  });
  return [...seen.values()];
}

function updateLoadState(message, isError = false) {
  elements.loadState.textContent = message;
  elements.statusDot.classList.toggle("is-error", isError);
}

function hydrateFilters() {
  const languages = uniqueValues(state.repos.map((repo) => repo.language));
  const owners = uniqueValues(state.repos.map((repo) => repo.owner));
  const categories = uniqueValues(state.repos.map((repo) => repo.category));
  const topics = uniqueValues(state.repos.flatMap((repo) => repo.topics)).slice(0, 100);

  fillSelect(elements.languageFilter, "All languages", languages);
  fillSelect(elements.categoryFilter, "All categories", categories);
  fillSelect(elements.ownerFilter, "All owners", owners);
  fillSelect(elements.topicFilter, "All topics", topics);

  elements.metricTotal.textContent = formatNumber(state.repos.length);
  elements.metricCategories.textContent = formatNumber(categories.length);
  elements.metricTopics.textContent = formatNumber(topics.length);
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function fillSelect(select, label, values) {
  select.replaceChildren();
  select.append(new Option(label, "all"));
  values.forEach((value) => select.append(new Option(value, value)));
}

function applyFilters() {
  const tokens = expandedSearchTokens(state.filters.search);
  const semanticActive = isSemanticResultActive();
  const sourceRepos = semanticActive ? state.semantic.repos : state.repos;

  state.filtered = sourceRepos
    .filter((repo) => {
      const haystack = searchableText(repo);
      const matchesSearch = semanticActive || tokens.every((tokenGroup) =>
          tokenGroup.split(" ").some((token) => haystack.includes(token))
        );
      const matchesCategory = state.filters.category === "all" || repo.category === state.filters.category;
      const matchesLanguage = state.filters.language === "all" || repo.language === state.filters.language;
      const matchesTopic = state.filters.topic === "all" || repo.topics.includes(state.filters.topic);
      const matchesOwner = state.filters.owner === "all" || repo.owner === state.filters.owner;
      return matchesSearch && matchesCategory && matchesLanguage && matchesTopic && matchesOwner;
    })
    .sort(sortRepos);

  render();
}

function sortRepos(a, b) {
  if (state.filters.sort === "relevance" && state.filters.search.trim()) {
    return (b.score || 0) - (a.score || 0);
  }
  if (state.filters.sort === "updated") return new Date(b.pushedAt || b.updatedAt) - new Date(a.pushedAt || a.updatedAt);
  if (state.filters.sort === "stars") return b.stars - a.stars;
  if (state.filters.sort === "name") return a.fullName.localeCompare(b.fullName);
  return new Date(b.starredAt) - new Date(a.starredAt);
}

function render() {
  renderFeatured();
  renderCategories();
  renderRecent();
  renderIndex();
  renderCommandResults();
}

function renderCategories() {
  const counts = new Map();
  state.filtered.forEach((repo) => {
    counts.set(repo.category, (counts.get(repo.category) || 0) + 1);
  });

  const categories = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  elements.categoryGrid.replaceChildren();
  if (!categories.length) {
    elements.categoryGrid.append(emptyCard("No categories match the current filters."));
    return;
  }

  categories.forEach(([category, count]) => {
    const rule = CATEGORY_RULES.find((item) => item.name === category);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "category-card";
    card.innerHTML = `
      <span class="category-card__count">${formatNumber(count)}</span>
      <strong>${escapeHtml(category)}</strong>
      <span>${escapeHtml(rule?.clue || "Repos that do not fit a more specific shelf yet.")}</span>
    `;
    card.addEventListener("click", () => {
      state.filters.category = category;
      elements.categoryFilter.value = category;
      applyFilters();
      document.querySelector("#index")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    elements.categoryGrid.append(card);
  });
}

function renderFeatured() {
  const featured = [...state.filtered].sort((a, b) => b.stars - a.stars).slice(0, 6);
  renderCards(elements.featuredGrid, featured, "No featured repositories match the current filters.");
}

function renderRecent() {
  const recent = [...state.filtered].sort((a, b) => new Date(b.starredAt) - new Date(a.starredAt)).slice(0, 8);
  elements.recentList.replaceChildren();

  if (!recent.length) {
    elements.recentList.append(emptyCard("No recent repositories match the current filters."));
    return;
  }

  recent.forEach((repo) => {
    const row = document.createElement("article");
    row.className = "compact-row";
    row.innerHTML = `
      <a href="${repo.url}" target="_blank" rel="noreferrer">${escapeHtml(repo.fullName)}</a>
      <span>${escapeHtml(repo.language)}</span>
      <span>${formatDate(repo.starredAt)}</span>
    `;
    elements.recentList.append(row);
  });
}

function renderIndex() {
  const mode = isSemanticResultActive()
    ? state.semantic.mode === "semantic" ? "semantic matches" : "database keyword matches"
    : "matching repos";
  elements.resultCount.textContent = `${formatNumber(state.filtered.length)} ${mode}`;
  renderCards(elements.repoGrid, state.filtered, "No repositories match the current filters.");
}

function renderCards(container, repos, emptyMessage) {
  container.replaceChildren();
  if (!repos.length) {
    container.append(emptyCard(emptyMessage));
    return;
  }

  repos.forEach((repo) => container.append(repoCard(repo)));
}

function repoCard(repo) {
  const node = elements.template.content.firstElementChild.cloneNode(true);
  node.querySelector(".repo-card__owner").textContent = repo.owner;
  const name = node.querySelector(".repo-card__name");
  name.href = repo.url;
  name.textContent = repo.fullName;
  node.querySelector(".repo-card__category").textContent = repo.category;
  node.querySelector(".repo-card__summary").textContent = repo.summary;
  node.querySelector(".repo-card__description").textContent = repo.description;
  node.querySelector('[data-field="language"]').textContent = repo.language;
  node.querySelector('[data-field="stars"]').textContent = formatNumber(repo.stars);
  node.querySelector('[data-field="updated"]').textContent = formatDate(repo.pushedAt || repo.updatedAt);

  const topicRow = node.querySelector(".topic-row");
  const topics = repo.topics.length ? repo.topics.slice(0, 4) : [repo.language];
  topics.forEach((topic) => {
    const tag = document.createElement("span");
    tag.className = "topic";
    tag.textContent = topic;
    topicRow.append(tag);
  });

  return node;
}

function emptyCard(message) {
  const card = document.createElement("p");
  card.className = "empty-card";
  card.textContent = message;
  return card;
}

function renderError(error) {
  const card = document.createElement("p");
  card.className = "error-card";
  card.textContent = error.message;
  elements.featuredGrid.replaceChildren(card.cloneNode(true));
  elements.categoryGrid.replaceChildren(card.cloneNode(true));
  elements.recentList.replaceChildren(card.cloneNode(true));
  elements.repoGrid.replaceChildren(card);
  elements.resultCount.textContent = "GitHub fetch failed";
  elements.metricTotal.textContent = "—";
  elements.metricCategories.textContent = "—";
  elements.metricTopics.textContent = "—";
  elements.apiNote.textContent = "No fallback data is shown because the app only displays data returned by GitHub.";
}

function openCommand() {
  elements.cmdk.classList.add("is-open");
  elements.cmdk.setAttribute("aria-hidden", "false");
  elements.cmdkInput.value = state.filters.search;
  state.commandIndex = 0;
  renderCommandResults();
  window.setTimeout(() => elements.cmdkInput.focus(), 0);
}

function closeCommand() {
  elements.cmdk.classList.remove("is-open");
  elements.cmdk.setAttribute("aria-hidden", "true");
  elements.openCommand.focus();
}

function renderCommandResults() {
  if (!elements.cmdk.classList.contains("is-open")) return;
  const query = elements.cmdkInput.value.trim().toLowerCase();
  const tokens = expandedSearchTokens(query);
  const results = state.repos
    .filter((repo) => {
      if (!query) return true;
      const haystack = searchableText(repo);
      return tokens.every((tokenGroup) => tokenGroup.split(" ").some((token) => haystack.includes(token)));
    })
    .sort((a, b) => b.stars - a.stars)
    .slice(0, 10);

  elements.cmdkResults.replaceChildren();
  if (!results.length) {
    elements.cmdkResults.append(emptyCard("No command results."));
    return;
  }

  state.commandIndex = Math.min(state.commandIndex, results.length - 1);
  results.forEach((repo, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `cmdk__item${index === state.commandIndex ? " is-active" : ""}`;
    item.innerHTML = `
      <span><strong>${escapeHtml(repo.fullName)}</strong><span>${escapeHtml(repo.summary)}</span></span>
      <span>${formatNumber(repo.stars)} ★</span>
    `;
    item.addEventListener("click", () => window.open(repo.url, "_blank", "noopener,noreferrer"));
    elements.cmdkResults.append(item);
  });
}

function isSemanticResultActive() {
  const query = state.filters.search.trim();
  return Boolean(query && state.semantic.query === query && Array.isArray(state.semantic.repos));
}

function queueSemanticSearch() {
  const query = state.filters.search.trim();
  window.clearTimeout(state.semantic.timer);

  if (state.semantic.controller) state.semantic.controller.abort();
  state.semantic.controller = null;

  if (query.length < 2 || state.dataSource !== "neon") {
    state.semantic = { ...state.semantic, query: "", repos: null, mode: "local" };
    return;
  }

  state.semantic.timer = window.setTimeout(async () => {
    const controller = new AbortController();
    state.semantic.controller = controller;

    try {
      const url = new URL("/api/search", window.location.origin);
      url.searchParams.set("q", query);
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`Search returned ${response.status}.`);
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || "Search failed.");
      if (state.filters.search.trim() !== query) return;

      state.semantic.query = query;
      state.semantic.repos = (data.repos || []).map(normalizeStar);
      state.semantic.mode = data.semantic ? "semantic" : "database-keyword";
      elements.apiNote.textContent = data.semantic
        ? "Search is using saved embeddings from Neon."
        : "Search is using saved Neon data. Add OPENAI_API_KEY and refresh embeddings for true semantic ranking.";
      applyFilters();
    } catch (error) {
      if (error.name === "AbortError") return;
      state.semantic = { ...state.semantic, query: "", repos: null, mode: "local" };
      applyFilters();
    }
  }, 250);
}

function handleCommandKey(event) {
  const items = [...elements.cmdkResults.querySelectorAll(".cmdk__item")];
  if (event.key === "Escape") {
    event.preventDefault();
    closeCommand();
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    state.commandIndex = items.length ? (state.commandIndex + 1) % items.length : 0;
    renderCommandResults();
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    state.commandIndex = items.length ? (state.commandIndex - 1 + items.length) % items.length : 0;
    renderCommandResults();
  }
  if (event.key === "Enter" && items[state.commandIndex]) {
    event.preventDefault();
    items[state.commandIndex].click();
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.filters.search = event.target.value;
    queueSemanticSearch();
    applyFilters();
  });

  [
    [elements.categoryFilter, "category"],
    [elements.languageFilter, "language"],
    [elements.topicFilter, "topic"],
    [elements.ownerFilter, "owner"],
    [elements.sortFilter, "sort"]
  ].forEach(([element, key]) => {
    element.addEventListener("change", (event) => {
      state.filters[key] = event.target.value;
      applyFilters();
    });
  });

  elements.refreshButton.addEventListener("click", () => {
    elements.refreshButton.classList.add("is-loading");
    fetchStars({ requestRefresh: true });
  });

  elements.openCommand.addEventListener("click", openCommand);
  elements.cmdkInput.addEventListener("input", renderCommandResults);
  elements.cmdkInput.addEventListener("keydown", handleCommandKey);
  elements.cmdk.addEventListener("click", (event) => {
    if (event.target.matches("[data-close]")) closeCommand();
  });

  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openCommand();
    }
  });
}

function initReveal() {
  const nodes = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    nodes.forEach((node) => node.classList.add("is-in"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  nodes.forEach((node) => observer.observe(node));
}

bindEvents();
initReveal();
fetchStars();
setInterval(() => {
  if (document.visibilityState !== "visible") return;
  if (state.loading) return;
  fetchStars({ silent: true });
}, AUTO_REFRESH_INTERVAL_MS);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && !state.loading) fetchStars({ silent: true });
});
