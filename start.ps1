param(
  [int]$Port = 8080,
  [string]$DbConfigPath = "",
  [switch]$StrictDataMode
)

if ($DbConfigPath) {
  if ($StrictDataMode) {
    & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "backend\server.ps1") -Port $Port -DbConfigPath $DbConfigPath -StrictDataMode
  }
  else {
    & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "backend\server.ps1") -Port $Port -DbConfigPath $DbConfigPath
  }
}
else {
  if ($StrictDataMode) {
    & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "backend\server.ps1") -Port $Port -StrictDataMode
  }
  else {
    & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "backend\server.ps1") -Port $Port
  }
}
