import { createEmbeddings, hasEmbeddingProvider } from "./embeddings.js";
import { fetchGitHubStars } from "./github.js";
import { initSchema, repoStats, reposNeedingEmbeddings, upsertRepos } from "./repo-store.js";
import { buildSearchDocument } from "./taxonomy.js";

const EMBEDDING_BATCH_SIZE = 64;

export async function refreshStars({ minIntervalMs = 0 } = {}) {
  await initSchema();
  if (minIntervalMs > 0) {
    const stats = await repoStats();
    const refreshedAt = stats.refreshedAt ? new Date(stats.refreshedAt).getTime() : 0;
    if (refreshedAt && Date.now() - refreshedAt < minIntervalMs) {
      return {
        fetched: 0,
        saved: 0,
        embedded: 0,
        embeddingCandidates: 0,
        embeddingsConfigured: hasEmbeddingProvider(),
        skipped: true,
        reason: "recently-refreshed",
        refreshedAt: stats.refreshedAt
      };
    }
  }

  const repos = await fetchGitHubStars();
  const embeddingTargets = hasEmbeddingProvider() ? await reposNeedingEmbeddings(repos) : [];
  const targetEmbeddings = embeddingTargets.length ? await embedRepos(embeddingTargets) : [];
  const embeddingById = new Map(
    embeddingTargets.map((repo, index) => [Number(repo.id), targetEmbeddings[index] || null])
  );
  const embeddings = repos.map((repo) => embeddingById.get(Number(repo.id)) || null);
  const result = await upsertRepos(repos, embeddings);
  return {
    fetched: repos.length,
    saved: result.saved,
    embedded: result.embedded,
    embeddingCandidates: embeddingTargets.length,
    embeddingsConfigured: hasEmbeddingProvider()
  };
}

async function embedRepos(repos) {
  const embeddings = [];
  for (let index = 0; index < repos.length; index += EMBEDDING_BATCH_SIZE) {
    const batch = repos.slice(index, index + EMBEDDING_BATCH_SIZE);
    const inputs = batch.map((repo) => buildSearchDocument(repo));
    const batchEmbeddings = await createEmbeddings(inputs);
    embeddings.push(...batchEmbeddings);
  }
  return embeddings;
}
function (
