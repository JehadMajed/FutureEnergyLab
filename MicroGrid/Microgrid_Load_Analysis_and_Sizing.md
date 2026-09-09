# Microgrid Load Analysis and Component Sizing

> Load inventory, daily energy calculation, component sizing for the PSAU laboratory microgrid,
> and assessment of the existing SonnenBatterie eco 8.0 setup.

---

## Table of Contents

1. [Load Inventory](#1-load-inventory)
2. [Daily Energy Consumption](#2-daily-energy-consumption)
3. [Phase Balance Analysis](#3-phase-balance-analysis)
4. [Simultaneity and Peak Demand](#4-simultaneity-and-peak-demand)
5. [Component Sizing — Ideal System](#5-component-sizing--ideal-system)
6. [Inverter and DC Bus Specifications](#6-inverter-and-dc-bus-specifications)
7. [SonnenBatterie eco 8.0 Assessment](#7-sonnenbatterie-eco-80-assessment)
8. [Sizing Comparison: Ideal vs Sonnen](#8-sizing-comparison-ideal-vs-sonnen)

---

## 1. Load Inventory

All residential loads distributed across three single phases (A, B, C):

| # | Load | Phase | Rated Power (W) | Daily On-Time | On-Time (h) | Daily Energy (Wh) | Notes |
|---|------|-------|-----------------|---------------|-------------|-------------------|-------|
| 1 | Hoover | A | 1,400 | 1h 5min | 1.083 | 1,517 | |
| 2 | Blender | A | 150 | 5 min | 0.083 | 12 | |
| 3 | Iron | A | 1,100 | 1h 5min | 1.083 | 1,192 | |
| 4 | Fan | A | 50 | ~8h (assumed) | 8.000 | 400 | Duration not specified; 8h assumed |
| 5 | Water Cooler | A | 110 | 9h | 5.400 | 594 | Compressor duty cycle ~60%, effective on-time = 5.4h |
| 6 | Hair Dryer | B | 1,100 | 20 min | 0.333 | 367 | |
| 7 | Air Fryer | B | 1,300 | 1h 50min | 1.833 | 2,383 | |
| 8 | Heater | B | 800 | 1h 5min | 1.083 | 867 | |
| 9 | Hair Iron | B | 110 | 20 min | 0.333 | 37 | |
| 10 | Fridge | B | 500 | Always on | 10.800 | 5,400 | Compressor duty ~45% in hot climate, effective ≈ 10.8h |
| 11 | Washing Machine | B | 600 | 3h 30min | 3.500 | 2,100 | |
| 12 | Oven | B | 2,000 | 2h | 2.000 | 4,000 | |
| 13 | Microwave | C | 50 | 8 min | 0.133 | 7 | |
| 14 | Oil Heater | C | 1,500 | 4h | 4.000 | 6,000 | |
| 15 | Kettle | C | 1,500 | 5 min | 0.083 | 125 | |
| 16 | TV | C | 85 | Always on | 24.000 | 2,040 | |
| 17 | Toaster | C | 710 | 5 min | 0.083 | 59 | |

### Notes on Compressor-Based Loads

The fridge and water cooler have compressors that cycle on and off. The rated power is the compressor running power, not the average consumption:

- **Fridge** (500 W): Always connected, but the compressor runs intermittently. In hot climates (Al-Kharj, Saudi Arabia, up to 45°C+), the duty cycle is higher than moderate climates. Assumed 45% duty → effective 10.8h/day.
- **Water Cooler** (110 W): Plugged in for 9 hours, but the compressor cycles. Assumed 60% duty → effective 5.4h/day.

---

## 2. Daily Energy Consumption

### 2.1 Energy by Phase

| Phase | Loads | Total Power (W) | Total Energy (Wh/day) |
|-------|-------|-----------------|----------------------|
| **A** | Hoover, Blender, Iron, Fan, Water Cooler | 2,810 | 3,715 |
| **B** | Hair Dryer, Air Fryer, Heater, Hair Iron, Fridge, Washing Machine, Oven | 6,410 | 15,154 |
| **C** | Microwave, Oil Heater, Kettle, TV, Toaster | 3,845 | 8,231 |
| **Total** | **17 loads** | **13,065** | **27,100** |

### 2.2 Summary

$$E_{daily} \approx 27.1 \text{ kWh/day}$$

This is the total energy consumed if each load runs for its specified daily duration.

> **Note:** The simultaneity factor does NOT reduce daily energy — it only affects peak instantaneous power. Each load consumes its energy independently over its specified duration regardless of overlap with other loads.

---

## 3. Phase Balance Analysis

### 3.1 Power Distribution

```
Phase A:  2,810 W  ████████████░░░░░░░░░░░░  21.5%
Phase B:  6,410 W  ████████████████████████████████████████████████████  49.1%
Phase C:  3,845 W  ██████████████████░░░░░░  29.4%
```

### 3.2 Energy Distribution

```
Phase A:  3,715 Wh  █████░░░░░░░░░░░░░░░░░  13.7%
Phase B: 15,154 Wh  ████████████████████████████████████████████████████  55.9%
Phase C:  8,231 Wh  ██████████████████████████████░░  30.4%
```

### 3.3 Imbalance Assessment

Average power per phase: 13,065 / 3 = 4,355 W

$$\text{Power imbalance} = \frac{P_{max} - P_{min}}{P_{avg}} = \frac{6{,}410 - 2{,}810}{4{,}355} = 82.7\%$$

> **Phase B is heavily overloaded** relative to Phase A. This is a significant imbalance. In practice, it means:
> - Phase B inverter/wiring must be sized for the heaviest phase, not the average
> - If using a single three-phase inverter, it must handle the B-phase load without tripping
> - Consider redistributing some Phase B loads (e.g., move Oven or Air Fryer to Phase A) to improve balance

---

## 4. Simultaneity and Peak Demand

### 4.1 Determining the Simultaneity Factor

Since loads are programmatically controlled, the simultaneity factor is determined by the worst-case scenario script. Estimating based on long-duration loads that are likely to overlap:

**Always-on loads (baseline):**
| Load | Phase | Power (W) |
|------|-------|-----------|
| Fridge | B | 500 |
| TV | C | 85 |
| **Subtotal** | | **585** |

**Long-duration loads likely to overlap:**
| Load | Phase | Power (W) | Duration |
|------|-------|-----------|----------|
| Water Cooler | A | 110 | 9h |
| Fan | A | 50 | 8h |
| Oil Heater | C | 1,500 | 4h |
| Washing Machine | B | 600 | 3.5h |
| Oven | B | 2,000 | 2h |
| Air Fryer | B | 1,300 | 1h 50min |

**Realistic worst-case simultaneous power:**

Scenario: Always-on + all long-duration + one short-duration load (Iron or Hoover):

$$P_{simultaneous} = 585 + 110 + 50 + 1{,}500 + 600 + 2{,}000 + 1{,}300 + 1{,}100 = 7{,}245 \text{ W}$$

Adding the Hoover instead of Iron (heavier):

$$P_{simultaneous,max} = 585 + 110 + 50 + 1{,}500 + 600 + 2{,}000 + 1{,}300 + 800 + 1{,}400 = 8{,}345 \text{ W}$$

### 4.2 Calculated Simultaneity Factor

$$f_{simult} = \frac{P_{simultaneous,max}}{P_{total,connected}} = \frac{8{,}345}{13{,}065} = 0.639$$

Using **$f_{simult} = 0.65$** (rounded up for safety):

$$P_{peak} = 13{,}065 \times 0.65 = 8{,}492 \text{ W} \approx 8.5 \text{ kW}$$

> This is consistent with the original 10 kW assumption (which already included margin). For sizing purposes, we will use **$P_{peak} = 8.5$ kW** as the calculated peak and note that the 10 kW figure provides additional headroom.

### 4.3 Peak Power by Phase (Worst-Case Overlap)

| Phase | Simultaneous Loads | Peak Power |
|-------|-------------------|------------|
| A | Hoover + Iron + Fan + Water Cooler | 2,660 W |
| B | Fridge + Oven + Air Fryer + Washing Machine + Heater | 5,200 W |
| C | Oil Heater + TV + Kettle | 3,085 W |

Phase B dominates the peak at **5.2 kW** — this sets the per-phase inverter requirement.

---

## 5. Component Sizing — Ideal System

Design parameters confirmed from the sizing guide:

| Parameter | Symbol | Value |
|-----------|--------|-------|
| Peak load power | $P_{peak}$ | 8.5 kW (10 kW with margin) |
| Daily energy | $E_{daily}$ | 27.1 kWh/day |
| Islanding autonomy | $t_{auto}$ | 4 hours |
| Location (PSH) | PSH | 5.5 h (Al-Kharj, conservative) |
| Battery DoD | DoD | 80% |
| Battery efficiency | $\eta_{batt}$ | 90% |
| Inverter efficiency | $\eta_{inv}$ | 93% |
| PV derating | $f_{derating}$ | 80% |
| Safety factor | $f_{safety}$ | 1.25 |
| Degradation margin | $f_{deg}$ | 1.10 |

### 5.1 Battery Sizing (Islanding)

$$E_{batt} = \frac{P_{peak} \times t_{auto}}{\eta_{inv} \times DoD} \times f_{deg} \times f_{safety}$$

$$E_{batt} = \frac{8.5 \times 4}{0.93 \times 0.80} \times 1.10 \times 1.25$$

| Step | Calculation | Result |
|------|------------|--------|
| Islanding energy | $8.5 \times 4$ | 34.00 kWh |
| After inverter losses | $34.00 \div 0.93$ | 36.56 kWh |
| After DoD | $36.56 \div 0.80$ | 45.70 kWh |
| After degradation | $45.70 \times 1.10$ | 50.27 kWh |
| **After safety factor** | $50.27 \times 1.25$ | **62.84 kWh** |

$$\boxed{E_{batt} \approx 63 \text{ kWh}}$$

### 5.2 Inverter Sizing

$$P_{inv,continuous} = P_{peak} \times f_{safety} = 8.5 \times 1.25 = 10.63 \text{ kW}$$

$$P_{inv,surge} = P_{peak} \times k_{surge} = 8.5 \times 2.5 = 21.25 \text{ kW}$$

$$\boxed{P_{inv} \geq 11 \text{ kW continuous, } 21 \text{ kW surge}}$$

### 5.3 PV Array Sizing

$$P_{PV} = \frac{E_{daily}}{\eta_{batt} \times \eta_{inv} \times PSH \times f_{derating}} \times f_{safety}$$

$$P_{PV} = \frac{27.1}{0.90 \times 0.93 \times 5.5 \times 0.80} \times 1.25$$

| Step | Calculation | Result |
|------|------------|--------|
| Energy after losses | $27.1 \div (0.90 \times 0.93)$ | 32.37 kWh |
| PV raw | $32.37 \div (5.5 \times 0.80)$ | 7.36 kWp |
| **With safety** | $7.36 \times 1.25$ | **9.20 kWp** |

$$\boxed{P_{PV} \approx 9.2 \text{ kWp (23 panels @ 400W, ~46 m²)}}$$

### 5.4 Charge Controller Sizing

$$I_{cc} = \frac{P_{PV}}{V_{bus}} \times f_{safety} = \frac{9{,}200}{48} \times 1.25 = 239 \text{ A}$$

### 5.5 Complete Sizing Summary

| Component | Sized Value | Practical Selection |
|-----------|------------|-------------------|
| **Battery** | 62.84 kWh | ~65 kWh (13 × 5 kWh modules) |
| **Inverter** | 10.63 kW cont. | ≥11 kW continuous, grid-forming |
| **PV Array** | 9.20 kWp | 23 × 400W panels (~46 m²) |
| **Charge Controller** | 239 A total | 3 × 80A MPPT units |

---

## 6. Inverter and DC Bus Specifications

### 6.1 Inverter Architecture

For a microgrid supporting both grid-connected and islanding modes, the inverter is the most critical component. It must serve as the bridge between the DC side (battery + PV) and the AC side (loads).

#### 6.1.1 Inverter Types and When to Use Each

| Type | Function | Grid-Connected | Islanding | This Project |
|------|----------|:-:|:-:|:-:|
| **Grid-Following** | Synchronizes to external grid voltage/frequency | ✅ | ❌ | Needed for EMS mode |
| **Grid-Forming** | Creates its own voltage and frequency reference | Optional | ✅ | **Required** for islanding |
| **Multi-Mode / Hybrid** | Switches between grid-following and grid-forming | ✅ | ✅ | **Best choice** |

For this project: **A multi-mode (hybrid) inverter is required** — it must grid-follow during normal operation and seamlessly transition to grid-forming when islanding is triggered.

#### 6.1.2 Key Inverter Specifications

| Specification | Requirement | Reasoning |
|--------------|-------------|-----------|
| **Continuous AC output** | ≥ 11 kW | $P_{peak} \times f_{safety} = 8.5 \times 1.25$ |
| **Surge capacity** | ≥ 21 kW for 5 seconds | Motor/compressor inrush (fridge, washing machine, hoover) |
| **Output voltage** | 230V L-N / 400V L-L | Saudi Arabia standard |
| **Output frequency** | 60 Hz ± 0.5 Hz | Saudi grid standard; must be tightly regulated in island mode |
| **Waveform** | Pure sine wave, THD < 5% | Required for sensitive electronics; IEEE 519 compliance |
| **Transfer time** | < 20 ms | Seamless transition to island mode (UPS-grade); prevents load dropout |
| **DC input range** | Must match battery + PV voltage | See DC bus design below |
| **Efficiency** | ≥ 93% at rated load | CEC or European weighted efficiency |
| **MPPT channels** | ≥ 2 (if integrated PV input) | One for each PV string orientation or split |
| **Communication** | Modbus TCP/RTU, CAN bus | Integration with EMS controller (ESP32 / Node-RED) |
| **Protection** | Over-current, over-voltage, under-voltage, anti-islanding (grid-connected), ground fault | Safety and equipment protection |

#### 6.1.3 Three-Phase Configuration Options

**Option A — Single Three-Phase Hybrid Inverter**

```
DC Bus ──────────► [Three-Phase Hybrid Inverter] ──► Phase A (230V)
(Battery + PV)         11+ kW continuous              Phase B (230V)
                       Grid-forming capable            Phase C (230V)
```

- **Pros**: Single unit, integrated controls, simpler wiring
- **Cons**: Single point of failure; phase imbalance handling depends on inverter quality
- **Requirement**: Must handle unbalanced loads (Phase B draws 2× Phase A)

**Option B — Three Single-Phase Inverters**

```
DC Bus ──┬──► [Inverter 1 — 5.5 kW] ──► Phase A
         ├──► [Inverter 2 — 5.5 kW] ──► Phase B
         └──► [Inverter 3 — 5.5 kW] ──► Phase C
```

- **Pros**: Each phase sized independently; redundancy (one can fail)
- **Cons**: Requires synchronization between units; more complex wiring
- **Requirement**: All three must synchronize their output (same frequency, 120° phase offset)

**Recommendation**: For a lab setup, **Option A** (single three-phase inverter) is simpler and more common at this power range (11 kW). However, Phase B should be checked against the inverter's per-phase current limit since it carries nearly 50% of the total load.

### 6.2 DC Bus Design

The DC bus is the backbone of the microgrid's DC side, connecting battery, PV, and the inverter's DC input.

#### 6.2.1 Voltage Selection

| DC Bus Voltage | Battery Current at 8.5 kW | PV Current at 9.2 kWp | Cable Size (Cu) | Suitability |
|---------------|--------------------------|----------------------|-----------------|-------------|
| **48 V** | 190 A | 192 A | 70–95 mm² | High current, thick cables, higher losses |
| **96 V** | 95 A | 96 A | 25–35 mm² | Moderate, good balance |
| **200 V** | 46 A | 46 A | 10–16 mm² | Low current, thin cables |
| **400 V** | 23 A | 23 A | 4–6 mm² | Very low current, matches high-voltage batteries |

**Current calculation:**

$$I_{DC} = \frac{P_{peak}}{V_{bus} \times \eta_{inv}} = \frac{8{,}500}{V_{bus} \times 0.93}$$

**Recommendation**: For an 11 kW system, **96V or higher** is preferred to keep currents manageable. Many modern hybrid inverters use 400V DC bus internally and accept battery voltages in the 200–500V range. The 48V option works but results in very high currents requiring expensive thick cabling and large fuses.

#### 6.2.2 DC Bus Architecture

```
┌──────────────────────────────────────────────────────┐
│                     DC BUS                           │
│           (Nominal: 96V or 200–400V)                 │
│                                                      │
│    ┌──────────┐   ┌──────────────┐   ┌──────────┐   │
│    │ Battery  │   │ MPPT Charge  │   │ Hybrid   │   │
│    │ Bank     │   │ Controller   │   │ Inverter │   │
│    │          │   │              │   │          │   │
│    │ 63+ kWh  │   │ PV → DC Bus  │   │ DC → AC  │   │
│    │          │   │              │   │ AC → DC  │   │
│    └────┬─────┘   └──────┬───────┘   └────┬─────┘   │
│         │                │                │          │
│    ┌────┴────┐      ┌────┴────┐      ┌────┴────┐    │
│    │DC Disc. │      │DC Disc. │      │DC Disc. │    │
│    │+ Fuse   │      │+ Fuse   │      │+ Fuse   │    │
│    └────┬────┘      └────┬────┘      └────┬────┘    │
│         └────────────────┼────────────────┘          │
│                          │                           │
│                    ┌─────┴─────┐                     │
│                    │  DC BUS   │                     │
│                    │  BAR      │                     │
│                    └───────────┘                     │
└──────────────────────────────────────────────────────┘
```

#### 6.2.3 DC Bus Protection

| Protection Device | Purpose | Rating |
|------------------|---------|--------|
| **DC disconnect switch** | Isolation for maintenance | ≥ 1.25 × max DC current, rated for DC voltage |
| **DC fuses (HRC)** | Short-circuit protection | Per NEC 690 or IEC 60269; rated for DC |
| **Battery BMS** | Over-charge, over-discharge, cell balancing, temperature | Integral to battery modules |
| **Surge protection (SPD)** | Lightning and switching surges | Type 2 SPD, DC-rated |
| **Ground fault detection** | Earth leakage on ungrounded DC bus | IMD (Insulation Monitoring Device) for floating DC |

#### 6.2.4 Grounding Scheme

For a battery-based DC bus, two options:

| Scheme | Description | Pros | Cons |
|--------|-------------|------|------|
| **TN-S (grounded)** | One DC pole grounded | Simple fault detection; standard breakers | Corrosion risk on grounded pole |
| **IT (floating/ungrounded)** | Neither pole grounded | No single-fault shutdown; higher safety | Requires IMD; second fault is dangerous |

Most modern battery inverter systems use **floating DC bus with IMD** (Insulation Monitoring Device) per IEC 62109-2.

### 6.3 AC Side Specifications

| Specification | Value | Standard |
|--------------|-------|----------|
| **Nominal voltage** | 230V L-N / 400V L-L | SASO / IEC 60038 |
| **Frequency** | 60 Hz | SEC (Saudi Electricity Company) |
| **Frequency tolerance (grid-connected)** | ± 0.2 Hz | Grid code |
| **Frequency tolerance (island)** | ± 0.5 Hz | Inverter-controlled, tighter is better |
| **Voltage tolerance (grid-connected)** | ± 10% (207–253V) | IEC 60038 |
| **Voltage tolerance (island)** | ± 5% (218–242V) | Tighter for sensitive loads |
| **THD (voltage)** | < 5% total, < 3% individual | IEEE 519 / IEC 61000-3-2 |
| **Power factor** | ≥ 0.95 (adjustable) | SEC grid code |

### 6.4 Protection and Safety

| Protection | Location | Function |
|-----------|----------|----------|
| **AC circuit breaker** | Inverter output | Over-current, short-circuit |
| **RCD / RCCB** | AC distribution board | Earth leakage (30 mA for personal protection) |
| **Anti-islanding relay** | PCC (Point of Common Coupling) | Prevents energizing the grid during outage (grid-connected mode) |
| **Automatic transfer switch (ATS)** | Between grid and microgrid | Seamless transfer between grid and island mode |
| **Phase sequence relay** | Three-phase input | Prevents reverse rotation of motors |
| **Over/under voltage relay** | AC bus | Disconnects loads if voltage exceeds safe range |
| **Over/under frequency relay** | AC bus | Disconnects if frequency drifts beyond limits |

---

## 7. SonnenBatterie eco 8.0 Assessment

### 7.1 Known Specifications

From the existing simulation code and hardware documentation:

| Parameter | Value | Source |
|-----------|-------|--------|
| Model | SonnenBatterie eco 8.0 | Lab hardware |
| Gross capacity | **2,500 Wh (2.5 kWh)** | Nameplate |
| Max charge/discharge power | **3,300 W (3.3 kW)** | Nameplate |
| Charging efficiency | 95% | Datasheet |
| Discharging efficiency | 95% | Datasheet |
| Round-trip efficiency | 90.25% ($0.95 \times 0.95$) | Calculated |
| SOC limits | 10% – 90% | Battery management (lifecycle protection) |
| PV inverter | StecaGrid 3213 | Grid-following, 1.0 kW programmed peak |
| Grid frequency | 60 Hz | Saudi Arabia |
| System voltage | 230V single-phase | Lab configuration |

### 7.2 Usable Capacity — All Reduction Factors

The 2,500 Wh gross capacity is reduced by multiple factors before reaching the actual usable energy at the load:

| # | Reduction Factor | Value | Effect | Remaining Capacity |
|---|-----------------|-------|--------|-------------------|
| 0 | Gross (nameplate) capacity | — | Starting point | **2,500 Wh** |
| 1 | SOC lower limit (10%) | $-250$ Wh | BMS prevents deep discharge to protect cell life | **2,250 Wh** |
| 2 | SOC upper limit (90%) | $-250$ Wh | BMS prevents overcharge | **2,000 Wh** |
| 3 | Discharging efficiency | $\times 0.95$ | Ohmic and conversion losses during discharge | **1,900 Wh** |
| 4 | Inverter DC→AC conversion | $\times 0.95$ | Internal inverter losses (Sonnen has integrated inverter) | **1,805 Wh** |
| 5 | Wiring / contact losses | $\times 0.98$ | Cable resistance, connector drops | **1,769 Wh** |
| 6 | Temperature derating | $\times 0.95$ | Li-ion capacity drops in high heat (Al-Kharj, 40°C+) | **1,680 Wh** |
| 7 | Calendar/cycle aging | $\times 0.90$ | After 2–3 years or ~500 cycles, capacity degrades ~10% | **1,512 Wh** |

### 7.3 Combined Derating Formula

$$E_{usable} = E_{gross} \times (SOC_{max} - SOC_{min}) \times \eta_{dis} \times \eta_{inv} \times \eta_{wiring} \times f_{temp} \times f_{aging}$$

$$E_{usable} = 2{,}500 \times 0.80 \times 0.95 \times 0.95 \times 0.98 \times 0.95 \times 0.90$$

$$\boxed{E_{usable} \approx 1{,}512 \text{ Wh} \approx 1.51 \text{ kWh}}$$

### 7.4 Derating Waterfall

```
2,500 Wh  ██████████████████████████████████████████████████  Gross
2,000 Wh  ████████████████████████████████████████            After SOC window (80%)
1,900 Wh  ██████████████████████████████████████              After discharge η (95%)
1,805 Wh  ████████████████████████████████████                After inverter η (95%)
1,769 Wh  ███████████████████████████████████                 After wiring η (98%)
1,680 Wh  █████████████████████████████████                   After temp derating (95%)
1,512 Wh  ██████████████████████████████                      After aging (90%)
          ▲                                                    
          └── Only 60.5% of nameplate reaches the load
```

### 7.5 Islanding Capability with Sonnen

**At 450W critical load (from existing simulation):**

$$t_{island} = \frac{E_{usable}}{P_{load}} = \frac{1{,}512}{450} = 3.36 \text{ hours}$$

With new battery (no aging): $\frac{1,680}{450} = 3.73$ hours

**At 500W critical load:**

$$t_{island} = \frac{1{,}512}{500} = 3.02 \text{ hours}$$

> **The Sonnen battery at 450W can provide ~3.4 hours of islanding — just under the 4-hour target.** At 500W it drops to ~3 hours. This aligns with the existing simulation analysis.

### 7.6 Maximum Load the Sonnen Can Support for 4 Hours

Working backwards from the 4-hour requirement:

$$P_{max,4h} = \frac{E_{usable}}{t_{auto}} = \frac{1{,}512}{4} = 378 \text{ W}$$

With new battery: $\frac{1{,}680}{4} = 420$ W

> **For a reliable 4-hour islanding with the Sonnen, the critical load must stay below ~380W (aged) to ~420W (new).**

### 7.7 Critical Limitations of the Sonnen Setup

| Limitation | Impact | Severity |
|-----------|--------|----------|
| **Capacity too small** | 2.5 kWh vs 63 kWh needed for full-load islanding | Critical |
| **Power too low** | 3.3 kW max vs 8.5–10 kW peak load | Critical |
| **Not grid-forming** | Cannot create voltage/frequency reference for island mode without sonnenBackup-Box | Critical |
| **Single-phase only** | Cannot serve three-phase load distribution directly | Significant |
| **PV inverter is grid-following** | StecaGrid 3213 shuts down if grid is lost (requires grid reference) | Critical for islanding |
| **No PV during island** | Both Sonnen and StecaGrid need grid reference → 0W PV in island | Critical |

---

## 8. Sizing Comparison: Ideal vs Sonnen

| Parameter | Ideal System (Sized) | Sonnen eco 8.0 (Actual) | Gap |
|-----------|---------------------|------------------------|-----|
| Battery capacity (gross) | 63 kWh | 2.5 kWh | **25× undersized** |
| Battery capacity (usable) | ~50 kWh | 1.5–2.0 kWh | **25–33× undersized** |
| Inverter power | 11 kW continuous | 3.3 kW | **3.3× undersized** |
| Inverter type | Multi-mode (grid-forming) | Grid-following only | **Cannot island** |
| PV array | 9.2 kWp | 1.0 kWp (emulator) | **9× undersized** |
| Phase support | Three-phase (A, B, C) | Single-phase | **2 phases missing** |
| 4h islanding load | 8.5 kW (full load) | 378–420 W (max) | **20× gap** |

### 8.1 What the Sonnen Setup CAN Do

Despite its small size, the Sonnen setup is valuable for:

1. **Lab-scale demonstration** of EMS concepts (peak shaving, TOU arbitrage)
2. **Single-phase, light-load islanding** at 300–400W for 3–4 hours
3. **Control algorithm development** (ESP32 + Node-RED dispatch logic)
4. **Educational purposes** (understanding SOC management, efficiency losses, power flow)
5. **Validation platform** for simulation models (compare simulation vs hardware)

### 8.2 What Would Be Needed to Bridge the Gap

To serve the full 17-load residential setup for 4-hour islanding:

| Upgrade | From | To |
|---------|------|-----|
| Battery | 1 × Sonnen eco 8.0 (2.5 kWh) | 13 × 5 kWh modules or equivalent (~65 kWh) |
| Inverter | Sonnen internal (3.3 kW, grid-following) | 11+ kW multi-mode hybrid inverter (grid-forming capable) |
| PV | StecaGrid 3213 (1 kWp emulated) | 9.2 kWp array (23 × 400W panels) |
| Distribution | Single-phase | Three-phase with phase balancing |

---

*This document is part of the Micro-Grid PSAU project.*
*Location: Al-Kharj, Saudi Arabia | PSH: 5.5h (conservative annual average)*
