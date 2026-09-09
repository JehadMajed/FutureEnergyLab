/* ═══════════════════════════════════════════════════════════════════
   NB2 Lamps Panel Digital Twin — script.js
   Modules: Tab Nav · Clock · Live Poller · Charts · Primary 3D Model
            · Independent Sim Model · Physics Engine · Scenario Runner
            · Gauges · Sim Charts · Event Logger · Collapsible Panel
            · Time Scale Bar
   ═══════════════════════════════════════════════════════════════════ */

"use strict";

/* ═══════════════════════════════════════════════════════════════════
   MODULE: CONSTANTS & PHYSICAL MODEL PARAMETERS
   ═══════════════════════════════════════════════════════════════════ */
const API_BASE = window.API_BASE || "";
const POLL_MS = 5000;
const HISTORY_POLL_MS = 10000;
let consecutiveLiveFails = 0;
const MAX_LIVE_FAILS = 10; // Only switch to offline after consecutive failures

/* ═══════════════════════════════════════════════════════════════════
   MODULE: HYBRID CONNECTION MANAGER
   ─────────────────────────────────────────────────────────────────
   PRIMARY  : MQTT over WebSocket (HiveMQ Cloud) → sub-second updates
   FALLBACK : HTTP Polling via Cloudflare Worker  → cached, every 5s

   State machine:
     CONNECTING → (MQTT ok) → MQTT_LIVE
                → (MQTT fail/timeout 8s) → POLLING_FALLBACK
     MQTT_LIVE  → (disconnect) → RECONNECTING (retry every 10s)
                                 POLLING_FALLBACK kicks in immediately
     POLLING_FALLBACK → (MQTT reconnects) → MQTT_LIVE (polling stops)

   NOTE - SETUP REQUIRED (one-time, ~5 min):
     1. Create a free HiveMQ Cloud account at https://www.hivemq.com/mqtt-cloud-broker/
     2. Copy your cluster Host, Username and Password into the three
        constants below (MQTT_HOST, MQTT_USER, MQTT_PASS).
     3. In Home Assistant → Automations, create one automation that
        publishes sensor values to topic  dt/lamps/telemetry
        whenever any of the four sensors change state.
        See the implementation_plan.md for the exact YAML template.
   ═══════════════════════════════════════════════════════════════════ */

// ── Multi-Broker Array ── Loaded dynamically from /api/mqtt-config ──
// Credentials are served from Cloudflare Environment Variables (server-side),
// so they are NOT hardcoded in this source file.
let SECRET_TOPIC = "";

let MQTT_BROKERS = [];

let currentBrokerIdx = 0;
const MQTT_RECONNECT_MS = 10000;   // retry interval when disconnected

// Connection state: "connecting" | "mqtt" | "polling" | "offline"
let connState = "connecting";
let mqttClient = null;
let pollingTimer = null;
let mqttReconnectTimer = null;
let mqttReady = false; // true once first successful MQTT message received

/**
 * Fetch MQTT broker configuration from the server.
 * Returns true if at least one broker was loaded.
 */
async function loadMQTTConfig() {
  try {
    const res = await fetch(API_BASE + "/api/mqtt-config");
    const cfg = await res.json();
    if (cfg.ok && Array.isArray(cfg.brokers) && cfg.brokers.length > 0) {
      MQTT_BROKERS = cfg.brokers;
      SECRET_TOPIC = cfg.brokers[0].topic || "";
      console.info("[CONN] MQTT config loaded:", cfg.brokers.length, "broker(s)");
      return true;
    }
    console.warn("[CONN] MQTT config returned no brokers — using HTTP Polling.");
    return false;
  } catch (e) {
    console.warn("[CONN] Failed to fetch MQTT config:", e.message, "— using HTTP Polling.");
    return false;
  }
}

/* ── Shared UI update ─────────────────────────────────────────────── */
function setConnectionBadge(state) {
  connState = state;
  if (!netText || !netDot) return;
  const activeBroker = MQTT_BROKERS[currentBrokerIdx] ? MQTT_BROKERS[currentBrokerIdx].name : "MQTT";
  const cfg = {
    mqtt:       { label: `Live (${activeBroker})`, dotClass: "dot ok"  },
    polling:    { label: "Online (Polling)", dotClass: "dot ok" },
    connecting: { label: "Connecting…", dotClass: "dot warn" },
    offline:    { label: "Offline",     dotClass: "dot bad"  },
  };
  const c = cfg[state] || cfg.connecting;
  netText.textContent = c.label;
  netDot.className    = c.dotClass;
  if (modelStreamChip) {
    const chip = modelStreamChip.querySelector(".oc-val");
    if (chip) {
      chip.textContent = state === "mqtt"    ? `${activeBroker} Live`
                       : state === "polling" ? "HTTP Polling"
                       : state === "offline" ? "Offline / Standalone"
                       : "Connecting…";
    }
  }
}

let lastValidNb2Status = null;

/* ── Apply received data to the UI (shared by MQTT + HTTP Polling) ── */
function applyLiveData(data, isFromOfflineCache = false) {
  // Save to localStorage for offline fallback
  if (!isFromOfflineCache) {
    try {
      localStorage.setItem("lamps_panel_last_state", JSON.stringify({ data, ts: Date.now() }));
    } catch (e) { console.warn("[CACHE] localStorage save failed:", e); }
  }

  store.live = data;

  const power   = Number(data.power);
  const current = Number(data.current);
  const voltage = Number(data.voltage);
  const status  = normStatus(data.status);
  let nb2 = normStatus(data.nb2_status);
  if (nb2 === "OFF") nb2 = "CLOSED";
  if (nb2 === "ON") nb2 = "OPEN";

  if (nb2 === "OPEN" || nb2 === "CLOSED") {
    lastValidNb2Status = nb2;
  } else if ((nb2 === "UNKNOWN" || !nb2) && lastValidNb2Status) {
    nb2 = lastValidNb2Status; // Retain last valid state to eliminate millisecond flickers
  }

  const isOnline = status === "ONLINE" || status.startsWith("CMD ");
  if (isOnline) {
    consecutiveLiveFails = 0;
    document.querySelectorAll(".cmd-btn[data-cmd]").forEach(b => b.disabled = false);
  } else {
    consecutiveLiveFails++;
    if (consecutiveLiveFails >= MAX_LIVE_FAILS) {
      setOnlineUI(false, "Offline");
      if (controlPill) setPillTone(controlPill, "Control: Offline", "def");
      if (modelLastUpdate) modelLastUpdate.textContent = "Last update: Offline";
      updatePrimaryModel(0);
      return;
    }
  }

  // ── Tab 1 KPIs ──────────────────────────────────────────────────
  if (kpiPower)    kpiPower.textContent    = fmt(power, 1);
  if (kpiCurrent)  kpiCurrent.textContent  = fmt(current, 2);
  if (kpiVoltage)  kpiVoltage.textContent  = fmt(voltage, 1);
  if (kpiPowerSub) kpiPowerSub.textContent = power > 50 ? "Panel Active" : "Panel Idle / Off";

  const liveKwhDay = !isNaN(power) ? power * 24 / 1000 : 0;
  if (kpiDailyKwh)   kpiDailyKwh.textContent   = liveKwhDay.toFixed(1);
  if (kpiMonthlyKwh) kpiMonthlyKwh.textContent = (liveKwhDay * 30).toFixed(1);

  // ── Real-Time Streaming Charts ───────────────────────────────────
  const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  if (!isNaN(power) && power !== null) {
    if (livePowerStream.length === 0) {
      const nowMs = Date.now();
      for (let i = 14; i >= 0; i--) {
        const tStr = new Date(nowMs - i * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
        livePowerStream.push({ t: tStr, val: Number(power.toFixed(1)) });
      }
      updatePowerStreamChart();
    } else if (livePowerStream[livePowerStream.length - 1].t !== nowStr) {
      livePowerStream.push({ t: nowStr, val: Number(power.toFixed(1)) });
      if (livePowerStream.length > MAX_STREAM_POINTS) livePowerStream.shift();
      updatePowerStreamChart();
    }
  }
  if (!isNaN(current) && current !== null) {
    if (liveCurrentStream.length === 0) {
      const nowMs = Date.now();
      for (let i = 14; i >= 0; i--) {
        const tStr = new Date(nowMs - i * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
        liveCurrentStream.push({ t: tStr, val: Number(current.toFixed(2)) });
      }
      updateCurrentStreamChart();
    } else if (liveCurrentStream[liveCurrentStream.length - 1].t !== nowStr) {
      liveCurrentStream.push({ t: nowStr, val: Number(current.toFixed(2)) });
      if (liveCurrentStream.length > MAX_STREAM_POINTS) liveCurrentStream.shift();
      updateCurrentStreamChart();
    }
  }

  // ── Tab 2 Telemetry ─────────────────────────────────────────────
  if (telePower)   telePower.textContent   = fmt(power, 1);
  if (teleCurrent) teleCurrent.textContent = fmt(current, 2);
  if (teleVoltage) teleVoltage.textContent = fmt(voltage, 1);
  if (teleNb2)     teleNb2.textContent     = nb2 || "--";
  if (teleFcast)   teleFcast.textContent   = normStatus(data.forecast_trend || "STABLE");

  // ── Tab 2 Forecasting ────────────────────────────────────────────
  const minP  = (power   * 0.95).toFixed(1), maxP  = (power   * 1.05).toFixed(1);
  const projP = (power   * (1 + 0.015 * Math.sin(Date.now() / 4000))).toFixed(1);
  const minI  = (current * 0.95).toFixed(2), maxI  = (current * 1.05).toFixed(2);
  const projI = (current * (1 + 0.015 * Math.sin(Date.now() / 4000))).toFixed(2);
  const minV  = (voltage * 0.95).toFixed(1), maxV  = (voltage * 1.05).toFixed(1);
  const projV = (voltage * (1 + 0.01  * Math.cos(Date.now() / 5000))).toFixed(1);

  if (fcastPower)       fcastPower.textContent       = projP;
  if (fcastPowerBand)   fcastPowerBand.textContent   = `Range: ${minP} – ${maxP} W`;
  if (fcastCurrent)     fcastCurrent.textContent     = projI;
  if (fcastCurrentBand) fcastCurrentBand.textContent = `Range: ${minI} – ${maxI} A`;
  if (fcastVoltage)     fcastVoltage.textContent     = projV;
  if (fcastVoltageBand) fcastVoltageBand.textContent = `Range: ${minV} – ${maxV} V`;
  if (fcastStatus)      fcastStatus.textContent      = normStatus(data.forecast_trend || "STABLE");

  const now = new Date().toLocaleTimeString("en-GB");
  if (modelLastUpdate) modelLastUpdate.textContent = `Last update: ${now}`;
  if (modelStreamChip) {
    const chip = modelStreamChip.querySelector(".oc-val");
    if (chip && connState === "mqtt")    chip.textContent = `${MQTT_BROKERS[currentBrokerIdx]?.name || "MQTT"} · ${now}`;
    if (chip && connState === "polling") chip.textContent = `Polling · ${now}`;
  }

  // ── Control pill ────────────────────────────────────────────────
  const ctrl = normStatus(data.control ?? "READY");
  setPillTone(controlPill, "Control: " + (ctrl === "READY" ? "Ready" : ctrl), "def");

  // ── 3D Model materials ───────────────────────────────────────────
  updatePrimaryModel(current);
}

/* ── MQTT Channel (Multi-Broker Failover) ─────────────────────────── */
let mqttInitTimer = null;
let mqttWatchdogTimer = null;

function startMQTT() {
  // Guard: If MQTT library failed to load from CDN, fallback gracefully
  if (typeof mqtt === "undefined") {
    console.warn("[CONN] MQTT library not available — falling back to HTTP Polling.");
    startPolling();
    setConnectionBadge("polling");
    return;
  }

  const b = MQTT_BROKERS[currentBrokerIdx];
  if (!b || b.host.startsWith("YOUR_")) {
    console.info("[CONN] No valid MQTT broker configured — using HTTP Polling only.");
    startPolling();
    setConnectionBadge("polling");
    return;
  }

  const url = `wss://${b.host}:${b.port}/mqtt`;
  console.info(`[CONN] Connecting to MQTT Broker #${currentBrokerIdx + 1} (${b.name}):`, url);
  setConnectionBadge("connecting");

  // Clear any existing timers from previous attempts
  clearTimeout(mqttInitTimer);
  clearTimeout(mqttWatchdogTimer);

  mqttClient = mqtt.connect(url, {
    username: b.user,
    password: b.pass,
    clientId: `dt_browser_${Math.random().toString(16).slice(2, 10)}`,
    clean: true,
    reconnectPeriod: 0,       // manual failover handle
    connectTimeout: 8000,     // 8 s connection timeout
    keepalive: 30,
  });

  // ── Connected ───────────────────────────────────────────────────
  mqttClient.on("connect", () => {
    console.info(`[CONN] MQTT connected to ${b.name}. Subscribing to:`, b.topic);
    mqttClient.subscribe(b.topic, { qos: 1 }, (err) => {
      if (err) {
        console.warn(`[CONN] MQTT subscribe error on ${b.name}:`, err);
        handleMQTTFailure();
      }
    });
  });

  // ── Message received ────────────────────────────────────────────
  mqttClient.on("message", (topic, payload) => {
    try {
      const data = JSON.parse(payload.toString());
      if (!mqttReady) {
        // First message: MQTT confirmed working — stop polling fallback
        mqttReady = true;
        stopPolling();
        setConnectionBadge("mqtt");
        clearTimeout(mqttReconnectTimer);
        clearTimeout(mqttInitTimer); // Clear the initial connection timeout
        console.info(`[CONN] Live data received from ${b.name} — HTTP Polling stopped.`);
      }
      
      // Reset watchdog timer on every message
      clearTimeout(mqttWatchdogTimer);
      mqttWatchdogTimer = setTimeout(() => {
        console.warn(`[CONN] MQTT Stale data on ${b.name} (60s silence) — triggering failover.`);
        handleMQTTFailure();
      }, 60000);

      consecutiveLiveFails = 0;
      applyLiveData(data);
    } catch (e) {
      console.warn("[CONN] MQTT payload parse error:", e);
    }
  });

  // ── Error / Close ───────────────────────────────────────────────
  mqttClient.on("error", (err) => {
    console.warn(`[CONN] MQTT error on ${b.name}:`, err.message);
    handleMQTTFailure();
  });

  mqttClient.on("close", () => {
    if (connState === "mqtt" || connState === "connecting") {
      console.warn(`[CONN] MQTT connection closed on ${b.name} — attempting failover.`);
      handleMQTTFailure();
    }
  });

  // ── Fallback safety: if no message within 60s, attempt failover ─
  mqttInitTimer = setTimeout(() => {
    if (!mqttReady) {
      console.warn(`[CONN] MQTT timeout on ${b.name} — no message in 60s.`);
      handleMQTTFailure();
    }
  }, 60000);
}

function handleMQTTFailure() {
  mqttReady = false;
  clearTimeout(mqttInitTimer);
  clearTimeout(mqttWatchdogTimer);

  if (mqttClient) {
    try {
      // Remove listeners so end() doesn't trigger the "close" event and call this again
      mqttClient.removeAllListeners();
      mqttClient.end(true);
    } catch (_) {}
  }
  mqttClient = null;

  // Try next MQTT broker in array
  if (currentBrokerIdx < MQTT_BROKERS.length - 1) {
    currentBrokerIdx++;
    console.info(`[CONN] Switching to backup MQTT Broker #${currentBrokerIdx + 1} (${MQTT_BROKERS[currentBrokerIdx].name})`);
    startMQTT();
  } else {
    // All MQTT brokers failed -> Fall back to HTTP Polling
    currentBrokerIdx = 0; // Reset index for next cycle attempt
    if (connState !== "polling") {
      startPolling();
      setConnectionBadge("polling");
    }
    // Schedule retry of MQTT Broker #1 in 60 seconds
    clearTimeout(mqttReconnectTimer);
    mqttReconnectTimer = setTimeout(() => {
      console.info("[CONN] Retrying primary MQTT Broker #1…");
      mqttReady = false;
      startMQTT();
    }, 60000); // 60 seconds retry
  }
}


/* ── HTTP Polling Channel (Fallback) ────────────────────────────────
   Uses the Cloudflare Worker endpoint which now has a 4-second cache,
   so concurrent users do not amplify load on Nabu Casa.            */
async function pollLive() {
  try {
    const res  = await fetch(API_BASE + "/api/data", { cache: "no-store" });
    const data = await res.json();
    applyLiveData(data);
  } catch (_) {
    consecutiveLiveFails++;
    if (consecutiveLiveFails >= MAX_LIVE_FAILS) {
      setOnlineUI(false, "Disconnected");
      setConnectionBadge("offline");
      if (controlPill) setPillTone(controlPill, "Control: Offline", "def");
      if (modelLastUpdate) modelLastUpdate.textContent = "Last update: Offline";
      updatePrimaryModel(0);
    }
  }
}

function startPolling() {
  if (pollingTimer) return; // already running
  pollLive();               // immediate first poll
  pollingTimer = setInterval(pollLive, POLL_MS);
  console.info("[CONN] HTTP Polling started (every", POLL_MS, "ms).");
}

function stopPolling() {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
    console.info("[CONN] HTTP Polling stopped (MQTT is active).");
  }
}

/* ── setOnlineUI — kept for compatibility with existing code ─────── */
function setOnlineUI(isOnline, label) {
  if (netText) netText.textContent = label;
  if (netDot)  netDot.className = "dot " + (isOnline ? "ok" : "bad");
  document.querySelectorAll(".cmd-btn[data-cmd]").forEach(b => b.disabled = !isOnline);

  if (!isOnline) {
    // ── Fallback Plan 3: Try loading from localStorage ────────────
    let loadedFromCache = false;
    try {
      const cachedString = localStorage.getItem("lamps_panel_last_state");
      if (cachedString) {
        const cacheObj = JSON.parse(cachedString);
        if (cacheObj && cacheObj.data) {
          const cachedTime = new Date(cacheObj.ts).toLocaleTimeString("en-GB");
          console.info("[CACHE] Offline. Restored last state from:", cachedTime);

          // Populate the UI with cached data
          applyLiveData(cacheObj.data, true);

          // Update titles/badges to show cached warning
          if (netText) netText.textContent = `Offline (Cached: ${cachedTime})`;
          if (modelStreamChip) {
            const chip = modelStreamChip.querySelector(".oc-val");
            if (chip) chip.textContent = `Cached state (${cachedTime})`;
          }
          if (kpiPowerSub) kpiPowerSub.textContent = `Offline / Cached [${cachedTime}]`;
          loadedFromCache = true;
        }
      }
    } catch (e) {
      console.warn("[CACHE] Error restoring state from localStorage:", e);
    }

    // Default to dashes if no cache exists
    if (!loadedFromCache) {
      if (kpiPower)   kpiPower.textContent   = "--";
      if (kpiCurrent) kpiCurrent.textContent = "--";
      if (kpiVoltage) kpiVoltage.textContent = "--";
      if (kpiDailyKwh)   kpiDailyKwh.textContent   = "--";
      if (kpiMonthlyKwh) kpiMonthlyKwh.textContent = "--";
      if (kpiPowerSub) kpiPowerSub.textContent = "Offline / Sensor Feed Inactive";

      if (telePower)   telePower.textContent   = "--";
      if (teleCurrent) teleCurrent.textContent = "--";
      if (teleVoltage) teleVoltage.textContent = "--";
      if (teleNb2)     teleNb2.textContent     = "--";
      if (teleFcast)   teleFcast.textContent   = "--";

      if (fcastPower)       fcastPower.textContent       = "--";
      if (fcastPowerBand)   fcastPowerBand.textContent   = "Range: -- W";
      if (fcastCurrent)     fcastCurrent.textContent     = "--";
      if (fcastCurrentBand) fcastCurrentBand.textContent = "Range: -- A";
      if (fcastVoltage)     fcastVoltage.textContent     = "--";
      if (fcastVoltageBand) fcastVoltageBand.textContent = "Range: -- V";
      if (fcastStatus)      fcastStatus.textContent      = "--";
    }
  }
}




/* ── Industrial Indicator Lamp Visual Constants (Web / Mobile Optimized) ── */
/* ── Lamp appearance: balanced, warm, non-clipped ── */
const OFF_COLOR = [0.72, 0.72, 0.69, 1.0];
const OFF_EMISSION = 0.012;

/* ── LED colour, derived from the lamp datasheet rather than picked by eye ──
   Philips Essential LEDbulb 11W E27 230V (order code 929002299709) ships in
   3000 K / 4000 K / 6500 K variants. These are COOL DAYLIGHT (6500 K) lamps,
   so the emitted light is white — not the warm amber this file used to render.

   CCT -> CIE 1931 xy uses the Kim et al. (2002) cubic approximation of the
   Planckian locus (valid 1667-25000 K); xy -> linear sRGB uses the IEC
   61966-2-1 primaries. At 6500 K this lands on ~[1.000, 0.944, 0.993],
   i.e. the D65 white point — which is exactly why these read as white. */
const LED_CCT_K = 4000;   // datasheet CCT variant (3000 | 4000 | 6500) — installed: 4000 K neutral white

function cctToXY(T) {
  const t = 1 / T, t2 = t * t, t3 = t2 * t;
  const x = T < 4000
    ? -0.2661239e9 * t3 - 0.2343589e6 * t2 + 0.8776956e3 * t + 0.179910
    : -3.0258469e9 * t3 + 2.1070379e6 * t2 + 0.2226347e3 * t + 0.240390;
  const x2 = x * x, x3 = x2 * x;
  let y;
  if (T < 2222) y = -1.1063814 * x3 - 1.34811020 * x2 + 2.18555832 * x - 0.20219683;
  else if (T < 4000) y = -0.9549476 * x3 - 1.37418593 * x2 + 2.09137015 * x - 0.16748867;
  else y = 3.0817580 * x3 - 5.87338670 * x2 + 3.75112997 * x - 0.37001483;
  return [x, y];
}

function cctToLinearRGB(T) {
  const [x, y] = cctToXY(T);
  const X = x / y, Y = 1, Z = (1 - x - y) / y;
  const r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  const g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  const b = 0.0557 * X - 0.2040 * Y + 1.0570 * Z;
  const m = Math.max(r, g, b);
  return [r / m, g / m, b / m].map(v => Math.max(0, Math.min(1, v)));
}

const ON_COLOR = [...cctToLinearRGB(LED_CCT_K), 1.0];
const ON_EMISSION = 0.75;

const GLOW_INTENSITY = 0.20;
const TRANSITION_MS = 200;

const AMBIENT_INTENSITY = 0.70;
const EXPOSURE = 0.90;
const HOLDER_COLOR = [0.16, 0.18, 0.20, 1.0];

/** Panel constants shared by Tabs 1–2 and the gauge/chart helpers.
    Reconciled against the field data and the lamp datasheet — the previous
    values here (430 W, 220 V, PF 0.60 "Philips 15W", T_protect 105 °C) were
    inherited assumptions that contradicted both. In particular T_protect made
    the Tj chart draw its shutdown line at 105 °C while the SIM3 engine folds
    back at the datasheet's 95 °C T-case. Full provenance lives in SIM3's P{}. */
const PHYS = {
  P_rated: 402,      // W  — MEASURED mean panel power (was 430, unsupported)
  V_rated: 230,      // V  — MEASURED mean supply (was 220; Saudi grid is 230 V)
  I_midpoint: 2.93,     // A  — MEASURED mean current
  PF: 0.597,    // —  — MEASURED true power factor
  N_lamps: 40,       // —  — 8 columns × 5 rows
  T_amb: 25,       // °C — nominal ambient
  Rth_ja: 5.5,      // °C/W — MODELLED junction-to-ambient
  Rth_bad: 7.8,     // °C/W — MODELLED, poor ventilation
  tau_th: 600,      // s  — MODELLED thermal time constant (~10 min)
  T_protect: 95,       // °C — DATASHEET max T-case (drives foldback)
  eta_rated: 0.363,    // —  — DATASHEET 109 lm/W ÷ ~300 lm/W LER
  eta_coeff: 0.003,    // /°C — efficiency drop per °C above 25 °C
  // Arrhenius ageing
  E_a: 0.70,         // eV — activation energy for InGaN
  A_arrh: 4.8e3,     // pre-exponential factor
  // Voltage-lumen model (IEC 61000-2-2)
  V_min: 220,      // V  — DATASHEET lower end of the rated 220–240 V window
  lum_vexp: 0.6,      // —  — Φ(V) = Φ₀ × (V/230)^0.6
  // SEC tariff
  tariff1: 0.18,     // SAR/kWh tier 1
  tariff2: 0.30,     // SAR/kWh tier 2
  tier1_kwh: 6000,     // kWh/month threshold
};

/* ═══════════════════════════════════════════════════════════════════
   MODULE: TAB NAVIGATION
   ═══════════════════════════════════════════════════════════════════ */
const tabBtns = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");
const tsbBar = document.querySelector(".tsb-bar");

let activeTab = "overview";

function switchTab(id) {
  activeTab = id;
  tabBtns.forEach(b => {
    const on = b.dataset.tab === id;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on);
  });
  tabPanels.forEach(p => {
    p.classList.toggle("active", p.id === `tab-${id}`);
  });

  // Show / hide fixed time-scale bar
  if (tsbBar) tsbBar.classList.toggle("visible", id === "simulation");

  // Lazy-render charts when tab becomes visible
  if (id === "overview") {
    setTimeout(renderHistoryCharts, 80);
  }
  if (id === "simulation") {
    setTimeout(() => { resizeSimCharts(); }, 80);
  }
}

