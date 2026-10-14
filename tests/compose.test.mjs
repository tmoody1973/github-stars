import test from "node:test";
import assert from "node:assert/strict";
import { composePost } from "../api/_lib/compose.js";
import { sampleDraft, sampleRepos } from "./fixtures/sample-draft.mjs";

function writerReturning(...drafts) {
  const calls = [];
  const write = async (input) => {
    calls.push(input);
    return drafts[Math.min(calls.length - 1, drafts.length - 1)];
  };
  return { write, calls };
}

const sloppy = {
  ...sampleDraft,
  intro: "These groundbreaking tools seamlessly empower you to delve into a vibrant tapestry of robust, transformative workflows — truly game-changing."
};

test("publishes on the first attempt when the draft passes", async () => {
  const { write, calls } = writerReturning(sampleDraft);
  const result = await composePost({ repos: sampleRepos, write });
  assert.equal(result.ok, true);
  assert.equal(result.attempts, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].feedback, null);
  assert.ok(result.bodyText.includes("https://github.com/opengeos/RustGIS"));
});

test("rewrites once with the problems and the previous draft", async () => {
  const { write, calls } = writerReturning(sloppy, sampleDraft);
  const result = await composePost({ repos: sampleRepos, write });
  assert.equal(result.ok, true);
  assert.equal(result.attempts, 2);
  assert.ok(calls[1].feedback.problems.length > 0);
  assert.equal(calls[1].feedback.previous, sloppy);
});

test("gives up after two failing drafts", async () => {
  const { write, calls } = writerReturning(sloppy, sloppy, sampleDraft);
  const result = await composePost({ repos: sampleRepos, write });
  assert.equal(result.ok, false);
  assert.equal(result.attempts, 2);
  assert.equal(calls.length, 2);
  assert.ok(result.problems.length > 0);
});

test("treats an unknown repo id as a failure", async () => {
  const bad = { ...sampleDraft, entries: [...sampleDraft.entries.slice(0, 4), { repoId: 999, title: "X", blurb: "Y." }] };
  const { write } = writerReturning(bad, bad);
  const result = await composePost({ repos: sampleRepos, write });
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((problem) => problem.includes("999")));
});

test("treats a duplicated repo as a failure", async () => {
  const bad = { ...sampleDraft, entries: [...sampleDraft.entries.slice(0, 4), sampleDraft.entries[0]] };
  const { write } = writerReturning(bad, bad);
  const result = await composePost({ repos: sampleRepos, write });
  assert.equal(result.ok, false);
});

test("treats four entries as a failure", async () => {
  const bad = { ...sampleDraft, entries: sampleDraft.entries.slice(0, 4) };
  const { write } = writerReturning(bad, bad);
  const result = await composePost({ repos: sampleRepos, write });
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((problem) => problem.includes("Expected 5")));
});
