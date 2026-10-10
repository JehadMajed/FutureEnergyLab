# Registers the Windows scheduled task that publishes the lamp panel analytics
# every Tuesday at 03:00 (data from start_month up to the end of Monday).
#
# If the lab PC is off or offline on Tuesday, Windows runs the task as soon as
# the PC is back, so no week is skipped.
#
# Run once, from this folder, in a normal (non-admin) PowerShell:
#   powershell -ExecutionPolicy Bypass -File .\install_task.ps1

param(
  [string]$Python = (Get-Command python -ErrorAction Stop).Source,
  [string]$At = "03:00",
  [string]$Day = "Tuesday"
)

$dir = $PSScriptRoot
if (-not (Test-Path "$dir\config.json")) { throw "Create config.json first (copy config.example.json)." }
if (-not [Environment]::GetEnvironmentVariable("FEL_GITHUB_TOKEN", "User")) {
  throw "Set the token first:  setx FEL_GITHUB_TOKEN <token>  (then open a new PowerShell)."
}

$action   = New-ScheduledTaskAction -Execute $Python `
              -Argument "`"$dir\publish_analytics.py`" --config `"$dir\config.json`"" `
              -WorkingDirectory $dir
$trigger  = New-ScheduledTaskTrigger -Weekly -DaysOfWeek $Day -At $At
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable `
              -ExecutionTimeLimit (New-TimeSpan -Hours 2) -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName "FEL Lamp Panel Analytics Upload" -Action $action `
  -Trigger $trigger -Settings $settings -Force `
  -Description "Processes the lamp panel logs and publishes the monthly JSON summaries to GitHub." | Out-Null

Write-Host "Registered 'FEL Lamp Panel Analytics Upload' (every $Day at $At)."
Write-Host "Test it now:  Start-ScheduledTask 'FEL Lamp Panel Analytics Upload'   then check .\logs\"
