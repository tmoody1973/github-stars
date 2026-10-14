import { sql } from "./db.js";
import { fetchRepoDetails } from "./github.js";

export const PICK_COUNT = 5;
// Starting values from the spec; tuned with scripts/preview-picks.mjs before launch.
export const SEED_RECENT_MAX_SIMILARITY = 0.8;
export const NEIGHBOR_MIN_SIMILARITY = 0.5;
export const MAX_SEEDS_TRIED = 20;
const NEIGHBOR_POOL = 8;
// taxonomy.js stores this placeholder when GitHub has no description; those repos share an
// identical embedding and would cluster into a meaningless "theme".
const NO_DESCRIPTION = "No description provided.";

export async function pickRepos({ db = sql(), detailsFor = fetchRepoDetails } = {}) {
  const seeds = await findSeedCandidates(db);
  for (const seed of seeds) {
    const neighbors = await findNeighbors(db, seed.id);
    const kept = await keepActive([seed, ...neighbors], detailsFor, PICK_COUNT);
    if (kept) return { seedRepoId: seed.id, repos: kept };
  }
  throw new Error(`No unused theme found after trying ${seeds.length} seed repos.`);
}

export async function keepActive(candidates, detailsFor, count) {
  if (candidates.length < count) return null;
  const kept = [];
  for (const [index, repo] of candidates.entries()) {
    if (kept.length === count) break;
    const details = await detailsFor(repo.fullName);
    const active = details && !details.archived;
    if (!active && index === 0) return null;
    if (active) kept.push({ ...repo, readme: details.readme });
  }
  return kept.length === count ? kept : null;
}

async function findSeedCandidates(db) {
  const rows = await db`
    SELECT r.id, r.full_name, r.name, r.description, r.topics, r.url, r.starred_at
    FROM repos r
    WHERE r.embedding IS NOT NULL
      AND r.description NOT IN ('', ${NO_DESCRIPTION})
      AND NOT EXISTS (SELECT 1 FROM post_repos used WHERE used.repo_id = r.id)
      AND NOT EXISTS (
        SELECT 1
        FROM (SELECT seed_repo_id FROM posts ORDER BY post_date DESC LIMIT 3) recent
        JOIN repos s ON s.id = recent.seed_repo_id
        WHERE 1 - (s.embedding <=> r.embedding) > ${SEED_RECENT_MAX_SIMILARITY}
      )
    ORDER BY r.starred_at DESC NULLS LAST
    LIMIT ${MAX_SEEDS_TRIED}
  `;
  return rows.map(rowToCandidate);
}

async function findNeighbors(db, seedId) {
  // "+ 0" forces an exact scan instead of the approximate index, matching searchRepos; 992 rows is cheap.
  const rows = await db`
    SELECT r.id, r.full_name, r.name, r.description, r.topics, r.url, r.starred_at
    FROM repos r, repos s
    WHERE s.id = ${seedId}
      AND r.id <> s.id
      AND r.embedding IS NOT NULL
      AND r.description NOT IN ('', ${NO_DESCRIPTION})
      AND NOT EXISTS (SELECT 1 FROM post_repos used WHERE used.repo_id = r.id)
      AND 1 - (r.embedding <=> s.embedding) >= ${NEIGHBOR_MIN_SIMILARITY}
    ORDER BY (r.embedding <=> s.embedding) + 0
    LIMIT ${NEIGHBOR_POOL}
  `;
  return rows.map(rowToCandidate);
}

function rowToCandidate(row) {
  return {
    id: Number(row.id),
    fullName: row.full_name,
    name: row.name,
    description: row.description,
    topics: Array.isArray(row.topics) ? row.topics : JSON.parse(row.topics || "[]"),
    url: row.url,
    starredAt: row.starred_at instanceof Date ? row.starred_at.toISOString() : row.starred_at
  };
}
