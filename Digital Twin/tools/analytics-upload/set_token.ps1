# Saves the Cloudflare API token for publish_analytics.py to secrets\cf_token.txt,
# readable only by SYSTEM, Administrators and you, then checks it with Cloudflare.
#
# Run it YOURSELF (not through an assistant) and paste the token at the prompt.
# The token is not shown on screen. Use an elevated PowerShell so SYSTEM gets access:
#   powershell -ExecutionPolicy Bypass -File .\set_token.ps1

$ErrorActionPreference = "Stop"
$dir  = Join-Path $PSScriptRoot "secrets"
$file = Join-Path $dir "cf_token.txt"

$secure = Read-Host "Paste the Cloudflare API token" -AsSecureString
$bstr   = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$token  = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr).Trim()
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
if ($token.Length -lt 30) { throw "That does not look like a Cloudflare API token." }

$check = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/user/tokens/verify" `
           -Headers @{ Authorization = "Bearer $token" }
if ($check.result.status -ne "active") { throw "Cloudflare says the token is '$($check.result.status)'." }

New-Item -ItemType Directory -Force $dir | Out-Null
Set-Content -Path $file -Value $token -NoNewline -Encoding ascii

# Well-known SIDs, so this works on an Arabic or English Windows alike:
# S-1-5-18 = SYSTEM, S-1-5-32-544 = Administrators.
$me = [Security.Principal.WindowsIdentity]::GetCurrent().Name
icacls $dir  /inheritance:r /grant:r "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" "${me}:(OI)(CI)F" | Out-Null
icacls $file /inheritance:r /grant:r "*S-1-5-18:F" "*S-1-5-32-544:F" "${me}:F" | Out-Null

$expires = if ($check.result.expires_on) { $check.result.expires_on } else { "never" }
Write-Host "Token verified (active, expires: $expires) and saved to $file"
