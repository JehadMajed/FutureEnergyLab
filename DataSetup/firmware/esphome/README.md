# ESPHome Firmware — DAQ Node

## Prerequisites
- [ESPHome](https://esphome.io/) (`pip install esphome` or the ESPHome dashboard / add-on).
- One ESP32-S3 per node, wired per [`../../hardware/wiring-notes.md`](../../hardware/wiring-notes.md).

## Setup
1. `cp secrets.example.yaml secrets.yaml` and fill in Wi-Fi / OTA / API values.
2. Edit the `substitutions:` block in `daq-node.yaml` (node name, Modbus address, UART pins).
3. **Verify the Modbus register map** (addresses, value types, scale factors) against your
   breaker's manual and replace every `# PLACEHOLDER`.

## Build & flash
```bash
esphome run daq-node.yaml            # first flash over USB, then OTA
```

## Per-node deployment
Give each node a unique `node_name` and `modbus_address`. Duplicate `daq-node.yaml` per node, or
keep one file and override substitutions from the ESPHome dashboard.

## Key commissioned settings
- `poll_interval: 1000ms` — do not lower without checking for RS485 bus collisions.
- Switching uses Modbus Function Code `0x06` (single-register write) to the breaker latch.
- `logger.baud_rate: 0` frees the hardware UART for Modbus.
