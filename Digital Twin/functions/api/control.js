/* ── Cloudflare Pages Function — /api/control ──────────────────────
   Proxies button-press commands to Home Assistant.

   Required Secrets (set via Cloudflare Dashboard or wrangler CLI):
     HA_BASE    — Your Home Assistant / Nabu Casa URL
     HA_TOKEN   — Long-lived access token from HA Profile page

   Local dev: add these to your .dev.vars file (never commit that file).

   Example:
     npx wrangler pages secret put HA_BASE
     npx wrangler pages secret put HA_TOKEN
   ─────────────────────────────────────────────────────────────────── */

const BUTTON_MAP = {
  Unlock: "button.lamps_panel_unlock_button",
  Close:  "button.lamps_panel_close_button",
  Open:   "button.lamps_panel_open_button",
};

export async function onRequestPost(context) {
  const env = context.env || {};
  const HA_BASE  = env.HA_BASE;
  const HA_TOKEN = env.HA_TOKEN;

  // Fail closed: refuse to operate if secrets are not configured.
  if (!HA_BASE || !HA_TOKEN) {
    return new Response(
      JSON.stringify({ ok: false, error: "server_misconfigured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const { command } = await context.request.json();
  const entityId = BUTTON_MAP[command];

  if (!entityId) {
    return new Response(
      JSON.stringify({ ok: false, error: "invalid_command" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const res = await fetch(`${HA_BASE}/api/services/button/press`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ entity_id: entityId }),
  });

  if (res.ok) {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(
    JSON.stringify({ ok: false, error: `HA_ERROR_${res.status}` }),
    { status: 500, headers: { "Content-Type": "application/json" } }
  );
}
