# Scenario 06 — Motor Starting Demand

## Purpose
Check the short-duration (surge) demand from motor inrush — a **power** constraint on the inverter and
battery, not an energy constraint. Motor loads: Air Conditioner (inverter), Hoover (universal motor),
Water Cooler (fixed-speed compressor), Blender (small universal motor).

## Assumptions
- **Air conditioner is inverter-driven (soft-start)** per its nameplate — it ramps the compressor and imposes
  **no** large locked-rotor inrush (nameplate max current 8.5 A ≈ 1.85 kVA). It is no longer the surge driver.
- The largest start transient is now the **Hoover** (1600 W universal motor): brief inrush ≈ 3× running.
- Worst event: **Hoover starts** while the Water Cooler compressor and Fan run.

## Changes from base case
Instantaneous power only; daily energy unchanged.

## Conditions
| Contribution | Power |
|---|---:|
| Hoover inrush (≈ 3 × 1.6 kW, fraction of a second) | ≈ 4.8 kW |
| Water Cooler (running) | 0.6 kW |
| Fan (running) | 0.05 kW |
| **Peak transient** | **≈ 5.5 kVA for < 1 s** |

## Component constraints
| Component | Requirement | Status |
|---|---|---|
| Inverter surge | ≥ 10 kVA for a few seconds | Comfortably covered by a 5 kW hybrid inverter's ~2× overload |
| Inverter continuous | 5 kW | Transient handled by surge |
| Battery short-duration power | ≈ 5.5 kVA ÷ (0.95 × 51.2 V) ≈ 113 A for < 1 s | Within the DC feeder rating |

## Expected sizing impact
Drives the **inverter surge margin** and battery short-duration current — but at a modest level now that the
AC soft-starts. No component upsize is required.

## Result / mitigations
- A **5 kW inverter with ≥ 10 kVA / few-second surge** covers the Hoover inrush with margin.
- Optional EMS start-sequencing avoids simultaneous motor starts entirely.

## Engineering conclusion
Motor starting is comfortably feasible. Because the air conditioner is inverter-driven, the earlier concern of
a large compressor locked-rotor inrush does not apply; the Hoover's brief universal-motor inrush (~5 kVA) sets
the modest surge requirement. Read the Water Cooler compressor's starting current from its nameplate to
confirm the small fixed-speed contribution.
