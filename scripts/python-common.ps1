function Find-ProjectPython {
  $candidates = @()

  if ($env:PYTHON) {
    $candidates += @{ Command = $env:PYTHON; Prefix = @() }
  }

  $candidates += @{ Command = "python"; Prefix = @() }
  $candidates += @{ Command = "py"; Prefix = @("-3") }

  $codexPython = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
  if (Test-Path $codexPython) {
    $candidates += @{ Command = $codexPython; Prefix = @() }
  }

  foreach ($candidate in $candidates) {
    try {
      & $candidate.Command @($candidate.Prefix) --version *> $null
      if ($LASTEXITCODE -eq 0) {
        return $candidate
      }
    } catch {
      continue
    }
  }

  throw "Python was not found. Install Python 3.11+ or set the PYTHON environment variable."
}
