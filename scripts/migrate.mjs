import { initSchema, repoStats } from "../api/_lib/repo-store.js";
import { initPostSchema } from "../api/_lib/post-store.js";

await initSchema();
await initPostSchema();
const stats = await repoStats();
console.log(JSON.stringify({ ok: true, ...stats }, null, 2));
