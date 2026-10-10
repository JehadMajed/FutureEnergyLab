#!/usr/bin/env python3
"""
Weekly analytics publisher for the Lamp Panel Digital Twin.

Runs on the lab PC every Tuesday. Data is published as one file per calendar
month, for every month from `start_month` (config) up to today:
  - a finished month is published once, as final, and then left alone;
  - the current month is republished each run, covering day 1 up to yesterday.

For each month it:
  1. PULL      reads the logger's Excel / CSV files from a local folder
  2. PROCESS   reduces the one-second readings to a per-day summary
  3. VALIDATE  refuses to publish data that fails range / consistency checks
  4. UPLOAD    writes <month>.json and index.json to the website's private
               Cloudflare Workers KV namespace, then reads both back and
               compares SHA-256, so a partial upload is caught.

Raw readings never leave the PC; only the processed JSON (~10 kB) is published.
The website reads it from KV through /api/real_analytics. Nothing goes to Git.

Usage:
  python publish_analytics.py                          # every month from start_month to today
  python publish_analytics.py --month 2026-08          # one month only
  python publish_analytics.py --dry-run                # process + validate, no upload
  python publish_analytics.py --month 2026-08 --force  # republish a finished month

Exit codes: 0 ok / nothing to do | 1 validation failed | 2 input or config error
            3 upload or verification failed
"""
from __future__ import annotations

import argparse
import calendar
import datetime as dt
import hashlib
import json
import logging
import os
import platform
import re
import shutil
import sys
import tempfile
import time
from pathlib import Path

import pandas as pd
import requests

try:  # University network does TLS inspection; trust the Windows certificate store.
    import truststore
    truststore.inject_into_ssl()
except ImportError:
    pass

TOOL_VERSION = "1.2.0"
LOG_RETENTION_DAYS = 400
SCHEMA_VERSION = 1
HERE = Path(__file__).resolve().parent
log = logging.getLogger("publish_analytics")

# Header aliases, matched after normalising (lower case, units in brackets removed,
# spaces -> "_"). power_factor is resolved before power so "power" never grabs it.
ALIASES = {
    "power_factor": ["power_factor", "powerfactor", "pf", "cos_phi", "معامل_القدرة"],
    "timestamp": ["timestamp", "datetime", "date_time", "time", "date", "last_changed",
                  "last_updated", "الوقت", "التاريخ"],
    "voltage": ["voltage", "volt", "v", "u", "الجهد"],
    "current": ["current", "amps", "amp", "i", "التيار"],
    "power": ["active_power", "activepower", "power", "watt", "watts", "p", "القدرة"],
}
QUANTITIES = ["voltage", "current", "power", "power_factor"]

# Physically possible ranges for this panel (230 V, 40 x 11 W lamps). Rows outside
# are dropped; if more than MAX_INVALID_FRACTION of rows are dropped, nothing is published.
RANGES = {"voltage": (150.0, 280.0), "current": (0.0, 50.0), "power": (-50.0, 12000.0),
          "power_factor": (0.0, 1.0)}
MAX_INVALID_FRACTION = 0.01


class InputError(Exception):
    """Bad config or unreadable / unrecognisable data (exit 2)."""


class UploadError(Exception):
    """Upload or read-back verification failed (exit 3)."""


# ── config ──────────────────────────────────────────────────────────────────

def load_config(path: Path) -> dict:
    if not path.exists():
        raise InputError(f"config not found: {path} (copy config.example.json to config.json)")
    cfg = json.loads(path.read_text(encoding="utf-8"))
    for key in ("data_folder", "cloudflare", "start_month"):
        if key not in cfg:
            raise InputError(f"config: missing '{key}'")
    month_bounds(cfg["start_month"])
    cfg.setdefault("file_patterns", ["*.xlsx", "*.xlsm", "*.xls", "*.csv"])
    cfg.setdefault("utc_offset_hours", 3)
    cfg.setdefault("columns", {})
    cfg.setdefault("ha_entities", {})
    cfg.setdefault("running_threshold_a", 0.10)
    cfg.setdefault("max_gap_s", 10)
    cfg.setdefault("skip_files_older_than_month", True)
    return cfg


