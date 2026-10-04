/* ═══════════════════════════════════════════════════════════════════
   TEMPORARY legacy fallback — remove once the secrets are set.

   /api/data, /api/control and /api/mqtt-config fail closed without the
   HA_* / MQTT_* secrets, and the production project has none set yet.
   The last deployment built before that hardening (ee11cd60) still
   serves these endpoints, so while the secrets are missing we forward
   those three paths to it. As soon as the secrets exist, the local
   functions answer and this fallback does nothing.

   To retire it: set the secrets (see wrangler.toml), redeploy, delete
   this file.
   ═══════════════════════════════════════════════════════════════════ */

const LEGACY_ORIGIN = "https://ee11cd60.digital-twin-lamps-panel.pages.dev";

const NEEDS = {
  "/api/data":        ["HA_BASE", "HA_TOKEN"],
  "/api/control":     ["HA_BASE", "HA_TOKEN"],
  "/api/mqtt-config": ["MQTT_TOPIC"],
};

export async function onRequest(context) {
  const { request, env = {} } = context;
  const url = new URL(request.url);
  const needs = NEEDS[url.pathname];

  if (!needs || needs.every((k) => env[k])) return context.next();

  const headers = new Headers(request.headers);
  headers.delete("host");
  const init = { method: request.method, headers };
  if (request.method !== "GET" && request.method !== "HEAD") init.body = await request.arrayBuffer();
  return fetch(LEGACY_ORIGIN + url.pathname + url.search, init);
}
