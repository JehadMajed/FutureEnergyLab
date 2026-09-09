# Final Consolidated Sizing — Phase A Islanded Microgrid

All figures trace to `data/phase_a_loads.csv` (AC corrected to nameplate) and the documented assumptions.
Policy factors `DF = 1.0`, `SM = 1.0` (adjustable).

## Recommended preliminary ratings

| Component | Recommended Size | Unit | Main Basis | Key Assumptions |
|---|---|---|---|---|
| PV Array | **4.4** | kWp | Energy-neutral need 3.1 kWp + low-PV-day resilience | Riyadh PSH 5.5 h, PR 0.78, 8 × 550 W |
| PV Inverter (MPPT input) | **≥ 4.4** | kW | ≥ array power; DC/AC ≈ 0.88 | ≥ 1 MPPT, 100–500 V, ≥ 15 A/tracker |
| BESS | **10** | kWh | Low-PV-day discharge ≈ 7.3 kWh ÷ 0.95 ÷ 0.77; compound case covered by AC shedding | LiFePO₄; SOC 10–100 %; η_rt 0.90; derate 0.95 × 0.90 |
| Battery Power | **≥ 5** | kW | All-load contingency + motor reserve; ≈ 0.5 C | ≥ 113 A / <1 s pulse for Hoover start |
| Battery DC Voltage | **51.2** | V | 48 V class, safe touch voltage, common | 16S LiFePO₄; higher-V bus optional |
| Main (grid-forming) Inverter | **5 / 5.5** | kW/kVA | Scheduled peak 1.8 kW; all-on 5.08 kW managed by EMS | 45 °C derate 0.80; **≥ 10 kVA surge**; EMS interlock |
| AC Bus / Board | **40 / ≥5.5** | A / kVA | ≥ inverter output 23.9 A | 230 V 1-ph |
| DC Bus | **51.2 / ≥150** | V / A | ≥ battery cont. current 103 A | Busbar + Class-T fuse |
| Main AC Cable (sub-main) | **6** | mm² Cu | 29.9 A design, VD 0.97 % over ≤15 m | 10 mm² if > 20 m; 32 A MCB-C + RCD |
| Main DC Cable (battery→inverter) | **50** | mm² Cu | 103 A cont, VD 0.31 % | ≤ 2 m; Class-T 125 A |
| PV String Cable | **6** | mm² (1 kV) | 22 A design (1.56 × Isc) | PV isolator 25 A/1000 V |
| Earth / Bonding | **16** | mm² Cu | Protective bonding at this scale | Inverter-formed N–E bond in island |

## Reactive & motor specifications
- Inverter reactive capability: **≥ ±1.85 kvar** (worst connected Q = 1.84 kvar).
- Inverter surge: **≥ 10 kVA for a few seconds** — the air conditioner is inverter-driven (soft-start), so the
  Hoover's brief universal-motor inrush (~5 kVA) is the largest transient.

## Operating policy (confirmed with stakeholder)
- **Non-critical shedding is acceptable.** The EMS sheds the air conditioner when SOC ≤ ~25 %, guaranteeing
  critical supply on a compound low-PV + high-load day → **10 kWh battery retained**. (A 12 kWh battery would
  serve even that case with no shedding.)
- The same EMS enforces an all-on interlock.

## Protection (preliminary)
| Location | Device |
|---|---|
| AC main | 32 A MCB curve C + 40 A / 30 mA RCD Type A + Type 2 SPD |
| AC (Water Cooler, fixed-speed) | 10 A MCB curve D |
| Other AC finals (incl. inverter AC) | curve C MCBs per `sizing/ac_cable_sizing.md` |
| Battery DC | Class-T 125 A + DC disconnect 160 A/≥125 VDC + Type 2 DC SPD |
| PV DC | PV isolator 25 A/1000 V + Type 2 PV SPD |

## Design-load basis behind the table
| Quantity | Value |
|---|---:|
| Connected P / Q / S | 5.08 kW / 1.84 kvar / 5.40 kVA |
| Overall power factor | 0.941 |
| Daily energy | 12.85 kWh/day |
| Critical load / energy | 0.653 kW / 2.82 kWh/day |
| Scheduled coincident peak | ≈ 1.77 kW |
| All-on contingency | 5.08 kW / 5.40 kVA |
| Binding sizing scenario | Low-PV day (battery) / all-on contingency (inverter) |
| Compound worst case | Resolved by EMS non-critical (AC) shedding at SOC ≈ 25 % |