def month_bounds(month: str) -> tuple[dt.datetime, dt.datetime]:
    if not re.fullmatch(r"\d{4}-\d{2}", month):
        raise InputError(f"bad --month '{month}', expected YYYY-MM")
    y, m = map(int, month.split("-"))
    start = dt.datetime(y, m, 1)
    end = dt.datetime(y + (m == 12), m % 12 + 1, 1)
    return start, end


def months_between(first: str, today: dt.date) -> list[str]:
    out, (y, m) = [], map(int, first.split("-"))
    while (y, m) <= (today.year, today.month):
        out.append(f"{y:04d}-{m:02d}")
        y, m = y + (m == 12), m % 12 + 1
    return out


def period(month: str, today: dt.date) -> tuple[dt.datetime, dt.datetime, bool]:
    """Publishing window for a month: up to the end of yesterday, never into today.
    Returns (start, end, complete); complete means the whole month is over."""
    start, month_end = month_bounds(month)
    midnight = dt.datetime.combine(today, dt.time())
    return start, min(month_end, midnight), month_end <= midnight


# ── 1. PULL: read the logger files ──────────────────────────────────────────

def norm_header(h) -> str:
    s = str(h).strip().lower()
    s = re.sub(r"[\(\[\{].*?[\)\]\}]", "", s)          # drop "(W)", "[V]" ...
    return re.sub(r"[\s\-./]+", "_", s).strip("_")


def find_files(cfg: dict, start: dt.datetime) -> list[Path]:
    folder = Path(cfg["data_folder"])
    if not folder.is_dir():
        raise InputError(f"data_folder does not exist: {folder}")
    files = set()
    for pattern in cfg["file_patterns"]:
        files.update(folder.rglob(pattern))
    files = sorted(f for f in files if f.is_file() and not f.name.startswith("~$"))
    if cfg["skip_files_older_than_month"]:
        # A file holding readings from this month was last written on or after the
        # month started, so anything older cannot contain them.
        cutoff = (start - dt.timedelta(days=1)).timestamp()
        files = [f for f in files if f.stat().st_mtime >= cutoff]
    return files


def _read(path: Path) -> list[pd.DataFrame]:
    if path.suffix.lower() == ".csv":
        return [pd.read_csv(path, low_memory=False)]
    sheets = pd.read_excel(path, sheet_name=None, engine="calamine")
    return [df for df in sheets.values() if not df.empty]


def read_sheets(path: Path) -> list[pd.DataFrame]:
    """Read a file, tolerating the logger holding it open: retry, then read a copy."""
    err = None
    for wait in (0, 15, 30, 60):
        time.sleep(wait)
        try:
            return _read(path)
        except Exception as e:  # locked, or caught mid-write
            err = e
        try:
            with tempfile.TemporaryDirectory() as tmp:
                copy = Path(tmp) / path.name
                shutil.copyfile(path, copy)
                return _read(copy)
        except Exception as e:
            err = e
        log.warning("      %s not readable yet (%s); retrying", path.name, err)
    raise err


def parse_timestamps(col: pd.Series, utc_offset_h: float) -> pd.Series:
    """Return naive local datetimes from datetime / unix / Excel-serial / text columns."""
    offset = pd.Timedelta(hours=utc_offset_h)
    if pd.api.types.is_datetime64_any_dtype(col):
        ts = col
    elif pd.api.types.is_numeric_dtype(col):
        v = col.astype("float64")
        med = v.median()
        if med > 1e11:                                   # unix milliseconds
            return pd.to_datetime(v, unit="ms") + offset
        if med > 1e8:                                    # unix seconds
            return pd.to_datetime(v, unit="s") + offset
        return pd.Timestamp("1899-12-30") + pd.to_timedelta(v, unit="D")   # Excel serial
    else:
        text = col.astype(str).str.strip()
        try:
            ts = pd.to_datetime(text, errors="coerce", format="mixed")
        except (ValueError, TypeError):                  # mixed time zones
            ts = pd.to_datetime(text, errors="coerce", format="mixed", utc=True)
    if getattr(ts.dt, "tz", None) is not None:           # aware -> local wall clock
        ts = ts.dt.tz_convert("UTC").dt.tz_localize(None) + offset
    return ts