tabBtns.forEach(b => b.addEventListener("click", () => switchTab(b.dataset.tab)));

/* ═══════════════════════════════════════════════════════════════════
   MODULE: LIVE CLOCK
   ═══════════════════════════════════════════════════════════════════ */
const clockEl = document.getElementById("clock-badge");
function tickClock() {
  if (clockEl) clockEl.textContent = new Date().toLocaleTimeString("en-GB");
}
tickClock();
setInterval(tickClock, 1000);

/* ═══════════════════════════════════════════════════════════════════
   MODULE: SHARED DATA STORE
   ═══════════════════════════════════════════════════════════════════ */
const store = {
  live: { status: "CONNECTING", power: null, current: null, voltage: null, nb2_status: "UNKNOWN", control: "READY", forecast_power: null, forecast_trend: "STABLE", forecast_text: "" },
  hist: { power_24h: [], power_30d: [], cost_sar: 0, total_kwh_month: 0, daily_cost_sar: 0, daily_kwh: 0 },
};

/* ═══════════════════════════════════════════════════════════════════
   MODULE: HELPERS
   ═══════════════════════════════════════════════════════════════════ */
function fmt(v, d = 1) {
  return (typeof v === "number" && !Number.isNaN(v)) ? v.toFixed(d) : "--";
}
function normStatus(x) {
  return (x ?? "").toString().trim().toUpperCase();
}
function setPillTone(el, text, tone) {
  if (!el) return;
  el.textContent = text;
  const tones = {
    ok: { bg: "var(--success-soft)", color: "var(--success)", border: "var(--success)" },
    warn: { bg: "var(--warning-soft)", color: "var(--warning)", border: "var(--warning)" },
    bad: { bg: "var(--danger-soft)", color: "var(--danger)", border: "var(--danger)" },
    info: { bg: "var(--info-soft)", color: "var(--info)", border: "var(--info)" },
    def: { bg: "var(--primary-soft)", color: "var(--primary)", border: "var(--primary)" },
  };
  const t = tones[tone] || tones.def;
  el.style.background = t.bg;
  el.style.color = t.color;
  el.style.borderColor = t.border;
}

/* ═══════════════════════════════════════════════════════════════════
   MODULE: LIVE DATA POLLER
   ═══════════════════════════════════════════════════════════════════ */
const netDot = document.getElementById("net-dot");
const netText = document.getElementById("net-text");
const controlPill = document.getElementById("control-pill");

// KPI elements (Tab 1)
const kpiPower = document.getElementById("kpi-power");
const kpiPowerSub = document.getElementById("kpi-power-sub");
const kpiCurrent = document.getElementById("kpi-current");
const kpiVoltage = document.getElementById("kpi-voltage");
const kpiDailyKwh = document.getElementById("kpi-daily-kwh");
const kpiMonthlyKwh = document.getElementById("kpi-monthly-kwh");

// Telemetry (Tab 2)
const telePower = document.getElementById("tele-power");
const teleCurrent = document.getElementById("tele-current");
const teleVoltage = document.getElementById("tele-voltage");
const teleNb2 = document.getElementById("tele-nb2");
const teleFcast = document.getElementById("tele-forecast");
const modelStreamChip = document.getElementById("model-stream-chip");
const modelLastUpdate = document.getElementById("model-last-update");

// Forecasting Row (Tab 2)
const fcastPower = document.getElementById("fcast-power");
const fcastPowerBand = document.getElementById("fcast-power-band");
const fcastCurrent = document.getElementById("fcast-current");
const fcastCurrentBand = document.getElementById("fcast-current-band");
const fcastVoltage = document.getElementById("fcast-voltage");
const fcastVoltageBand = document.getElementById("fcast-voltage-band");
const fcastStatus = document.getElementById("fcast-status");

// (pollLive and setOnlineUI are now defined in the Hybrid Connection Manager above)



/* ═══════════════════════════════════════════════════════════════════
   MODULE: HISTORY DATA POLLER (for charts)
   ═══════════════════════════════════════════════════════════════════ */
async function pollHistory() {
  try {
    const res = await fetch(API_BASE + "/api/history", { cache: "no-store" });
    const data = await res.json();
    store.hist = data;
    renderHistoryCharts();
  } catch (e) {
    console.warn("[HISTORY] Fetch error:", e);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   MODULE: TAB 1 — CHART.JS CHARTS
   ═══════════════════════════════════════════════════════════════════ */
let chart24h = null;
let chart30d = null;

const livePowerStream = [];
const liveCurrentStream = [];
const MAX_STREAM_POINTS = 60;

const CHART_FONT = "'Inter', system-ui, sans-serif";
const CHART_COLOR_POWER = "#006C6B";
const CHART_COLOR_ENERGY = "#1D5F9C";

Chart.defaults.font.family = CHART_FONT;
Chart.defaults.color = "#64748B";

function makeGradient(ctx, color1, color2) {
  const g = ctx.createLinearGradient(0, 0, 0, 200);
  g.addColorStop(0, color1);
  g.addColorStop(1, color2);
  return g;
}

function buildChart24h(canvas) {
  const ctx = canvas.getContext("2d");
  chart24h = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label: "Power (W)",
        data: [],
        borderColor: CHART_COLOR_POWER,
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 5,
        tension: 0.3,
        fill: true,
        backgroundColor: makeGradient(ctx, "rgba(0,108,107,0.18)", "rgba(0,108,107,0.01)"),
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500 },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#FFFFFF",
          titleColor: "#0F172A", bodyColor: "#18212B",
          borderColor: "#BAC5D0", borderWidth: 1,
          padding: 10,
          callbacks: { label: c => ` ${Number(c.parsed.y || 0).toFixed(1)} W` }
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(217, 224, 231, 0.6)" },
          ticks: { maxTicksLimit: 8, font: { size: 11 }, color: "#64748B" },
        },
        y: {
          min: 0,
          suggestedMax: 500,
          grid: { color: "rgba(217, 224, 231, 0.6)" },
          ticks: { font: { size: 11 }, color: "#64748B", callback: v => v + " W" },
        },
      },
    },
  });
}

function buildChart30d(canvas) {
  const ctx = canvas.getContext("2d");
  chart30d = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label: "Current (A)",
        data: [],
        borderColor: "#1D5F9C",
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 5,
        tension: 0.3,
        fill: true,
        backgroundColor: makeGradient(ctx, "rgba(29,95,156,0.18)", "rgba(29,95,156,0.01)"),
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#FFFFFF",
          titleColor: "#0F172A", bodyColor: "#18212B",
          borderColor: "#BAC5D0", borderWidth: 1, padding: 10,
          callbacks: { label: c => ` ${Number(c.parsed.y || 0).toFixed(2)} A` }
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(217, 224, 231, 0.6)" },
          ticks: { font: { size: 11 }, color: "#64748B", maxTicksLimit: 8 },
        },
        y: {
          min: 0,
          suggestedMax: 5,
          grid: { color: "rgba(217, 224, 231, 0.6)" },
          ticks: { font: { size: 11 }, color: "#64748B", callback: v => v + " A" },
        },
      },
    },
  });
}

function updatePowerStreamChart() {
  if (!chart24h) {
    const c = document.getElementById("chart-24h");
    if (c) buildChart24h(c);
    else return;
  }
  chart24h.data.labels = livePowerStream.map(p => p.t);
  chart24h.data.datasets[0].data = livePowerStream.map(p => p.val);
  chart24h.update("none");
  const footer = document.getElementById("chart-24h-footer");
  if (footer) footer.textContent = `Live real-time stream (1-second update) | Latest: ${livePowerStream.length ? livePowerStream[livePowerStream.length - 1].val + " W" : "0 W"}`;
}

function updateCurrentStreamChart() {
  if (!chart30d) {
    const c = document.getElementById("chart-30d");
    if (c) buildChart30d(c);
    else return;
  }
  chart30d.data.labels = liveCurrentStream.map(p => p.t);
  chart30d.data.datasets[0].data = liveCurrentStream.map(p => p.val);
  chart30d.update("none");
  const footer = document.getElementById("chart-30d-footer");
  if (footer) footer.textContent = `Live real-time stream (1-second update) | Latest: ${liveCurrentStream.length ? liveCurrentStream[liveCurrentStream.length - 1].val + " A" : "0 A"}`;
}

function update24hChart() { updatePowerStreamChart(); }
function update30dChart() { updateCurrentStreamChart(); }

function renderHistoryCharts() {
  const c24 = document.getElementById("chart-24h");
  const c30 = document.getElementById("chart-30d");
  if (c24 && !chart24h) buildChart24h(c24);
  if (c30 && !chart30d) buildChart30d(c30);
  updatePowerStreamChart();
  updateCurrentStreamChart();
}

/* ═══════════════════════════════════════════════════════════════════
   MODULE: TAB 2 — PRIMARY 3D MODEL (live material updates)
   ═══════════════════════════════════════════════════════════════════ */
const mainModel = document.getElementById("main-model");
const THRESH_AMPS = 0.5;

/* ── Universal Indicator Lamp Control Engine (Per-Bulb Switching & Smooth Animation) ── */
const activeTransitions = new Map();
const lampStateRegistry = new Map();

/* Memoised per-viewer, because the simulation re-drives all 40 lamps every
   animation frame; a linear find() over 42 materials each time is ~1,700
   string compares per frame. The cache is keyed on the model object so it
   invalidates automatically when a different GLB loads. */
const _bulbMatCache = new WeakMap();

function getBulbMaterial(viewer, lampNumber) {
  if (!viewer || !viewer.model || !viewer.model.materials) return null;
  let byLamp = _bulbMatCache.get(viewer.model);
  if (!byLamp) {
    byLamp = new Map();
    for (const m of viewer.model.materials) {
      const hit = /^MAT_LAMP_(\d+)_BULB$/.exec((m.name || "").toUpperCase());
      if (hit) byLamp.set(Number(hit[1]), m);
    }
    _bulbMatCache.set(viewer.model, byLamp);
  }
  return byLamp.get(Number(lampNumber)) || null;
}

/** How many addressable bulbs the loaded model actually has. */
function getBulbCount(viewer) {
  if (!viewer || !viewer.model) return 0;
  getBulbMaterial(viewer, 1);
  const byLamp = _bulbMatCache.get(viewer.model);
  return byLamp ? byLamp.size : 0;
}

function getTargetColors(isOn, intensityRatio = 1.0, tempRatio = 0.0, isBurned = false) {
  if (isBurned) {
    return {
      base: [0.05, 0.05, 0.05, 1.0],
      emis: [0, 0, 0]
    };
  }
  if (!isOn || intensityRatio <= 0.02) {
    return {
      base: [...OFF_COLOR],
      emis: [OFF_COLOR[0] * OFF_EMISSION, OFF_COLOR[1] * OFF_EMISSION, OFF_COLOR[2] * OFF_EMISSION]
    };
  }

  /* A hot white LED does NOT turn orange. Two real effects dominate, in order:
       1. Flux droop  — luminous output falls with junction temperature,
                        ~-0.35 %/degC for InGaN white LEDs. This is what the eye
                        actually sees: the lamp gets DIMMER, not amber.
       2. CCT shift   — phosphor conversion efficiency drops slightly faster
                        than the blue die, giving a small warming. It is a few
                        hundred K at most, so it stays subtle here.
     The previous code lerped all the way to [1.0, 0.4, 0.0] (~2500 K), which
     turned 6500 K daylight lamps amber long before anything physical would. */
  const DROOP_PER_C = 0.0035;              // fraction of flux lost per degC
  const TJ_SPAN_C = 80;                    // tempRatio 0..1 maps to +0..80 degC
  const droop = Math.max(0.25, 1 - DROOP_PER_C * TJ_SPAN_C * tempRatio);

  const hotCCT = LED_CCT_K - 400 * tempRatio;   // subtle, physically-sized shift
  const [hR, hG, hB] = cctToLinearRGB(hotCCT);

  const lit = ON_EMISSION * intensityRatio * droop;
  return {
    base: [hR, hG, hB, 1.0],
    emis: [hR * lit, hG * lit, hB * lit]
  };
}

