import { hasDatabase } from "./_lib/db.js";
import { initSchema } from "./_lib/repo-store.js";
import { initPostSchema, findPostByDate, savePost } from "./_lib/post-store.js";
import { pickRepos } from "./_lib/picker.js";
import { composePost } from "./_lib/compose.js";
import { writeDraft, WRITER_MODEL } from "./_lib/writer.js";
import { todayInChicago } from "./_lib/dates.js";
import { isAuthorizedAdmin, isAuthorizedCron } from "./_lib/auth.js";

export function createHandler(deps) {
  return async function handler(request, response) {
    response.setHeader("Cache-Control", "no-store");

    if (!["GET", "POST"].includes(request.method)) {
      response.setHeader("Allow", "GET, POST");
      return response.status(405).json({ ok: false, error: "Method not allowed." });
    }

    const authorized = request.method === "GET" ? isAuthorizedCron(request) : isAuthorizedAdmin(request);
    if (!authorized) return response.status(401).json({ ok: false, error: "Unauthorized." });
    if (!deps.hasDatabase()) return response.status(501).json({ ok: false, error: "DATABASE_URL is not configured." });

    const dryRun = request.method === "POST" && request.query?.dryRun === "1";

    try {
      await deps.initSchemas();
      const date = deps.today();

      if (!dryRun) {
        const existing = await deps.findPostByDate(date);
        if (existing) return response.status(200).json({ ok: true, status: "exists", post: existing });
      }

      const picked = await deps.pickRepos();
      const composed = await deps.composePost({ repos: picked.repos, write: deps.write });

      if (!composed.ok) {
        console.error("generate-post: gate failed", { date, problems: composed.problems });
        return response.status(422).json({
          ok: false,
          status: "gate-failed",
          problems: composed.problems,
          repos: picked.repos.map((repo) => repo.fullName)
        });
      }

      const post = {
        date,
        theme: composed.draft.theme.trim(),
        hook: composed.draft.hook.trim(),
        bodyText: composed.bodyText,
        entries: composed.entries,
        seedRepoId: picked.seedRepoId,
        score: composed.score,
        attempts: composed.attempts,
        writerModel: deps.writerModel
      };

      if (dryRun) return response.status(200).json({ ok: true, status: "dry-run", post });

      const id = await deps.savePost(post);
      return response.status(200).json({ ok: true, status: "published", post: { id, ...post } });
    } catch (error) {
      console.error("generate-post: failed", error);
      return response.status(500).json({ ok: false, error: error.message });
    }
  };
}

export default createHandler({
  hasDatabase,
  initSchemas: async () => {
    await initSchema();
    await initPostSchema();
  },
  today: () => todayInChicago(),
  findPostByDate: (date) => findPostByDate(date),
  pickRepos: () => pickRepos(),
  composePost,
  write: writeDraft,
  savePost: (post) => savePost(post),
  writerModel: WRITER_MODEL
});
