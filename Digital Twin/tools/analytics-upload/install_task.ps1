# Registers the Windows scheduled task that publishes the lamp panel analytics
# every Tuesday at 03:00 (data from start_month up to the end of Monday).
#
# Built to run unattended for years:
#   - runs as SYSTEM: no one has to be logged on, and a Windows password change
#     cannot break it;
#   - if the PC is off at 03:00, it runs as soon as the PC is back;
#   - it wakes the PC from sleep if needed, and runs on battery too.
#
# Run once, from this folder, in an elevated (Run as administrator) PowerShell:
#   powershell -ExecutionPolicy Bypass -File .\install_task.ps1
# Without administrator rights it falls back to a task for the current user,
# which only runs while that user is logged on.

param(
  [string]$Python = (Join-Path $PSScriptRoot ".venv\Scripts\python.exe"),
  [string]$At = "03:00",
  [string]$Day = "Tuesday"
)

$ErrorActionPreference = "Stop"
$dir  = $PSScriptRoot
$name = "FEL Lamp Panel Analytics Upload"
if (-not (Test-Path $Python))                    { throw "Python not found at $Python (create the .venv first)." }
if (-not (Test-Path "$dir\config.json"))         { throw "Create config.json first (copy config.example.json)." }
if (-not (Test-Path "$dir\secrets\cf_token.txt")) { throw "Run set_token.ps1 first." }

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
           ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

$action   = New-ScheduledTaskAction -Execute $Python `
              -Argument "`"$dir\publish_analytics.py`" --config `"$dir\config.json`"" `
              -WorkingDirectory $dir
$trigger  = New-ScheduledTaskTrigger -Weekly -DaysOfWeek $Day -At $At
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun `
              -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
              -ExecutionTimeLimit (New-TimeSpan -Hours 3) -MultipleInstances IgnoreNew

if ($isAdmin) {
  $principal = New-ScheduledTaskPrincipal -UserId "S-1-5-18" -LogonType ServiceAccount -RunLevel Highest
  $mode = "as SYSTEM (runs without anyone logged on)"
} else {
  $principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) `
                 -LogonType Interactive
  $mode = "as the current user ONLY WHILE LOGGED ON (rerun elevated for SYSTEM)"
  Write-Warning "Not elevated: the task will not run while nobody is logged on."
}

Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings `
  -Principal $principal -Force `
  -Description "Processes the lamp panel logs and publishes the monthly JSON summaries to Cloudflare KV." | Out-Null

Write-Host "Registered '$name' $mode, every $Day at $At."
Write-Host "Test it now:  Start-ScheduledTask '$name'   then check .\logs\"
