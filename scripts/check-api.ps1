$ErrorActionPreference = "Stop"

. "$PSScriptRoot\python-common.ps1"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$python = Find-ProjectPython
& $python.Command @($python.Prefix) -m compileall "apps\api\rag_pipeline"
