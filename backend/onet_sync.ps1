param(
  [string]$OnetDataDir = "",
  [string]$DatabasePageUrl = "https://www.onetcenter.org/database.html",
  [string]$ArchivePageUrl = "https://www.onetcenter.org/db_releases.html",
  [string]$DownloadUrl = "",
  [string]$ZipPath = "",
  [switch]$Force,
  [switch]$SkipRebuild,
  [string]$OutputPath = "",
  [string]$HistoryPath = "",
  [string]$BaselinePath = ""
)

$NodeEntry = Join-Path (Split-Path -Parent $PSScriptRoot) "dist-node\src-node\onet-sync.js"
$NodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($null -ne $NodeCommand -and (Test-Path -LiteralPath $NodeEntry -PathType Leaf)) {
  $nodeArgs = @($NodeEntry)
  if ($OnetDataDir) { $nodeArgs += @("--onetDataDir", $OnetDataDir) }
  if ($DatabasePageUrl) { $nodeArgs += @("--databasePageUrl", $DatabasePageUrl) }
  if ($ArchivePageUrl) { $nodeArgs += @("--archivePageUrl", $ArchivePageUrl) }
  if ($DownloadUrl) { $nodeArgs += @("--downloadUrl", $DownloadUrl) }
  if ($ZipPath) { $nodeArgs += @("--zipPath", $ZipPath) }
  if ($Force) { $nodeArgs += "--force" }
  if ($SkipRebuild) { $nodeArgs += "--skipRebuild" }
  if ($OutputPath) { $nodeArgs += @("--outputPath", $OutputPath) }
  if ($HistoryPath) { $nodeArgs += @("--historyPath", $HistoryPath) }
  if ($BaselinePath) { $nodeArgs += @("--baselinePath", $BaselinePath) }

  & $NodeCommand.Source @nodeArgs
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
  return
}

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
[Net.ServicePointManager]::Expect100Continue = $false

$ScriptRoot = Split-Path -Parent $PSCommandPath
$DataDir = Join-Path $ScriptRoot "data"
if (-not $OnetDataDir) { $OnetDataDir = Join-Path $DataDir "onet" }
$CacheDir = Join-Path $OnetDataDir ".cache"
$StageDir = Join-Path $CacheDir "stage"
$MetaPath = Join-Path $OnetDataDir "sync_meta.json"
$UsajobsSyncPath = Join-Path $ScriptRoot "usajobs_sync.ps1"

$RequiredFiles = @(
  "Occupation Data.txt",
  "Task Statements.txt",
  "Task Ratings.txt"
)

$OptionalFiles = @(
  "Technology Skills.txt",
  "Job Zones.txt",
  "Sample of Reported Titles.txt"
)

function Ensure-Directory {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
}

function Read-JsonFile {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
  return Get-Content -Path $Path -Raw -Encoding UTF8 | ConvertFrom-Json
}

function Write-JsonFile {
  param(
    [string]$Path,
    $Value
  )

  $dir = Split-Path -Parent $Path
  Ensure-Directory -Path $dir
  $json = $Value | ConvertTo-Json -Depth 10
  Set-Content -Path $Path -Value $json -Encoding UTF8
}

