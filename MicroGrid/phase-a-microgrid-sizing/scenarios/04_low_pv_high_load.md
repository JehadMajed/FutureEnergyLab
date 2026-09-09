# Scenario 04 — Low PV + High Load (Worst Case)

## Purpose
The compound worst case: a poor solar day **and** elevated load together. This is the **binding scenario**
for whether the design keeps critical loads up unaided.

## Assumptions
- Load ×1.25 → **≈ 16.1 kWh/day**.
- PV = 4.4 kWp, **PSH 2.5 h** → 8.6 kWh AC/day.
- Battery = 10 kWh, SOC₀ = 90 %.

## Changes from base case
Combines Scenario 02 (low PV) and Scenario 03 (high load).

## Conditions
| Quantity | Value |
|---|---:|
| Daily load | 16.1 kWh |
| PV AC energy | 8.6 kWh |
| Net gap to bridge | ≈ 9.2 kWh vs ≈ 7.7 kWh usable |

## Result and resolution (confirmed policy)
With a naïve "shed only when empty" rule, the 10 kWh battery reaches its floor and ~0.7 kWh of critical load
would go unmet at day's end. **Stakeholder decision: shedding the non-critical air conditioner is
acceptable**, which resolves this and lets the **10 kWh battery stand**:

- **Adopted EMS rule:** shed the air conditioner (non-critical, 1.30 kW) once SOC ≤ ~25 %. Critical loads
  (Water Cooler + Fan, ~2.8 kWh/day) are then fully protected with wide margin (`scenarios/05_critical_load_only.md`).

| KPI (with shedding policy) | Value |
|---|---:|
| SOC min | ≥ 25 % (shed threshold holds it up) |
| AC (non-critical) shed | up to ~2–4 kWh on this day |
| **Critical unmet** | **0 kWh ✅** |

## Alternative
A **12 kWh** battery serves even this compound day with **no** shedding (SOC min ≈ 12 %). Retained as an
option if serving all loads through the compound day without shedding is later required.

## Engineering conclusion
The compound worst case is handled by proactive shedding of the air conditioner, consistent with the design
objective and the confirmed policy. The 10 kWh battery is sufficient; the EMS must implement an SOC-threshold
shed rule (≈ 25 %) with hysteresis.
