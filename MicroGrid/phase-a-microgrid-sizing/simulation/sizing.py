#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sizing.py  --  SINGLE SOURCE OF TRUTH for the Phase A islanded-microgrid case study.

Pipeline:  CSV load data  ->  sizing.py  ->  sizing_output.json  ->  sim.py

This module:
  1. reads the ground-truth load CSV (path in CONFIG),
  2. validates it,
  3. builds the 24-hour load profile at the configured time step,
  4. builds a location-specific PV profile,
  5. sizes the PV array, battery (BESS) and grid-forming inverter,
  6. estimates the main AC/DC feeder currents,
  7. writes a structured result to `sizing_output.json` for sim.py to consume.

Change a parameter ONCE in the CONFIG block below, run this file, then run sim.py.
sim.py performs NO sizing of its own -- it only reads sizing_output.json.

Reusable across case studies: point LOAD_CSV at a different file and adjust CONFIG.
Nothing below the CONFIG block is specific to a particular appliance list except the
optional SCHEDULE dictionary (which falls back to sensible defaults for unknown loads).
"""

import csv
import json
import math
import os
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional

# ======================================================================
# CASE STUDY CONFIGURATION   (edit here only)
# ======================================================================

# --- input ---
HERE = os.path.dirname(os.path.abspath(__file__))
LOAD_CSV = os.path.join(HERE, "..", "data", "phase_a_loads.csv")
OUTPUT_JSON = os.path.join(HERE, "sizing_output.json")

# --- design policy factors (kept SEPARATE from physical derating) ---
DIVERSITY_FACTOR = 1.0          # coincidence applied to the load profile (1.0 = none)
SAFETY_MARGIN = 1.0             # engineering margin on every sizing result (1.0 = raw)

# --- electrical system ---
AC_VOLTAGE = 230.0              # V, single-phase line-to-neutral
AC_FREQUENCY = 60.0            # Hz
PHASES = 1

# --- efficiencies ---
PV_SYSTEM_DERATE = 0.80         # soiling+temperature+mismatch+wiring+MPPT (STC -> array output)
PV_INVERTER_EFFICIENCY = 0.975  # PV MPPT/DC-AC stage  (PV_SYSTEM_DERATE*this ~ PR 0.78)
BATTERY_CHARGE_EFFICIENCY = 0.95
BATTERY_DISCHARGE_EFFICIENCY = 0.95
INVERTER_EFFICIENCY = 0.95      # grid-forming inverter DC->AC

# --- battery physical limits (NOT policy margin) ---
BATTERY_MIN_SOC = 0.10
BATTERY_MAX_SOC = 1.00
BATTERY_INITIAL_SOC = 0.90
BATTERY_TEMP_DERATE = 0.95      # usable-capacity loss at high ambient
BATTERY_AGING_DERATE = 0.90     # end-of-life capacity fade
BATTERY_DC_VOLTAGE = 51.2       # V nominal (16S LiFePO4)
BATTERY_C_RATE_MAX = 0.5        # sets minimum power rating vs capacity
BATTERY_POWER_KW = None         # None -> auto (max(profile need, inverter)); or fix a number

# --- PV resource / geometry (location-specific) ---
PV_TILT = 24.0                  # deg (~ latitude)
PV_AZIMUTH = 180.0              # deg (true south)
DESIGN_PSH = 5.5               # kWh/m2/day (POA), representative design day (SIZING basis)
LOW_PV_PSH = 2.5                # kWh/m2/day (POA), overcast/dust design day (battery SIZING basis)
SUNRISE_HOUR = 6.0
SUNSET_HOUR = 18.0
PV_MODULE_W = 550.0             # module nameplate, for module count
PV_HEADROOM_FACTOR = 1.40       # EXPLICIT over-build above energy-neutral (resilience)
PV_SIZE_KWP = None              # None -> auto (energy-neutral * headroom); or fix a number

# --- battery sizing basis ---
# The binding case for an islanded system is the low-PV day, so the battery is sized
# on LOW_PV_PSH by default. Set to DESIGN_PSH for a clear-day-only battery.
BATTERY_SIZING_PSH = LOW_PV_PSH
BATTERY_CAPACITY_KWH = 10.0     # pinned to 10 kWh (auto-calc from deficit ~9.2 kWh, rounded up
                                #   to the procurement size); set to None to use the raw calc.

# --- inverter sizing ---
INVERTER_AMBIENT_DERATE = 0.80  # continuous rating at 45 C vs nameplate (reporting only)
INVERTER_SIZE_KVA = None        # None -> auto (all-on connected kVA); or fix a number
INVERTER_SURGE_FACTOR = 2.0     # x continuous, few seconds (motor start reserve)

# --- cable sizing basis ---
CABLE_INSTALL_DERATE = 0.70     # ambient + grouping applied to tabulated ampacity
CABLE_DESIGN_FACTOR = 1.25      # continuous-duty design current
AC_VDROP_LIMIT = 0.02           # sub-main, fraction of AC_VOLTAGE
DC_VDROP_LIMIT = 0.01           # battery feeder, fraction of BATTERY_DC_VOLTAGE
AC_FEEDER_LENGTH_M = 15.0
DC_FEEDER_LENGTH_M = 2.0

# --- simulation ---
TIME_STEP_MINUTES = 5

# ======================================================================
# OPERATING SCENARIO   (drives sim.py ONLY -- does NOT change the sizing)
# ----------------------------------------------------------------------
# The system is ALWAYS sized on the DESIGN basis above (DESIGN_PSH for PV,
# LOW_PV_PSH for the battery, CSV loads x DIVERSITY_FACTOR). These knobs
# only decide what conditions the ALREADY-SIZED system is stressed against
# in the 24-h simulation, so you can test e.g. a low-PV day against the
# fixed base-case hardware.
#
#   Base case         : SCENARIO_PSH = DESIGN_PSH (5.5), SCENARIO_LOAD_SCALE = 1.0
#   Low-PV day        : SCENARIO_PSH = LOW_PV_PSH (2.5), SCENARIO_LOAD_SCALE = 1.0
#   High load         : SCENARIO_PSH = DESIGN_PSH (5.5), SCENARIO_LOAD_SCALE = 1.25
#   Low-PV + high load: SCENARIO_PSH = LOW_PV_PSH (2.5), SCENARIO_LOAD_SCALE = 1.25
# ======================================================================
SCENARIO_PSH = DESIGN_PSH        # solar condition the sized system is RUN against
SCENARIO_LOAD_SCALE = 1.0        # load multiplier the sized system is RUN against

# --- assumed time-of-day schedule (used only if the CSV has no 'start_h' column) ---
#   mode "block": rated power, contiguous, for on_h starting at 'start'
#   mode "duty" : rated*on_h/window spread flat over [start, start+window]
#   unknown loads fall back to a daytime duty spread.
SCHEDULE: Dict[str, dict] = {
    "Air Conditioner": {"mode": "block", "start": 13.0},
    "Hoover":          {"mode": "block", "start": 9.0},
    "Iron":            {"mode": "block", "start": 7.0},
    "Water Cooler":    {"mode": "duty",  "start": 8.0, "window": 14.0},
    "Fan":             {"mode": "block", "start": 12.0},
    "Blender":         {"mode": "block", "start": 8.0},
}
DEFAULT_SCHEDULE = {"mode": "duty", "start": 8.0, "window": 12.0}

def scenario_tag() -> str:
    """Short label for the current operating scenario -> used for the figs/<tag>/ folder."""
    low_pv = abs(SCENARIO_PSH - LOW_PV_PSH) < 1e-9 and abs(SCENARIO_PSH - DESIGN_PSH) > 1e-9
    high_load = SCENARIO_LOAD_SCALE > 1.0 + 1e-9
    if not low_pv and not high_load:
        return "base"
    if low_pv and not high_load:
        return "low_pv"
    if high_load and not low_pv:
        return "high_load"
    if low_pv and high_load:
        return "low_pv_high_load"
    return f"psh{SCENARIO_PSH:g}_ld{SCENARIO_LOAD_SCALE:g}"


# ======================================================================
# DATA MODEL
# ======================================================================

@dataclass
class Load:
    name: str
    rated_w: float
    quantity: int
    on_h: float
    pf: float
    is_motor: bool
    critical: bool
    energy_wh: float          # per-day, all units
    start_h: Optional[float]  # None -> use SCHEDULE

    @property
    def p_total_w(self) -> float:
        return self.rated_w * self.quantity

    @property
    def q_var(self) -> float:
        return self.p_total_w * math.tan(math.acos(self.pf))

    @property
    def s_va(self) -> float:
        return self.p_total_w / self.pf


@dataclass
class SizingResult:
    meta: dict = field(default_factory=dict)
    config: dict = field(default_factory=dict)
    loads: list = field(default_factory=list)
    analysis: dict = field(default_factory=dict)
    profile: dict = field(default_factory=dict)   # arrays handed to sim.py
    pv: dict = field(default_factory=dict)
    battery: dict = field(default_factory=dict)
    inverter: dict = field(default_factory=dict)
    cables: dict = field(default_factory=dict)


# ======================================================================
# 1-2.  READ + VALIDATE CSV
# ======================================================================

def _to_bool(v) -> bool:
    return str(v).strip().lower() in ("1", "true", "yes", "y")


def read_loads(path: str) -> List[Load]:
    if not os.path.exists(path):
        raise FileNotFoundError(f"Load CSV not found: {path}")
    loads: List[Load] = []
    with open(path, newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        required = {"name", "rated_w", "on_h", "PF"}
        missing = required - set(h.strip() for h in reader.fieldnames or [])
        if missing:
            raise ValueError(f"CSV missing required columns: {sorted(missing)}")
        for i, r in enumerate(reader, start=2):
            r = {k.strip(): (v.strip() if isinstance(v, str) else v) for k, v in r.items()}
            name = r["name"]
            rated = float(r["rated_w"])
            qty = int(float(r.get("quantity", 1) or 1))
            on_h = float(r["on_h"])
            pf = float(r["PF"]) if r.get("PF") not in (None, "", "0") else 1.0
            pf = min(max(pf, 0.05), 1.0)
            energy = float(r["measured_wh"]) if r.get("measured_wh") else rated * qty * on_h
            start_h = float(r["start_h"]) if r.get("start_h") not in (None, "") else None
            loads.append(Load(
                name=name, rated_w=rated, quantity=qty, on_h=on_h, pf=pf,
                is_motor=_to_bool(r.get("is_motor", 0)),
                critical=_to_bool(r.get("critical", 0)),
                energy_wh=energy, start_h=start_h,
            ))
    return loads


def validate(loads: List[Load]) -> List[str]:
    warnings = []
    if not loads:
        raise ValueError("No loads read from CSV.")
    for l in loads:
        if l.rated_w <= 0:
            warnings.append(f"{l.name}: non-positive rated power ({l.rated_w} W)")
        if not (0 < l.on_h <= 24):
            warnings.append(f"{l.name}: on_h out of range ({l.on_h} h)")
        s_current = l.s_va / AC_VOLTAGE
        # sanity: energy vs rated*hours
        calc = l.p_total_w * l.on_h
        if l.energy_wh and calc and abs(l.energy_wh - calc) / calc > 0.02:
            warnings.append(f"{l.name}: measured_wh ({l.energy_wh:.0f}) != rated*qty*on_h ({calc:.0f})")
    return warnings


# ======================================================================
# 3.  LOAD ANALYSIS
# ======================================================================

def analyse(loads: List[Load]) -> dict:
    p = sum(l.p_total_w for l in loads)
    q = sum(l.q_var for l in loads)
    s = math.hypot(p, q)
    e = sum(l.energy_wh for l in loads)
    crit = [l for l in loads if l.critical]
    mot = [l for l in loads if l.is_motor]
    return {
        "connected_p_kw": p / 1000.0,
        "connected_q_kvar": q / 1000.0,
        "connected_s_kva": s / 1000.0,
        "power_factor": p / s if s else 1.0,
        "all_on_current_a": s / AC_VOLTAGE,
        "daily_energy_kwh": e / 1000.0,
        "critical_energy_kwh": sum(l.energy_wh for l in crit) / 1000.0,
        "noncritical_energy_kwh": (e - sum(l.energy_wh for l in crit)) / 1000.0,
        "motor_energy_kwh": sum(l.energy_wh for l in mot) / 1000.0,
        "critical_connected_kw": sum(l.p_total_w for l in crit) / 1000.0,
        "largest_motor_w": max((l.p_total_w for l in mot), default=0.0),
    }


# ======================================================================
# 4.  24-HOUR LOAD PROFILE  (energy-preserving)
# ======================================================================

def build_load_profile(loads: List[Load], dt_h: float, load_scale: float = 1.0):
    """Energy-preserving 24-h profile. DIVERSITY_FACTOR (a design policy) always applies;
    `load_scale` is the OPERATING-SCENARIO stressor and defaults to 1.0 (design load)."""
    n = int(round(24.0 / dt_h))
    t = [i * dt_h for i in range(n)]
    per_load = {}
    total = [0.0] * n
    crit = [0.0] * n
    for l in loads:
        w = [0.0] * n
        sch = SCHEDULE.get(l.name, DEFAULT_SCHEDULE)
        start = l.start_h if l.start_h is not None else sch["start"]
        mode = sch.get("mode", "block")
        if mode == "duty":
            window = sch.get("window", max(l.on_h, 1.0))
            duty = min(l.on_h / window, 1.0)
            a, b = start, start + window
            for i in range(n):
                if a <= t[i] < b:
                    w[i] = l.p_total_w * duty
        else:  # block
            a, b = start, start + l.on_h
            for i in range(n):
                if a <= t[i] < b:
                    w[i] = l.p_total_w
        # energy-preserve to the CSV Wh, then apply diversity, convert to kW
        got = sum(w) * dt_h
        if got > 0:
            scale = l.energy_wh / got
            w = [x * scale * DIVERSITY_FACTOR * load_scale / 1000.0 for x in w]
        per_load[l.name] = w
        for i in range(n):
            total[i] += w[i]
            if l.critical:
                crit[i] += w[i]
    noncrit = [total[i] - crit[i] for i in range(n)]
    return t, per_load, total, crit, noncrit


# ======================================================================
# 5.  PV PROFILE  (sin^2 clear-sky shape, scaled to kWp*PSH*PR)
# ======================================================================

def pv_profile(t: List[float], dt_h: float, kwp: float, psh: float) -> List[float]:
    pr = PV_SYSTEM_DERATE * PV_INVERTER_EFFICIENCY
    shape = []
    for ti in t:
        if SUNRISE_HOUR <= ti < SUNSET_HOUR:
            x = (ti - SUNRISE_HOUR) / (SUNSET_HOUR - SUNRISE_HOUR)
            shape.append(math.sin(math.pi * x) ** 2)
        else:
            shape.append(0.0)
    target_ac = kwp * psh * pr           # daily AC kWh
    area = sum(shape) * dt_h
    if area <= 0:
        return [0.0] * len(t)
    k = target_ac / area
    return [s * k for s in shape]        # kW AC


# ======================================================================
# 6.  SIZING:  PV / BATTERY / INVERTER
# ======================================================================

def size_pv(analysis: dict, total: list, dt_h: float) -> dict:
    pr = PV_SYSTEM_DERATE * PV_INVERTER_EFFICIENCY
    e_load = analysis["daily_energy_kwh"]
    # battery-cycled fraction on the design day (deficit vs a neutral PV) -> round-trip penalty
    pv_design = pv_profile([i * dt_h for i in range(len(total))], dt_h, 1.0, DESIGN_PSH)
    # scale a trial neutral array iteratively is overkill; estimate deficit at ~ evening load
    eta_rt = BATTERY_CHARGE_EFFICIENCY * BATTERY_DISCHARGE_EFFICIENCY
    # first pass: assume neutral array ~ e_load/(psh*pr); compute deficit against it
    kwp_trial = e_load / (DESIGN_PSH * pr)
    pv_trial = pv_profile([i * dt_h for i in range(len(total))], dt_h, kwp_trial, DESIGN_PSH)
    e_batt = sum(max(total[i] - pv_trial[i], 0.0) for i in range(len(total))) * dt_h
    e_direct = e_load - e_batt
    e_pv_needed = e_direct + e_batt / eta_rt
    kwp_neutral = e_pv_needed / (DESIGN_PSH * pr) * SAFETY_MARGIN
    kwp_installed = PV_SIZE_KWP if PV_SIZE_KWP else kwp_neutral * PV_HEADROOM_FACTOR
    modules = math.ceil(kwp_installed * 1000.0 / PV_MODULE_W)
    return {
        "performance_ratio": pr,
        "energy_neutral_kwp": kwp_neutral,
        "headroom_factor": PV_HEADROOM_FACTOR,
        "installed_kwp": kwp_installed,
        "module_w": PV_MODULE_W,
        "module_count": modules,
        "design_psh": DESIGN_PSH,
        "low_pv_psh": LOW_PV_PSH,
        "expected_energy_design_kwh": kwp_installed * DESIGN_PSH * pr,
        "expected_energy_lowpv_kwh": kwp_installed * LOW_PV_PSH * pr,
        "battery_cycled_kwh_designday": e_batt,
    }


def size_battery(analysis: dict, total: list, crit: list, dt_h: float, pv: dict) -> dict:
    # deficit on the BATTERY_SIZING_PSH day, with the installed PV array
    pv_kw = pv_profile([i * dt_h for i in range(len(total))], dt_h,
                       pv["installed_kwp"], BATTERY_SIZING_PSH)
    net = [pv_kw[i] - total[i] for i in range(len(total))]
    # deepest drawdown assuming battery starts full and refills on surplus
    reservoir = 0.0
    min_res = 0.0
    for i in range(len(net)):
        reservoir = min(0.0, reservoir + net[i] * dt_h)
        min_res = min(min_res, reservoir)
    deficit_ac = -min_res                                   # AC-side kWh to bridge
    usable_needed = deficit_ac / BATTERY_DISCHARGE_EFFICIENCY  # cells
    span = (BATTERY_MAX_SOC - BATTERY_MIN_SOC) * BATTERY_TEMP_DERATE * BATTERY_AGING_DERATE
    nominal_calc = usable_needed / span * SAFETY_MARGIN
    nominal = BATTERY_CAPACITY_KWH if BATTERY_CAPACITY_KWH else nominal_calc
    # power rating
    max_discharge_kw = max((-x for x in net), default=0.0)
    power_by_crate = nominal * BATTERY_C_RATE_MAX
    power = BATTERY_POWER_KW if BATTERY_POWER_KW else max(power_by_crate, max_discharge_kw)
    return {
        "sizing_psh": BATTERY_SIZING_PSH,
        "deficit_ac_kwh": deficit_ac,
        "usable_needed_kwh": usable_needed,
        "effective_usable_fraction": span,
        "nominal_calc_kwh": nominal_calc,
        "nominal_kwh": nominal,
        "usable_kwh": nominal * span,
        "power_kw": power,
        "c_rate": power / nominal if nominal else 0.0,
        "dc_voltage": BATTERY_DC_VOLTAGE,
        "ah_at_bus": nominal * 1000.0 / BATTERY_DC_VOLTAGE,
        "soc_min": BATTERY_MIN_SOC,
        "soc_max": BATTERY_MAX_SOC,
        "soc_init": BATTERY_INITIAL_SOC,
        "eta_charge": BATTERY_CHARGE_EFFICIENCY,
        "eta_discharge": BATTERY_DISCHARGE_EFFICIENCY,
        "dc_current_cont_a": power * 1000.0 / (INVERTER_EFFICIENCY * BATTERY_DC_VOLTAGE),
    }


def size_inverter(analysis: dict, total: list) -> dict:
    profile_peak = max(total) if total else 0.0
    all_on_kw = analysis["connected_p_kw"]
    all_on_kva = analysis["connected_s_kva"]
    kva = INVERTER_SIZE_KVA if INVERTER_SIZE_KVA else all_on_kva * SAFETY_MARGIN
    p_kw = kva * analysis["power_factor"]
    return {
        "continuous_kw": p_kw,
        "continuous_kva": kva,
        "scheduled_peak_kw": profile_peak,
        "all_on_kw": all_on_kw,
        "all_on_kva": all_on_kva,
        "max_ac_current_a": kva * 1000.0 / AC_VOLTAGE,
        "reactive_kvar": analysis["connected_q_kvar"],
        "surge_kva": kva * INVERTER_SURGE_FACTOR,
        "ambient_derated_kw": p_kw * INVERTER_AMBIENT_DERATE,
        "efficiency": INVERTER_EFFICIENCY,
    }


# ======================================================================
# 7.  CABLE FEEDER ESTIMATES  (preliminary)
# ======================================================================

_AC_TABLE = [(2.5, 27), (4, 37), (6, 46), (10, 63), (16, 85), (25, 112)]   # mm2, base A
_DC_TABLE = [(16, 85), (25, 110), (35, 135), (50, 168), (70, 207), (95, 251)]


def _pick(table, design_a, derate):
    for mm2, base in table:
        if base * derate >= design_a:
            return mm2
    return table[-1][0]


def size_cables(inverter: dict, battery: dict) -> dict:
    # AC sub-main
    ac_op = inverter["continuous_kva"] * 1000.0 / AC_VOLTAGE
    ac_design = ac_op * CABLE_DESIGN_FACTOR
    ac_mm2 = _pick(_AC_TABLE, ac_design, CABLE_INSTALL_DERATE)
    # DC battery feeder
    dc_op = battery["dc_current_cont_a"]
    dc_design = dc_op * CABLE_DESIGN_FACTOR
    dc_mm2 = _pick(_DC_TABLE, dc_design, 1.0)   # short run, 90C, no grouping derate
    return {
        "ac_submain": {"operating_a": ac_op, "design_a": ac_design, "size_mm2": ac_mm2,
                       "length_m": AC_FEEDER_LENGTH_M},
        "dc_battery": {"operating_a": dc_op, "design_a": dc_design, "size_mm2": dc_mm2,
                       "length_m": DC_FEEDER_LENGTH_M},
    }


# ======================================================================
# 8.  DRIVER
# ======================================================================

def run_sizing(write: bool = True) -> SizingResult:
    loads = read_loads(LOAD_CSV)
    warnings = validate(loads)
    analysis = analyse(loads)
    dt_h = TIME_STEP_MINUTES / 60.0

    # --- DESIGN profile (load_scale = 1.0): the basis for ALL sizing ---
    t, per_load, d_total, d_crit, d_noncrit = build_load_profile(loads, dt_h, 1.0)
    pv = size_pv(analysis, d_total, dt_h)          # uses DESIGN_PSH internally
    battery = size_battery(analysis, d_total, d_crit, dt_h, pv)  # uses LOW_PV_PSH internally
    inverter = size_inverter(analysis, d_total)
    cables = size_cables(inverter, battery)

    # --- OPERATING-SCENARIO profile handed to sim.py (does NOT affect sizing above) ---
    _, _, total, crit, noncrit = build_load_profile(loads, dt_h, SCENARIO_LOAD_SCALE)
    pv_kw = pv_profile(t, dt_h, pv["installed_kwp"], SCENARIO_PSH)

    result = SizingResult(
        meta={"load_csv": os.path.relpath(LOAD_CSV, HERE),
              "n_loads": len(loads), "warnings": warnings,
              "design_psh": DESIGN_PSH, "battery_sizing_psh": BATTERY_SIZING_PSH,
              "scenario_psh": SCENARIO_PSH, "load_scale": SCENARIO_LOAD_SCALE,
              "scenario_tag": scenario_tag()},
        config={"diversity_factor": DIVERSITY_FACTOR, "safety_margin": SAFETY_MARGIN,
                "ac_voltage": AC_VOLTAGE, "frequency": AC_FREQUENCY,
                "inverter_efficiency": INVERTER_EFFICIENCY,
                "time_step_minutes": TIME_STEP_MINUTES},
        loads=[asdict(l) for l in loads],
        analysis=analysis,
        profile={"dt_h": dt_h, "time_h": t,
                 "load_total_kw": total, "load_critical_kw": crit,
                 "load_noncritical_kw": noncrit, "pv_ac_kw": pv_kw},
        pv=pv, battery=battery, inverter=inverter, cables=cables,
    )

    if write:
        with open(OUTPUT_JSON, "w", encoding="utf-8") as fh:
            json.dump(asdict(result), fh, indent=2)
    return result


def _print_summary(r: SizingResult):
    a, pv, b, inv, c = r.analysis, r.pv, r.battery, r.inverter, r.cables
    print("=" * 68)
    print(f"PHASE A SIZING  (source: {r.meta['load_csv']}, {r.meta['n_loads']} loads)")
    print("=" * 68)
    if r.meta["warnings"]:
        print("VALIDATION WARNINGS:")
        for w in r.meta["warnings"]:
            print("  - " + w)
        print("-" * 68)
    print(f"Connected      : {a['connected_p_kw']:.3f} kW / {a['connected_s_kva']:.3f} kVA "
          f"(PF {a['power_factor']:.3f}), {a['all_on_current_a']:.1f} A all-on")
    print(f"Daily energy   : {a['daily_energy_kwh']:.2f} kWh  "
          f"(critical {a['critical_energy_kwh']:.2f}, non-critical {a['noncritical_energy_kwh']:.2f})")
    print(f"Scheduled peak : {inv['scheduled_peak_kw']:.2f} kW")
    print("-" * 68)
    print(f"PV ARRAY       : {pv['installed_kwp']:.2f} kWp installed "
          f"(neutral {pv['energy_neutral_kwp']:.2f} x headroom {pv['headroom_factor']:.2f}), "
          f"{pv['module_count']} x {pv['module_w']:.0f} W")
    print(f"                 PR {pv['performance_ratio']:.3f}; expect "
          f"{pv['expected_energy_design_kwh']:.1f} kWh (design) / "
          f"{pv['expected_energy_lowpv_kwh']:.1f} kWh (low-PV)")
    print(f"BATTERY        : {b['nominal_kwh']:.1f} kWh nominal @ {b['dc_voltage']:.1f} V "
          f"({b['ah_at_bus']:.0f} Ah); usable {b['usable_kwh']:.1f} kWh")
    print(f"                 sized on PSH {b['sizing_psh']:.1f}: deficit {b['deficit_ac_kwh']:.2f} kWh -> "
          f"usable need {b['usable_needed_kwh']:.2f} kWh")
    print(f"                 power {b['power_kw']:.2f} kW ({b['c_rate']:.2f} C), "
          f"SOC {b['soc_min']*100:.0f}-{b['soc_max']*100:.0f}%, init {b['soc_init']*100:.0f}%")
    print(f"INVERTER       : {inv['continuous_kw']:.2f} kW / {inv['continuous_kva']:.2f} kVA, "
          f"{inv['max_ac_current_a']:.1f} A, surge {inv['surge_kva']:.1f} kVA")
    print(f"                 45C-derated {inv['ambient_derated_kw']:.2f} kW; reactive {inv['reactive_kvar']:.2f} kvar")
    print(f"CABLES         : AC sub-main {c['ac_submain']['size_mm2']:.1f} mm2 "
          f"({c['ac_submain']['design_a']:.1f} A design); "
          f"DC battery {c['dc_battery']['size_mm2']:.1f} mm2 "
          f"({c['dc_battery']['design_a']:.0f} A design)")
    print("-" * 68)
    print(f"SIZED ON (design basis)  : PV PSH {DESIGN_PSH}, battery PSH {BATTERY_SIZING_PSH}, "
          f"loads x1.0")
    print(f"SIM WILL RUN (scenario)  : PV PSH {r.meta['scenario_psh']}, "
          f"loads x{r.meta['load_scale']}  <-- stress test only, does not resize")
    print(f"Wrote {os.path.relpath(OUTPUT_JSON, HERE)}  ->  now run sim.py")


if __name__ == "__main__":
    _print_summary(run_sizing(write=True))
