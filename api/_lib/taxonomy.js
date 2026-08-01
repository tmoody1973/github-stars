export const USERNAME = "tmoody1973";
export const MAX_PAGES = 10;
export const PER_PAGE = 100;

export const CATEGORY_RULES = [
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

export function normalizeGitHubStar(item) {
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
    homepage: repo.homepage || ""
  };

  base.category = categorizeRepo(base);
  base.summary = summarizeRepo(base);
  base.searchDocument = buildSearchDocument(base);
  return base;
}

export function categorizeRepo(repo) {
  const text = [repo.fullName, repo.description, repo.language, ...(repo.topics || [])].join(" ").toLowerCase();
  const scores = CATEGORY_RULES.map((rule) => {
    const score = rule.keywords.reduce((total, keyword) => (text.includes(keyword) ? total + 1 : total), 0);
    return { rule, score };
  }).sort((a, b) => b.score - a.score);

  return scores[0]?.score > 0 ? scores[0].rule.name : "General utilities";
}

export function summarizeRepo(repo) {
  const category = repo.category || "General utilities";
  const language = repo.language && repo.language !== "Unspecified" ? `${repo.language} repo` : "repo";
  const topicHint = repo.topics?.length ? ` It is tagged with ${repo.topics.slice(0, 3).join(", ")}.` : "";
  const description = repo.description && repo.description !== "No description provided." ? repo.description.trim() : "";

  if (description) {
    const cleaned = description.replace(/\s+/g, " ").replace(/[.。]+$/, "");
    return `${category}: ${cleaned}.${topicHint}`;
  }

  return `${category}: a ${language} from ${repo.owner} saved for later review.${topicHint}`;
}

export function buildSearchDocument(repo) {
  return [
    repo.fullName,
    repo.owner,
    repo.name,
    repo.description,
    repo.category,
    repo.summary,
    repo.language,
    ...(repo.topics || [])
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
