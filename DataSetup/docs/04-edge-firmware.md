# Edge Firmware and Communication Layer

The edge firmware runs on the ESP32-S3 in each DAQ node. **ESPHome** is used as the framework.

## Responsibilities

- Manage Modbus RTU communication over the TTL-to-RS485 interface.
- Periodically poll the breaker registers: **voltage, current, active power, status**.
- Execute switching via Modbus **single-register write (Function Code 0x06)**, which triggers the
  breaker's internal motorised latch for dependable ON/OFF.
- Collision-aware scheduling: **poll interval = 1000 ms** to avoid RS485 bus collisions.
- Translate network-level commands into Modbus payloads for the breaker and, where applicable,
  relay channels.

## Register map

The reference `firmware/esphome/daq-node.yaml` contains **placeholder** register addresses and
scaling factors. The exact map depends on the breaker firmware revision — confirm every address,
data type, and scale against the CHINT NB2LE Modbus documentation for your unit before use.

## Configuration

See [`../firmware/esphome/README.md`](../firmware/esphome/README.md) for build/flash steps and the
substitutions you must set (node name, Wi-Fi, Modbus address, UART pins).
