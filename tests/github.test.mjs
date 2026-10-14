import test from "node:test";
import assert from "node:assert/strict";
import { fetchRepoDetails } from "../api/_lib/github.js";

function stubFetch(status, headers = {}) {
  globalThis.fetch = async () => new Response(status === 200 ? "{}" : "", { status, headers });
}

test("a DMCA-blocked repo (451) counts as gone, not as a crash", async () => {
  stubFetch(451);
  assert.equal(await fetchRepoDetails("x/blocked"), null);
});

test("a 403 that is not a rate limit counts as gone", async () => {
  stubFetch(403, { "x-ratelimit-remaining": "4999" });
  assert.equal(await fetchRepoDetails("x/disabled"), null);
});

test("a real rate limit still throws so the run fails loudly", async () => {
  stubFetch(403, { "x-ratelimit-remaining": "0" });
  await assert.rejects(fetchRepoDetails("x/any"), /rate limit|GITHUB_TOKEN/i);
});

test("a secondary rate limit (retry-after) still throws", async () => {
  stubFetch(403, { "x-ratelimit-remaining": "12", "retry-after": "60" });
  await assert.rejects(fetchRepoDetails("x/any"));
});
