# Field Survey — Household Appliance Usage Patterns (Al-Kharj)

**مسح ميداني لمعرفة أنماط استهلاك الأجهزة الكهربائية للطاقة بالمنازل بالخرج**
("Field survey to identify patterns of electrical appliance energy consumption in homes
in Al-Kharj")

A 139-response household survey (Google Forms export) used to shape assumptions about
"typical" Saudi household appliance usage — which appliances are present, how many of each,
what time of day they run, and roughly how long per day.

## Contents

[`مسح ميداني لمعرفة أنماط استهلاك الأجهزة الكهربائية للطاقة بالمنازل بالخرج.csv`](مسح%20ميداني%20لمعرفة%20أنماط%20استهلاك%20الأجهزة%20الكهربائية%20للطاقة%20بالمنازل%20بالخرج.csv)
— raw survey export, UTF-8, 139 rows, one per respondent.

[`appliance-scenario-dashboard.html`](appliance-scenario-dashboard.html)
— interactive dashboard built from the survey (open it in a browser, no install needed).
It has two parts:

- **Survey results** (English): appliance ownership, time-of-day use, hours per day,
  units per home and monthly bills, with hover details on every chart.
- **Appliance scenario analysis** (English / العربية switch): 15 weekly operating
  schedules for a typical Saudi home (split AC, fan, water heater, space heater, oil
  heater, oven & cooker, air fryer, microwave, kettle, toaster, washing machine,
  dishwasher, clothes iron, TV, hair iron). Each schedule is converted to a
  minute-by-minute load (kW / kWh) and documented with its problem, rationale,
  assumptions, method, KPIs, interpretation, limits and recommendation. The page adds
  season / day-type / time-of-day / category filters, comparison charts, a stacked daily
  load profile, a searchable and sortable run table, and an executive summary for
  microgrid sizing. Air fryer, oil heater and hair iron are estimates (not in the survey);
  power ratings and duty cycles are typical engineering values to be calibrated with
  smart-meter data. New scenarios are added in the `SCENARIOS` / `EN_TEXT` arrays in the
  page's script.

Per respondent, the survey records:

- Neighbourhood (حي) and approximate monthly electricity bill (SAR)
- For 22 appliance types (fridge, freezer, AC, TV, lighting, microwave, oven, washing
  machine, dishwasher, vacuum, water dispenser, heater, iron, water heater, fan, toaster,
  kettle, coffee maker, blender, computer, etc.):
  - Time-of-day period(s) the appliance runs (morning / afternoon / evening / night)
  - Number of that appliance owned in the household
  - Average daily operating hours

## Where this is used

This is the underlying data behind the "Behavioral Survey Results" chart referenced in the
**[Smart Meter](../../Smart%20Meter/)** project (Intelli-Meter), used to shape the virtual
dashboard's assumptions about a "typical Saudi household" load profile. It's placed here in
Data Setup because it informs the same appliance-behaviour modelling this toolkit's
[Appliance Inventory](../README.md#appliance-inventory) documents from direct measurement.

URL : https://claude.ai/artifact/FnYm5E4pc4Ep9qMuwGvMiY
