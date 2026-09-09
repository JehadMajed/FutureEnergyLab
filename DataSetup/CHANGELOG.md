# Changelog

All notable changes to this project are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-09-09

First public release: data-acquisition and automation layer.

### Added
- DAQ node design: smart metering breaker + ESP32-S3 + TTL-to-RS485 + relay stage + AC/DC supply,
  documented with bill of materials and wiring notes.
- ESPHome firmware configuration for Modbus RTU polling of the breaker (voltage, current,
  active power, status) and single-register write switching (Function Code 0x06).
- Home Assistant offline collection guidance (entity states with UNIX timestamps).
- Python extractor: pulls entity history via the Home Assistant REST API, forward-fills gaps,
  resamples to 1 s, reshapes long → wide, writes per-appliance and master CSV.
- Node-RED automation patterns: direct binary switching and relay-assisted multi-mode routing.
- Appliance inventory (21 entries) as machine-readable CSV, with Block A / Block B classification.
- Commissioning notes, including the 60 Hz / 65 Hz breaker over-frequency recalibration.
- Synthetic sample profile and plotting helper.

### Validated in the reference deployment
- 21 independent DAQ nodes in continuous 24/7 operation over several months.
- 100% automated-switching success rate; 0.5–1.0 s command-to-latch latency.
- 1000 ms poll interval eliminated RS485 bus collisions.
