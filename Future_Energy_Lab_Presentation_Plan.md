# Future Energy Lab — 10-Slide Presentation Plan

**Prepared as:** technical presentation plan (engineering review standard)
**Audience:** university professors · LV Department managers · industry partners (CHINT, Saudi Electricity / SEC stakeholders)
**Core message:** *The Future Energy Lab is a practical LV innovation platform that combines microgrid design, intelligent protection, digital-twin monitoring, emerging energy technologies, and local engineering capability for Saudi 60-Hz applications.*

---

## 0. How this plan was built (folder analysis notes)

**Instructor Notes were read first and take priority.** They contain:

1. `Instructor Notes/New مستند نصي.txt` — direction from Dr. Malek Alduhaimi (WhatsApp export):
   - Arc-fault work = two papers: one attached (`arc_pinn_manuscript_final.pdf`), a second *comparison* paper in progress by "Omar Amir".
   - Two further papers submitted, **one accepted**: *"Hybrid LSTM-CUSUM Framework for Electricity Theft Detection in Residential Smart Grids"*; plus *"Inferring Low-Voltage Distribution Topology from Trench Footprints: A Deep Learning Framework with Infrared Thermal Validation"*.
   - "≈ 4 scientific papers within one year" + **one conference paper**.
   - "Also working on a **patent** related to arc fault."
   - Five CHINT technology tracks: **1) metering technology, 2) MV circuit breakers, 3) emerging technologies in the energy sector, 4) EV technology, 5) CloudX here in PSAU.**
   - Two application directions: **"Data centre can be used by utilising the microgrid"** and **"arc fault for microgrid"**.
2. `Instructor Notes/Introduction of LV R&D_Nov_KFUPM.pdf` — CHINT LV Intelligent Electrical Research Institute deck (Nov 2025). Establishes CHINT context: WAA (West Asia & Africa) R&D department in **Riyadh, Saudi-focused**; documented **CHINT→SEC supply history** (GIS, RMU, ECB, MCCB, ACB, switchgear, transformers); **products customised for Saudi** (NXMG MCCB, NXMD/ECB, +55 °C, standards 37-SDMS-01/02/03); **AFDD line** (NB3LE-AFD, NB4LE-AFD in production since 2022 >20,000 pcs; NB2LE-80ZT intelligent AFDD in pre-research); **arc-fault detection technology** (multi-feature + machine-learning, >85–90 % lab recognition); smart meters, smart/intelligent MCCB, MV GIS NG7, PV grid-connect breakers, islanding protection, topology identification, NILM, EV sequence charging, **DC ACB for data centres**, **CloudX / EmpowerX** (EMS + Digital Twin + AIoT + Edge), and a test lab rated **350 MVA @ 50/60 Hz**.
3. `Instructor Notes/arc_pinn_manuscript_final.pdf` — a complete arc-fault manuscript draft (physics-informed neural network approach). **The PDF has no extractable text layer** (scanned / figure-only), so its detailed claims could not be machine-verified here; treat as *"full draft in preparation"* until submission proof is provided.

**Priority conflicts / gaps found (see Section C):**
- No NEOM document of any kind exists in the folder.
- No document containing the name "HUMAIN" exists in the folder (spelling could **not** be verified).
- No CHINT partnership agreement / letter of intent — only the CHINT R&D introduction deck.
- No SEC/Saudi Electricity meeting note, invitation, or pilot document naming the Future Energy Lab.
- No patent filing document.
- No "10 houses → 100 houses" pilot document.
- Only **one** of the ~4 claimed papers exists as a file (the arc-fault PINN draft).
- The two microgrid packages use **different load inventories** and **different sites** (Al-Kharj vs Riyadh) — they are two design iterations, not one documented scale-down chain.

---

## 1. Slide-by-slide plan

---

### SLIDE 1 — Future Energy Lab: A Smart LV Energy Innovation Platform

| Field | Content |
|---|---|
| **Core objective** | Frame the lab as one integrated platform, not four separate projects; introduce the four connected blocks. |
| **Main message (1 sentence)** | The Future Energy Lab is a single low-voltage platform where a microgrid generates and manages energy, arc-fault protection secures the LV system, a digital twin monitors and visualises it, and new CHINT / emerging technologies with local 60-Hz engineering make it deployable in Saudi Arabia. |
| **Slide content (≤5 bullets)** | • Four connected blocks: **MicroGrid (MG)** · **Arc-Fault Detection & Protection** · **Digital Twin (DT)** · **New CHINT Technologies & 60-Hz Localization**<br>• One physical LV testbed at PSAU, College of Engineering, Electrical Engineering Dept.<br>• Physical link: shared LV distribution board, metering breakers, ESP32/Modbus data layer<br>• Digital link: MG telemetry → DT dashboard → arc-fault / alarm events → engineering decision<br>• Purpose: research output, student training, and a validation path for Saudi 60-Hz deployment |
| **Recommended visual** | Single system block diagram (custom) showing the 4 blocks + the physical bus + the data bus. Use the real device names from `DataSetup/docs/02-hardware.md` (CHINT NB2LE breaker, ESP32-S3, RS485/Modbus RTU, Home Assistant, Node-RED) and `Digital Twin/docs/architecture.md` (MQTT → Cloudflare → browser). No stock imagery. |
| **Speaker notes (60–100 words)** | This platform is deliberately integrated. The microgrid is the energy source and the object under study. Arc-fault protection is applied to that same microgrid and its LV feeders. The digital twin is the common monitoring and visualisation layer that ties both together and logs events for engineering decisions. The fourth block — new CHINT and emerging technologies with local 60-Hz engineering — is what turns a lab result into something deployable in the Saudi grid. Everything shown today runs, is simulated, or is a defined build step; each slide labels which. |
| **Evidence source** | `MicroGrid/phase-a-microgrid-sizing/README.md`; `ArcFault/README.md`; `Digital Twin/README.md`, `Digital Twin/docs/architecture.md`; `DataSetup/README.md`, `DataSetup/docs/02-hardware.md`; `Instructor Notes/New مستند نصي.txt` |
| **Claim status** | Verified (each block exists as code / documents / dataset); "integrated platform" = **Proposed / Under Development** (the four blocks are not yet physically wired into one bus). |
| **Missing evidence** | A single as-built or planned single-line diagram of the physical Future Energy Lab showing all four blocks on one LV board. |

