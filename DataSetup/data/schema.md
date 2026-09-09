# Output Data Schema

## `per_appliance/<name>.csv`

| Column | Type | Description |
|--------|------|-------------|
| `timestamp` | ISO 8601 datetime | Uniform grid at the resample interval (default 1 s) |
| `active_power_w` | float | Active power draw of the appliance, watts |

## `master.csv`

| Column | Type | Description |
|--------|------|-------------|
| `timestamp` | ISO 8601 datetime | Shared index across all appliances |
| `<appliance_name>` | float | Active power (W) for that appliance; one column per DAQ node |

## Processing applied

1. Raw Home Assistant state changes pulled per entity (`/api/history/period`).
2. Forward-fill — a reported power value holds until the next reported change.
3. Resample onto a fixed grid (default `1s`).
4. Reshape long → wide so all appliances share one timestamp index.

## `appliances.csv`

Reference inventory (not measurements): `device, electrical_category, integration_block,
typical_operating_nature`.
