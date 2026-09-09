# Load Analysis & 24-Hour Profile

**Source:** `data/phase_a_loads.csv` (ground-truth). **Policy factors:** `DF = 1.0`, `SM = 1.0`.


## 1. Per-load electrical quantities

`Q = P·tan(cos⁻¹ PF)`; `S = P / PF`; `I = S / 230`.

| Load | P (W) | PF | Q (var) | S (VA) | On-h | Energy (Wh) | I @230 V (A) | Motor | Critical |
|---|---:|---:|---:|---:|---:|---:|---:|:--:|:--:|
| Air Conditioner (inverter) | 1300 | 0.94 | 472 | 1383 | 6.0 | 7800 | 6.01 | Y (soft-start) | – |
| Hoover | 1600 | 0.98 | 325 | 1633 | 1.0 | 1600 | 7.10 | Y | – |
| Iron | 1200 | 1.00 | 0 | 1200 | 0.5 | 600 | 5.22 | – | – |
| Water Cooler | 600 | 0.60 | 800 | 1000 | 4.0 | 2400 | 4.35 | Y | **Y** |
| Fan | 53 | 0.90 | 26 | 59 | 8.0 | 424 | 0.26 | – | **Y** |
| Blender | 330 | 0.84 | 213 | 393 | 0.083 | 27 | 1.71 | Y | – |

## 2. Connected totals

| Quantity | Symbol | Equation | Value |
|---|---|---|---:|
| Connected real power | `P_conn` | Σ P | **5.083 kW** |
| Connected reactive power | `Q_conn` | Σ Q | **1.836 kvar** |
| Connected apparent power (vector) | `S_vec` | √(P_conn² + Q_conn²) | **5.404 kVA** |
| Overall displacement power factor | `PF_sys` | P_conn / S_vec | **0.941** |
| Single-phase current (all-on) | `I_conn` | S_vec / 230 | **23.5 A** |

## 3. Daily energy

| Quantity | Equation | Value |
|---|---|---:|
| **Daily load energy** | Σ measured_wh | **12.851 kWh/day** |
| Critical energy (Water Cooler + Fan) | Σ crit | **2.824 kWh/day** |
| Non-critical energy | E_day − crit | **10.027 kWh/day** |
| Motor-load energy (AC + Hoover + Water Cooler + Blender) | Σ motor | 11.827 kWh/day |

## 4. Classification summary

| Class | Connected P | Daily energy | Members |
|---|---:|---:|---|
| Critical | 0.653 kW | 2.824 kWh | Water Cooler, Fan |
| Non-critical | 4.430 kW | 10.027 kWh | Air Conditioner, Hoover, Iron, Blender |
| Motor | 3.830 kW | 11.827 kWh | Air Conditioner, Hoover, Water Cooler, Blender |
| Non-motor | 1.253 kW | 1.024 kWh | Iron, Fan |
| Largest single motor | 1.600 kW (Hoover) | — | AC is now 1.30 kW and inverter-driven (soft-start) |

## 5. 24-hour load profile (energy-preserving, DF = 1.0)

Values are **kWh per hour** (= average kW during the hour); each appliance integrates to its exact energy.

| Hour | AC | Hoover | Iron | Water Cooler | Fan | Blender | **Total** | of which Critical |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 00–06 | – | – | – | – | – | – | **0.000** | 0.000 |
| 07 | – | – | 0.600 | – | – | – | **0.600** | 0.000 |
| 08 | – | – | – | 0.171 | – | 0.027 | **0.199** | 0.171 |
| 09 | – | 1.600 | – | 0.171 | – | – | **1.771** | 0.171 |
| 10 | – | – | – | 0.171 | – | – | **0.171** | 0.171 |
| 11 | – | – | – | 0.171 | – | – | **0.171** | 0.171 |
| 12 | – | – | – | 0.171 | 0.053 | – | **0.224** | 0.224 |
| 13–18 (each) | 1.300 | – | – | 0.171 | 0.053 | – | **1.524** | 0.224 |
| 19 | – | – | – | 0.171 | 0.053 | – | **0.224** | 0.224 |
| 20 | – | – | – | 0.171 | – | – | **0.171** | 0.171 |
| 21 | – | – | – | 0.171 | – | – | **0.171** | 0.171 |
| 22–23 | – | – | – | – | – | – | **0.000** | 0.000 |
| **Σ** | 7.80 | 1.60 | 0.60 | 2.40 | 0.42 | 0.027 | **12.85** | 2.82 |

## 6. Peak demand

| Definition | Value | Use |
|---|---:|---|
| Scheduled coincident peak (hour-averaged) | **1.77 kW** (hour 09: Hoover + Water Cooler) | Normal operating point |
| Scheduled instantaneous peak | ≈ **2.2 kW** (Hoover 1600 + Water-cooler compressor 600) | Realistic worst simultaneous within schedule |
| All-on contingency (diversity broken, DF = 1.0 bounding) | **5.083 kW / 5.404 kVA** | Inverter contingency rating |

**Design implication:** the corrected AC (inverter, 1.30 kW) is no longer the peak driver; the morning
Hoover + Water-Cooler overlap sets the scheduled peak (~2.2 kW). The all-on contingency (5.08 kW) is managed
by the EMS interlock/shedding policy rather than by oversizing the inverter.
