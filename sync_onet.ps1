param(
  [string]$OnetDataDir = "",
  [string]$DatabasePageUrl = "",
  [string]$ArchivePageUrl = "",
  [string]$DownloadUrl = "",
  [string]$ZipPath = "",
  [switch]$Force,
  [switch]$SkipRebuild,
  [string]$OutputPath = "",
  [string]$HistoryPath = "",
  [string]$BaselinePath = ""
)

$invokeArgs = @{}
if ($OnetDataDir) { $invokeArgs.OnetDataDir = $OnetDataDir }
if ($DatabasePageUrl) { $invokeArgs.DatabasePageUrl = $DatabasePageUrl }
if ($ArchivePageUrl) { $invokeArgs.ArchivePageUrl = $ArchivePageUrl }
if ($DownloadUrl) { $invokeArgs.DownloadUrl = $DownloadUrl }
if ($ZipPath) { $invokeArgs.ZipPath = $ZipPath }
if ($Force) { $invokeArgs.Force = $true }
if ($SkipRebuild) { $invokeArgs.SkipRebuild = $true }
if ($OutputPath) { $invokeArgs.OutputPath = $OutputPath }
if ($HistoryPath) { $invokeArgs.HistoryPath = $HistoryPath }
if ($BaselinePath) { $invokeArgs.BaselinePath = $BaselinePath }

& (Join-Path $PSScriptRoot "backend\onet_sync.ps1") @invokeArgs
