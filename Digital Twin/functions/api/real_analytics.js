/* ═══════════════════════════════════════════════════════════════════
   Cloudflare Pages Function — /api/real_analytics
   Monthly field analytics for the overview tab.

     GET /api/real_analytics                → latest published month
     GET /api/real_analytics?month=2026-08  → that month

   Every Tuesday the lab PC publishes one processed JSON per month to the
   private Workers KV namespace bound as ANALYTICS (keys analytics/index.json
   and analytics/<YYYY-MM>.json), via
   tools/analytics-upload/publish_analytics.py. The current month is
   republished each week until it is complete. Nothing is stored in Git and
   no redeploy is needed for new data.

   If KV is unavailable, July 2026 is still served from real_analytics.json
   bundled at build time, so the overview never comes up empty.
   ═══════════════════════════════════════════════════════════════════ */
import legacyJuly from '../../real_analytics.json';

const PREFIX = "analytics/";
const CACHE_TTL = 600;          // seconds, edge cache for KV reads and for browsers
const MONTH_RE = /^\d{4}-\d{2}$/;

function reply(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": status === 200 ? `public, max-age=${CACHE_TTL}` : "no-store",
    },
  });
}

function shape(doc, months, source, updatedAt) {
  return {
    ok: true,
    source,
    updated_at: updatedAt || null,   // last successful upload from the lab PC
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

/* The pre-pipeline July file, in the same shape as a published month. */
function bundledJuly() {
  const byDay = Object.fromEntries(legacyJuly.map(r => [r.day_str, r]));
  const daily = [];
  for (let d = 1; d <= 31; d++) {
    const day = `2026-07-${String(d).padStart(2, "0")}`;
    const r = byDay[day];
    daily.push(r ? {
      day, has_data: true,
      total_readings: r.total_readings, running_readings: r.running_readings,
      run_hours: Math.round(r.run_seconds / 36) / 100,
      zero_hours: Math.round(r.zero_seconds / 36) / 100,
    } : { day, has_data: false, total_readings: 0, running_readings: 0, run_hours: 0, zero_hours: 0 });
  }
  const sum = (k, rows = legacyJuly) => rows.reduce((a, r) => a + r[k], 0);
  const run = sum("run_seconds") / 3600, zero = sum("zero_seconds") / 3600;
  const running = legacyJuly.filter(r => r.running_readings);
  const r1 = x => Math.round(x * 10) / 10;
  return {
    month: "2026-07", complete: true, data_through: "2026-07-31",
    summary: {
      days_in_month: 31, period_days: 31, total_days: legacyJuly.length,
      total_readings: sum("total_readings"),
      total_run_hours: r1(run), total_zero_hours: r1(zero),
      uptime_percentage: r1(run / (run + zero) * 100),
      total_energy_kwh: Math.round(sum("energy_kwh") * 100) / 100,
      // Weighted by running readings: idle days have no PF and must not pull it to zero.
      avg_power_factor: Math.round(running.reduce((a, r) => a + r.avg_power_factor * r.running_readings, 0)
                                   / sum("running_readings", running) * 1000) / 1000,
    },
    daily,
  };
}

export async function onRequest({ request, env = {} }) {
  const want = new URL(request.url).searchParams.get("month");
  if (want && !MONTH_RE.test(want)) return reply({ ok: false, error: "bad_month" }, 400);

  const kv = env.ANALYTICS;
  const read = key => kv.get(PREFIX + key, { type: "json", cacheTtl: CACHE_TTL });

  let index = null;
  try {
    if (kv) index = await read("index.json");
  } catch (err) {
    console.warn("[real_analytics] KV index read failed:", err.message);
  }
  if (!index) {
    if (want && want !== "2026-07") return reply({ ok: false, error: "data_source_unavailable" }, 502);
    return reply(shape(bundledJuly(), ["2026-07"], "bundled"));
  }

  const months = (index.months || []).map(m => m.month).sort();
  const month = want || index.latest || months[months.length - 1];
  if (!months.includes(month)) return reply({ ok: false, error: "unknown_month", months }, 404);

  try {
    const doc = await read(`${month}.json`);
    if (doc) return reply(shape(doc, months, "kv", index.updated_at));
  } catch (err) {
    console.warn(`[real_analytics] KV read of ${month} failed:`, err.message);
  }
  if (month === "2026-07") return reply(shape(bundledJuly(), months, "bundled"));
  return reply({ ok: false, error: "data_source_unavailable" }, 502);
}
