# Analytics Upload

Every **Tuesday**, publishes the lamp panel analytics from the **lab PC** to the Digital Twin's
**Verified Field Data** section, with no manual steps and no redeploy. Data is kept as one
processed JSON per calendar month, from `start_month` (August 2026) to the current month.

```
Lab PC (Excel logs) ──► publish_analytics.py ──► GitHub: data/analytics/<YYYY-MM>.json ──► /api/real_analytics ──► Overview tab
                        pull · process ·        + index.json                         (edge cache 10 min)     month picker
                        validate · upload
```

Raw readings never leave the PC. Only the processed summary (~10 kB) is published.

## What each Tuesday run does

| Month | What happens |
|---|---|
| **Finished, not yet final on GitHub** | Processed and published once as *complete* |
| **Finished, already final** | Skipped |
| **Current month** | Republished from day 1 to the end of yesterday (Monday); the site shows it as *October 2026 (to 12 Oct)* |

Each month goes through these four steps:

| Step | What happens | Stops the upload if… |
|---|---|---|
| **Pull** | Reads every `.xlsx / .xls / .csv` in `data_folder` (all sheets, subfolders included) and keeps the rows that fall in the month. Skips Excel lock files (`~$…`) and files last written before the month started. | the folder is missing, a file cannot be read, or the month has no readings |
| **Process** | Removes duplicate timestamps and physically impossible rows, then builds per-day figures (running and zero-current hours, energy, average power, voltage and PF) plus month totals. Gaps longer than `max_gap_s` count as *no data*, not as idle time. | — |
| **Validate** | Checks that at most 1 % of rows are invalid, that energy agrees with power × hours (within 5 %), and that no day is longer than 24 h. Coverage and duplicates are reported as warnings. | any check fails |
| **Upload** | Commits `<month>.json` first and `index.json` second, then reads both back from GitHub and compares SHA-256. Retries network errors up to 3 times. | the read-back does not match |

A problem in one month is logged and does not stop the other months. Every run writes
`logs/run_<time>.log` and keeps a local copy of each JSON in `output/`.

## Set up on the lab PC (once)

1. **Python 3.10+** and the packages:
   ```
   pip install -r requirements.txt
   ```
2. **Config:** copy `config.example.json` to `config.json` and set `data_folder` to the folder
   holding the Excel files (`start_month` is the first month to publish). The columns are detected from the headers (`Time`, `Voltage (V)`,
   `Current(A)`, `Active Power (W)`, `PF`, …). If detection fails, the error lists the headers
   it found; write the exact names under `columns`. If the date and time are in separate
   columns, use `"timestamp": ["Date", "Time"]`. A Home Assistant history export
   (`entity_id, state, last_changed`) is also understood, using the entity ids in `ha_entities`.
3. **GitHub token:** create a *fine-grained* token at GitHub → Settings → Developer settings,
   limited to the **FutureEnergyLab** repository, permission **Contents: Read and write**. Then:
   ```
   setx FEL_GITHUB_TOKEN "github_pat_..."
   ```
   Open a new PowerShell afterwards so the variable is visible.
4. **Test on real data without uploading:**
   ```
   python publish_analytics.py --dry-run
   ```
   Check the summaries in the log and in `output/`.
5. **Schedule it:**
   ```
   powershell -ExecutionPolicy Bypass -File .\install_task.ps1
   ```
   The task runs **every Tuesday at 03:00**. If the PC is off or offline then, Windows runs it as
   soon as the PC is back.

## Manual use

```
python publish_analytics.py                          # start_month to today (what the task runs)
python publish_analytics.py --month 2026-08          # one month only
python publish_analytics.py --month 2026-08 --force  # republish a finished month after fixing its files
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