def map_wide_columns(df: pd.DataFrame, explicit: dict) -> dict:
    """quantity -> source column name (or list of columns for split date + time)."""
    headers = {norm_header(c): c for c in df.columns}
    found, used = {}, set()
    for qty, names in ALIASES.items():
        want = explicit.get(qty)
        if want:
            cols = want if isinstance(want, list) else [want]
            missing = [c for c in cols if c not in df.columns]
            if missing:
                raise InputError(f"config columns.{qty}: {missing} not in sheet headers {list(df.columns)}")
            found[qty] = want
            used.update(cols)
            continue
        hit = next((headers[n] for n in names if n in headers and headers[n] not in used), None)
        if hit is None:  # looser match: header contains a (multi-letter) alias
            hit = next((orig for norm, orig in headers.items() if orig not in used
                        and any(len(n) > 2 and n in norm for n in names)), None)
        if hit is not None:
            found[qty] = hit
            used.add(hit)
    return found


def normalise_sheet(df: pd.DataFrame, cfg: dict, source: str) -> pd.DataFrame:
    """One sheet -> columns ts, voltage, current, power, power_factor."""
    norm = {norm_header(c): c for c in df.columns}
    off = cfg["utc_offset_hours"]

    if {"entity_id", "state", "last_changed"} <= norm.keys():
        # Home Assistant history export (long format): one row per state change.
        ents = cfg["ha_entities"]
        if not ents:
            raise InputError(f"{source}: looks like a Home Assistant export; set 'ha_entities' in config")
        long = pd.DataFrame({
            "entity": df[norm["entity_id"]].astype(str),
            "value": pd.to_numeric(df[norm["state"]], errors="coerce"),
            "ts": parse_timestamps(df[norm["last_changed"]], off),
        })
        out = None
        for qty, entity in ents.items():
            s = (long[long.entity == entity].dropna(subset=["ts"])
                 .drop_duplicates("ts", keep="last").set_index("ts")["value"].rename(qty))
            out = s.to_frame() if out is None else out.join(s, how="outer")
        if out is None or out.empty:
            return pd.DataFrame(columns=["ts"] + QUANTITIES)
        # Home Assistant logs a row only when a value changes; a value holds until the
        # next change. Resample to 1 s (like DataSetup's extractor) so time is counted
        # the same way as for the logger's one-second files.
        out = out.sort_index()
        out = out[~out.index.duplicated(keep="last")]
        grid = pd.date_range(out.index[0].ceil("s"), out.index[-1].floor("s"), freq="1s")
        out = (out.reindex(out.index.union(grid)).ffill().reindex(grid)
               .rename_axis("ts").reset_index())
    else:
        cols = map_wide_columns(df, cfg["columns"])
        missing = [q for q in ("timestamp", "voltage", "current", "power") if q not in cols]
        if missing:
            raise InputError(f"{source}: could not find column(s) {missing} in headers "
                             f"{list(df.columns)}; set them under 'columns' in config.json")
        tcol = cols["timestamp"]
        raw_ts = (df[tcol].astype(str).agg(" ".join, axis=1) if isinstance(tcol, list) else df[tcol])
        out = pd.DataFrame({"ts": parse_timestamps(raw_ts, off)})
        for qty in QUANTITIES:
            out[qty] = pd.to_numeric(df[cols[qty]], errors="coerce") if qty in cols else float("nan")

    for qty in QUANTITIES:
        if qty not in out:
            out[qty] = float("nan")
    pf = out["power_factor"]
    if pf.notna().any() and pf.median() > 1.5:              # logged as a percentage
        out["power_factor"] = pf / 100.0
    return out[["ts"] + QUANTITIES]


