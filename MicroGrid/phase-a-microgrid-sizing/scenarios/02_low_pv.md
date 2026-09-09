# Scenario 02 — Low PV (Cloudy / Dusty Day)

## Purpose
Test the design against a poor solar day — the **battery-sizing driver**. With no grid, a single overcast or
heavy-dust day in Riyadh must be ridden through on storage.

## Assumptions
- Load unchanged (12.85 kWh, base schedule).
- PV = 4.4 kWp but **PSH 2.5 h** (low-PV design day), PR 0.78 → **8.6 kWh AC/day**.
- Battery = 10 kWh, SOC₀ = 90 %.

## Changes from base case
PV energy drops from 18.9 to 8.6 kWh/day (−54 %).

## Conditions
| Quantity | Value |
|---|---:|
| Daily load | 12.85 kWh |
| PV AC energy | 8.6 kWh |
| Battery discharge | ≈ 7.3 kWh (binding) |

## Component constraints
- Battery drawn deeper; C-rate still ≤ 0.5 C.
- Inverter loading unchanged (~1.8 kW peak).

## Expected sizing impact
Sets the **nominal battery capacity**: cells supply ≈ 7.3 / 0.95 ≈ 7.7 kWh → ~10 kWh nominal at the 10 %
floor with derates.

## Result
| KPI | Value |
|---|---:|
| SOC min | **≈ 27 %** |
| Non-critical shed | 0 kWh |
| **Critical unmet** | **0 kWh ✅** |

## Engineering conclusion
A 10 kWh battery bridges one full low-PV day with all loads served and ≈ 17 % SOC margin above the floor.
Two consecutive low-PV days would require non-critical (AC) shedding — see `scenarios/04_low_pv_high_load.md`.
