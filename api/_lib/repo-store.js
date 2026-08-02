import { sql, vectorLiteral } from "./db.js";
import { buildSearchDocument } from "./taxonomy.js";

export async function initSchema() {
  const db = sql();
  await db`CREATE EXTENSION IF NOT EXISTS vector`;
  await db`
    CREATE TABLE IF NOT EXISTS repos (
      id BIGINT PRIMARY KEY,
      name TEXT NOT NULL,
      full_name TEXT NOT NULL UNIQUE,
      owner TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      language TEXT NOT NULL DEFAULT 'Unspecified',
      topics JSONB NOT NULL DEFAULT '[]'::jsonb,
      stars INTEGER NOT NULL DEFAULT 0,
      forks INTEGER NOT NULL DEFAULT 0,
      issues INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ,
      pushed_at TIMESTAMPTZ,
      starred_at TIMESTAMPTZ,
      url TEXT NOT NULL,
      homepage TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'General utilities',
      summary TEXT NOT NULL DEFAULT '',
      search_document TEXT NOT NULL DEFAULT '',
      embedding vector(1536),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await db`CREATE INDEX IF NOT EXISTS repos_category_idx ON repos (category)`;
  await db`CREATE INDEX IF NOT EXISTS repos_language_idx ON repos (language)`;
  await db`CREATE INDEX IF NOT EXISTS repos_starred_at_idx ON repos (starred_at DESC)`;
  await db`CREATE INDEX IF NOT EXISTS repos_search_document_trgm_idx ON repos USING gin (to_tsvector('english', search_document))`;
  await db`
    CREATE INDEX IF NOT EXISTS repos_embedding_idx
    ON repos USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 32)
    WHERE embedding IS NOT NULL
  `;
}

export async function upsertRepos(repos, embeddings = []) {
  const db = sql();
  let embedded = 0;

  for (const [index, repo] of repos.entries()) {
    const embedding = embeddings[index] || null;
    if (embedding) embedded += 1;
    const searchDocument = repo.searchDocument || buildSearchDocument(repo);
    const embeddingText = embedding ? vectorLiteral(embedding) : null;

    if (embeddingText) {
      await db`
        INSERT INTO repos (
          id, name, full_name, owner, description, language, topics, stars, forks, issues,
          updated_at, pushed_at, starred_at, url, homepage, category, summary, search_document, embedding, refreshed_at
        )
        VALUES (
          ${repo.id}, ${repo.name}, ${repo.fullName}, ${repo.owner}, ${repo.description}, ${repo.language},
          ${JSON.stringify(repo.topics || [])}::jsonb, ${repo.stars}, ${repo.forks}, ${repo.issues},
          ${repo.updatedAt}, ${repo.pushedAt}, ${repo.starredAt}, ${repo.url}, ${repo.homepage || ""},
          ${repo.category}, ${repo.summary}, ${searchDocument}, ${embeddingText}::vector, now()
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          full_name = EXCLUDED.full_name,
          owner = EXCLUDED.owner,
          description = EXCLUDED.description,
          language = EXCLUDED.language,
          topics = EXCLUDED.topics,
          stars = EXCLUDED.stars,
          forks = EXCLUDED.forks,
          issues = EXCLUDED.issues,
          updated_at = EXCLUDED.updated_at,
          pushed_at = EXCLUDED.pushed_at,
          starred_at = EXCLUDED.starred_at,
          url = EXCLUDED.url,
          homepage = EXCLUDED.homepage,
          category = EXCLUDED.category,
          summary = EXCLUDED.summary,
          search_document = EXCLUDED.search_document,
          embedding = EXCLUDED.embedding,
          refreshed_at = now()
      `;
    } else {
      await db`
        INSERT INTO repos (
          id, name, full_name, owner, description, language, topics, stars, forks, issues,
          updated_at, pushed_at, starred_at, url, homepage, category, summary, search_document, refreshed_at
        )
        VALUES (
          ${repo.id}, ${repo.name}, ${repo.fullName}, ${repo.owner}, ${repo.description}, ${repo.language},
          ${JSON.stringify(repo.topics || [])}::jsonb, ${repo.stars}, ${repo.forks}, ${repo.issues},
          ${repo.updatedAt}, ${repo.pushedAt}, ${repo.starredAt}, ${repo.url}, ${repo.homepage || ""},
          ${repo.category}, ${repo.summary}, ${searchDocument}, now()
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          full_name = EXCLUDED.full_name,
          owner = EXCLUDED.owner,
          description = EXCLUDED.description,
          language = EXCLUDED.language,
          topics = EXCLUDED.topics,
          stars = EXCLUDED.stars,
          forks = EXCLUDED.forks,
          issues = EXCLUDED.issues,
          updated_at = EXCLUDED.updated_at,
          pushed_at = EXCLUDED.pushed_at,
          starred_at = EXCLUDED.starred_at,
          url = EXCLUDED.url,
          homepage = EXCLUDED.homepage,
          category = EXCLUDED.category,
          summary = EXCLUDED.summary,
          search_document = EXCLUDED.search_document,
          refreshed_at = now()
      `;
    }
  }

  return { saved: repos.length, embedded };
}

export async function reposNeedingEmbeddings(repos) {
  if (!repos.length) return [];

  const db = sql();
  const rows = await db`
    SELECT id, search_document, embedding IS NOT NULL AS has_embedding
    FROM repos
  `;
  const existing = new Map(rows.map((row) => [
    Number(row.id),
    {
      searchDocument: row.search_document || "",
      hasEmbedding: Boolean(row.has_embedding)
    }
  ]));

  return repos.filter((repo) => {
    const currentDocument = repo.searchDocument || buildSearchDocument(repo);
    const saved = existing.get(Number(repo.id));
    return !saved || !saved.hasEmbedding || saved.searchDocument !== currentDocument;
  });
}

export async function listRepos() {
  const db = sql();
  const rows = await db`
    SELECT *, embedding IS NOT NULL AS has_embedding
    FROM repos
    ORDER BY starred_at DESC NULLS LAST, stars DESC
  `;
  return rows.map(rowToRepo);
}

export async function repoStats() {
  const db = sql();
  const [row] = await db`
    SELECT
      COUNT(*)::int AS repo_count,
      COUNT(*) FILTER (WHERE embedding IS NOT NULL)::int AS embedding_count,
      MAX(refreshed_at) AS refreshed_at
    FROM repos
  `;
  return {
    repoCount: row?.repo_count || 0,
    embeddingCount: row?.embedding_count || 0,
    refreshedAt: row?.refreshed_at || null
  };
}

export async function searchRepos(query, embedding, limit = 80) {
  const db = sql();
  const cleanQuery = query.trim();

  if (embedding?.length) {
    const queryVector = vectorLiteral(embedding);
    const semanticRows = await db`
      SELECT *, embedding IS NOT NULL AS has_embedding, 1 - (embedding <=> ${queryVector}::vector) AS score, TRUE AS semantic_match
      FROM repos
      WHERE embedding IS NOT NULL
      ORDER BY (embedding <=> ${queryVector}::vector) + 0
      LIMIT ${limit}
    `;

    if (semanticRows.length) return semanticRows.map(rowToRepo);
  }

  const lexicalRows = await db`
    SELECT *, ts_rank(to_tsvector('english', search_document), plainto_tsquery('english', ${cleanQuery})) AS score, FALSE AS semantic_match
    FROM repos
    WHERE search_document ILIKE ${`%${cleanQuery}%`}
       OR to_tsvector('english', search_document) @@ plainto_tsquery('english', ${cleanQuery})
    ORDER BY score DESC, stars DESC
    LIMIT ${limit}
  `;
  return lexicalRows.map(rowToRepo);
}

function rowToRepo(row) {
  return {
    id: Number(row.id),
    name: row.name,
    fullName: row.full_name,
    owner: row.owner,
    description: row.description,
    language: row.language,
    topics: parseTopics(row.topics),
    stars: row.stars,
    forks: row.forks,
    issues: row.issues,
    updatedAt: row.updated_at,
    pushedAt: row.pushed_at,
    starredAt: row.starred_at,
    url: row.url,
    homepage: row.homepage,
    category: row.category,
    summary: row.summary,
    hasEmbedding: Boolean(row.has_embedding),
    score: row.score === null || row.score === undefined ? null : Number(row.score),
    semanticMatch: Boolean(row.semantic_match)
  };
}

function parseTopics(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
