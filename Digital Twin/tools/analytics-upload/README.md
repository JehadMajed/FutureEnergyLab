# Analytics Upload

Every **Tuesday**, publishes the lamp panel analytics from the **lab PC** to the Digital Twin's
**Verified Field Data** section, with no manual steps and no redeploy. Data is kept as one
processed JSON per calendar month, from `start_month` (August 2026) to the current month.

```
Lab PC (Excel logs) ──► publish_analytics.py ──► Cloudflare Workers KV (private) ──► /api/real_analytics ──► Overview tab
                        pull · process ·        analytics/<YYYY-MM>.json            (edge cache 10 min)     month picker
                        validate · upload       analytics/index.json
```

Raw readings never leave the PC. Only the processed summary (~10 kB) is uploaded, to a private
KV namespace bound to the website; nothing is stored in Git. If KV is ever unreachable, the site
falls back to the July 2026 figures bundled in `real_analytics.json`.

## What each Tuesday run does

| Month | What happens |
|---|---|
| **Finished, not yet final in KV** | Processed and published once as *complete* |
| **Finished, already final** | Skipped |
| **Current month** | Republished from day 1 to the end of yesterday (Monday); the site shows it as *October 2026 (to 12 Oct)* |

Each month goes through these four steps:

| Step | What happens | Stops the upload if… |
|---|---|---|
| **Pull** | Reads every file matching `file_patterns` in `data_folder` (subfolders included; only the sheets listed in `sheets`, or all sheets if it is `null`) and keeps the rows that fall in the month. Finds the header row by itself if a sheet starts with blank or title rows. Skips Excel lock files (`~$…`) and files last written before the month started. | the folder is missing, a file cannot be read, or the month has no readings |
| **Process** | Removes duplicate timestamps and physically impossible rows, then builds per-day figures (running and zero-current hours, energy, average power, voltage and PF) plus month totals. Gaps longer than `max_gap_s` count as *no data*, not as idle time. | — |
| **Validate** | Checks that at most 1 % of rows are invalid, that energy agrees with power × hours (within 5 %), and that no day is longer than 24 h. Coverage and duplicates are reported as warnings. | any check fails |
| **Upload** | Writes `<month>.json` first and `index.json` second to KV, then reads both back and compares SHA-256 (allowing up to a minute for KV to settle). Retries network errors up to 3 times. | the read-back does not match |

A problem in one month is logged and does not stop the other months. Every run writes
`logs/run_<time>.log` and keeps a local copy of each JSON in `output/`.

## Set up on the lab PC (once)

Step-by-step instructions, written for Claude Code on the lab PC: [LAB_PC_SETUP.md](LAB_PC_SETUP.md).
In short:

1. A dedicated Python 3.12 in `C:\FEL\python312`, a `.venv`, and the pinned `requirements.txt`.
2. `config.json` from `config.example.json`, with `data_folder` set; check with `--dry-run`.
3. A Cloudflare API token (Workers KV Storage: Edit, **no expiry**), saved by running
   `set_token.ps1` yourself. It is stored in `secrets\cf_token.txt`, readable only by SYSTEM,
   Administrators and you. `FEL_CF_TOKEN` in the environment also works.
4. `install_task.ps1` (elevated): a scheduled task running **as SYSTEM every Tuesday at 03:00**,
   so nobody has to be logged on and a password change cannot break it. A run missed while the
   PC was off happens as soon as it is back.

## Built to run unattended

| Risk over the years | What handles it |
|---|---|
| PC off, broken, offline, or the task gone | Each run writes `analytics/heartbeat.json` to KV. The **watchdog** Worker (`workers/analytics-watchdog`) checks it daily in Cloudflare and sends a phone alert through ntfy, even when the PC is dead |
| A run fails (bad data, file format changed, token revoked) | The heartbeat carries the error; the watchdog alerts the same day |
| Alerts silently broken | The watchdog sends an "all good" message on the 1st of every month |
| Visitors seeing old data as current | The overview shows the last upload date and flags it when overdue |
| No one logged on, password changed | The task runs as SYSTEM |
| Python or packages upgraded by someone else | Private Python in `C:\FEL\python312`, pinned package versions |
| Logger holding an Excel file open | Reads are retried, then made from a copy |
| Logs filling the disk | Logs older than 400 days are deleted |
| Token expiring | Created without an expiry date |

## Manual use

```
.venv\Scripts\python publish_analytics.py --dry-run                # check everything, upload nothing
.venv\Scripts\python publish_analytics.py --month 2026-08          # one month only
.venv\Scripts\python publish_analytics.py --month 2026-08 --force  # republish a finished month
Start-ScheduledTask "FEL Lamp Panel Analytics Upload"              # a full run exactly as scheduled
```

Exit codes: `0` ok or nothing to do · `1` validation failed · `2` input or config error ·
`3` upload or verification failed.

## Notes

- **Time zone:** text and Excel timestamps are taken as local time. Unix and ISO-with-zone
  timestamps are converted with `utc_offset_hours` (Saudi Arabia: 3, no daylight saving).
- **University network:** `truststore` makes Python use the Windows certificate store, so
  uploads still work behind the campus TLS inspection.
- **Running threshold:** a reading counts as *running* when current > `running_threshold_a`
  (0.10 A, the same threshold as the July 2026 analysis).
- **PF** is averaged over running readings only, weighted by reading count, so idle days do
  not pull it toward zero. If the files have no PF column, it is computed as P / (V·I).
