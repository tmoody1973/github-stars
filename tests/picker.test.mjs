import test from "node:test";
import assert from "node:assert/strict";
import { keepActive } from "../api/_lib/picker.js";

const candidates = ["seed", "a", "b", "c", "d", "e", "f"].map((name, index) => ({ id: index + 1, fullName: `x/${name}` }));

function details(map) {
  return async (fullName) => (fullName in map ? map[fullName] : { archived: false, readme: `readme ${fullName}` });
}

test("keeps the seed and the first four active neighbors", async () => {
  const kept = await keepActive(candidates, details({}), 5);
  assert.deepEqual(kept.map((repo) => repo.fullName), ["x/seed", "x/a", "x/b", "x/c", "x/d"]);
  assert.equal(kept[0].readme, "readme x/seed");
});

test("skips archived and deleted neighbors", async () => {
  const kept = await keepActive(candidates, details({ "x/a": { archived: true, readme: "" }, "x/b": null }), 5);
  assert.deepEqual(kept.map((repo) => repo.fullName), ["x/seed", "x/c", "x/d", "x/e", "x/f"]);
});

test("rejects the whole set when the seed is archived", async () => {
  assert.equal(await keepActive(candidates, details({ "x/seed": { archived: true, readme: "" } }), 5), null);
});

test("returns null when too few neighbors survive", async () => {
  const archived = { archived: true, readme: "" };
  const kept = await keepActive(candidates, details({ "x/a": archived, "x/b": archived, "x/c": archived }), 5);
  assert.equal(kept, null);
});

test("skips GitHub entirely when there are too few candidates", async () => {
  let calls = 0;
  const kept = await keepActive(candidates.slice(0, 4), async () => { calls += 1; return { archived: false, readme: "" }; }, 5);
  assert.equal(kept, null);
  assert.equal(calls, 0);
});
