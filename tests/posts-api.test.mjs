import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/posts.js";

function fakeResponse() {
  return {
    statusCode: 0, body: null, headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test("rejects a malformed before cursor without touching the database", async () => {
  const response = fakeResponse();
  await handler({ method: "GET", query: { before: "2026-10-15'; DROP" } }, response);
  assert.equal(response.statusCode, 400);
});
