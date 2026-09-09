# Appliance Inventory

21 appliances were integrated in the reference deployment, classified by electrical category,
integration block, and typical operating nature. Machine-readable version:
[`../data/appliances.csv`](../data/appliances.csv).

| Device | Electrical category | Block | Typical operating nature |
|--------|---------------------|-------|--------------------------|
| Electric Stove | Resistive / Thermal | B | Multi-level or cyclic thermal operation |
| Heater | Resistive / Thermal | A | Direct single-state heating load |
| Oil Heater | Resistive / Thermal | A | Predominantly thermal, single-state operation |
| Air Fryer | Mixed Thermal / Electronic | A | Heater and fan with timer-based control |
| Iron | Resistive / Thermal | A | Direct thermal ON/OFF operation |
| Toaster | Resistive / Thermal | A | Short-cycle resistive heating |
| Coffee Machine | Mixed Thermal / Electronic | B | Heater and pump sequence, multiple stages |
| Split Air Conditioner | Motor / Compressor | A | Compressor-based steady operation |
| Top-Load Washing Machine | Motor-Driven | B | Multiple modes (cotton, 45 min, 15 min) |
| Twin-Tub Washing Machine | Motor-Driven | B | Separate wash and spin states |
| Water Dispenser | Mixed Compressor / Thermal | A | Cooling and heating cycles via breaker |
| Blender | Universal Motor | A | Motor-driven, single speed |
| Dishwasher | Mixed Electro-Mechanical | B | Heater and pump sequence, multiple stages |
| Hair Dryer | Mixed Thermal / Fan | A | Heater plus fan operation |
| Hair Styler | Mixed Thermal / Fan | A | Heater plus fan operation |
| Microwave Oven | Mixed / Nonlinear | A | Multi-setting thermal operation |
| Lighting Panel | Electronic / Nonlinear | A | Aggregated lighting switching behaviour |
| Television | Electronic / Nonlinear | A | Continuous electronic consumption profile |
| Kettle | Resistive / Thermal | A | Direct high-power heating event |
| Refrigerator | Motor / Compressor | A | Automatic compressor cycling |
| Vacuum Cleaner | Universal Motor | A | Motor-driven, variable intensity |

**Block A** — breaker-centred node, direct switching.
**Block B** — breaker + relay stage, sub-cycle / mode routing.
