# Simulation — `sizing.py` → `sim.py`

A two-stage, modular pipeline. `sizing.py` is the **single source of truth**; `sim.py`
consumes its output and performs **no sizing of its own**.

```
data/phase_a_loads.csv  →  sizing.py  →  sizing_output.json  →  sim.py  →  sim_output.json
```

## Workflow

```bash
# 1. edit the CONFIG block at the top of sizing.py  (loads come from the CSV, not the code)
# 2. run the sizer  →  writes sizing_output.json
python sizing.py
# 3. run the simulator  →  reads sizing_output.json, writes sim_output.json
python sim.py
```

Change a parameter **once** in `sizing.py`'s `CONFIG` block, re-run `sizing.py`, then
`sim.py` — the simulation automatically reflects the change. You never edit `sim.py`.

### Design basis vs operating scenario (kept separate)

There are two distinct groups of knobs:

- **DESIGN basis** (`DESIGN_PSH`, `LOW_PV_PSH`, `DIVERSITY_FACTOR`, `SAFETY_MARGIN`, the
  efficiencies/limits, and any `*_SIZE`/`*_CAPACITY` overrides) — these **size the
  hardware**. The system is always sized on `DESIGN_PSH` (PV) and `LOW_PV_PSH` (battery)
  with the CSV loads.
- **OPERATING SCENARIO** (`SCENARIO_PSH`, `SCENARIO_LOAD_SCALE`) — these only decide what
  conditions the **already-sized** system is stressed against in the 24-h simulation. They
  do **not** resize anything. This lets you size once on the base case and then test the
  fixed hardware against a low-PV day, a high-load day, or both.

| Scenario | `SCENARIO_PSH` | `SCENARIO_LOAD_SCALE` |
|---|---|---|
| Base case | `DESIGN_PSH` (5.5) | `1.0` |
| Low PV | `LOW_PV_PSH` (2.5) | `1.0` |
| High load | `DESIGN_PSH` (5.5) | `1.25` |
| Low PV + high load | `LOW_PV_PSH` (2.5) | `1.25` |

The `sizing.py` printout states both — the design basis it sized on, and the scenario
`sim.py` will run — so the two are never confused.

## What each file does

**`sizing.py`**
- reads and validates the load CSV (path in `LOAD_CSV`); load ratings are fetched from the
  CSV, never hard-coded;
- builds the 24-h load profile (energy-preserving) at `TIME_STEP_MINUTES`;
- builds a location-specific PV profile from `DESIGN_PSH`/`SCENARIO_PSH`, tilt/azimuth and
  the loss stack;
- sizes PV (energy-neutral × explicit headroom), battery (from the low-PV-day deficit),
  inverter (all-on kVA) and the main AC/DC feeders;
- writes everything to `sizing_output.json`.

**`sim.py`**
- loads `sizing_output.json`;
- runs the 24-h energy/power-balance dispatch (PV→load, battery→load, proactive/relief
  non-critical shedding, PV→battery, curtailment);
- enforces SOC limits, battery power limits and inverter rating at every step;
- reports KPIs and pass/fail checks, writes `sim_output.json`;
- renders 7 result figures into a **per-scenario** folder `figs/<scenario_tag>/`
  (`base`, `low_pv`, `high_load`, `low_pv_high_load`), so each scenario keeps its own set:
  `01_load`, `02_pv_batt_vs_load`, `03_battery_power`, `04_soc`, `05_inverter`,
  `06_shed_curtail`, `07_energy_flows`. Set `MAKE_FIGURES = False` to skip; requires
  `matplotlib` (skipped gracefully if absent, and figure saves retry on transient file locks).
- applies EMS proactive non-critical shedding at `PROACTIVE_SHED_SOC = 0.40` — the threshold
  that secures critical load in all four scenarios on the 10 kWh battery
  (see `../results/scenario_comparison.md`).

## Sizing → sim interface (`sizing_output.json`)

| Section | Key contents |
|---|---|
| `meta` | CSV path, load count, validation warnings, scenario PSH, load scale |
| `config` | diversity, safety margin, voltage, inverter efficiency, time step |
| `analysis` | connected kW/kVA/PF, daily/critical/non-critical energy |
| `profile` | `time_h`, `load_total_kw`, `load_critical_kw`, `load_noncritical_kw`, `pv_ac_kw` |
| `pv` | installed kWp, PR, module count, expected energy |
| `battery` | nominal/usable kWh, power kW, SOC limits, efficiencies, DC voltage, current |
| `inverter` | continuous kW/kVA, max AC current, reactive, surge |
| `cables` | AC sub-main and DC battery feeder currents and sizes |

## Reusing for another case study

Point `LOAD_CSV` at a different file (e.g. `../data/case_b_loads.csv`) and adjust the
`CONFIG` block. The CSV may add optional columns `quantity` and `start_h` (per-load start
hour); if `start_h` is absent, the `SCHEDULE` dict (or a daytime-duty default) is used.
No sizing or simulation logic needs rewriting.

## Design policy vs physical derating

`DIVERSITY_FACTOR` and `SAFETY_MARGIN` are **policy knobs** (both 1.0). They are kept
separate from physical derating (SOC window, charge/discharge efficiency, temperature and
ageing deratings, cable install derate, inverter efficiency/ambient derate) — no hidden
assumptions are folded into the two policy factors.

## Scope

Energy/power-balance only. It does **not** model instantaneous AC voltage, frequency,
ROCOF or inverter control dynamics — see `../results/engineering_questions.md`.
