#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sim.py  --  24-hour islanded energy-balance simulation for the Phase A microgrid.

Consumes `sizing_output.json` produced by sizing.py. It performs NO sizing of its
own: PV size, battery size/limits, inverter rating, efficiencies, the load and PV
profiles and the time step ALL come from the sizing output.

Workflow:
    1. edit parameters in sizing.py
    2. python sizing.py        (writes sizing_output.json)
    3. python sim.py           (reads it, simulates, writes sim_output.json)

This is an ENERGY / POWER-BALANCE model. It does not solve instantaneous AC voltage,
frequency or inverter control dynamics; it tracks power flows and battery state of
charge at each time step and enforces the sizing limits.

Dispatch priority at each step:
    1. PV -> load (directly, through the inverter)
    2. Battery -> remaining load (limited by power rating, SOC floor, inverter headroom)
    3. Shed NON-CRITICAL load first if still short   (critical loads are protected)
    4. Any remaining shortfall on CRITICAL load is recorded as unmet (KPI to keep at 0)
    5. Surplus PV -> charge battery (limited by charge power, SOC ceiling)
    6. Remaining surplus PV -> curtailment
"""

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SIZING_JSON = os.path.join(HERE, "sizing_output.json")
SIM_JSON = os.path.join(HERE, "sim_output.json")
FIG_ROOT = os.path.join(HERE, "figs")   # each scenario gets its own subfolder under here

# Figure output: set to False to skip plotting (e.g. if matplotlib is unavailable).
MAKE_FIGURES = True

# Optional proactive non-critical shedding: shed non-critical load once SOC drops
# below this fraction (protects critical loads on low-PV days). Set to 0.0 to disable.
# 0.40 secures the critical load in every scenario incl. the compound low-PV + high-load
# worst case on the base 10 kWh battery (see results/scenario_comparison.md).
PROACTIVE_SHED_SOC = 0.40


def load_sizing() -> dict:
    if not os.path.exists(SIZING_JSON):
        raise FileNotFoundError(
            f"{os.path.basename(SIZING_JSON)} not found. Run sizing.py first.")
    with open(SIZING_JSON, encoding="utf-8") as fh:
        return json.load(fh)


def simulate(s: dict) -> dict:
    prof = s["profile"]
    dt = prof["dt_h"]
    t = prof["time_h"]
    load = prof["load_total_kw"]
    crit = prof["load_critical_kw"]
    ncrit = prof["load_noncritical_kw"]
    pv = prof["pv_ac_kw"]
    n = len(t)

    b = s["battery"]
    inv = s["inverter"]
    ei = inv["efficiency"]
    ed = b["eta_discharge"]
    ec = b["eta_charge"]

    # effective (temperature + ageing derated) capacity that the SOC window rides on.
    #   usable_kwh = nominal * (soc_max - soc_min) * temp_derate * age_derate
    #   -> eff_cap  = nominal * temp_derate * age_derate = usable_kwh / (soc_max - soc_min)
    span = b["soc_max"] - b["soc_min"]
    eff_cap = b["usable_kwh"] / span if span else 0.0
    e_max = b["soc_max"] * eff_cap
    e_min = b["soc_min"] * eff_cap
    e = b["soc_init"] * eff_cap
    p_dis_max = b["power_kw"]
    p_chg_max = b["power_kw"]
    inv_rating = inv["continuous_kw"]

    # per-step records
    rec = {k: [0.0] * n for k in
           ("load", "crit", "ncrit", "pv", "pv_to_load", "pv_to_batt", "pv_curtail",
            "batt_dis", "batt_chg", "batt_ac_out", "batt_p", "soc", "inv_load", "losses",
            "served", "shed", "unmet")}
    e_start = e

    for i in range(n):
        L, Lc, Lnc, PV = load[i], crit[i], ncrit[i], pv[i]
        soc = e / eff_cap if eff_cap else 0.0

        # 1) PV -> load (through inverter, capped at inverter rating)
        pv_to_load = min(PV, L, inv_rating)
        rem = L - pv_to_load

        # optional proactive non-critical shed on low SOC
        forced_shed = 0.0
        if PROACTIVE_SHED_SOC > 0 and soc < PROACTIVE_SHED_SOC and rem > Lc:
            forced_shed = min(rem - Lc, Lnc)   # drop non-critical down to critical
            rem -= forced_shed

        # 2) battery -> remaining load
        e_avail_dc = max(e - e_min, 0.0) / dt          # DC kW the cells can give this step
        bat_ac_cap = min(p_dis_max * ed, e_avail_dc * ed) * ei
        headroom = max(inv_rating - pv_to_load, 0.0)
        bat_to_load = min(rem, bat_ac_cap, headroom)
        bat_dc_out = bat_to_load / (ed * ei) if bat_to_load > 0 else 0.0
        rem -= bat_to_load

        # 3) shed non-critical, then 4) critical unmet
        shed = min(rem, max(Lnc - forced_shed, 0.0))
        rem -= shed
        unmet = max(rem, 0.0)
        total_shed = forced_shed + shed
        served = L - total_shed - unmet

        # 5) surplus PV -> charge battery
        pv_left = PV - pv_to_load
        chg_dc_in = min(pv_left, p_chg_max, max(e_max - e, 0.0) / dt / ec)
        stored = chg_dc_in * ec
        curtail = max(pv_left - chg_dc_in, 0.0)

        # state update
        e = e - bat_dc_out * dt + stored * dt
        e = min(max(e, e_min), e_max)

        rec["load"][i] = L
        rec["crit"][i] = Lc
        rec["ncrit"][i] = Lnc
        rec["pv"][i] = PV
        rec["pv_to_load"][i] = pv_to_load
        rec["pv_to_batt"][i] = chg_dc_in
        rec["pv_curtail"][i] = curtail
        rec["batt_dis"][i] = bat_dc_out
        rec["batt_chg"][i] = chg_dc_in
        rec["batt_ac_out"][i] = bat_to_load
        rec["batt_p"][i] = bat_dc_out - chg_dc_in
        rec["soc"][i] = e / eff_cap if eff_cap else 0.0
        rec["inv_load"][i] = pv_to_load + bat_to_load
        rec["losses"][i] = (bat_dc_out - bat_to_load) + (chg_dc_in - stored)
        rec["served"][i] = served
        rec["shed"][i] = total_shed
        rec["unmet"][i] = unmet

    # KPIs
    E = lambda key: sum(rec[key]) * dt
    soc_series = rec["soc"]
    kpis = {
        "daily_load_kwh": E("load"),
        "energy_served_kwh": E("served"),
        "critical_load_kwh": E("crit"),
        "critical_unmet_kwh": E("unmet"),
        "noncritical_shed_kwh": E("shed"),
        "pv_generation_kwh": E("pv"),
        "pv_to_load_kwh": E("pv_to_load"),
        "pv_curtailed_kwh": E("pv_curtail"),
        "battery_discharge_kwh": E("batt_dis"),
        "battery_charge_kwh": E("batt_chg"),
        "conversion_losses_kwh": E("losses"),
        "soc_min_pct": min(soc_series) * 100,
        "soc_max_pct": max(soc_series) * 100,
        "soc_end_pct": soc_series[-1] * 100,
        "max_inverter_load_kw": max(rec["inv_load"]),
        "max_battery_power_kw": max(abs(p) for p in rec["batt_p"]),
        "max_c_rate": max(abs(p) for p in rec["batt_p"]) / b["nominal_kwh"] if b["nominal_kwh"] else 0.0,
    }
    # closure 1: AC node -- served must equal PV-to-load plus battery AC output
    ac_residual = (E("served") - E("pv_to_load") - sum(rec["batt_ac_out"]) * dt)
    # closure 2: battery state -- SOC change must equal (stored in - discharged out)
    batt_residual = ((e - e_start) - (E("batt_chg") * ec - E("batt_dis")))
    kpis["balance_residual_kwh"] = ac_residual
    kpis["battery_state_residual_kwh"] = batt_residual

    checks = {
        "critical_fully_served": kpis["critical_unmet_kwh"] < 1e-3,
        "soc_floor_respected": min(soc_series) >= b["soc_min"] - 1e-3,
        "inverter_within_rating": kpis["max_inverter_load_kw"] <= inv["continuous_kw"] + 1e-6,
        "battery_within_power": kpis["max_battery_power_kw"] <= b["power_kw"] + 1e-6,
        "energy_balance_closes": abs(kpis["balance_residual_kwh"]) < 1e-6,
        "battery_state_consistent": abs(kpis["battery_state_residual_kwh"]) < 1e-6,
    }
    return {"t": t, "records": rec, "kpis": kpis, "checks": checks}


def _print(s: dict, out: dict):
    k, c = out["kpis"], out["checks"]
    print("=" * 68)
    print(f"24-HOUR ISLANDING SIMULATION  (scenario PSH {s['meta']['scenario_psh']}, "
          f"load x{s['meta']['load_scale']}, dt {s['config']['time_step_minutes']} min)")
    print(f"System: PV {s['pv']['installed_kwp']:.2f} kWp | "
          f"Battery {s['battery']['nominal_kwh']:.1f} kWh / {s['battery']['power_kw']:.1f} kW | "
          f"Inverter {s['inverter']['continuous_kw']:.2f} kW")
    print("=" * 68)
    print(f"  Daily load demand        : {k['daily_load_kwh']:7.2f} kWh")
    print(f"  Energy served            : {k['energy_served_kwh']:7.2f} kWh "
          f"({100*k['energy_served_kwh']/k['daily_load_kwh']:.1f} %)")
    print(f"  Critical load demand     : {k['critical_load_kwh']:7.2f} kWh")
    print(f"  Critical UNMET           : {k['critical_unmet_kwh']:7.3f} kWh "
          f"({'PASS' if c['critical_fully_served'] else 'FAIL'})")
    print(f"  Non-critical shed        : {k['noncritical_shed_kwh']:7.2f} kWh")
    print(f"  PV generation            : {k['pv_generation_kwh']:7.2f} kWh")
    print(f"  PV curtailed             : {k['pv_curtailed_kwh']:7.2f} kWh")
    print(f"  Battery discharge / charge: {k['battery_discharge_kwh']:6.2f} / "
          f"{k['battery_charge_kwh']:.2f} kWh")
    print(f"  Conversion losses        : {k['conversion_losses_kwh']:7.2f} kWh")
    print(f"  SOC min / max / end      : {k['soc_min_pct']:.0f}% / "
          f"{k['soc_max_pct']:.0f}% / {k['soc_end_pct']:.0f}%")
    print(f"  Max inverter load        : {k['max_inverter_load_kw']:7.2f} kW "
          f"/ {s['inverter']['continuous_kw']:.2f} kW rating")
    print(f"  Max battery power / C    : {k['max_battery_power_kw']:7.2f} kW / "
          f"{k['max_c_rate']:.2f} C")
    print(f"  Energy-balance residual  : {k['balance_residual_kwh']:+7.3f} kWh (~0)")
    print("-" * 68)
    print("  CHECKS: " + "  ".join(f"{name}={'OK' if ok else 'FAIL'}"
                                    for name, ok in c.items()))
    # compact hourly table (sample every hour)
    print("-" * 68)
    print("  hour  load   pv   batt(+dis/-chg)  soc%   shed  unmet")
    t = out["t"]; r = out["records"]
    step = max(1, int(round(1.0 / s["profile"]["dt_h"])))
    for i in range(0, len(t), step):
        print(f"  {t[i]:4.1f}  {r['load'][i]:5.2f} {r['pv'][i]:5.2f}  "
              f"{r['batt_p'][i]:+6.2f}          {r['soc'][i]*100:4.0f}  "
              f"{r['shed'][i]:5.2f} {r['unmet'][i]:5.2f}")
    print("-" * 68)
    print(f"  Wrote {os.path.relpath(SIM_JSON, HERE)}")


def make_figures(s: dict, out: dict):
    """Render the standard 24-hour result figures to FIG_DIR. Optional: controlled by
    MAKE_FIGURES and skipped gracefully if matplotlib is not installed."""
    if not MAKE_FIGURES:
        return
    try:
        import matplotlib
        matplotlib.use("Agg")            # headless / file output
        import matplotlib.pyplot as plt
    except ImportError:
        print("  (matplotlib not available -> figures skipped)")
        return

    tag = s["meta"].get("scenario_tag", "base")
    fig_dir = os.path.join(FIG_ROOT, tag)
    os.makedirs(fig_dir, exist_ok=True)
    t = out["t"]
    r = out["records"]
    b, inv, pv = s["battery"], s["inverter"], s["pv"]

    import time
    saved, failed = [], []

    def _save(fig, name):
        fig.tight_layout()
        path = os.path.join(fig_dir, name)
        for attempt in range(3):            # retry: Desktop/synced folders can transiently lock files
            try:
                fig.savefig(path, dpi=110)
                saved.append(name)
                break
            except OSError:
                time.sleep(0.4)
        else:
            failed.append(name)
        plt.close(fig)

    # 1) load: total / critical / non-critical
    fig, ax = plt.subplots(figsize=(9, 4))
    ax.plot(t, r["load"], label="total load", lw=2)
    ax.plot(t, r["crit"], label="critical", lw=1.5)
    ax.plot(t, r["ncrit"], label="non-critical", lw=1, ls="--")
    ax.set(xlabel="hour", ylabel="kW", title="24-h load", xlim=(0, 24))
    ax.legend(); ax.grid(alpha=.3)
    _save(fig, "01_load.png")

    # 2) PV + battery discharge vs load, with curtailment
    fig, ax = plt.subplots(figsize=(9, 4))
    ax.plot(t, r["pv"], label="PV (AC)", color="tab:orange", lw=2)
    ax.plot(t, r["load"], label="load", color="tab:blue", lw=1.5)
    batt_dis = [max(p, 0) for p in r["batt_p"]]
    ax.plot(t, [r["pv"][i] + batt_dis[i] for i in range(len(t))],
            label="PV + battery discharge", color="tab:green", ls="--")
    ax.fill_between(t, 0, r["pv_curtail"], color="red", alpha=.3, label="PV curtailed")
    ax.set(xlabel="hour", ylabel="kW", title="PV + battery vs load", xlim=(0, 24))
    ax.legend(); ax.grid(alpha=.3)
    _save(fig, "02_pv_batt_vs_load.png")

    # 3) battery power (+discharge / -charge)
    fig, ax = plt.subplots(figsize=(9, 4))
    ax.fill_between(t, 0, [max(p, 0) for p in r["batt_p"]], color="tab:green", alpha=.5, label="discharge")
    ax.fill_between(t, 0, [min(p, 0) for p in r["batt_p"]], color="tab:red", alpha=.5, label="charge")
    ax.set(xlabel="hour", ylabel="kW  (+dis / -chg)", title="battery power", xlim=(0, 24))
    ax.legend(); ax.grid(alpha=.3)
    _save(fig, "03_battery_power.png")

    # 4) SOC trajectory
    fig, ax = plt.subplots(figsize=(9, 4))
    ax.plot(t, [x * 100 for x in r["soc"]], color="tab:purple", lw=2)
    ax.axhline(b["soc_min"] * 100, color="red", ls="--", label="SOC min")
    ax.axhline(b["soc_max"] * 100, color="grey", ls=":")
    ax.set(xlabel="hour", ylabel="SOC %", title="battery SOC", xlim=(0, 24), ylim=(0, 100))
    ax.legend(); ax.grid(alpha=.3)
    _save(fig, "04_soc.png")

    # 5) inverter loading vs rating
    fig, ax = plt.subplots(figsize=(9, 4))
    ax.plot(t, r["inv_load"], lw=2, label="inverter load")
    ax.axhline(inv["continuous_kw"], color="red", ls="--", label="inverter rating")
    ax.set(xlabel="hour", ylabel="kW", title="inverter loading", xlim=(0, 24))
    ax.legend(); ax.grid(alpha=.3)
    _save(fig, "05_inverter.png")

    # 6) shedding / curtailment / unmet
    fig, ax = plt.subplots(figsize=(9, 4))
    ax.fill_between(t, 0, r["shed"], color="orange", alpha=.5, label="non-critical shed")
    ax.fill_between(t, 0, r["unmet"], color="black", alpha=.6, label="critical unmet")
    ax.fill_between(t, 0, r["pv_curtail"], color="red", alpha=.3, label="PV curtailed")
    ax.set(xlabel="hour", ylabel="kW", title="shedding / curtailment / unmet", xlim=(0, 24))
    ax.legend(); ax.grid(alpha=.3)
    _save(fig, "06_shed_curtail.png")

    # 7) cumulative energy flows
    dt = s["profile"]["dt_h"]
    def cum(key, series=None):
        vals = series if series is not None else r[key]
        acc, o = 0.0, []
        for v in vals:
            acc += v * dt; o.append(acc)
        return o
    fig, ax = plt.subplots(figsize=(9, 4))
    ax.plot(t, cum("load"), label="load demand")
    ax.plot(t, cum("pv"), label="PV")
    ax.plot(t, cum(None, [max(p, 0) for p in r["batt_p"]]), label="batt discharge")
    ax.plot(t, cum(None, [-min(p, 0) for p in r["batt_p"]]), label="batt charge")
    ax.plot(t, cum("pv_curtail"), label="PV curtailed")
    ax.set(xlabel="hour", ylabel="kWh (cumulative)", title="energy flows", xlim=(0, 24))
    ax.legend(); ax.grid(alpha=.3)
    _save(fig, "07_energy_flows.png")

    print(f"  Wrote {len(saved)} figures to {os.path.relpath(fig_dir, HERE)}/"
          + (f"  (skipped after retries: {', '.join(failed)} -- file locked, "
             f"close any image preview/sync and re-run)" if failed else ""))


def main():
    s = load_sizing()
    out = simulate(s)
    with open(SIM_JSON, "w", encoding="utf-8") as fh:
        json.dump({"meta": s["meta"], "kpis": out["kpis"], "checks": out["checks"]},
                  fh, indent=2)
    _print(s, out)
    make_figures(s, out)


if __name__ == "__main__":
    main()
