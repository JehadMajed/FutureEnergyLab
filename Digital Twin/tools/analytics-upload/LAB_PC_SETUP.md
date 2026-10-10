# Lab PC Setup — Lamp Panel Analytics Upload

> **For Claude Code running on the lab PC.** The user will open this file and ask you to carry it
> out. Work through the steps in order, run the commands yourself, and stop to ask the user only
> where a step says **ASK** or **USER**. Reply to the user in Arabic.

## What you are setting up

The lamp panel's logger on this PC writes one reading per second (voltage, current, power,
power factor) to Excel files in a local folder. Every **Tuesday at 03:00** a scheduled task
must run `publish_analytics.py`, which:

1. reads the Excel files from **1 August 2026** up to the end of Monday,
2. reduces them to one per-day summary JSON per calendar month,
3. validates the result (and refuses to publish bad data),
4. uploads the JSON to GitHub (`JehadMajed/FutureEnergyLab`, folder
   `Digital Twin/data/analytics/`), then reads it back and checks the SHA-256.

The website <https://digital-twin-lamps-panel.pages.dev/> reads those files and shows them in the
first tab under **Verified Field Data**, with a month picker. The site side is already deployed;
only this PC is left. Raw readings never leave this PC.

Full tool documentation: `README.md` in the same folder.

## Rules

- **Never ask the user to paste the GitHub token into the chat, and never type it yourself.**
  The user creates it and sets it in their own terminal (step 6).
- Do not edit `publish_analytics.py`'s validation limits to make a check pass. If a check fails,
  find out why from the data and report it to the user.
- Do not commit or push anything from this PC. The tool uploads through the GitHub API.
- Use PowerShell. Install location: `C:\FEL\analytics-upload` (outside OneDrive, so sync cannot
  lock or move files).

---

## Step 1 — Check the PC

```powershell
Get-TimeZone            # must be Arab Standard Time (UTC+03:00). If not, tell the user.
python --version        # needs 3.10 or newer
```

If Python is missing or older than 3.10, **ASK** the user before installing it
(`winget install Python.Python.3.12`), then open a new PowerShell.

## Step 2 — Download the tool

```powershell
$dir  = "C:\FEL\analytics-upload"
$base = "https://raw.githubusercontent.com/JehadMajed/FutureEnergyLab/main/Digital%20Twin/tools/analytics-upload"
New-Item -ItemType Directory -Force $dir | Out-Null
foreach ($f in "publish_analytics.py","requirements.txt","config.example.json","install_task.ps1","README.md") {
  Invoke-WebRequest "$base/$f" -OutFile "$dir\$f" -UseBasicParsing
}
Get-ChildItem $dir
```

If the download fails with a certificate error, the campus network is inspecting TLS; tell the
user and ask them to download the five files from the GitHub page in a browser into `$dir`.

## Step 3 — Python environment

```powershell
cd C:\FEL\analytics-upload
python -m venv .venv
.\.venv\Scripts\python -m pip install --upgrade pip
.\.venv\Scripts\python -m pip install -r requirements.txt
```

If pip fails with an SSL/certificate error, retry with
`.\.venv\Scripts\python -m pip install --use-feature=truststore -r requirements.txt`.

## Step 4 — Find the data folder and check the files

**ASK** the user where the logger saves the Excel files. If they are not sure, look for them:

```powershell
Get-ChildItem C:\ ,D:\ -Recurse -Include *.xlsx,*.xls,*.csv -ErrorAction SilentlyContinue |
  Where-Object LastWriteTime -gt (Get-Date).AddDays(-14) |
  Sort-Object LastWriteTime -Descending | Select-Object -First 20 FullName,Length,LastWriteTime
```

Confirm the folder with the user. Then look at one recent file:

```powershell
.\.venv\Scripts\python -c "import pandas as pd,sys; d=pd.read_excel(sys.argv[1],sheet_name=None,engine='calamine'); [print(n, len(df), list(df.columns), df.head(3).to_string(), sep='\n') for n,df in d.items()]" "<path to one file>"
```

Check:
- there is a timestamp column (or separate date and time columns),
- voltage ≈ 230 V, current ≈ 2.9 A and power ≈ 400 W when the lamps are on, ≈ 0 when off,
- whether there is a power-factor column (≈ 0.58–0.60 when on). It is optional.