function animateMaterialColor(viewer, lampNumber, fromState, toState, durationMs = TRANSITION_MS) {
  const mat = getBulbMaterial(viewer, lampNumber);
  if (!mat || !mat.pbrMetallicRoughness) return;

  const key = `${viewer.id || 'viewer'}_${lampNumber}`;
  if (activeTransitions.has(key)) {
    cancelAnimationFrame(activeTransitions.get(key));
    activeTransitions.delete(key);
  }

  const startBase = fromState.base;
  const endBase = toState.base;
  const startEmis = fromState.emis;
  const endEmis = toState.emis;
  const startTime = performance.now();

  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(1.0, elapsed / durationMs);
    // Cubic ease-in-out curve for smooth industrial driver ramp
    const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    const currBase = startBase.map((s, idx) => s + (endBase[idx] - s) * ease);
    const currEmis = startEmis.map((s, idx) => s + (endEmis[idx] - s) * ease);

    try {
      mat.pbrMetallicRoughness.setBaseColorFactor(currBase);
      if (mat.setEmissiveFactor) mat.setEmissiveFactor(currEmis);
    } catch (_) { }

    if (progress < 1.0) {
      activeTransitions.set(key, requestAnimationFrame(step));
    } else {
      activeTransitions.delete(key);
    }
  }

  activeTransitions.set(key, requestAnimationFrame(step));
}

function setLampState(lampNumber, isOn, viewer = mainModel, animate = true, intensityRatio = 1.0, tempRatio = 0.0, isBurned = false) {
  if (!viewer || !viewer.model) return;
  const num = Number(lampNumber);
  const mat = getBulbMaterial(viewer, num);
  if (!mat || !mat.pbrMetallicRoughness) return;

  const key = `${viewer.id || 'viewer'}_${num}`;
  const currStateIsOn = lampStateRegistry.get(key) ?? false;

  const fromColors = getTargetColors(currStateIsOn, 1.0, 0.0);
  const toColors = getTargetColors(isOn, intensityRatio, tempRatio, isBurned);
  lampStateRegistry.set(key, isOn);

  if (animate && currStateIsOn !== isOn) {
    animateMaterialColor(viewer, num, fromColors, toColors, TRANSITION_MS);
  } else {
    mat.pbrMetallicRoughness.setBaseColorFactor(toColors.base);
    if (mat.setEmissiveFactor) mat.setEmissiveFactor(toColors.emis);
  }
}

function setAllLampsOff(viewer = mainModel, animate = true) {
  for (let i = 1; i <= 40; i++) {
    setLampState(i, false, viewer, animate);
  }
}

function setAllLampsOn(viewer = mainModel, animate = true, intensityRatio = 1.0) {
  for (let i = 1; i <= 40; i++) {
    setLampState(i, true, viewer, animate, intensityRatio);
  }
}

// Expose public control functions on window for direct debugging and scripting
window.setLampState = setLampState;
window.setAllLampsOff = setAllLampsOff;
window.setAllLampsOn = setAllLampsOn;

function initViewerLamps(viewer) {
  if (!viewer || !viewer.model || !viewer.model.materials) return;
  viewer.setAttribute("exposure", String(EXPOSURE));

  viewer.model.materials.forEach(mat => {
    const name = (mat.name || "").toUpperCase();
    if (name.includes("BULB")) {
      // Enforce frosted glass dielectric roughness to prevent side-view vertical white reflection strip
      if (mat.pbrMetallicRoughness) {
        mat.pbrMetallicRoughness.setRoughnessFactor(0.55);
        mat.pbrMetallicRoughness.setMetallicFactor(0.0);
      }
    } else {
      // Guaranteed constraint: Holders, panel, frame, and legs must never emit light
      if (mat.setEmissiveFactor) {
        mat.setEmissiveFactor([0, 0, 0]);
      }
      // Apply industrial grey contrast color specifically to lamp holders
      if (name.includes("HOLDER") && mat.pbrMetallicRoughness) {
        mat.pbrMetallicRoughness.setBaseColorFactor(HOLDER_COLOR);
      }
    }
  });

  setAllLampsOff(viewer, false);
}

if (mainModel) {
  mainModel.addEventListener("load", () => {
    initViewerLamps(mainModel);
    updatePrimaryModel(Number(store.live.current || 0));
  });
  if (mainModel.model) initViewerLamps(mainModel);
}

function updatePrimaryModel(current) {
  if (!mainModel || !mainModel.model) return;
  const isPowered = current > THRESH_AMPS;
  if (isPowered) {
    setAllLampsOn(mainModel, true, 1.0);
  } else {
    setAllLampsOff(mainModel, true);
  }
}

// ── Independent Simulation Controls & DOM Elements ──

/* The Tab 3 viewer is initialised by the SIM3 module. The handler that used to
   live here called `sim2State`, an identifier that is not defined anywhere in
   this file; it stayed dormant only because #sim-model did not exist, so
   `simModel` was null and the listener was never attached. Now that Tab 3 has
   a real <model-viewer>, it would throw on every model load. */

/* ── Tab 3 interactive controls are owned by the SIM3 module at the bottom of
      this file. The legacy bindings that used to live here (power toggle, watt
      slider, ambient slider) were removed: they bound to the SAME elements as
      SIM3, so every click ran two engines and the watt slider let you "inject
      watts", which no real panel can do. Power is now an OUTPUT.
      The Watt slider itself no longer exists in the markup. ── */





/* ═══════════════════════════════════════════════════════════════════
   MODULE: PHYSICS FUNCTIONS
   ═══════════════════════════════════════════════════════════════════ */

/** LED wall-plug efficiency as function of junction temperature */
function computeEta(T_j) {
  return Math.max(0.50, PHYS.eta_rated - PHYS.eta_coeff * (T_j - 25));
}

/** First-order thermal RC model — junction temp rise */
function thermalStep(T_j, P_lamp, Rth, dt_sim, T_amb = PHYS.T_amb) {
  const eta = computeEta(T_j);
  const P_heat = P_lamp * (1 - eta); // Only inefficiency turns to heat
  const T_ss = T_amb + P_heat * Rth;
  const dT = (T_ss - T_j) / PHYS.tau_th * dt_sim;
  return Math.min(T_j + dT, PHYS.T_protect + 5);
}

/** Lumen maintenance (Arrhenius exponential model for Philips LED) */
function computeLumenMaint(T_j, t_hours) {
  const T_k = T_j + 273.15; // Kelvin
  const k_B = 8.617e-5;     // Boltzmann constant (eV/K)
  const k = PHYS.A_arrh * Math.exp(-PHYS.E_a / (k_B * T_k));
  return Math.max(0, Math.exp(-k * t_hours) * 100);
}

/** Voltage sag effect on lumen output (IEC 61000-2-2) */
function voltageLumenFactor(V) {
  return Math.pow(Math.max(0, V) / PHYS.V_rated, PHYS.lum_vexp);
}

/** Analytical Time-Jump Engine for Extreme Scenarios */



let simEngine = {
  running: true,
  paused: false,
  scenario: null,
  powerOn: false,
  targetPower: 430,
  targetVoltage: 220,
  activeLamps: 40,
  bad_vent: false,
  anomaly: false,
  t_sim: 0,
  T_j: PHYS.T_amb,
  lumen_pct: 100,
  eta_pct: PHYS.eta_rated * 100,
  V_sim: PHYS.V_rated,
  P_sim: 0,
  timeScale: 1,
  lastRAF: null,
  prevNow: null,
  hist_t: [],
  hist_Tj: [],
  hist_P: [],
  hist_V: [],
  maxPoints: 200,
  shutdown: false,
  histData: [],
};





/* Run / Pause / Reset are bound by the SIM3 module instead. Binding them here
   too meant one click started BOTH engines: SIM3 aged the lamps while the
   legacy loop independently drove the gauges, and simRun() logged a spurious
   "No scenario selected" on every press. SIM3 now drives the gauges and charts
   directly, so simTick() is never started and the legacy state is inert. */



/* ═══════════════════════════════════════════════════════════════════
   MODULE: TAB 3 — GAUGE UPDATER
   ═══════════════════════════════════════════════════════════════════ */
const GAUGE_ARC_LEN = 173; // half-circle circumference for r=55

function setGauge(arcId, statusId, value, min, max, statusText, alertLevel) {
  const arc = document.getElementById(arcId);
  const status = document.getElementById(statusId);
  if (!arc) return;
  const pct = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const dash = (pct * GAUGE_ARC_LEN).toFixed(1);
  arc.setAttribute("stroke-dasharray", `${dash} ${GAUGE_ARC_LEN}`);
  if (status) {
    status.textContent = statusText;
    status.style.color = alertLevel === "ok" ? "var(--success)"
      : alertLevel === "warn" ? "var(--warning)"
        : alertLevel === "bad" ? "var(--danger)"
          : alertLevel === "crit" ? "var(--danger)"
            : "var(--text-muted)";
  }
}

function updateGauges({ T_j, P, V, eta, lumen }) {
  // Temperature gauge (0 – 110 °C)
  const tStatus = T_j < 60 ? ["Nominal", "ok"]
    : T_j < 85 ? ["Elevated", "warn"]
      : T_j < PHYS.T_protect ? ["Warning", "bad"]
        : ["SHUTDOWN", "crit"];
  const tEl = document.getElementById("g-temp-val");
  if (tEl) tEl.textContent = T_j.toFixed(1);
  setGauge("g-temp-arc", "g-temp-status", T_j, 25, 110, tStatus[0], tStatus[1]);

  // Power gauge (0 – 650 W)
  const pEl = document.getElementById("g-power-val");
  if (pEl) pEl.textContent = P.toFixed(0);
  const pStatus = P === 0 ? ["Offline", "def"]
    : P < 450 ? ["Normal", "ok"]
      : P < 550 ? ["High", "warn"]
        : ["Overload", "bad"];
  setGauge("g-power-arc", "g-power-status", P, 0, 650, pStatus[0], pStatus[1]);

  // Voltage gauge (150 – 250 V)
  const vEl = document.getElementById("g-voltage-val");
  if (vEl) vEl.textContent = V.toFixed(0);
  const vStatus = V >= PHYS.V_min ? ["Nominal", "ok"] : V >= 170 ? ["Sag", "warn"] : ["Critical", "bad"];
  setGauge("g-voltage-arc", "g-voltage-status", V, 150, 250, vStatus[0], vStatus[1]);


}

function formatSimTime(t_sim, short = false) {
  const totalH = Math.floor(t_sim / 3600);
  if (totalH > 24) {
    const days = Math.floor(totalH / 24);
    const hours = totalH % 24;
    return short ? `${days}d` : `${days}d ${hours}h`;
  }
  const h = totalH;
  const m = Math.floor((t_sim % 3600) / 60);
  const s = Math.floor(t_sim % 60);
  if (short) return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

function updateSimTimeBadge(t_sim) {
  const el = document.getElementById("sim-time-badge");
  if (!el) return;
  el.textContent = `t = ${formatSimTime(t_sim)}`;
}

/* ═══════════════════════════════════════════════════════════════════
   MODULE: TAB 3 — SIMULATION CHARTS (temp + lumen over time)
   ═══════════════════════════════════════════════════════════════════ */
let chartTemp = null;
let chartPowerVolt = null;

function buildChartTemp(canvas) {
  const ctx = canvas.getContext("2d");
  chartTemp = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Tj (C)",
          data: [],
          borderColor: "#A65B00",
          borderWidth: 2.5,
          pointRadius: 0,
          tension: 0.4,
          fill: true,
          backgroundColor: "rgba(166,91,0,0.12)",
        },
        {
          label: `T-case limit (${PHYS.T_protect} C)`,
          data: [],
          borderColor: "rgba(180,35,24,0.60)",
          borderWidth: 1.5,
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false,
          tension: 0,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 0 },
      plugins: {
        legend: { display: true, labels: { boxWidth: 12, font: { size: 11 }, color: "#64748B" } },
        tooltip: {
          backgroundColor: "#FFFFFF", titleColor: "#0F172A", bodyColor: "#18212B", borderColor: "#BAC5D0", borderWidth: 1, padding: 8,
          callbacks: {
            title: c => {
              const t = Number(c[0].label || 0);
              return `t = ${formatSimTime(t)}`;
            },
            label: c => ` ${c.dataset.label}: ${Number(c.parsed.y || 0).toFixed(1)} °C`
          }
        },
      },
      scales: {
        x: {
          title: { display: true, text: "Sim Time", font: { size: 11 }, color: "#64748B" },
          grid: { color: "rgba(217, 224, 231, 0.6)" },
          ticks: {
            maxTicksLimit: 6, font: { size: 10 }, color: "#64748B",
            callback: function (value) {
              const t = Number(this.getLabelForValue(value));
              const h = Math.floor(t / 3600);
              const m = Math.floor((t % 3600) / 60);
              const s = Math.floor(t % 60);
              if (h > 0) return `${h}h ${m}m`;
              if (m > 0) return `${m}m`;
              return `${s}s`;
            }
          }
        },
        y: { min: 20, max: 115, title: { display: true, text: "C", font: { size: 11, color: "#64748B" } }, grid: { color: "rgba(217, 224, 231, 0.6)" }, ticks: { font: { size: 11 }, color: "#64748B" } },
      },
    },
  });
}

function buildChartPowerVolt(canvas) {
  const ctx = canvas.getContext("2d");
  chartPowerVolt = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Active Power (W)",
          data: [],
          borderColor: "#006C6B",
          borderWidth: 2.5,
          pointRadius: 0,
          tension: 0.4,
          fill: true,
          backgroundColor: "rgba(0,108,107,0.12)",
          yAxisID: 'y',
        },
        {
          label: "Voltage (V)",
          data: [],
          borderColor: "#3B82F6",
          borderWidth: 1.5,
          borderDash: [4, 4],
          pointRadius: 0,
          fill: false,
          tension: 0,
          yAxisID: 'y1',
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 0 },
      plugins: {
        legend: { display: true, labels: { boxWidth: 12, font: { size: 11 }, color: "#64748B" } },
        tooltip: {
          backgroundColor: "#FFFFFF", titleColor: "#0F172A", bodyColor: "#18212B", borderColor: "#BAC5D0", borderWidth: 1, padding: 8,
          callbacks: {
            title: c => {
              const t = Number(c[0].label || 0);
              const h = Math.floor(t / 3600);
              const m = Math.floor((t % 3600) / 60);
              const s = Math.floor(t % 60);
              return `t = ${h}h ${m}m ${s}s`;
            },
            label: c => ` ${c.dataset.label}: ${Number(c.parsed.y || 0).toFixed(1)}`
          }
        },
      },
      scales: {
        x: {
          title: { display: true, text: "Sim Time", font: { size: 11 }, color: "#64748B" },
          grid: { color: "rgba(217, 224, 231, 0.6)" },
          ticks: {
            maxTicksLimit: 6, font: { size: 10 }, color: "#64748B",
            callback: function (value) {
              const t = Number(this.getLabelForValue(value));
              const h = Math.floor(t / 3600);
              const m = Math.floor((t % 3600) / 60);
              const s = Math.floor(t % 60);
              if (h > 0) return `${h}h ${m}m`;
              if (m > 0) return `${m}m`;
              return `${s}s`;
            }
          }
        },
        y: {
          type: 'linear', display: true, position: 'left', min: 0, max: 650,
          title: { display: true, text: "Power (W)", font: { size: 11, color: "#006C6B" } },
          grid: { color: "rgba(217, 224, 231, 0.6)" }, ticks: { font: { size: 11 }, color: "#006C6B" }
        },
        y1: {
          type: 'linear', display: true, position: 'right', min: 150, max: 350,
          title: { display: true, text: "Voltage (V)", font: { size: 11, color: "#3B82F6" } },
          grid: { drawOnChartArea: false }, ticks: { font: { size: 11 }, color: "#3B82F6" }
        },
      },
    },
  });
}

function initSimCharts() {
  const cTemp = document.getElementById("chart-temp");
  const cPowerVolt = document.getElementById("chart-power-volt");
  if (cTemp && !chartTemp) buildChartTemp(cTemp);
  if (cPowerVolt && !chartPowerVolt) buildChartPowerVolt(cPowerVolt);
}

function updateSimCharts() {
  const t = simEngine.hist_t;
  if (!t.length) return;

  if (chartTemp) {
    chartTemp.data.labels = t;
    chartTemp.data.datasets[0].data = simEngine.hist_Tj;
    chartTemp.data.datasets[1].data = t.map(() => PHYS.T_protect);
    chartTemp.update("none");
  }
  if (chartPowerVolt) {
    chartPowerVolt.data.labels = t;
    chartPowerVolt.data.datasets[0].data = simEngine.hist_P;
    chartPowerVolt.data.datasets[1].data = simEngine.hist_V;
    chartPowerVolt.update("none");
  }
}

function resizeSimCharts() {
  initSimCharts();
  if (chartTemp) chartTemp.resize();
  if (chartPowerVolt) chartPowerVolt.resize();
}


/* The clear-button handler that lived here wrote the OLD single-column log
   markup, which no longer matches the alarm table's grid columns. SIM3 owns
   the clear button now. The collapse toggle stays, but also hides the alarm
   table header so the card collapses cleanly. */
document.getElementById("log-hdr-toggle")?.addEventListener("click", () => {
  const logBody = document.getElementById("sim-log");
  const hdr = document.querySelector(".alarm-table-hdr");
  const toggleIcon = document.getElementById("log-toggle-icon");
  if (!logBody) return;
  const isHidden = logBody.style.display === "none";
  logBody.style.display = isHidden ? "block" : "none";
  if (hdr) hdr.style.display = isHidden ? "" : "none";
  if (toggleIcon) toggleIcon.style.transform = isHidden ? "rotate(0deg)" : "rotate(-90deg)";
});







// Default: panel open on first load of simulation tab




/* ═══════════════════════════════════════════════════════════════════
   MODULE: COMMAND BUTTONS (Tab 2)
   ═══════════════════════════════════════════════════════════════════ */
document.querySelectorAll(".cmd-btn[data-cmd]").forEach(btn => {
  btn.addEventListener("click", async () => {
    const cmd = btn.getAttribute("data-cmd");
    if (!cmd) return;
    setOnlineUI(true, "SENDING " + cmd.toUpperCase());
    try {
      const res = await fetch(API_BASE + "/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd }),
      });
      const result = await res.json();
      setOnlineUI(result.ok, result.ok ? "CMD " + cmd.toUpperCase() : "CMD ERROR");
      
      // Revert to normal connection status after 3 seconds
      setTimeout(() => setConnectionBadge(connState), 3000);
    } catch (_) {
      setOnlineUI(false, "NETWORK ERROR");
      
      // Revert to normal connection status after 3 seconds
      setTimeout(() => setConnectionBadge(connState), 3000);
    }
  });
});

/* ═══════════════════════════════════════════════════════════════════
   BOOT
   ═══════════════════════════════════════════════════════════════════ */
// Build scenario cards

// Fetch history.json for simulation



// Init sim & history charts on initial load
setTimeout(renderHistoryCharts, 50);
setTimeout(initSimCharts, 200);

// Start polling
pollLive();
pollHistory();
setInterval(pollLive, POLL_MS);
setInterval(pollHistory, HISTORY_POLL_MS);

// Initial gauge render
updateGauges({ T_j: PHYS.T_amb, P: 0, V: PHYS.V_rated, eta: PHYS.eta_rated * 100, lumen: 100 });

/* =======================================================================
   MODULE: REAL OPERATIONAL ANALYTICS (July 2026 Field Data)
   ======================================================================= */
