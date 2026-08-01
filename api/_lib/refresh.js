import { createEmbeddings, hasEmbeddingProvider } from "./embeddings.js";
import { fetchGitHubStars } from "./github.js";
import { initSchema, upsertRepos } from "./repo-store.js";
import { buildSearchDocument } from "./taxonomy.js";

const EMBEDDING_BATCH_SIZE = 64;

export async function refreshStars() {
  await initSchema();
  const repos = await fetchGitHubStars();
  const embeddings = hasEmbeddingProvider() ? await embedRepos(repos) : repos.map(() => null);
  const result = await upsertRepos(repos, embeddings);
  return {
    fetched: repos.length,
    saved: result.saved,
    embedded: result.embedded,
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
