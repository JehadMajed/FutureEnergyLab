# Low-Voltage Distribution Topology Inference

![Journal status](https://img.shields.io/badge/journal-accepted-success)
![Conference status](https://img.shields.io/badge/IEEE%20conference-published-success)
![Topic](https://img.shields.io/badge/topic-distribution%20network%20topology-blue)
![Validation](https://img.shields.io/badge/validation-infrared%20thermal%20imaging-orange)

Research on inferring **low-voltage (LV) distribution network topology** — part of the lab's
broader work on management and operation of distribution networks: topology inference, state
estimation, and operational decision support for low- and medium-voltage networks, validated
against field measurements (see [`docs/RESEARCH.md`](../docs/RESEARCH.md)).

## The problem

Utilities often don't have an accurate, up-to-date map of how LV feeders are actually laid out
underground — as-built records drift from reality after repairs, extensions, and undocumented
work. Without a reliable topology, tasks like fault location, load-flow studies, and protection
coordination all run on shaky assumptions.

## Approach

The method infers LV distribution topology from **trench footprints** — the physical trace left
by buried cable runs — using a deep-learning framework, with **infrared thermal imaging** used
as an independent validation signal (buried/loaded cables produce a detectable thermal
signature at the surface).

## Publications

| Venue | Title | Status |
|---|---|---|
| Journal | Inferring Low-Voltage Distribution Topology from Trench Footprints: A Deep Learning Framework with Infrared Thermal Validation | Accepted |
| Conference (IEEE) | Inferring Low-Voltage Distribution Topology from Trench Footprints: A Deep Learning Framework | Published — [ieeexplore.ieee.org/document/11365432](https://ieeexplore.ieee.org/document/11365432) |

See [`docs/PUBLICATIONS.md`](../docs/PUBLICATIONS.md) for the full, up-to-date publication list.

> **Images/figures:** the trench-footprint and infrared-thermal images used in the paper are
> not yet in this repository — to be added.

## Status

This page currently tracks the published/accepted research output. Code, figures, and the
underlying dataset for this project are not yet public in this repository — they will be
added here once cleared for release.
