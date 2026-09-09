# Data Transfer and Extraction Pipeline

## Collection

Telemetry from the ESP32 edge nodes is forwarded over Wi-Fi to **Home Assistant** running on an
**Orange Pi**, configured to operate fully offline. Home Assistant receives telemetry on its
internal event bus and records entity states with precise UNIX timestamps. It is the first-line
time-series store for all DAQ nodes.

## Extraction — two methods

1. **Manual** — Home Assistant's built-in CSV export for ad-hoc queries.
2. **Automated** — a Python script (`software/extractor/ha_history_extractor.py`) that calls the
   Home Assistant **REST API** with a **long-lived access token**. In the reference deployment it
   runs every 30 minutes (Windows Task Scheduler / cron).

### Automated preprocessing steps

| Step | Purpose |
|------|---------|
| Pull entity history (`/api/history/period`) | Retrieve raw state changes per appliance |
| Forward-fill missing values | State-change logs are sparse; power holds until it changes |
| Resample to 1 s | Uniform grid across all appliances |
| Reshape long → wide | One column per appliance, one row per timestamp |
| Write CSV | Per-appliance streams + one synchronised master dataset |

## Output layout

```
data/output/
  per_appliance/
    refrigerator.csv
    kettle.csv
    ...
  master.csv          # all appliances, one timestamp index
```

See [`../data/schema.md`](../data/schema.md) for column definitions and
[`../software/extractor/README.md`](../software/extractor/README.md) for usage.

## Backend maintenance

The headless Orange Pi is administered over SSH: log inspection, service supervision, and secure
transfer of processed CSVs to an analysis workstation. Because the stack is fully offline, logging
continuity is immune to internet outages.
