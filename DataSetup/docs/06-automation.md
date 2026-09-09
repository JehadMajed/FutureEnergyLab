# Automation and Control Layer (Node-RED)

**Node-RED** runs as a local workflow engine alongside ESPHome and Home Assistant. It subscribes
to the Home Assistant event bus and turns timing conditions, scheduled triggers, and
measurement-driven events into ordered control actions.

## Two automation categories

### (a) Binary-device flows
Direct breaker ON/OFF for single-mode appliances (lamps, kettles, heaters). Straightforward
software-to-hardware mapping: the flow toggles the breaker's internal latch with no secondary routing.

### (b) Multi-mode-device flows
Coordinate breaker actuation with multi-channel relay routing to represent internal appliance modes
(washing-machine cycles, oven modes). The flow delivers primary power via the breaker while
transmitting routing commands to the relay module to select a sub-cycle or state.

## Patterns used

- Schedule-driven operation: periodic triggers, CSV-based schedules, local-time logic.
- Ordered switching sequences: breaker unlock → delayed actuation.
- Relay-path selection for multi-mode devices.

## Reliability notes

The layering (ESPHome edge firmware → Home Assistant orchestration → Python preprocessing →
Node-RED automation) is deliberately cloud-free to maximise local resilience. Commissioning tuned
the poll interval and supervised services for continuous 24/7 operation with remote backend
maintenance.