## Step 5 — Config

```powershell
Copy-Item config.example.json config.json
```

Edit `config.json`:
- `data_folder`: the folder from step 4 (forward slashes, e.g. `"D:/LampPanel/Logs"`).
- `start_month`: leave `"2026-08"`.
- `columns`: leave all `null` first; the tool detects headers such as `Time`, `Voltage (V)`,
  `Current(A)`, `Active Power (W)`, `PF`. Set exact header names only if the dry run says it
  could not find a column. Separate date and time columns: `"timestamp": ["Date", "Time"]`.
- If the files are Home Assistant history exports (`entity_id, state, last_changed`), set the
  three entity ids under `ha_entities` to match the file.

Dry run (reads and validates every month from August to yesterday, uploads nothing):

```powershell
.\.venv\Scripts\python publish_analytics.py --dry-run
```

It should end with `exit 0`. For each month, check the summary line in the output and in
`output\<month>.json` against what is physically plausible:
- about 400 W average running power, PF about 0.58–0.60,
- running hours that match how many hours a day the lamps are on,
- no unexpected `missing_days`.

If something fails or looks wrong, fix the config (columns, folder) and run again. If the data
itself is the problem (logger gaps, wrong values), stop and explain it to the user.

## Step 6 — GitHub token (USER)

Tell the user to do these steps themselves, and wait until they confirm:

1. github.com → Settings → Developer settings → Personal access tokens → **Fine-grained tokens**
   → Generate new token.
2. Repository access: **Only select repositories** → `FutureEnergyLab`.
3. Permissions → Repository permissions → **Contents: Read and write**. Nothing else.
4. Expiration: one year, with a reminder to renew.
5. In their own PowerShell window: `setx FEL_GITHUB_TOKEN "<the token>"`.
6. Close that window.

Then, in a **new** PowerShell, check that it is set without printing it:

```powershell
[bool][Environment]::GetEnvironmentVariable("FEL_GITHUB_TOKEN","User")   # must be True
```

## Step 7 — First real upload

```powershell
cd C:\FEL\analytics-upload
$env:FEL_GITHUB_TOKEN = [Environment]::GetEnvironmentVariable("FEL_GITHUB_TOKEN","User")
.\.venv\Scripts\python publish_analytics.py
```

Expected: each month ends with `published and verified`, then `exit 0`. Exit `3` means the
upload failed (check the token's repository and permission). Exit `1` or `2`: see the log.

Within about 15 minutes, check the site:

```powershell
(Invoke-RestMethod https://digital-twin-lamps-panel.pages.dev/api/real_analytics).months
```

It should list `2026-07`, `2026-08`, `2026-09` and the current month.

## Step 8 — Schedule it

```powershell
powershell -ExecutionPolicy Bypass -File .\install_task.ps1 -Python "C:\FEL\analytics-upload\.venv\Scripts\python.exe"
Get-ScheduledTask "FEL Lamp Panel Analytics Upload" | Get-ScheduledTaskInfo
```

The task runs every Tuesday at 03:00 as this Windows user, while the user is logged on. If the
PC is off at that time, it runs as soon as the PC is back.

Test the task itself once:

```powershell
Start-ScheduledTask "FEL Lamp Panel Analytics Upload"
# wait ~1 minute, then:
Get-ScheduledTaskInfo "FEL Lamp Panel Analytics Upload" | Select-Object LastRunTime,LastTaskResult
Get-ChildItem .\logs | Sort-Object LastWriteTime | Select-Object -Last 1 | Get-Content -Tail 15
```

`LastTaskResult` 0 = success.

If the user wants it to run even when nobody is logged on, open Task Scheduler →
the task → Properties → "Run whether user is logged on or not". The user types their Windows
password there.

## Step 9 — Report to the user (in Arabic)

- The data folder that is used, and the columns that were detected.
- Per month: days with data, running hours, kWh, PF, and any warnings.
- That the upload is verified and the months appear on the site.
- When the next run is (next Tuesday 03:00), and where the logs are (`C:\FEL\analytics-upload\logs`).
