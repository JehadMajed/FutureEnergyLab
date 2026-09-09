# Commissioning Notes

## Timeline

Deployment and commissioning of the 21 independent DAQ nodes spanned roughly 6–8 months,
including hardware assembly, lab infrastructure preparation, and calendar recesses.

## Breaker over-frequency fault (60 Hz vs 65 Hz)

The CHINT NB2LE breakers exhibited persistent over-frequency alarm trips: the internal protection
falsely registered a ~65 Hz network frequency and tripped immediately on a 60 Hz mains supply.

**Resolution:** using the serial debug tool **SSCOM**, the breakers were interfaced directly via an
RS485-to-TTL USB module and proprietary hex commands were transmitted to recalibrate the frequency
threshold and register mappings in the breaker's internal firmware.

> These are undocumented, device-specific commands. Recalibrating protection thresholds affects
> safety behaviour — do this only if you understand the consequences for your grid and hardware.

## Communication stability

After recalibration, ESPHome communication was verified: consistent packet delivery over the RS485
differential bus, and **poll interval optimised to 1000 ms** to fully eliminate bus collisions,
giving error-free telemetry across all nodes.

## Control classification

Control scripts were split into two logic categories by switching mechanism:

1. **Binary (direct switching)** — script toggles the breaker's internal mechanism directly.
2. **Multi-mode (relay-assisted)** — script coordinates breaker power delivery with routing
   commands to the multi-channel relay module to select operational states / sub-cycles.
