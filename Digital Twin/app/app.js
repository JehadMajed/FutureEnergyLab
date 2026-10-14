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
/* One scrim for every bottom sheet (command, lamp inspector, about). */
function openPanel(el) {
  $("scrim").hidden = false;
  el.hidden = false;
}
function closeSheet() {
  $("scrim").hidden = true;
  document.querySelectorAll(".sheet").forEach(s => (s.hidden = true));
  pendingCmd = null;
  if (sim.sel != null) { lampEls[sim.sel].classList.remove("sel"); sim.sel = null; }
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

const S = window.SimEngine;
const SPEEDS = [1, 5, 20, 200, 1000, 4000];   // simulated hours per real second (as the dashboard)
const sim = { running: false, visible: false, raf: null, last: null, sel: null, speed: 2,
              series: [], events: 0, lastUi: 0 };
const lampEls = [];
const fmtH = h => Math.floor(h).toLocaleString("en-US");
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function buildSim() {
  const board = $("board");
  for (let i = 0; i < S.P.N; i++) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "lamp off";
    b.setAttribute("aria-label", "Lamp " + (i + 1));
    b.addEventListener("click", () => { haptic(); inspect(i); });
    board.appendChild(b);
    lampEls.push(b);
  }

  const speed = $("speed");
  SPEEDS.forEach((h, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = h >= 1000 ? `${h / 1000}k h/s` : `${h} h/s`;
    b.className = i === sim.speed ? "active" : "";
    b.setAttribute("role", "radio");
    b.addEventListener("click", () => {
      haptic();
      sim.speed = i;
      speed.querySelectorAll("button").forEach((x, j) => x.classList.toggle("active", j === i));
    });
    speed.appendChild(b);
  });

  const row = $("scenarios");
  S.SCENARIOS.forEach(sc => {
    const c = document.createElement("button");
    c.type = "button";
    c.className = "scen";
    c.dataset.id = sc.id;
    c.innerHTML = `<b></b><p></p><span class="scen-foot"><span class="risk risk-${sc.risk}">${sc.risk}</span>` +
                  `<span class="scen-hours">${sc.hours.toLocaleString("en-US")} h</span></span>`;
    c.querySelector("b").textContent = sc.name;
    c.querySelector("p").textContent = sc.desc;
    c.addEventListener("click", () => {
      haptic();
      stopSim();
      clearSimHistory();
      S.startScenario(sc.id);
      syncControls();
      sampleAge(true);
      startSim();
    });
    row.appendChild(c);
  });

  $("in-v").addEventListener("input", e => { S.G.V = Number(e.target.value); syncControls(); renderSim(true); });
  $("in-t").addEventListener("input", e => { S.G.Tamb = Number(e.target.value); syncControls(); renderSim(true); });
  $("in-n").addEventListener("input", e => { S.G.energised = Number(e.target.value); syncControls(); renderSim(true); });

  document.querySelectorAll(".fault").forEach(b => b.addEventListener("click", () => {
    haptic();
    const f = S.G.f, k = b.dataset.fault;
    const on = !b.classList.contains("active");
    if (k === "overvolt") f.overvolt = on;
    if (k === "dust") f.dust = on;
    if (k === "ambient") f.ambient = on ? 20 : 0;
    if (k === "row") f.rowKill = on ? [0] : [];
    S.emit(on ? "warn" : "info", (on ? "Fault injected: " : "Fault cleared: ") + b.textContent);
    syncControls();
    renderSim(true);
  }));

  $("sim-power").addEventListener("click", () => {
    haptic();
    S.G.contactor = !S.G.contactor;
    S.emit("info", S.G.contactor ? "Panel switched on" : "Panel switched off");
    syncControls();
    renderSim(true);
  });
  $("sim-play").addEventListener("click", () => {
    haptic();
    if (sim.running) { pauseSim(); return; }
    if (!S.G.contactor) { S.G.contactor = true; S.emit("info", "Panel switched on"); }
    if (!sim.series.length) sampleAge(true);
    startSim();
  });
  $("sim-reset").addEventListener("click", () => {
    haptic();
    stopSim();
    S.reset();
    clearSimHistory();
    syncControls();
    renderSim(true);
    setHeroState("idle");
  });

  document.querySelectorAll("[data-jump]").forEach(b => b.addEventListener("click", () => {
    haptic();
    const hours = Number(b.dataset.jump);
    const wasRunning = sim.running;
    pauseSim();
    if (!S.G.contactor) { toast("The panel is off, so no ageing builds up. Switch it on first."); return; }
    // A hot panel needs fine time steps; let the message paint before the work starts.
    toast(`Calculating ${hours.toLocaleString("en-US")} h…`);
    setTimeout(() => {
      if (!sim.series.length) sampleAge(true);
      S.jump(hours, () => sampleAge(true));
      sampleAge(true);
      renderSim(true);
      toast("Now at " + S.summary());
      if (wasRunning) startSim(); else if (S.G.simHours) setHeroState("paused");
    }, 60);
  }));

  S.on(addEvent);
  syncControls();
  renderSim(true);
}