---

### SLIDE 2 — The Need and Strategic Direction

| Field | Content |
|---|---|
| **Core objective** | Establish why an LV innovation platform is needed now, in Saudi-specific terms. |
| **Main message** | Saudi LV systems need combined progress in electrical safety, renewable integration, energy visibility, and locally engineered 60-Hz equipment — and a scaled lab is the fastest, safest place to develop and validate it. |
| **Slide content (≤5 bullets)** | • **LV safety:** series arc faults sit below normal current — conventional MCB/RCD/overload devices do not detect them (CHINT arc-fault background)<br>• **Renewable integration:** PV + battery on a 60-Hz LV network needs grid-forming control, islanding logic, and protection coordination<br>• **Energy visibility:** per-circuit metering + digital twin turn a panel into analysable data (power, PF, energy, CO₂, alarms)<br>• **Localization:** imported LV/MV equipment must be verified for Saudi **nominal 60 Hz**, +55 °C ambient, dust, and local standards (e.g. 37-SDMS)<br>• **Emerging load direction:** data-centre energy resilience and EV charging are new LV/MV stresses the lab can model before field rollout |
| **Recommended visual** | Two-column "need → lab response" table. Left: the five needs. Right: which block addresses it. Optional small inset = CHINT "Causes of fire" / arc-fault research-background figure (from `Instructor Notes/Introduction of LV R&D_Nov_KFUPM.pdf`, Arc Fault Detection slide). |
| **Speaker notes** | These four needs are usually pursued in isolation. The strategic point of the Future Energy Lab is that they share infrastructure: the same LV board, the same metering breakers, the same data layer. A series arc fault draws less than rated current, so today's protection misses it — that is a documented safety gap. Renewable integration on a 60-Hz network is a control and protection problem, not just a sizing problem. And every piece of imported equipment needs explicit 60-Hz and high-temperature verification before it can be trusted on the Saudi grid. |
| **Evidence source** | `Instructor Notes/Introduction of LV R&D_Nov_KFUPM.pdf` (Arc Fault Detection technology; NXMG/NXMD +55 °C, 37-SDMS); `MicroGrid/phase-a-microgrid-sizing/results/sizing_summary.md`, `.../engineering_questions.md`; `ArcFault/README.md`; `Instructor Notes/New مستند نصي.txt` (data centre + CloudX + EV) |
| **Claim status** | Verified (needs are documented); data-centre / EV framing = **Proposed direction** (from Instructor Notes and CHINT deck, no lab data yet). |
| **Missing evidence** | A short reference list of the Saudi LV/MV standards the lab will design to (SASO / SEC distribution code / 37-SDMS series). |

---

### SLIDE 3 — Integrated Future Energy Lab Architecture

| Field | Content |
|---|---|
| **Core objective** | Show, concretely, how the four blocks connect physically and digitally. |
| **Main message** | The blocks share one LV bus and one data pipeline: MicroGrid feeds the board, metering breakers measure every branch, the data layer streams to the digital twin, and arc-fault + protection events are logged and acted on. |
| **Slide content (≤5 bullets)** | • **Physical layer:** PV + battery + grid-forming inverter → LV distribution board → branch circuits (metering breakers per branch)<br>• **Protection layer:** arc-fault detection on selected branches (feeder / battery branch / inverter output / PV side / critical loads) — coordination TBD<br>• **Data layer:** CHINT NB2LE metering breaker → RS485/Modbus RTU → ESP32-S3 → Home Assistant / Node-RED → MQTT (HiveMQ + EMQX) → cloud dashboard<br>• **Digital twin layer:** live KPIs, 3D panel model, SCADA (ISA-101) alarms, historical analytics, physics simulation<br>• **Decision loop:** MG data → DT → arc-fault / alarm event → engineering action (trip, shed, investigate) |
| **Recommended visual** | One layered architecture diagram (custom). Reuse the structure of the Mermaid diagrams in `Digital Twin/docs/architecture.md` and the ASCII architecture in `DataSetup/README.md`, but redraw in a clean engineering style. Label every arrow with its protocol. |
| **Speaker notes** | This is the backbone slide. On the physical side, everything hangs off one LV board so protection and metering see the same currents. On the data side, we already have a working pipeline from a CHINT smart breaker through an ESP32 and Modbus to a cloud dashboard — that is the DataSetup rig, proven over several months of continuous logging. The digital twin consumes that same telemetry. The design intent is that an arc-fault or protection event is not just a trip; it is a logged, visualised event that drives an engineering decision. |
| **Evidence source** | `Digital Twin/docs/architecture.md`, `Digital Twin/README.md`; `DataSetup/README.md`, `DataSetup/docs/01-system-architecture.md`, `DataSetup/docs/02-hardware.md`, `DataSetup/docs/08-results.md`; `MicroGrid/phase-a-microgrid-sizing/sizing/component_ratings.md`; `ArcFault/README.md` |
| **Claim status** | **Verified** for the data layer and digital-twin layer (running). **Under Development** for the unified physical bus and for arc-fault integration into the same board. |
| **Missing evidence** | Integrated single-line diagram + protection-coordination study for the combined MG + arc-fault board. |

---

### SLIDE 4 — MicroGrid: Design, Simulation, and Scale-Down Sizing

