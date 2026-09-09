# Engineering Questions, Assumptions & Data Required

## 1. Confirmed results (defensible from the CSV + documented assumptions)
- Connected load 5.08 kW / 5.40 kVA, PF 0.941; daily energy 12.85 kWh; critical 2.82 kWh
  (AC corrected to nameplate 1.30 kW).
- PV energy-neutral requirement ≈ 3.1 kWp; recommended installed 4.4 kWp.
- Battery low-PV-day requirement ≈ 10 kWh nominal; critical-only autonomy ≈ 2.5–3 days.
- Inverter 5 kW / 5.5 kVA; cable sizes as tabulated.
- 24-h energy balance closes; critical loads met in all scenarios (compound case via AC shedding).

## 2. Engineering assumptions (documented, adjustable)
| Assumption | Value | Where |
|---|---|---|
| 24-h load schedule (time-of-day) | assumed | `assumptions/load_assumptions.md` |
| AC daily runtime | 6 h (inverter AC modulates — confirm by metering) | `assumptions/load_assumptions.md` §2a |
| Riyadh design PSH / PR | 5.5 h / 0.78 | `assumptions/pv_assumptions.md` |
| Battery SOC window, efficiencies, derates | 10–100 %, 0.95/0.95, 0.95×0.90 | `assumptions/battery_assumptions.md` |
| Hoover start inrush multiplier | ≈ 3× (universal motor) | `scenarios/06_motor_demand.md` |
| Quantity per load | 1 | CSV has no quantity column |

## 3. Results requiring manufacturer datasheets
- PV module: exact efficiency, temperature coefficient, NOCT, Voc/Isc (refines PR and string design).
- Battery: exact usable capacity, C-rate limits, temperature deratings.
- Inverter: continuous vs surge rating, high-ambient derate curve, **island fault-current profile**,
  reactive capability, neutral-forming/earthing scheme.

## 4. Results requiring additional site information
- Site-specific solar dataset (POA at the exact coordinates/tilt) and whether the design is year-round or
  summer-biased.
- Equipment-room ambient temperature and whether it is actively cooled (drives battery/inverter/cable derate).
- Actual cable route lengths (voltage drop scales with length).
- On-site soiling/dust rate and cleaning schedule.

## 5. Critical questions before physical implementation

**Resolved (confirmed with stakeholder / nameplate):**
- ✅ **AC nameplate** — inverter-driven split unit, **1.30 kW (T3) input, max 8.5 A**. Rated power corrected
  from the CSV's 2000 W. Because it soft-starts, the inverter surge requirement is a modest **≥ 10 kVA**
  (set by the Hoover, not the AC).
- ✅ **Load-shedding policy** — proactive shedding of the non-critical air conditioner **is acceptable**. The
  10 kWh battery is retained; the EMS sheds the AC at SOC ≈ 25 % to guarantee critical supply.

**Still open:**
1. **Air-conditioner runtime/energy** — is 6 h/day correct? An inverter AC modulates with cooling demand, so
   the 7.8 kWh/day figure should be confirmed by metering; it is ≈ 61 % of daily energy and drives PV/battery.
2. **Load schedule** — is it EMS-scripted (deterministic) or user-driven? Sets the battery.
3. **Design storm** — how many consecutive low-PV days must Phase A survive with all loads (critical-only
   ride-through is already ≈ 2.5–3 days)? Confirms whether 10 kWh + shedding is the accepted posture, or 12 kWh.
4. **DC-bus voltage** — accept 51.2 V (heavier DC cable/fuse) or move to a higher-voltage bus?
5. **Why is the Water Cooler "critical"** and does it contain a heating element (its 600 W / PF 0.60 is high
   for a simple cooler)? Also read its compressor starting current.
6. **Metering** — replace the calculated `measured_wh` with true metered energy and a real time-of-day
   profile before procurement.

## 6. Explicitly out of scope (not claimed)
Dynamic voltage/frequency stability, ROCOF, motor-start voltage sag, harmonics, and island protection
coordination. These require a dynamic study and the inverter's fault-current data; this package is an
energy/power-balance sizing only.
