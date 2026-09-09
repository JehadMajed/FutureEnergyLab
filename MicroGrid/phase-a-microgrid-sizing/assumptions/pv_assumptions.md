# PV Resource & Model Assumptions — Riyadh, Saudi Arabia

The PV sizing uses a **Riyadh-specific** solar resource. This file
documents every input to the PV model; the calculation itself is in `sizing/pv_sizing.md`.

## 1. Location

| Parameter | Value | Source / basis |
|---|---|---|
| Site | Riyadh, Saudi Arabia | Project location |
| Latitude | **24.71° N** | Riyadh city coordinates |
| Longitude | 46.67° E | Riyadh city coordinates |
| Elevation | ≈ 612 m | Riyadh plateau |
| Climate | Hot desert (BWh) — high irradiance, high summer ambient, notable airborne dust | Regional climatology |

## 2. Solar resource

Riyadh is one of the higher-irradiance populated sites on Earth. Public long-term climatological summaries
place it in the following ranges (used here as **engineering design values**, to be confirmed against a
site-specific dataset before procurement):

| Quantity | Design value | Notes |
|---|---:|---|
| Global horizontal irradiation (GHI), annual | ≈ 2,100–2,200 kWh/m²/yr (≈ 5.8–6.0 kWh/m²/day) | Long-term average for Riyadh |
| Plane-of-array (POA) irradiation at optimal tilt, annual | ≈ 2,300–2,450 kWh/m²/yr (≈ 6.3–6.7 kWh/m²/day) | Fixed tilt ≈ latitude, south-facing |
| **Design peak-sun-hours (POA), representative day** | **5.5 h/day** | Annual-conservative POA value used for base-case sizing |
| Clear-day POA (upper reference) | ≈ 7.0 h/day | Summer clear sky; used only as an upper bound |
| **Low-PV design day (POA)** | **2.5 h/day** | Overcast / heavy-dust winter day; used for the low-PV scenario |

**Why a design value below the clear-day figure:** an islanded system with no grid must survive
representative and poor days, not just the best day. Using the clear-day 7.0 h would undersize both PV and
battery. The base case therefore uses **5.5 h** (annual-conservative), and `scenarios/02_low_pv.md` stresses
the design with **2.5 h**.

**Peak Sun Hours (PSH) defined:** PSH = daily POA irradiation (kWh/m²) ÷ 1 kW/m² reference irradiance. It is
numerically the daily POA energy expressed in "equivalent full-sun hours". Multiplying installed kWp by PSH
and by the performance ratio gives delivered AC energy.

## 3. Array orientation

| Parameter | Value | Reason |
|---|---|---|
| Tilt | **24°** (≈ latitude) | Maximises annual yield for a fixed array at this latitude |
| Azimuth | **180° (true south)** | Northern hemisphere optimum |
| Tracking | None (fixed) | Lab/preliminary scope; simplest and lowest-cost |
| Row/shading | Assumed unshaded | To be confirmed on site |

## 4. Temperature

| Parameter | Value | Reason |
|---|---|---|
| Design ambient (generating hours) | 40 °C (up to 45 °C summer) | Riyadh summer daytime |
| Cell temperature rise over ambient | ≈ +25–30 °C at full sun (NOCT basis) | Typical for roof-mount modules |
| Design cell temperature | ≈ 65–70 °C | Ambient + rise |
| Module power temperature coefficient | **−0.35 %/°C** | Typical mono-Si; confirm on datasheet |
| Temperature power loss vs STC (25 °C) | ≈ **12 %** (≈ 35 °C × 0.35 %/°C, energy-weighted) | Drives part of the PR below |

## 5. System losses → Performance Ratio (PR)

PR bundles all AC-energy losses relative to the STC nameplate. Explicit loss stack:

| Loss mechanism | Factor | Basis (Riyadh) |
|---|---:|---|
| Soiling / dust | 0.96 | Dust is significant in Riyadh; assumes periodic cleaning |
| Temperature | 0.88 | From §4 (hot climate) |
| Mismatch + DC wiring | 0.97 | Typical |
| MPPT tracking | 0.99 | Typical |
| Inverter conversion | 0.97 | Typical hybrid inverter |
| Availability / other | 0.99 | Minor |
| **Performance Ratio (product)** | **≈ 0.78** | Realistic for a hot, dusty climate |

**Design implication:** delivered AC energy = `kWp × PSH × PR`. With PSH 5.5 and PR 0.78, each installed kWp
yields **≈ 4.29 kWh/day** of usable AC energy on the representative day (≈ 5.46 kWh on a clear day, ≈ 1.95 kWh
on the low-PV design day).

## 6. Time resolution and day represented

| Parameter | Value |
|---|---|
| Time step | 1 hour (24 steps) — sufficient for energy-balance sizing |
| Day represented | A single representative 24-hour design day (not a specific calendar date); low-PV and high-load variants in `scenarios/` |
| Daylight window (design day) | ≈ 06:00–18:00, bell-shaped POA profile peaking near solar noon |

## 7. What must be confirmed before procurement

- Site-specific POA dataset (satellite/ground) for the exact coordinates and tilt.
- Whether the design is **year-round** or summer-biased (changes the design PSH).
- On-site soiling rate and cleaning schedule (dust is the largest controllable loss here).
- Actual module datasheet (efficiency, temperature coefficient, NOCT).
