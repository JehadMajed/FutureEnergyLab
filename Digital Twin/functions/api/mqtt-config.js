/* ═══════════════════════════════════════════════════════════════════
   Cloudflare Pages Function — /api/mqtt-config
   Returns MQTT broker configuration from environment secrets.

   This endpoint prevents MQTT credentials from being hardcoded in
   public-facing JavaScript. The browser fetches this at boot and
   uses the returned config to connect to the MQTT broker over WSS.

   Required Secrets (set via Cloudflare Dashboard or wrangler CLI):
     MQTT_TOPIC   — Shared telemetry topic (e.g. dt/lamps/.../telemetry)
     MQTT1_NAME   — Display name for primary broker
     MQTT1_HOST   — Primary broker hostname
     MQTT1_PORT   — Primary broker WebSocket port (e.g. 8884)
     MQTT1_USER   — Primary broker username
     MQTT1_PASS   — Primary broker password

   Optional failover brokers (repeat with MQTT2_* / MQTT3_*):
     MQTT2_HOST, MQTT2_PORT, MQTT2_USER, MQTT2_PASS, MQTT2_NAME
     MQTT3_HOST, MQTT3_PORT, MQTT3_USER, MQTT3_PASS, MQTT3_NAME

   Set them with:
     npx wrangler pages secret put MQTT_TOPIC
     npx wrangler pages secret put MQTT1_HOST
     ... (see docs/deployment.md for the full list)

   Local dev: add all of these to your .dev.vars file (never commit it).
   ═══════════════════════════════════════════════════════════════════ */

export async function onRequest(context) {
  const env = context.env || {};

  const topic = env.MQTT_TOPIC;

  if (!topic) {
    return new Response(
      JSON.stringify({ ok: false, error: "server_misconfigured", brokers: [] }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Build broker array from environment variables.
  // Only add a broker if its HOST secret is present.
  const brokers = [];

  if (env.MQTT1_HOST) {
    brokers.push({
      name:  env.MQTT1_NAME || "Primary Broker",
      host:  env.MQTT1_HOST,
      port:  parseInt(env.MQTT1_PORT || "8884"),
      user:  env.MQTT1_USER || "",
      pass:  env.MQTT1_PASS || "",
      topic,
    });
  }

  if (env.MQTT2_HOST) {
    brokers.push({
      name:  env.MQTT2_NAME || "Secondary Broker",
      host:  env.MQTT2_HOST,
      port:  parseInt(env.MQTT2_PORT || "8084"),
      user:  env.MQTT2_USER || "",
      pass:  env.MQTT2_PASS || "",
      topic,
    });
  }

  if (env.MQTT3_HOST) {
    brokers.push({
      name:  env.MQTT3_NAME || "Tertiary Broker",
      host:  env.MQTT3_HOST,
      port:  parseInt(env.MQTT3_PORT || "8000"),
      user:  env.MQTT3_USER || "",
      pass:  env.MQTT3_PASS || "",
      topic,
    });
  }

  return new Response(JSON.stringify({ ok: true, brokers }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, max-age=300", // 5-min cache, private (contains credentials)
    },
  });
}
