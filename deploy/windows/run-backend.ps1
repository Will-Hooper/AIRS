param(
  [int]$Port = 8080,
  [string]$DbConfigPath = "",
  [switch]$StrictDataMode = $true
)

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $scriptRoot "..\.."))
$startScript = Join-Path $projectRoot "start.ps1"

$arguments = @(
  "-NoLogo",
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", $startScript,
  "-Port", $Port
)

if ($DbConfigPath) {
  $arguments += @("-DbConfigPath", $DbConfigPath)
}

if ($StrictDataMode) {
  $arguments += "-StrictDataMode"
}

& powershell.exe @arguments
