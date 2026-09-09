# Load-Side Assumptions

**Source of load data:** `data/phase_a_loads.csv` (ground-truth, authoritative). Nothing on the load side is
taken from any other file.

## 1. CSV structure (as provided)

Columns: `name, rated_w, on_h, measured_wh, is_motor, critical, PF`

| name | rated_w | on_h | measured_wh | is_motor | critical | PF |
|---|---:|---:|---:|:--:|:--:|---:|
| Air Conditioner | 1300 | 6 | 7800 | 1 | 0 | 0.94 |
| Hoover | 1600 | 1 | 1600 | 1 | 0 | 0.98 |
| Iron | 1200 | 0.5 | 600 | 0 | 0 | 1.00 |
| Water Cooler | 600 | 4 | 2400 | 1 | 1 | 0.60 |
| Fan | 53 | 8 | 424 | 0* | 1 | 0.90 |
| Blender | 330 | 0.083 | 27.39 | 1 | 0 | 0.84 |

\* The CSV marks Fan `is_motor = 0`. It is treated as non-motor (AC fan, negligible inrush).

### 2a. Air-conditioner nameplate correction (provenance)

The air conditioner's rated power and PF were corrected from the original CSV entry (2000 W, PF 0.95) to the
**unit's own nameplate**:

| Nameplate quantity | Value |
|---|---|
| Type | Split, **inverter-driven** compressor |
| Power supply | 230 V~ / 60 Hz |
| Cooling power input | 0.97 kW (T1, moderate) / **1.30 kW (T3, high ambient ~45 °C+)** |
| Cooling current | 4.5 A / 6.0 A |
| Max current | **8.5 A** |
| Refrigerant | R32 |

**Why corrected:** the original 2000 W at PF 0.95 implies 9.15 A, which **exceeds the unit's 8.5 A maximum
current** — i.e. the CSV value was physically inconsistent with the actual equipment. The **T3 (high-ambient)
input of 1.30 kW** is used for Riyadh; PF taken as 1.30 kW / (230 V × 6.0 A) ≈ 0.94. The 6 h/day runtime is
retained from the CSV as a planning assumption (an inverter AC modulates with cooling demand — confirm by
metering). The unit being **inverter-driven means it soft-starts** (no large locked-rotor inrush), which
relaxes the inverter surge requirement (see `sizing/inverter_sizing.md`).

## 2. Assumptions and their justification

| # | Assumption | Value | Reason | If wrong |
|---|---|---|---|---|
| A1 | **Quantity = 1** per load | 1 each | The CSV has no quantity column. | Connected load and energy scale linearly with quantity. |
| A2 | `measured_wh` is **calculated**, not metered | — | Every row equals `rated_w × on_h` to the digit (e.g. 330 × 0.083 = 27.39). No metering trace exists. | On-times/ratings are planning values, not measured data; treat energy as an estimate. |
| A3 | Single-phase, 230 V, 60 Hz | 230 V / 60 Hz | Stated system voltage class. | All currents scale with the chosen voltage. |
| A4 | Diversity factor `DF` | **1.0** | Per brief — no coincidence credit initially. | Raising `DF < 1` lowers the coincident peak and inverter size. |
| A5 | Design/safety margin `SM` | **1.0** | Per brief — raw calculation initially. | Raising `SM > 1` scales every component up. |

## 3. 24-hour operating schedule (assumed)

The CSV gives **daily on-hours only**, not a time-of-day schedule. A schedule is **assumed** here; it is the
second-largest source of uncertainty after the appliance ratings. Each appliance's profile is
**energy-preserving** — its 24-hour integral equals the CSV `measured_wh` exactly.

| Load | Assumed window | On-hours honoured | Rationale |
|---|---|---:|---|
| Iron | 07:00–07:30 | 0.5 h | Morning routine |
| Blender | 08:00–08:05 | 0.083 h | Breakfast |
| Hoover | 09:00–10:00 | 1.0 h | Morning chores |
| Water Cooler (critical) | duty-cycled 08:00–22:00 | 4.0 h equivalent (≈ 29 % duty) | Compressor cycles across the day; always available |
| Fan (critical) | 12:00–20:00 | 8.0 h | Daytime + early evening |
| Air Conditioner | 13:00–19:00 | 6.0 h | Afternoon/evening heat (Riyadh); pushes 1 h of AC past sunset |

**Design implication:** the air conditioner (7.8 kWh/day, ≈ 61 % of daily energy) running into the evening,
after PV has fallen, is what sizes the battery. The schedule is the key lever on battery capacity — see
`scenarios/`.

## 4. Critical vs non-critical (from CSV `critical` flag)

- **Critical:** Water Cooler, Fan → 0.653 kW connected, 2.82 kWh/day.
- **Non-critical:** Air Conditioner, Hoover, Iron, Blender → 4.43 kW connected, 10.03 kWh/day.

The design objective is that **critical loads are never unmet**; non-critical loads (led by the AC) are the
shed candidates.

## 5. Motor vs non-motor (from CSV `is_motor` flag)

- **Motor:** Air Conditioner, Hoover, Water Cooler, Blender → 3.83 kW connected, 11.83 kWh/day.
- **Non-motor:** Iron, Fan → 1.253 kW.
- **Largest motor:** Hoover, 1600 W (universal motor). The AC (1.30 kW) is now smaller and inverter-driven.

**Motor-start data:** the air conditioner is **inverter-driven (soft-start)** per its nameplate — it ramps
its compressor and imposes **no** large locked-rotor inrush (max current 8.5 A). The largest remaining start
transient is the Hoover's brief universal-motor inrush (~3× running) and the Water Cooler's small fixed-speed
compressor. This relaxes the inverter surge requirement (see `sizing/inverter_sizing.md` and
`scenarios/06_motor_demand.md`).