function Get-LatestZipReference {
  param([string]$Html)

  if (-not $Html) { return $null }
  $matches = [regex]::Matches($Html, 'db_(\d+)_(\d+)_text\.zip', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if ($matches.Count -eq 0) { return $null }

  $best = $null
  $bestMajor = -1
  $bestMinor = -1
  foreach ($match in $matches) {
    $major = [int]$match.Groups[1].Value
    $minor = [int]$match.Groups[2].Value
    if ($major -gt $bestMajor -or ($major -eq $bestMajor -and $minor -gt $bestMinor)) {
      $best = $match.Value
      $bestMajor = $major
      $bestMinor = $minor
    }
  }

  if (-not $best) { return $null }
  return [pscustomobject]@{
    fileName = $best
    version = "$bestMajor.$bestMinor"
    url = "https://www.onetcenter.org/dl_files/database/$best"
  }
}

function Resolve-OnetDownload {
  param(
    [string]$DatabasePageUrl,
    [string]$ArchivePageUrl,
    [string]$OverrideUrl = ""
  )

  if ($OverrideUrl) {
    $name = Split-Path -Leaf $OverrideUrl
    $ref = Get-LatestZipReference -Html $name
    if ($null -ne $ref) {
      $ref.url = $OverrideUrl
      return $ref
    }
    return [pscustomobject]@{
      fileName = $name
      version = "custom"
      url = $OverrideUrl
    }
  }

  $pages = @($DatabasePageUrl, $ArchivePageUrl)
  foreach ($pageUrl in $pages) {
    try {
      $response = Invoke-WebRequest -Uri $pageUrl -UseBasicParsing -TimeoutSec 60
      $ref = Get-LatestZipReference -Html ([string]$response.Content)
      if ($null -ne $ref) {
        return $ref
      }
    }
    catch {
      continue
    }
  }

  throw "Could not discover the latest O*NET text zip from official pages."
}

function Copy-SelectedFiles {
  param(
    [string]$SourceDir,
    [string]$TargetDir,
    [string[]]$Required,
    [string[]]$Optional
  )

  function Resolve-SourceFile {
    param(
      [string]$Root,
      [string]$Name
    )

    $direct = Join-Path $Root $Name
    if (Test-Path -LiteralPath $direct -PathType Leaf) {
      return $direct
    }

    $match = Get-ChildItem -Path $Root -Recurse -File -Filter $Name | Select-Object -First 1
    if ($null -ne $match) {
      return $match.FullName
    }

    return ""
  }

  foreach ($name in $Required) {
    $source = Resolve-SourceFile -Root $SourceDir -Name $name
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
      throw "Missing required O*NET file in extracted archive: $name"
    }
  }

  Ensure-Directory -Path $TargetDir
  $copied = @()
  foreach ($name in @($Required + $Optional)) {
    $source = Resolve-SourceFile -Root $SourceDir -Name $name
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { continue }
    Copy-Item -Path $source -Destination (Join-Path $TargetDir $name) -Force
    $copied += $name
  }
  return @($copied | Sort-Object -Unique)
}

Ensure-Directory -Path $OnetDataDir
Ensure-Directory -Path $CacheDir

$resolved = if ($ZipPath) {
  [pscustomobject]@{
    fileName = Split-Path -Leaf $ZipPath
    version = "local"
    url = ""
  }
}
else {
  Resolve-OnetDownload -DatabasePageUrl $DatabasePageUrl -ArchivePageUrl $ArchivePageUrl -OverrideUrl $DownloadUrl
}

$existingMeta = Read-JsonFile -Path $MetaPath
$currentVersion = if ($null -ne $existingMeta) { [string]$existingMeta.version } else { "" }

$zipFilePath = if ($ZipPath) {
  $ZipPath
}
else {
  Join-Path $CacheDir $resolved.fileName
}

if (-not $ZipPath) {
  $needsDownload = $Force -or -not (Test-Path -LiteralPath $zipFilePath -PathType Leaf) -or ($resolved.version -ne $currentVersion)
  if ($needsDownload) {
    Invoke-WebRequest -Uri $resolved.url -OutFile $zipFilePath -UseBasicParsing -TimeoutSec 300
  }
}

if (-not (Test-Path -LiteralPath $zipFilePath -PathType Leaf)) {
  throw "O*NET zip not found: $zipFilePath"
}

if (Test-Path -LiteralPath $StageDir) {
  Remove-Item -LiteralPath $StageDir -Recurse -Force
}
Ensure-Directory -Path $StageDir

Expand-Archive -LiteralPath $zipFilePath -DestinationPath $StageDir -Force
$copiedFiles = Copy-SelectedFiles -SourceDir $StageDir -TargetDir $OnetDataDir -Required $RequiredFiles -Optional $OptionalFiles

$meta = [pscustomobject]@{
  version = $resolved.version
  sourceUrl = $resolved.url
  zipFile = $zipFilePath
  syncedAt = (Get-Date).ToString("s")
  files = $copiedFiles
}
Write-JsonFile -Path $MetaPath -Value $meta

if (-not $SkipRebuild) {
  $invokeArgs = @{
    UseExistingHistoryOnly = $true
    OnetDataDir = $OnetDataDir
  }
  if ($OutputPath) { $invokeArgs.OutputPath = $OutputPath }
  if ($HistoryPath) { $invokeArgs.HistoryPath = $HistoryPath }
  if ($BaselinePath) { $invokeArgs.BaselinePath = $BaselinePath }

  & $UsajobsSyncPath @invokeArgs
}

Write-Host "O*NET sync complete. Version: $($resolved.version). Files: $($copiedFiles.Count). Directory: $OnetDataDir"