| Field | Content |
|---|---|
| **Core objective** | Present the microgrid engineering: first design → scale-down → simulated results, with the NEOM reference stated honestly. |
| **Main message** | A residential LV microgrid was first sized at full scale, then reduced to a lab-scale islanded design that is verified by a runnable 24-hour energy/power-balance simulation across four operating scenarios. |
| **Slide content (≤5 bullets)** | • **First design (full residential):** 17 loads, **27.1 kWh/day**, peak ≈ 8.5 kW → sized ≈ **63 kWh battery, 9.2 kWp PV, 11 kW hybrid inverter**; benchmarked against existing lab hardware (SonnenBatterie eco 8.0)<br>• **Scale-down (Phase A, lab):** 6-load subset, **12.85 kWh/day**, single-phase **230 V / 60 Hz**, islanded 24 h → **4.4 kWp PV · 10 kWh LiFePO₄ (51.2 V) · 5 kW / 5.5 kVA grid-forming inverter**<br>• **Simulation:** Python pipeline (`sizing.py` → `sim.py`), 4 scenarios (base / low-PV / high-load / low-PV+high-load) — **critical load served 100 % in all four**; design is energy-bound, not power-bound<br>• **60-Hz compatibility:** inverter output fixed at 60 Hz ± 0.5 Hz (island), 230 V L-N / 400 V L-L, THD < 5 % — per assumptions file<br>• **NEOM:** no NEOM document is in the project; NEOM-related **public** references are *proposed* as a benchmarking source for the initial design stage |
| **Recommended visual** | Left: sizing summary table (`MicroGrid/phase-a-microgrid-sizing/results/final_sizing.md`). Right: 2–3 simulation figures — `simulation/figs/base/02_pv_batt_vs_load.png`, `.../04_soc.png`, `.../07_energy_flows.png`. Optional strip: the four `figs/<scenario>/04_soc.png` side by side. |
| **Speaker notes** | The microgrid work has two layers. First, a full residential sizing — 27 kWh a day, about 63 kWh of storage — which also honestly assessed the battery we already own and showed it is ~25× too small for full-load islanding but useful for control development. Second, a lab-scale islanded design that we can actually build: 4.4 kWp, 10 kWh, a 5 kW grid-forming inverter, single-phase at 60 Hz. That design is not just a spreadsheet — it is a runnable simulation, and across four stress scenarios the critical loads stay supplied 100 % of the time. On NEOM: we have no NEOM documents. We propose using NEOM's publicly available project references only as a benchmarking input at the concept stage. |
| **Evidence source** | `MicroGrid/Microgrid_Load_Analysis_and_Sizing.md`; `MicroGrid/phase-a-microgrid-sizing/` — `README.md`, `results/final_sizing.md`, `results/sizing_summary.md`, `results/scenario_comparison.md`, `data/phase_a_loads.csv`, `simulation/sim.py`, `simulation/sizing.py`, `simulation/sim_output.json`, `simulation/figs/*`, `assumptions/*.md`, `sizing/*.md` |
| **Claim status** | **Verified** (simulation results, sizing calculations, 60-Hz assumption all in-repo). NEOM benchmarking = **Proposed**. "Scale-down of the first design" = **To be validated** — the two packages use different load lists and sites (see conflict note). |
| **Missing evidence** | (a) A NEOM public-reference citation list if NEOM is to be mentioned at all. (b) A documented mapping showing Phase A is a deliberate reduction of the 17-load design. (c) Metered load data to replace calculated `measured_wh`. (d) Dynamic stability / island fault-current study (explicitly out of scope today — see `results/engineering_questions.md`). (e) Site confirmation: Al-Kharj (PSAU) vs the "Riyadh" label in the Phase A README. |

---

### SLIDE 5 — MicroGrid Applications: Lab Validation and Data-Centre Energy Resilience

| Field | Content |
|---|---|
| **Core objective** | Connect the microgrid to a strategic application — data-centre energy resilience — while strictly separating concept, simulation, lab validation, and deployment. |
| **Main message** | The same microgrid model can be used to study data-centre energy resilience — continuity, renewable integration, peak-load management, and backup-power coordination — with the Future Energy Lab providing a scaled environment to validate energy-management scenarios before any wider implementation. |
| **Slide content (≤5 bullets)** | • Instructor direction: **"the data centre can be used by utilising the microgrid"**<br>• Microgrid as a candidate solution for data-centre: **energy resilience, supply continuity, renewable integration, peak-load management, backup-power coordination**<br>• CHINT already positions **DC ACB / DC switchgear for data centres** and **EMS with predictive maintenance** (CHINT LV R&D deck) — a localization opportunity<br>• Four clearly separated stages: **concept → simulation → lab validation → real deployment** — the lab covers the first three<br>• Data-centre direction being explored (the specific operator name referenced verbally could **not** be verified in any project document — see note) |
| **Recommended visual** | A 4-stage maturity arrow (Concept → Simulation → Lab validation → Deployment) with the current position marked at "Simulation / Lab validation". Inset: CHINT "DC ACB — used in data centers, 5G, DC main distribution" product slide and the CHINT EMS dashboard slide from `Instructor Notes/Introduction of LV R&D_Nov_KFUPM.pdf`. |
| **Speaker notes** | Data centres are becoming a major LV/MV load with strict continuity requirements. The instructor's direction is to explore the microgrid as an energy-resilience solution for that case: renewable integration, peak shaving, and coordinated backup. The Future Energy Lab's value is that it is a scaled, instrumented environment where energy-management scenarios can be simulated and then validated on real hardware before anyone commits to a field system. To be precise about scope: we have a concept and a simulation capability; we do not have a data-centre partnership, a deployment, or an approval, and no data-centre operator is named in our project documents. |
| **Evidence source** | `Instructor Notes/New مستند نصي.txt` ("Data centre can be used by utilising the microgrid"); `Instructor Notes/Introduction of LV R&D_Nov_KFUPM.pdf` (DC ACB for data centres; EMS; islanding protection with data-centre load shown); `MicroGrid/phase-a-microgrid-sizing/simulation/` (scenario engine) |
| **Claim status** | **Proposed / concept** for the data-centre application. **Verified** that a scenario-capable simulation exists. **Not evidenced:** any named data-centre partner, HUMAIN or otherwise. |
| **Missing evidence** | Any document naming a data-centre stakeholder; a data-centre load profile / resilience requirement; verification of the operator name (spelling "HUMAIN" not found in the folder). |

---

### SLIDE 6 — Arc-Fault Protection for the MicroGrid