let chartRealUptime = null;

async function fetchRealAnalytics() {
  try {
    const res = await fetch(API_BASE + "/api/real_analytics");
    const data = await res.json();
    if (!data.ok) return;

    const s = data.summary;

    const uptimeEl = document.getElementById("real-uptime-val");
    const runEl = document.getElementById("real-run-hours-val");
    const zeroEl = document.getElementById("real-zero-hours-val");
    const pfEl = document.getElementById("real-pf-val");
    const footerEl = document.getElementById("real-chart-footer");

    if (uptimeEl) uptimeEl.textContent = s.uptime_percentage.toFixed(1) + " %";
    if (runEl) runEl.textContent = s.total_run_hours.toFixed(1) + " h";
    if (zeroEl) zeroEl.textContent = s.total_zero_hours.toFixed(1) + " h";
    if (pfEl) pfEl.textContent = s.avg_power_factor.toFixed(2);
    if (footerEl) footerEl.textContent = s.total_days + " days analyzed | " + s.total_energy_kwh.toFixed(1) + " kWh total | " + s.uptime_percentage.toFixed(1) + "% availability";

    const days = data.daily.map(function (d) { return d.day.slice(5); });
    const runHours = data.daily.map(function (d) { return d.run_hours; });
    const zeroHrs = data.daily.map(function (d) { return d.zero_hours; });

    const canvas = document.getElementById("chart-real-uptime");
    if (!canvas) return;

    if (chartRealUptime) chartRealUptime.destroy();

    chartRealUptime = new Chart(canvas.getContext("2d"), {
      type: "bar",
      data: {
        labels: days,
        datasets: [
          {
            label: "Running (h)",
            data: runHours,
            backgroundColor: "rgba(22, 128, 60, 0.85)",
            borderColor: "rgba(22, 128, 60, 1)",
            borderWidth: 1,
            borderRadius: 2,
          },
          {
            label: "Zero-Current (h)",
            data: zeroHrs,
            backgroundColor: "rgba(100, 116, 139, 0.50)",
            borderColor: "rgba(100, 116, 139, 0.8)",
            borderWidth: 1,
            borderRadius: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: { boxWidth: 12, font: { size: 11 }, color: "#64748B" },
          },
          tooltip: {
            backgroundColor: "#FFFFFF",
            titleColor: "#0F172A",
            bodyColor: "#18212B",
            borderColor: "#BAC5D0",
            borderWidth: 1,
            padding: 10,
            callbacks: { label: c => ` ${c.dataset.label}: ${Number(c.parsed.y || 0).toFixed(1)} h` },
          },
        },
        scales: {
          x: {
            stacked: true,
            title: { display: true, text: "Date (July 2026)", font: { size: 11 }, color: "#64748B" },
            grid: { color: "rgba(217, 224, 231, 0.6)" },
            ticks: { font: { size: 10 }, color: "#64748B", maxRotation: 45 },
          },
          y: {
            stacked: true,
            title: { display: true, text: "Hours", font: { size: 11 }, color: "#64748B" },
            grid: { color: "rgba(217, 224, 231, 0.6)" },
            ticks: { font: { size: 11 }, color: "#64748B" },
          },
        },
      },
    });
  } catch (e) {
    console.warn("[REAL_ANALYTICS] Fetch failed:", e);
  }
}

fetchRealAnalytics();
setInterval(fetchRealAnalytics, 120000);

/* ══════════════════════════════════════════════════════════════════════════
   ██████████████████████████████████████████████████████████████████████████
                      LIVE CAMERA FEED URL CONFIGURATION
                      
   EZVIZ Cloud Stream Integration (Singapore / ISGP Platform)
   Camera Serial: BA8030786
   ██████████████████████████████████████████████████████████████████████████
   ══════════════════════════════════════════════════════════════════════════ */

const EZVIZ_SERIAL = "BA8030786";
const EZVIZ_ACCESS_TOKEN = "at.3tb75dv54q8j50tg62afpdhncwx3pmad-6t7ue3xcq0-12oi638-xb2bljsr6";

// Live Stream URL (Tailscale Funnel - 24/7 Secure HTTPS Stream)
const LIVE_CAMERA_URL = "https://desktop-ueq2tj6.tail05b01c.ts.net/stream.html?src=panel_cam&media=video";
const SERVER2_URL = "";

/* ══════════════════════════════════════════════════════════════════════════ */

const camFeedImg = document.getElementById("cam-feed-img");
const camFeedIframe = document.getElementById("cam-feed-iframe");
const camStandby = document.getElementById("cam-standby");
const camStatusText = document.getElementById("cam-status-text");
const camRestartBtn = document.getElementById("cam-restart-btn");
const camServerSelect = document.getElementById("cam-server-select");

const camFeedVideo = document.getElementById("cam-feed-video");

let webrtcPC = null; // Active WebRTC peer connection

