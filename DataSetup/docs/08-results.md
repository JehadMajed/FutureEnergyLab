# Reference Deployment Results

## Communication validation
- Consistent packet delivery over the RS485 differential bus across all nodes.
- 1000 ms register polling → zero bus collisions, error-free telemetry acquisition.

## Automation and control
- **100% automation success rate** across all functional nodes.
- Zero firmware freezes or hardware lockups during continuous operation.
- Command-to-latch latency (Node-RED trigger → physical breaker latch): **0.5–1.0 s**.

## Data extraction
- Telemetry from the Home Assistant database exported to standardised flat CSV.
- Separate CSV stream per appliance to isolate electrical behaviour; consolidation into a single
  master dataset with synchronised time-series records for all appliances.
- Sample validation: the active-power profile of an automatic washing machine was extracted from
  the CSV records, confirming capture of dynamic, multi-mode electrical transitions.

## Stability
- Fully offline stack (ESPHome nodes + Home Assistant + Orange Pi) evaluated under continuous
  laboratory operation; logging continuity immune to internet outages.
- Headless administration and monitoring over SSH.

> A **synthetic** illustrative profile is included at `examples/synthetic_sample.csv` so the
> plotting helper runs without measured data. It is not experimental data.