function syncControls() {
  const G = S.G;
  $("in-v").value = G.V; $("in-t").value = G.Tamb; $("in-n").value = G.energised;
  $("v-out").textContent = Math.round(G.V) + " V" + (G.f.overvolt ? ` → ${Math.round(G.V * 1.15)} V` : "");
  $("t-out").textContent = Math.round(G.Tamb) + " °C" + (G.f.ambient ? ` → ${Math.round(G.Tamb + G.f.ambient)} °C` : "");
  $("n-out").textContent = G.energised;
  document.querySelectorAll(".fault").forEach(b => {
    const k = b.dataset.fault;
    const on = k === "overvolt" ? !!G.f.overvolt : k === "dust" ? !!G.f.dust
             : k === "ambient" ? !!G.f.ambient : !!(G.f.rowKill && G.f.rowKill.length);
    b.classList.toggle("active", on);
  });
  const V = G.V * (G.f.overvolt ? 1.15 : 1), T = G.Tamb + (G.f.ambient || 0);
  const issues = [];
  if (V < S.P.V_MIN) issues.push("undervoltage");
  if (V > S.P.V_MAX) issues.push("overvoltage");
  if (T > S.P.T_AMB_MAX) issues.push("too hot");
  const note = $("cond-note");
  note.textContent = issues.length ? "Outside rating: " + issues.join(", ") : "Within rating";
  note.className = "chip " + (issues.length ? "chip-bad" : "chip-ok");
  $("sim-power").setAttribute("aria-pressed", G.contactor);
  document.querySelectorAll(".scen").forEach(c => c.classList.toggle("active", !!G.scenario && c.dataset.id === G.scenario.id));
}

function setHeroState(state) {
  $("sim-hero").dataset.state = state;
  $("sim-badge").textContent = { idle: "Standby", running: "Running", paused: "Paused", done: "Finished" }[state];
}

function startSim() {
  if (sim.running) return;
  sim.running = true;
  sim.last = null;
  setHeroState("running");
  if (sim.visible) sim.raf = requestAnimationFrame(simLoop);
}
function pauseSim() {
  if (!sim.running) return;
  sim.running = false;
  cancelAnimationFrame(sim.raf);
  setHeroState("paused");
}
function stopSim() {
  sim.running = false;
  cancelAnimationFrame(sim.raf);
}

/* The model only runs while its screen is open (battery), and picks up again on return. */
function simVisible(on) {
  sim.visible = on;
  cancelAnimationFrame(sim.raf);
  if (on) {
    renderSim(true);
    if (sim.running) { sim.last = null; sim.raf = requestAnimationFrame(simLoop); }
  }
}

function simLoop(now) {
  if (!sim.running || !sim.visible) return;
  const dt = sim.last ? Math.min(0.1, (now - sim.last) / 1000) : 0.016;
  sim.last = now;
  S.step(dt * SPEEDS[sim.speed] * 3600);
  sampleAge(false);
  renderSim(false);

  const G = S.G;
  if (!G.lamps.some(l => !l.failed)) {
    stopSim(); setHeroState("done");
    S.emit("bad", `All ${S.P.N} lamps failed at ${fmtH(G.simHours)} h`);
    renderSim(true);
    return;
  }
  if (G.scenario && G.simHours >= G.scenario.hours) {
    const name = G.scenario.name;
    stopSim(); G.scenario = null; setHeroState("done");
    S.emit("ok", `${name} complete at ${S.summary()}`);
    toast(`${name}: done`);
    syncControls();
    renderSim(true);
    return;
  }
  sim.raf = requestAnimationFrame(simLoop);
}

function clearSimHistory() {
  sim.series = [];
  sim.events = 0;
  $("events").innerHTML = '<li class="ev-empty">Nothing yet.</li>';
  $("ev-count").textContent = "0";
}

