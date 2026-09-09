# Other Component Ratings

Preliminary ratings for the balance-of-system components implied by the architecture. Where fault-level
data is unavailable, the required information is identified rather than invented.

## 1. AC bus / distribution board

| Component | Rating | Basis |
|---|---:|---|
| AC busbar / board | **40 A, ≥ 5.5 kVA, 230 V 1-ph** | ≥ inverter output (23.9 A); standard 40 A board |
| Main incomer MCB | 32 A curve C | ≥ 1.25 × 23.9 A = 29.9 A → 32 A |
| Residual current device | 40 A / 30 mA, Type A | Personnel protection (Type B / "A-EV" if inverter injects smooth DC residual) |
| AC surge protection | Type 2, 275 V, 1P+N | Transient protection |
| Per-load MCBs | see `ac_cable_sizing.md` | Curve D on compressors |

## 2. DC bus / battery side

| Component | Rating | Basis |
|---|---:|---|
| DC busbar | **51.2 V, ≥ 150 A** | ≥ battery continuous current (103 A) + margin |
| Battery DC fuse | **Class-T 125 A**, ≥ 125 VDC, high interrupting capacity | Protects the 50 mm² feeder; battery fault can be several kA |
| Battery DC disconnect | 160 A, ≥ 125 VDC, 2-pole | Isolation / maintenance |
| DC surge protection | Type 2, DC-rated | PV and battery sides |
| BMS | CAN, with contactor trip on OV/UV/OT/over-current | Cell protection + inverter comms |

## 3. PV side

| Component | Rating | Basis |
|---|---:|---|
| PV isolator | 25 A / 1000 VDC, 4-pole | ≥ 1.56 × Isc; string Voc ≤ 280 V |
| PV surge protection | Type 2, DC-rated 600–1000 V | Transient protection |
| String fuses | Not required (2 strings) | Needed only at ≥ 3 parallel strings |

## 4. Grid-forming / neutral-earth

| Component | Rating | Basis |
|---|---:|---|
| Neutral–earth bond | Inverter-formed in island | Single source must provide the earth reference |
| Main earth bar + electrode | 16 mm² Cu bonding | `dc_cable_sizing.md` §3 |
| Insulation-monitoring device | If DC bus floating | Island earthing scheme |

## 5. Higher-voltage DC-bus option (informative)

The selected 51.2 V bus keeps voltages in the safe touch range but forces ~100–150 A on the battery feeder
(50 mm² cable, 125–150 A fuse). A higher-voltage battery bus reduces DC current proportionally:

| Bus voltage | Battery current at 5 kW | Indicative cable | Indicative fuse |
|---:|---:|---|---:|
| 51.2 V (selected) | ≈ 103 A | 50 mm² | 125 A |
| ≈ 102 V | ≈ 51 A | 16–25 mm² | 63 A |
| ≈ 200–400 V | ≈ 13–26 A | 10 mm² | 32 A |

A higher-voltage bus is worth evaluating if cable/fuse cost or DC heat is a concern; it changes the inverter
and battery family. Decision deferred — see `results/engineering_questions.md`.

## 6. Information required before finalising protection

- **Inverter fault-current profile** (magnitude and duration in island mode) — sets breaker curves/coordination.
- **Prospective DC fault current** from the battery bank — confirms fuse interrupting rating.
- **Earthing scheme** (referenced vs floating DC) — decides whether an IMD is required.
- **Actual cable lengths and routing** — confirms voltage drop and grouping derate.
