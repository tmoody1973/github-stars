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

test("a failed gate returns 422 and saves nothing", async () => {
  const d = deps({ composePost: async () => ({ ok: false, attempts: 2, problems: ["Sloplint score 40"] }) });
  const response = fakeResponse();
  await createHandler(d)(admin(), response);
  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.body.problems, ["Sloplint score 40"]);
  assert.equal(d.saved.length, 0);
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
