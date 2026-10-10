/* ═══════════════════════════════════════════════════════════════════
   Cloudflare Pages Function — /api/real_analytics
   Monthly field analytics for the overview tab.

     GET /api/real_analytics                → latest published month
     GET /api/real_analytics?month=2026-08  → that month

   Every Tuesday the lab PC publishes one processed JSON per month to
   GitHub (tools/analytics-upload/publish_analytics.py → data/analytics/);
   the current month is republished each week until it is complete. This
   function reads the files from there, so updates appear on the site
   without a redeploy. Responses are edge-cached for 10 minutes.

   If GitHub cannot be reached, July 2026 is still served from the copy
   bundled at build time, so the overview never comes up empty.

   Optional variable ANALYTICS_BASE_URL overrides the data location
   (used for local testing).
   ═══════════════════════════════════════════════════════════════════ */
import july from '../../data/analytics/2026-07.json';

const DEFAULT_BASE =
  "https://raw.githubusercontent.com/JehadMajed/FutureEnergyLab/main/Digital%20Twin/data/analytics";
const CACHE_TTL = 600;
const MONTH_RE = /^\d{4}-\d{2}$/;

async function getJSON(url) {
  const res = await fetch(url, { cf: { cacheTtl: CACHE_TTL, cacheEverything: true } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

function reply(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": status === 200 ? `public, max-age=${CACHE_TTL}` : "no-store",
    },
  });
}

function shape(doc, months, source) {
  return {
    ok: true,
    source,
    month: doc.month,
    months,
    complete: doc.complete !== false,
    data_through: doc.data_through,
    generated_at: doc.generated_at,
    validation: doc.validation,
    summary: doc.summary,
    daily: doc.daily,
  };
}

export async function onRequest({ request, env = {} }) {
  const base = (env.ANALYTICS_BASE_URL || DEFAULT_BASE).replace(/\/+$/, "");
  const want = new URL(request.url).searchParams.get("month");
  if (want && !MONTH_RE.test(want)) return reply({ ok: false, error: "bad_month" }, 400);

  let index;
  try {
    index = await getJSON(`${base}/index.json`);
  } catch (err) {
    console.warn("[real_analytics] index unavailable, serving bundled July:", err.message);
    if (want && want !== july.month) return reply({ ok: false, error: "data_source_unavailable" }, 502);
    return reply(shape(july, [july.month], "bundled"));
  }

  const months = (index.months || []).map(m => m.month).sort();
  const month = want || index.latest || months[months.length - 1];
  if (!months.includes(month)) return reply({ ok: false, error: "unknown_month", months }, 404);

  try {
    return reply(shape(await getJSON(`${base}/${month}.json`), months, "github"));
  } catch (err) {
    console.warn(`[real_analytics] ${month} unavailable:`, err.message);
    if (month === july.month) return reply(shape(july, months, "bundled"));
    return reply({ ok: false, error: "data_source_unavailable" }, 502);
  }
}
