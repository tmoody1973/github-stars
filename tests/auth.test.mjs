import test from "node:test";
import assert from "node:assert/strict";
import { isAuthorizedAdmin, isAuthorizedCron } from "../api/_lib/auth.js";

function withEnv(env, fn) {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  try { return fn(); } finally { process.env = saved; }
}

test("cron needs the bearer secret", () => withEnv({ CRON_SECRET: "s3cret" }, () => {
  assert.equal(isAuthorizedCron({ headers: { authorization: "Bearer s3cret" } }), true);
  assert.equal(isAuthorizedCron({ headers: { authorization: "Bearer nope" } }), false);
  assert.equal(isAuthorizedCron({ headers: {} }), false);
}));

test("admin needs the header token on Vercel", () => withEnv({ POSTS_ADMIN_TOKEN: "abc", VERCEL: "1" }, () => {
  assert.equal(isAuthorizedAdmin({ headers: { "x-admin-token": "abc" }, query: {} }), true);
  assert.equal(isAuthorizedAdmin({ headers: { "x-admin-token": "abd" }, query: {} }), false);
  assert.equal(isAuthorizedAdmin({ headers: {}, query: { token: "abc" } }), false);
}));

test("admin is refused on Vercel when no token is configured", () => withEnv({ POSTS_ADMIN_TOKEN: "", VERCEL: "1" }, () => {
  assert.equal(isAuthorizedAdmin({ headers: { "x-admin-token": "" }, query: {} }), false);
}));
