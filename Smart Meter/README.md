# Smart Meter — Next-Generation Metering

**Three targets, one data foundation.** A smart meter's value comes from what it can infer
from a single measurement point — but every inference model needs to be trained on
per-appliance ground-truth data first. This project builds that data foundation and the
detection/forecasting models on top of it, moving toward a locally engineered, next-generation
smart meter.

## The three goals

| Goal | Description |
|---|---|
| **Electricity theft detection** | Detect tampering, bypass, and abnormal consumption directly from the metered signal. |
| **Load forecasting** | Predict consumption for network planning, time-of-use tariffs, and demand response. |
| **Load disaggregation (NILM)** | Break the aggregate signal into individual appliances from one metering point. |

All three are supervised-learning problems, and all three need the same input: a labelled,
time-synchronised, per-appliance active-power dataset with known switching events. That data
does not exist off the shelf, so the lab built a dedicated data-acquisition rig to generate it.

## Data foundation

The underlying data-acquisition rig — **[Data Setup](../DataSetup/)** — was built by lab
members including **Abdulrahman Mahjoub** and **Osama Abdulqader**. It isolates, switches,
and continuously logs the active-power signature of individual appliances (21 appliances,
several months of continuous operation), producing the labelled dataset all three smart-meter
goals train on. See [`DataSetup/README.md`](../DataSetup/README.md) for the full rig, pipeline,
and dataset documentation.

## Implementation path

```
1. Collect data   → the Data Setup rig
2. Develop a model → train on the dataset (theft / forecasting / NILM)
3. Fabricate it    → embed the model into a meter
```

## Pilot deployment: SEC + CHINT (planned)

After a short preparation period, a pilot with **Saudi Electricity (SEC)** and **CHINT** is
planned to move the smart-meter models from lab data to field validation on real customer
premises.

| Partner | Role |
|---|---|
| **CHINT** | Smart metering / breaker hardware and integration (the CHINT NB2LE class already used in Data Setup) |
| **Saudi Electricity (SEC)** | Host premises, field load data, and grid-code / standards alignment for Saudi 60 Hz networks |
| **Future Energy Lab** | Data Setup replication, model development, and validation protocol |

**Pilot objectives** (one per goal): validate theft detection on real tampering/bypass cases,
validate forecasting against SEC field consumption data, and validate NILM disaggregation on
live households.

**Path:** Lab dataset → Field pilot → Scale-up.

> **Status:** this is the stated plan and direction for the project. The formal partnership
> agreement and pilot document are not yet in place — track this section for updates as the
> pilot progresses.

## Related

- [Data Setup](../DataSetup/) — the appliance-level data-acquisition rig this project trains on.
- [Research Interests](../docs/RESEARCH.md) — "Advanced metering infrastructure and smart metering."
