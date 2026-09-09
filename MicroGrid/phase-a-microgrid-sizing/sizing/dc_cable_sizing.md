# DC Cable Sizing (Preliminary, Steady-State)

**Basis:** `assumptions/electrical_assumptions.md`. 90 °C copper, short runs, DC voltage-drop limit
≤ 1 % of 51.2 V (≈ 0.5 V) on the battery feeder. The 48 V-class bus means **high DC currents** — cables are
sized on current and kept short.

Approximate copper resistance: 25 mm² ≈ 0.78, 35 mm² ≈ 0.56, 50 mm² ≈ 0.39, 70 mm² ≈ 0.28 mΩ/m.
VD (DC) = `2 × R × L × I`.

## 1. Battery → inverter DC input

| Item | Value | Basis |
|---|---:|---|
| Voltage | 51.2 V DC | Battery bus |
| Power | 5 kW max (inverter) | Continuous |
| Operating current | ≈ 103 A | 5000 / (0.95 × 51.2) at 5 kW |
| Short-duration current | ≈ 150–200 A | Motor start |
| Design current | ≈ 129 A | 1.25 × 103 A |
| Cable size | **50 mm² Cu** (35 mm² acceptable, short run) | 90 °C ampacity ≈ 150 A short run ✔; 50 mm² chosen for margin |
| Conductors | 2 (＋ / －) | — |
| Length | ≤ 2 m | Keep battery adjacent to inverter |
| Voltage drop | 2 × 0.00039 × 2 × 103 ≈ **0.16 V (0.31 %)** | ≤ 1 % ✔ |
| Protection | **Class-T fuse 125 A** at battery ＋ terminal; DC disconnect 160 A / ≥ 125 VDC; Type 2 DC SPD | High interrupting capacity for kA-level battery fault |

**Design note:** the 48 V bus forces ~100–150 A on this feeder. Keeping the run ≤ 2 m holds the voltage drop
under 1 %. A higher-voltage battery bus would cut this current several-fold (see `component_ratings.md`).

## 2. PV string → inverter MPPT input

| Item | Value | Basis |
|---|---:|---|
| Voltage | ≈ 208 V (Vmp), ≤ 280 V (Voc cold) | `pv_sizing.md` §3.1 |
| Operating current (Imp) | ≈ 13.3 A per string | Module |
| Design current | 1.56 × Isc ≈ 22 A | PV design rule |
| Cable size | **6 mm² solar cable, 1 kV** | ≈ 41 A rating ✔; low drop over roof run |
| Length | ≤ 30 m | Roof to inverter |
| Voltage drop | < 1 % at 208 V | ✔ |
| Protection | PV isolator 25 A / 1000 VDC, 4-pole; Type 2 PV SPD; string fuses only if ≥ 3 strings | 2 strings → no string fuse needed |

## 3. Earthing / bonding conductor

| Item | Value | Basis |
|---|---:|---|
| Inverter / battery / PV frame → main earth bar | **16 mm² Cu** | Protective bonding at this scale |
| Insulation-monitoring device (IMD) | If DC bus floating (IT) | Per island earthing scheme |

## 4. DC cable summary

| Feeder | Cable | Protection |
|---|---|---|
| Battery → inverter | **50 mm² Cu** (≤ 2 m) | Class-T 125 A + DC disconnect 160 A + SPD |
| PV string → MPPT | 6 mm² solar, 1 kV | PV isolator 25 A/1000 V + SPD |
| Earth / bonding | 16 mm² Cu | Main earth bar; IMD if floating |
