/* Lamp Panel: the phone app.
 *
 * Same data as the dashboard (script.js):
 *   live      MQTT over WebSocket (brokers from /api/mqtt-config), with
 *             /api/data polling until MQTT delivers and whenever it drops;
 *   records   /api/real_analytics?month=all|YYYY-MM (weekly uploads from the lab PC);
 *   control   POST /api/control {command} (Cloudflare Access protects it).
 * Inside the Android app the page also talks to the shell through
 * window.LampPanelApp (tab changes) and gets haptic taps.
 */
"use strict";

const $ = id => document.getElementById(id);
const API = location.origin;
const RATED_W = 440;                 // 40 lamps x 11 W
const ON_AMPS = 0.5;                 // same threshold as the dashboard's 3D model
const POLL_MS = 5000;
const MQTT_RETRY_MS = 10000;
const MQTT_SILENCE_MS = 60000;
const SERIES_MAX_POINTS = 900;       // ~15 min at 1 Hz
const CAMERA_URL = "https://panel-cam.83838737rufhfhfucjfjdi8fi39.shop/stream.html?src=panel_cam&media=video";
const STALE_UPLOAD_DAYS = 9.5;

const bridge = window.LampPanelApp || null;
const appVersion = (navigator.userAgent.match(/LampPanelApp\/([\w.]+)/) || [])[1];

function haptic() {
  if (appVersion && navigator.vibrate) navigator.vibrate(8);
}

let toastTimer = null;
function toast(text) {
  const t = $("toast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

const fmtDate = (iso, opts) => new Date(iso).toLocaleDateString("en-GB", opts || { day: "numeric", month: "short" }).replace(/\bSept\b/g, "Sep");
// en-GB writes September as "Sept"; keep the usual three letters.
const sep = s => s.replace(/\bSept\b/g, "Sep");
const monthName = (m, style) => {
  const [y, mo] = m.split("-").map(Number);
  return sep(new Date(y, mo - 1, 1).toLocaleDateString("en-GB", { month: style || "long", year: "numeric" }));
};
const n = (v, d) => (v == null || isNaN(v)) ? "--" : Number(v).toFixed(d);

/* ═══════════════════════════ navigation ═══════════════════════════ */

const ROUTES = ["live", "records", "simulate", "control"];
const TITLES = { live: "Lamp Panel", records: "Field data", simulate: "Simulate", control: "Control" };
let route = null;

function go(next) {
  if (!ROUTES.includes(next)) next = "live";
  if (next === route) return;
  route = next;
  document.querySelectorAll(".screen").forEach(s => s.classList.toggle("active", s.id === "screen-" + next));
  document.querySelectorAll(".tab").forEach(t => {
    const on = t.dataset.route === next;
    t.classList.toggle("active", on);
    t.setAttribute("aria-selected", on);
  });
  $("screen-title").textContent = TITLES[next];
  history.replaceState(null, "", "#" + next);   // tabs are not history entries
  window.scrollTo(0, 0);
  if (bridge && bridge.onTab) bridge.onTab(next);
  if (next === "records") loadRecords();
  if (next === "control") wakeControl(); else sleepControl();
  simVisible(next === "simulate");
}
window.lampApp = { go };

document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => { haptic(); go(t.dataset.route); }));
$("month-card").addEventListener("click", () => { haptic(); go("records"); });

/* ═══════════════════════════ live data ═══════════════════════════ */

const live = { data: null, at: 0, series: [], mqtt: false, client: null, brokers: [], broker: 0,
               pollTimer: null, pollFails: 0, silence: null };

function setConn(state) {
  const el = $("conn");
  el.dataset.state = state;
  $("conn-text").textContent = { connecting: "Connecting", live: "Live", polling: "Online", offline: "Offline" }[state];
}

function nb2Label(raw) {
  const s = String(raw || "").toUpperCase();
  if (s === "ON") return "OPEN";
  if (s === "OFF") return "CLOSED";
  return s || "--";
}

