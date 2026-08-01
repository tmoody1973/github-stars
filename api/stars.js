import { hasDatabase } from "./_lib/db.js";
import { initSchema, listRepos, repoStats } from "./_lib/repo-store.js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ ok: false, error: "Method not allowed." });
  }

  if (!hasDatabase()) {
    return response.status(501).json({ ok: false, error: "DATABASE_URL is not configured." });
  }

  try {
    await initSchema();
    const [repos, stats] = await Promise.all([listRepos(), repoStats()]);
    return response.status(200).json({
      ok: true,
      source: "neon",
      semanticReady: stats.embeddingCount > 0,
      stats,
      repos
    });
  } catch (error) {
    return response.status(500).json({ ok: false, error: error.message });
  }
}
