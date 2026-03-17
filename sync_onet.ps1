param(
  [string]$OnetDataDir = "",
  [switch]$Force,
  [switch]$SkipRebuild
)

$args = @(
  "-ExecutionPolicy", "Bypass",
  "-File", (Join-Path $PSScriptRoot "backend\onet_sync.ps1")
)

if ($OnetDataDir) { $args += @("-OnetDataDir", $OnetDataDir) }
if ($Force) { $args += "-Force:`$true" }
if ($SkipRebuild) { $args += "-SkipRebuild:`$true" }

& powershell @args
