/* Lamp Panel phone app: 40-lamp physics engine, without any DOM.
 *
 * A port of the SIM3 engine in ../script.js (MODULE: SIM3 — 40-LAMP PHYSICS
 * ENGINE). The constants and equations are copied unchanged so the phone and
 * the dashboard give the same answers; script.js stays the source of truth,
 * and a change to the physics there must be repeated here.
 *
 *   MEASURED   calibrated from history.json (1,310 energised readings)
 *   DATASHEET  Philips Essential LEDbulb 11W E27 230V, order 929002299709
 *   MODELLED   assumption: the panel has no thermal or photometric sensor,
 *              so Tj, lumen output and ageing are a model, not a measurement.
 */
"use strict";

window.SimEngine = (function () {
  var P = {
    N: 40, COLS: 8, ROWS: 5,

    /* MEASURED */
    V_MEAS: 229.7, P_LAMP_MEAS: 10.05, I_MEAS: 2.932, PF_MEAS: 0.597,

    /* DATASHEET */
    P_LAMP_RATED: 11.0, FLUX_RATED: 1200, EFFICACY: 109, L70_H: 12000,
    T_CASE_MAX: 95, T_AMB_MAX: 45, T_AMB_MIN: -20, V_MIN: 220, V_MAX: 240, START_S: 0.5,

    /* MODELLED */
    R_TH: 5.5, TAU_TH: 600, E_A: 0.70, K_B: 8.617e-5, DROOP_PER_C: 0.0035, LER: 300,
    T_AMB: 25, CAP_LIFE_H: 4500, WEIBULL_BETA: 2.5, WEIBULL_ETA: 25000, T_GRAD: 8,

    /* SEC residential tariff */
    TARIFF1: 0.18, TARIFF2: 0.30, TIER1_KWH: 6000, LAMP_PRICE: 12, DUTY_H_DAY: 12,
  };

  var ETA_WPE = P.EFFICACY / P.LER;
  var HEAT_FRAC = 1 - ETA_WPE;
  P.FLUX_ACTUAL = P.FLUX_RATED * (P.P_LAMP_MEAS / P.P_LAMP_RATED);
  var KFAC = P.E_A / P.K_B;
  var T_NOM_C = P.T_AMB + P.R_TH * P.P_LAMP_MEAS * HEAT_FRAC;
  P.T_REF = T_NOM_C + 273.15;
  P.T_NOM_C = T_NOM_C;
  var K_LM = -Math.log(0.70) / P.L70_H;

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

  var G = {
    lamps: [], f: {}, simHours: 0, scenario: null,
    V: P.V_MEAS, Tamb: P.T_AMB, energised: P.N, contactor: false, energyWh: 0,
  };

  var listeners = [];
  function emit(type, msg) {
    var ev = { type: type, msg: msg, h: G.simHours };
    listeners.forEach(function (fn) { fn(ev); });
  }
  function pad(n) { return String(n).padStart(2, "0"); }

  function makeLamp(id) {
    var row = Math.floor(id / P.COLS);            // row 0 is the TOP row
    var dT = P.T_GRAD * (1 - row / (P.ROWS - 1));
    return {
      id: id, row: row, col: id % P.COLS, dTamb: dT,
      on: false, failed: false, failMode: "none",
      health: 1, lumens: 1, Tj: P.T_AMB + dT,
      hoursRun: 0, eqHours: 0,
      Rth: P.R_TH * (1 + (rnd() - 0.5) * 0.10),
      warm: 0, capWear: 0, flicker: 0,
      cycling: false, foldback: false, cycles: 0,
      wq: rnd(),
    };
  }

  function initLamps() {
    rnd = mulberry32(SEED);
    G.lamps = [];
    for (var i = 0; i < P.N; i++) G.lamps.push(makeLamp(i));
  }

  function arrAF(Tj) { return Math.exp(KFAC * (1 / P.T_REF - 1 / (Tj + 273.15))); }

  function voltageFactors(V) {
    if (V >= P.V_MIN && V <= P.V_MAX) return { flux: 1, pmul: 1, stress: 1 };
    if (V < P.V_MIN) {
      var f = Math.max(0, (V - 160) / (P.V_MIN - 160));
      return { flux: f * f, pmul: f, stress: 1 };
    }
    var over = (V - P.V_MAX) / P.V_MAX;
    return { flux: 1, pmul: 1 + 2 * over, stress: 1 + 8 * over };
  }

  function supplyV() { return G.V * (G.f.overvolt ? 1.15 : 1); }

  function lampWeibullLimit(l) {
    return P.WEIBULL_ETA * Math.pow(-Math.log(1 - l.wq * 0.999), 1 / P.WEIBULL_BETA);
  }

  function killLamp(l, mode) {
    if (l.failed) return;
    l.failed = true; l.on = false; l.health = 0; l.failMode = mode;
    l.flicker = 0; l.cycling = false; l.foldback = false;
    var n = G.lamps.filter(function (x) { return x.failed; }).length;
    emit("bad", "L" + pad(l.id + 1) + " failed: " + mode.replace(/_/g, " ") + " (" + n + "/" + P.N + ")");
  }

  function tickLamp(l, dt, TambBase, vf) {
    var Tamb = TambBase + l.dTamb;
    var energised = G.contactor && !l.failed && l.id < G.energised &&
                    !(G.f.rowKill && G.f.rowKill.indexOf(l.row) >= 0);

    if (l.foldback) {
      if (l.Tj <= P.T_CASE_MAX - 15) { l.foldback = false; l.cycles++; }
    } else if (energised && l.Tj >= P.T_CASE_MAX) {
      l.foldback = true;
      if (!l.cycling) {
        l.cycling = true;
        emit("warn", "L" + pad(l.id + 1) + " hit T-case " + P.T_CASE_MAX + " °C: driver foldback");
      }
    }
    var lit = energised && !l.foldback;
    l.on = lit;

    var kw = dt / Math.max(0.05, P.START_S);
    l.warm = lit ? Math.min(1, l.warm + kw) : Math.max(0, l.warm - kw * 2);

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

      var capLife = P.CAP_LIFE_H * Math.pow(2, (85 - l.Tj) / 10);
      l.capWear = Math.min(1.5, l.capWear + hrs / Math.max(1, capLife));
      l.flicker = Math.min(100, 4 + 92 * Math.pow(Math.min(1, l.capWear), 2));

      if (l.eqHours >= lampWeibullLimit(l)) { killLamp(l, "driver_failure"); return; }
      if (l.capWear >= 1.35) { killLamp(l, "capacitor_wearout"); return; }
      if (l.lumens <= 0.30) { killLamp(l, "lumen_depreciation"); return; }
      if (l.cycles >= 400) { killLamp(l, "thermal_cycling_fatigue"); return; }

      l.health = Math.max(0, Math.min(1 - l.eqHours / lampWeibullLimit(l), (l.lumens - 0.30) / 0.70));
    }
  }

  var FINE_DT = 30, COARSE_DT = 900, HOT_MARGIN = 8;

  function stepAll(dtSim) {
    var Tamb = G.Tamb + (G.f.ambient || 0);
    var vf = voltageFactors(supplyV());
    var remaining = dtSim, settled = 0;
    while (remaining > 1e-9) {
      var hot = false;
      for (var k = 0; k < G.lamps.length; k++) {
        var lk = G.lamps[k];
        if (!lk.failed && (lk.foldback || lk.Tj > P.T_CASE_MAX - HOT_MARGIN)) { hot = true; break; }
      }
      var MAX = (!hot && settled >= 4) ? COARSE_DT : FINE_DT;
      var dt = Math.min(MAX, remaining);
      remaining -= dt; settled++;
      for (var i = 0; i < G.lamps.length; i++) tickLamp(G.lamps[i], dt, Tamb, vf);
      var litN = 0;
      for (var m = 0; m < G.lamps.length; m++) if (G.lamps[m].on) litN++;
      G.energyWh += litN * P.P_LAMP_MEAS * vf.pmul * vf.stress * (dt / 3600);
      G.simHours += dt / 3600;
    }
  }

  function electrical() {
    var V = supplyV();
    var vf = voltageFactors(V);
    var lit = G.lamps.filter(function (l) { return l.on; }).length;
    var Pw = lit * P.P_LAMP_MEAS * vf.pmul * vf.stress;
    var I = (V > 1 && P.PF_MEAS > 0) ? Pw / (V * P.PF_MEAS) : 0;
    return { P: Pw, V: V, I: I, lit: lit };
  }

  /* Visible brightness of one lamp, 0..1 (as the dashboard's renderModel). */
  function brightness(l) {
    if (l.failed || !l.on || l.warm <= 0.001) return 0;
    var droop = Math.max(0.25, 1 - P.DROOP_PER_C * Math.max(0, l.Tj - 25));
    return Math.max(0, Math.min(1, l.warm * droop * l.lumens * voltageFactors(supplyV()).flux));
  }

  function kpis() {
    var lamps = G.lamps;
    var lit = lamps.filter(function (l) { return l.on; });
    var failed = lamps.filter(function (l) { return l.failed; }).length;
    return {
      health: lamps.reduce(function (a, l) { return a + l.health; }, 0) / P.N * 100,
      lumens: lamps.reduce(function (a, l) { return a + (l.on ? l.lumens : 0); }, 0) / P.N * 100,
      Tj: lit.length ? lit.reduce(function (a, l) { return a + l.Tj; }, 0) / lit.length : G.Tamb + (G.f.ambient || 0),
      af: lit.length ? lit.reduce(function (a, l) { return a + arrAF(l.Tj); }, 0) / lit.length : 1,
      failed: failed,
      flickering: lamps.filter(function (l) { return !l.failed && l.flicker > 20; }).length,
      cycling: lamps.filter(function (l) { return l.cycles > 0; }).length,
      el: electrical(),
    };
  }

  function forecast() {
    var lit = G.lamps.filter(function (l) { return l.on && !l.failed; });
    var af = lit.length ? lit.reduce(function (a, l) { return a + arrAF(l.Tj); }, 0) / lit.length : 1;
    var alive = G.lamps.filter(function (l) { return !l.failed; });
    var meanLm = alive.reduce(function (a, l) { return a + l.lumens; }, 0) / Math.max(1, alive.length);
    var eqNeeded = -Math.log(0.70) / K_LM;
    var eqNow = lit.length ? lit.reduce(function (a, l) { return a + l.eqHours; }, 0) / lit.length : 0;
    var b10eq = P.WEIBULL_ETA * Math.pow(-Math.log(0.9), 1 / P.WEIBULL_BETA);
    var failedN = P.N - alive.length;
    return {
      hToL70: af > 0 ? Math.max(0, (eqNeeded - eqNow) / af) : Infinity,
      l70Passed: meanLm <= 0.70,
      hToB10: af > 0 ? Math.max(0, (b10eq - eqNow) / af) : Infinity,
      b10Passed: failedN / P.N >= 0.10,
      replacements: failedN,
      replaceCost: failedN * P.LAMP_PRICE,
      dutyHDay: P.DUTY_H_DAY,
    };
  }

  function energy() {
    var kwh = G.energyWh / 1000;
    var avgKw = kwh / Math.max(1e-6, G.simHours);
    var monthKwh = avgKw * P.DUTY_H_DAY * 30;
    var rate = monthKwh > P.TIER1_KWH ? P.TARIFF2 : P.TARIFF1;
    var lit = G.lamps.filter(function (l) { return l.on; });
    var lm = lit.reduce(function (a, l) { return a + l.lumens; }, 0) * P.FLUX_ACTUAL;
    var w = electrical().P;
    return { kwh: kwh, cost: kwh * rate, monthKwh: monthKwh, monthCost: monthKwh * rate,
             heatKwh: kwh * HEAT_FRAC, heatFrac: HEAT_FRAC, efficacy: w > 1 ? lm / w : null };
  }

  /* Scenarios: extreme by design, anchored to real datasheet limits. */
  var SCENARIOS = [
    { id: "s1", name: "Baseline to L70", risk: "Low", hours: 12000,
      desc: "Measured operating point (230 V, 25 °C, all 40 lit) run to the datasheet L70 point.",
      setup: function () { G.V = P.V_MEAS; G.Tamb = 25; G.energised = P.N; } },
    { id: "s2", name: "Summer beyond rated ambient", risk: "High", hours: 8000,
      desc: "55 °C ambient, above the 45 °C datasheet maximum, with the grid at the 240 V ceiling.",
      setup: function () { G.V = 240; G.Tamb = 55; G.energised = P.N; } },
    { id: "s3", name: "Thermal runaway: dust + 60 °C", risk: "Critical", hours: 6000,
      desc: "No maintenance. Dust chokes the heatsinks at 60 °C until drivers hit T-case 95 °C.",
      setup: function () { G.V = P.V_MEAS; G.Tamb = 60; G.f.dust = true; G.energised = P.N; } },
    { id: "s4", name: "Sustained overvoltage 255 V", risk: "Critical", hours: 4000,
      desc: "Grid held at 255 V, well above the rated 240 V. Driver stress collapses life.",
      setup: function () { G.V = 255; G.Tamb = 40; G.energised = P.N; } },
    { id: "s5", name: "End of life: 25,000 h", risk: "Critical", hours: 25000,
      desc: "Far past rated life. Capacitors dry out, flicker spreads, then failures cascade.",
      setup: function () { G.V = P.V_MEAS; G.Tamb = 30; G.energised = P.N; } },
    { id: "s6", name: "Grid sag 195 V", risk: "Medium", hours: 2000,
      desc: "Below the 220 V window: drivers drop out of regulation and light output collapses.",
      setup: function () { G.V = 195; G.Tamb = 25; G.energised = P.N; } },
  ];

  function reset() {
    initLamps();
    G.f = {}; G.simHours = 0; G.scenario = null;
    G.V = P.V_MEAS; G.Tamb = P.T_AMB; G.energised = P.N; G.contactor = false; G.energyWh = 0;
  }

  function startScenario(id) {
    var sc = SCENARIOS.find(function (s) { return s.id === id; });
    if (!sc) return null;
    reset();
    G.scenario = sc; sc.setup(); G.contactor = true;
    emit("info", "Scenario “" + sc.name + "” started, target " + sc.hours.toLocaleString("en-US") + " h");
    return sc;
  }

  /* Jump forward in 25 h chunks so ageing and heating stay coupled. */
  function jump(hours, onSample) {
    var CH = 25, n = Math.ceil(hours / CH), every = Math.max(1, Math.floor(n / 120));
    for (var i = 0; i < n; i++) {
      stepAll(Math.min(CH, hours - i * CH) * 3600);
      if (onSample && i % every === 0) onSample();
    }
  }

  function summary() {
    var k = kpis();
    return Math.floor(G.simHours).toLocaleString("en-US") + " h: " + k.failed + "/" + P.N + " failed, " +
           k.lumens.toFixed(1) + "% light output, " + k.flickering + " flickering";
  }

  reset();

  return {
    P: P, G: G, SCENARIOS: SCENARIOS,
    reset: reset, startScenario: startScenario, step: stepAll, jump: jump,
    kpis: kpis, forecast: forecast, energy: energy, electrical: electrical,
    brightness: brightness, arrAF: arrAF, summary: summary,
    on: function (fn) { listeners.push(fn); },
    emit: emit,
  };
})();
