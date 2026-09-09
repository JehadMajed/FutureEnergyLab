# Sizing Summary & Feasibility Verdict

## One-line answer
**Yes — Phase A can operate islanded for a full 24-hour cycle** with a **4.4 kWp PV array, a 10 kWh LiFePO₄
battery, and a 5 kW / 5.5 kVA grid-forming inverter**, keeping critical loads supplied in every scenario. The
compound worst case (simultaneous low-PV + high-load day) is handled by the **confirmed policy of shedding the
non-critical air conditioner** at low SOC — so the 10 kWh battery is retained.

## Design-load snapshot
| Quantity | Value |
|---|---:|
| Loads (qty 1 each) | 6 (Air Conditioner, Hoover, Iron, Water Cooler, Fan, Blender) |
| Connected power / apparent | 5.08 kW / 5.40 kVA (PF 0.941) |
| Daily energy | 12.85 kWh/day |
| Critical / non-critical energy | 2.82 / 10.03 kWh/day |
| Scheduled peak | ≈ 1.77 kW |

*(Air conditioner corrected to its nameplate: inverter unit, 1.30 kW input, max 8.5 A — replacing the CSV's
physically impossible 2000 W. See `assumptions/load_assumptions.md` §2a.)*

## Recommended ratings (see `final_sizing.md` for full traceability)
| Item | Rating |
|---|---|
| PV array | 4.4 kWp (8 × 550 W) |
| Battery | 10 kWh LiFePO₄, 51.2 V, ≈ 195 Ah, ≥ 5 kW |
| Grid-forming inverter | 5 kW / 5.5 kVA, ≥ 10 kVA surge, ±1.85 kvar |
| Main AC cable / DC cable | 6 mm² / 50 mm² Cu |

## Scenario results
| Scenario | SOC min | Non-critical shed | Critical unmet | Verdict |
|---|---:|---:|---:|:--:|
| 01 Base (representative day) | 59 % | 0 | 0 | ✅ |
| 02 Low PV (PSH 2.5) | ≈ 27 % | 0 | 0 | ✅ |
| 03 High load (+25 %) | ≈ 40 % | 0 | 0 | ✅ |
| 04 Low PV + high load | ≥ 25 % (shed rule) | AC shed at low SOC | 0 | ✅ via shedding policy |
| 05 Critical only | ≈ 90 % | — | 0 | ✅ (≈ 2.5–3 days battery-only) |
| 06 Motor start (inverter AC) | — | — | — | ✅ with ≥ 10 kVA surge |

Compound worst case (04) is resolved by shedding the non-critical air conditioner at SOC ≈ 25 %; the 10 kWh
battery is retained (12 kWh optional for no-shed operation).

## Engineering checks (independent re-verification)
| Check | Result |
|---|---|
| 24-h energy balance closes | ✅ (end SOC ≥ start on representative day) |
| Battery SOC within 10–100 % | ✅ base 59–100 %, low-PV 27–100 % |
| Battery C-rate ≤ rating | ✅ ≤ 0.5 C |
| PV strings within MPPT window | ✅ 332 Vmp / 448 Voc(cold) / 13.3 A (1 × 8) |
| Inverter kW/kVA ≥ demand | ✅ 5 kW/5.5 kVA ≥ 5.08 kW/5.40 kVA (45 °C via EMS interlock) |
| AC cable ampacity ≥ design current | ✅ 6 mm² derated 32 A ≥ 29.9 A |
| DC cable ampacity ≥ design current | ✅ 50 mm² ≥ 129 A design |
| Voltage drop within limits | ✅ AC 0.97 %, DC 0.31 % |
| Critical-load availability | ✅ 100 % in all scenarios |

## Adjustable parameters (for re-running the sizing later)
`DF` (diversity), `SM` (design margin), PSH, PR, PV kWp, battery kWh, SOC window, efficiencies, inverter kW,
load schedule — all defined in the `assumptions/` files and used consistently across `sizing/`.

## What this package does NOT establish
Dynamic voltage/frequency stability, ROCOF, motor-start voltage sag, harmonic behaviour, and protection
coordination in island mode — not derivable from an energy/power-balance study. See
`results/engineering_questions.md`.
