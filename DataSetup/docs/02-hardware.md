# Hardware

## DAQ node components

### Smart metering breaker (CHINT NB2LE class)
Acts as both actuator and meter. An internal motor latches/unlatches the circuit for ON/OFF
operation. Built-in sensing exposes voltage, current, and active power over a Modbus RTU
interface. This is the central field device of the node.

### ESP32-S3
The processing and communication unit. Runs the edge firmware, manages the Wi-Fi link to the
collection server, polls the breaker registers, and forwards switching commands.

### TTL-to-RS485 module
The ESP32 speaks low-voltage UART; the breaker speaks RS485. This module converts TX/RX
logic-level signals to RS485 differential signalling so Modbus RTU runs reliably over the serial bus.

### Relay module
Multi-channel relay providing independent switching paths for one appliance. Required for
multi-mode loads where simple breaker ON/OFF is not enough to represent internal states.
The reference build routes appliance modes through a combination of four relay channels.

### AC/DC converter
Dedicated power supply. Steps 220 VAC mains down to **5 VDC** (ESP32 logic) and **24 VDC**
(relay actuation). Independent supply keeps the controller and comms alive even if the breaker trips.

### Enclosure
Plastic wall-mountable case: physical protection, wiring organisation, reduced interference.

## Integrated node function

Assembled, the node acquires measurements, executes control actions, and forwards data to the
software layer. Breaker = measurement + switching; ESP32-S3 = computation + networking;
RS485 = protocol link; relay stage = multi-mode routing; power modules = stable independent supply.

See [`daq-node-bom.md`](../hardware/daq-node-bom.md) and
[`wiring-notes.md`](../hardware/wiring-notes.md).

## Safety

Mains wiring must be done by a competent person, de-energised, and to local code. The relay and
RS485 wiring share an enclosure with mains conductors — maintain creepage/clearance and use
appropriately rated components. Verify the breaker's Modbus register map against its manual
before relying on any measurement or issuing writes.