let shown = { power: 0 };
function tween(el, from, to, digits) {
  const start = performance.now(), dur = 600;
  function step(now) {
    const k = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = (from + (to - from) * e).toFixed(digits);
    if (k < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function apply(d, cached) {
  const power = Number(d.power) || 0;
  const current = Number(d.current) || 0;
  const voltage = Number(d.voltage) || 0;
  const online = String(d.status || "").toUpperCase() === "ONLINE" || String(d.status || "").toUpperCase().startsWith("CMD");
  const on = online && current > ON_AMPS;
  const pf = current > 0.1 && voltage > 0 ? Math.min(1, power / (voltage * current)) : null;

  live.data = d;
  live.at = cached ? live.at : Date.now();
  if (!cached) {
    try { localStorage.setItem("lp_app_last", JSON.stringify({ d, at: live.at })); } catch (_) {}
  }

  const hero = $("hero");
  hero.dataset.on = on;
  hero.dataset.online = online;
  $("hero-state").textContent = !online ? "Panel offline" : on ? "Lamps on" : "Lamps off";

  tween($("v-power"), shown.power, power, power >= 100 ? 0 : 1);
  shown.power = power;
  const frac = Math.max(0, Math.min(1, power / RATED_W));
  $("ring-fill").style.strokeDashoffset = String(578.05 * (1 - frac));
  $("ring-sub").textContent = on ? `${Math.round(frac * 100)}% of ${RATED_W} W rated` : `of ${RATED_W} W rated`;

  $("v-voltage").textContent = n(voltage, 1);
  $("v-current").textContent = n(current, 2);
  $("v-pf").textContent = pf == null ? "--" : pf.toFixed(2);
  const nb2 = nb2Label(d.nb2_status), nb2El = $("v-nb2");
  nb2El.textContent = nb2;
  nb2El.classList.toggle("is-open", nb2 === "OPEN");
  nb2El.classList.toggle("is-closed", nb2 === "CLOSED");

  if (!cached) {
    live.series.push({ t: live.at, p: power });
    if (live.series.length > SERIES_MAX_POINTS) live.series.shift();
    drawSpark();
  }
  updateTwin();
  tickUpdated();
}

function tickUpdated() {
  const el = $("updated");
  if (!live.at) { el.textContent = "No data yet"; return; }
  const s = Math.round((Date.now() - live.at) / 1000);
  el.textContent = s < 5 ? "Updated just now" : s < 60 ? `Updated ${s} s ago`
                 : s < 3600 ? `Updated ${Math.round(s / 60)} min ago` : `Updated ${fmtDate(live.at)}`;
}
setInterval(tickUpdated, 1000);

let sparkQueued = false;
function drawSpark() {
  if (sparkQueued) return;
  sparkQueued = true;
  requestAnimationFrame(() => {
    sparkQueued = false;
    const pts = live.series;
    if (pts.length < 2) return;
    const W = 320, H = 96, pad = 6;
    const t0 = pts[0].t, t1 = pts[pts.length - 1].t || t0 + 1;
    const peak = Math.max(...pts.map(p => p.p));
    const top = Math.max(50, peak * 1.15);
    const x = t => ((t - t0) / Math.max(1, t1 - t0)) * W;
    const y = p => H - pad - (p / top) * (H - 2 * pad);
    let line = "";
    pts.forEach((p, i) => { line += (i ? "L" : "M") + x(p.t).toFixed(1) + "," + y(p.p).toFixed(1); });
    $("spark-line").setAttribute("d", line);
    $("spark-area").setAttribute("d", line + `L${W},${H}L0,${H}Z`);
    const mins = Math.max(1, Math.round((t1 - t0) / 60000));
    $("spark-span").textContent = mins < 2 ? "last minute" : `last ${mins} min`;
    $("spark-from").textContent = new Date(t0).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    $("spark-peak").textContent = `peak ${Math.round(peak)} W`;
  });
}

/* HTTP polling: the first data and the fallback while MQTT is down. */
async function pollOnce() {
  try {
    const res = await fetch(API + "/api/data", { cache: "no-store" });
    const d = await res.json();
    live.pollFails = 0;
    if (!live.mqtt) setConn("polling");
    apply(d);
  } catch (_) {
    if (++live.pollFails >= 3 && !live.mqtt) setConn("offline");
  }
}
function startPolling() {
  if (live.pollTimer) return;
  pollOnce();
  live.pollTimer = setInterval(pollOnce, POLL_MS);
}
function stopPolling() {
  clearInterval(live.pollTimer);
  live.pollTimer = null;
}

function connectMqtt() {
  if (!window.mqtt || !live.brokers.length) { startPolling(); return; }
  const b = live.brokers[live.broker % live.brokers.length];
  const client = mqtt.connect(`wss://${b.host}:${b.port}/mqtt`, {
    username: b.user, password: b.pass,
    clientId: "dt_app_" + Math.random().toString(16).slice(2, 10),
    clean: true, reconnectPeriod: 0, connectTimeout: 8000, keepalive: 30,
  });
  live.client = client;
  startPolling();                       // keep data flowing until MQTT proves itself

  const fail = () => {
    if (live.client !== client) return; // already handled
    live.client = null;
    live.mqtt = false;
    clearTimeout(live.silence);
    try { client.end(true); } catch (_) {}
    live.broker++;
    startPolling();
    setTimeout(connectMqtt, MQTT_RETRY_MS);
  };
  const armSilence = () => {
    clearTimeout(live.silence);
    live.silence = setTimeout(fail, MQTT_SILENCE_MS);
  };

  client.on("connect", () => client.subscribe(b.topic, { qos: 1 }, err => { if (err) fail(); }));
  client.on("message", (_t, payload) => {
    let d;
    try { d = JSON.parse(payload.toString()); } catch (_) { return; }
    if (!live.mqtt) { live.mqtt = true; stopPolling(); setConn("live"); }
    armSilence();
    apply(d);
  });
  client.on("error", fail);
  client.on("close", fail);
  armSilence();
}

async function startLive() {
  try {
    const saved = JSON.parse(localStorage.getItem("lp_app_last") || "null");
    if (saved && saved.d) { live.at = saved.at; apply(saved.d, true); }
  } catch (_) {}
  try {
    const cfg = await (await fetch(API + "/api/mqtt-config")).json();
    if (cfg.ok && Array.isArray(cfg.brokers)) live.brokers = cfg.brokers.filter(b => b.host && !b.host.startsWith("YOUR_"));
  } catch (_) {}
  connectMqtt();
}

/* ═══════════════════════════ this month (live screen) ═══════════════════════════ */

const records = { cache: {}, months: [], period: "all", chart: null };

async function fetchAnalytics(period) {
  if (records.cache[period]) return records.cache[period];
  const res = await fetch(API + "/api/real_analytics?month=" + encodeURIComponent(period));
  const d = await res.json();
  if (!d.ok) throw new Error(d.error || "unavailable");
  records.cache[period] = d;
  return d;
}

function uploadAgeDays(d) {
  return d.updated_at ? (Date.now() - new Date(d.updated_at).getTime()) / 86400000 : null;
}

async function loadMonthCard() {
  try {
    const all = await fetchAnalytics("all");
    records.months = all.months || [];
    const latest = records.months[records.months.length - 1];
    const d = latest ? await fetchAnalytics(latest) : all;
    const s = d.summary;
    $("month-title").textContent = d.complete === false ? `${monthName(d.month, "long").split(" ")[0]} so far` : monthName(d.month);
    $("m-energy").textContent = n(s.total_energy_kwh, 1);
    $("m-run").textContent = n(s.total_run_hours, 0);
    $("m-days").textContent = `${s.total_days}/${s.period_days || s.days_in_month}`;
    const age = uploadAgeDays(d);
    const foot = $("m-foot");
    foot.textContent = `Through ${fmtDate(d.data_through + "T00:00:00")} · uploaded ${d.updated_at ? fmtDate(d.updated_at) : "--"}`;
    foot.classList.toggle("stale", age != null && age > STALE_UPLOAD_DAYS);
    if (age != null && age > STALE_UPLOAD_DAYS) foot.textContent = "⚠ Weekly upload overdue · " + foot.textContent;
    buildChips();
  } catch (_) {
    $("m-foot").textContent = "Field data unavailable right now.";
  }
}

/* ═══════════════════════════ field data screen ═══════════════════════════ */

function buildChips() {
  const box = $("period-chips");
  const want = ["all", ...records.months.slice().reverse()];
  if (box.dataset.k === want.join()) return;
  box.dataset.k = want.join();
  box.innerHTML = "";
  want.forEach(p => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "period" + (p === records.period ? " active" : "");
    b.dataset.period = p;
    b.setAttribute("role", "tab");
    b.textContent = p === "all" ? "All months" : monthName(p, "short");
    b.addEventListener("click", () => {
      haptic();
      records.period = p;
      box.querySelectorAll(".period").forEach(x => x.classList.toggle("active", x === b));
      loadRecords();
    });
    box.appendChild(b);
  });
}

async function loadRecords() {
  let d;
  try {
    d = await fetchAnalytics(records.period);
  } catch (_) {
    $("r-note").textContent = "Field data is unavailable right now. Pull down to try again.";
    return;
  }
  if (!records.months.length) { records.months = d.months || []; buildChips(); }
  const s = d.summary;
  $("r-energy").textContent = n(s.total_energy_kwh, 1);
  $("r-run").textContent = n(s.total_run_hours, 1);
  $("r-uptime").textContent = n(s.uptime_percentage, 1);
  $("r-pf").textContent = s.avg_power_factor == null ? "--" : n(s.avg_power_factor, 2);
  $("r-days").textContent = `${s.total_days} of ${s.period_days || s.days_in_month}`;
  $("r-readings").textContent = Number(s.total_readings || 0).toLocaleString("en-US");
  $("r-avgp").textContent = s.avg_running_power ? `${Math.round(s.avg_running_power)} W` : "--";
  $("r-through").textContent = fmtDate(d.data_through + "T00:00:00", { day: "numeric", month: "short", year: "numeric" });
  $("r-updated").textContent = d.updated_at ? fmtDate(d.updated_at, { day: "numeric", month: "short", year: "numeric" }) : "--";
  const age = uploadAgeDays(d), note = $("r-note");
  const stale = age != null && age > STALE_UPLOAD_DAYS;
  note.classList.toggle("stale", stale);
  note.textContent = stale ? "⚠ The weekly upload from the lab PC is overdue."
                           : "Uploaded weekly from the lab PC (every Tuesday), validated before publishing.";
  drawDays(d);
}

function drawDays(d) {
  if (!window.Chart) { setTimeout(() => drawDays(d), 300); return; }
  const isAll = d.month === "all";
  const days = d.daily;
  const labels = days.map(r => {
    const dt = new Date(r.day + "T00:00:00");
    return isAll ? fmtDate(dt) : String(dt.getDate());
  });
  // Wide periods scroll sideways instead of squeezing 100+ bars into the screen.
  const box = $("chart-box");
  box.style.width = isAll ? Math.max(days.length * 11, 300) + "px" : "100%";

  if (records.chart) records.chart.destroy();
  records.chart = new Chart($("chart-days"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "On", data: days.map(r => r.run_hours), backgroundColor: "#006C6B", borderRadius: 3, stack: "h" },
        { label: "Off", data: days.map(r => r.zero_hours), backgroundColor: "#CBD5E1", borderRadius: 3, stack: "h" },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#0F172A", padding: 10, cornerRadius: 10, displayColors: false,
          callbacks: {
            title: items => fmtDate(days[items[0].dataIndex].day + "T00:00:00", { weekday: "short", day: "numeric", month: "short" }),
            label: c => `${c.dataset.label}: ${Number(c.parsed.y || 0).toFixed(1)} h`,
            afterBody: items => {
              const r = days[items[0].dataIndex];
              return r.has_data ? (r.energy_kwh != null ? `${r.energy_kwh.toFixed(2)} kWh` : "") : "No data logged";
            },
          },
        },
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { color: "#64748B", font: { size: 10 }, maxRotation: 0, autoSkipPadding: 8 } },
        y: { stacked: true, max: 24, grid: { color: "rgba(226,232,240,.8)" }, ticks: { color: "#64748B", font: { size: 10 }, stepSize: 6 } },
      },
    },
  });
  if (isAll) requestAnimationFrame(() => { const sc = $("chart-scroll"); sc.scrollLeft = sc.scrollWidth; });
}

