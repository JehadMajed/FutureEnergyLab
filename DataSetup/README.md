# Appliance-Level Power Data Acquisition Toolkit

**Data Setup** is an open, reproducible edge-computing rig for **isolating, switching, and continuously
logging the active-power signatures of individual household appliances**.

Each appliance is wired through its own **Data Acquisition (DAQ) node** built around a smart
metering breaker and an ESP32-S3. Measurements (voltage, current, active power, breaker status)
are polled over Modbus RTU, collected offline by Home Assistant, and exported by a Python pipeline
into clean, resampled, wide-format CSV time series ready for analysis or machine learning.

The reference deployment covered **21 diverse appliances** running 24/7 in a laboratory for
several months, with a 100% automated-switching success rate and 0.5–1.0 s command latency.

---

## Why this exists

A smart meter's value is what it can infer from a single measurement point — but every
inference model (theft detection, load forecasting, load disaggregation/NILM) has to be
trained on **per-appliance ground-truth data** first, and that data doesn't exist off the
shelf. This toolkit exists to produce exactly that: a labelled, time-synchronised,
per-appliance active-power dataset with known switching events. It is the data foundation
for the lab's **[Smart Meter](../Smart%20Meter/)** project.

## Who is this for?

- **Energy / load-signature researchers** who need a ground-truth, per-appliance active-power
  dataset with known switching events (NILM, disaggregation, load classification, demand modelling).
- **Smart-home and home-lab builders** who want per-circuit monitoring *and* control with a fully
  offline, cloud-free stack.
- **Educators and students** in power/instrumentation courses who want a documented, buildable
  DAQ node and data pipeline to adapt.

## What's in the box

| Path | Contents |
|------|----------|
| [`docs/`](docs/) | Architecture, hardware, data pipeline, automation, commissioning notes, results |
| [`hardware/`](hardware/) | DAQ node bill of materials and wiring notes |
| [`firmware/esphome/`](firmware/esphome/) | ESPHome config for the ESP32-S3 ↔ breaker Modbus link |
| [`software/extractor/`](software/extractor/) | Python Home Assistant history → CSV pipeline |
| [`software/plotting/`](software/plotting/) | Quick power-profile plotting helper |
| [`data/`](data/) | Output schema + the appliance inventory as machine-readable CSV |
| [`examples/`](examples/) | A **synthetic** sample profile so scripts run out of the box |

## Architecture at a glance

```
 Appliance ── Smart breaker (measure + switch) ──RS485/Modbus RTU── ESP32-S3 (ESPHome)
                                                                        │ Wi-Fi
                                                                        ▼
                                          Home Assistant (Orange Pi, fully offline)
                                                  │ REST API (long-lived token)
                                                  ▼
                                   Python extractor  ──►  per-appliance + master CSV
                                                  ▲
                                          Node-RED automation
                              (scheduled switching / relay-assisted multi-mode routing)
```

See [`docs/01-system-architecture.md`](docs/01-system-architecture.md) for detail.

## Quick start (software only)

```bash
cd software/extractor
python -m venv .venv && . .venv/Scripts/activate   # Windows; use .venv/bin/activate on Linux/macOS
pip install -r requirements.txt
cp config.example.yaml config.yaml                 # then edit host + token + entities
python ha_history_extractor.py --config config.yaml --days 1
```

To try the pipeline with no hardware, plot the bundled synthetic sample:

```bash
python software/plotting/plot_power_profile.py examples/synthetic_sample.csv
```

## Status

`v1.0.0` — data-acquisition and automation layer, validated in continuous operation.
See [`CHANGELOG.md`](CHANGELOG.md).

## License

MIT — see [`LICENSE`](LICENSE). Author: Jehad Majed, 2026.
