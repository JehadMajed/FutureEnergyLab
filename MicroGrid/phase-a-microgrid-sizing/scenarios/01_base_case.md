# Scenario 01 — Base Case

## Purpose
Reference sizing point: representative Riyadh solar day, load per the ground-truth CSV (AC corrected to
nameplate 1.30 kW), `DF = 1.0`, `SM = 1.0`.

## Assumptions
- Load = `data/phase_a_loads.csv`, schedule per `assumptions/load_assumptions.md`. Daily load **12.85 kWh**.
- PV = 4.4 kWp, PSH 5.5 h, PR 0.78 → **18.9 kWh AC/day**.
- Battery = 10 kWh nominal, SOC₀ = 90 %, window 10–100 %.
- Inverter = 5 kW / 5.5 kVA grid-forming.

## Changes from base case
None — this *is* the base case.

## Conditions
| Quantity | Value |
|---|---:|
| Daily load | 12.85 kWh |
| PV AC energy | 18.9 kWh |
| Battery discharge | ≈ 3.5 kWh |
| PV curtailed | ≈ 8.7 kWh (battery fills by midday) |

## Component constraints
- Inverter loading peaks ≈ 1.8 kW (scheduled) « 5 kW.
- Battery C-rate ≈ 0.15 C peak « 0.5 C rating.

## Result
| KPI | Value |
|---|---:|
| SOC min / max | **59 % / 100 %** |
| SOC end | 59 % (self-restoring) |
| Non-critical shed | 0 kWh |
| **Critical unmet** | **0 kWh ✅** |

## Engineering conclusion
Phase A runs islanded for the full 24-hour cycle with large margins on a representative Riyadh day. The base
case does not stress any component; the design is driven by the low-PV scenario.
