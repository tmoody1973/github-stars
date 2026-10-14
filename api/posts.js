import { hasDatabase } from "./_lib/db.js";
import { initPostSchema, listPosts } from "./_lib/post-store.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ ok: false, error: "Method not allowed." });
  }
  if (!hasDatabase()) return response.status(501).json({ ok: false, error: "DATABASE_URL is not configured." });

  try {
    await initPostSchema();
    const posts = await listPosts({ limit: 20 });
    response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
    return response.status(200).json({ ok: true, posts });
  } catch (error) {
    response.setHeader("Cache-Control", "no-store");
    return response.status(500).json({ ok: false, error: error.message });
  }
}
