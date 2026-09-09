# AC Cable Sizing (Preliminary, Steady-State)

**Basis:** `assumptions/electrical_assumptions.md`. Copper conductors, single-phase 230 V, combined
installation derate ≈ 0.70, design current `I_design = 1.25 × I_operating`, voltage-drop limits: sub-main
≤ 2 %, final circuits ≤ 3 %.

Approximate copper resistance used for voltage drop: 1.5 mm² ≈ 12.1, 2.5 mm² ≈ 7.4, 6 mm² ≈ 3.1,
10 mm² ≈ 1.83 mΩ/m (single conductor). VD (single-phase) = `2 × R × L × I`.

## 1. Main AC sub-main (inverter → Phase A distribution board)

| Item | Value | Basis |
|---|---:|---|
| Voltage / phase | 230 V, 1-phase | System |
| Power / PF | 5.5 kVA @ PF ~0.94 | Inverter rating |
| Operating current | 23.9 A | 5500 / 230 |
| Design current (×1.25) | 29.9 A | Continuous rule |
| Cable size | **6 mm² Cu** (10 mm² if run > 20 m) | Tabulated ≈ 46 A → derated 0.70 ≈ 32 A ≥ 29.9 A ✔ |
| Conductors | 2 (L + N) + CPC | Single-phase + earth |
| Assumed length | ≤ 15 m | Confirm on site |
| Voltage drop | 2 × 0.0031 × 15 × 23.9 ≈ **2.2 V (0.97 %)** | ≤ 2 % ✔ |
| Protection | 32 A MCB curve C + 40 A / 30 mA RCD + Type 2 SPD | See `component_ratings.md` |

*(With the corrected 5.5 kVA inverter, 6 mm² carries the 29.9 A design current after the 0.70 derate with
margin; step to 10 mm² only for runs beyond ~20 m to hold the 2 % voltage-drop limit.)*

## 2. Final circuits (distribution board → each load)

| Circuit | Op. current | Design (×1.25) | Cable (Cu) | Ampacity (derated) | Length | Voltage drop | Protection |
|---|---:|---:|---|---:|---:|---:|---|
| Air Conditioner (inverter) | 6.01 A | 7.5 A | **2.5 mm²** | ≈ 18 A ✔ | ≤ 15 m | ≈ 1.7 V (0.7 %) ✔ | 16 A MCB curve C (soft-start; max 8.5 A) |
| Hoover | 7.10 A | 8.9 A | **2.5 mm²** | ≈ 18 A ✔ | ≤ 15 m | ≈ 2.0 V (0.9 %) ✔ | 16 A MCB curve C |
| Iron | 5.22 A | 6.5 A | **2.5 mm²** | ≈ 18 A ✔ | ≤ 15 m | ≈ 1.4 V (0.6 %) ✔ | 16 A MCB curve C |
| Water Cooler | 4.35 A | 5.4 A | **1.5 mm²** | ≈ 13 A ✔ | ≤ 15 m | ≈ 1.9 V (0.8 %) ✔ | 10 A MCB **curve D** |
| Fan | 0.26 A | — | **1.5 mm²** | ≈ 13 A ✔ | ≤ 15 m | negligible | 6 A MCB curve C |
| Blender (socket) | 1.71 A | — | **2.5 mm²** | ≈ 18 A ✔ | ≤ 15 m | negligible | 16 A MCB curve C |

**Notes**
- **Curve D** breaker on the Water Cooler (fixed-speed compressor) tolerates inrush. The air conditioner is
  inverter-driven (soft-start) so its circuit uses curve C.
- All final circuits sit well inside the 3 % voltage-drop limit at the assumed ≤ 15 m lengths.
- Short-circuit: in island mode the fault current is inverter-limited (see `assumptions/electrical_assumptions.md`
  §4); confirm MCB tripping against the chosen inverter's fault-current profile.

## 3. AC cable summary

| Feeder | Cable | Protection |
|---|---|---|
| Main sub-main | **6 mm² Cu** (10 mm² if > 20 m) | 32 A MCB-C + 40 A/30 mA RCD + SPD |
| Air Conditioner (inverter) | 2.5 mm² | 16 A MCB-C |
| Hoover / Iron / Blender | 2.5 mm² | 16 A MCB-C |
| Water Cooler | 1.5 mm² | 10 A MCB-D (fixed-speed compressor) |
| Fan | 1.5 mm² | 6 A MCB-C |

*Curve D is retained only on the Water Cooler (fixed-speed compressor). The air conditioner is inverter-driven
and soft-starts, so curve C is adequate.*
