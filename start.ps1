#requires -Version 5.1
<#
.SYNOPSIS
  One-command launch for DoubleTrouble on Windows.

.DESCRIPTION
  Creates the Python venv if missing, installs backend requirements,
  installs and (re)builds the frontend, then starts the server.

  Usage from PowerShell, in the repo root:
      .\start.ps1
  If you get an execution policy error, run this once in the same session:
      Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#>

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Step([string]$msg) {
    Write-Host ""
    Write-Host "==> $msg" -ForegroundColor Cyan
}

# 1) Python venv
if (-not (Test-Path ".venv")) {
    Step "Creating Python venv at .venv"
    python -m venv .venv
}

Step "Activating venv"
. .\.venv\Scripts\Activate.ps1

# 2) Backend deps
Step "Installing backend requirements"
python -m pip install --disable-pip-version-check -q -r backend\requirements.txt

# 3) Frontend deps + build
Step "Installing frontend dependencies"
Push-Location frontend
try {
    npm install --silent
    Step "Building frontend"
    npm run build
}
finally {
    Pop-Location
}

# 4) Start server
Step "Starting DoubleTrouble at http://127.0.0.1:8017  (Ctrl+C to stop)"
python run.py
