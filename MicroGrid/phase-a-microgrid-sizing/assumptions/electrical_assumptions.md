# Electrical & Installation Assumptions

Shared electrical assumptions used by the inverter, cable and component sizing files.

## 1. System electrical basis

| Parameter | Symbol | Value | Reason |
|---|---|---:|---|
| AC voltage (line-to-neutral) | `V_ac` | **230 V** | Single-phase system voltage |
| Frequency | `f` | **60 Hz** | System frequency |
| Phases | — | 1 (single-phase) | Phase A scope |
| DC bus (battery) | `V_dc` | **51.2 V** nominal | See `assumptions/battery_assumptions.md` |
| Inverter DC→AC efficiency | `η_inv` | **0.95** | Hybrid inverter typical |
| Inverter high-ambient derate | `k_inv,T` | **0.80** | Continuous rating at 45 °C vs nameplate |

## 2. Conductor & installation basis (cables)

| Parameter | Value | Reason |
|---|---|---|
| Conductor material | Copper (Cu) | Standard for this scale |
| Insulation | 70 °C PVC (AC final circuits); 90 °C XLPE / cross-linked (DC + sub-mains) | Common practice |
| Reference ambient | 40 °C | Riyadh equipment room |
| Ambient derate | ≈ 0.87 | 40 °C vs 30 °C rating basis |
| Grouping / conduit derate | ≈ 0.80 | Bunched in conduit |
| **Combined installation derate** | **≈ 0.70** | `0.87 × 0.80` (applied to tabulated ampacity) |
| Continuous-duty design rule | `I_design ≥ 1.25 × I_operating` | Continuous-load rule |

## 3. Voltage-drop limits

| Segment | Limit | Basis |
|---|---|---|
| AC final circuits | ≤ 3 % of 230 V (≤ 6.9 V) | Standard practice |
| AC sub-main (inverter → board) | ≤ 2 % of 230 V (≤ 4.6 V) | Standard practice |
| DC battery feeder | ≤ 1 % of 51.2 V (≤ 0.5 V) | Low-voltage / high-current feeder must be kept short and low-drop |

## 4. Short-circuit basis (preliminary)

- In an islanded system, the AC fault current is **inverter-limited** (typically 1.5–3 × rated current for a
  short time), **not** utility-grade. This strongly affects breaker tripping and must be confirmed against the
  chosen inverter's fault-current profile.
- The DC bus fault current from a multi-kWh LFP bank can be **several kA**; a high-interrupting-capacity DC
  fuse at the battery terminal is mandatory.
- Adiabatic minimum conductor check: `S ≥ I_fault × √t / k` (k ≈ 115 for Cu/PVC). At this scale the ampacity
  choice already exceeds the adiabatic minimum, but prospective fault currents must be confirmed with real
  source impedances before finalising protection.

## 5. Earthing

- Islanded system: the grid-forming inverter provides the voltage reference and the neutral–earth bond for the
  island. Single main earth bar; bonding conductor sized in `sizing/component_ratings.md`.
- Confirm the inverter's neutral-forming/earthing scheme and whether the DC bus is referenced or floating
  (an insulation-monitoring device is required if floating).

## 6. What must be confirmed

- Inverter fault-current curve (for protection coordination).
- Actual cable route lengths (voltage drop scales with length).
- Equipment-room ambient and whether it is actively cooled (affects battery, inverter and cable derating).
