import { assemblePost, checkPost } from "./post-format.js";

const MAX_ATTEMPTS = 2;

export async function composePost({ repos, write }) {
  let feedback = null;
  let problems = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const draft = await write({ repos, feedback });
    const matched = matchEntries(draft, repos);

    if (matched.problems.length) {
      problems = matched.problems;
    } else {
      const parts = { hook: draft.hook, intro: draft.intro, question: draft.question, entries: matched.list };
      const bodyText = assemblePost(parts);
      const check = checkPost({ ...parts, bodyText });
      if (check.ok) return { ok: true, attempts: attempt, draft, entries: matched.list, bodyText, score: check.score };
      problems = check.problems;
    }

    feedback = { problems, previous: draft };
  }

  return { ok: false, attempts: MAX_ATTEMPTS, problems };
}

export function matchEntries(draft, repos) {
  const byId = new Map(repos.map((repo) => [Number(repo.id), repo]));
  const seen = new Set();
  const list = [];
  const problems = [];

  for (const entry of draft.entries || []) {
    const repo = byId.get(Number(entry.repoId));
    if (!repo) {
      problems.push(`Entry uses repoId ${entry.repoId}, which is not one of the five repos.`);
      continue;
    }
    if (seen.has(repo.id)) {
      problems.push(`repoId ${entry.repoId} appears more than once.`);
      continue;
    }
    seen.add(repo.id);
    list.push({
      repoId: Number(repo.id),
      fullName: repo.fullName,
      url: repo.url,
      title: String(entry.title || ""),
      blurb: String(entry.blurb || "")
    });
  }

  if (list.length !== repos.length) problems.push(`Expected ${repos.length} entries, one per repo; got ${list.length}.`);
  return { list, problems };
}