async function connectWebRTC(baseUrl, streamName) {
  // Clean up any existing connection
  if (webrtcPC) {
    webrtcPC.close();
    webrtcPC = null;
  }
  if (camFeedVideo) {
    camFeedVideo.srcObject = null;
  }

  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });
  webrtcPC = pc;

  // ── KEY: only add VIDEO transceiver — no audio requested at all ──
  pc.addTransceiver("video", { direction: "recvonly" });

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  let answered = false;
  try {
    const res = await fetch(`${baseUrl}/api/webrtc?src=${streamName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pc.localDescription),
    });
    if (!res.ok) throw new Error(`go2rtc HTTP ${res.status}`);
    const answer = await res.json();
    await pc.setRemoteDescription(answer);
    answered = true;
  } catch (err) {
    console.warn("[WebRTC] Direct connection failed, falling back to iframe:", err.message);
    pc.close();
    webrtcPC = null;
    return false; // signal fallback needed
  }

  pc.ontrack = (event) => {
    if (camFeedVideo && event.streams[0]) {
      camFeedVideo.srcObject = event.streams[0];
      camFeedVideo.muted = true; // enforce mute on video element
      camFeedVideo.play().catch(() => { });
      camFeedVideo.classList.remove("hidden");
      if (camFeedIframe) camFeedIframe.classList.add("hidden");
      if (camFeedImg) camFeedImg.classList.add("hidden");
      if (camStandby) camStandby.classList.add("hidden");
      setCamOnline(true, "ONLINE");
    }
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
      setCamOnline(false, "UNAVAILABLE");
      if (camFeedVideo) camFeedVideo.classList.add("hidden");
      if (camStandby) camStandby.classList.remove("hidden");
    }
  };

  return answered;
}

const feedBody = document.getElementById("camfeed-body");
const btnToggle = document.getElementById("btn-camfeed-toggle");
const chevron = document.getElementById("camfeed-chevron");
const recDot = document.getElementById("camfeed-rec-dot");
const errOverlay = document.getElementById("camfeed-error");
const loadOverlay = document.getElementById("camfeed-loading");
const zoomFill = document.getElementById("camfeed-zoom-fill");

const camOverlayBox = document.getElementById("cam-overlay-box");
const camShowBtn = document.getElementById("cam-show-btn");

if (btnToggle && camOverlayBox) {
  btnToggle.addEventListener("click", () => {
    camOverlayBox.style.display = "none";
    if (camShowBtn) camShowBtn.style.display = "inline-flex";
  });
}

if (camShowBtn && camOverlayBox) {
  camShowBtn.addEventListener("click", () => {
    camOverlayBox.style.display = "flex";
    camShowBtn.style.display = "none";
  });
}

function setCamOnline(isOnline, label) {
  if (camStatusText) {
    camStatusText.textContent = label;
    camStatusText.classList.toggle("online", isOnline);
  }
  if (recDot) {
    if (isOnline) {
      recDot.style.background = "#10B981";
      recDot.style.animation = "rec-pulse 1.8s ease-in-out infinite";
    } else {
      recDot.style.background = "#F59E0B";
      recDot.style.animation = "none";
    }
  }
}

function showLoadingState() {
  if (loadOverlay) loadOverlay.style.display = "flex";
  if (errOverlay) errOverlay.style.display = "none";
  if (camStandby) camStandby.classList.add("hidden");
}

function showLiveState() {
  if (loadOverlay) loadOverlay.style.display = "none";
  if (errOverlay) errOverlay.style.display = "none";
  if (camStandby) camStandby.classList.add("hidden");
  setCamOnline(true, "ONLINE");
}

function showErrorState() {
  if (loadOverlay) loadOverlay.style.display = "none";
  if (errOverlay) errOverlay.style.display = "flex";
  setCamOnline(false, "UNAVAILABLE");
}

function initCameraFeed() {
  showLoadingState();

  let selectedUrl = LIVE_CAMERA_URL;
  if (camServerSelect && camServerSelect.value === "server2") {
    selectedUrl = SERVER2_URL;
  }

  if (!selectedUrl || !selectedUrl.trim()) {
    if (camFeedImg) camFeedImg.classList.add("hidden");
    if (camFeedVideo) camFeedVideo.classList.add("hidden");
    if (camFeedIframe) { camFeedIframe.classList.add("hidden"); camFeedIframe.src = ""; }
    showErrorState();
    return;
  }

  const url = selectedUrl.trim();
  const isImgStream = /\.(jpg|jpeg|png|mjpg|mjpeg|cgi|mjpeg\.cgi)($|\?)/i.test(url);

  if (isImgStream && camFeedImg) {
    if (camFeedIframe) { camFeedIframe.classList.add("hidden"); camFeedIframe.src = ""; }
    if (camFeedVideo) camFeedVideo.classList.add("hidden");
    camFeedImg.onerror = () => {
      camFeedImg.classList.add("hidden");
      showErrorState();
    };
    camFeedImg.onload = () => {
      camFeedImg.classList.remove("hidden");
      showLiveState();
    };
    camFeedImg.src = url + (url.includes("?") ? "&" : "?") + "t=" + new Date().getTime();

  } else {
    // ── Try direct WebRTC (video-only, guaranteed muted) ──────────────
    if (camFeedImg) camFeedImg.classList.add("hidden");

    try {
      const urlObj = new URL(url);
      const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
      const src = urlObj.searchParams.get("src") || "panel_cam";

      connectWebRTC(baseUrl, src).then((ok) => {
        if (!ok) {
          // WebRTC API failed → fall back to iframe with muted params
          let finalUrl = url.split("?")[0] + "?src=" + src + "&media=video&muted=true&mute=1";
          if (camFeedIframe) {
            camFeedIframe.classList.remove("hidden");
            camFeedIframe.src = finalUrl;
          }
          showLiveState();
        }
      });
    } catch (e) {
      // Bad URL — fall back to iframe
      let finalUrl = url;
      if (!finalUrl.includes("media=video")) finalUrl += (finalUrl.includes("?") ? "&" : "?") + "media=video";
      if (!finalUrl.includes("muted=")) finalUrl += "&muted=true&mute=1";
      if (camFeedIframe) { camFeedIframe.classList.remove("hidden"); camFeedIframe.src = finalUrl; }
      showLiveState();
    }
  }
  updateZoom();
}

// ── Zoom & D-pad Controllers for Camera overlay ───────────────────────────
const DEFAULT_ZOOM = 1.25;
let camZoom = DEFAULT_ZOOM;
let panX = 0;
let panY = 0;

const ZOOM_MIN = 1.0;
const ZOOM_MAX = 4.0;
const ZOOM_STEP = 0.25;
const PAN_STEP = 25;

const camZoomVal = document.getElementById("cam-zoom-val");
const camZoomIn = document.getElementById("cam-zoom-in");
const camZoomOut = document.getElementById("cam-zoom-out");
const camZoomReset = document.getElementById("cam-zoom-reset");

const camPanUp = document.getElementById("cam-pan-up");
const camPanDown = document.getElementById("cam-pan-down");
const camPanLeft = document.getElementById("cam-pan-left");
const camPanRight = document.getElementById("cam-pan-right");

const camZoomWrapper = document.getElementById("cam-zoom-wrapper");
const camfeedViewport = document.getElementById("camfeed-viewport");

// Strict clamping function to prevent black borders from ever showing
function clampPan() {
  if (camZoom <= 1.0) {
    panX = 0;
    panY = 0;
    return;
  }

  const vpW = camfeedViewport ? camfeedViewport.clientWidth : 576;
  const vpH = camfeedViewport ? camfeedViewport.clientHeight : 324;

  // Max translation in unscaled coordinates before visual edge leaves boundary
  const maxPanX = ((camZoom - 1.0) / (2.0 * camZoom)) * vpW;
  const maxPanY = ((camZoom - 1.0) / (2.0 * camZoom)) * vpH;

  panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
  panY = Math.max(-maxPanY, Math.min(maxPanY, panY));
}

function updateZoom() {
  if (camZoomVal) camZoomVal.textContent = `${camZoom.toFixed(2)}x`;

  clampPan();

  // Update zoom fill bar percentage
  if (zoomFill) {
    const pct = ((camZoom - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN)) * 100;
    zoomFill.style.width = `${pct}%`;
  }

  // Apply transform to wrapper div
  if (camZoomWrapper) {
    camZoomWrapper.style.transform = `scale(${camZoom}) translate(${panX}px, ${panY}px)`;
  }
}

if (camZoomIn) {
  camZoomIn.addEventListener("click", () => {
    camZoom = Math.min(camZoom + ZOOM_STEP, ZOOM_MAX);
    updateZoom();
  });
}

if (camZoomOut) {
  camZoomOut.addEventListener("click", () => {
    camZoom = Math.max(camZoom - ZOOM_STEP, ZOOM_MIN);
    updateZoom();
  });
}

if (camZoomReset) {
  camZoomReset.addEventListener("click", () => {
    camZoom = DEFAULT_ZOOM;
    panX = 0;
    panY = 0;
    updateZoom();
  });
}

// Panning Event Listeners — strictly clamped to viewport bounds
if (camPanUp) {
  camPanUp.addEventListener("click", () => {
    if (camZoom > 1.0) {
      panY += PAN_STEP / camZoom;
      updateZoom();
    }
  });
}
if (camPanDown) {
  camPanDown.addEventListener("click", () => {
    if (camZoom > 1.0) {
      panY -= PAN_STEP / camZoom;
      updateZoom();
    }
  });
}
if (camPanLeft) {
  camPanLeft.addEventListener("click", () => {
    if (camZoom > 1.0) {
      panX += PAN_STEP / camZoom;
      updateZoom();
    }
  });
}
if (camPanRight) {
  camPanRight.addEventListener("click", () => {
    if (camZoom > 1.0) {
      panX -= PAN_STEP / camZoom;
      updateZoom();
    }
  });
}

if (camRestartBtn) {
  camRestartBtn.addEventListener("click", () => {
    if (camFeedIframe && !camFeedIframe.classList.contains("hidden")) {
      camFeedIframe.src = "";
    }
    setTimeout(initCameraFeed, 100);
  });
}

if (camServerSelect) {
  camServerSelect.addEventListener("change", () => {
    initCameraFeed();
  });
}

// Initialize camera stream on dashboard load
initCameraFeed();

/* The legacy simTick() loop used to be started here unconditionally. It is now
   left stopped: SIM3 owns Tab 3 and drives the gauges and charts itself, so
   running simTick() as well meant two engines writing the same gauges every
   frame — SIM3's values were overwritten by the legacy engine's idle state.
   simEngine survives only as the backing store for the chart history arrays. */
simEngine.running = false;

/* ═══════════════════════════════════════════════════════════════════
   MODULE: COMMAND INTERFACE — single authenticated channel
   ═══════════════════════════════════════════════════════════════════

   The "Plan B" MQTT publish path that used to live here has been REMOVED, and
   with it the hardcoded command topic:

       const SECRET_CMD_TOPIC = "dt/lamps/sec_.../cmd";

   That constant shipped to every visitor in this file. Combined with
   /api/mqtt-config — which served broker credentials to anyone who opened the
   URL — it let any visitor publish straight to the broker and operate the
   physical panel, bypassing the Worker entirely. Naming the topic "sec_" did
   not make it secret; it was in View Source.

   Commands now go only through /api/control, which holds the privileged
   credentials server-side and can be placed behind Cloudflare Access. The
   browser's broker identity is subscribe-only, so it CANNOT publish even if
   someone tries. Losing the fallback is the point: a control path that cannot
   be authenticated is worse than no fallback at all.
   ═══════════════════════════════════════════════════════════════════ */

async function sendControlCommand(cmd) {
  console.info(`[CTRL] Initiating command '${cmd}'...`);
  if (controlPill) setPillTone(controlPill, `Sending: ${cmd}…`, "info");

  try {
    const res = await fetch(API_BASE + "/api/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",          // carry the Cloudflare Access cookie
      body: JSON.stringify({ command: cmd })
    });

    let result = {};
    try { result = await res.json(); } catch { /* non-JSON error page */ }

    if (res.ok && result.ok) {
      console.info(`[CTRL] Command '${cmd}' accepted by the panel.`);
      if (controlPill) setPillTone(controlPill, `Sent: ${cmd}`, "ok");
      return;
    }

    /* Distinguish the failure modes so an operator knows what to do. */
    const reason = {
      unauthenticated: "Sign-in required",
      cross_origin_blocked: "Blocked: cross-origin",
      invalid_command: "Rejected: unknown command",
      server_misconfigured: "Server missing credentials",
      ha_unreachable: "Panel unreachable",
    }[result.error] || `Failed: ${result.error || res.status}`;

    console.error(`[CTRL] '${cmd}' rejected: ${result.error || res.status}`);
    if (controlPill) setPillTone(controlPill, reason, res.status === 401 ? "warn" : "bad");
  } catch (e) {
    console.error(`[CTRL] Control channel unreachable: ${e.message}`);
    if (controlPill) setPillTone(controlPill, "Control channel offline", "bad");
  }
}

// Bind event listeners to all command buttons (Unlock, Open, Close)
document.querySelectorAll(".cmd-btn[data-cmd]").forEach(btn => {
  btn.addEventListener("click", () => {
    const cmd = btn.dataset.cmd;
    if (cmd) sendControlCommand(cmd);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   BOOT: Start the Hybrid Connection Manager
   — Fetches MQTT broker config from /api/mqtt-config (env vars)
   — Tries MQTT first; falls back to HTTP Polling if unavailable.
   ═══════════════════════════════════════════════════════════════════ */
(async function boot() {
  const hasMQTT = await loadMQTTConfig();
  if (hasMQTT) {
    startMQTT();
  } else {
    // No MQTT config available — go straight to HTTP Polling
    startPolling();
    setConnectionBadge("polling");
  }
})();
pollHistory();
setInterval(pollHistory, HISTORY_POLL_MS);



/* ═══════════════════════════════════════════════════════════════════
   MODULE: SIM3 — 40-LAMP PHYSICS ENGINE

   Drives the 3D panel in Tab 3 material-by-material. Every constant below is
   tagged with its provenance, so measurement is never confused with datasheet
   value, and neither is confused with model assumption:

     MEASURED   calibrated from history.json (1,310 energised readings)
     DATASHEET  Philips Essential LEDbulb 11W E27 230V, order 929002299709
     MODELLED   assumption — this panel carries NO thermal or photometric
                sensor, so Tj, lumen output and ageing can never be verified
                against it. Treated as a model, and labelled as one in the UI.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var P = {
    N: 40,                    /* MEASURED — 8 columns x 5 rows on the real board */

    /* ── MEASURED ── */
    V_MEAS: 229.7,            // V    p05-p95  228.1 - 231.0
    P_LAMP_MEAS: 10.05,       // W    p05-p95  10.00 - 10.16
    I_MEAS: 2.932,            // A
    PF_MEAS: 0.597,           // -    (IEC 61000-3-2 exempts <=25 W lamps from PFC)

    /* ── DATASHEET ── */
    P_LAMP_RATED: 11.0,       // W
    FLUX_RATED: 1200,         // lm
    EFFICACY: 109,            // lm/W
    L70_H: 12000,             // h    rated life to 70% lumen maintenance
    T_CASE_MAX: 95,           // degC driver thermal-foldback limit
    T_AMB_MAX: 45,            // degC top of rated ambient range
    T_AMB_MIN: -20,           // degC
    V_MIN: 220, V_MAX: 240,   // V    rated supply window
    START_S: 0.5,             // s    quoted starting time -> warm-up ramp

    /* ── MODELLED ── */
    R_TH: 5.5,                // degC/W junction-to-ambient
    TAU_TH: 600,              // s    thermal time constant (~10 min, typical E27)
    E_A: 0.70,                // eV   Arrhenius activation energy, InGaN
    K_B: 8.617e-5,            // eV/K
    DROOP_PER_C: 0.0035,      // /degC flux lost per degC above 25 (-0.35 %/degC)
    LER: 300,                 // lm/W luminous efficacy of radiation, 4000 K white
    T_AMB: 25,                // degC nominal ambient
    CAP_LIFE_H: 4500,         // h    driver electrolytic life at 85 degC
    WEIBULL_BETA: 2.5,        // -    wear-out shape
    WEIBULL_ETA: 25000,       // h    characteristic life (equivalent hours at T_REF)

    /* Vertical thermal gradient. Convection carries heat from the lower lamps
       up across the upper ones, so a wall-mounted array is measurably hotter
       at the top. Modelled as a local ambient offset, linear from 0 at the
       bottom row to T_GRAD at the top. This makes row-wise failure patterns
       emerge from the physics instead of from the random Rth spread. */
    T_GRAD: 8,                // degC bottom row -> top row
    COLS: 8, ROWS: 5,

    /* Power quality — non-PFC capacitor-input driver.
       Displacement PF is near unity for this topology, so the measured true
       PF of 0.597 is almost entirely DISTORTION. Harmonic profile is the
       typical odd-harmonic signature of a capacitor-input rectifier,
       normalised so the computed THD matches the measurement. */
    DPF: 0.99,                // -    displacement power factor (cos phi_1)
    HARM_PROFILE: [           // [order, relative amplitude before scaling]
      [3, 0.88], [5, 0.66], [7, 0.46], [9, 0.30], [11, 0.19], [13, 0.13], [15, 0.09]
    ],
    /* Cold inrush. An LED driver's input capacitor is discharged at switch-on,
       so for a few hundred microseconds it behaves as a near short circuit.
       The lamps sit in PARALLEL on one branch circuit and therefore share a
       single loop impedance, so the total does NOT scale linearly with lamp
       count: once the first few lamps draw current the volt-drop across the
       wiring starves the rest.

           I_peak = V_peak / (Z_loop + Z_lamp / N)

       This matches the published single-lamp figure at N = 1 and saturates at
       V_peak / Z_loop as N grows, which is the real physical ceiling. The
       previous model was a flat 8 A x N, giving 320 A for 40 lamps — an
       arithmetic result with no circuit behind it. */
    Z_LOOP: 0.5,              // ohm  MODELLED loop impedance (~30 m of 2.5 mm^2 + source)
    Z_LAMP_INRUSH: 40.6,      // ohm  MODELLED driver limiting impedance -> ~8 A for one lamp
    INRUSH_US: 300,           // us   MODELLED inrush duration

    /* SEC residential tariff */
    TARIFF1: 0.18,            // SAR/kWh up to the tier threshold
    TARIFF2: 0.30,            // SAR/kWh above it
    TIER1_KWH: 6000,          // kWh/month threshold
    LAMP_PRICE: 12,           // SAR  MODELLED unit replacement cost
    DUTY_H_DAY: 12,           // h/day assumed duty for calendar projection

    /* Residual-monitor alarm thresholds, in WATTS rather than percent.
       Absolute watts are the honest unit here because the residual is read as
       "how many lamps am I missing": at 10.05 W per lamp, 20 W is two lamps
       and 40 W is four. A percentage moves with the load, so the same 40 W
       gap would alarm at 10% with all 40 lit but at 20% with only half lit —
       the operator's mental model does not change with the load, so the
       threshold should not either. */
    RESID_DRIFT_W: 20,        // W  |EWMA| above this -> DRIFT
    RESID_FAULT_W: 40,        // W  |EWMA| above this -> FAULT SUSPECTED
  };

  /* Wall-plug efficiency from the datasheet: 109 lm/W delivered against a
     ~300 lm/W luminous efficacy of radiation for 4000 K white. The remainder
     is dissipated as heat, which is what actually sets junction temperature. */
  var ETA_WPE = P.EFFICACY / P.LER;              // ~0.363
  var HEAT_FRAC = 1 - ETA_WPE;                   // ~0.637

  /* The datasheet's 1,200 lm is quoted at the 11 W nameplate. These lamps
     actually draw 10.05 W, and flux tracks drive power closely over a small
     range, so the delivered flux is scaled accordingly. Without this the
     panel reported 119 lm/W — better than the datasheet's own 109 lm/W,
     which would be flattering nonsense. */
  P.FLUX_ACTUAL = P.FLUX_RATED * (P.P_LAMP_MEAS / P.P_LAMP_RATED);   // ~1,096 lm

  var KFAC = P.E_A / P.K_B;

  /* Arrhenius reference = the junction temperature this lamp actually reaches
     at RATED conditions (25 degC ambient, 230 V, free air), i.e. ~60 degC, not
     the 85 degC of an LM-80 oven. A consumer datasheet quotes "12,000 h" for
     normal use, so AF must equal 1 at normal use; pinning AF = 1 at 85 degC
     instead made the model predict L70 at ~65,000 h and report 94% lumen
     maintenance at the rated 12,000 h. With the reference set here, the
     baseline scenario lands on L70 at exactly 12,000 h by construction, and
     AF > 1 only when the panel runs hotter than rated. */
  var T_NOM_C = P.T_AMB + P.R_TH * P.P_LAMP_MEAS * HEAT_FRAC;   // ~60.2 degC
  P.T_REF = T_NOM_C + 273.15;                                    // K
  P.T_NOM_C = T_NOM_C;

  var K_LM = -Math.log(0.70) / P.L70_H;          // per equivalent-hour

  /* ── deterministic RNG so a scenario replays identically ── */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var SEED = 20260907;
  var rnd = mulberry32(SEED);

  /* ── state ── */
  var G = {
    lamps: [], f: {}, simHours: 0, scenario: null,
    V: P.V_MEAS, Tamb: P.T_AMB, energised: P.N, contactor: false,
    energyWh: 0,                 // accumulated electrical energy
  };
  var viewer = null;

  function makeLamp(id) {
    /* row 0 is the TOP row (verified against world coordinates), so the
       gradient is largest at row 0 and zero at the bottom row. */
    var row = Math.floor(id / P.COLS);
    var dT = P.T_GRAD * (1 - row / (P.ROWS - 1));
    return {
      id: id,                       // 0-based
      row: row, col: id % P.COLS,
      dTamb: dT,                    // local ambient offset from the gradient
      on: false, failed: false, failMode: 'none',
      health: 1,                    // 1 -> 0, catastrophic-failure margin
      lumens: 1,                    // lumen maintenance factor
      Tj: P.T_AMB + dT,
      hoursRun: 0, eqHours: 0,      // eqHours = integral of AF dt (hours at T_REF)
      Rth: P.R_TH * (1 + (rnd() - 0.5) * 0.10),
      warm: 0,                      // 0..1 soft-start ramp
      capWear: 0,                   // driver electrolytic wear, 0..1
      flicker: 0,                   // percent modulation (true, at 100 Hz)
      cycling: false, foldback: false, cycles: 0,
      // Weibull quantile fixed per lamp so failures scatter realistically
      wq: rnd(),
    };
  }

  function initLamps() {
    rnd = mulberry32(SEED);
    G.lamps = [];
    for (var i = 0; i < P.N; i++) G.lamps.push(makeLamp(i));
  }

  /* ── physics ── */
  function arrAF(Tj) { return Math.exp(KFAC * (1 / P.T_REF - 1 / (Tj + 273.15))); }

  /* Supply voltage. The driver regulates inside its rated 220-240 V window, so
     power and flux are near-constant there. Below the window it drops out of
     regulation and output collapses; above it, stress and dissipation climb.
     NOTE: the field data spans only 227.7-231.9 V (1.8%), far too narrow to
     fit a P(V) exponent from measurement (R2 = 0.34), so this is a documented
     model of a regulated driver, not a fitted curve. */
  function voltageFactors(V) {
    if (V >= P.V_MIN && V <= P.V_MAX) return { flux: 1, pmul: 1, stress: 1 };
    if (V < P.V_MIN) {
      var f = Math.max(0, (V - 160) / (P.V_MIN - 160));
      return { flux: f * f, pmul: f, stress: 1 };
    }
    var over = (V - P.V_MAX) / P.V_MAX;
    return { flux: 1, pmul: 1 + 2 * over, stress: 1 + 8 * over };
  }

  function lampWeibullLimit(l) {
    return P.WEIBULL_ETA * Math.pow(-Math.log(1 - l.wq * 0.999), 1 / P.WEIBULL_BETA);
  }

  function killLamp(l, mode) {
    if (l.failed) return;
    l.failed = true; l.on = false; l.health = 0; l.failMode = mode;
    l.flicker = 0; l.cycling = false; l.foldback = false;
    var n = G.lamps.filter(function (x) { return x.failed; }).length;
    log3('bad', 'Lamp L' + pad(l.id + 1) + ' FAILED — ' + mode.replace(/_/g, ' ') + '. Total ' + n + '/' + P.N);
  }

  /* One integration step. dt in simulated SECONDS. Uses the exact exponential
     solution of the first-order thermal RC rather than an Euler step, so it
     stays stable at any time-scale instead of blowing up at 100x. */
  function tickLamp(l, dt, TambBase, vf) {
    var Tamb = TambBase + l.dTamb;   // vertical convection gradient
    var energised = G.contactor && !l.failed && l.id < G.energised && !G.f.rowKill?.includes(l.row);

    // driver thermal foldback: trips at T_case, restarts after cooling
    if (l.foldback) {
      if (l.Tj <= P.T_CASE_MAX - 15) { l.foldback = false; l.cycles++; }
    } else if (energised && l.Tj >= P.T_CASE_MAX) {
      l.foldback = true;
      if (!l.cycling) {
        l.cycling = true;
        log3('warn', 'Lamp L' + pad(l.id + 1) + ' hit T-case ' + P.T_CASE_MAX + ' °C — driver foldback, thermal cycling.');
      }
    }
    var lit = energised && !l.foldback;
    l.on = lit;

    // soft-start ramp (datasheet starting time)
    var kw = dt / Math.max(0.05, P.START_S);
    l.warm = lit ? Math.min(1, l.warm + kw) : Math.max(0, l.warm - kw * 2);

    // thermal
    var Rth = l.Rth + (G.f.dust ? Math.min(2.5, 0.06 * (l.hoursRun / 1000)) : 0);
    var Pel = lit ? P.P_LAMP_MEAS * vf.pmul * vf.stress : 0;
    var Tss = Tamb + Rth * Pel * HEAT_FRAC;
    var tau = Math.max(1, P.TAU_TH * (Rth / P.R_TH));
    l.Tj = Tss + (l.Tj - Tss) * Math.exp(-dt / tau);
    if (l.Tj > 160) l.Tj = 160;

    if (l.failed) return;

    if (lit) {
      var hrs = dt / 3600;
      var af = arrAF(l.Tj);
      l.hoursRun += hrs;
      l.eqHours += hrs * af * vf.stress;
      l.lumens = Math.exp(-K_LM * l.eqHours);

      /* Driver electrolytic capacitor wear — the classic end-of-life mechanism
         for non-PFC LED lamps. Life halves per +10 degC (Arrhenius 10-degree
         rule). As ESR rises and capacitance falls, output ripple grows, which
         is seen as flicker at 2x mains = 100 Hz. */
      var capLife = P.CAP_LIFE_H * Math.pow(2, (85 - l.Tj) / 10);
      l.capWear = Math.min(1.5, l.capWear + hrs / Math.max(1, capLife));
      l.flicker = Math.min(100, 4 + 92 * Math.pow(Math.min(1, l.capWear), 2));

      // catastrophic failure (Weibull on equivalent hours)
      if (l.eqHours >= lampWeibullLimit(l)) { killLamp(l, 'driver_failure'); return; }
      if (l.capWear >= 1.35) { killLamp(l, 'capacitor_wearout'); return; }
      if (l.lumens <= 0.30) { killLamp(l, 'lumen_depreciation'); return; }
      if (l.cycles >= 400) { killLamp(l, 'thermal_cycling_fatigue'); return; }

      l.health = Math.max(0, Math.min(
        1 - l.eqHours / lampWeibullLimit(l),
        (l.lumens - 0.30) / 0.70
      ));
    }
  }

  /* Integrate in bounded sub-steps so ageing and heating stay coupled.
     The step size is adaptive: the thermal update is the exact exponential
     solution, so once every lamp is well below the foldback threshold and
     thermally settled, a coarse step is just as accurate and ~30x cheaper.
     Fine steps are kept whenever a lamp is near T_case, because foldback
     cycling is a fast on/off process that coarse steps would miscount.
     With a fixed 30 s step a 25,000 h jump blocked the main thread for 8.3 s. */
  var FINE_DT = 30, COARSE_DT = 900, HOT_MARGIN = 8;

  function stepAll(dtSim) {
    var Tamb = G.Tamb + (G.f.ambient || 0);
    var vf = voltageFactors(G.V * (G.f.overvolt ? 1.15 : 1));
    var remaining = dtSim;
    var settled = 0;
    while (remaining > 1e-9) {
      var hot = false;
      for (var k = 0; k < G.lamps.length; k++) {
        var lk = G.lamps[k];
        if (!lk.failed && (lk.foldback || lk.Tj > P.T_CASE_MAX - HOT_MARGIN)) { hot = true; break; }
      }
      // stay fine for the first few steps so the thermal transient resolves
      var MAX = (!hot && settled >= 4) ? COARSE_DT : FINE_DT;
      var dt = Math.min(MAX, remaining);
      remaining -= dt; settled++;
      for (var i = 0; i < G.lamps.length; i++) tickLamp(G.lamps[i], dt, Tamb, vf);
      // energy accrues on the lamps actually drawing current this sub-step
      var litN = 0;
      for (var m = 0; m < G.lamps.length; m++) if (G.lamps[m].on) litN++;
      G.energyWh += litN * P.P_LAMP_MEAS * vf.pmul * vf.stress * (dt / 3600);
      G.simHours += dt / 3600;
    }
  }

  /* ── panel-level electrical outputs (derived, never inputs) ── */
  function panelElectrical() {
    var vf = voltageFactors(G.V * (G.f.overvolt ? 1.15 : 1));
    var lit = G.lamps.filter(function (l) { return l.on; }).length;
    var Pw = lit * P.P_LAMP_MEAS * vf.pmul * vf.stress;
    var V = G.V * (G.f.overvolt ? 1.15 : 1);
    var I = (V > 1 && P.PF_MEAS > 0) ? Pw / (V * P.PF_MEAS) : 0;
    return { P: Pw, V: V, I: I, lit: lit };
  }

  /* ── 3D rendering ──────────────────────────────────────────────────
     True driver ripple is 100 Hz; a 60 Hz display physically cannot show it
     and would alias into a false beat. So the ANIMATION is an indicative
     modulation at a visible rate, while the honest 100 Hz percent-flicker is
     reported as a number in the inspector and labelled as such. */
  var FLICKER_VIS_HZ = 7;

  function renderModel(nowMs) {
    if (!viewer || !viewer.model) return;
    var t = nowMs / 1000;
    for (var i = 0; i < G.lamps.length; i++) {
      var l = G.lamps[i];
      var lamp = i + 1;
      if (l.failed) { setLampState(lamp, false, viewer, false, 0, 0, true); continue; }
      if (!l.on || l.warm <= 0.001) { setLampState(lamp, false, viewer, false, 0, 0, false); continue; }

      var droop = Math.max(0.25, 1 - P.DROOP_PER_C * Math.max(0, l.Tj - 25));
      var vf = voltageFactors(G.V * (G.f.overvolt ? 1.15 : 1));
      var mod = 1;
      if (l.flicker > 8) {
        var amp = Math.min(0.85, l.flicker / 100);
        mod = 1 - amp * 0.5 * (1 - Math.cos(2 * Math.PI * FLICKER_VIS_HZ * t + i));
        if (l.flicker > 60 && rnd() < 0.02) mod *= 0.25;   // intermittent dropout
      }
      var intensity = Math.max(0, l.warm * droop * l.lumens * vf.flux * mod * (G.f.dirt ? 0.65 : 1));
      var tempRatio = Math.max(0, Math.min(1, (l.Tj - 25) / (P.T_CASE_MAX - 25)));
      setLampState(lamp, true, viewer, false, intensity, tempRatio, false);
    }
  }

  /* ── KPIs, gauges, charts ── */
  function pad(n) { return String(n).padStart(2, '0'); }

  function updateKPIs() {
    var lamps = G.lamps;
    var live = lamps.filter(function (l) { return !l.failed; });
    var lit = lamps.filter(function (l) { return l.on; });
    var fc = P.N - live.length;
    var aH = lamps.reduce(function (a, l) { return a + l.health; }, 0) / P.N * 100;
    // panel lumen output = delivered flux / rated flux over ALL lamps
    var aLm = lamps.reduce(function (a, l) { return a + (l.on ? l.lumens : 0); }, 0) / P.N * 100;
    var aTj = lit.length ? lit.reduce(function (a, l) { return a + l.Tj; }, 0) / lit.length : G.Tamb + (G.f.ambient || 0);
    var aAF = lit.length ? lit.reduce(function (a, l) { return a + arrAF(l.Tj); }, 0) / lit.length : 1;

    function sv(id, html, cls) {
      var e = document.getElementById(id); if (!e) return;
      e.className = 's3-kpi-value' + (cls ? ' ' + cls : ''); e.innerHTML = html;
    }
    function sb(id, w, bg) {
      var e = document.getElementById(id);
      if (e) { e.style.width = Math.max(0, Math.min(100, w)).toFixed(1) + '%'; e.style.background = bg; }
    }

    sv('s3-health', aH.toFixed(1) + '<span>%</span>', aH > 80 ? 'ok' : aH > 50 ? 'warn' : 'bad');
    sb('s3-health-bar', aH, aH > 80 ? '#22c55e' : aH > 50 ? '#fbbf24' : '#ef4444');
    sv('s3-lumens', aLm.toFixed(1) + '<span>%</span>', aLm > 80 ? 'ok' : aLm > 60 ? 'warn' : 'bad');
    sb('s3-lumens-bar', aLm, '#f59e0b');
    sv('s3-tj', aTj.toFixed(1) + '<span>°C</span>', aTj < 70 ? 'ok' : aTj < P.T_CASE_MAX ? 'warn' : 'bad');
    sb('s3-tj-bar', (aTj - 20) / (P.T_CASE_MAX + 25 - 20) * 100, aTj < 70 ? '#22c55e' : aTj < P.T_CASE_MAX ? '#fbbf24' : '#ef4444');
    sv('s3-failed', fc + '<span>/ ' + P.N + '</span>', fc === 0 ? 'ok' : fc < 8 ? 'warn' : 'bad');
    sb('s3-failed-bar', fc / P.N * 100, '#ef4444');
    sv('s3-af', aAF.toFixed(2) + '<span>×</span>');
    var sh = document.getElementById('s3-simhours');
    if (sh) sh.textContent = 't = ' + Math.floor(G.simHours).toLocaleString() + ' h';

    // derived electrical readouts (outputs, not inputs)
    var el = panelElectrical();
    setTxt('sim2-derived-p', el.P.toFixed(0) + ' W');
    setTxt('sim2-derived-i', el.I.toFixed(2) + ' A');
    setTxt('sim2-temp-val', aTj.toFixed(1) + ' °C');
    setTxt('sim2-lumen-val', aLm.toFixed(1));

    if (typeof updateGauges === 'function') {
      updateGauges({ T_j: aTj, P: el.P, V: el.V, eta: ETA_WPE * 100, lumen: aLm });
    }
    renderInspector();
    renderPQ();
    renderEnergy();
    renderMaintenance();
    renderResidual();
  }

  function setTxt(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }

  /* ── charts (reuse the legacy chart objects) ── */
  var lastChartH = -1;
  function pushChart() {
    if (typeof simEngine === 'undefined' || !simEngine) return;
    if (G.simHours - lastChartH < 0.01 && lastChartH >= 0) return;
    lastChartH = G.simHours;
    var el = panelElectrical();
    var lit = G.lamps.filter(function (l) { return l.on; });
    var aTj = lit.length ? lit.reduce(function (a, l) { return a + l.Tj; }, 0) / lit.length : G.Tamb;
    simEngine.hist_t.push(Number((G.simHours * 3600).toFixed(1)));
    simEngine.hist_Tj.push(Number(aTj.toFixed(2)));
    simEngine.hist_P.push(Number(el.P.toFixed(1)));
    simEngine.hist_V.push(Number(el.V.toFixed(1)));
    if (simEngine.hist_t.length > 200) {
      simEngine.hist_t.shift(); simEngine.hist_Tj.shift();
      simEngine.hist_P.shift(); simEngine.hist_V.shift();
    }
    if (typeof updateSimCharts === 'function') updateSimCharts();
    var b = document.getElementById('sim-time-badge');
    if (b) b.textContent = 't = ' + Math.floor(G.simHours).toLocaleString() + ' h';
  }

  /* ── lamp inspector ── */
  function renderInspector() {
    var pick = document.getElementById('s3-lamp-pick');
    if (!pick) return;
    var n = Math.max(1, Math.min(P.N, parseInt(pick.value || '1', 10) || 1));
    var l = G.lamps[n - 1]; if (!l) return;
    var st = l.failed ? 'FAILED' : l.foldback ? 'FOLDBACK' : l.on ? 'ON' : 'OFF';
    function put(id, txt, cls) {
      var e = document.getElementById(id); if (!e) return;
      e.textContent = txt; e.className = 's3-ins-v' + (cls ? ' ' + cls : '');
    }
    put('ins-state', st, l.failed ? 'bad' : l.on ? 'ok' : '');
    put('ins-health', (l.health * 100).toFixed(1) + '%', l.health > 0.8 ? 'ok' : l.health > 0.5 ? 'warn' : 'bad');
    put('ins-lumens', (l.on ? l.lumens * 100 : 0).toFixed(1) + '%', l.lumens > 0.8 ? 'ok' : l.lumens > 0.6 ? 'warn' : 'bad');
    put('ins-tj', l.Tj.toFixed(1) + ' °C', l.Tj < 70 ? 'ok' : l.Tj < P.T_CASE_MAX ? 'warn' : 'bad');
    put('ins-hours', Math.floor(l.hoursRun).toLocaleString() + ' h');
    put('ins-af', arrAF(l.Tj).toFixed(2) + '×');
    put('ins-flicker', l.flicker.toFixed(1) + '%', l.flicker < 10 ? 'ok' : l.flicker < 40 ? 'warn' : 'bad');
    put('ins-mode', l.failed ? l.failMode.replace(/_/g, ' ') : (l.cycling ? 'cycling ×' + l.cycles : '—'));
  }

  /* ── scenarios: extreme by design, anchored to real datasheet limits ── */
  var SCENARIOS = [
    {
      id: 's1', name: 'Baseline to L70', risk: 'low', riskCls: 'low',
      desc: 'Measured operating point (230 V, 25 °C, all 40 lit) run to the datasheet L70 point. Establishes the reference degradation curve.',
      params: [{ k: 'V', v: '230 V' }, { k: 'T_amb', v: '25 °C' }, { k: 'Run', v: '12,000 h' }],
      hours: 12000, setup: function () { G.V = P.V_MEAS; G.Tamb = 25; G.energised = P.N; }
    },
    {
      id: 's2', name: 'Summer — Beyond Rated Ambient', risk: 'high', riskCls: 'high',
      desc: 'Ambient 55 °C, ABOVE the datasheet maximum of 45 °C, with grid at the 240 V ceiling. Junction temperature approaches the 95 °C T-case limit.',
      params: [{ k: 'T_amb', v: '55 °C' }, { k: 'V', v: '240 V' }, { k: 'Run', v: '8,000 h' }],
      hours: 8000, setup: function () { G.V = 240; G.Tamb = 55; G.energised = P.N; }
    },
    {
      id: 's3', name: 'Thermal Runaway — Dust + 60 °C', risk: 'crit', riskCls: 'crit',
      desc: 'No maintenance. Dust chokes the heatsinks (R_th climbs 6%/1,000 h) at 60 °C ambient until drivers hit T-case 95 °C and begin thermal cycling.',
      params: [{ k: 'ΔR_th', v: '+6%/1kh' }, { k: 'T_amb', v: '60 °C' }, { k: 'Run', v: '6,000 h' }],
      hours: 6000, setup: function () { G.V = P.V_MEAS; G.Tamb = 60; G.f.dust = true; G.energised = P.N; }
    },
    {
      id: 's4', name: 'Sustained Overvoltage 255 V', risk: 'crit', riskCls: 'crit',
      desc: 'Grid held at 255 V, well above the rated 240 V ceiling. Driver stress and dissipation rise sharply, collapsing life.',
      params: [{ k: 'V', v: '255 V' }, { k: 'T_amb', v: '40 °C' }, { k: 'Run', v: '4,000 h' }],
      hours: 4000, setup: function () { G.V = 255; G.Tamb = 40; G.energised = P.N; }
    },
    {
      id: 's5', name: 'End of Life — 25,000 h', risk: 'crit', riskCls: 'crit',
      desc: 'Run far past rated life. Electrolytic capacitors dry out, flicker spreads across the array, then failures cascade.',
      params: [{ k: 'Run', v: '25,000 h' }, { k: 'V', v: '230 V' }, { k: 'Effect', v: 'Mass flicker' }],
      hours: 25000, setup: function () { G.V = P.V_MEAS; G.Tamb = 30; G.energised = P.N; }
    },
    {
      id: 's6', name: 'Grid Sag 195 V', risk: 'med', riskCls: 'med',
      desc: 'Supply below the rated 220 V window. Drivers fall out of regulation and luminous output collapses, though ageing slows with the reduced load.',
      params: [{ k: 'V', v: '195 V' }, { k: 'T_amb', v: '25 °C' }, { k: 'Run', v: '2,000 h' }],
      hours: 2000, setup: function () { G.V = 195; G.Tamb = 25; G.energised = P.N; }
    },
  ];

  function buildScenarioList() {
    var el = document.getElementById('s3-scenario-list'); if (!el) return;
    el.innerHTML = '';
    SCENARIOS.forEach(function (sc) {
      var d = document.createElement('div');
      d.className = 's3-sc-card'; d.id = 's3sc-' + sc.id;
      d.innerHTML = '<div class="s3-sc-head"><span class="s3-sc-name">' + sc.name + '</span>' +
        '<span class="s3-sc-risk ' + sc.riskCls + '">' + sc.risk.toUpperCase() + '</span></div>' +
        '<div class="s3-sc-desc">' + sc.desc + '</div>' +
        '<div class="s3-sc-params">' + sc.params.map(function (p) {
          return '<span class="s3-sc-param">' + p.k + ': ' + p.v + '</span>';
        }).join('') + '</div>' +
        '<button class="s3-sc-run" data-id="' + sc.id + '">SELECT &amp; RUN</button>';
      el.appendChild(d);
    });
    el.querySelectorAll('.s3-sc-run').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        var sc = SCENARIOS.find(function (s) { return s.id === e.target.getAttribute('data-id'); });
        if (!sc) return;
        resetAll(true);
        document.querySelectorAll('.s3-sc-card').forEach(function (c) { c.classList.remove('active'); });
        var card = document.getElementById('s3sc-' + sc.id); if (card) card.classList.add('active');
        G.scenario = sc; sc.setup();
        G.contactor = true;
        syncControlsFromState();
        setBadge('running', 'RUNNING');
        log3('info', 'Scenario "' + sc.name + '" started — target ' + sc.hours.toLocaleString() + ' h.');
        startSim();
      });
    });
  }

  /* ── loop ── */
  var _raf = null, _last = null, _paused = false, _running = false;
  var TIME_STEPS = [0.1, 0.5, 1, 10, 50, 100];
  var SPEED_HOURS = [1, 5, 20, 200, 1000, 4000];  // sim-hours per real second
  var _speedIdx = 2;

  function startSim() {
    if (_running) return;
    _running = true; _paused = false; _last = null;
    var r = document.getElementById('sim-run-btn'), p = document.getElementById('sim-pause-btn');
    if (r) r.disabled = true; if (p) p.disabled = false;
    setBadge('running', 'RUNNING');
    _raf = requestAnimationFrame(loop);
  }
  function pauseSim() {
    if (!_running) return;
    _paused = !_paused; _last = null;
    var p = document.getElementById('sim-pause-btn');
    if (_paused) { setBadge('paused', 'PAUSED'); if (p) p.textContent = 'RESUME'; }
    else { setBadge('running', 'RUNNING'); if (p) p.textContent = 'PAUSE'; _raf = requestAnimationFrame(loop); }
  }
  function stopSim() {
    _running = false; _paused = false; _last = null;
    if (_raf) cancelAnimationFrame(_raf);
    _raf = null;
    var r = document.getElementById('sim-run-btn'), p = document.getElementById('sim-pause-btn');
    if (r) r.disabled = false;
    if (p) { p.disabled = true; p.textContent = 'PAUSE'; }
    setBadge('', 'STANDBY');
  }

  function resetAll(quiet) {
    stopSim();
    initLamps();
    G.f = {}; G.simHours = 0; G.scenario = null;
    G.V = P.V_MEAS; G.Tamb = P.T_AMB; G.energised = P.N; G.contactor = false;
    G.energyWh = 0; G._residAlarmed = false;
    lastChartH = -1;
    _series = { h: [], lm: [], t: [] };
    _ewma = null;
    if (_healthChart) { _healthChart.destroy(); _healthChart = null; }
    if (typeof simEngine !== 'undefined' && simEngine) {
      simEngine.hist_t = []; simEngine.hist_Tj = []; simEngine.hist_P = []; simEngine.hist_V = [];
    }
    document.querySelectorAll('.s3-sc-card').forEach(function (c) { c.classList.remove('active'); });
    document.querySelectorAll('.s3-fault-btn').forEach(function (b) { b.classList.remove('active'); });
    syncControlsFromState();
    setJumpResult('', '');
    updateKPIs(); renderModel(performance.now());
    if (typeof updateSimCharts === 'function') updateSimCharts();
    if (!quiet) log3('info', 'Reset — all ' + P.N + ' lamps restored to factory state.');
  }

  function loop(now) {
    if (!_running || _paused) return;
    var dtReal = _last ? Math.min(0.1, (now - _last) / 1000) : 0.016;
    _last = now;
    stepAll(dtReal * SPEED_HOURS[_speedIdx] * 3600);

    renderModel(now);
    updateKPIs();
    pushChart();
    pushSeries();

    var anyLive = G.lamps.some(function (l) { return !l.failed; });
    if (!anyLive) {
      stopSim();
      log3('bad', 'All ' + P.N + ' lamps failed at ' + Math.floor(G.simHours).toLocaleString() + ' h. Simulation ended.');
      return;
    }
    if (G.scenario && G.simHours >= G.scenario.hours) {
      var name = G.scenario.name;
      stopSim(); G.scenario = null;
      document.querySelectorAll('.s3-sc-card').forEach(function (c) { c.classList.remove('active'); });
      summarise('Scenario "' + name + '" complete');
      return;
    }
    _raf = requestAnimationFrame(loop);
  }

  function summarise(prefix) {
    var fc = G.lamps.filter(function (l) { return l.failed; }).length;
    var aLm = G.lamps.reduce(function (a, l) { return a + (l.failed ? 0 : l.lumens); }, 0) / P.N * 100;
    var fl = G.lamps.filter(function (l) { return !l.failed && l.flicker > 20; }).length;
    var cy = G.lamps.filter(function (l) { return l.cycles > 0; }).length;
    log3('ok', prefix + ' at ' + Math.floor(G.simHours).toLocaleString() + ' h — ' +
      fc + '/' + P.N + ' failed, ' + aLm.toFixed(1) + '% lumen output, ' +
      fl + ' flickering, ' + cy + ' thermally cycling.');
  }

  /* ── analytical time jump (sub-stepped so ageing and heating stay coupled) ── */
  function analyticalJump(hours) {
    if (hours <= 0) return;
    /* Do NOT force the contactor closed here. Silently energising the panel
       made a time-jump override the operator's own breaker state: opening the
       contactor and jumping produced a fully-lit, fully-heated panel instead
       of a cold de-energised one. A jump with the panel open is a legitimate
       request — it models the panel sitting idle — so report that instead. */
    if (!G.contactor) {
      var CHo = 25, no = Math.ceil(hours / CHo);
      for (var k = 0; k < no; k++) stepAll(Math.min(CHo, hours - k * CHo) * 3600);
      renderModel(performance.now()); updateKPIs(); pushChart();
      setJumpResult('Jumped ' + hours.toLocaleString() + ' h with the contactor OPEN — no ageing accrued.', '');
      log3('info', 'Jump +' + hours.toLocaleString() + ' h — panel de-energised, no ageing accrued.');
      return;
    }
    var CH = 25; // 25-hour chunks
    var n = Math.ceil(hours / CH);
    /* Sample the degradation series DURING the jump, not just at the end —
       otherwise a 9,000 h jump produced a single data point and the health
       chart had no curve to draw. ~120 points is plenty for the plot. */
    var every = Math.max(1, Math.floor(n / 120));
    for (var i = 0; i < n; i++) {
      stepAll(Math.min(CH, hours - i * CH) * 3600);
      if (i % every === 0) sampleSeries(true);
    }
    renderModel(performance.now()); updateKPIs(); pushChart(); sampleSeries(true); drawHealth();
    var fc = G.lamps.filter(function (l) { return l.failed; }).length;
    var aH = G.lamps.reduce(function (a, l) { return a + l.health; }, 0) / P.N * 100;
    setJumpResult('Jumped to ' + Math.floor(G.simHours).toLocaleString() + ' h — ' +
      fc + ' failed — avg health ' + aH.toFixed(1) + '%', 'ok');
    summarise('Jump +' + hours.toLocaleString() + ' h');
  }

  /* ── UI plumbing ── */
  function setBadge(cls, txt) {
    var b = document.getElementById('s3-state-badge'); if (!b) return;
    b.className = 'sim3-badge' + (cls ? ' ' + cls : ''); b.textContent = txt;
  }
  function setJumpResult(msg, cls) {
    var el = document.getElementById('s3-jump-result'); if (!el) return;
    el.textContent = msg; el.className = 's3-jump-result' + (cls ? ' ' + cls : '');
  }


  function syncControlsFromState() {
    var v = document.getElementById('sim2-volt-slider'), vv = document.getElementById('sim2-volt-val');
    if (v) { v.value = Math.round(G.V); } if (vv) vv.textContent = Math.round(G.V);
    var a = document.getElementById('sim2-ambient-slider'), av = document.getElementById('sim2-ambient-val');
    if (a) { a.value = Math.round(G.Tamb); } if (av) av.textContent = Math.round(G.Tamb);
    var n = document.getElementById('sim2-lamps-slider'), nv = document.getElementById('sim2-lamps-val');
    if (n) { n.value = G.energised; } if (nv) nv.textContent = G.energised;
    var t = document.getElementById('sim2-toggle-btn');
    if (t) {
      t.textContent = G.contactor ? 'CONTACTOR CLOSED' : 'CONTACTOR OPEN';
      t.classList.toggle('active', G.contactor);
    }
    noteRange();
  }

  function noteRange() {
    var vn = document.getElementById('sim2-volt-note');
    if (vn) {
      var out = G.V < P.V_MIN || G.V > P.V_MAX;
      vn.textContent = out ? 'OUTSIDE RATED ' + P.V_MIN + '–' + P.V_MAX + ' V' : 'Within rated ' + P.V_MIN + '–' + P.V_MAX + ' V';
      vn.className = 'sim3-slider-note' + (out ? ' out' : '');
    }
    var an = document.getElementById('sim2-ambient-note');
    if (an) {
      var ao = G.Tamb > P.T_AMB_MAX;
      an.textContent = ao ? 'ABOVE RATED MAX ' + P.T_AMB_MAX + ' °C' : 'Within rated −20…+' + P.T_AMB_MAX + ' °C';
      an.className = 'sim3-slider-note' + (ao ? ' out' : '');
    }
  }

  function initControls() {
    var run = document.getElementById('sim-run-btn');
    if (run) run.addEventListener('click', function () { G.contactor = true; syncControlsFromState(); startSim(); });
    var pause = document.getElementById('sim-pause-btn');
    if (pause) pause.addEventListener('click', pauseSim);
    var reset = document.getElementById('sim-reset-btn');
    if (reset) reset.addEventListener('click', function () { resetAll(false); });

    var t = document.getElementById('sim2-toggle-btn');
    if (t) t.addEventListener('click', function () {
      G.contactor = !G.contactor;
      syncControlsFromState();
      log3('info', G.contactor ? 'Contactor CLOSED — panel energised.' : 'Contactor OPEN — panel de-energised, cooling.');
      if (!_running) { updateKPIs(); renderModel(performance.now()); }
    });

    var v = document.getElementById('sim2-volt-slider');
    if (v) v.addEventListener('input', function () {
      G.V = Number(v.value); setTxt('sim2-volt-val', v.value); noteRange();
      if (!_running) { updateKPIs(); renderModel(performance.now()); }
    });
    var a = document.getElementById('sim2-ambient-slider');
    if (a) a.addEventListener('input', function () {
      G.Tamb = Number(a.value); setTxt('sim2-ambient-val', a.value); noteRange();
      if (!_running) updateKPIs();
    });
    var n = document.getElementById('sim2-lamps-slider');
    if (n) n.addEventListener('input', function () {
      G.energised = Number(n.value); setTxt('sim2-lamps-val', n.value);
      if (!_running) { updateKPIs(); renderModel(performance.now()); }
    });

    document.querySelectorAll('.s3-speed-pill').forEach(function (p) {
      p.addEventListener('click', function () {
        _speedIdx = parseInt(p.getAttribute('data-step') || '2', 10);
        document.querySelectorAll('.s3-speed-pill').forEach(function (x) { x.classList.remove('active'); });
        p.classList.add('active');
      });
    });

    var pick = document.getElementById('s3-lamp-pick');
    if (pick) pick.addEventListener('input', renderInspector);
    var worst = document.getElementById('s3-lamp-worst');
    if (worst) worst.addEventListener('click', function () {
      var w = G.lamps.slice().sort(function (x, y) { return x.health - y.health; })[0];
      if (w && pick) { pick.value = w.id + 1; renderInspector(); }
    });

    /* validation, export, comparison, alarms */
    var bind = function (id, fn) { var e = document.getElementById(id); if (e) e.addEventListener('click', fn); };
    bind('bt-run', runBackTest);
    bind('bt-export', exportBackTestCSV);
    bind('exp-csv', exportRunCSV);
    bind('exp-lamps', exportLampCSV);
    bind('exp-report', exportReport);

    bind('cmp-store', function () {
      if (!_series.t.length) { alarm('warn', 'COMPARE', 'Nothing to store — run a scenario first.'); return; }
      _baseline = { t: _series.t.slice(), h: _series.h.slice(), lm: _series.lm.slice(),
                    name: G.scenario ? G.scenario.name : 'manual run', hours: G.simHours };
      setTxt('cmp-note', 'Baseline: ' + _baseline.name + ' (' + Math.round(_baseline.hours).toLocaleString() + ' h)');
      alarm('info', 'COMPARE', 'Stored "' + _baseline.name + '" as the comparison baseline.');
      drawHealth();
    });
    bind('cmp-clear', function () {
      _baseline = null; setTxt('cmp-note', 'No baseline stored');
      alarm('info', 'COMPARE', 'Baseline cleared.'); drawHealth();
    });

    bind('alm-ack-all', function (e) {
      e.stopPropagation();
      _alarms.forEach(function (a) { a.ack = true; });
      renderAlarms();
    });
    var filt = document.getElementById('alm-filter');
    if (filt) filt.addEventListener('change', function () { _almFilter = filt.value; renderAlarms(); });
  }

  function initFaults() {
    function toggle(id, on, off) {
      var el = document.getElementById(id); if (!el) return;
      el.addEventListener('click', function () {
        el.classList.toggle('active');
        el.classList.contains('active') ? on() : off();
        if (!_running) { updateKPIs(); renderModel(performance.now()); }
      });
    }
    toggle('lfi-overvolt',
      function () { G.f.overvolt = true; noteRange(); log3('bad', 'Fault: overvoltage +15% injected.'); },
      function () { G.f.overvolt = false; noteRange(); log3('info', 'Overvoltage cleared.'); });
    toggle('lfi-dust',
      function () { G.f.dust = true; log3('warn', 'Fault: dust accumulation — R_th now rises with runtime.'); },
      function () { G.f.dust = false; log3('info', 'Dust fault cleared.'); });
    toggle('lfi-ambient',
      function () { G.f.ambient = 20; noteRange(); log3('warn', 'Fault: ambient +20 °C.'); },
      function () { G.f.ambient = 0; noteRange(); log3('info', 'Ambient fault cleared.'); });

    var r1 = document.getElementById('lfi-row1');
    if (r1) r1.addEventListener('click', function () {
      r1.classList.toggle('active');
      var on = r1.classList.contains('active');
      G.f.rowKill = on ? [0] : [];
      log3(on ? 'bad' : 'info', on ? 'Row 1 (L01–L08) de-energised.' : 'Row 1 restored.');
      if (!_running) { updateKPIs(); renderModel(performance.now()); }
    });

    var fr = document.getElementById('lfi-reset');
    if (fr) fr.addEventListener('click', function () {
      G.f = {};
      document.querySelectorAll('.s3-fault-btn').forEach(function (b) { b.classList.remove('active'); });
      noteRange(); log3('ok', 'All faults cleared.');
      if (!_running) { updateKPIs(); renderModel(performance.now()); }
    });
  }

  function initJump() {
    var btn = document.getElementById('s3-btn-jump'), inp = document.getElementById('s3-jump-input');
    if (btn) btn.addEventListener('click', function () {
      var h = parseInt(inp ? inp.value : '5000', 10);
      if (!isNaN(h) && h > 0) analyticalJump(h);
    });
    document.querySelectorAll('.s3-jump-preset').forEach(function (p) {
      p.addEventListener('click', function () {
        var h = parseInt(p.getAttribute('data-h'), 10);
        if (inp) inp.value = h;
        analyticalJump(h);
      });
    });
  }

  function initLog() {
    var cb = document.getElementById('log-clear-btn');
    if (cb) cb.addEventListener('click', function (e) {
      e.stopPropagation();
      var lb = document.getElementById('sim-log');
      if (lb) lb.innerHTML = '';
      _logN = 0; log3('info', 'Log cleared.');
    });
  }

  /* ═══════════════ POWER QUALITY — non-PFC driver ═══════════════
     True PF = displacement PF x distortion factor, and the distortion factor
     is 1/sqrt(1+THD^2). The measured true PF of 0.597 with a near-unity
     displacement PF therefore implies a current THD of ~132% — squarely in
     the 80-150% band reported for non-PFC residential LED lamps
     (Energies 11:3169; Applied Sciences 9:4894). IEC 61000-3-2 exempts
     lamps <= 25 W from PFC, which is why this topology is legal here. */
  function powerQuality() {
    var el = panelElectrical();
    var pf = P.PF_MEAS;
    var ratio = P.DPF / pf;
    var thd = Math.sqrt(Math.max(0, ratio * ratio - 1));       // per-unit
    var S = el.V * el.I;                                        // VA
    var Q = S * Math.sqrt(Math.max(0, 1 - P.DPF * P.DPF)) * (P.DPF / Math.max(1e-9, ratio));
    var D = Math.sqrt(Math.max(0, S * S - el.P * el.P - Q * Q));
    // fundamental RMS current, then scale the typical profile to match THD
    var I1 = el.I / Math.sqrt(1 + thd * thd);
    var base = P.HARM_PROFILE;
    var sumSq = base.reduce(function (a, h) { return a + h[1] * h[1]; }, 0);
    var k = sumSq > 0 ? thd / Math.sqrt(sumSq) : 0;
    var spectrum = base.map(function (h) {
      return { order: h[0], pct: h[1] * k * 100, amps: h[1] * k * I1, triplen: h[0] % 3 === 0 };
    });
    var crest = 1.414 * (1 + 0.85 * thd);                       // modelled
    /* parallel lamps on a shared loop impedance — sublinear, saturating */
    var Vpk = el.V * Math.SQRT2;
    var inrush = el.lit > 0 ? Vpk / (P.Z_LOOP + P.Z_LAMP_INRUSH / el.lit) : 0;
    var inrushCeiling = Vpk / P.Z_LOOP;
    return { thd: thd, pf: pf, dpf: P.DPF, S: S, Q: Q, D: D, I1: I1,
             spectrum: spectrum, crest: crest, inrush: inrush,
             inrushCeiling: inrushCeiling, el: el };
  }

  function renderPQ() {
    var q = powerQuality();
    setTxt('pq-thd', (q.thd * 100).toFixed(0) + ' %');
    setTxt('pq-pf', q.pf.toFixed(3));
    setTxt('pq-dpf', q.dpf.toFixed(2));
    setTxt('pq-cf', q.crest.toFixed(2));
    setTxt('pq-va', q.S.toFixed(0) + ' VA');
    setTxt('pq-d', q.D.toFixed(0) + ' var');
    var i3 = q.spectrum[0];
    setTxt('pq-i3', i3 ? i3.amps.toFixed(2) + ' A (' + i3.pct.toFixed(0) + '%)' : '--');
    setTxt('pq-inrush', q.inrush.toFixed(0) + ' A pk');

    var host = document.getElementById('pq-spectrum');
    if (host) {
      if (!host.dataset.built) {
        host.innerHTML = q.spectrum.map(function (h) {
          return '<div class="s3-harm-bar' + (h.triplen ? ' triplen' : '') +
            '" data-o="' + h.order + '"><span>h' + h.order + '</span></div>';
        }).join('');
        host.dataset.built = '1';
      }
      var max = Math.max.apply(null, q.spectrum.map(function (h) { return h.pct; })) || 1;
      q.spectrum.forEach(function (h) {
        var b = host.querySelector('[data-o="' + h.order + '"]');
        if (b) { b.style.height = Math.max(2, h.pct / max * 100) + '%'; b.title = 'h' + h.order + ': ' + h.pct.toFixed(1) + '% of fundamental (' + h.amps.toFixed(2) + ' A)'; }
      });
    }
    var note = document.getElementById('pq-note');
    if (note) {
      var breaker = Math.ceil(q.el.I * 1.45);
      var Vpk0 = q.el.V * Math.SQRT2;
      /* The inrush sentence was removed along with its tile: Z_loop is a
         modelled value that has not been measured on this installation, so
         quoting a peak-ampere figure would overstate what is known. The
         calculation itself remains in powerQuality() for when it is. */
      note.innerHTML = 'Displacement PF is near unity, so almost all of the ' +
        (q.pf).toFixed(3) + ' true PF is <strong>distortion</strong>, not phase shift. ' +
        'Triplen harmonics (amber) add arithmetically in the neutral if several such panels ' +
        'are spread across a three-phase board, so the neutral can carry more current than ' +
        'any single phase conductor. Sizing follows the ' + q.S.toFixed(0) +
        ' VA apparent load, not the ' + q.el.P.toFixed(0) + ' W of useful power.';
    }
  }

  /* ═══════════════ ENERGY & COST (SEC tiered tariff) ═══════════════ */
  function tariffFor(kwhMonth) { return kwhMonth > P.TIER1_KWH ? P.TARIFF2 : P.TARIFF1; }

  function renderEnergy() {
    var kwh = G.energyWh / 1000;
    var perDay = P.DUTY_H_DAY;
    var hours = Math.max(1e-6, G.simHours);
    var avgKw = kwh / hours;
    var monthKwh = avgKw * perDay * 30;
    var rate = tariffFor(monthKwh);
    var cost = kwh * rate;
    setTxt('en-kwh', kwh < 10 ? kwh.toFixed(2) + ' kWh' : Math.round(kwh).toLocaleString() + ' kWh');
    setTxt('en-sar', cost.toFixed(2) + ' SAR');
    setTxt('en-month', monthKwh.toFixed(0) + ' kWh / ' + (monthKwh * rate).toFixed(0) + ' SAR');
    setTxt('en-tier', monthKwh > P.TIER1_KWH ? 'Tier 2 (' + P.TARIFF2 + ')' : 'Tier 1 (' + P.TARIFF1 + ')');
    setTxt('en-heat', (kwh * HEAT_FRAC).toFixed(kwh < 10 ? 2 : 0) + ' kWh (' + (HEAT_FRAC * 100).toFixed(0) + '%)');
    var lit = G.lamps.filter(function (l) { return l.on; });
    var lm = lit.reduce(function (a, l) { return a + l.lumens; }, 0) * P.FLUX_ACTUAL;
    var w = panelElectrical().P;
    setTxt('en-eff', w > 1 ? (lm / w).toFixed(1) + ' lm/W' : '--');
  }

  /* ═══════════════ MAINTENANCE FORECAST ═══════════════ */
  function renderMaintenance() {
    var lit = G.lamps.filter(function (l) { return l.on && !l.failed; });
    var af = lit.length ? lit.reduce(function (a, l) { return a + arrAF(l.Tj); }, 0) / lit.length : 1;
    // hours of real running time to drive mean lumen maintenance to 0.70
    var meanLm = G.lamps.reduce(function (a, l) { return a + (l.failed ? 0 : l.lumens); }, 0) /
      Math.max(1, G.lamps.filter(function (l) { return !l.failed; }).length);
    var eqNeeded = (-Math.log(0.70) / K_LM);
    var eqNow = lit.length ? lit.reduce(function (a, l) { return a + l.eqHours; }, 0) / lit.length : 0;
    var hToL70 = af > 0 ? Math.max(0, (eqNeeded - eqNow) / af) : Infinity;
    var b10eq = P.WEIBULL_ETA * Math.pow(-Math.log(0.9), 1 / P.WEIBULL_BETA);
    var hToB10 = af > 0 ? Math.max(0, (b10eq - eqNow) / af) : Infinity;

    /* "0 h" for a threshold already crossed reads as a broken number; say so. */
    var fmt = function (h, passed) {
      if (passed) return 'passed';
      if (!isFinite(h)) return 'n/a';
      if (h <= 0) return 'passed';
      return '+' + Math.round(h).toLocaleString() + ' h';
    };
    var failedFrac = G.lamps.filter(function (l) { return l.failed; }).length / P.N;
    setTxt('mf-l70', fmt(hToL70, meanLm <= 0.70));
    setTxt('mf-b10', fmt(hToB10, failedFrac >= 0.10));
    var days = hToL70 / P.DUTY_H_DAY;
    if (isFinite(days)) {
      var d = new Date(Date.now() + days * 86400000);
      setTxt('mf-date', d.toISOString().slice(0, 10));
    } else setTxt('mf-date', 'n/a');
    var repl = G.lamps.filter(function (l) { return l.failed; }).length;
    setTxt('mf-repl', repl + ' / ' + P.N);
    setTxt('mf-cost', (repl * P.LAMP_PRICE).toFixed(2) + ' SAR');
    setTxt('mf-duty', P.DUTY_H_DAY + ' h/day');
  }

  /* ═══════════════ BACK-TEST vs RECORDED FIELD DATA ═══════════════
     Feeds each recorded sample's MEASURED voltage into the twin's electrical
     model and compares the predicted power and current against what the meter
     actually recorded. NOTE: the recorded voltage spans only 227.7-231.9 V
     (1.8%), so this validates the model AT THE OPERATING POINT; it cannot
     validate the voltage-response exponent, which is why P(V) is documented
     as a regulated-driver model rather than a fitted curve. */
  var _btChart = null, _btRows = [];

  async function runBackTest() {
    var btn = document.getElementById('bt-run');
    if (btn) { btn.disabled = true; btn.textContent = 'RUNNING...'; }
    try {
      var res = await fetch('history.json', { cache: 'no-store' });
      var data = await res.json();
      var rows = data.filter(function (r) { return r.current > 0.1; })
        .sort(function (a, b) { return a.ts - b.ts; });
      if (!rows.length) throw new Error('no energised samples');

      var errP = [], errI = [], rec = [];
      rows.forEach(function (r) {
        var vf = voltageFactors(r.voltage);
        var pPred = P.N * P.P_LAMP_MEAS * vf.pmul * vf.stress;
        var iPred = pPred / (r.voltage * P.PF_MEAS);
        errP.push(pPred - r.power);
        errI.push(iPred - r.current);
        rec.push({ ts: r.ts, vMeas: r.voltage, pMeas: r.power, pPred: pPred, iMeas: r.current, iPred: iPred });
      });
      _btRows = rec;

      var n = errP.length;
      var abs = errP.map(Math.abs);
      var mae = abs.reduce(function (a, b) { return a + b; }, 0) / n;
      var rmse = Math.sqrt(errP.reduce(function (a, b) { return a + b * b; }, 0) / n);
      var bias = errP.reduce(function (a, b) { return a + b; }, 0) / n;
      var mape = rec.reduce(function (a, r) { return a + Math.abs(r.pPred - r.pMeas) / r.pMeas; }, 0) / n * 100;
      var maei = errI.map(Math.abs).reduce(function (a, b) { return a + b; }, 0) / n;
      var cov = rec.filter(function (r) { return Math.abs(r.pPred - r.pMeas) / r.pMeas <= 0.02; }).length / n * 100;

      setTxt('bt-n', n.toLocaleString());
      setTxt('bt-mae', mae.toFixed(2) + ' W');
      setTxt('bt-rmse', rmse.toFixed(2) + ' W');
      setTxt('bt-mape', mape.toFixed(2) + ' %');
      setTxt('bt-bias', (bias >= 0 ? '+' : '') + bias.toFixed(2) + ' W');
      setTxt('bt-maei', maei.toFixed(3) + ' A');
      setTxt('bt-cov', cov.toFixed(1) + ' %');
      var vEl = document.getElementById('bt-verdict');
      if (vEl) {
        var good = mape < 2.5;
        vEl.textContent = good ? 'VALIDATED' : (mape < 6 ? 'ACCEPTABLE' : 'POOR FIT');
        vEl.className = 's3-ins-v ' + (good ? 'ok' : mape < 6 ? 'warn' : 'bad');
      }
      drawBackTest(rec);
      alarm(mape < 2.5 ? 'ok' : 'warn', 'MODEL',
        'Back-test over ' + n.toLocaleString() + ' recorded samples: MAPE ' + mape.toFixed(2) +
        ' %, MAE ' + mae.toFixed(2) + ' W, bias ' + bias.toFixed(2) + ' W.');
    } catch (e) {
      alarm('warn', 'MODEL', 'Back-test failed: ' + e.message);
      setTxt('bt-verdict', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'RUN BACK-TEST'; }
    }
  }

  function drawBackTest(rec) {
    var cv = document.getElementById('chart-backtest');
    if (!cv || typeof Chart === 'undefined') return;
    var step = Math.max(1, Math.floor(rec.length / 400));
    var s = rec.filter(function (_, i) { return i % step === 0; });
    var labels = s.map(function (r) { return new Date(r.ts * 1000).toISOString().slice(5, 16).replace('T', ' '); });
    if (_btChart) _btChart.destroy();
    _btChart = new Chart(cv.getContext('2d'), {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          { label: 'Measured power (W)', data: s.map(function (r) { return r.pMeas; }), borderColor: '#006C6B', borderWidth: 2, pointRadius: 0, tension: 0.25 },
          { label: 'Twin prediction (W)', data: s.map(function (r) { return r.pPred; }), borderColor: '#B42318', borderWidth: 1.6, borderDash: [5, 4], pointRadius: 0, tension: 0.25 },
          { label: 'Residual (W)', data: s.map(function (r) { return r.pPred - r.pMeas; }), borderColor: '#94A3B8', borderWidth: 1, pointRadius: 0, yAxisID: 'y1', tension: 0.25 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 0 },
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: true, labels: { boxWidth: 12, font: { size: 10 } } } },
        scales: {
          x: { ticks: { maxTicksLimit: 8, font: { size: 9 } }, grid: { color: 'rgba(217,224,231,.6)' } },
          y: { title: { display: true, text: 'Power (W)', font: { size: 10 } }, grid: { color: 'rgba(217,224,231,.6)' }, ticks: { font: { size: 10 } } },
          y1: { position: 'right', title: { display: true, text: 'Residual (W)', font: { size: 10 } }, grid: { drawOnChartArea: false }, ticks: { font: { size: 10 } } },
        }
      }
    });
  }

  /* ═══════════════ LIVE RESIDUAL MONITOR ═══════════════
     Diffs the physical panel's live telemetry against what the twin predicts
     for the same supply voltage. A persistent, growing residual is the twin's
     primary fault signal — it is what distinguishes a twin from a simulator. */
  var _ewma = null, EWMA_A = 0.15;

  function renderResidual() {
    var live = (typeof store !== 'undefined' && store && store.live) ? store.live : null;
    var pill = document.getElementById('res-status');
    var haveLive = live && typeof live.power === 'number' && !isNaN(live.power) &&
      typeof live.voltage === 'number' && live.voltage > 50;
    if (!haveLive) {
      setTxt('res-meas', '--'); setTxt('res-pred', '--');
      setTxt('res-delta', '--'); setTxt('res-ewma', '--');
      if (pill) { pill.textContent = 'NO LIVE DATA'; pill.className = 's3-resid-pill'; }
      return;
    }
    var vf = voltageFactors(live.voltage);
    var pred = P.N * P.P_LAMP_MEAS * vf.pmul * vf.stress;
    if (live.power < 5) pred = 0;                       // panel de-energised
    var d = live.power - pred;
    _ewma = _ewma === null ? d : EWMA_A * d + (1 - EWMA_A) * _ewma;
    var absW = Math.abs(_ewma);
    var pct = pred > 1 ? absW / pred * 100 : 0;
    setTxt('res-meas', live.power.toFixed(1) + ' W @ ' + live.voltage.toFixed(1) + ' V');
    setTxt('res-pred', pred.toFixed(1) + ' W');
    setTxt('res-delta', (d >= 0 ? '+' : '') + d.toFixed(1) + ' W');
    setTxt('res-ewma', (_ewma >= 0 ? '+' : '') + _ewma.toFixed(1) + ' W (' +
      (absW / P.P_LAMP_MEAS).toFixed(1) + ' lamps, alarm at ' + P.RESID_FAULT_W + ' W)');
    if (pill) {
      var st = absW < P.RESID_DRIFT_W ? ['NOMINAL', 'ok']
             : absW < P.RESID_FAULT_W ? ['DRIFT', 'warn']
             : ['FAULT SUSPECTED', 'bad'];
      pill.textContent = st[0];
      pill.className = 's3-resid-pill ' + st[1];
      if (st[1] === 'bad' && !G._residAlarmed) {
        G._residAlarmed = true;
        alarm('crit', 'RESIDUAL', 'Twin/plant residual ' + _ewma.toFixed(1) + ' W (' + pct.toFixed(1) +
          ' %) exceeds the ' + P.RESID_FAULT_W + ' W limit, about ' +
          (absW / P.P_LAMP_MEAS).toFixed(1) + ' lamps — investigate for lamp loss or metering fault.');
      }
      if (st[1] !== 'bad') G._residAlarmed = false;
    }
  }

  /* ═══════════════ ALARMS (ISA-101 style) ═══════════════ */
  var _alarms = [], _almId = 0, _almFilter = 'all';
  var SEV = { bad: 'crit', crit: 'crit', warn: 'warn', ok: 'ok', info: 'info' };

  function alarm(type, src, msg) {
    var sev = SEV[type] || 'info';
    _alarms.push({
      id: ++_almId, hours: G.simHours, sev: sev, src: src || 'SIM', msg: msg,
      ack: (sev === 'info' || sev === 'ok')      // events self-acknowledge
    });
    if (_alarms.length > 400) _alarms.splice(0, 150);
    renderAlarms();
  }
  function log3(type, msg) { alarm(type, 'SIM', msg); }   // legacy call sites

  function almTime(h) {
    var d = Math.floor(h / 24), hr = Math.floor(h % 24), mn = Math.floor((h * 60) % 60);
    return d > 0 ? (d + 'd ' + pad(hr) + ':' + pad(mn)) : (pad(hr) + ':' + pad(mn));
  }

  function renderAlarms() {
    var body = document.getElementById('sim-log');
    if (!body) return;
    var list = _alarms.filter(function (a) {
      if (_almFilter === 'unack') return !a.ack;
      if (_almFilter === 'crit') return a.sev === 'crit';
      if (_almFilter === 'warn') return a.sev === 'warn';
      return true;
    }).slice(-200).reverse();

    body.innerHTML = list.map(function (a) {
      return '<div class="log-entry ' + a.sev + (a.ack ? '' : ' unack') + '">' +
        '<span class="log-ts">' + almTime(a.hours) + '</span>' +
        '<span class="alm-sev ' + a.sev + '">' + a.sev.toUpperCase() + '</span>' +
        '<span class="alm-src">' + a.src + '</span>' +
        '<span class="log-msg">' + a.msg + '</span>' +
        (a.ack ? '<span class="alm-state ackd">ACK</span>'
               : '<button class="alm-ack-btn" data-ack="' + a.id + '">ACK</button>') +
        '</div>';
    }).join('');

    body.querySelectorAll('[data-ack]').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = _alarms.find(function (x) { return x.id === Number(b.getAttribute('data-ack')); });
        if (a) { a.ack = true; renderAlarms(); }
      });
    });

    var nc = _alarms.filter(function (a) { return !a.ack && a.sev === 'crit'; }).length;
    var nw = _alarms.filter(function (a) { return !a.ack && a.sev === 'warn'; }).length;
    var ec = document.getElementById('alm-n-crit'), ew = document.getElementById('alm-n-warn');
    if (ec) { ec.textContent = nc; ec.className = 's3-alm-c ' + (nc ? 'crit' : 'zero'); }
    if (ew) { ew.textContent = nw; ew.className = 's3-alm-c ' + (nw ? 'warn' : 'zero'); }
  }

  /* ═══════════════ HEALTH / LUMEN CHART + BASELINE OVERLAY ═══════════════ */
  var _healthChart = null, _series = { h: [], lm: [], t: [] }, _baseline = null;

  /* force=true appends unconditionally (used while stepping through a jump);
     otherwise the sample is rate-limited for the real-time loop. */
  function sampleSeries(force) {
    var h = G.lamps.reduce(function (a, l) { return a + l.health; }, 0) / P.N * 100;
    var lm = G.lamps.reduce(function (a, l) { return a + (l.failed ? 0 : l.lumens); }, 0) / P.N * 100;
    var last = _series.t[_series.t.length - 1];
    if (!force && last !== undefined && G.simHours - last < Math.max(1, G.simHours * 0.002)) return;
    if (last !== undefined && G.simHours === last) return;
    _series.t.push(G.simHours); _series.h.push(h); _series.lm.push(lm);
    if (_series.t.length > 400) { _series.t.shift(); _series.h.shift(); _series.lm.shift(); }
  }

  function pushSeries() { sampleSeries(false); drawHealth(); }

  function drawHealth() {
    var cv = document.getElementById('chart-health');
    if (!cv || typeof Chart === 'undefined') return;
    var labels = _series.t.map(function (v) { return Math.round(v); });
    var ds = [
      { label: 'Panel health %', data: _series.h, borderColor: '#22c55e', borderWidth: 2, pointRadius: 0, tension: 0.25 },
      { label: 'Lumen maintenance %', data: _series.lm, borderColor: '#f59e0b', borderWidth: 2, pointRadius: 0, tension: 0.25 },
      { label: 'L70 threshold', data: labels.map(function () { return 70; }), borderColor: 'rgba(180,35,24,.55)', borderWidth: 1.2, borderDash: [6, 4], pointRadius: 0 },
    ];
    if (_baseline) {
      ds.push({ label: 'Baseline health %', data: _baseline.h, borderColor: 'rgba(34,197,94,.45)', borderWidth: 1.4, borderDash: [4, 3], pointRadius: 0 });
      ds.push({ label: 'Baseline lumen %', data: _baseline.lm, borderColor: 'rgba(245,158,11,.45)', borderWidth: 1.4, borderDash: [4, 3], pointRadius: 0 });
    }
    if (!_healthChart) {
      _healthChart = new Chart(cv.getContext('2d'), {
        type: 'line', data: { labels: labels, datasets: ds },
        options: {
          responsive: true, maintainAspectRatio: false, animation: { duration: 0 },
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { display: true, labels: { boxWidth: 11, font: { size: 9 } } } },
          scales: {
            x: { title: { display: true, text: 'Operating hours', font: { size: 10 } }, ticks: { maxTicksLimit: 7, font: { size: 9 } }, grid: { color: 'rgba(217,224,231,.6)' } },
            y: { min: 0, max: 105, ticks: { font: { size: 10 }, callback: function (v) { return v + '%'; } }, grid: { color: 'rgba(217,224,231,.6)' } },
          }
        }
      });
    } else {
      _healthChart.data.labels = labels;
      _healthChart.data.datasets = ds;
      _healthChart.update('none');
    }
  }

  /* ═══════════════ EXPORT ═══════════════ */
  function download(name, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 0);
    alarm('info', 'EXPORT', 'Wrote ' + name);
  }

  function exportRunCSV() {
    var rows = [['hours', 'panel_health_pct', 'lumen_maintenance_pct']];
    for (var i = 0; i < _series.t.length; i++)
      rows.push([_series.t[i].toFixed(2), _series.h[i].toFixed(3), _series.lm[i].toFixed(3)]);
    download('sim_run_' + Math.round(G.simHours) + 'h.csv', rows.map(function (r) { return r.join(','); }).join('\n'));
  }

  function exportLampCSV() {
    var head = ['lamp', 'row', 'col', 'state', 'fail_mode', 'health_pct', 'lumen_pct', 'Tj_C',
      'hours_run', 'eq_hours', 'AF', 'flicker_pct', 'cycles', 'Rth_CperW', 'local_ambient_offset_C'];
    var rows = [head].concat(G.lamps.map(function (l) {
      return [l.id + 1, l.row + 1, l.col + 1,
        l.failed ? 'FAILED' : l.foldback ? 'FOLDBACK' : l.on ? 'ON' : 'OFF',
        l.failMode, (l.health * 100).toFixed(2), (l.lumens * 100).toFixed(2), l.Tj.toFixed(2),
        l.hoursRun.toFixed(1), l.eqHours.toFixed(1), arrAF(l.Tj).toFixed(3),
        l.flicker.toFixed(1), l.cycles, l.Rth.toFixed(3), l.dTamb.toFixed(2)];
    }));
    download('lamp_table_' + Math.round(G.simHours) + 'h.csv', rows.map(function (r) { return r.join(','); }).join('\n'));
  }

  function exportReport() {
    var q = powerQuality();
    var fc = G.lamps.filter(function (l) { return l.failed; }).length;
    var lm = G.lamps.reduce(function (a, l) { return a + (l.failed ? 0 : l.lumens); }, 0) / P.N * 100;
    var lines = [
      'NB2 LAMPS PANEL - DIGITAL TWIN SIMULATION REPORT',
      'Generated: ' + new Date().toISOString(),
      '',
      '--- CONFIGURATION ---',
      'Lamps                 : ' + P.N + ' (' + P.COLS + ' x ' + P.ROWS + ')',
      'Lamp                  : Philips Essential LEDbulb 11 W E27 ' + LED_CCT_K + ' K (929002299709)',
      'Rated / measured power: ' + P.P_LAMP_RATED + ' W nameplate, ' + P.P_LAMP_MEAS + ' W measured per lamp',
      'Supply                : ' + P.V_MEAS + ' V measured, rated window ' + P.V_MIN + '-' + P.V_MAX + ' V',
      'Datasheet L70         : ' + P.L70_H.toLocaleString() + ' h, T-case max ' + P.T_CASE_MAX + ' C, ambient max ' + P.T_AMB_MAX + ' C',
      '',
      '--- RUN STATE ---',
      'Simulated hours       : ' + Math.round(G.simHours).toLocaleString(),
      'Scenario              : ' + (G.scenario ? G.scenario.name : 'manual'),
      'Supply voltage        : ' + G.V.toFixed(1) + ' V',
      'Ambient               : ' + G.Tamb.toFixed(1) + ' C' + (G.Tamb > P.T_AMB_MAX ? '  [ABOVE RATED MAX]' : ''),
      'Lamps energised       : ' + G.energised + ' / ' + P.N,
      '',
      '--- RESULTS ---',
      'Failed lamps          : ' + fc + ' / ' + P.N,
      'Lumen maintenance     : ' + lm.toFixed(1) + ' %' + (lm <= 70 ? '  [AT OR BELOW L70]' : ''),
      'Energy consumed       : ' + (G.energyWh / 1000).toFixed(2) + ' kWh',
      'Lamps replaced (cost) : ' + fc + ' (' + (fc * P.LAMP_PRICE).toFixed(2) + ' SAR)',
      '',
      '--- POWER QUALITY ---',
      'Active power          : ' + q.el.P.toFixed(1) + ' W',
      'Apparent power        : ' + q.S.toFixed(1) + ' VA',
      'True power factor     : ' + q.pf.toFixed(3) + ' (displacement ' + q.dpf.toFixed(2) + ')',
      'Current THD           : ' + (q.thd * 100).toFixed(0) + ' %',
      'Crest factor          : ' + q.crest.toFixed(2),
      'Inrush (modelled)     : ' + q.inrush.toFixed(0) + ' A peak',
      '',
      '--- PROVENANCE ---',
      'MEASURED  : V, I, P, PF, per-lamp W  (history.json, 1,310 energised readings)',
      'DATASHEET : flux, L70, T-case, ambient range, voltage window, CCT',
      'MODELLED  : Rth, tau, Ea, Weibull, capacitor wear, inrush, harmonic profile',
      '            This panel has no thermal or photometric sensor, so every',
      '            MODELLED quantity is an assumption and cannot be validated',
      '            against this hardware.',
    ];
    download('twin_report_' + Math.round(G.simHours) + 'h.txt', lines.join('\n'), 'text/plain;charset=utf-8');
  }

  function exportBackTestCSV() {
    if (!_btRows.length) { alarm('warn', 'EXPORT', 'Run the back-test first.'); return; }
    var rows = [['timestamp', 'iso', 'v_measured', 'p_measured_W', 'p_predicted_W', 'residual_W', 'i_measured_A', 'i_predicted_A']];
    _btRows.forEach(function (r) {
      rows.push([r.ts, new Date(r.ts * 1000).toISOString(), r.vMeas.toFixed(2), r.pMeas.toFixed(2),
        r.pPred.toFixed(2), (r.pPred - r.pMeas).toFixed(2), r.iMeas.toFixed(4), r.iPred.toFixed(4)]);
    });
    download('backtest.csv', rows.map(function (r) { return r.join(','); }).join('\n'));
  }

  /* ═══════════════ CLICK-TO-SELECT A LAMP ON THE 3D MODEL ═══════════════
     Uses materialFromPoint(), which returns the material actually under the
     cursor, so the lamp number is read straight from "MAT_LAMP_nn_BULB".

     Two bugs made the first attempt silently do nothing:
       1. positionAndNormalFromPoint() takes ABSOLUTE client coordinates, but
          it was being handed element-relative ones (clientX - rect.left), so
          every probe fell outside the model and returned null.
       2. Even when it did hit, it returned whatever surface was in front —
          usually the perforated sheet or the frame — and the code then mapped
          that point onto a lamp grid regardless, so clicking the frame would
          "select" a lamp that was never clicked.
     Reading the material removes the geometry maths entirely: a click on the
     frame or a holder now correctly selects nothing. */
  function lampFromEvent(ev) {
    if (!viewer || !viewer.materialFromPoint) return null;
    var m = viewer.materialFromPoint(ev.clientX, ev.clientY);
    if (!m || !m.name) return null;
    var hit = /^MAT_LAMP_(\d+)_BULB$/.exec(m.name.toUpperCase());
    if (!hit) return null;
    var n = Number(hit[1]);
    return (n >= 1 && n <= P.N) ? n : null;
  }

  function selectLamp(n) {
    var pick = document.getElementById('s3-lamp-pick');
    if (!pick || !n) return false;
    pick.value = n;
    renderInspector();
    var card = document.querySelector('.s3-inspect');
    if (card) {
      card.classList.add('picked');
      setTimeout(function () { card.classList.remove('picked'); }, 600);
    }
    return true;
  }

  function initPicking() {
    if (!viewer) return;
    viewer.addEventListener('click', function (ev) {
      var n = lampFromEvent(ev);
      if (n) selectLamp(n);
    });
    /* hover feedback so it is discoverable that lamps are clickable */
    viewer.addEventListener('mousemove', function (ev) {
      viewer.style.cursor = lampFromEvent(ev) ? 'pointer' : '';
    });
    viewer.addEventListener('mouseleave', function () { viewer.style.cursor = ''; });
  }

  /* ── boot ── */
  function boot() {
    viewer = document.getElementById('sim-model');
    initLamps();
    buildScenarioList();
    initControls(); initFaults(); initJump(); initLog();
    syncControlsFromState();
    updateKPIs();

    if (viewer) {
      var onLoad = function () {
        if (typeof initViewerLamps === 'function') initViewerLamps(viewer);
        var n = typeof getBulbCount === 'function' ? getBulbCount(viewer) : 0;
        if (n && n !== P.N) {
          log3('warn', 'Model exposes ' + n + ' addressable bulbs but the panel is configured for ' + P.N + '.');
        }
        renderModel(performance.now());
      };
      if (viewer.model) onLoad();
      viewer.addEventListener('load', onLoad);
      initPicking();
    }

    drawHealth();
    /* keep the residual monitor live even while the simulation is stopped —
       it compares the physical panel's telemetry against the twin, which is
       meaningful whether or not a scenario is running */
    setInterval(function () { if (!_running) renderResidual(); }, 2000);

    log3('info', 'Engine ready — ' + P.N + ' × Philips 11 W E27 ' + LED_CCT_K + ' K · measured ' +
      P.P_LAMP_MEAS + ' W/lamp @ ' + P.V_MEAS + ' V · L70 ' + P.L70_H.toLocaleString() +
      ' h · T-case ' + P.T_CASE_MAX + ' °C.');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // expose for debugging
  window.SIM3 = { G: G, P: P, reset: resetAll, jump: analyticalJump, scenarios: SCENARIOS };
})();
