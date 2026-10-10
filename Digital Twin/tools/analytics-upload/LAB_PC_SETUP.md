# Lab PC Setup — Lamp Panel Analytics Upload

> **For Claude Code running on the lab PC.** The user will open this file and ask you to carry it
> out. Work through the steps in order, run the commands yourself, and stop to ask the user only
> where a step says **ASK** or **USER**. Reply to the user in Arabic.

## What you are setting up

The lamp panel's logger on this PC writes one reading per second (voltage, current, power,
power factor) to Excel files in a local folder. Every **Tuesday at 03:00** a scheduled task runs
`publish_analytics.py`, which:

1. reads the Excel files from **1 August 2026** up to the end of Monday,
2. reduces them to one per-day summary JSON per calendar month,
3. validates the result (and refuses to publish bad data),
4. uploads the JSON to the website's **private Cloudflare Workers KV** namespace, reads it back
   and checks the SHA-256,
5. writes a **heartbeat** (time and result of the run) to KV.

The website <https://digital-twin-lamps-panel.pages.dev/> reads KV and shows the data in the first
tab under **Verified Field Data**. A watchdog in Cloudflare reads the heartbeat every day and
sends a phone notification (ntfy) if this PC stops reporting or a run fails. The site side is
already deployed; only this PC is left. Raw readings never leave this PC, and nothing goes to
GitHub (the repository is public).

**Goal: it must run unattended for at least two years.** Every choice below serves that:
dedicated Python, pinned packages, a SYSTEM task that needs no logged-on user or password,
a token that does not expire.

## Rules

- **Never ask the user to paste the Cloudflare token into the chat, and never type it yourself.**
  The user runs `set_token.ps1` in their own window (step 6).
- Do not edit `publish_analytics.py`'s validation limits to make a check pass. If a check fails,
  find out why from the data and report it to the user.
- Do not commit or push anything from this PC.
- Use PowerShell. Install location: `C:\FEL\analytics-upload` (local disk, outside OneDrive).
- Steps 1, 6, 7 and 8 need an **elevated** PowerShell (Run as administrator). If the user has
  no administrator rights on this PC, say so: the task can then only run while the user is
  logged on, which is not unattended.

---

## Step 1 — Dedicated Python (ASK before installing)

A private Python that nobody else on this PC will upgrade or remove. Check first:

```powershell
Test-Path C:\FEL\python312\python.exe
Get-TimeZone            # must be Arab Standard Time (UTC+03:00). If not, tell the user.
```

If it is missing, **ASK** the user, then install Python 3.12.10 there (elevated):

```powershell
New-Item -ItemType Directory -Force C:\FEL | Out-Null
Invoke-WebRequest https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe -OutFile C:\FEL\python-3.12.10-amd64.exe -UseBasicParsing
Start-Process C:\FEL\python-3.12.10-amd64.exe -Wait -ArgumentList "/quiet","InstallAllUsers=1","TargetDir=C:\FEL\python312","PrependPath=0","Include_launcher=0","Include_test=0","Shortcuts=0"
C:\FEL\python312\python.exe --version     # Python 3.12.10
```

## Step 2 — Download the tool

```powershell
$dir  = "C:\FEL\analytics-upload"
$base = "https://raw.githubusercontent.com/JehadMajed/FutureEnergyLab/main/Digital%20Twin/tools/analytics-upload"
New-Item -ItemType Directory -Force $dir | Out-Null
foreach ($f in "publish_analytics.py","requirements.txt","config.example.json","install_task.ps1","set_token.ps1","README.md") {
  Invoke-WebRequest "$base/$f" -OutFile "$dir\$f" -UseBasicParsing
}
Get-ChildItem $dir
```

If a download fails with a certificate error (campus TLS inspection), tell the user and ask them
to download the files from the GitHub page in a browser into `$dir`.

## Step 3 — Python environment (pinned packages)

```powershell
cd C:\FEL\analytics-upload
C:\FEL\python312\python.exe -m venv .venv
.\.venv\Scripts\python -m pip install --upgrade pip
.\.venv\Scripts\python -m pip install -r requirements.txt
```

If pip fails with an SSL/certificate error, retry with
`.\.venv\Scripts\python -m pip install --use-feature=truststore -r requirements.txt`.
Do not change the versions in `requirements.txt`; they are the tested set.

## Step 4 — Find the data folder and check the files

**ASK** the user where the logger saves the Excel files. If they are not sure, look:

```powershell
Get-ChildItem C:\ ,D:\ -Recurse -Include *.xlsx,*.xls,*.csv -ErrorAction SilentlyContinue |
  Where-Object LastWriteTime -gt (Get-Date).AddDays(-14) |
  Sort-Object LastWriteTime -Descending | Select-Object -First 20 FullName,Length,LastWriteTime
```

The folder must be on a **local disk**: not OneDrive, not a mapped network drive (the SYSTEM
task cannot see mapped drives, and OneDrive may leave files as online-only placeholders). If it
is, tell the user and agree on a local folder with them.

Look at one recent file:

