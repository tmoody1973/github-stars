import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));

test("the daily run gets the full 300 second limit", () => {
  assert.equal(config.functions?.["api/generate-post.js"]?.maxDuration, 300);
});

test("the daily run is scheduled on weekdays at 12:00 UTC", () => {
  assert.ok(config.crons.some((cron) => cron.path === "/api/generate-post" && cron.schedule === "0 12 * * 1-5"));
});
