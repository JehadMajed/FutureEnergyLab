# Deployment Guide

Step-by-step instructions for deploying the Digital Twin to Cloudflare Pages.

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | ≥ 18 | [nodejs.org](https://nodejs.org) |
| npm | ≥ 9 | Bundled with Node.js |
| Cloudflare account | Free tier | [dash.cloudflare.com](https://dash.cloudflare.com) |
| Home Assistant | Any | With a long-lived access token |
| MQTT Broker | Any WSS-capable | HiveMQ Cloud free tier recommended |

---

## Step 1 — Fork and Clone

```bash
git clone https://github.com/YOUR_USERNAME/digital-twin-lamps-panel.git
cd digital-twin-lamps-panel
npm install
```

---

## Step 2 — Create Cloudflare Pages Project

1. Go to **Cloudflare Dashboard → Workers & Pages → Create**
2. Select **"Pages"** → **"Connect to Git"** (or use the CLI below)
3. Name your project (e.g. `digital-twin-lamps-panel`)

Or via CLI:
```bash
npx wrangler pages project create digital-twin-lamps-panel
```

---

## Step 3 — Configure wrangler.toml

The `wrangler.toml` is already configured. Verify the project name matches:

```toml
name = "digital-twin-lamps-panel"
pages_build_output_dir = "./dist"
compatibility_date = "2024-01-01"
```

---

## Step 4 — Set Secrets

**This is the most important step.** All credentials must be set as Cloudflare secrets — never as plaintext environment variables or in source code.

Run each command and paste the secret value when prompted:

```bash
# Home Assistant
npx wrangler pages secret put HA_BASE        # Your HA / Nabu Casa URL
npx wrangler pages secret put HA_TOKEN       # Long-lived access token

# MQTT (required for primary broker)
npx wrangler pages secret put MQTT_TOPIC     # Full MQTT topic string
npx wrangler pages secret put MQTT1_HOST     # Broker hostname
npx wrangler pages secret put MQTT1_PORT     # WSS port (e.g. 8884)
npx wrangler pages secret put MQTT1_USER     # MQTT username
npx wrangler pages secret put MQTT1_PASS     # MQTT password
npx wrangler pages secret put MQTT1_NAME     # Display name (e.g. "HiveMQ Cloud")

# Optional: failover broker
# npx wrangler pages secret put MQTT2_HOST
# npx wrangler pages secret put MQTT2_PORT
# npx wrangler pages secret put MQTT2_USER
# npx wrangler pages secret put MQTT2_PASS
# npx wrangler pages secret put MQTT2_NAME
```

To verify which secrets are set:
```bash
npx wrangler pages secret list
```

---

## Step 5 — Build and Deploy

```bash
# Build the dist/ folder
npm run build

# Deploy to the main production branch
npm run deploy

# Or deploy to a preview branch
npm run deploy:preview
```

---

## Step 6 — Verify

After deployment:

1. Visit your Cloudflare Pages URL (e.g. `https://digital-twin-lamps-panel.pages.dev`)
2. Open browser DevTools → Network tab
3. Check that `/api/mqtt-config` returns `{ ok: true, brokers: [...] }`
4. Check that the status badge in the top-right shows **Online**

---

## Local Development

```bash
# 1. Copy the example secrets file
cp .dev.vars.example .dev.vars

# 2. Edit .dev.vars with your real values (never commit this file)

# 3. Start the local dev server (Wrangler emulates Cloudflare Functions)
npm run dev
# → http://localhost:8788
```

---

## Custom Domain

1. Cloudflare Dashboard → your Pages project → **Custom Domains**
2. Add your domain and follow the DNS setup wizard

---

## Getting a Home Assistant Long-Lived Token

1. In Home Assistant, click your profile icon (bottom-left)
2. Scroll to **Long-Lived Access Tokens**
3. Click **"Create Token"**, name it, and copy the value
4. Paste it as `HA_TOKEN` in the secret setup step

---

## HiveMQ Cloud Free Tier Setup

1. Sign up at [hivemq.com/mqtt-cloud-broker/](https://www.hivemq.com/mqtt-cloud-broker/)
2. Create a free cluster
3. Add credentials (username + password)
4. Note the cluster hostname and the WSS port (usually `8884`)
5. Use these values for `MQTT1_HOST`, `MQTT1_PORT`, `MQTT1_USER`, `MQTT1_PASS`
