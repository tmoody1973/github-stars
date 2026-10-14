import test from "node:test";
import assert from "node:assert/strict";
import { todayInChicago } from "../api/_lib/dates.js";

test("00:30 UTC belongs to the previous Central day", () => {
  assert.equal(todayInChicago(new Date("2026-10-15T00:30:00Z")), "2026-10-14");
});

test("noon UTC is the same Central day", () => {
  assert.equal(todayInChicago(new Date("2026-12-15T12:00:00Z")), "2026-12-15");
});
