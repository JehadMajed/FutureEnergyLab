# Battery (BESS) Assumptions

Physical and operational assumptions for the battery. Kept strictly separate from the policy factors
`DF` and `SM` (both 1.0). The sizing calculation is in `sizing/battery_sizing.md`.

## 1. Chemistry and voltage class

| Parameter | Symbol | Value | Reason |
|---|---|---:|---|
| Chemistry | — | **LiFePO₄ (LFP)** | High cycle life, thermal stability, tolerance of high ambient — suited to Riyadh |
| Nominal DC bus voltage | `V_dc` | **51.2 V** (16 cells in series) | "48 V" class; common, safe (< 60 V d.c. touch), simple. Higher-voltage option discussed in `sizing/component_ratings.md` |
| Operating voltage range | — | ≈ 44–58 V | LFP 16S envelope |

## 2. State-of-charge (SOC) window

| Parameter | Symbol | Value | Reason |
|---|---|---:|---|
| Minimum SOC (equipment floor) | `SOC_min` | **10 %** | BMS protection floor for LFP |
| Maximum SOC (ceiling) | `SOC_max` | **100 %** | Full charge permitted |
| Operational minimum (for life) | — | 10–15 % | Emergency reserve below this |
| Initial SOC (start of 24-h cycle) | `SOC_0` | **90 %** | Assumed; a fuller start improves low-PV margin |
| Required final SOC | `SOC_end` | ≥ `SOC_0` on a design day | Islanded daily cycle must be self-restoring (end ≥ start) so it can repeat indefinitely |
| Usable SOC span | `ΔSOC` | 0.90 (10→100 %) | Before physical derating |

## 3. Efficiencies

| Parameter | Symbol | Value | Reason |
|---|---|---:|---|
| One-way charge efficiency | `η_c` | **0.95** | Cell + BMS |
| One-way discharge efficiency | `η_d` | **0.95** | Cell + BMS |
| Round-trip efficiency | `η_rt` | **0.90** | `η_c × η_d` |

## 4. Capacity derating (physical, not policy margin)

| Parameter | Symbol | Value | Reason |
|---|---|---:|---|
| Temperature derate | `k_temp` | **0.95** | Usable-capacity reduction at high ambient (Riyadh) |
| Ageing / end-of-life derate | `k_age` | **0.90** | Capacity fade over service life (~ hundreds of cycles) |
| **Effective usable fraction** | `f_eff` | **≈ 0.77** | `ΔSOC × k_temp × k_age = 0.90 × 0.95 × 0.90` |

So **usable kWh ≈ 0.77 × nominal kWh** across the full SOC window (≈ 0.66 × nominal if operated 10–95 %).

## 5. Power / C-rate

| Parameter | Symbol | Value | Reason |
|---|---|---:|---|
| Continuous charge/discharge power (min) | `P_batt` | **≥ 5 kW** | Match the inverter; cover the all-load contingency and midday charge burst |
| C-rate at nominal 10 kWh | `C` | ≈ **0.50 C** (5 kW ÷ 10 kWh) | Well within LiFePO₄ limits |
| Short-duration (motor start) | — | 2× continuous, few seconds | Bounded by motor inrush (AC is inverter/soft-start) |

## 6. Design implications

- Because usable ≈ 0.77 × nominal, the clear-day evening delivery (~3.5 kWh) needs only ~5 kWh nominal,
  **but** the low-PV day needs ~7.3 kWh delivered (≈ 7.7 kWh from the cells) → this drives nominal to
  **~10 kWh**. The low-PV day is the binding case, not the clear day.
- A 10 kWh / ≥5 kW battery runs at ≤ 0.5 C, comfortably within LiFePO₄ limits.