def pull(cfg: dict, start: dt.datetime, end: dt.datetime) -> tuple[pd.DataFrame, list[dict]]:
    files = find_files(cfg, start)
    log.info("PULL  %d candidate file(s) in %s", len(files), cfg["data_folder"])
    frames, sources = [], []
    for f in files:
        t0 = time.time()
        try:
            sheets = read_sheets(f)
        except Exception as e:  # unreadable after retries: report it, never silently skip
            raise InputError(f"cannot read {f}: {e}") from e
        rows_in_month = 0
        for sheet in sheets:
            part = normalise_sheet(sheet, cfg, f.name)
            part = part[(part.ts >= start) & (part.ts < end)]
            if len(part):
                frames.append(part)
                rows_in_month += len(part)
        log.info("      %-50s %9d rows in month  (%.1fs)", f.name[:50], rows_in_month, time.time() - t0)
        if rows_in_month:
            sources.append({"file": f.name, "bytes": f.stat().st_size,
                            "sha256": sha256_file(f), "rows_in_month": rows_in_month})
    if not frames:
        raise InputError(f"no readings between {start:%Y-%m-%d} and {end:%Y-%m-%d} in {cfg['data_folder']}")
    return pd.concat(frames, ignore_index=True), sources


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


# ── 2. PROCESS ──────────────────────────────────────────────────────────────

