# Scenario 03 — High Load

## Purpose
Test tolerance to load growth / underestimated runtime: all loads and durations scaled up by 25 %
(e.g. hotter days → more AC runtime, higher water-cooler duty).

## Assumptions
- Load and energy scaled ×1.25 → **≈ 16.1 kWh/day**.
- PV = 4.4 kWp, PSH 5.5 h (normal solar) → 18.9 kWh AC.
- Battery = 10 kWh, SOC₀ = 90 %.

## Changes from base case
Every load's energy and hourly power ×1.25.

## Conditions
| Quantity | Value |
|---|---:|
| Daily load | 16.1 kWh |
| PV AC energy | 18.9 kWh |
| Battery discharge | ≈ 5 kWh |

## Component constraints
- Instantaneous peak rises toward ~2.7 kW (still « 5 kW inverter).
- Battery deeper but within window.

## Result
| KPI | Value |
|---|---:|
| SOC min | **≈ 40 %** |
| Non-critical shed | 0 kWh |
| **Critical unmet** | **0 kWh ✅** |

## Engineering conclusion
The design absorbs a 25 % load increase on a normal solar day without shedding. Load growth alone is not the
binding constraint — the combination with low PV is (Scenario 04).
