# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [2.0.0] — 2025

### 🎉 Initial Public Release

This is the first public release of the NB2 Lamps Panel Digital Twin.

### Added
- **Data Overview tab** — Live MQTT telemetry KPI cards (power, voltage, current, PF, energy, CO₂)
- **Real-time trend charts** — Power, voltage, current, and power factor with Chart.js
- **Historical analytics** — Energy, efficiency, cost, CO₂ charts with date-range picker and comparison mode
- **3D Model & Control tab** — Interactive GLB panel model via `<model-viewer>`, remote Open/Close/Unlock commands through Home Assistant
- **Simulation & Scenarios tab** — Physics-based thermal model, lumen maintenance curves, aging/dimming scenarios, partial-failure simulation
- **SCADA Alarm System** — ISA-101 severity levels (Critical/Warning), acknowledge/clear workflow, filter and export
- **Export tools** — Run CSV, lamp table CSV, summary report
- **Cloudflare Pages Functions** — Secure server-side proxy for HA and MQTT credentials
- **MQTT broker failover** — Automatic reconnect across up to 3 configured brokers
- **Optimized 3D model** — GLB compressed with `@gltf-transform` (2.2 MB vs 9.6 MB original)
- **Dark SCADA theme** — Custom CSS design system with Inter + JetBrains Mono fonts
- **Responsive layout** — Works on desktop and tablet viewports

### Security
- All credentials (MQTT passwords, HA token) served only through Cloudflare environment secrets
- No credentials embedded in public JavaScript
- `.dev.vars.example` template provided for safe local development setup
