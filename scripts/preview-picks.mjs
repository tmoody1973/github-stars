// Simulates the next N weekday picks on a TEST database by marking picks as used.
// Usage: TEST_DATABASE_URL=... node scripts/preview-picks.mjs 10
if (!process.env.TEST_DATABASE_URL) {
  console.error("Set TEST_DATABASE_URL to a throwaway Neon branch. This script writes rows.");
  process.exit(1);
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const { sql } = await import("../api/_lib/db.js");
const { initPostSchema, savePost } = await import("../api/_lib/post-store.js");
const { pickRepos } = await import("../api/_lib/picker.js");

const days = Number(process.argv[2] || 10);
await initPostSchema();

for (let day = 0; day < days; day += 1) {
  const date = new Date(Date.UTC(2099, 5, 1 + day)).toISOString().slice(0, 10);
  const { seedRepoId, repos } = await pickRepos();
  console.log(`\n${date}  seed: ${repos[0].fullName}`);
  repos.forEach((repo) => console.log(`  - ${repo.fullName}: ${repo.description.slice(0, 90)}`));
  await savePost({
    date,
    theme: "preview",
    hook: "",
    bodyText: "",
    entries: repos.map((repo) => ({ repoId: repo.id, title: repo.name, blurb: "", url: repo.url, fullName: repo.fullName })),
    seedRepoId,
    score: 0,
    attempts: 0,
    writerModel: "preview"
  });
}

await sql()`DELETE FROM posts WHERE post_date >= '2099-01-01'`;
