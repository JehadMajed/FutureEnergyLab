# System Architecture

The toolkit is organised as two tightly coupled layers.

## Physical layer

Each appliance is connected to a dedicated **Data Acquisition (DAQ) node**. A node is the interface
between one appliance, the metering breaker, and the software layer. It provides:

- electrical **measurement** (voltage, current, active power),
- **switching / actuation** (motorised breaker latch, plus relay channels for multi-mode loads),
- **communication** with the software layer.

Components per node (see [`../hardware/daq-node-bom.md`](../hardware/daq-node-bom.md)):

| Component | Role |
|-----------|------|
| Smart metering breaker (CHINT NB2LE class) | Primary measurement + ON/OFF actuation via internal motor |
| ESP32-S3 | Edge gateway: Modbus master, Wi-Fi uplink, command translation |
| TTL-to-RS485 module | Converts ESP32 UART to RS485 differential signalling for Modbus RTU |
| Relay module (multi-channel) | Selects sub-cycles / modes for multi-mode appliances |
| AC/DC converter (5 V + 24 V) | Powers logic and relays independently of breaker state |
| Enclosure | Protection, wiring organisation, wall-mount format |

## Software layer

| Stage | Tool | Function |
|-------|------|----------|
| Edge firmware | ESPHome on ESP32-S3 | Poll breaker registers, execute Modbus writes, collision-aware scheduling |
| Local orchestration | Home Assistant on Orange Pi (offline) | Receive telemetry, store entity states with UNIX timestamps |
| Data extraction | Python + HA REST API | History pull, forward-fill, 1 s resample, long→wide reshape, CSV output |
| Automation | Node-RED | Scheduled triggers, ordered switching sequences, relay-path selection |
| Backend admin | SSH (headless) | Log inspection, service supervision, dataset transfer |

## Integration blocks

Two load-integration paths are used depending on appliance behaviour:

- **Block A — single-mode**: direct ON/OFF or stable signature. Breaker-centred node only.
- **Block B — multi-mode**: cyclic / sequential behaviour (compressor, motor sub-processes,
  heat+pump stages). Node is coordinated through both the breaker and the relay stage.

See [`03-load-inventory.md`](03-load-inventory.md) for the per-appliance classification.

## Data flow

```
Appliance → Breaker → RS485 (Modbus RTU) → ESP32-S3 → Wi-Fi → Home Assistant
        → REST API → Python extractor → per-appliance CSV + master CSV
Node-RED ↔ Home Assistant event bus → scheduled / relay-assisted control back to the breaker
```