/* ═══════════════════════════ control screen ═══════════════════════════ */

const twin = $("twin");
let twinReady = false;

function loadTwin() {
  if (!twin.getAttribute("src")) twin.setAttribute("src", "../Panel.glb");
}

function wakeControl() {
  const frame = $("cam-frame");
  if (!frame.src) {
    frame.addEventListener("load", () => $("cam").classList.add("loaded"), { once: true });
    frame.src = CAMERA_URL;
  }
  loadTwin();
}

function sleepControl() {
  // Stop the camera stream when it is not on screen (data and battery).
  const frame = $("cam-frame");
  if (frame.src) { frame.removeAttribute("src"); $("cam").classList.remove("loaded"); }
}

twin.addEventListener("load", () => { twinReady = true; $("twin-wrap").classList.add("loaded"); updateTwin(); });

function updateTwin() {
  const d = live.data;
  const on = !!d && Number(d.current) > ON_AMPS;
  const chip = $("twin-state");
  chip.textContent = d ? (on ? "Lamps on" : "Lamps off") : "--";
  chip.className = "chip" + (on ? " chip-ok" : "");
  if (!twinReady || !twin.model) return;
  // Same material names as the dashboard model: MAT_LAMP_<n>_BULB.
  for (const m of twin.model.materials) {
    if (!/^MAT_LAMP_\d+_BULB$/i.test(m.name || "")) continue;
    try {
      m.pbrMetallicRoughness.setBaseColorFactor(on ? [1, 0.98, 0.93, 1] : [0.55, 0.56, 0.58, 1]);
      if (m.setEmissiveFactor) m.setEmissiveFactor(on ? [1, 0.96, 0.86] : [0, 0, 0]);
    } catch (_) {}
  }
}

