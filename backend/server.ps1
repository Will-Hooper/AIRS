param(
  [int]$Port = 8080,
  [string]$DbConfigPath = "",
  [switch]$StrictDataMode
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Web
Add-Type -AssemblyName System.Data

$ProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$DataPath = Join-Path $PSScriptRoot "data\airs_data.json"
$DefaultDbConfigPath = Join-Path $PSScriptRoot "db.config.json"
$Dataset = Get-Content -Path $DataPath -Raw -Encoding UTF8 | ConvertFrom-Json
$Script:DbMetaCache = $null
$Script:DbConfig = $null

. (Join-Path $PSScriptRoot "db-layer.ps1")

function Get-JsonValue {
  param(
    $Object,
    [string]$Name
  )

  if ($null -eq $Object) { return $null }
  $prop = $Object.PSObject.Properties[$Name]
  if ($null -eq $prop) { return $null }
  return $prop.Value
}

function Merge-Occupation {
  param(
    [Parameter(Mandatory = $true)]$Occupation,
    [Parameter(Mandatory = $true)][string]$Region
  )

  $metrics = Get-JsonValue -Object $Occupation.regions -Name $Region
  if ($null -eq $metrics) {
    $metrics = $Occupation.regions.National
  }

  [pscustomobject]@{
    socCode = $Occupation.socCode
    title = $Occupation.title
    titleZh = $Occupation.titleZh
    majorGroup = $Occupation.majorGroup
    label = $Occupation.label
    summary = $Occupation.summary
    summaryZh = $Occupation.summaryZh
    monthlyAirs = $Occupation.monthlyAirs
    evidence = $Occupation.evidence
    evidenceZh = $Occupation.evidenceZh
    tasks = $Occupation.tasks
    regionMetrics = $Occupation.regions
    airs = $metrics.airs
    replacement = $metrics.replacement
    augmentation = $metrics.augmentation
    hiring = $metrics.hiring
    historical = $metrics.historical
    postings = $metrics.postings
  }
}

function Get-FilteredOccupations {
  param(
    [string]$Region = "National",
    [string]$MajorGroup = "all",
    [string]$Label = "all",
    [string]$Query = ""
  )

  $rows = foreach ($occupation in $Dataset.occupations) {
    Merge-Occupation -Occupation $occupation -Region $Region
  }

  if ($MajorGroup -and $MajorGroup -ne "all") {
    $rows = $rows | Where-Object { $_.majorGroup -eq $MajorGroup }
  }
  if ($Label -and $Label -ne "all") {
    $rows = $rows | Where-Object { $_.label -eq $Label }
  }
  if ($Query) {
    $q = $Query.ToLowerInvariant()
    $rows = $rows | Where-Object {
      $_.title.ToLowerInvariant().Contains($q) -or
      ((Or-Default $_.titleZh "").ToLowerInvariant().Contains($q)) -or
      $_.socCode.ToLowerInvariant().Contains($q)
    }
  }

  return @($rows)
}

function Get-MockMeta {
  return [pscustomobject]@{
    dates = @($Dataset.dates)
    regions = @($Dataset.regions)
    labels = @($Dataset.labels)
  }
}

function Get-MockSummaryPayload {
  param(
    [string]$Date = "",
    [string]$Region = "National",
    [string]$MajorGroup = "all",
    [string]$Label = "all",
    [string]$Query = ""
  )

  $meta = Get-MockMeta
  $resolvedDate = Resolve-Date -RequestedDate $Date -AvailableDates $meta.dates -FallbackDate ""
  $rows = Get-FilteredOccupations -Region $Region -MajorGroup $MajorGroup -Label $Label -Query $Query

  return [pscustomobject]@{
    updatedAt = "2026-03-08T10:30:00+08:00"
    date = $resolvedDate
    avgAirs = (Or-Default (($rows | Measure-Object -Property airs -Average).Average) 0)
    highRiskCount = @($rows | Where-Object { $_.label -eq "high_risk" }).Count
    occupationCount = @($rows).Count
  }
}

function Get-MockOccupationsPayload {
  param(
    [string]$Date = "",
    [string]$Region = "National",
    [string]$MajorGroup = "all",
    [string]$Label = "all",
    [string]$Query = ""
  )

  $meta = Get-MockMeta
  $resolvedDate = Resolve-Date -RequestedDate $Date -AvailableDates $meta.dates -FallbackDate ""

  return [pscustomobject]@{
    updatedAt = "2026-03-08T10:30:00+08:00"
    date = $resolvedDate
    dates = $meta.dates
    regions = $meta.regions
    labels = $meta.labels
    occupations = Get-FilteredOccupations -Region $Region -MajorGroup $MajorGroup -Label $Label -Query $Query
  }
}

function Get-MockDetailPayload {
  param(
    [string]$SocCode,
    [string]$Date = "",
    [string]$Region = "National"
  )

  $meta = Get-MockMeta
  $resolvedDate = Resolve-Date -RequestedDate $Date -AvailableDates $meta.dates -FallbackDate ""
  $match = $Dataset.occupations | Where-Object { $_.socCode -eq $SocCode } | Select-Object -First 1
  if ($null -eq $match) {
    return $null
  }

  return [pscustomobject]@{
    updatedAt = "2026-03-08T10:30:00+08:00"
    date = $resolvedDate
    dates = $meta.dates
    regions = $meta.regions
    occupation = Merge-Occupation -Occupation $match -Region $Region
  }
}

function Write-JsonResponse {
  param(
    [Parameter(Mandatory = $true)]$Response,
    [Parameter(Mandatory = $true)]$Payload,
    [int]$StatusCode = 200
  )

  $json = $Payload | ConvertTo-Json -Depth 20 -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $Response.StatusCode = $StatusCode
  $Response.ContentType = "application/json; charset=utf-8"
  $Response.ContentLength64 = $bytes.Length
  $Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $Response.OutputStream.Close()
}

function Write-StaticResponse {
  param(
    [Parameter(Mandatory = $true)]$Context
  )

  $relativePath = $Context.Request.Url.AbsolutePath.TrimStart("/")
  if ([string]::IsNullOrWhiteSpace($relativePath)) {
    $relativePath = "home.html"
  }
  if ($relativePath -eq "index.html") {
    $relativePath = "home.html"
  }

  $relativePath = $relativePath -replace "/", "\"
  $candidate = [System.IO.Path]::GetFullPath((Join-Path $ProjectRoot $relativePath))

  if (-not $candidate.StartsWith($ProjectRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    Write-JsonResponse -Response $Context.Response -Payload @{ error = "invalid path" } -StatusCode 400
    return
  }

  if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
    Write-JsonResponse -Response $Context.Response -Payload @{ error = "not found" } -StatusCode 404
    return
  }

  $extension = [System.IO.Path]::GetExtension($candidate).ToLowerInvariant()
  $mimeMap = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".svg"  = "image/svg+xml"
  }
  $mime = if ($mimeMap.ContainsKey($extension)) { $mimeMap[$extension] } else { "application/octet-stream" }
  $bytes = [System.IO.File]::ReadAllBytes($candidate)
  $Context.Response.StatusCode = 200
  $Context.Response.ContentType = $mime
  $Context.Response.ContentLength64 = $bytes.Length
  $Context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $Context.Response.OutputStream.Close()
}

