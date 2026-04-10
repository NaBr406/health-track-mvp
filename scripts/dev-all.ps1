$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent $PSScriptRoot
$serverScript = Join-Path $PSScriptRoot "dev-server.ps1"
$mobileScript = Join-Path $PSScriptRoot "dev-mobile.ps1"

Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", "`"$serverScript`""
Start-Sleep -Seconds 10
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", "`"$mobileScript`""

Write-Host "[health-track] Started backend and mobile scripts in separate windows." -ForegroundColor Green
