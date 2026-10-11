/* ═══════════════════════════════════════════════════════════════════
   Cloudflare Pages Function — /api/real_analytics
   Monthly field analytics for the overview tab.

     GET /api/real_analytics                → latest published month
     GET /api/real_analytics?month=2026-08  → that month
     GET /api/real_analytics?month=all      → every published month, combined

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
const ALL = "all";

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
    first_month: doc.first_month,   // month "all" only
    last_month: doc.last_month,
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

/* Every month in one document: daily rows end to end, totals summed, averages
   weighted (power by running hours, PF by running readings). */
function combine(docs) {
  const sums = k => docs.reduce((a, d) => a + (d.summary[k] || 0), 0);
  const running = d => d.daily.reduce((a, r) => a + (r.running_readings || 0), 0);
  const r1 = x => Math.round(x * 10) / 10;
  const run = sums("total_run_hours"), zero = sums("total_zero_hours");
  const pfDocs = docs.filter(d => d.summary.avg_power_factor != null && running(d));
  const pfWeight = pfDocs.reduce((a, d) => a + running(d), 0);
  const powDocs = docs.filter(d => d.summary.avg_running_power != null);
  const powHours = powDocs.reduce((a, d) => a + d.summary.total_run_hours, 0);
  const last = docs[docs.length - 1];
  return {
    month: ALL,
    first_month: docs[0].month,
    last_month: last.month,
    complete: last.complete !== false,
    data_through: last.data_through,
    generated_at: docs.map(d => d.generated_at).filter(Boolean).sort().pop() || null,
    validation: { passed: docs.every(d => !d.validation || d.validation.passed !== false) },
    summary: {
      days_in_month: sums("days_in_month"),
      period_days: sums("period_days") || sums("days_in_month"),
      total_days: sums("total_days"),
      missing_days: docs.flatMap(d => d.summary.missing_days || []),
      total_readings: sums("total_readings"),
      total_run_hours: r1(run),
      total_zero_hours: r1(zero),
      uptime_percentage: run + zero ? r1(run / (run + zero) * 100) : 0,
      total_energy_kwh: Math.round(sums("total_energy_kwh") * 100) / 100,
      avg_running_power: powHours ? r1(powDocs.reduce((a, d) => a + d.summary.avg_running_power * d.summary.total_run_hours, 0) / powHours) : null,
      avg_power_factor: pfWeight ? Math.round(pfDocs.reduce((a, d) => a + d.summary.avg_power_factor * running(d), 0) / pfWeight * 1000) / 1000 : null,
    },
    daily: docs.flatMap(d => d.daily),
  };
}

export async function onRequest({ request, env = {} }) {
  const want = new URL(request.url).searchParams.get("month");
  if (want && want !== ALL && !MONTH_RE.test(want)) return reply({ ok: false, error: "bad_month" }, 400);

  const kv = env.ANALYTICS;
  const read = key => kv.get(PREFIX + key, { type: "json", cacheTtl: CACHE_TTL });

  let index = null;
  try {
    if (kv) index = await read("index.json");
  } catch (err) {
    console.warn("[real_analytics] KV index read failed:", err.message);
  }
  if (!index) {
    if (want && want !== ALL && want !== "2026-07") return reply({ ok: false, error: "data_source_unavailable" }, 502);
    return reply(shape(bundledJuly(), ["2026-07"], "bundled"));
  }

  const months = (index.months || []).map(m => m.month).sort();
  if (want === ALL) {
    const docs = await Promise.all(months.map(async m => {
      try {
        const doc = await read(`${m}.json`);
        if (doc) return doc;
      } catch (err) {
        console.warn(`[real_analytics] KV read of ${m} failed:`, err.message);
      }
      return m === "2026-07" ? bundledJuly() : null;
    }));
    if (!docs.length || docs.includes(null)) return reply({ ok: false, error: "data_source_unavailable" }, 502);
    return reply(shape(combine(docs), months, "kv", index.updated_at));
  }
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
