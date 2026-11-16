[CmdletBinding()]
param([switch]$CreateAdmin, [switch]$RefreshDependencies)
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BackendRoot = Join-Path $ProjectRoot "backend"
$PythonExe = Join-Path $BackendRoot ".venv\Scripts\python.exe"

function Assert-CommandSucceeded([string]$Step) {
    if ($LASTEXITCODE -ne 0) { throw "$Step failed. See the command output above." }
}

if (!(Test-Path (Join-Path $ProjectRoot "frontend\dist\index.html"))) {
    throw "Build the frontend first. From frontend, run npm ci and npm run build."
}
Push-Location $BackendRoot
try {
    $NewEnvironment = !(Test-Path $PythonExe)
    if ($NewEnvironment) {
        if (Get-Command py -ErrorAction SilentlyContinue) {
            & py -3.12 -m venv .venv
        } else {
            & python -m venv .venv
        }
        Assert-CommandSucceeded "Creating the Python virtual environment"
    }
    if ($NewEnvironment -or $RefreshDependencies -or !(Test-Path ".venv\.sri-ready")) {
        & $PythonExe -m pip install -r requirements.txt
        Assert-CommandSucceeded "Installing backend dependencies"
        New-Item -ItemType File -Path ".venv\.sri-ready" -Force | Out-Null
    }
    if (!(Test-Path ".env")) {
        $LocalSettings = (Get-Content ".env.example" -Raw).Replace(
            "PUBLIC_ORIGIN=http://localhost:5173", "PUBLIC_ORIGIN=http://localhost:5000"
        )
        [IO.File]::WriteAllText((Join-Path $BackendRoot ".env"), $LocalSettings)
    }
    & $PythonExe -m flask --app run init-db
    Assert-CommandSucceeded "Initialising MongoDB (confirm the MongoDB service is running)"
    if ($CreateAdmin) {
        & $PythonExe -m flask --app run create-admin
        Assert-CommandSucceeded "Creating the administrator"
    }
    Write-Host "Public site: http://localhost:5000/"
    Write-Host "Staff login: http://localhost:5000/admin/login"
    & $PythonExe -m waitress --listen=127.0.0.1:5000 run:app
    Assert-CommandSucceeded "Starting the website"
} finally {
    Pop-Location
}
