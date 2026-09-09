# PV Sizing — Full Calculation Breakdown

**Inputs:** load energy from `sizing/load_sizing.md` (corrected AC); solar model from
`assumptions/pv_assumptions.md`. **Policy factors:** `DF = 1.0`, `SM = 1.0`.

The PV array must, on the design day, supply the **entire daily load energy** and **refill the battery** for
the coming night (there is no grid). PV is sized on a 24-hour energy-neutral basis, then checked against the
low-PV scenario.

---

## 1. Parameter-by-parameter breakdown

### 1.1 Daily load energy — `E_load`
- **Definition / why:** the daily energy PV must replace in an islanded system.
- **Value:** **12.85 kWh/day.** **Source:** `sizing/load_sizing.md` §3 (corrected AC).

### 1.2 Battery-cycled fraction & round-trip penalty — `η_rt`
- **Definition:** the share of daily energy served via the battery (charged by day, used evening/night) and
  the round-trip loss on it.
- **Value:** from the 24-h balance, ≈ **3.5 kWh** served via the battery on the design day; `η_rt = 0.90`.
- **Equation:** `E_pv,needed = E_direct + E_batt / η_rt`, `E_direct = E_load − E_batt`.
- **Calculation:** `E_pv,needed = 9.35 + 3.5/0.90 = 9.35 + 3.89 = 13.24 kWh/day.`
- **Implication:** PV must deliver ≈ **13.2 kWh AC/day**.

### 1.3 Design peak-sun-hours — `PSH`
- **Value:** **5.5 h/day** representative, **2.5 h/day** low-PV day. **Source:** Riyadh, `assumptions/pv_assumptions.md`.

### 1.4 Performance ratio — `PR`
- **Value:** **0.78** (loss stack incl. ~12 % temperature loss in the hot climate). **Source:** `assumptions/pv_assumptions.md` §5.
- **Implication:** each kWp yields `5.5 × 0.78 = 4.29 kWh/day` (representative day).

### 1.5 Module rating & efficiency — `P_mod`, `η_mod`
- **Value:** **550 W**, ≈ **21 %** (mono-Si). Sets module count and ~2.6 m²/module.

### 1.6 Temperature coefficient — `γ`
- **Value:** **−0.35 %/°C** → ~12 % energy loss (inside PR); justified by Riyadh cell temps 65–70 °C.

---

## 2. Required PV capacity — `P_pv`

- **Equation:** `P_pv = E_pv,needed / (PSH × PR) × SM`
- **Calculation (energy-neutral, SM = 1.0):** `P_pv = 13.24 / (5.5 × 0.78) = 13.24 / 4.29 = 3.09 kWp.`
- **Result:** **energy-neutral requirement ≈ 3.1 kWp.**

### 2.1 Recommended installed size
Headroom for cloudy/dusty days and ageing is an **explicit design choice**, not hidden in `SM`:
- **Recommended installed PV = 4.4 kWp** (≈ 1.4 × the neutral requirement).
- Low-PV design day (PSH 2.5): `4.4 × 2.5 × 0.78 = 8.6 kWh AC` — what the battery must bridge (see
  `sizing/battery_sizing.md` and `scenarios/02_low_pv.md`).

---

## 3. Module configuration

| Quantity | Equation | Value |
|---|---|---:|
| Module count | `⌈4.4 kWp / 550 W⌉` | **8 modules** |
| Array | 1 string × 8 (or 2 strings × 4) | 4.4 kWp |
| Array area | 8 × 2.6 m² | ≈ 21 m² |

### 3.1 String electrical (indicative, 550 W mono)
Per module: `Vmp ≈ 41.5 V`, `Voc ≈ 49.5 V`, `Imp ≈ 13.3 A`, `Isc ≈ 14.0 A`, Voc cold-extreme factor ≈ 1.13.

| Config | String Vmp | String Voc (cold) | String Imp | Check |
|---|---:|---:|---:|---|
| **1 string × 8** | 8 × 41.5 ≈ **332 V** | 8 × 49.5 × 1.13 ≈ **448 V** | < 500 V max ✔; 13.3 A single tracker ✔ |
| 2 strings × 4 | 4 × 41.5 ≈ 166 V | ≈ 224 V | ✔; 26.6 A across two trackers |

**Implication:** either layout sits inside a typical hybrid-inverter MPPT window (100–500 V, ~15 A/tracker).
The 1 × 8 string is simplest (one tracker); the 2 × 4 layout gives lower voltage and MPPT redundancy.
**Do not** wire PV directly onto the 51.2 V battery bus.

---

## 4. Inverter input limits (PV side)
- PV input capability ≥ **4.4 kW**; DC/AC ratio ≈ **4.4 kWp / 5 kW = 0.88** — minimal clipping.
- ≥ 1 MPPT (2 preferred), 100–500 V, ≥ 15 A/tracker.

---

## 5. Expected PV energy (delivered AC)

| Day type | Equation | Energy |
|---|---|---:|
| Representative design day | 4.4 × 5.5 × 0.78 | **≈ 18.9 kWh/day** |
| Clear day (upper reference) | 4.4 × 7.0 × 0.78 | ≈ 24.0 kWh/day |
| Low-PV design day | 4.4 × 2.5 × 0.78 | **≈ 8.6 kWh/day** |

On a representative day the array exceeds the 13.2 kWh needed; the surplus refills the battery and the rest is
curtailed once the battery is full. This over-build is deliberate — it is what makes the low-PV day survivable.

---

## 6. PV capacity factor (informative)
≈ 4.29 kWh/kWp/day → ≈ 1,566 kWh/kWp/yr → `CF ≈ 17.9 %`. Consistent with a fixed-tilt array in Riyadh.

---

## 7. PV sizing summary

| Parameter | Value |
|---|---:|
| Daily load energy | 12.85 kWh |
| PV AC energy target (with battery losses) | 13.2 kWh |
| Design PSH / PR (Riyadh) | 5.5 h / 0.78 |
| **Energy-neutral PV requirement** | **3.1 kWp** |
| **Recommended installed PV** | **4.4 kWp** (8 × 550 W) |
| Array voltage / current (1 × 8) | ≈ 332 V / ≈ 13.3 A |
| Expected AC energy (representative / low-PV) | 18.9 / 8.6 kWh/day |
