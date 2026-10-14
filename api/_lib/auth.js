import { timingSafeEqual } from "node:crypto";

function sameSecret(provided, expected) {
  if (!provided || !expected) return false;
  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(expected));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isAuthorizedCron(request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && sameSecret(request.headers.authorization, `Bearer ${secret}`);
}

// Local runs (no VERCEL env) with no token configured are allowed, matching /api/refresh.
export function isAuthorizedAdmin(request) {
  const token = process.env.POSTS_ADMIN_TOKEN;
  if (!token) return !process.env.VERCEL;
  return sameSecret(request.headers["x-admin-token"], token);
}
