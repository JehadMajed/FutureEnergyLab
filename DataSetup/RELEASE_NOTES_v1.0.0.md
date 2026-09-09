# Data Setup v1.0.0 — Appliance-Level Power Data Acquisition Toolkit

A reproducible edge rig for isolating, switching, and continuously logging the **active-power
signatures of individual household appliances**.

## Highlights

- **Per-appliance DAQ node** — smart metering breaker (measurement + motorised switching) driven by
  an ESP32-S3 over Modbus RTU / RS485. Full BOM and wiring notes included.
- **Offline collection** — Home Assistant on an Orange Pi records timestamped entity states with no
  cloud dependency.
- **Clean data out** — a Python pipeline forward-fills, resamples to 1 s, and reshapes to wide-format
  per-appliance and master CSV time series.
- **Automation** — Node-RED patterns for scheduled binary switching and relay-assisted multi-mode
  routing (e.g. washing-machine cycles, oven modes).
- **21-appliance inventory** classified by electrical behaviour and integration block.

## Reference deployment results

| Metric | Value |
|--------|-------|
| DAQ nodes | 21, continuous 24/7 |
| Automation success rate | 100% |
| Command-to-latch latency | 0.5–1.0 s |
| Poll interval | 1000 ms (zero RS485 bus collisions) |
| Commissioning fix | breaker over-frequency threshold recalibrated for 60 Hz mains |

## Getting started

See the [README](README.md). Software-only users can run the extractor and plot the bundled
**synthetic** sample without any hardware.

## Notes

- The ESPHome register map values are marked as placeholders — verify them against your breaker's
  Modbus manual before energising anything.
- `examples/synthetic_sample.csv` is generated, not measured; it exists only so the scripts run.

## Attribution

Author: Jehad Majed. Released under the MIT License.