def clean(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    stats = {"rows_read": int(len(df))}
    df = df.dropna(subset=["ts"]).sort_values("ts")
    before = len(df)
    df = df.drop_duplicates("ts", keep="last")
    stats["duplicate_timestamps"] = before - len(df)

    bad = df[["voltage", "current", "power"]].isna().any(axis=1)
    for qty, (lo, hi) in RANGES.items():
        v = df[qty]
        bad |= v.notna() & ((v < lo) | (v > hi))
    stats["invalid_rows"] = int(bad.sum())
    df = df[~bad].copy()
    df["power"] = df["power"].clip(lower=0)
    stats["rows_used"] = int(len(df))
    return df.reset_index(drop=True), stats


def process(df: pd.DataFrame, cfg: dict, month: str, start: dt.datetime,
            end: dt.datetime) -> tuple[list[dict], dict]:
    thr, max_gap = cfg["running_threshold_a"], cfg["max_gap_s"]

    # Each reading stands for the time until the next one; gaps longer than max_gap
    # are logging outages and count as "no data", not as running or idle time.
    step = df.ts.diff().shift(-1).dt.total_seconds()
    nominal = float(step[step <= max_gap].median()) if (step <= max_gap).any() else 1.0
    gap = step.isna() | (step > max_gap)
    df["dt"] = step.where(~gap, nominal).clip(upper=(end - df.ts).dt.total_seconds())
    df["running"] = df.current > thr
    calc_pf = (df.power / (df.voltage * df.current)).clip(0, 1)
    df["pf"] = df.power_factor.fillna(calc_pf).where(df.running)
    df["day"] = df.ts.dt.strftime("%Y-%m-%d")

    daily = []
    for day in pd.date_range(start, end - pd.Timedelta(days=1), freq="D").strftime("%Y-%m-%d"):
        d = df[df.day == day]
        run = d[d.running]
        run_s = float(run.dt.sum())
        zero_s = float(d.dt[~d.running].sum())
        daily.append({
            "day": day,
            "has_data": bool(len(d)),
            "total_readings": int(len(d)),
            "running_readings": int(len(run)),
            "zero_readings": int(len(d) - len(run)),
            "coverage_hours": round((run_s + zero_s) / 3600, 2),
            "run_hours": round(run_s / 3600, 2),
            "zero_hours": round(zero_s / 3600, 2),
            "avg_power": round(float(run.power.mean()), 1) if len(run) else 0.0,
            "avg_voltage": round(float(d.voltage.mean()), 1) if len(d) else None,
            "avg_pf": round(float(run.pf.mean()), 3) if len(run) and run.pf.notna().any() else None,
            "energy_kwh": round(float((d.power * d.dt).sum()) / 3.6e6, 3),
        })
    return daily, summarise(daily, month)


def summarise(daily: list[dict], month: str) -> dict:
    """Month totals from the per-day rows (also used to convert the legacy July file)."""
    with_data = [d for d in daily if d["has_data"]]
    run_h = sum(d["run_hours"] for d in daily)
    zero_h = sum(d["zero_hours"] for d in daily)
    cov_h = run_h + zero_h
    running = sum(d["running_readings"] for d in daily)
    pf_days = [d for d in daily if d["avg_pf"] is not None and d["running_readings"]]
    pf_w = sum(d["running_readings"] for d in pf_days)
    p_w = sum(d["avg_power"] * d["running_readings"] for d in daily)
    days_in_month = calendar.monthrange(*map(int, month.split("-")))[1]
    return {
        "days_in_month": days_in_month,
        "period_days": len(daily),            # < days_in_month while the month is running
        "total_days": len(with_data),
        "missing_days": [d["day"] for d in daily if not d["has_data"]],
        "total_readings": sum(d["total_readings"] for d in daily),
        "coverage_hours": round(cov_h, 1),
        "coverage_percentage": round(cov_h / (len(daily) * 24) * 100, 1) if daily else 0.0,
        "total_run_hours": round(run_h, 1),
        "total_zero_hours": round(zero_h, 1),
        "uptime_percentage": round(run_h / cov_h * 100, 1) if cov_h else 0.0,
        "total_energy_kwh": round(sum(d["energy_kwh"] for d in daily), 2),
        "avg_running_power": round(p_w / running, 1) if running else 0.0,
        # Weighted by running readings: idle days have no PF and must not pull it to zero.
        "avg_power_factor": round(sum(d["avg_pf"] * d["running_readings"] for d in pf_days) / pf_w, 3)
                            if pf_w else None,
    }


# ── 3. VALIDATE ─────────────────────────────────────────────────────────────

def validate(daily: list[dict], summary: dict, stats: dict, complete: bool) -> list[dict]:
    checks = []

    def check(name, status, detail):
        checks.append({"check": name, "status": status, "detail": detail})

    check("period", "pass", "complete month" if complete
          else f"month in progress: {daily[0]['day']} to {daily[-1]['day']}")

    n = stats["rows_read"]
    frac = stats["invalid_rows"] / n if n else 1.0
    check("value_ranges", "fail" if frac > MAX_INVALID_FRACTION else "pass",
          f"{stats['invalid_rows']} of {n} rows outside physical ranges or blank ({frac:.2%}); "
          f"limit {MAX_INVALID_FRACTION:.0%}")

    check("duplicates", "pass" if not stats["duplicate_timestamps"] else "warn",
          f"{stats['duplicate_timestamps']} duplicate timestamps removed")

    check("has_readings", "pass" if summary["total_readings"] else "fail",
          f"{summary['total_readings']} readings on {summary['total_days']} day(s)")

    # Energy must agree with average running power x running hours.
    e1 = summary["total_energy_kwh"]
    e2 = summary["avg_running_power"] * summary["total_run_hours"] / 1000
    rel = abs(e1 - e2) / e2 if e2 else (0.0 if e1 < 0.05 else 1.0)
    check("energy_consistency", "pass" if rel <= 0.05 else "fail",
          f"sum(P*dt) = {e1:.2f} kWh vs avg P x run h = {e2:.2f} kWh ({rel:.1%} apart, limit 5%)")

    bad_days = [d["day"] for d in daily if d["coverage_hours"] > 24.05]
    check("day_length", "fail" if bad_days else "pass",
          f"days longer than 24 h: {bad_days}" if bad_days else "every day <= 24 h")

    cov = summary["coverage_percentage"]
    check("coverage", "pass" if cov >= 90 else "warn",
          f"{cov}% of the period logged; missing days: {summary['missing_days'] or 'none'}")
    return checks


# ── 4. UPLOAD ───────────────────────────────────────────────────────────────

class KV:
    """Cloudflare Workers KV over the REST API (the namespace the website reads)."""
    API = "https://api.cloudflare.com/client/v4"

    def __init__(self, account_id: str, namespace_id: str, prefix: str, token: str | None):
        self.namespace, self.prefix = namespace_id, prefix
        self.base = f"{self.API}/accounts/{account_id}/storage/kv/namespaces/{namespace_id}/values/"
        self.s = requests.Session()
        self.s.headers["User-Agent"] = f"fel-analytics-upload/{TOOL_VERSION}"
        if token:
            self.s.headers["Authorization"] = f"Bearer {token}"

    def _url(self, key: str) -> str:
        return self.base + requests.utils.quote(self.prefix + key, safe="")

    def _call(self, method: str, url: str, **kw) -> requests.Response:
        for attempt, wait in enumerate((5, 20, 60, None), 1):
            try:
                r = self.s.request(method, url, timeout=60, **kw)
                if r.status_code < 500 and r.status_code != 429:
                    return r
                err = f"HTTP {r.status_code}"
            except requests.RequestException as e:
                err = str(e)
            if wait is None:
                raise UploadError(f"{method} {url} failed after {attempt} attempts: {err}")
            log.warning("      %s failed (%s), retrying in %ds", method, err, wait)
            time.sleep(wait)

    def get(self, key: str) -> bytes | None:
        r = self._call("GET", self._url(key))
        if r.status_code == 404:
            return None
        if r.status_code != 200:
            raise UploadError(f"GET {key}: HTTP {r.status_code} {r.text[:200]}")
        return r.content

    def put(self, key: str, content: bytes) -> None:
        r = self._call("PUT", self._url(key), data=content,
                       headers={"Content-Type": "application/octet-stream"})
        if r.status_code != 200 or not r.json().get("success"):
            raise UploadError(f"PUT {key}: HTTP {r.status_code} {r.text[:300]}")

    def put_verified(self, key: str, content: bytes) -> None:
        self.put(key, content)
        want = hashlib.sha256(content).hexdigest()
        # KV is eventually consistent; give a fresh write up to ~1 min to be readable.
        for wait in (0, 5, 15, 40):
            time.sleep(wait)
            got = hashlib.sha256(self.get(key) or b"").hexdigest()
            if got == want:
                log.info("      %s%s  verified sha256 %s", self.prefix, key, want[:12])
                return
        raise UploadError(f"read-back of {key} does not match (sha256 {got[:12]} != {want[:12]})")


def to_bytes(obj) -> bytes:
    return (json.dumps(obj, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def load_index(kv: KV) -> dict:
    raw = kv.get("index.json")
    if raw is None:
        return {"schema_version": SCHEMA_VERSION, "months": []}
    return json.loads(raw)


def publish(kv: KV, doc: dict, index: dict) -> None:
    month = doc["month"]
    content = to_bytes(doc)
    kv.put_verified(f"{month}.json", content)

    entry = {"month": month, "file": f"{month}.json",
             "complete": doc["complete"], "data_through": doc["data_through"],
             "sha256": hashlib.sha256(content).hexdigest(),
             "published_at": doc["generated_at"],
             "total_days": doc["summary"]["total_days"],
             "total_energy_kwh": doc["summary"]["total_energy_kwh"]}
    months = [m for m in index["months"] if m["month"] != month] + [entry]
    months.sort(key=lambda m: m["month"])
    index.update({"schema_version": SCHEMA_VERSION, "months": months,
                  "latest": months[-1]["month"], "updated_at": doc["generated_at"]})
    # Month file first, index second: the site never lists a month it cannot load.
    kv.put_verified("index.json", to_bytes(index))


# ── main ────────────────────────────────────────────────────────────────────

def setup_logging() -> Path:
    if hasattr(sys.stdout, "reconfigure"):  # Windows console is not UTF-8 by default
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    logdir = HERE / "logs"
    logdir.mkdir(exist_ok=True)
    cutoff = time.time() - LOG_RETENTION_DAYS * 86400
    for old in logdir.glob("run_*.log"):
        if old.stat().st_mtime < cutoff:
            old.unlink(missing_ok=True)
    logfile = logdir / f"run_{dt.datetime.now():%Y%m%d-%H%M%S}.log"
    fmt = logging.Formatter("%(asctime)s %(levelname)-7s %(message)s", "%Y-%m-%d %H:%M:%S")
    for h in (logging.StreamHandler(sys.stdout), logging.FileHandler(logfile, encoding="utf-8")):
        h.setFormatter(fmt)
        log.addHandler(h)
    log.setLevel(logging.INFO)
    return logfile


def run_month(month: str, cfg: dict, kv: KV, index: dict | None,
              args, today: dt.date) -> int:
    start, end, complete = period(month, today)
    if end <= start:
        log.info("[%s] no full day yet; skipped", month)
        return 0
    through = (end - dt.timedelta(days=1)).strftime("%Y-%m-%d")
    log.info("[%s] %s, %s to %s", month, "complete" if complete else "in progress",
             start.strftime("%Y-%m-%d"), through)

    if index is not None and not args.force:
        entry = next((m for m in index["months"] if m["month"] == month), None)
        if entry and entry.get("complete") and complete:
            log.info("[%s] final version already published; skipped", month)
            return 0

    t0 = time.time()
    raw, sources = pull(cfg, start, end)
    df, stats = clean(raw)
    log.info("PROCESS %d rows read, %d duplicates, %d invalid, %d used",
             stats["rows_read"], stats["duplicate_timestamps"], stats["invalid_rows"], stats["rows_used"])
    daily, summary = process(df, cfg, month, start, end)
    s = summary
    log.info("        %d/%d days with data | %.1f h running | %.1f kWh | PF %s | coverage %.1f%%",
             s["total_days"], s["period_days"], s["total_run_hours"], s["total_energy_kwh"],
             s["avg_power_factor"], s["coverage_percentage"])

    checks = validate(daily, summary, stats, complete)
    for c in checks:
        log.info("VALIDATE %-4s %-19s %s", c["status"].upper(), c["check"], c["detail"])
    failed = [c for c in checks if c["status"] == "fail"]

    doc = {
        "schema_version": SCHEMA_VERSION,
        "month": month,
        "complete": complete,
        "data_through": through,
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "generator": {"tool": "publish_analytics.py", "version": TOOL_VERSION,
                      "running_threshold_a": cfg["running_threshold_a"], "max_gap_s": cfg["max_gap_s"],
                      "processing_seconds": round(time.time() - t0, 1)},
        "sources": sources,
        "validation": {"passed": not failed, "row_stats": stats, "checks": checks},
        "summary": summary,
        "daily": daily,
    }
    outdir = HERE / "output"
    outdir.mkdir(exist_ok=True)
    (outdir / f"{month}.json").write_bytes(to_bytes(doc))
    log.info("        wrote %s", outdir / f"{month}.json")

    if failed:
        log.error("[%s] NOT PUBLISHED: %d validation check(s) failed", month, len(failed))
        return 1
    if args.dry_run:
        log.info("[%s] dry run: validation passed, nothing uploaded", month)
        return 0

    log.info("UPLOAD  -> Cloudflare KV namespace %s", kv.namespace)
    publish(kv, doc, index)
    log.info("[%s] published and verified", month)
    return 0


def load_token(ccfg: dict) -> str | None:
    """Token from the environment, else from a local file readable only by the task's account."""
    env = os.environ.get(ccfg.get("token_env", "FEL_CF_TOKEN"), "").strip()
    if env:
        return env
    f = Path(ccfg.get("token_file", "secrets/cf_token.txt"))
    f = f if f.is_absolute() else HERE / f
    if f.exists():
        return f.read_text(encoding="utf-8-sig").strip() or None
    return None


class Run:
    """State of one run, so the heartbeat can report it even after a failure."""

    def __init__(self, args):
        self.args, self.kv, self.results, self.error = args, None, {}, None

    def execute(self) -> int:
        cfg = load_config(self.args.config)
        ccfg = cfg["cloudflare"]
        token = load_token(ccfg)
        self.kv = KV(ccfg["account_id"], ccfg["namespace_id"], ccfg.get("key_prefix", "analytics/"), token)
        if not self.args.dry_run and not token:
            raise InputError("no Cloudflare token: set FEL_CF_TOKEN or create secrets/cf_token.txt "
                             "(run set_token.ps1)")

        today = dt.date.today()
        months = [self.args.month] if self.args.month else months_between(cfg["start_month"], today)
        for m in months:
            month_bounds(m)
        log.info("publish_analytics %s  months=%s  dry_run=%s", TOOL_VERSION, ",".join(months),
                 self.args.dry_run)
        index = None if self.args.dry_run else load_index(self.kv)

        # Each month stands alone: a problem in one is logged and does not stop the others.
        worst = 0
        for month in months:
            msg = None
            try:
                code = run_month(month, cfg, self.kv, index, self.args, today)
                if code == 1:
                    msg = "validation failed (see log)"
            except InputError as e:
                log.error("[%s] INPUT ERROR: %s", month, e)
                code, msg = 2, f"input: {e}"
            except UploadError as e:
                log.error("[%s] UPLOAD ERROR: %s", month, e)
                code, msg = 3, f"upload: {e}"
            except Exception as e:
                log.exception("[%s] UNEXPECTED ERROR", month)
                code, msg = 2, f"unexpected: {e!r}"
            self.results[month] = {"code": code, "error": msg[:300] if msg else None}
            worst = max(worst, code)
        return worst

    def heartbeat(self, code: int, logfile: Path) -> None:
        """Tell the watchdog this PC is alive and how the run went. Written on every real run."""
        if self.args.dry_run or self.kv is None or "Authorization" not in self.kv.s.headers:
            return
        beat = {"at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
                "host": platform.node(), "tool_version": TOOL_VERSION, "exit_code": code,
                "error": self.error, "months": self.results, "log": logfile.name}
        self.kv.put("heartbeat.json", to_bytes(beat))
        log.info("HEARTBEAT written (exit %d)", code)


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--config", type=Path, default=HERE / "config.json")
    p.add_argument("--month", help="YYYY-MM, one month only (default: start_month to today)")
    p.add_argument("--dry-run", action="store_true", help="process and validate, do not upload")
    p.add_argument("--force", action="store_true", help="republish a finished month")
    args = p.parse_args()

    logfile = setup_logging()
    r = Run(args)
    try:
        code = r.execute()
    except InputError as e:
        log.error("INPUT ERROR: %s", e)
        code, r.error = 2, f"input: {e}"
    except UploadError as e:
        log.error("UPLOAD ERROR: %s", e)
        code, r.error = 3, f"upload: {e}"
    except Exception as e:
        log.exception("UNEXPECTED ERROR")
        code, r.error = 2, f"unexpected: {e!r}"
    try:
        r.heartbeat(code, logfile)
    except Exception as e:  # the watchdog will notice the missing heartbeat
        log.error("HEARTBEAT failed: %s", e)
        code = max(code, 3)
    log.info("exit %d | log %s", code, logfile)
    return code


if __name__ == "__main__":
    sys.exit(main())
