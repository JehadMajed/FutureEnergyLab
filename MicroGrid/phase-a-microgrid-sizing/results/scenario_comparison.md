# Scenario Comparison — Fixed Hardware, Four Operating Conditions

All four scenarios are run by `simulation/sim.py` against the **same hardware**, which is
sized once on the base design basis and **not** resized per scenario:

**Fixed system:** PV **4.43 kWp** · Battery **10 kWh / 5 kW** (LiFePO₄, 51.2 V) ·
Grid-forming inverter **5.08 kW / 5.40 kVA**.

EMS policy: proactive non-critical (air-conditioner) shedding when **SOC < 40 %**
(`PROACTIVE_SHED_SOC` in `sim.py`). Diversity = 1.0, safety margin = 1.0, SOC floor 10 %.

## How each scenario is set

In `simulation/sizing.py`, only the **operating-scenario** knobs change (the design basis
is fixed):

| Scenario | `SCENARIO_PSH` | `SCENARIO_LOAD_SCALE` | figures |
|---|---:|---:|---|
| Base | 5.5 | 1.00 | `simulation/figs/base/` |
| Low PV | 2.5 | 1.00 | `simulation/figs/low_pv/` |
| High load | 5.5 | 1.25 | `simulation/figs/high_load/` |
| Low PV + high load | 2.5 | 1.25 | `simulation/figs/low_pv_high_load/` |

## Results

| Scenario | Load kWh | Served | PV gen | Curtail | Bat dis | SOC min | SOC end | NC shed | **Crit unmet** | Max inv | Max C | Result |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| Base | 12.85 | 100.0 % | 18.98 | 10.03 | 5.93 | 37 % | 37 % | 0.00 | **0.000** | 1.77 | 0.17 | ✅ PASS |
| Low PV | 12.85 | 89.9 % | 8.63 | 1.39 | 7.62 | 29 % | 29 % | 1.30 | **0.000** | 1.77 | 0.17 | ✅ PASS |
| High load | 16.06 | 94.1 % | 18.98 | 8.47 | 7.21 | 27 % | 27 % | 0.95 | **0.000** | 2.21 | 0.23 | ✅ PASS |
| Low PV + high load | 16.06 | 80.0 % | 8.63 | 0.51 | 8.86 | 23 % | 23 % | 3.21 | **0.000** | 2.21 | 0.20 | ✅ PASS |

*(kWh unless noted. Max inv = peak inverter loading kW vs the 5.08 kW rating; Max C = peak
battery C-rate vs 0.5 limit. All scenarios: SOC floor 10 % respected, inverter and C-rate
within limits, energy balance and battery-state checks pass.)*

## Reading the comparison

- **Critical load is served 100 % in every scenario** (`crit unmet = 0`) — the primary
  design objective holds across all four operating conditions.
- **Base day** is effortless: 100 % of all load served, battery only lightly cycled
  (SOC 37 %), ~10 kWh PV curtailed.
- **Single stresses (Low PV, High load)** are absorbed with only modest non-critical
  shedding (1.3 kWh and 0.95 kWh) and healthy SOC floors (29 %, 27 %).
- **Compound worst case (Low PV + high load)** is the binding condition: 80 % of total
  load served, 3.21 kWh of non-critical (air conditioner) shed, SOC floor 23 % — but
  **critical stays fully supplied.**
- **Inverter and battery are never stressed on power**: peak inverter loading 2.21 kW
  (« 5.08 kW) and peak C-rate 0.23 (« 0.5) even in the worst case. The design is
  **energy-bound, not power-bound**.

## Why the 40 % shed threshold

At the earlier 25 % threshold the compound case left **0.068 kWh of critical load unmet**
(the AC was shed too late and the battery reached its floor before the critical-only
evening hours). Raising `PROACTIVE_SHED_SOC` to **40 %** sheds the non-critical AC slightly
earlier and secures critical load in **all** scenarios on the existing 10 kWh battery:

| Compound-case fix | Crit unmet | NC shed | SOC min | Result |
|---|---:|---:|---:|:--:|
| shed @ 25 %, 10 kWh | 0.068 | 2.16 | 10 % | ⚠️ FAIL |
| **shed @ 40 %, 10 kWh (adopted)** | **0.000** | 3.21 | 23 % | ✅ PASS |
| shed @ 25 %, 12 kWh (alternative) | 0.000 | 1.22 | 14 % | ✅ PASS |

The 40 % threshold is a **zero-cost EMS setting** that keeps the 10 kWh battery. The
trade-off is that it sheds a little more non-critical load on poor days (e.g. Low-PV served
drops from ~97 % to ~90 %) in exchange for a guaranteed critical supply. A 12 kWh battery is
the alternative if higher non-critical availability on poor days is wanted.

## Reproducing

```bash
cd simulation
# edit SCENARIO_PSH / SCENARIO_LOAD_SCALE per the table above
python sizing.py      # hardware unchanged; only the scenario handed to sim changes
python sim.py         # writes figs/<scenario>/ and sim_output.json
```

Each run writes its 7 figures (`01_load` … `07_energy_flows`) into
`simulation/figs/<scenario_tag>/`, where the tag is auto-derived (`base`, `low_pv`,
`high_load`, `low_pv_high_load`).