$("cam-full").addEventListener("click", () => {
  haptic();
  const el = $("cam");
  (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el);
});

/* Commands: confirm in a bottom sheet, then POST /api/control. */
const CMD_TEXT = {
  Unlock: "Unlock the panel so it accepts the next command.",
  Open: "Open the NB2 breaker. The lamps on this circuit will switch off.",
  Close: "Close the NB2 breaker. The lamps on this circuit will be powered.",
};
const CMD_ERRORS = {
  unauthenticated: "Sign-in required to control the panel.",
  cross_origin_blocked: "Blocked: request came from another site.",
  invalid_command: "The panel rejected that command.",
  server_misconfigured: "The server is missing its Home Assistant settings.",
  ha_unreachable: "The panel is unreachable right now.",
};
let pendingCmd = null;

function openSheet(cmd) {
  pendingCmd = cmd;
  $("sheet-title").textContent = `${cmd}?`;
  $("sheet-text").textContent = CMD_TEXT[cmd] || "";
  $("sheet-ok").textContent = cmd;
  openPanel($("sheet"));
}
/* One scrim for every bottom sheet (command, about). */
function openPanel(el) {
  $("scrim").hidden = false;
  el.hidden = false;
}
function closeSheet() {
  $("scrim").hidden = true;
  document.querySelectorAll(".sheet").forEach(s => (s.hidden = true));
  pendingCmd = null;
}
document.querySelectorAll(".cmd").forEach(b => b.addEventListener("click", () => { haptic(); openSheet(b.dataset.cmd); }));
$("scrim").addEventListener("click", closeSheet);
$("sheet-cancel").addEventListener("click", closeSheet);
$("sheet-ok").addEventListener("click", async () => {
  const cmd = pendingCmd;
  closeSheet();
  if (!cmd) return;
  haptic();
  const result = $("cmd-result");
  result.textContent = `Sending ${cmd}…`;
  document.querySelectorAll(".cmd").forEach(b => (b.disabled = true));
  try {
    const res = await fetch(API + "/api/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ command: cmd }),
    });
    let r = {};
    try { r = await res.json(); } catch (_) {}
    const msg = res.ok && r.ok ? `${cmd} sent to the panel.` : (CMD_ERRORS[r.error] || `Failed (${r.error || res.status}).`);
    result.textContent = msg;
    toast(msg);
  } catch (_) {
    result.textContent = "Control channel offline.";
    toast("Control channel offline.");
  } finally {
    document.querySelectorAll(".cmd").forEach(b => (b.disabled = false));
  }
});

