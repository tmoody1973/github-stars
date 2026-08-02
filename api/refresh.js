import { refreshStars } from "./_lib/refresh.js";

const PUBLIC_REFRESH_MIN_INTERVAL_MS = 60_000;

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (!["GET", "POST"].includes(request.method)) {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ ok: false, error: "Method not allowed." });
  }

  if (request.method === "GET" && !isAuthorizedCron(request)) {
    return response.status(401).json({
      ok: false,
      error: "Cron refresh requires CRON_SECRET bearer authorization."
    });
  }

  const authorizedManual = isAuthorizedManualRefresh(request);
  const isPublicManual = request.method === "POST" && !authorizedManual;

  if (request.method === "POST" && process.env.VERCEL && !authorizedManual && !process.env.ALLOW_PUBLIC_REFRESH) {
    return response.status(501).json({
      ok: false,
      error: "Public refresh is disabled. Set ALLOW_PUBLIC_REFRESH=1, use GITHUB_STARS_REFRESH_TOKEN, or rely on Vercel cron."
    });
  }

  try {
    const result = await refreshStars({
      minIntervalMs: isPublicManual ? PUBLIC_REFRESH_MIN_INTERVAL_MS : 0
    });
    return response.status(200).json({
      ok: true,
      source: request.method === "GET" ? "cron" : authorizedManual ? "manual-authenticated" : "manual-public",
      ...result
    });
  } catch (error) {
    return response.status(500).json({ ok: false, error: error.message });
  }
}

function isAuthorizedManualRefresh(request) {
  const configuredToken = process.env.GITHUB_STARS_REFRESH_TOKEN;
  if (!configuredToken) return !process.env.VERCEL;
  const providedToken = request.headers["x-refresh-token"] || request.query?.token;
  return providedToken === configuredToken;
}

function isAuthorizedCron(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return request.headers.authorization === `Bearer ${cronSecret}`;
}
