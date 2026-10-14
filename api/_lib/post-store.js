import { sql } from "./db.js";

export async function initPostSchema(db = sql()) {
  await db`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      post_date DATE NOT NULL UNIQUE,
      theme TEXT NOT NULL,
      hook TEXT NOT NULL,
      body_text TEXT NOT NULL,
      entries JSONB NOT NULL,
      seed_repo_id BIGINT NOT NULL,
      sloplint_score INTEGER NOT NULL,
      attempts SMALLINT NOT NULL,
      writer_model TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  // No foreign key to repos on purpose: a future cleanup of unstarred repos must never be blocked
  // by an old post. The primary key alone guarantees a repo is featured at most once.
  await db`
    CREATE TABLE IF NOT EXISTS post_repos (
      repo_id BIGINT PRIMARY KEY,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      position SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 5)
    )
  `;
}

// One statement, so the post and its five "used" rows are saved together or not at all.
export async function savePost(post, db = sql()) {
  const picks = JSON.stringify(post.entries.map((entry, index) => ({ repo_id: entry.repoId, position: index + 1 })));
  const rows = await db`
    WITH new_post AS (
      INSERT INTO posts (post_date, theme, hook, body_text, entries, seed_repo_id, sloplint_score, attempts, writer_model)
      VALUES (
        ${post.date}::date, ${post.theme}, ${post.hook}, ${post.bodyText}, ${JSON.stringify(post.entries)}::jsonb,
        ${post.seedRepoId}, ${post.score}, ${post.attempts}, ${post.writerModel}
      )
      RETURNING id
    )
    INSERT INTO post_repos (repo_id, post_id, position)
    SELECT pick.repo_id, new_post.id, pick.position
    FROM new_post, jsonb_to_recordset(${picks}::jsonb) AS pick(repo_id BIGINT, position SMALLINT)
    RETURNING post_id
  `;
  return rows[0].post_id;
}

export async function findPostByDate(date, db = sql()) {
  const rows = await db`
    SELECT id, post_date::text AS post_date, theme, hook, body_text, entries, sloplint_score, attempts
    FROM posts
    WHERE post_date = ${date}::date
  `;
  return rows[0] ? rowToPost(rows[0]) : null;
}

export async function listPosts({ limit = 20 } = {}, db = sql()) {
  const rows = await db`
    SELECT id, post_date::text AS post_date, theme, hook, body_text, entries, sloplint_score, attempts
    FROM posts
    ORDER BY post_date DESC
    LIMIT ${limit}
  `;
  return rows.map(rowToPost);
}

function rowToPost(row) {
  return {
    id: row.id,
    date: row.post_date,
    theme: row.theme,
    hook: row.hook,
    bodyText: row.body_text,
    entries: typeof row.entries === "string" ? JSON.parse(row.entries) : row.entries,
    score: row.sloplint_score,
    attempts: row.attempts
  };
}