/* ═══════════════════════════ simulate ═══════════════════════════ */

/* The Simulate screen is the dashboard's Simulation tab itself, in a frame. It is
   created on first visit (so it adds no history entry) and kept, so a running
   simulation survives switching screens; while hidden the browser stops rendering it.

   The frame never scrolls on its own: it is always as tall as the tab, and the app
   page scrolls, like every other screen. A scrolling frame inside a scrolling page
   fought with the 3D model's touch handling and with pull to refresh on phones. */
let simFrame = null;

function fitSimFrame() {
  const doc = simFrame && simFrame.contentDocument;
  if (!doc || !doc.body || simFrame.hidden) return;
  // Bottom edge of the content in page coordinates, plus the body's bottom margin.
  const shell = doc.querySelector(".app-shell") || doc.body;
  const bottom = shell.getBoundingClientRect().bottom + doc.defaultView.scrollY +
                 parseFloat(doc.defaultView.getComputedStyle(doc.body).marginBottom || 0);
  const h = Math.ceil(bottom);
  if (h && Math.abs(h - simFrame.offsetHeight) > 1) simFrame.style.height = h + "px";
}

function wireSimFrame() {
  const win = simFrame.contentWindow, doc = simFrame.contentDocument;
  $("sim-loading")?.remove();
  // Follow the tab's height as cards, charts and the alarm list change size.
  new win.ResizeObserver(fitSimFrame).observe(doc.querySelector(".app-shell") || doc.body);
  fitSimFrame();
  // Touches inside the frame never reach this page, so report them to the app
  // shell here: dragging the 3D model or a slider must not pull to refresh.
  doc.addEventListener("touchstart", e => {
    const t = e.target;
    if (bridge && bridge.onTouch) bridge.onTouch(!!(t.closest && t.closest("model-viewer,canvas,input,select,textarea,.s3-scenario-list,.log-body")));
  }, { passive: true, capture: true });
}

function simVisible(on) {
  if (on && !simFrame) {
    simFrame = document.createElement("iframe");
    simFrame.className = "sim-frame";
    simFrame.title = "Simulation";
    simFrame.setAttribute("scrolling", "no");
    simFrame.src = "../?tab=simulation&embed=sim";
    simFrame.addEventListener("load", wireSimFrame, { once: true });
    $("screen-simulate").appendChild(simFrame);
  }
  if (simFrame) {
    simFrame.hidden = !on;
    if (on) requestAnimationFrame(fitSimFrame);
  }
}

$("info-btn").addEventListener("click", () => { haptic(); openPanel($("about")); });

/* ═══════════════════════════ boot ═══════════════════════════ */

$("version").textContent = appVersion ? `Lamp Panel app ${appVersion}` : "Lamp Panel · web";
go((location.hash || "").slice(1) || "live");
startLive();
loadMonthCard();
// Fetch the 3D model (2.3 MB) in the background so the Control screen opens ready.
setTimeout(loadTwin, 4000);
// Field data changes weekly; refresh the cached periods every 30 minutes.
setInterval(() => { records.cache = {}; loadMonthCard(); if (route === "records") loadRecords(); }, 30 * 60 * 1000);
