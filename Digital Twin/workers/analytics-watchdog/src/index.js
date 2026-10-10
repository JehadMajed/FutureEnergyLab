/* ═══════════════════════════════════════════════════════════════════
   fel-analytics-watchdog — runs every day at 09:00 Saudi time.

   The lab PC writes analytics/heartbeat.json to KV on every weekly run
   (tools/analytics-upload/publish_analytics.py). This Worker lives in
   Cloudflare, not on the PC, so it still reports when the PC is off,
   broken or disconnected.

   It sends a phone notification through ntfy (secret NTFY_TOPIC) when:
     - the PC has not reported for more than MAX_SILENCE_DAYS,
     - the last run failed,
     - the newest data on the website is older than MAX_DATA_LAG_DAYS.
   It repeats daily until the problem is fixed. On the 1st of each month it
   sends a short "all good" so you know the alert channel itself works.
   Monitoring starts with the first heartbeat, so nothing fires before the
   lab PC is set up.
   ═══════════════════════════════════════════════════════════════════ */

const DAY_MS = 86_400_000;
const MAX_SILENCE_DAYS = 8;     // weekly run + 1 day of slack
const MAX_DATA_LAG_DAYS = 9.5;  // data ends Monday; next run adds a week

export async function evaluate(kv, now) {
  const get = key => kv.get("analytics/" + key, { type: "json" });
  const [beat, index] = await Promise.all([get("heartbeat.json"), get("index.json")]);
  const days = iso => (now - new Date(iso)) / DAY_MS;

  if (!beat) return { armed: false, problems: [], summary: "Waiting for the first run on the lab PC." };

  const problems = [];
  const silent = days(beat.at);
  if (silent > MAX_SILENCE_DAYS) {
    problems.push(`The lab PC has not reported for ${silent.toFixed(1)} days ` +
                  `(last run ${beat.at.slice(0, 16).replace("T", " ")} UTC on ${beat.host}). ` +
                  "Check that it is on, online, and that the scheduled task exists.");
  }
  if (beat.exit_code !== 0) {
    const errs = [beat.error, ...Object.entries(beat.months || {})
      .filter(([, r]) => r.code !== 0).map(([m, r]) => `${m}: ${r.error}`)].filter(Boolean);
    problems.push(`The last run failed (exit ${beat.exit_code}). ${errs.join(" | ") || "See the log"} ` +
                  `(log ${beat.log} on the lab PC).`);
  }

  const months = (index && index.months) || [];
  const latest = months[months.length - 1];
  if (latest && latest.data_through) {
    const lag = days(latest.data_through + "T23:59:59+03:00");
    if (lag > MAX_DATA_LAG_DAYS) {
      problems.push(`The website's newest data ends ${latest.data_through} (${lag.toFixed(0)} days ago).`);
    }
  }

  const summary = `Last run ${beat.at.slice(0, 10)} (exit ${beat.exit_code}); ` +
                  `website data through ${latest ? latest.data_through : "?"}; ` +
                  `${months.length} month(s) published.`;
  return { armed: true, problems, summary };
}

async function notify(env, title, body, priority) {
  if (!env.NTFY_TOPIC) return console.warn("NTFY_TOPIC not set; would send:", title, body);
  const res = await fetch(`https://ntfy.sh/${env.NTFY_TOPIC}`, {
    method: "POST",
    body,
    headers: { Title: title, Priority: priority, Tags: priority === "high" ? "warning" : "white_check_mark" },
  });
  if (!res.ok) throw new Error(`ntfy HTTP ${res.status}`);
}

export async function check(env, now) {
  const r = await evaluate(env.ANALYTICS, now);
  console.log(JSON.stringify(r));
  if (r.problems.length) {
    await notify(env, "Lamp panel analytics: action needed", r.problems.join("\n\n") + "\n\n" + r.summary, "high");
  } else if (r.armed && now.getUTCDate() === 1) {
    await notify(env, "Lamp panel analytics: all good", r.summary, "default");
  }
  return r;
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(check(env, new Date(event.scheduledTime)));
  },
};