function sampleAge(force) {
  const h = S.G.simHours, last = sim.series[sim.series.length - 1];
  if (h <= 0) return;   // at t = 0 the lamps have not warmed up yet: no meaningful point
  const target = S.G.scenario ? S.G.scenario.hours : Math.max(1000, h);
  if (!force && last && h - last.h < target / 200) return;
  const k = S.kpis();
  sim.series.push({ h, health: k.health, lm: k.lumens });
  if (sim.series.length > 400) sim.series = sim.series.filter((_, i) => i % 2 === 0);
}

function addEvent(ev) {
  const list = $("events");
  if (!sim.events) list.innerHTML = "";
  sim.events++;
  const li = document.createElement("li");
  li.innerHTML = `<span class="ev-h">${fmtH(ev.h)} h</span><span></span>`;
  li.lastChild.textContent = ev.msg;
  li.lastChild.className = "ev-" + ev.type;
  list.prepend(li);
  while (list.children.length > 60) list.lastChild.remove();
  $("ev-count").textContent = sim.events;
}

function renderSim(full) {
  const G = S.G, P = S.P;
  for (let i = 0; i < G.lamps.length; i++) {
    const l = G.lamps[i], el = lampEls[i];
    const b = S.brightness(l);
    const heat = Math.max(0, Math.min(1, (l.Tj - 25) / (P.T_CASE_MAX - 25)));
    el.style.setProperty("--b", b.toFixed(2));
    el.style.setProperty("--h", heat.toFixed(2));
    el.classList.toggle("dead", l.failed);
    el.classList.toggle("off", !l.failed && !l.on);
    el.classList.toggle("hot", !l.failed && (l.foldback || l.Tj >= P.T_CASE_MAX - 5));
    el.classList.toggle("flick", !l.failed && l.on && l.flicker > 20);
  }
  $("sim-hours").textContent = fmtH(G.simHours);
  const progress = $("sim-progress");
  progress.hidden = !G.scenario;
  if (G.scenario) $("sim-progress-bar").style.width = Math.min(100, G.simHours / G.scenario.hours * 100) + "%";

  // Numbers and charts: about 6 times a second is plenty and keeps phones cool.
  const now = performance.now();
  if (!full && now - sim.lastUi < 160) return;
  sim.lastUi = now;

  const k = S.kpis();
  $("sim-sub").textContent = G.scenario ? `${G.scenario.name} · target ${G.scenario.hours.toLocaleString("en-US")} h`
    : G.contactor ? `Panel on · ${Math.round(k.el.V)} V · ${Math.round(G.Tamb + (G.f.ambient || 0))} °C · ${k.el.lit} lit`
    : "Panel off. Pick a scenario or switch it on.";
  const setBar = (id, pct, color) => { const e = $(id); e.style.width = Math.max(0, Math.min(100, pct)) + "%"; e.style.background = color; };
  const tone = (v, good, ok) => v >= good ? "#16803C" : v >= ok ? "#D97706" : "#B42318";
  $("k-health").textContent = k.health.toFixed(1);
  setBar("kb-health", k.health, tone(k.health, 80, 50));
  $("k-lumens").textContent = k.lumens.toFixed(1);
  setBar("kb-lumens", k.lumens, "#FFB300");
  $("k-tj").textContent = k.Tj.toFixed(1);
  setBar("kb-tj", (k.Tj - 20) / (P.T_CASE_MAX + 5) * 100, k.Tj < 70 ? "#16803C" : k.Tj < P.T_CASE_MAX ? "#D97706" : "#B42318");
  $("k-failed").textContent = k.failed;
  setBar("kb-failed", k.failed / P.N * 100, "#B42318");
  $("k-af").textContent = k.af.toFixed(2);
  $("k-power").textContent = Math.round(k.el.P);
  $("k-current").textContent = k.el.I.toFixed(2) + " A";

  const f = S.forecast(), e = S.energy();
  const years = h => h / f.dutyHDay / 365;
  const ahead = (h, passed) => passed ? "Passed" : !isFinite(h) ? "n/a"
    : `in ${fmtH(h)} h (~${years(h) < 1 ? plural(Math.max(1, Math.round(years(h) * 12)), "month") : years(h).toFixed(1) + " years"})`;
  $("f-l70").textContent = G.contactor || G.simHours ? ahead(f.hToL70, f.l70Passed) : "--";
  $("f-b10").textContent = G.contactor || G.simHours ? ahead(f.hToB10, f.b10Passed) : "--";
  $("f-kwh").textContent = (e.kwh < 10 ? e.kwh.toFixed(2) : fmtH(e.kwh)) + " kWh";
  $("f-cost").textContent = e.cost.toFixed(2) + " SAR";
  $("f-heat").textContent = (e.heatKwh < 10 ? e.heatKwh.toFixed(2) : fmtH(e.heatKwh)) + ` kWh (${Math.round(e.heatFrac * 100)}%)`;
  $("f-repl").textContent = `${f.replacements} / ${P.N}` + (f.replacements ? ` · ${f.replaceCost} SAR` : "");
  $("duty-chip").textContent = `${f.dutyHDay} h/day duty`;

  drawAge();
  if (sim.sel != null) fillInspector(sim.sel);
}

