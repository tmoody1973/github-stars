import test from "node:test";
import assert from "node:assert/strict";
import { buildMessages, parseDraft } from "../api/_lib/writer.js";
import { sampleDraft } from "./fixtures/sample-draft.mjs";

const repos = [
  { id: 1, fullName: "opengeos/GeoLibre", description: "Cloud-native GIS", topics: ["gis"], starredAt: "2026-10-13T18:23:24.000Z", readme: "# GeoLibre\nRuns in Jupyter." },
  { id: 2, fullName: "someone/empty", description: "Thin repo", topics: [], starredAt: "2026-10-12T10:00:00.000Z", readme: "" }
];

test("system prompt carries the core rules", () => {
  const [system] = buildMessages({ repos, feedback: null });
  assert.equal(system.role, "system");
  for (const rule of ["em dash", "Never write a URL", "only facts", "never claim Tarik used", "210", "delve"]) {
    assert.ok(system.content.includes(rule), `missing rule: ${rule}`);
  }
});

test("user prompt includes every repo id, README and starred date", () => {
  const [, user] = buildMessages({ repos, feedback: null });
  assert.ok(user.content.includes("Repo id: 1"));
  assert.ok(user.content.includes("Runs in Jupyter."));
  assert.ok(user.content.includes("2026-10-13"));
});

test("a missing README is marked so the writer stays short", () => {
  const [, user] = buildMessages({ repos, feedback: null });
  assert.ok(user.content.includes("(no README)"));
});

test("feedback adds the previous draft and the problems", () => {
  const messages = buildMessages({ repos, feedback: { problems: ["Hook is 300 characters"], previous: sampleDraft } });
  const last = messages.at(-1).content;
  assert.ok(last.includes("Hook is 300 characters"));
  assert.ok(last.includes(sampleDraft.hook));
});

test("parseDraft returns the JSON content", () => {
  const draft = parseDraft({ choices: [{ message: { content: JSON.stringify(sampleDraft) } }] });
  assert.equal(draft.theme, sampleDraft.theme);
});

test("parseDraft throws on refusal", () => {
  assert.throws(() => parseDraft({ choices: [{ message: { refusal: "no" } }] }), /refused/);
});

test("parseDraft throws on empty content", () => {
  assert.throws(() => parseDraft({ choices: [] }), /no content/);
});

test("system prompt carries humanize's worked examples verbatim", () => {
  const [system] = buildMessages({ repos, feedback: null });
  assert.ok(system.content.includes("Move faster. Your competition is."));
  assert.ok(system.content.includes("Vary your rhythm"));
});

test("the OpenAI call has a timeout so a hung request fails with a logged error", async () => {
  const { writeDraft } = await import("../api/_lib/writer.js");
  process.env.OPENAI_API_KEY = "test-key";
  let init;
  globalThis.fetch = async (_url, options) => {
    init = options;
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(sampleDraft) } }] }), { status: 200 });
  };
  await writeDraft({ repos, feedback: null });
  assert.ok(init.signal instanceof AbortSignal);
});

test("system prompt writes for non-technical readers without losing specifics", () => {
  const [system] = buildMessages({ repos, feedback: null });
  for (const rule of [
    "people who don't work in tech",
    "what the project does for a person",
    "explain it in a few everyday words",
    "Keep one concrete detail",
    "Name the theme in everyday words",
    "No commands, file paths, code, or install steps"
  ]) {
    assert.ok(system.content.includes(rule), `missing plain-English rule: ${rule}`);
  }
});