function Get-Query {
  param([Parameter(Mandatory = $true)]$Request)
  if ($null -eq $Request -or $null -eq $Request.Url) {
    return @{}
  }
  $result = [System.Web.HttpUtility]::ParseQueryString($Request.Url.Query)
  if ($null -eq $result) { return @{} }
  return $result
}

function Or-Default {
  param(
    $Value,
    $Fallback
  )

  if ($null -eq $Value -or $Value -eq "") {
    return $Fallback
  }

  return $Value
}

function Resolve-StrictDataMode {
  param(
    [bool]$ExplicitSwitchPresent = $false,
    [bool]$ExplicitSwitchValue = $false,
    [bool]$Default = $false
  )

  if ($ExplicitSwitchPresent) {
    return $ExplicitSwitchValue
  }

  $raw = Or-Default $env:AIRS_STRICT_DATA_MODE ""
  if ($raw -eq "") { return $Default }
  switch -Regex ($raw.ToString().Trim().ToLowerInvariant()) {
    "^(1|true|yes|on)$" { return $true }
    "^(0|false|no|off)$" { return $false }
    default { return $Default }
  }
}

function Write-DataUnavailableResponse {
  param(
    [Parameter(Mandatory = $true)]$Response,
    [string]$Message = "live data unavailable"
  )

  Write-JsonResponse -Response $Response -Payload @{
    error = $Message
    strictDataMode = $true
    useMockFallback = $false
  } -StatusCode 503
}

function Set-PayloadMeta {
  param(
    [Parameter(Mandatory = $true)]$Payload,
    [Parameter(Mandatory = $true)][string]$Mode,
    [Parameter(Mandatory = $true)][string]$Source
  )

  if ($null -eq $Payload) { return $null }
  $Payload | Add-Member -NotePropertyName mode -NotePropertyValue $Mode -Force
  $Payload | Add-Member -NotePropertyName source -NotePropertyValue $Source -Force
  return $Payload
}