function drawAge() {
  const pts = sim.series;
  if (pts.length < 2) { $("age-h").setAttribute("d", ""); $("age-lm").setAttribute("d", ""); $("age-end").textContent = "--"; return; }
  const W = 320, H = 120, maxH = Math.max(pts[pts.length - 1].h, 1);
  const x = h => (h / maxH) * W, y = v => H - (v / 100) * (H - 4) - 2;
  const line = key => pts.map((p, i) => (i ? "L" : "M") + x(p.h).toFixed(1) + "," + y(p[key]).toFixed(1)).join("");
  $("age-h").setAttribute("d", line("health"));
  $("age-lm").setAttribute("d", line("lm"));
  $("age-end").textContent = fmtH(maxH) + " h";
}

/* Lamp inspector: a bottom sheet that keeps updating while the model runs. */
function inspect(i) {
  if (sim.sel != null) lampEls[sim.sel].classList.remove("sel");
  sim.sel = i;
  lampEls[i].classList.add("sel");
  fillInspector(i);
  openPanel($("insp"));
}

function fillInspector(i) {
  const l = S.G.lamps[i], P = S.P;
  const state = l.failed ? "Failed" : l.foldback ? "Thermal foldback" : l.on ? "On" : "Off";
  $("insp-title").textContent = `Lamp L${String(i + 1).padStart(2, "0")}`;
  $("insp-sub").textContent = `Row ${l.row + 1} of ${P.ROWS} from the top · column ${l.col + 1} · ${state}` +
                              (l.failed ? ` (${l.failMode.replace(/_/g, " ")})` : "");
  const cells = [
    ["Health", (l.health * 100).toFixed(1) + " %"],
    ["Light output", l.failed ? "--" : (l.lumens * 100).toFixed(1) + " %"],
    ["Junction temp", l.Tj.toFixed(1) + " °C"],
    ["Hours run", fmtH(l.hoursRun) + " h"],
    ["Ageing rate", S.arrAF(l.Tj).toFixed(2) + " ×"],
    ["Flicker (100 Hz)", l.on ? l.flicker.toFixed(0) + " %" : "--"],
    ["Driver wear", Math.min(100, l.capWear / 1.35 * 100).toFixed(0) + " %"],
    ["Thermal cycles", String(l.cycles)],
  ];
  $("insp-grid").innerHTML = cells.map(c => `<div><span>${c[0]}</span><b>${c[1]}</b></div>`).join("");
}

(function makeInspector() {
  const el = document.createElement("div");
  el.className = "sheet";
  el.id = "insp";
  el.hidden = true;
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.innerHTML = '<div class="sheet-grip"></div><h3 id="insp-title"></h3><p id="insp-sub"></p>' +
                 '<div class="insp-grid" id="insp-grid"></div>' +
                 '<button type="button" class="btn btn-ghost" style="width:100%">Close</button>';
  el.querySelector("button").addEventListener("click", closeSheet);
  document.body.appendChild(el);
})();

$("info-btn").addEventListener("click", () => { haptic(); openPanel($("about")); });

/* ═══════════════════════════ boot ═══════════════════════════ */

buildSim();
$("version").textContent = appVersion ? `Lamp Panel app ${appVersion}` : "Lamp Panel · web";
go((location.hash || "").slice(1) || "live");
startLive();
loadMonthCard();
// Fetch the 3D model (2.3 MB) in the background so the Control screen opens ready.
setTimeout(loadTwin, 4000);
// Field data changes weekly; refresh the cached periods every 30 minutes.
setInterval(() => { records.cache = {}; loadMonthCard(); if (route === "records") loadRecords(); }, 30 * 60 * 1000);