```powershell
.\.venv\Scripts\python -c "import pandas as pd,sys; d=pd.read_excel(sys.argv[1],sheet_name=None,engine='calamine'); [print(n, len(df), list(df.columns), df.head(3).to_string(), sep='\n') for n,df in d.items()]" "<path to one file>"
```

Check: a timestamp column (or separate date and time columns); voltage ≈ 230 V, current ≈ 2.9 A
and power ≈ 400 W when the lamps are on, ≈ 0 when off; optional power-factor column (≈ 0.58–0.60).

## Step 5 — Config and dry run

```powershell
Copy-Item config.example.json config.json
```

Edit `config.json`:
- `data_folder`: the folder from step 4 (forward slashes, e.g. `"D:/LampPanel/Logs"`).
- `start_month`: leave `"2026-08"`. `cloudflare`: leave as it is (ids are not secrets).
- `file_patterns`: narrow it to the logger's own files (e.g. `["LAMPS_PANEL_Device_*.xlsx"]`).
- `sheets`: if a file has other sheets beside the readings (summary, run log), list only the
  readings sheet, e.g. `["Data"]`. A summary row must never be read as a reading.
- `columns`: leave all `null` first; the tool finds the header row by itself, even below a
  blank first row. Set exact header names only if the dry run cannot find a column, and never
  `"Unnamed: N"` names. Separate date and time columns: `"timestamp": ["Date", "Time"]`.
- Home Assistant history exports (`entity_id, state, last_changed`): set `ha_entities` to match.

```powershell
.\.venv\Scripts\python publish_analytics.py --dry-run
```

It must end with `exit 0`. Per month, check the summary line (and `output\<month>.json`):
about 400 W average running power, PF about 0.58–0.60, running hours that match how long the
lamps are on each day, no unexpected `missing_days`. Fix the config and rerun if needed. If the
data itself is wrong (logger gaps, bad values), stop and explain it to the user.

## Step 6 — Cloudflare token (USER)

Tell the user to do this themselves, and wait until they confirm:

1. Sign in at dash.cloudflare.com as **gehadm36@gmail.com** (the account that owns the site).
2. My Profile → **API Tokens** → Create Token → **Create Custom Token**.
3. Name: `lab-pc-analytics-upload`.
4. Permissions: **Account → Workers KV Storage → Edit**. Nothing else.
5. Account Resources: **Include → Gehadm36@gmail.com's Account**.
6. **TTL: leave empty (no expiry)**, so the upload does not stop in two years. Create and copy it.
7. In an **elevated** PowerShell window of their own:
   ```powershell
   cd C:\FEL\analytics-upload
   powershell -ExecutionPolicy Bypass -File .\set_token.ps1
   ```
   and paste the token at the prompt. It prints `Token verified (active, expires: never)`.

Check (without reading the token): `Test-Path C:\FEL\analytics-upload\secrets\cf_token.txt` → True.

## Step 7 — Keep the PC available (ASK)

**ASK** the user before changing power settings, then (elevated):

```powershell
powercfg /change standby-timeout-ac 0      # never sleep on mains power
powercfg /change hibernate-timeout-ac 0
```

Also tell the user (they do it themselves, once): in the PC's BIOS/UEFI, set
**"Restore on AC power loss" = Power On**, so the PC starts again by itself after a power cut.

## Step 8 — Schedule it (elevated)

```powershell
cd C:\FEL\analytics-upload
powershell -ExecutionPolicy Bypass -File .\install_task.ps1
```

It must say `as SYSTEM (runs without anyone logged on)`. Now run the task once, for real:

```powershell
Start-ScheduledTask "FEL Lamp Panel Analytics Upload"
# wait until it finishes (first run processes August to now; a few minutes at most), then:
Get-ScheduledTaskInfo "FEL Lamp Panel Analytics Upload" | Select-Object LastRunTime,LastTaskResult
Get-ChildItem .\logs | Sort-Object LastWriteTime | Select-Object -Last 1 | Get-Content -Tail 20
```

Expected: every month `published and verified`, `HEARTBEAT written (exit 0)`, `exit 0`, and
`LastTaskResult` 0. Exit `3` = upload failed (HTTP 403: wrong token permission or account);
`1`/`2` = see the log.

Within about 10 minutes, the site must list the months:

```powershell
(Invoke-RestMethod https://digital-twin-lamps-panel.pages.dev/api/real_analytics).months
```

## Step 9 — Phone alerts (USER)

The user installs the **ntfy** app (Android / iPhone) and subscribes to the topic name they
were given in their chat with the developer (it is not written here because this repository is
public). From then on: an alert any day the PC stops reporting or a run fails, and an
"all good" message on the 1st of every month.

## Step 10 — Report to the user (in Arabic)

- The data folder and the columns that were detected.
- Per month: days with data, running hours, kWh, PF, and any warnings.
- That the task runs as SYSTEM every Tuesday 03:00, the upload is verified, and the months
  appear on the site.
- What they still have to do themselves, if anything (BIOS power setting, ntfy app).
- Logs: `C:\FEL\analytics-upload\logs`.
