import { initSchema, repoStats } from "../api/_lib/repo-store.js";

await initSchema();
const stats = await repoStats();
console.log(JSON.stringify({ ok: true, ...stats }, null, 2));
