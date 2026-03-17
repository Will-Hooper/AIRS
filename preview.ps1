param(
  [int]$Port = 8090,
  [int]$MaxPortFallbacks = 20
)

& powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "backend\preview_server.ps1") -Port $Port -MaxPortFallbacks $MaxPortFallbacks
