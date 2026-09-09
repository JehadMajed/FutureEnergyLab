# Scenario 05 — Critical Load Only

## Purpose
Determine how long the system sustains **only the critical loads** (Water Cooler + Fan) after all
non-critical load is shed — the resilience / ride-through case.

## Assumptions
- Load = critical only: **2.82 kWh/day** (Water Cooler 2.40 + Fan 0.42).
- PV = 4.4 kWp, **PSH 2.5 h** (low-PV day) → 8.6 kWh AC available (far exceeds critical need).
- Battery = 10 kWh, SOC₀ = 90 %.

## Changes from base case
Non-critical loads (AC, Hoover, Iron, Blender = 10.03 kWh/day) removed.

## Conditions
| Quantity | Value |
|---|---:|
| Critical daily load | 2.82 kWh |
| PV AC (low-PV day) | 8.6 kWh |
| Battery net use | negligible (PV covers critical even on a poor day) |

## Component constraints
Trivial — critical load peak ≈ 0.28 kW « inverter and battery ratings.

## Result
| KPI | Value |
|---|---:|
| SOC min | **≈ 90 % (barely used)** on a low-PV day |
| **Critical unmet** | **0 kWh ✅** |
| Battery-only autonomy (no PV at all) | usable 7.7 kWh ÷ 2.82 kWh/day ≈ **~2.7 days** |

## Engineering conclusion
On critical load alone, even a poor solar day is comfortably covered and the battery is barely touched. With
**no** PV at all, the battery sustains critical loads for **≈ 2.5–3 days**. Critical-load survivability is
amply satisfied, confirming that proactive non-critical shedding (Scenario 04) robustly guarantees the
primary objective.
