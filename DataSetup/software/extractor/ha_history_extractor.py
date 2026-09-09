#!/usr/bin/env python3
"""
Home Assistant history -> tidy CSV extractor.

Pulls per-entity state history from the Home Assistant REST API, then:
  - forward-fills missing values,
  - resamples to a fixed interval (default 1 s),
  - reshapes long -> wide (one column per appliance),
  - writes one CSV per appliance plus a synchronised master CSV.

Usage:
    python ha_history_extractor.py --config config.yaml --days 1
    python ha_history_extractor.py --config config.yaml --start 2026-09-01T00:00:00 --end 2026-09-02T00:00:00
"""
from __future__ import annotations

import argparse
import datetime as dt
import sys
from pathlib import Path

import pandas as pd
import requests
import yaml


def load_config(path: Path) -> dict:
    with open(path, "r", encoding="utf-8") as fh:
        cfg = yaml.safe_load(fh)
    for key in ("base_url", "token", "appliances"):
        if key not in cfg:
            sys.exit(f"config error: missing '{key}'")
    return cfg


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--config", type=Path, default=Path("config.yaml"))
    p.add_argument("--days", type=float, help="look back this many days from now")
    p.add_argument("--start", help="ISO start timestamp (overrides --days)")
    p.add_argument("--end", help="ISO end timestamp (default: now)")
    p.add_argument("--outdir", type=Path, default=Path("../../data/output"))
    p.add_argument("--resample", default="1s", help="pandas offset alias, default 1s")
    return p.parse_args()


def time_window(args) -> tuple[dt.datetime, dt.datetime]:
    end = dt.datetime.fromisoformat(args.end) if args.end else dt.datetime.now()
    if args.start:
        start = dt.datetime.fromisoformat(args.start)
    elif args.days:
        start = end - dt.timedelta(days=args.days)
    else:
        start = end - dt.timedelta(days=1)
    return start, end


def fetch_entity(base_url: str, token: str, entity_id: str,
                 start: dt.datetime, end: dt.datetime) -> pd.Series:
    url = f"{base_url.rstrip('/')}/api/history/period/{start.isoformat()}"
    params = {"filter_entity_id": entity_id, "end_time": end.isoformat(),
              "minimal_response": "true", "no_attributes": "true"}
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    resp = requests.get(url, headers=headers, params=params, timeout=60)
    resp.raise_for_status()
    data = resp.json()
    if not data or not data[0]:
        return pd.Series(dtype="float64", name=entity_id)
    rows = data[0]
    idx = pd.to_datetime([r["last_changed"] for r in rows])
    vals = pd.to_numeric([r["state"] for r in rows], errors="coerce")
    return pd.Series(vals, index=idx, name=entity_id).sort_index()


def process(series: pd.Series, start, end, rule: str) -> pd.Series:
    grid = pd.date_range(start=start, end=end, freq=rule)
    s = series[~series.index.duplicated(keep="last")]
    s = s.reindex(s.index.union(grid)).ffill().reindex(grid).ffill()
    return s


def main() -> None:
    args = parse_args()
    cfg = load_config(args.config)
    start, end = time_window(args)
    print(f"window: {start} -> {end}  resample={args.resample}")

    outdir = args.outdir
    (outdir / "per_appliance").mkdir(parents=True, exist_ok=True)

    columns: dict[str, pd.Series] = {}
    for name, entity_id in cfg["appliances"].items():
        print(f"  {name:<28} {entity_id}")
        raw = fetch_entity(cfg["base_url"], cfg["token"], entity_id, start, end)
        s = process(raw, start, end, args.resample)
        s.name = name
        columns[name] = s
        s.to_frame("active_power_w").rename_axis("timestamp").to_csv(
            outdir / "per_appliance" / f"{name}.csv")

    master = pd.DataFrame(columns).rename_axis("timestamp")
    master.to_csv(outdir / "master.csv")
    print(f"wrote {len(columns)} appliance files + master.csv ({len(master)} rows) to {outdir}")


if __name__ == "__main__":
    main()
