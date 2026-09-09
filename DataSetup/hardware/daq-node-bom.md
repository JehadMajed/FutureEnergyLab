# DAQ Node — Bill of Materials (per node)

| # | Item | Spec / notes | Qty |
|---|------|--------------|-----|
| 1 | Smart metering breaker | CHINT NB2LE class, Modbus RTU (RS485), motorised latch, V/I/P metering | 1 |
| 2 | ESP32-S3 dev board | Wi-Fi, ≥2 hardware UARTs, USB for flashing | 1 |
| 3 | TTL-to-RS485 module | Auto-direction or DE/RE pin (e.g. MAX485 / SP3485 based) | 1 |
| 4 | Relay module | 4-channel, opto-isolated, coil voltage 24 VDC (or 5 VDC — match supply) | 1 |
| 5 | AC/DC converter | 220 VAC → 5 VDC (logic); second rail 24 VDC for relays | 1 (or 2) |
| 6 | Plastic enclosure | DIN or wall-mount, room for mains + low-voltage separation | 1 |
| 7 | Terminal blocks, ferrules, RS485 twisted pair, hookup wire | — | as needed |
| 8 | RS485 bus termination | 120 Ω at bus ends if daisy-chaining multiple nodes | as needed |

## Notes

- The 5 V rail must stay powered when the breaker trips, so the controller keeps reporting — feed
  the AC/DC converter from a source upstream of the metered breaker.
- Keep mains and low-voltage wiring on opposite sides of the enclosure; maintain clearance.
- One RS485 master (ESP32) per breaker in the reference build. Multi-drop is possible if each
  breaker has a unique Modbus address and the poll schedule is staggered.
