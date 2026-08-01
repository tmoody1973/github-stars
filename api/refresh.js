import { refreshStars } from "./_lib/refresh.js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const configuredToken = process.env.GITHUB_STARS_REFRESH_TOKEN;
  const providedToken = request.headers["x-refresh-token"] || request.query?.token;

  if (configuredToken && providedToken !== configuredToken) {
    return response.status(401).json({ ok: false, error: "Invalid refresh token." });
  }

  if (!configuredToken && process.env.VERCEL) {
    return response.status(501).json({
      ok: false,
      error: "GITHUB_STARS_REFRESH_TOKEN is not configured, so production refresh is disabled."
    });
  }

  try {
    const result = await refreshStars();
    return response.status(200).json({ ok: true, ...result });
  } catch (error) {
    return response.status(500).json({ ok: false, error: error.message });
  }
}
