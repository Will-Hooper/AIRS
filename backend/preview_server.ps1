param(
  [int]$Port = 8090,
  [int]$MaxPortFallbacks = 20
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Web

$ProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$DataPath = Join-Path $PSScriptRoot "data\airs_data.json"
$Dataset = Get-Content -Path $DataPath -Raw -Encoding UTF8 | ConvertFrom-Json
$PreviewUpdatedAt = if ($Dataset.dates.Count -gt 0) { "$($Dataset.dates[-1])T12:00:00-05:00" } else { "2026-03-15T12:00:00-05:00" }

function Or-Default {
  param($Value, $Fallback)
  if ($null -eq $Value) { return $Fallback }
  if ($Value -is [string] -and [string]::IsNullOrWhiteSpace($Value)) { return $Fallback }
  return $Value
}

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

function Resolve-Date {
  param(
    [string]$RequestedDate,
    [object[]]$AvailableDates
  )

  if ($RequestedDate -and $AvailableDates -contains $RequestedDate) {
    return $RequestedDate
  }
  if ($AvailableDates.Count -gt 0) {
    return $AvailableDates[$AvailableDates.Count - 1]
  }
  return ""
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

function Get-PreviewSummaryPayload {
  param(
    [string]$Date = "",
    [string]$Region = "National",
    [string]$MajorGroup = "all",
    [string]$Label = "all",
    [string]$Query = ""
  )

  $resolvedDate = Resolve-Date -RequestedDate $Date -AvailableDates @($Dataset.dates)
  $rows = Get-FilteredOccupations -Region $Region -MajorGroup $MajorGroup -Label $Label -Query $Query

  [pscustomobject]@{
    mode = "mock"
    source = "mock"
    updatedAt = $PreviewUpdatedAt
    date = $resolvedDate
    avgAirs = (Or-Default (($rows | Measure-Object -Property airs -Average).Average) 0)
    highRiskCount = @($rows | Where-Object { $_.label -eq "high_risk" }).Count
    occupationCount = @($rows).Count
  }
}

function Get-PreviewOccupationsPayload {
  param(
    [string]$Date = "",
    [string]$Region = "National",
    [string]$MajorGroup = "all",
    [string]$Label = "all",
    [string]$Query = ""
  )

  $resolvedDate = Resolve-Date -RequestedDate $Date -AvailableDates @($Dataset.dates)

  [pscustomobject]@{
    mode = "mock"
    source = "mock"
    updatedAt = $PreviewUpdatedAt
    date = $resolvedDate
    dates = @($Dataset.dates)
    regions = @($Dataset.regions)
    labels = @($Dataset.labels)
    groups = @($Dataset.groups)
    occupations = Get-FilteredOccupations -Region $Region -MajorGroup $MajorGroup -Label $Label -Query $Query
  }
}

function Get-PreviewDetailPayload {
  param(
    [string]$SocCode,
    [string]$Date = "",
    [string]$Region = "National"
  )

  $resolvedDate = Resolve-Date -RequestedDate $Date -AvailableDates @($Dataset.dates)
  $match = $Dataset.occupations | Where-Object { $_.socCode -eq $SocCode } | Select-Object -First 1
  if ($null -eq $match) { return $null }

  [pscustomobject]@{
    mode = "mock"
    source = "mock"
    updatedAt = $PreviewUpdatedAt
    date = $resolvedDate
    dates = @($Dataset.dates)
    regions = @($Dataset.regions)
    occupation = Merge-Occupation -Occupation $match -Region $Region
  }
}

function Get-ContentType {
  param([string]$Path)

  switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    ".html" { return "text/html; charset=utf-8" }
    ".css" { return "text/css; charset=utf-8" }
    ".js" { return "application/javascript; charset=utf-8" }
    ".json" { return "application/json; charset=utf-8" }
    ".svg" { return "image/svg+xml" }
    ".png" { return "image/png" }
    ".jpg" { return "image/jpeg" }
    ".jpeg" { return "image/jpeg" }
    ".ico" { return "image/x-icon" }
    ".woff" { return "font/woff" }
    ".woff2" { return "font/woff2" }
    default { return "application/octet-stream" }
  }
}

function Write-BytesResponse {
  param(
    [Parameter(Mandatory = $true)][System.Net.Sockets.NetworkStream]$Stream,
    [int]$StatusCode = 200,
    [string]$Reason = "OK",
    [string]$ContentType = "text/plain; charset=utf-8",
    [byte[]]$Body = @(),
    [hashtable]$Headers = @{}
  )

  $writer = New-Object System.IO.StreamWriter($Stream, [System.Text.Encoding]::ASCII, 1024, $true)
  $writer.NewLine = "`r`n"
  $writer.WriteLine("HTTP/1.1 $StatusCode $Reason")
  $writer.WriteLine("Date: $([DateTime]::UtcNow.ToString('R'))")
  $writer.WriteLine("Server: AIRS-Preview")
  $writer.WriteLine("Connection: close")
  $writer.WriteLine("Content-Type: $ContentType")
  $writer.WriteLine("Content-Length: $($Body.Length)")
  foreach ($key in $Headers.Keys) {
    $writer.WriteLine("${key}: $($Headers[$key])")
  }
  $writer.WriteLine("")
  $writer.Flush()
  if ($Body.Length -gt 0) {
    $Stream.Write($Body, 0, $Body.Length)
    $Stream.Flush()
  }
}

function Write-JsonResponse {
  param(
    [Parameter(Mandatory = $true)][System.Net.Sockets.NetworkStream]$Stream,
    [Parameter(Mandatory = $true)]$Payload,
    [int]$StatusCode = 200,
    [string]$Reason = "OK"
  )

  $json = $Payload | ConvertTo-Json -Depth 20 -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  Write-BytesResponse -Stream $Stream -StatusCode $StatusCode -Reason $Reason -ContentType "application/json; charset=utf-8" -Body $bytes
}

function Get-PreviewHtml {
  param([string]$FilePath)

  $html = Get-Content -Path $FilePath -Raw -Encoding UTF8
  $html = [regex]::Replace($html, '(<meta\s+name="airs-environment"\s+content=")[^"]*(")', '$1preview$2', 'IgnoreCase')
  $html = [regex]::Replace($html, '(<meta\s+name="airs-strict-data-mode"\s+content=")[^"]*(")', '$1false$2', 'IgnoreCase')
  return [System.Text.Encoding]::UTF8.GetBytes($html)
}

function Get-StaticFileResponse {
  param([string]$RequestPath)

  $relative = $RequestPath.TrimStart("/")
  if ([string]::IsNullOrWhiteSpace($relative)) {
    $relative = "home.html"
  }

  $candidate = [System.IO.Path]::GetFullPath((Join-Path $ProjectRoot $relative))
  if (-not $candidate.StartsWith($ProjectRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $null
  }
  if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
    return $null
  }

  $bytes = if ([System.IO.Path]::GetExtension($candidate).ToLowerInvariant() -eq ".html") {
    Get-PreviewHtml -FilePath $candidate
  }
  else {
    [System.IO.File]::ReadAllBytes($candidate)
  }

  return [pscustomobject]@{
    contentType = Get-ContentType -Path $candidate
    body = $bytes
  }
}

function Get-QueryValue {
  param(
    [System.Collections.Specialized.NameValueCollection]$Query,
    [string]$Name,
    [string]$Fallback = ""
  )

  return Or-Default $Query[$Name] $Fallback
}

function Start-PreviewListener {
  param(
    [int]$PreferredPort,
    [int]$FallbackCount
  )

  for ($offset = 0; $offset -le $FallbackCount; $offset++) {
    $candidatePort = $PreferredPort + $offset
    $candidate = $null
    try {
      $candidate = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $candidatePort)
      $candidate.Start()
      return [pscustomobject]@{
        Listener = $candidate
        Port = $candidatePort
        RequestedPort = $PreferredPort
      }
    }
    catch [System.Net.Sockets.SocketException] {
      if ($null -ne $candidate) {
        try { $candidate.Stop() } catch {}
      }
      if ($offset -eq $FallbackCount) {
        throw "Unable to bind preview server starting from port $PreferredPort. Tried $($FallbackCount + 1) port(s)."
      }
    }
  }
}

