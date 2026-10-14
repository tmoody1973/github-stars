import test from "node:test";
import assert from "node:assert/strict";

const enabled = Boolean(process.env.TEST_DATABASE_URL);
if (enabled) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const { sql } = await import("../../api/_lib/db.js");
const store = await import("../../api/_lib/post-store.js");

function newPost(date, repoIds) {
  return {
    date,
    theme: "Test theme",
    hook: "Hook",
    bodyText: "Body",
    entries: repoIds.map((repoId, index) => ({ repoId, title: `T${index}`, blurb: "B", url: `https://github.com/x/${repoId}`, fullName: `x/${repoId}` })),
    seedRepoId: repoIds[0],
    score: 10,
    attempts: 1,
    writerModel: "test"
  };
}

test("saves a post and marks its repos used, atomically", { skip: !enabled }, async () => {
  const db = sql();
  await store.initPostSchema();
  await db`DELETE FROM posts WHERE post_date >= '2099-01-01'`;

  const id = await store.savePost(newPost("2099-01-01", [9000000001, 9000000002, 9000000003, 9000000004, 9000000005]));
  assert.ok(id > 0);
  const found = await store.findPostByDate("2099-01-01");
  assert.equal(found.entries.length, 5);
  assert.equal(found.date, "2099-01-01");

  await assert.rejects(store.savePost(newPost("2099-01-01", [9000000006, 9000000007, 9000000008, 9000000009, 9000000010])));
  await assert.rejects(store.savePost(newPost("2099-01-02", [9000000001, 9000000011, 9000000012, 9000000013, 9000000014])));

  const [{ count: posts }] = await db`SELECT COUNT(*)::int AS count FROM posts WHERE post_date >= '2099-01-01'`;
  const [{ count: used }] = await db`SELECT COUNT(*)::int AS count FROM post_repos WHERE repo_id >= 9000000000`;
  assert.equal(posts, 1, "the duplicate date and the reused repo must not create posts");
  assert.equal(used, 5, "a failed save must not leave repos marked used");

  const latest = await store.listPosts({ limit: 1 });
  assert.equal(latest[0].date, "2099-01-01");

  await db`DELETE FROM posts WHERE post_date >= '2099-01-01'`;
});
