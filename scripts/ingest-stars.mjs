import { refreshStars } from "../api/_lib/refresh.js";

const result = await refreshStars();
console.log(JSON.stringify({ ok: true, ...result }, null, 2));