$listenerState = Start-PreviewListener -PreferredPort $Port -FallbackCount $MaxPortFallbacks
$listener = $listenerState.Listener
$activePort = $listenerState.Port
if ($activePort -ne $Port) {
  Write-Host "Port $Port is already in use. Preview server switched to http://localhost:$activePort"
}
Write-Host "AIRS preview server running at http://localhost:$activePort"
Write-Host "Preview mode: environment=preview, strictDataMode=false, data source=mock"

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 8192, $true)
      $requestLine = $reader.ReadLine()
      if ([string]::IsNullOrWhiteSpace($requestLine)) {
        continue
      }

      while ($true) {
        $headerLine = $reader.ReadLine()
        if ([string]::IsNullOrEmpty($headerLine)) { break }
      }

      $parts = $requestLine.Split(" ")
      if ($parts.Length -lt 2) {
        Write-BytesResponse -Stream $stream -StatusCode 400 -Reason "Bad Request" -Body ([System.Text.Encoding]::UTF8.GetBytes("Bad Request"))
        continue
      }

      $method = $parts[0].ToUpperInvariant()
      $target = $parts[1]
      if ($method -ne "GET") {
        Write-BytesResponse -Stream $stream -StatusCode 405 -Reason "Method Not Allowed" -Body ([System.Text.Encoding]::UTF8.GetBytes("Method Not Allowed"))
        continue
      }

      $uri = [System.Uri]("http://localhost:$target")
      $path = $uri.AbsolutePath
      $query = [System.Web.HttpUtility]::ParseQueryString($uri.Query)

      if ($path -eq "/") {
        Write-BytesResponse -Stream $stream -StatusCode 302 -Reason "Found" -Headers @{ Location = "/home.html" }
        continue
      }

      if ($path -eq "/api/airs/summary") {
        $payload = Get-PreviewSummaryPayload `
          -Date (Get-QueryValue -Query $query -Name "date") `
          -Region (Get-QueryValue -Query $query -Name "region" -Fallback "National") `
          -MajorGroup (Get-QueryValue -Query $query -Name "majorGroup" -Fallback "all") `
          -Label (Get-QueryValue -Query $query -Name "label" -Fallback "all") `
          -Query (Get-QueryValue -Query $query -Name "q")
        Write-JsonResponse -Stream $stream -Payload $payload
        continue
      }

      if ($path -eq "/api/airs/occupations") {
        $payload = Get-PreviewOccupationsPayload `
          -Date (Get-QueryValue -Query $query -Name "date") `
          -Region (Get-QueryValue -Query $query -Name "region" -Fallback "National") `
          -MajorGroup (Get-QueryValue -Query $query -Name "majorGroup" -Fallback "all") `
          -Label (Get-QueryValue -Query $query -Name "label" -Fallback "all") `
          -Query (Get-QueryValue -Query $query -Name "q")
        Write-JsonResponse -Stream $stream -Payload $payload
        continue
      }

      if ($path -match '^/api/airs/([^/]+)$') {
        $socCode = [System.Web.HttpUtility]::UrlDecode($Matches[1])
        $payload = Get-PreviewDetailPayload `
          -SocCode $socCode `
          -Date (Get-QueryValue -Query $query -Name "date") `
          -Region (Get-QueryValue -Query $query -Name "region" -Fallback "National")

        if ($null -eq $payload) {
          Write-JsonResponse -Stream $stream -StatusCode 404 -Reason "Not Found" -Payload @{ error = "soc not found" }
        }
        else {
          Write-JsonResponse -Stream $stream -Payload $payload
        }
        continue
      }

      $static = Get-StaticFileResponse -RequestPath $path
      if ($null -eq $static) {
        Write-BytesResponse -Stream $stream -StatusCode 404 -Reason "Not Found" -Body ([System.Text.Encoding]::UTF8.GetBytes("Not Found"))
        continue
      }

      Write-BytesResponse -Stream $stream -ContentType $static.contentType -Body $static.body
    }
    catch {
      try {
        if ($null -ne $stream) {
          Write-BytesResponse -Stream $stream -StatusCode 500 -Reason "Server Error" -Body ([System.Text.Encoding]::UTF8.GetBytes($_.Exception.Message))
        }
      }
      catch {}
    }
    finally {
      if ($null -ne $reader) { $reader.Dispose() }
      if ($null -ne $stream) { $stream.Dispose() }
      $client.Close()
    }
  }
}
finally {
  $listener.Stop()
}
