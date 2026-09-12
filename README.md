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

| Project | Description | Location |
|---|---|---|
| **Microgrid — Phase A Sizing** | Preliminary electrical sizing of an islanded single-phase 230 V / 60 Hz laboratory microgrid (PV, battery, inverter, cables) — a scaled-down version of the NEOM City microgrid concept — with fully traceable calculations and 24-hour energy-balance simulation across 4 operating cases. | [`MicroGrid/`](MicroGrid/) |
| **Microgrid Load Analysis** | Load inventory, daily-energy calculation, phase-balance analysis, and component sizing for the PSAU laboratory microgrid, including assessment of the existing SonnenBatterie eco 8.0. | [`MicroGrid/Microgrid_Load_Analysis_and_Sizing.md`](MicroGrid/Microgrid_Load_Analysis_and_Sizing.md) |
| **Arc Fault Data Study** | Curated experimental dataset and Google Colab analysis notebook for series and parallel arc-fault detection on residential loads (258 labeled trials, 4 AFCI models, 6.4 kHz sampling). | [`ArcFault/`](ArcFault/) |
| **Appliance-Level Data Acquisition (Data Setup)** | Open, reproducible edge-computing rig for isolating, switching, and continuously logging per-appliance active-power signatures (ESP32-S3 + smart breaker + Home Assistant + Python pipeline). Reference deployment: 21 appliances, several months. Data foundation for the Smart Meter project. | [`DataSetup/`](DataSetup/) |
| **Digital Twin — NB2 Lamps Panel** | Full-stack cloud digital twin of a physical 40-lamp lighting distribution panel: sub-second MQTT telemetry, remote control, interactive 3D model, thermal-electrical simulation, and SCADA-style analytics. **[Live Demo](https://digital-twin-lamps-panel.pages.dev/)**. | [`Digital Twin/`](Digital%20Twin/) |
| **Smart Meter — Intelli-Meter** | Virtual-prototype smart meter: FHMM load disaggregation, LSTM load forecasting, and hybrid CUSUM+LSTM theft detection, plus an ESP32/CHINT hardware node; planned field pilot with Saudi Electricity (SEC) and CHINT. | [`Smart Meter/`](Smart%20Meter/) |
| **LV Distribution Topology — Trench Footprint Segmentation** | YOLO11-seg instance-segmentation model trained to detect trench footprints (repaired cable-route pavement) from street-level photos and video, for inferring real LV cable routing. | [`Topology/`](Topology/) |

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
├── README.md                  # This page — lab overview
├── LICENSE                    # MIT License
├── CONTRIBUTING.md            # How to contribute
├── docs/
│   ├── TEAM.md                # Team members
│   ├── PUBLICATIONS.md        # Publication list and status
│   └── RESEARCH.md            # Research areas in detail
├── ArcFault/                  # Arc-fault dataset + Colab analysis notebook
├── DataSetup/                 # Appliance-level power data acquisition toolkit
├── Digital Twin/             # SCADA digital twin of the NB2 lamps panel
├── MicroGrid/                # Microgrid load analysis, Phase A sizing, and Simulink model
├── Smart Meter/               # Next-generation smart meter (theft/forecasting/NILM)
├── Topology/                  # LV distribution topology — trench footprint segmentation
└── Energy Management for Swarm of Drones/  # Placeholder — future project
```

---

## Getting Started

Each project folder is self-contained and has its own `README.md` with setup instructions.

```bash
git clone https://github.com/<org-or-user>/future-energy-lab.git
cd future-energy-lab
```

- **Arc Fault Data Study** — open `ArcFault/Arc_Fault_Data_Study.ipynb` in Google Colab; set `BASE_PATH`.
- **Data Setup** — see [`DataSetup/README.md`](DataSetup/README.md) (`software/extractor` quick start).
- **Microgrid** — see [`MicroGrid/phase-a-microgrid-sizing/README.md`](MicroGrid/phase-a-microgrid-sizing/README.md) (Python 3.11+, stdlib + matplotlib).
- **Digital Twin** — see [`Digital Twin/README.md`](Digital%20Twin/README.md) (Node.js ≥ 18, Cloudflare Pages).

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
