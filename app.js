const USERNAME = "tmoody1973";
const MAX_PAGES = 10;
const PER_PAGE = 100;

const state = {
  repos: [],
  filtered: [],
  commandIndex: 0,
  loading: false,
  error: null,
  filters: {
    search: "",
    language: "all",
    topic: "all",
    owner: "all",
    sort: "starred"
  }
};

const elements = {
  loadState: document.querySelector("#load-state"),
  statusDot: document.querySelector(".status-dot"),
  apiNote: document.querySelector("#api-note"),
  metricTotal: document.querySelector("#metric-total"),
  metricLanguages: document.querySelector("#metric-languages"),
  metricTopics: document.querySelector("#metric-topics"),
  featuredGrid: document.querySelector("#featured-grid"),
  recentList: document.querySelector("#recent-list"),
  repoGrid: document.querySelector("#repo-grid"),
  resultCount: document.querySelector("#result-count"),
  searchInput: document.querySelector("#search-input"),
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
  const repo = item.repo || item;
  return {
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
}

async function fetchStars() {
  state.loading = true;
  state.error = null;
  updateLoadState("Fetching GitHub stars…");

  const all = [];

  try {
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
      updateLoadState(`Fetched ${all.length} starred repos…`);

      if (pageItems.length < PER_PAGE) break;
    }

    state.repos = dedupeRepos(all);
    hydrateFilters();
    applyFilters();
    updateLoadState(`Loaded ${state.repos.length} starred repos.`);
    elements.apiNote.textContent = "Data loaded from GitHub's public starred repositories API.";
  } catch (error) {
    state.error = error;
    state.repos = [];
    state.filtered = [];
    renderError(error);
    updateLoadState("GitHub fetch failed.", true);
  } finally {
    state.loading = false;
    elements.refreshButton.classList.remove("is-loading");
  }
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
  const topics = uniqueValues(state.repos.flatMap((repo) => repo.topics)).slice(0, 100);

  fillSelect(elements.languageFilter, "All languages", languages);
  fillSelect(elements.ownerFilter, "All owners", owners);
  fillSelect(elements.topicFilter, "All topics", topics);

  elements.metricTotal.textContent = formatNumber(state.repos.length);
  elements.metricLanguages.textContent = formatNumber(languages.filter((item) => item !== "Unspecified").length);
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
  const query = state.filters.search.trim().toLowerCase();
  const tokens = query.split(/\s+/).filter(Boolean);

  state.filtered = state.repos
    .filter((repo) => {
      const haystack = [repo.fullName, repo.description, repo.language, repo.owner, ...repo.topics].join(" ").toLowerCase();
      const matchesSearch = tokens.every((token) => haystack.includes(token));
      const matchesLanguage = state.filters.language === "all" || repo.language === state.filters.language;
      const matchesTopic = state.filters.topic === "all" || repo.topics.includes(state.filters.topic);
      const matchesOwner = state.filters.owner === "all" || repo.owner === state.filters.owner;
      return matchesSearch && matchesLanguage && matchesTopic && matchesOwner;
    })
    .sort(sortRepos);

  render();
}

function sortRepos(a, b) {
  if (state.filters.sort === "updated") return new Date(b.pushedAt || b.updatedAt) - new Date(a.pushedAt || a.updatedAt);
  if (state.filters.sort === "stars") return b.stars - a.stars;
  if (state.filters.sort === "name") return a.fullName.localeCompare(b.fullName);
  return new Date(b.starredAt) - new Date(a.starredAt);
}

function render() {
  renderFeatured();
  renderRecent();
  renderIndex();
  renderCommandResults();
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
  elements.resultCount.textContent = `${formatNumber(state.filtered.length)} matching repos`;
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
  elements.recentList.replaceChildren(card.cloneNode(true));
  elements.repoGrid.replaceChildren(card);
  elements.resultCount.textContent = "GitHub fetch failed";
  elements.metricTotal.textContent = "—";
  elements.metricLanguages.textContent = "—";
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
  const results = state.repos
    .filter((repo) => {
      if (!query) return true;
      return [repo.fullName, repo.description, repo.language, repo.owner, ...repo.topics].join(" ").toLowerCase().includes(query);
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
      <span><strong>${escapeHtml(repo.fullName)}</strong><span>${escapeHtml(repo.description)}</span></span>
      <span>${formatNumber(repo.stars)} ★</span>
    `;
    item.addEventListener("click", () => window.open(repo.url, "_blank", "noopener,noreferrer"));
    elements.cmdkResults.append(item);
  });
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
    applyFilters();
  });

  [
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
    fetchStars();
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
