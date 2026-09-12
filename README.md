# Future Energy Lab

**Prince Sattam bin Abdulaziz University (PSAU) — College of Engineering, Al-Kharj, Saudi Arabia**

> A research group working on **Artificial Intelligence, Deep Learning, and data-driven
> algorithms for future energy and power systems** — from low-voltage distribution networks
> and arc-fault detection to smart metering, microgrids, and EV charging.

---

## Table of Contents

- [About the Lab](#about-the-lab)
- [Research Interests](#research-interests)
- [Current Projects & Code](#current-projects--code)
- [Publications](#publications)
- [Lab Team](#lab-team)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

---

## About the Lab

The Future Energy Lab is a research group at Prince Sattam bin Abdulaziz University focused on
applying modern machine-learning and data-driven methods to real problems in electrical power
and energy systems. The lab combines **laboratory experimentation** (instrumented panels,
appliance-level metering rigs, arc-fault test benches, a physical microgrid) with
**simulation, modelling, and algorithm development**.

Our work spans the full pipeline: building measurement hardware, collecting ground-truth
datasets, developing detection and forecasting models, and validating them on physical assets.

---

## Research Interests

The group focuses on **AI, Deep Learning, and data-driven algorithms for future energy and
power systems**, with active research in:

- AI and deep learning for power and energy systems
- Management and operation of distribution networks
- Arc-fault detection
- Advanced metering infrastructure and smart metering
- Data-center energy systems
- EV charging management
- Port electrification
- Renewable-energy curtailment and hosting capacity

See [`docs/RESEARCH.md`](docs/RESEARCH.md) for more detail.

---

## Current Projects & Code

Each project below is a self-contained folder with its own `README.md`, code, and data.
**Status** shows how far along it is — `Live` and `Validated` are running today; `Prototype`
and `Research` are working but not field-deployed; `Placeholder` has no content yet.

### ⚡ Arc Fault Detection — [`ArcFault/`](ArcFault/) · `Research`

Curated dataset (258 labelled trials, 4 AFCI models, 6.4 kHz sampling) with a signal-analysis
notebook, plus a submitted physics-informed neural network (PINN) detection framework.
**[Open the notebook in Colab →](https://colab.research.google.com/github/JehadMajed/FutureEnergyLab/blob/main/ArcFault/Arc_Fault_Data_Study.ipynb)**

### 🔌 Appliance-Level Data Acquisition (Data Setup) — [`DataSetup/`](DataSetup/) · `Validated`

Open, reproducible ESP32 + CHINT-breaker DAQ rig that isolates, switches, and continuously
logs per-appliance power signatures. Reference deployment: **21 appliances, several months,
100% automation success rate.** Shares its hardware approach with, and is expected to
converge with, the Smart Meter project below.

### 🏠 Microgrid — [`MicroGrid/`](MicroGrid/) · `Validated (simulation)`

Preliminary electrical sizing (PV, battery, inverter, cables) for an islanded 230 V / 60 Hz
lab microgrid — a scaled-down NEOM City microgrid concept — verified by a 24-hour
energy-balance simulation across 4 operating cases. Also includes a separate
[load analysis](MicroGrid/Microgrid_Load_Analysis_and_Sizing.md) of the lab's existing
SonnenBatterie eco 8.0 system.

### 🖥️ Digital Twin — NB2 Lamps Panel — [`Digital Twin/`](Digital%20Twin/) · `Live`

Full-stack cloud digital twin of a physical 40-lamp lighting distribution panel: sub-second
MQTT telemetry, remote control, interactive 3D model, thermal-electrical simulation, and
SCADA-style analytics. **[Try the live demo →](https://digital-twin-lamps-panel.pages.dev/)**

### 📟 Smart Meter — Intelli-Meter — [`Smart Meter/`](Smart%20Meter/) · `Prototype`

Virtual-prototype next-generation smart meter: FHMM load disaggregation, LSTM load
forecasting, and hybrid CUSUM+LSTM theft detection, plus a real ESP32/CHINT hardware node
(currently in data-recording mode). A field pilot with Saudi Electricity (SEC) and CHINT is
planned but not yet formalized.

### 🗺️ LV Distribution Topology — [`Topology/`](Topology/) · `Research`

YOLO11-seg instance-segmentation model that detects trench footprints (repaired cable-route
pavement) from street-level photos and video, to help infer real LV cable routing. Backs an
accepted journal paper and a published IEEE conference paper.

### 🛸 Energy Management for Swarm of Drones — [`Energy Management for Swarm of Drones/`](Energy%20Management%20for%20Swarm%20of%20Drones/) · `Placeholder`

Reserved for an upcoming project on energy management strategies for drone swarms — no
content yet.

> Additional research code/models will be added to this repository as they are cleared for
> public release.

---

## Publications

Papers published, submitted, or in preparation in connection with the lab's work.
Full list with status in [`docs/PUBLICATIONS.md`](docs/PUBLICATIONS.md).

- **A Physics-Informed Neural Network Framework for Arc-Fault Detection** — submitted; see [`ArcFault/`](ArcFault/).
- **Comparative study on arc-fault detection methods** — in preparation.
- **Hybrid LSTM–CUSUM Framework for Electricity Theft Detection in Residential Smart Grids** — submitted; see [`Smart Meter/`](Smart%20Meter/).
- **Inferring Low-Voltage Distribution Topology from Trench Footprints: A Deep Learning
  Framework with Infrared Thermal Validation** — accepted (journal) / published (IEEE conference); see [`Topology/`](Topology/).
- **Time-series analysis of photovoltaic curtailment in radial distribution networks** — published.
- A patent application related to arc-fault detection is in progress.

---

## Lab Team

### Faculty

- Dr. Mohammed Alqahtani
- Dr. Ibrahim Marabet
- Dr. Malik Alduhaymi
- Dr. Sulaiman Al-Mutairi
- Dr. Ali Al-Jumaa
- Dr. Osama Al-Jumaa

### Students & Researchers

- Abdulrahman Mahjoub
- Osama Abdulqader
- Abdulaziz Alobaid
- Mohammed Alsalmi
- Kareem Mohammed
- Jehad Majed Aldayeh
- Omar Amir Fadl
- Abdullah Alowairdhi
- Hamad Alsubaie

Full team page: [`docs/TEAM.md`](docs/TEAM.md).

---

## Repository Structure

```
Future Energy Lab/
├── README.md                                # This page — lab overview
├── LICENSE                                  # MIT License
├── CONTRIBUTING.md                          # How to contribute
├── docs/
│   ├── TEAM.md                              # Team members
│   ├── PUBLICATIONS.md                      # Publication list and status
│   └── RESEARCH.md                          # Research areas in detail
├── ArcFault/                                # Arc-fault dataset + Colab analysis notebook
├── DataSetup/                               # Appliance-level power data acquisition toolkit
├── Digital Twin/                            # SCADA digital twin of the NB2 lamps panel
├── MicroGrid/                               # Microgrid load analysis, Phase A sizing, and Simulink model
├── Smart Meter/                             # Next-generation smart meter (theft/forecasting/NILM)
├── Topology/                                # LV distribution topology — trench footprint segmentation
└── Energy Management for Swarm of Drones/   # Placeholder — future project
```

---

## Getting Started

Each project folder is self-contained and has its own `README.md` with setup instructions.

```bash
git clone https://github.com/JehadMajed/FutureEnergyLab.git
cd FutureEnergyLab
```

- **Arc Fault Data Study** — open `ArcFault/Arc_Fault_Data_Study.ipynb` in Google Colab; set `BASE_PATH`.
- **Data Setup** — see [`DataSetup/README.md`](DataSetup/README.md) (`software/extractor` quick start).
- **Microgrid** — see [`MicroGrid/phase-a-microgrid-sizing/README.md`](MicroGrid/phase-a-microgrid-sizing/README.md) (Python 3.11+, stdlib + matplotlib).
- **Digital Twin** — see [`Digital Twin/README.md`](Digital%20Twin/README.md) (Node.js ≥ 18, Cloudflare Pages).
- **Smart Meter** — see [`Smart Meter/README.md`](Smart%20Meter/README.md), or open the
  [Colab notebook](https://colab.research.google.com/drive/1G199XtU2leIWHnVgL8FWiT7J4jNfE0ZU) directly.
- **Topology** — open `Topology/trench_footprint_segmentation.ipynb` in Google Colab (needs a GPU runtime).

---

## Contributing

Contributions from lab members and collaborators are welcome. Please read
[`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a pull request.

---

## License

Unless a subfolder states otherwise, this repository is released under the
[MIT License](LICENSE).

---

## Contact

For collaboration or questions, please open an issue in this repository or contact the
faculty members listed above at Prince Sattam bin Abdulaziz University, College of
Engineering, Al-Kharj, Saudi Arabia.
