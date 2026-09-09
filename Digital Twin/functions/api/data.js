/* ═══════════════════════════════════════════════════════════════════
   Cloudflare Pages Function — /api/data
   Fetches live sensor states from Home Assistant via Nabu Casa.

   Required Secrets (set via Cloudflare Dashboard or wrangler CLI):
     HA_BASE    — Your Home Assistant / Nabu Casa URL
     HA_TOKEN   — Long-lived access token from HA Profile page

   Local dev: add these to your .dev.vars file (never commit that file).

   CACHE LAYER: Results are cached for CACHE_TTL seconds using the
   Cloudflare Cache API. This prevents N concurrent users from each
   triggering N×4 simultaneous requests to the HA relay.

   DATA FLOW:
     Browser → CF Worker → [Cache HIT] → return immediately
                         → [Cache MISS] → Nabu Casa → HA → parse → cache → return
   ═══════════════════════════════════════════════════════════════════ */

// Cache TTL in seconds — must be < POLL_MS (5000ms) in script.js
// 4 seconds means at most 1 real request to Nabu Casa every 4s,
// regardless of how many browser tabs are open.
const CACHE_TTL = 4;

// Virtual cache key — must be a valid URL but does NOT need to be reachable
const CACHE_KEY = "https://dt-lamps-cache.internal/api/data/v1";

async function getState(entityId, HA_BASE, TOKEN) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 8000); // 8 second timeout

  try {
    const res = await fetch(`${HA_BASE}/api/states/${entityId}`, {
      headers: { Authorization: TOKEN, "Content-Type": "application/json" },
      signal: controller.signal
    });
    clearTimeout(id);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    clearTimeout(id);
    console.warn(`[HA Fetch Timeout/Error] ${entityId}:`, err.message);
    return null;
  }
}

export async function onRequest(context) {
  const env = context.env || {};
  const HA_BASE  = env.HA_BASE;
  const HA_TOKEN = env.HA_TOKEN;

  // Fail closed: refuse to operate if secrets are not configured.
  if (!HA_BASE || !HA_TOKEN) {
    return new Response(
      JSON.stringify({ ok: false, error: "server_misconfigured", status: "OFFLINE" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const TOKEN = `Bearer ${HA_TOKEN}`;
  const cache = caches.default;
  const cacheKey = new Request(CACHE_KEY);

  // ── 1. Try serving from cache first ──────────────────────────────
  const cached = await cache.match(cacheKey);
  if (cached) {
    return new Response(cached.body, {
      status: cached.status,
      headers: {
        "Content-Type": "application/json",
        "X-Cache": "HIT",
        "Cache-Control": `public, max-age=${CACHE_TTL}`,
      },
    });
  }

  // ── 2. Cache MISS: fetch all entity states in parallel ───────────
  const [current, voltage, power, nb2] = await Promise.all([
    getState("sensor.lamps_panel_current",      HA_BASE, TOKEN),
    getState("sensor.lamps_panel_voltage",      HA_BASE, TOKEN),
    getState("sensor.lamps_panel_active_power", HA_BASE, TOKEN),
    getState("binary_sensor.esp_nb2_status",    HA_BASE, TOKEN),
  ]);

  const data = {
    status:     current || voltage || power ? "ONLINE" : "OFFLINE",
    current:    current ? parseFloat(current.state) : null,
    voltage:    voltage ? parseFloat(voltage.state) : null,
    power:      power   ? parseFloat(power.state)   : null,
    nb2_status: nb2     ? (nb2.state === "on" ? "OPEN" : "CLOSED") : "UNKNOWN",
  };

  // ── 3. Build response and store in cache ─────────────────────────
  const body = JSON.stringify(data);
  const response = new Response(body, {
    headers: {
      "Content-Type": "application/json",
      "X-Cache": "MISS",
      "Cache-Control": `public, max-age=${CACHE_TTL}`,
    },
  });

  // waitUntil: cache write is non-blocking — response is returned immediately
  context.waitUntil(cache.put(cacheKey, response.clone()));

  return response;
}