$Script:DbConfig = Get-DbConfig -ExplicitPath $DbConfigPath
$Script:StrictDataMode = Resolve-StrictDataMode -ExplicitSwitchPresent $PSBoundParameters.ContainsKey("StrictDataMode") -ExplicitSwitchValue $StrictDataMode.IsPresent
if ($null -ne $Script:DbConfig) {
  $configSource = Or-Default $Script:DbConfig.configPath "environment variables"
  Write-Host "AIRS database mode enabled using $($Script:DbConfig.provider). Source: $configSource"
}
else {
  if ($Script:StrictDataMode) {
    Write-Host "AIRS database mode is not configured. Strict data mode is enabled; API routes will return 503."
  }
  else {
    Write-Host "AIRS database mode is not configured. API routes will use mock data."
  }
}

$listener = $null
try {
  $listener = [System.Net.HttpListener]::new()
}
catch [System.PlatformNotSupportedException] {
  throw "The current PowerShell/.NET runtime does not support System.Net.HttpListener. Use a native Windows environment that supports HttpListener for local preview, or deploy behind IIS/Nginx instead of running backend/server.ps1 directly."
}
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()

Write-Host "AIRS server running at http://localhost:$Port"

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $path = $request.Url.AbsolutePath
    $query = Get-Query -Request $request
    if ($null -eq $query) { $query = @{} }
    $date = Or-Default $query["date"] ""
    $region = Or-Default $query["region"] "National"
    $majorGroup = Or-Default $query["majorGroup"] "all"
    $label = Or-Default $query["label"] "all"
    $search = Or-Default $query["q"] ""

    if ($path -eq "/api/airs/summary") {
      $payload = Try-RunDb {
        Get-DbSummaryPayload -Date $date -Region $region -MajorGroup $majorGroup -Label $label -Query $search
      }
      if ($null -eq $payload) {
        if ($Script:StrictDataMode) {
          Write-DataUnavailableResponse -Response $context.Response -Message "live summary data unavailable"
          continue
        }
        $payload = Get-MockSummaryPayload -Date $date -Region $region -MajorGroup $majorGroup -Label $label -Query $search
        $payload = Set-PayloadMeta -Payload $payload -Mode "mock" -Source "mock"
      }
      else {
        $payload = Set-PayloadMeta -Payload $payload -Mode "api" -Source "database"
      }
      Write-JsonResponse -Response $context.Response -Payload $payload
      continue
    }

    if ($path -eq "/api/airs/occupations") {
      $payload = Try-RunDb {
        Get-DbOccupationsPayload -Date $date -Region $region -MajorGroup $majorGroup -Label $label -Query $search
      }
      if ($null -eq $payload) {
        if ($Script:StrictDataMode) {
          Write-DataUnavailableResponse -Response $context.Response -Message "live occupations data unavailable"
          continue
        }
        $payload = Get-MockOccupationsPayload -Date $date -Region $region -MajorGroup $majorGroup -Label $label -Query $search
        $payload = Set-PayloadMeta -Payload $payload -Mode "mock" -Source "mock"
      }
      else {
        $payload = Set-PayloadMeta -Payload $payload -Mode "api" -Source "database"
      }
      Write-JsonResponse -Response $context.Response -Payload $payload
      continue
    }

    if ($path -like "/api/airs/*") {
      $socCode = $path.Substring("/api/airs/".Length)
      $payload = Try-RunDb {
        Get-DbDetailPayload -SocCode $socCode -Date $date -Region $region
      }
      if ($null -eq $payload) {
        if ($Script:StrictDataMode) {
          Write-DataUnavailableResponse -Response $context.Response -Message "live occupation detail unavailable"
          continue
        }
        $payload = Get-MockDetailPayload -SocCode $socCode -Date $date -Region $region
        if ($null -ne $payload) {
          $payload = Set-PayloadMeta -Payload $payload -Mode "mock" -Source "mock"
        }
      }
      else {
        $payload = Set-PayloadMeta -Payload $payload -Mode "api" -Source "database"
      }
      if ($null -eq $payload) {
        Write-JsonResponse -Response $context.Response -Payload @{ error = "soc not found" } -StatusCode 404
        continue
      }
      Write-JsonResponse -Response $context.Response -Payload $payload
      continue
    }

    Write-StaticResponse -Context $context
  }
}
finally {
  $listener.Stop()
  $listener.Close()
}
