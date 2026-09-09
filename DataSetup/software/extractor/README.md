# Home Assistant History Extractor

Pulls per-appliance state history from Home Assistant and produces clean, resampled,
wide-format CSV time series.

## Install
```bash
python -m venv .venv
. .venv/Scripts/activate      # Windows;  . .venv/bin/activate on Linux/macOS
pip install -r requirements.txt
```

## Configure
```bash
cp config.example.yaml config.yaml
```
Edit `config.yaml`: set `base_url`, paste a **long-lived access token**
(Home Assistant → profile → Long-Lived Access Tokens), and map each appliance name to its
active-power `entity_id`.

## Run
```bash
python ha_history_extractor.py --config config.yaml --days 1
python ha_history_extractor.py --config config.yaml --start 2026-09-01T00:00:00 --end 2026-09-02T00:00:00
```

Output (default `../../data/output/`):
```
per_appliance/<name>.csv     timestamp, active_power_w
master.csv                   timestamp + one column per appliance
```

## Schedule (every 30 min, like the reference deployment)
- **Windows**: Task Scheduler → run `python ha_history_extractor.py --config config.yaml --days 1`.
- **Linux/macOS**: cron — `*/30 * * * * cd /path && .venv/bin/python ha_history_extractor.py --config config.yaml --days 1`

## Processing steps
forward-fill missing values → resample to 1 s (`--resample`) → reshape long→wide → write CSV.
