# Wiring Notes

## Power path

```
Mains L/N ──► [AC/DC converter] ──► 5 VDC ──► ESP32-S3
                               └──► 24 VDC ─► relay module coils
Mains L ────► [Smart breaker] ──► Appliance L
Mains N ───────────────────────► Appliance N
```

The AC/DC converter is fed **upstream** of the smart breaker so the ESP32 stays alive when the
breaker is open/tripped.

## Serial / Modbus

```
ESP32 UART TX ──► RS485 module DI
ESP32 UART RX ──◄ RS485 module RO
ESP32 GPIO    ──► RS485 module DE+RE   (skip if module is auto-direction)
RS485 A/B     ──► Breaker A/B          (twisted pair; 120 Ω at bus ends)
Common GND between ESP32 and RS485 module
```

Set the UART pins and the optional flow-control pin in `firmware/esphome/daq-node.yaml`.

## Relay routing (Block B, multi-mode appliances)

Relay channels sit between the breaker output and the appliance's mode-select inputs (or internal
program lines). The reference build selects a mode via a combination of up to four channels.
Exact wiring is appliance-specific — trace the appliance's own controls first.

## Checklist before energising

- [ ] Continuity: no L–N short, enclosure earth bonded.
- [ ] RS485 A/B not swapped; termination correct.
- [ ] Breaker Modbus address matches firmware `substitutions`.
- [ ] Breaker register map verified against manufacturer manual.
- [ ] Logic supply present and stable before mains applied to the breaker.
