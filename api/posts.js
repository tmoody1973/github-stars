import { hasDatabase } from "./_lib/db.js";
import { initPostSchema, listPosts } from "./_lib/post-store.js";

const PAGE_SIZE = 20;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const before = request.query?.before ?? null;
  if (before !== null && !ISO_DATE.test(before)) {
    return response.status(400).json({ ok: false, error: "before must be a date like 2026-10-15." });
  }
  if (!hasDatabase()) return response.status(501).json({ ok: false, error: "DATABASE_URL is not configured." });

  try {
    await initPostSchema();
    const posts = await listPosts({ limit: PAGE_SIZE, before });
    const nextBefore = posts.length === PAGE_SIZE ? posts.at(-1).date : null;
    response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
    return response.status(200).json({ ok: true, posts, nextBefore });
  } catch (error) {
    response.setHeader("Cache-Control", "no-store");
    return response.status(500).json({ ok: false, error: error.message });
  }
}
