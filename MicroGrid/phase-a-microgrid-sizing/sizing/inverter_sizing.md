# Inverter Sizing — Grid-Forming Islanding Inverter

**Inputs:** load analysis (`sizing/load_sizing.md`, corrected AC), electrical basis
(`assumptions/electrical_assumptions.md`). **Policy factors:** `DF = 1.0`, `SM = 1.0`.

The inverter is sized on the **AC power it must deliver to the loads** as the single grid-forming source of
the island — **not** by adding PV kW + battery kW (those are DC inputs behind the same inverter).

## 1. Architecture and power flow
A single **hybrid, grid-forming** inverter forms the 230 V / 60 Hz reference, takes DC from the battery
(51.2 V) and the PV MPPT input (100–500 V), and delivers AC to the Phase A board. The instantaneous quantity
it must handle = the AC load at that instant (from PV, battery, or both).

## 2. Continuous rating

| Basis | Value |
|---|---:|
| Scheduled coincident peak (hour-avg) | 1.77 kW |
| Scheduled instantaneous peak | ≈ 2.2 kW |
| **All-on contingency (DF = 1.0)** | **5.08 kW / 5.40 kVA** |

- **Equation:** `P_inv ≥ max(scheduled peak, all-on contingency) × SM = 5.08 kW`.
- **Selection:** **5 kW / 5.5 kVA**. The 5.5 kVA nameplate covers the 5.40 kVA all-on apparent load.
- **High-ambient check:** at 45 °C the derate ≈ 0.80 → `5 × 0.80 = 4.0 kW` available. This exceeds the
  scheduled peak (2.2 kW) with wide margin; the 5.08 kW all-on case is managed by the **EMS interlock**
  (prevents Iron + Hoover + AC coinciding) plus the accepted non-critical shedding policy, so no oversize is
  required.

## 3. Apparent power and current

| Quantity | Equation | Value |
|---|---|---:|
| Connected apparent power (vector) | √(P² + Q²) | 5.40 kVA |
| **Inverter apparent rating** | ≥ S_vec | **5.5 kVA** |
| Max AC current | 5500 / 230 | **≈ 23.9 A** |

## 4. Reactive power capability
- Worst connected reactive demand `Q_conn = 1.84 kvar` (all-on; Water Cooler 0.80 + AC 0.47 dominate).
- **Requirement:** reactive capability ≥ **±1.85 kvar** (≈ 0.34 of 5.5 kVA), with headroom for a low-PF start.

## 5. Motor-starting / short-duration overload
- **Air conditioner is inverter-driven (soft-start)** — nameplate max current 8.5 A (≈ 1.85 kVA); it ramps
  its compressor and does **not** impose a large locked-rotor inrush. It is no longer the surge driver.
- **Largest remaining start transient:** the Hoover (1600 W universal motor) — brief inrush ≈ 3× running
  ≈ **5 kW for a fraction of a second**; and the Water Cooler (600 W fixed-speed compressor) DOL start.
- **Requirement:** surge capability ≥ **10 kVA for a few seconds** (≈ 2 × continuous) comfortably covers the
  Hoover inrush coincident with running loads. This is met by a standard 5 kW hybrid inverter's overload
  rating.

## 6. Grid-forming requirements
| Requirement | Value / spec |
|---|---|
| Function | Grid-forming (V/f source), black-start from battery |
| Output | 230 V, 60 Hz, pure sine, low THD |
| DC inputs | Battery 51.2 V + MPPT (100–500 V) |
| EMS | All-on interlock + SOC-based non-critical (AC) shedding at ≈ 25 % |
| Protection | Over/under V & f, over-current, DC reverse, over-temp, insulation monitoring |

> Energy/power-balance rating only. Dynamic voltage/frequency behaviour, ROCOF and motor-start voltage sag
> require a dynamic study — **not claimed here** (`results/engineering_questions.md`).

## 7. Inverter sizing summary

| Parameter | Value |
|---|---:|
| **Continuous real power** | **5 kW** |
| **Apparent power** | **5.5 kVA** |
| Max AC current | ≈ 23.9 A |
| Reactive capability | ≥ ±1.85 kvar |
| Surge | ≥ 10 kVA / few seconds (Hoover inrush; AC soft-starts) |
| Type | Single-phase 230 V / 60 Hz, grid-forming, black-start, ≥ 1 MPPT |
