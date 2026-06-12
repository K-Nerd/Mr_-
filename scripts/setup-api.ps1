$ErrorActionPreference = "Stop"

. "$PSScriptRoot\python-common.ps1"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$python = Find-ProjectPython
& $python.Command @($python.Prefix) -m pip install -r "apps\api\rag_pipeline\requirements.txt" --cache-dir ".pip-cache"
