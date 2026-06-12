$ErrorActionPreference = "Stop"

. "$PSScriptRoot\python-common.ps1"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$python = Find-ProjectPython
& $python.Command @($python.Prefix) -m uvicorn server:app --app-dir "apps/api/rag_pipeline" --reload --host "0.0.0.0" --port 8000