| Field | Content |
|---|---|
| **Core objective** | Present arc-fault detection as protection for the microgrid and LV feeders, plus the planned controlled lab experiment — with explicit safety framing. |
| **Main message** | Arc-fault detection research (dataset + algorithms) is being extended into a controlled Future Energy Lab experiment to investigate detection signatures, alarm behaviour, event logging, protective action, and integration with the microgrid digital twin. |
| **Slide content (≤5 bullets)** | • **Where it applies:** microgrid feeders, LV distribution board, battery branch, inverter-output branch, PV-side circuits, and selected critical loads — subject to final protection coordination and LV lab safety design<br>• **Evidence base:** curated CHINT AFCI dataset — **258 labelled trials**, 10+ residential load types, 4 AFDD models (A–D), series + parallel arcs, 6.4 kHz current; analysis notebook with di/dt, moving RMS, FFT, spectrogram, zero-crossing "shoulders"; ResNet-1D classifier (**≈ 90 %+ under lab conditions**)<br>• **Methods paper:** physics-informed neural-network manuscript in preparation (`arc_pinn_manuscript_final.pdf`); a second comparison paper in progress<br>• **Planned experiment:** a controlled arc-fault test rig in the Future Energy Lab — detection signatures, alarm, event logging, protective action, digital-twin integration<br>• **Safety:** controlled test rig only, safety enclosure, supervision, PPE, approved procedures, full LV-lab safety compliance — this is *detection research*, not a production-ready protection product |
| **Recommended visual** | Left: labelled arc vs normal current waveform + FFT pair from `ArcFault/Data Description.pdf` (Feature Engineer / Zero-Crossing "shoulders" / FFT results pages). Right: a diagram of the microgrid board with candidate arc-fault monitoring points marked. Small inset: CHINT AFDD products (NB3LE-AFD / NB4LE-AFD / NB2LE-80ZT) from the CHINT deck. |
| **Speaker notes** | Series arc faults are dangerous precisely because they draw less than rated current and slip past conventional protection. Our starting point is a real, labelled dataset across many load types and four AFDD devices, with a classifier reaching about 90 % in the lab, and a physics-informed modelling paper in preparation. The next step is a controlled experiment in the Future Energy Lab, applied to the microgrid feeders and branches, with every event logged into the digital twin. This must be done on a purpose-built test rig with an enclosure, supervision, PPE and approved procedures. We are researching detection; we are not claiming a certified protection device. |
| **Evidence source** | `ArcFault/README.md`, `ArcFault/Data Description.pdf`, `ArcFault/Arc_Fault_Data_Study.ipynb`, `ArcFault/Chint_Data_label.xlsx`; `Instructor Notes/arc_pinn_manuscript_final.pdf`; `Instructor Notes/New مستند نصي.txt`; `Instructor Notes/Introduction of LV R&D_Nov_KFUPM.pdf` (Arc Fault Detection technology; AFDD R&D achievements) |
| **Claim status** | **Verified:** dataset, analysis notebook, ~90 % lab classifier result. **In preparation:** the PINN manuscript (no submission proof; PDF not text-readable). **Planned / Proposed:** the lab experiment and its integration with the microgrid. |
| **Missing evidence** | Arc-fault test-rig design + written safety procedure; a waveform or photo from *our own* rig (current dataset is CHINT's, recorded at **50 Hz / 230 V** — 60-Hz behaviour to be re-checked); protection-coordination study; submission/acceptance proof for the arc papers. |

---

### SLIDE 7 — Digital Twin Demonstration: LAMPS_PANEL

| Field | Content |
|---|---|
| **Core objective** | Show one concrete physical-to-digital demonstration case and the stakeholder-demonstration plan. |
| **Main message** | A running digital twin of a 40-lamp LV lighting distribution panel (LAMPS_PANEL) mirrors a physical CHINT NB2 smart breaker in real time — status, metering, alarms, history, remote control, and 3D visualisation — as a practical LV showcase for stakeholders. |
| **Slide content (≤5 bullets)** | • **Physical device:** LAMPS_PANEL — 40 × Philips 11 W LED lamps (8 × 5), one **CHINT NB2 smart breaker** with built-in V/I/P/PF metering; measured **402 W, 229.7 V, 2.93 A, PF 0.60**<br>• **Digital-twin functions:** live ON/OFF status · voltage & current · power & energy · breaker/contactor state · fault/alarm status (SCADA ISA-101) · communication status · historical event logging · remote monitoring UI · optional 3D model of the panel<br>• **Architecture:** breaker → MQTT (HiveMQ primary, EMQX failover, WSS) → Cloudflare Pages Functions → browser; remote Open/Close/Unlock via Home Assistant API<br>• **Analytics & simulation:** energy, efficiency, cost, CO₂; thermal model (Tⱼ = T_amb + P·R_th) and TM-21 lumen-maintenance projection<br>• **Stakeholder plan:** a LAMPS_PANEL digital-twin demonstration is *planned* as an LV showcase for relevant stakeholders, including Saudi Electricity / SEC representatives **where engagement or demonstration interest is documented** |
| **Recommended visual** | Screenshot of the running digital-twin UI (Tab 1 KPIs + trend charts; Tab 2 3D model). If a live screenshot is not yet exported, render `Digital Twin/index.html` locally, or show the architecture Mermaid diagram from `Digital Twin/docs/architecture.md` plus the `Panel.glb` 3D model. Add a small "physical panel ↔ digital twin" split image. |
| **Speaker notes** | This is the most tangible part of the platform. The physical object is a 40-lamp lighting panel behind a CHINT NB2 smart breaker. The breaker's own metering is published over MQTT with broker failover, through a serverless edge layer, to a browser dashboard — no credentials in the client. The twin shows live power, voltage, current, power factor and energy, raises SCADA-style alarms, logs history, allows remote open/close, and renders a 3D model of the panel. It also runs a thermal and lumen-decay simulation. The plan is to use this as a demonstration for stakeholders. On SEC specifically: we will present it to SEC representatives only to the extent that engagement is actually documented — today it is a planned demonstration for relevant stakeholders. |
| **Evidence source** | `Digital Twin/README.md`, `Digital Twin/docs/architecture.md`, `Digital Twin/docs/deployment.md`, `Digital Twin/index.html`, `Digital Twin/script.js`, `Digital Twin/Panel.glb`, `Digital Twin/history.json`, `Digital Twin/real_analytics.json`, `Digital Twin/functions/api/*.js`; `DataSetup/docs/02-hardware.md` (CHINT NB2LE breaker) |
| **Claim status** | **Verified:** the digital twin exists and runs on live telemetry; all listed functions are implemented. **Planned:** the stakeholder demonstration. **Not evidenced:** any SEC / Saudi Electricity attention, feedback, meeting, invitation, or scheduled demo — use *"planned demonstration for relevant stakeholders"*. |
| **Missing evidence** | Exported dashboard screenshots for the deck; any documented SEC engagement (email, meeting note, invitation); confirmation that "LAMPS_PANEL" is the exact device tag to use (README calls it the "40-lamp NB2 lighting distribution panel"). |

---

### SLIDE 8 — New CHINT Technologies, CloudX at PSAU, and 60-Hz Localization

| Field | Content |
|---|---|
| **Core objective** | Present the CHINT / emerging-technology block and make localization concrete for Saudi 60-Hz systems. |
| **Main message** | Six technology tracks — smart metering, MV circuit breakers, emerging energy technologies, EV technologies, CloudX at PSAU, and 60-Hz localization — each move from an existing CHINT capability to a defined lab activity: integrate, verify at 60 Hz, test, and build local engineering capacity. |
| **Slide content (≤5 bullets)** | • **Smart metering:** CHINT NB2/NM3 metering breakers (0.5S class, RS485/HPLC/BLE, topology ID, NILM) — *lab use:* per-branch metering for MG + DT; *verify:* 60-Hz metering accuracy, DL/T vs local protocol<br>• **MV circuit breakers:** CHINT NG7 GIS, intelligent MCCB/ACB (already supplied to SEC) — *lab use:* protection-coordination reference; *verify:* 60-Hz ratings, +55 °C, 37-SDMS<br>• **Emerging energy tech:** PV rapid-shutdown, power optimisers, DC ACB/MCCB for data centres, islanding protection, LV-DC — *lab use:* MG + data-centre studies<br>• **EV technology:** sequence / orderly charging for substation peak management — *lab use:* peak-load scenario in the MG simulation and testbed<br>• **CloudX / EmpowerX at PSAU:** CHINT's EMS + Digital Twin + AIoT + Edge framework — *status per folder:* **conceptual / proposed** cloud-connected energy-monitoring platform at PSAU (no operational CloudX evidence in the project) |
| **Localization language (put on slide)** | *"Localization is not limited to purchasing equipment. It includes local engineering integration, 60-Hz verification, commissioning, panel assembly, firmware/software configuration, testing, calibration, maintenance, technical training, documentation, and future manufacturing opportunities. Every selected technology must be evaluated for compatibility with Saudi nominal 60-Hz systems, local protection settings, installation requirements, environmental conditions, and lifecycle maintenance."* |
| **60-Hz checklist (slide inset)** | inverter frequency setpoint · meter frequency range/accuracy · protection-relay settings · MV breaker ratings · transformer rating · motor compatibility · control firmware · SEC grid-code · Saudi LV/MV standards. *Do not assume imported equipment is 60-Hz-compatible by default.* |
| **Recommended visual** | 6-row table: **Technology · Existing CHINT capability · Proposed lab use · 60-Hz / local verification · Local engineering opportunity.** Source rows from `Instructor Notes/Introduction of LV R&D_Nov_KFUPM.pdf`. Small inset: CHINT EmpowerX layer diagram (EMS / Digital Twin / Edge / IoT). |
| **Speaker notes** | The instructor defined five tracks — metering, MV breakers, emerging energy technologies, EV, and CloudX at PSAU — plus the cross-cutting requirement of 60-Hz localization. For each, CHINT already has a product or platform; the lab's job is to integrate it, verify it at 60 Hz and +55 °C against local standards, and in doing so build local engineering capability — assembly, firmware, calibration, maintenance, training, and eventually manufacturing. On CloudX at PSAU: our project documents describe CHINT's CloudX/EmpowerX framework but contain no evidence of an operational instance at PSAU, so we present it today as a proposed cloud-connected monitoring platform, i.e. a conceptual architecture. |
| **Evidence source** | `Instructor Notes/New مستند نصي.txt` (the five tracks); `Instructor Notes/Introduction of LV R&D_Nov_KFUPM.pdf` (smart meters; NG7 GIS; intelligent MCCB/ACB; NXMG/NXMD +55 °C / 37-SDMS; PV rapid shutdown & optimiser; DC ACB/MCCB; EV sequence charging; EMS; EmpowerX/CloudX; topology ID; NILM; islanding); `Digital Twin/` (a working DT instance); `DataSetup/` (metering + Modbus integration) |
| **Claim status** | **Verified:** CHINT product capabilities (vendor deck) and CHINT→SEC supply history. **Proposed / conceptual:** CloudX at PSAU; all "lab use" items. **To be validated:** every 60-Hz compatibility item. |
| **Missing evidence** | A CHINT product catalogue / datasheets for the specific models to be used; any CloudX-at-PSAU document (spec, account, deployment); a written 60-Hz + environmental verification test plan per technology; CHINT partnership evidence (see Slide 10). |

---

### SLIDE 9 — Implementation Roadmap, Validation, and KPIs

| Field | Content |
|---|---|
| **Core objective** | Give a credible build-and-validate roadmap with measurable checkpoints. |
| **Main message** | The lab moves from simulation to hardware in defined stages, each with a technical acceptance test: microgrid build, arc-fault rig, digital-twin synchronisation, and — if and when supported — a residential pilot. |
| **Slide content (≤5 bullets)** | • **Stage 1 — MicroGrid build:** procure 4.4 kWp PV / 10 kWh LiFePO₄ / 5 kW grid-forming inverter; commission single-phase 230 V / 60 Hz islanded board. *KPI:* 24-h islanded run, critical load 100 % served, SOC ≥ 10 %, THD < 5 %<br>• **Stage 2 — Instrumentation & DT sync:** per-branch CHINT metering breakers → live digital twin. *KPI:* telemetry latency ≤ 1 s, DT vs meter error < 1 %, alarm round-trip logged<br>• **Stage 3 — Arc-fault experiment:** controlled test rig on MG branches. *KPI:* detection rate, false-trip rate, trip time, event logged to DT, safety procedure signed off<br>• **Stage 4 — 60-Hz localization tests:** meter accuracy, relay settings, inverter/motor behaviour at 60 Hz, +55 °C. *KPI:* pass/fail per checklist item<br>• **Stage 5 — Residential pilot (proposed):** a "10 houses → 100 houses" smart-house / community energy pilot direction — *currently a proposal; not evidenced in the project folder* |
| **Recommended visual** | Horizontal timeline / Gantt with the 5 stages and their KPI checkpoints; a "Simulation → Hardware" transition marker between Stage 1 design (done) and Stage 1 build (next). Use the scenario-pass table from `results/scenario_comparison.md` as a "simulation baseline" callout. |
| **Speaker notes** | The roadmap is deliberately staged so each step has an acceptance test rather than a vague milestone. Stage 1 is building the microgrid we have already sized and simulated. Stage 2 wires it into the digital twin we already run, with a metering-accuracy KPI. Stage 3 is the controlled arc-fault experiment, gated by a signed safety procedure. Stage 4 is the 60-Hz and high-temperature verification work. Stage 5, the 10-to-100-house pilot, is on this slide as a proposed direction only — there is no pilot document in our files yet, and we will label it that way. |
| **Evidence source** | `MicroGrid/phase-a-microgrid-sizing/results/final_sizing.md`, `.../results/scenario_comparison.md`, `.../results/engineering_questions.md`, `.../sizing/component_ratings.md`; `DataSetup/docs/08-results.md` (1 s polling, 0.5–1.0 s latency, 100 % automation); `Digital Twin/docs/architecture.md`; `ArcFault/README.md` |
| **Claim status** | **Verified:** Stage-1 design, Stage-2 data-layer performance (measured), simulation baseline. **Planned:** Stages 1-build, 3, 4. **Proposed / not evidenced:** Stage 5 pilot and the 10→100-house numbers. |
| **Missing evidence** | Procurement list + budget + schedule with dates; lab safety sign-off process; a pilot concept document (scope, host houses, SEC involvement) if Stage 5 is to be shown as more than a proposal. |

---

### SLIDE 10 — Future Energy Lab: Achievements and Strategic Impact

| Field | Content |
|---|---|
| **Core objective** | Close with achievements at their **evidence-supported** status and the forward value. |
| **Main message** | The Future Energy Lab has already produced a running digital twin, a proven data-acquisition rig, a simulated microgrid design, and an arc-fault dataset and models — with a research, industry-collaboration, and localization pathway ahead. |
| **Slide content — status by evidence (≤5 bullets)** | • **Research output:** 1 arc-fault manuscript **in preparation** (`arc_pinn_manuscript_final.pdf`); a 2nd arc comparison paper in progress; per Instructor Notes, 2 further papers submitted with **1 reported accepted** (electricity-theft LSTM-CUSUM) and a distribution-topology paper — *file evidence in folder: 1 of ~4; "≈4 papers within one year" is a target*<br>• **Conference paper:** planned / in preparation (Instructor Notes) — no file<br>• **CHINT:** technical engagement via the CHINT LV R&D programme and CHINT AFCI dataset + CHINT NB2 hardware in use — *"partnership" not evidenced by an agreement or letter in the folder → state as "collaboration / engagement in progress"*<br>• **Saudi Electricity / SEC:** CHINT has a documented SEC supply history; **no SEC engagement with the Future Energy Lab is evidenced** → **pilot direction proposed** ("start with 10 houses, scale toward 100"), not initiated<br>• **Arc-fault IP:** **patent concept / application in preparation** (Instructor Notes) — no filing document in the folder |
| **Strategic impact (slide, right column)** | research output · industry collaboration · student training · local technology capability (60-Hz engineering, assembly, calibration, maintenance) · LV safety innovation · smart-house / community energy pilot scalability · future deployment pathway for PSAU, the LV Department, and Saudi 60-Hz systems |
| **Recommended visual** | A KPI / status table: **Achievement · Claimed status · Evidence in folder · Corrected status for this deck.** Keep it monochrome and factual. Optional right column: a simple "impact wheel" of the seven impact areas. |
| **Speaker notes** | We want to be precise here because the audience includes potential partners. What definitely exists: a running digital twin on live telemetry, a data-acquisition rig proven over months, a fully simulated lab-scale microgrid, and an arc-fault dataset with a ~90 % classifier and a manuscript in preparation. What is a target or a direction: four papers in a year, a conference paper, a formal CHINT partnership, SEC involvement, a 10-to-100-house pilot, and an arc-fault patent — these are goals with partial or verbal support, and we label them as such. The strategic impact is a repeatable pipeline: research, trained students, local 60-Hz engineering capability, and a validated path to deployment. |
| **Evidence source** | `Instructor Notes/New مستند نصي.txt`; `Instructor Notes/arc_pinn_manuscript_final.pdf`; `Instructor Notes/Introduction of LV R&D_Nov_KFUPM.pdf`; `ArcFault/*`; `Digital Twin/*`; `DataSetup/*`; `MicroGrid/*` |
| **Claim status** | **Verified:** digital twin, DAQ rig, microgrid simulation, arc-fault dataset/model, 1 manuscript file. **Target / Proposed / In preparation:** 4-paper count, conference paper, CHINT "partnership", SEC pilot, 10→100 houses, patent filing. |
| **Missing evidence** | Publication/acceptance letters; CHINT partnership agreement or MoU; SEC meeting note / pilot document; patent application receipt; a one-page pilot concept. |

---

## A. Evidence Inventory

| Topic | File(s) | Evidence type | Strength | Slide(s) |
|---|---|---|---|---|
| First microgrid design (full residential) | `MicroGrid/Microgrid_Load_Analysis_and_Sizing.md` | Engineering calc report (17 loads, 27.1 kWh/d, 63 kWh / 9.2 kWp / 11 kW) + Sonnen eco 8.0 assessment | Strong (calculations, traceable) | 4 |
| Scale-down microgrid sizing | `MicroGrid/phase-a-microgrid-sizing/README.md`, `results/final_sizing.md`, `results/sizing_summary.md`, `data/phase_a_loads.csv`, `assumptions/*.md`, `sizing/*.md` | Traceable sizing package, 60-Hz, single-phase islanded | Strong | 4, 9 |
| Microgrid simulation output | `.../simulation/sim.py`, `sizing.py`, `sim_output.json`, `sizing_output.json`, `results/scenario_comparison.md`, `simulation/figs/{base,low_pv,high_load,low_pv_high_load}/01..07_*.png` | Runnable Python energy/power-balance sim; 4 scenarios, 7 figures each; all "critical 100 % served" | Strong (for energy balance); **not** dynamic stability | 4, 9 |
| PV / battery / inverter / load / cable sizing | `.../sizing/pv_sizing.md`, `battery_sizing.md`, `inverter_sizing.md`, `load_sizing.md`, `ac_cable_sizing.md`, `dc_cable_sizing.md`, `component_ratings.md` | Component sizing with equations + protection list | Strong | 4, 9 |
| Open engineering questions (scope limits) | `.../results/engineering_questions.md` | Explicit list of what is NOT claimed (dynamic stability, fault current, metering) | Strong (honest scoping) | 4, 6, 9 |
| Existing lab battery hardware | `MicroGrid/Microgrid_Load_Analysis_and_Sizing.md` §7 | SonnenBatterie eco 8.0 + StecaGrid 3213 assessment (2.5 kWh, 3.3 kW, grid-following) | Strong | 4 |
| Arc-fault dataset (CHINT AFCI) | `ArcFault/README.md`, `ArcFault/Chint_Data_label.xlsx`, `ArcFault/Data Description.pdf` | 258 labelled trials, 10+ loads, 4 AFDD models, series+parallel, 6.4 kHz current, **50 Hz / 230 V** | Strong (dataset); note 50 Hz | 2, 6 |
| Arc-fault analysis + model | `ArcFault/Arc_Fault_Data_Study.ipynb` | Notebook: di/dt, RMS, FFT, spectrogram, zero-crossing "shoulders", ResNet-1D, ~90 %+ lab | Medium–strong (lab only, reproducibility noted as to-improve) | 6 |
| Arc-fault methods paper | `Instructor Notes/arc_pinn_manuscript_final.pdf` | Full manuscript draft (PINN); **no extractable text — not machine-verified** | Weak-as-evidence (exists as a file; content unverifiable here) | 6, 10 |
| Digital twin (LAMPS_PANEL) | `Digital Twin/README.md`, `docs/architecture.md`, `docs/deployment.md`, `index.html`, `script.js`, `style.css`, `Panel.glb`, `history.json`, `real_analytics.json`, `functions/api/{control,data,history,mqtt-config,real_analytics}.js`, `soak_test.js` | Full running cloud app: MQTT/WSS, Cloudflare, HA control, 3D, SCADA alarms, analytics, thermal sim; measured 402 W / 229.7 V / 2.93 A / PF 0.60 | Strong | 1, 3, 7 |
| Data-acquisition rig | `DataSetup/README.md`, `docs/01..08`, `firmware/esphome/daq-node.yaml`, `hardware/daq-node-bom.md`, `hardware/wiring-notes.md`, `software/extractor/ha_history_extractor.py`, `software/plotting/plot_power_profile.py`, `data/appliances.csv` | 21-appliance rig, ESP32-S3 + CHINT NB2LE + Modbus RTU + HA + Node-RED; months continuous, 100 % automation, 0.5–1.0 s latency | Strong | 1, 3, 9 |
| CHINT LV R&D context | `Instructor Notes/Introduction of LV R&D_Nov_KFUPM.pdf` | Vendor deck: WAA R&D Riyadh; CHINT→SEC supply history; NXMG/NXMD Saudi-customised (+55 °C, 37-SDMS); AFDD line; smart meters; NG7 GIS; PV/DC breakers; EV sequence charging; EMS / EmpowerX / CloudX; DC ACB for data centres; islanding; topology ID; NILM | Strong for CHINT capability; **vendor-authored** (not an agreement) | 2, 5, 6, 8, 10 |
| Instructor direction | `Instructor Notes/New مستند نصي.txt` | WhatsApp export: papers, patent, 5 CHINT tracks, data-centre + arc-fault-for-microgrid directions | Authoritative for **direction**; not proof of outcomes | all |
| Academic attribution | `Digital Twin/README.md`, `DataSetup/LICENSE`/`CITATION.cff` | Supervisor Dr. Malek Alduhaimi; developer Jehad Majed; PSAU College of Engineering, EE Dept | Strong | 1, 10 |

---

## B. Claims Requiring Verification (cannot be proven from the folder)

1. **NEOM involvement of any kind** — no NEOM document exists. Any NEOM mention must be limited to *"NEOM-related public references are proposed as a benchmarking source for the initial design stage."*
2. **"HUMAIN" data-centre partner** — the name does not appear in any file; spelling unverified. Present the data-centre application as a concept from the Instructor Notes only, with no named partner.
3. **Formal CHINT partnership** — only a CHINT vendor deck and a CHINT dataset exist. No agreement, MoU, or letter. Use "collaboration / engagement in progress."
4. **Saudi Electricity / SEC engagement with the Future Energy Lab** — none evidenced. CHINT's SEC supply history is CHINT's, not the lab's. Use "planned demonstration for relevant stakeholders."
5. **"4 journal papers within one year"** — 1 file present (arc PINN draft, unverifiable text). The theft-detection paper is *reported* accepted (Instructor Notes) but no file. Topology/trench paper: no file. Treat the count as a target.
6. **Conference paper** — claimed in Instructor Notes; no file.
7. **Arc-fault patent** — "working on a patent" (Instructor Notes); no filing document. Use "patent concept / application in preparation." Never "filed" or "granted."
8. **10-house → 100-house pilot** — not in any file, including Instructor Notes. Label "proposed direction, not initiated."
9. **Arc-fault experiment results** — none exist yet; the experiment is planned. The ~90 % figure is from the CHINT dataset / notebook under lab conditions, not from a Future Energy Lab rig.
10. **"Phase A is the scale-down of the 17-load design"** — the two microgrid packages use different load inventories, different sites (Al-Kharj vs Riyadh), and different values (e.g. Water Cooler 110 W vs 600 W; AC present only in Phase A). Present them as two design iterations unless a mapping document is added.
11. **60-Hz compatibility of any specific imported device** — assumed in the sizing files, not tested. All 60-Hz claims are "to be validated."
12. **CloudX operational at PSAU** — only CHINT's generic CloudX/EmpowerX framework is documented. Label "conceptual architecture / proposed."
13. **Digital-twin device tag "LAMPS_PANEL"** — the README calls it the "40-lamp NB2 lighting distribution panel"; confirm the exact tag before printing it.

---

## C. Missing Files Needed (highest value first)

| # | Missing file | Why it matters | Slide |
|---|---|---|---|
| 1 | **NEOM public-reference citation list** (or a decision to drop NEOM) | Currently NEOM cannot be mentioned as more than a proposed benchmark | 4 |
| 2 | **Integrated single-line diagram** of the physical Future Energy Lab (MG + arc-fault + metering on one LV board) | The "one integrated platform" message has no as-planned drawing | 1, 3 |
| 3 | **Microgrid dynamic / island study** (inverter fault-current, ROCOF, motor-start sag, protection coordination) | Explicitly out of scope in current files; needed before build | 4, 6, 9 |
| 4 | **Metered load data** for the microgrid (replace calculated `measured_wh`, real time-of-day profile) | Sizing currently rests on assumed schedules | 4 |
| 5 | **Arc-fault test-rig design + written LV safety procedure** | Required before any experiment; also a slide-6 visual | 6, 9 |
| 6 | **Arc-fault waveform / photo from the lab's own rig at 60 Hz** | All current arc data is CHINT's at 50 Hz | 6 |
| 7 | **LAMPS_PANEL digital-twin screenshots** (Tab 1 KPIs, Tab 2 3D, alarm log) | Slide 7 needs real screenshots, not just architecture | 7 |
| 8 | **CHINT product catalogue / datasheets** for the specific meters, breakers, AFDDs, EMS to be used | Slide 8 table and 60-Hz checklist need model numbers | 8 |
| 9 | **CHINT partnership evidence** (MoU / letter / scope of collaboration) | Slide 10 currently must soften "partnership" | 10 |
| 10 | **SEC / Saudi Electricity meeting note or pilot document** | Needed to state any SEC engagement or the 10→100-house pilot | 7, 9, 10 |
| 11 | **Patent application receipt / filing document** | Needed to move beyond "concept / in preparation" | 6, 10 |
| 12 | **Publication / acceptance letters** for the 3 non-arc papers | Needed to state "accepted" / "submitted" precisely | 10 |
| 13 | **60-Hz + environmental verification test plan** (per technology) | Turns "localization" from a slogan into a method | 8, 9 |
| 14 | **Phase A ↔ full-design mapping note** | Resolves the load-inventory / site conflict | 4 |
| 15 | **CloudX-at-PSAU spec** (if it is to be shown as more than conceptual) | Slide 8 | 8 |

---

## D. Final Design Guidance

**Visual style**
- Standard professional engineering deck. White or very light background, one accent bar per slide, sans-serif (e.g. Inter / Arial / Calibri). No gradients, no 3D bevels, no stock "innovation" photography, no AI-generated imagery. Every figure must be a real project artefact (simulation plot, dashboard screenshot, waveform, single-line diagram, KPI table) or a clean custom line diagram.
- One idea per slide; ≤ 5 bullets; ≤ ~12 words per bullet. Put numbers in tables, not prose.
- Consistent footer: slide number + "Future Energy Lab · PSAU College of Engineering" + a small status tag (Verified / Proposed / Under development).

**Suggested colour code (use consistently for the four blocks)**
- **Dark blue** `#1F3A5F` — LV electrical systems / general platform / metering & data
- **Green** `#2E7D32` — microgrid & renewable energy (PV, battery, energy flows)
- **Red / orange** `#C62828` / `#E65100` — arc fault & safety (waveforms, trip logic, hazards)
- **Cyan** `#0097A7` — digital twin, cloud, data, dashboards
- Neutral grey `#5F6368` for secondary text; keep to these five plus black/white.

**Typography sizes (16:9, ~960 pt wide)**
- Slide title: 30–34 pt bold
- Section / column heading: 18–20 pt semibold
- Body bullets: 16–18 pt (never below 14 pt)
- Table text: 12–14 pt
- Figure captions / status tags: 10–12 pt
- Speaker notes are not on the slide.

**Visuals per slide**
- 1 primary visual per slide; at most 2 (one main + one small inset). Slide 8's table counts as the primary visual — no inset needed if it is dense.
- Slides 4, 6, 7 are the technical-proof slides — give them the largest, clearest single figure.

**Which slides need real lab photos rather than generic images**
- **Slide 7 (Digital Twin):** real screenshots of the running dashboard + a photo of the physical 40-lamp panel and its CHINT NB2 breaker.
- **Slide 3 / Slide 9:** a photo of the DataSetup DAQ node (ESP32-S3 + NB2LE breaker + RS485 module in its enclosure) if one exists.
- **Slide 6 (Arc fault):** once built, a photo of the controlled test rig; until then use the labelled waveform/FFT figures from `ArcFault/Data Description.pdf` and clearly mark them "CHINT AFCI dataset (50 Hz), Future Energy Lab rig planned".
- **Slide 4:** use the actual `simulation/figs/*` PNGs — do not redraw them as decorative charts.
- Slides 1, 2, 5, 8, 10 should use custom diagrams / tables, not photos.

**Integration rule (state it on Slide 1 and repeat on Slide 10):**
> MicroGrid generates and manages energy → Arc-Fault protection secures the LV system → Digital Twin monitors and visualises it → New CHINT technologies and 60-Hz localization make it deployable for Saudi systems.

The deck must read as one ecosystem with one data spine, not four project updates.
