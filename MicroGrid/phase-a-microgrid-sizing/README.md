# Phase A Microgrid — Preliminary Sizing (Islanded, 24-Hour Cycle)

<!-- Project status -->
![Status](https://img.shields.io/badge/status-preliminary%20design-orange)
![Stage](https://img.shields.io/badge/scope-Phase%20A-blue)
![Mode](https://img.shields.io/badge/operation-islanded%2024h-informational)
![Location](https://img.shields.io/badge/site-Riyadh%2C%20SA-brightgreen)
![Python](https://img.shields.io/badge/python-3.11%2B-blue?logo=python&logoColor=white)
![Dependencies](https://img.shields.io/badge/deps-stdlib%20%2B%20matplotlib-lightgrey)

<!-- Headline ratings -->
![PV](https://img.shields.io/badge/PV-4.4%20kWp-yellow)
![Battery](https://img.shields.io/badge/battery-10%20kWh%20LiFePO%E2%82%84-success)
![Inverter](https://img.shields.io/badge/inverter-5%20kW%20%2F%205.5%20kVA-blueviolet)
![DC bus](https://img.shields.io/badge/DC%20bus-51.2%20V-9cf)

<!-- Verification -->
![Critical load](https://img.shields.io/badge/critical%20load-100%25%20served-success)
![Scenarios](https://img.shields.io/badge/scenarios-4%2F4%20pass-success)
![Energy balance](https://img.shields.io/badge/24h%20energy%20balance-closed-success)
![Model](https://img.shields.io/badge/model-energy%2Fpower%20balance-informational)

A scaled-down, low-voltage-side laboratory version of the **NEOM City microgrid concept**, sized for the
Phase A loads only. Single-phase **230 V / 60 Hz** laboratory microgrid, **fully islanded (off-grid) for a
continuous 24-hour cycle**. This repository contains the preliminary electrical sizing of the main components
(PV array, PV/hybrid inverter, battery energy storage, grid-forming inverter, AC/DC cables, and supporting
equipment) with **fully traceable calculations**, verified by a runnable energy/power-balance simulation
across four operating cases (see `results/scenario_comparison.md` for the result plots).

## Ground-truth data source

All load calculations are derived from a single authoritative file:

```
data/phase_a_loads.csv
```

This CSV is the **only** valid input for Phase A load data. Every load figure in this repository traces back to it.

## Design intent

- Serve the Phase A loads for a full 24-hour cycle **with no grid connection**.
- **Critical loads must remain supplied** throughout the cycle. Non-critical loads may be shed under stress.
- Sizing is an **energy/power-balance** exercise. This package does **not** claim dynamic voltage/frequency
  stability — that requires a separate dynamic study (see `results/engineering_questions.md`).

## Initial policy factors (adjustable)

| Factor | Symbol | Value | Meaning |
|---|---|---:|---|
| Diversity factor | `DF` | **1.0** | Coincidence applied to the load profile (1.0 = no diversity credit) |
| Design / safety margin | `SM` | **1.0** | Engineering margin applied on top of every raw sizing result |

These two factors are **policy knobs only**. They are kept strictly separate from physical derating
(battery depth-of-discharge, SOC window, charge/discharge efficiency, temperature derate, ageing derate,
cable ambient/grouping derate, inverter efficiency and temperature derate). No hidden assumptions are folded
into `DF` or `SM`.

## Repository layout

```
phase-a-microgrid-sizing/
├── README.md
├── data/
│   └── phase_a_loads.csv            # ground-truth Phase A load list
├── assumptions/
│   ├── load_assumptions.md          # schedule + load-side assumptions
│   ├── pv_assumptions.md            # Riyadh solar resource + PV model
│   ├── battery_assumptions.md       # SOC window, efficiencies, derates
│   └── electrical_assumptions.md    # voltages, cable/installation basis
├── sizing/
│   ├── load_sizing.md               # load analysis + 24-h profile
│   ├── pv_sizing.md                 # full PV calculation breakdown
│   ├── battery_sizing.md            # full BESS calculation + 24-h balance
│   ├── inverter_sizing.md           # grid-forming inverter sizing
│   ├── ac_cable_sizing.md           # AC feeder sizing table
│   ├── dc_cable_sizing.md           # DC feeder sizing table
│   └── component_ratings.md         # buses, disconnects, protection
├── scenarios/
│   ├── 01_base_case.md
│   ├── 02_low_pv.md
│   ├── 03_high_load.md
│   ├── 04_low_pv_high_load.md
│   ├── 05_critical_load_only.md
│   └── 06_motor_demand.md
├── results/
│   ├── final_sizing.md              # consolidated recommended ratings
│   ├── sizing_summary.md            # one-page summary + verdict
│   ├── scenario_comparison.md       # 4 scenarios on fixed hardware (sim-generated)
│   └── engineering_questions.md     # open questions / data required
└── simulation/
    ├── sizing.py                    # single source of truth: CSV -> sizing_output.json
    ├── sim.py                       # 24-h energy-balance sim: reads sizing_output.json
    └── README.md                    # pipeline + interface documentation
```

## Simulation pipeline

The `simulation/` folder holds a runnable, modular model:

```bash
cd simulation
python sizing.py    # reads the CSV, sizes the system, writes sizing_output.json
python sim.py       # reads sizing_output.json, runs the 24-h simulation
```

Edit the `CONFIG` block in `sizing.py` once, re-run both, and the simulation reflects the
change automatically — `sim.py` never re-derives the sizing. See `simulation/README.md`.

## Headline result

| Component | Recommended preliminary rating |
|---|---|
| PV array | **4.4 kWp** (energy-neutral requirement 3.1 kWp; installed for low-PV-day resilience) |
| Grid-forming inverter | **5 kW / 5.5 kVA**, single-phase 230 V / 60 Hz |
| Battery (BESS) | **10 kWh** nominal LiFePO₄, 51.2 V |
| Battery power | **≥ 5 kW** charge/discharge (≈ 0.5 C) |
| Main AC cable | **6 mm² Cu** (10 mm² if run > 20 m) |
| Main DC cable | **50 mm² Cu** |

**Feasibility:** Phase A can run islanded for a full 24-hour cycle with critical loads secured in every
scenario. The compound worst case (simultaneous low-PV + high-load day) is handled by the confirmed policy of
**shedding the non-critical air conditioner** at low SOC, so the 10 kWh battery is retained. The air
conditioner is an **inverter (soft-start)** unit per its nameplate, so the inverter needs only a modest
**≥ 10 kVA surge** (set by the Hoover). See `results/sizing_summary.md`.

> **Note on the air-conditioner data:** its rated power is taken from the unit nameplate (inverter split unit,
> 1.30 kW input at high ambient, 8.5 A max) — the original CSV value of 2000 W was physically inconsistent
> with the nameplate and was corrected. See `assumptions/load_assumptions.md` §2a.

## How to read this repository

Every rating follows the chain: **what → why → data used → assumption → equation → calculation → implication.**
Start at `sizing/load_sizing.md`, then PV → battery → inverter → cables → components, then `results/`.

## Broader application: data-centre resilience

The same energy/power-balance model can be pointed at data-centre-style continuity questions — peak-load
management, backup-power coordination, and renewable-integration scenarios — using this lab microgrid as a
scaled testbed to validate approaches before any wider implementation. **Current status: concept and
simulation only** — no data-centre partner, deployment, or approval exists yet; this is a research direction,
not a running system.

## Google Colab notebook

A Google Colab version of this sizing/simulation workflow is planned and will be linked here once published.
