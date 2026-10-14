import test from "node:test";
import assert from "node:assert/strict";
import { assemblePost, checkPost, HOOK_MAX_CHARS, postProse, unexplainedJargon } from "../api/_lib/post-format.js";
import { sampleDraft, sampleEntries } from "./fixtures/sample-draft.mjs";

function samplePost(overrides = {}) {
  const draft = { ...sampleDraft, entries: sampleEntries(), ...overrides };
  return { ...draft, bodyText: assemblePost(draft) };
}

test("assembles hook, intro, numbered entries with URLs, then the question", () => {
  const text = assemblePost({ ...sampleDraft, entries: sampleEntries() });
  const blocks = text.split("\n\n");
  assert.equal(blocks[0], sampleDraft.hook);
  assert.equal(blocks[1], sampleDraft.intro);
  assert.equal(blocks[2], `1. GeoLibre: ${sampleDraft.entries[0].blurb}\nhttps://github.com/opengeos/GeoLibre`);
  assert.ok(blocks[6].startsWith("5. Blocklight: "));
  assert.equal(blocks[7], sampleDraft.question);
});

test("the sample post passes every check", () => {
  const result = checkPost(samplePost());
  assert.deepEqual(result.problems, []);
  assert.equal(result.ok, true);
  assert.ok(result.score <= 25);
});

test("rejects an em dash", () => {
  const result = checkPost(samplePost({ intro: "Most of these run in a browser — two keep data local." }));
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((problem) => problem.includes("em dash")));
});

test("rejects an en dash", () => {
  const result = checkPost(samplePost({ intro: "Pages 1–3 cover setup." }));
  assert.equal(result.ok, false);
});

test("rejects a hook longer than the LinkedIn fold", () => {
  const result = checkPost(samplePost({ hook: "a".repeat(HOOK_MAX_CHARS + 1) }));
  assert.ok(result.problems.some((problem) => problem.startsWith("Hook is")));
});

test("rejects a post over 3000 characters", () => {
  const long = "Words that go on. ".repeat(200);
  const result = checkPost(samplePost({ intro: long }));
  assert.ok(result.problems.some((problem) => problem.includes("3000")));
});

test("rejects a URL written by the model", () => {
  const entries = sampleEntries();
  entries[0] = { ...entries[0], blurb: "See https://example.com for more." };
  const result = checkPost(samplePost({ entries }));
  assert.ok(result.problems.some((problem) => problem.includes("URL")));
});

test("rejects markdown bold", () => {
  const result = checkPost(samplePost({ intro: "These are **really** good." }));
  assert.ok(result.problems.some((problem) => problem.includes("markdown")));
});

test("rejects an empty blurb", () => {
  const entries = sampleEntries();
  entries[2] = { ...entries[2], blurb: "  " };
  const result = checkPost(samplePost({ entries }));
  assert.ok(result.problems.some((problem) => problem.includes("blurb")));
});

test("rejects a sloppy post and names what was flagged", () => {
  const result = checkPost(samplePost({
    intro: "These groundbreaking tools seamlessly empower you to delve into a vibrant tapestry of robust, transformative, cutting-edge geospatial workflows."
  }));
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((problem) => problem.startsWith("Sloplint score")));
});

test("rejects programmer jargon left unexplained", () => {
  const entries = sampleEntries();
  entries[0] = { ...entries[0], blurb: "A CLI for maps that runs inside tmux sessions." };
  const result = checkPost(samplePost({ entries }));
  const problem = result.problems.find((item) => item.startsWith("Explain these"));
  assert.ok(problem, "expected a jargon problem");
  assert.ok(problem.includes("CLI") && problem.includes("tmux"));
});

test("accepts jargon explained in brackets on first use", () => {
  const entries = sampleEntries();
  entries[0] = { ...entries[0], blurb: "A CLI (a text-only command window) for maps. Later the CLI stays simple." };
  assert.deepEqual(unexplainedJargon(postProse({ ...sampleDraft, entries })), []);
});

test("accepts a spelled-out term with the acronym in brackets", () => {
  assert.deepEqual(unexplainedJargon("It speaks the Model Context Protocol (MCP)."), []);
});

test("catches plurals and hyphenated forms", () => {
  assert.deepEqual(unexplainedJargon("Two APIs and GPU-accelerated drawing."), ["API", "GPU"]);
});

test("ignores jargon inside project titles", () => {
  const entries = sampleEntries();
  entries[1] = { ...entries[1], title: "RustGIS CLI" };
  const result = checkPost(samplePost({ entries }));
  assert.ok(!result.problems.some((item) => item.startsWith("Explain these")));
});

test("accepts a bracket that explains the term's short phrase", () => {
  assert.deepEqual(unexplainedJargon("A list of MCP servers (add-ons that let AI apps work with maps)."), []);
});

test("a bracket three words later does not count", () => {
  assert.deepEqual(unexplainedJargon("A CLI for drawing city maps (beta)."), ["CLI"]);
});
