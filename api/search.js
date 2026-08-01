import { hasDatabase } from "./_lib/db.js";
import { createEmbedding, hasEmbeddingProvider } from "./_lib/embeddings.js";
import { initSchema, searchRepos } from "./_lib/repo-store.js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const query = String(request.query?.q || "").trim();
  if (!query) return response.status(200).json({ ok: true, mode: "empty", semantic: false, repos: [] });
  if (!hasDatabase()) return response.status(501).json({ ok: false, error: "DATABASE_URL is not configured." });

  try {
    await initSchema();
    const embedding = hasEmbeddingProvider() ? await createEmbedding(query) : null;
    const repos = await searchRepos(query, embedding);
    return response.status(200).json({
      ok: true,
      mode: embedding ? "semantic" : "database-keyword",
      semantic: Boolean(embedding && repos.some((repo) => repo.semanticMatch)),
      embeddingsConfigured: hasEmbeddingProvider(),
      repos
    });
  } catch (error) {
    return response.status(500).json({ ok: false, error: error.message });
  }
}
