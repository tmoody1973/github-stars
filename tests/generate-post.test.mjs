import test from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../api/generate-post.js";
import { sampleRepos } from "./fixtures/sample-draft.mjs";

function fakeResponse() {
  return {
    statusCode: 0, body: null, headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function deps(overrides = {}) {
  const saved = [];
  return {
    saved,
    hasDatabase: () => true,
    initSchemas: async () => {},
    today: () => "2026-10-15",
    findPostByDate: async () => null,
    pickRepos: async () => ({ seedRepoId: 1, repos: sampleRepos }),
    composePost: async () => ({ ok: true, attempts: 1, draft: { theme: "Open-source GIS", hook: "Hook" }, entries: [], bodyText: "Body", score: 12 }),
    write: async () => ({}),
    savePost: async (post) => { saved.push(post); return 7; },
    writerModel: "test-model",
    now: () => 0,
    ...overrides
  };
}

const admin = (query = {}) => ({ method: "POST", headers: {}, query });

test("publishes and saves a passing post", async () => {
  const d = deps();
  const response = fakeResponse();
  await createHandler(d)(admin(), response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, "published");
  assert.equal(d.saved.length, 1);
  assert.equal(d.saved[0].date, "2026-10-15");
});

test("returns the existing post instead of making a second one", async () => {
  const d = deps({ findPostByDate: async () => ({ id: 3 }) });
  const response = fakeResponse();
  await createHandler(d)(admin(), response);
  assert.equal(response.body.status, "exists");
  assert.equal(d.saved.length, 0);
});

const failed = { ok: false, attempts: 2, problems: ["Sloplint score 40"] };
const passed = { ok: true, attempts: 1, draft: { theme: "Maps", hook: "Hook" }, entries: [], bodyText: "Body", score: 12 };
const groupB = [6, 7, 8, 9, 10].map((id) => ({ id, fullName: `b/${id}` }));

test("a failed group is set aside and a second group publishes", async () => {
  const picks = [];
  const results = [failed, passed];
  const d = deps({
    pickRepos: async (options) => { picks.push(options); return picks.length === 1 ? { seedRepoId: 1, repos: sampleRepos } : { seedRepoId: 6, repos: groupB }; },
    composePost: async () => results.shift()
  });
  const response = fakeResponse();
  await createHandler(d)(admin(), response);
  assert.equal(response.body.status, "published");
  assert.deepEqual(picks[1].excludeIds, [1, 2, 3, 4, 5]);
  assert.equal(d.saved[0].seedRepoId, 6);
});

test("when both groups fail it returns 422 with each group's problems and saves nothing", async () => {
  let picks = 0;
  const d = deps({
    pickRepos: async () => { picks += 1; return picks === 1 ? { seedRepoId: 1, repos: sampleRepos } : { seedRepoId: 6, repos: groupB }; },
    composePost: async () => failed
  });
  const response = fakeResponse();
  await createHandler(d)(admin(), response);
  assert.equal(response.statusCode, 422);
  assert.equal(picks, 2);
  assert.deepEqual(response.body.groups.map((group) => group.repos[0]), ["opengeos/GeoLibre", "b/6"]);
  assert.deepEqual(response.body.groups[1].problems, ["Sloplint score 40"]);
  assert.equal(d.saved.length, 0);
});

test("no second group once 150 seconds have passed", async () => {
  let picks = 0;
  const clock = [0, 151_000];
  const d = deps({
    now: () => clock.shift(),
    pickRepos: async () => { picks += 1; return { seedRepoId: 1, repos: sampleRepos }; },
    composePost: async () => failed
  });
  const response = fakeResponse();
  await createHandler(d)(admin(), response);
  assert.equal(response.statusCode, 422);
  assert.equal(picks, 1);
});

test("dry run returns the post without saving", async () => {
  const d = deps();
  const response = fakeResponse();
  await createHandler(d)(admin({ dryRun: "1" }), response);
  assert.equal(response.body.status, "dry-run");
  assert.equal(d.saved.length, 0);
});

test("GET without the cron secret is refused", async () => {
  const response = fakeResponse();
  await createHandler(deps())({ method: "GET", headers: {}, query: {} }, response);
  assert.equal(response.statusCode, 401);
});
