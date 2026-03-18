param(
  [string]$ApiKey = "",
  [string]$UserEmail = "",
  [int]$DatePosted = 1,
  [int]$ResultsPerPage = 500,
  [int]$MaxPages = 20,
  [int]$RetryCount = 3,
  [int]$RetryDelaySeconds = 2,
  [int]$TimeoutSeconds = 30,
  [string]$Region = "National",
  [string]$OutputPath = "",
  [string]$HistoryPath = "",
  [string]$BaselinePath = "",
  [string]$OnetDataDir = "",
  [switch]$UseExistingHistoryOnly
)

$NodeEntry = Join-Path (Split-Path -Parent $PSScriptRoot) "dist-node\src-node\usajobs-sync.js"
$NodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($null -ne $NodeCommand -and (Test-Path -LiteralPath $NodeEntry -PathType Leaf)) {
  $nodeArgs = @($NodeEntry)
  if ($ApiKey) { $nodeArgs += @("--apiKey", $ApiKey) }
  if ($UserEmail) { $nodeArgs += @("--userEmail", $UserEmail) }
  if ($DatePosted) { $nodeArgs += @("--datePosted", "$DatePosted") }
  if ($ResultsPerPage) { $nodeArgs += @("--resultsPerPage", "$ResultsPerPage") }
  if ($MaxPages) { $nodeArgs += @("--maxPages", "$MaxPages") }
  if ($RetryCount) { $nodeArgs += @("--retryCount", "$RetryCount") }
  if ($RetryDelaySeconds) { $nodeArgs += @("--retryDelaySeconds", "$RetryDelaySeconds") }
  if ($TimeoutSeconds) { $nodeArgs += @("--timeoutSeconds", "$TimeoutSeconds") }
  if ($Region) { $nodeArgs += @("--region", $Region) }
  if ($OutputPath) { $nodeArgs += @("--outputPath", $OutputPath) }
  if ($HistoryPath) { $nodeArgs += @("--historyPath", $HistoryPath) }
  if ($BaselinePath) { $nodeArgs += @("--baselinePath", $BaselinePath) }
  if ($OnetDataDir) { $nodeArgs += @("--onetDataDir", $OnetDataDir) }
  if ($UseExistingHistoryOnly) { $nodeArgs += "--useExistingHistoryOnly" }

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
if (-not $OutputPath) { $OutputPath = Join-Path $DataDir "airs_data.json" }
if (-not $HistoryPath) { $HistoryPath = Join-Path $DataDir "usajobs_history.json" }
if (-not $BaselinePath) { $BaselinePath = Join-Path $DataDir "airs_baseline.json" }
if (-not $OnetDataDir) { $OnetDataDir = Join-Path $DataDir "onet" }
$MapPath = Join-Path $DataDir "usajobs_soc_map.json"

function Normalize-SecretValue {
  param([string]$Value)

  if ($null -eq $Value) { return "" }

  $text = [string]$Value
  $text = ($text -replace "[\r\n\t]", "").Trim()

  if ($text.Length -ge 2) {
    $first = $text[0]
    $last = $text[$text.Length - 1]
    if (($first -eq '"' -and $last -eq '"') -or ($first -eq "'" -and $last -eq "'")) {
      $text = $text.Substring(1, $text.Length - 2).Trim()
    }
  }

  return $text
}

if (-not $ApiKey) { $ApiKey = $env:USAJOBS_API_KEY }
if (-not $UserEmail) { $UserEmail = $env:USAJOBS_USER_EMAIL }
$ApiKey = Normalize-SecretValue -Value $ApiKey
$UserEmail = Normalize-SecretValue -Value $UserEmail

if ((-not $UseExistingHistoryOnly) -and (-not $ApiKey -or -not $UserEmail)) {
  throw "Missing USAJOBS credentials. Set -ApiKey/-UserEmail or env USAJOBS_API_KEY/USAJOBS_USER_EMAIL."
}

if ($ResultsPerPage -gt 500) { $ResultsPerPage = 500 }
if ($ResultsPerPage -lt 1) { $ResultsPerPage = 25 }

$Headers = @{
  "User-Agent" = $UserEmail
  "Authorization-Key" = $ApiKey
}

function Read-JsonFile {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
  return Get-Content -Path $Path -Raw -Encoding UTF8 | ConvertFrom-Json
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

function Write-JsonFile {
  param(
    [string]$Path,
    $Value
  )
  $json = $Value | ConvertTo-Json -Depth 20
  $dir = Split-Path -Parent $Path
  if (-not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
  }
  Set-Content -Path $Path -Value $json -Encoding UTF8
}

function Write-Step {
  param([string]$Message)
  $timestamp = (Get-Date).ToString("HH:mm:ss")
  Write-Host "[$timestamp] $Message"
}

function New-DefaultSocMap {
  return [pscustomobject]@{
    socMajorGroups = @(
      "Management",
      "Business and Financial Operations",
      "Computer and Mathematical",
      "Architecture and Engineering",
      "Life, Physical, and Social Science",
      "Community and Social Service",
      "Legal",
      "Educational Instruction and Library",
      "Arts, Design, Entertainment, Sports, and Media",
      "Healthcare Practitioners and Technical",
      "Healthcare Support",
      "Protective Service",
      "Food Preparation and Serving Related",
      "Building and Grounds Cleaning and Maintenance",
      "Personal Care and Service",
      "Sales and Related",
      "Office and Administrative Support",
      "Farming, Fishing, and Forestry",
      "Construction and Extraction",
      "Installation, Maintenance, and Repair",
      "Production",
      "Transportation and Material Moving",
      "Military Specific Occupations",
      "Other"
    )
    byCategoryName = @{}
    byNameContains = @()
  }
}

function New-DefaultBaseline {
  return [pscustomobject]@{
    defaults = @{
      summary = "Auto-calculated from USAJOBS history using the AIRS heuristic formula."
    }
    codes = @{}
  }
}

function Get-LabelFromAirs {
  param([double]$Airs)
  if ($Airs -ge 85) { return "stable" }
  if ($Airs -ge 70) { return "light" }
  if ($Airs -ge 50) { return "augmenting" }
  if ($Airs -ge 30) { return "restructuring" }
  return "high_risk"
}

function Clamp-Unit {
  param([double]$Value)
  if ($Value -lt 0) { return 0.0 }
  if ($Value -gt 1) { return 1.0 }
  return [double]$Value
}

function Clamp-Range {
  param(
    [double]$Value,
    [double]$Min = 0.0,
    [double]$Max = 100.0
  )
  if ($Value -lt $Min) { return $Min }
  if ($Value -gt $Max) { return $Max }
  return [double]$Value
}

function Get-NumericJsonValue {
  param(
    $Object,
    [string]$Name,
    [double]$Default = 0.0
  )
  $value = Get-JsonValue -Object $Object -Name $Name
  if ($null -eq $value -or $value -eq "") { return $Default }
  return [double]$value
}

function Get-SafeAverage {
  param([double[]]$Values)
  if ($null -eq $Values -or $Values.Count -eq 0) { return 0.0 }
  return (($Values | Measure-Object -Average).Average)
}

function Get-EmpiricalPercentile {
  param(
    [double]$Value,
    [double[]]$Population
  )
  if ($null -eq $Population -or $Population.Count -le 1) { return 0.5 }
  $sorted = @($Population | Sort-Object)
  $leCount = @($sorted | Where-Object { $_ -le $Value }).Count
  if ($sorted.Count -le 1) { return 0.5 }
  return Clamp-Unit (($leCount - 1) / [double]($sorted.Count - 1))
}

function Normalize-Text {
  param([string]$Value)
  if (-not $Value) { return "" }
  return (($Value.ToLowerInvariant() -replace "[^a-z0-9\-/ ]", " ") -replace "\s+", " ").Trim()
}

function Test-TextTerm {
  param(
    [string]$Text,
    [string]$Term
  )

  if (-not $Text -or -not $Term) { return $false }

  $pattern = [Regex]::Escape($Term).Replace("\ ", "\s+")
  return [Regex]::IsMatch($Text, "(?<![a-z0-9])$pattern(?![a-z0-9])")
}

function Test-TextTerms {
  param(
    [string]$Text,
    [string[]]$Terms
  )

  foreach ($term in @($Terms)) {
    if (Test-TextTerm -Text $Text -Term $term) {
      return $true
    }
  }

  return $false
}

function Read-TabFile {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    return @()
  }

  try {
    return @(Import-Csv -Path $Path -Delimiter "`t")
  }
  catch {
    $raw = Get-Content -Path $Path -Raw -Encoding UTF8
    if (-not $raw) { return @() }
    return @($raw | ConvertFrom-Csv -Delimiter "`t")
  }
}

function Get-RowValue {
  param(
    $Row,
    [string[]]$Names,
    [string]$Default = ""
  )

  if ($null -eq $Row) { return $Default }

  foreach ($name in $Names) {
    $prop = $Row.PSObject.Properties | Where-Object { $_.Name -eq $name } | Select-Object -First 1
    if ($null -ne $prop) {
      $value = [string]$prop.Value
      if ($value -and $value.Trim() -ne "") {
        return $value.Trim()
      }
    }
  }

  return $Default
}

function Convert-ToDoubleSafe {
  param(
    [string]$Value,
    [double]$Default = 0.0
  )

  if (-not $Value) { return $Default }
  $parsed = 0.0
  if ([double]::TryParse($Value, [ref]$parsed)) {
    return [double]$parsed
  }
  return $Default
}

function Convert-ToIntSafe {
  param(
    [string]$Value,
    [int]$Default = 0
  )

  if (-not $Value) { return $Default }
  $parsed = 0
  if ([int]::TryParse($Value, [ref]$parsed)) {
    return [int]$parsed
  }
  return $Default
}

function Normalize-TitleKey {
  param([string]$Value)

  $text = Normalize-Text -Value $Value
  if (-not $text) { return "" }

  $text = ($text -replace "\b(and|for|the|of|to|a|an)\b", " ")
  return (($text -replace "\s+", " ").Trim())
}

function Normalize-Token {
  param([string]$Token)

  if (-not $Token) { return "" }
  $value = $Token.Trim()
  if ($value.Length -gt 4 -and $value.EndsWith("ies")) {
    return ($value.Substring(0, $value.Length - 3) + "y")
  }
  if ($value.Length -gt 3 -and $value.EndsWith("es")) {
    return $value.Substring(0, $value.Length - 2)
  }
  if ($value.Length -gt 3 -and $value.EndsWith("s")) {
    return $value.Substring(0, $value.Length - 1)
  }
  return $value
}

function Get-TextTokens {
  param([string]$Value)

  $normalized = Normalize-TitleKey -Value $Value
  if (-not $normalized) { return @() }
  return @($normalized -split " " | ForEach-Object { Normalize-Token -Token $_ } | Where-Object { $_ -and $_.Length -ge 3 })
}

function Get-TokenSimilarity {
  param(
    [string[]]$Left,
    [string[]]$Right
  )

  $a = @($Left | Sort-Object -Unique)
  $b = @($Right | Sort-Object -Unique)
  if ($a.Count -eq 0 -or $b.Count -eq 0) { return 0.0 }

  $intersection = @($a | Where-Object { $b -contains $_ }).Count
  $union = @($a + $b | Sort-Object -Unique).Count
  if ($union -eq 0) { return 0.0 }
  return ($intersection / [double]$union)
}

function New-EmptyOnetData {
  return [pscustomobject]@{
    available = $false
    sourceDir = ""
    occupations = @{}
    titleIndex = @{}
    titleCandidates = @()
    manualMap = @{}
  }
}

function Add-OnetTitleCandidate {
  param(
    $OnetData,
    [string]$Code,
    [string]$Title,
    [string]$Source = "occupation"
  )

  if (-not $Code -or -not $Title) { return }

  $normalized = Normalize-TitleKey -Value $Title
  if (-not $normalized) { return }

  $candidate = [pscustomobject]@{
    code = $Code
    title = $Title
    normalizedTitle = $normalized
    tokens = @(Get-TextTokens -Value $Title)
    source = $Source
  }

  $OnetData.titleCandidates += $candidate
  if (-not $OnetData.titleIndex.ContainsKey($normalized)) {
    $OnetData.titleIndex[$normalized] = @()
  }
  $OnetData.titleIndex[$normalized] += $candidate
}

function Load-OnetData {
  param([string]$Dir)

  $onet = New-EmptyOnetData
  $onet.sourceDir = $Dir

  if (-not (Test-Path -LiteralPath $Dir -PathType Container)) {
    return $onet
  }

  Write-Step "Loading O*NET occupation data from $Dir"
  $occupationRows = @(Read-TabFile -Path (Join-Path $Dir "Occupation Data.txt"))
  if ($occupationRows.Count -eq 0) {
    return $onet
  }

  Write-Step "Loading O*NET task statements"
  $taskRows = @(Read-TabFile -Path (Join-Path $Dir "Task Statements.txt"))
  Write-Step "Loading O*NET task ratings"
  $taskRatingRows = @(Read-TabFile -Path (Join-Path $Dir "Task Ratings.txt"))
  Write-Step "Loading O*NET technology skills"
  $technologyRows = @(Read-TabFile -Path (Join-Path $Dir "Technology Skills.txt"))
  Write-Step "Loading O*NET job zones"
  $jobZoneRows = @(Read-TabFile -Path (Join-Path $Dir "Job Zones.txt"))
  Write-Step "Loading O*NET sample titles"
  $sampleTitleRows = @(Read-TabFile -Path (Join-Path $Dir "Sample of Reported Titles.txt"))
  $manualMap = Read-JsonFile -Path (Join-Path $Dir "series_to_onet.json")

  if ($null -ne $manualMap) {
    foreach ($prop in $manualMap.PSObject.Properties) {
      $onet.manualMap[$prop.Name] = [string]$prop.Value
    }
  }

  $jobZonesByCode = @{}
  foreach ($row in @($jobZoneRows)) {
    $code = Get-RowValue -Row $row -Names @("O*NET-SOC Code", "O*NET-SOC Code ")
    if (-not $code) { continue }
    $zone = Convert-ToIntSafe -Value (Get-RowValue -Row $row -Names @("Job Zone", "Job Zone ") -Default "0") -Default 0
    $jobZonesByCode[$code] = $zone
  }

  $taskRatingsByKey = @{}
  foreach ($row in @($taskRatingRows)) {
    $code = Get-RowValue -Row $row -Names @("O*NET-SOC Code", "O*NET-SOC Code ")
    $taskId = Get-RowValue -Row $row -Names @("Task ID", "Task ID ")
    $scaleId = Get-RowValue -Row $row -Names @("Scale ID", "Scale ID ")
    if (-not $code -or -not $taskId -or -not $scaleId) { continue }
    $key = "$code|$taskId"
    if (-not $taskRatingsByKey.ContainsKey($key)) {
      $taskRatingsByKey[$key] = @{}
    }
    $taskRatingsByKey[$key][$scaleId] = Convert-ToDoubleSafe -Value (Get-RowValue -Row $row -Names @("Data Value", "Data Value ") -Default "0") -Default 0.0
  }

  $tasksByCode = @{}
  foreach ($row in @($taskRows)) {
    $code = Get-RowValue -Row $row -Names @("O*NET-SOC Code", "O*NET-SOC Code ")
    $taskId = Get-RowValue -Row $row -Names @("Task ID", "Task ID ")
    $taskText = Get-RowValue -Row $row -Names @("Task", "Task ")
    if (-not $code -or -not $taskText) { continue }

    $ratingKey = "$code|$taskId"
    $ratings = if ($taskRatingsByKey.ContainsKey($ratingKey)) { $taskRatingsByKey[$ratingKey] } else { @{} }
    $importance = if ($ratings.ContainsKey("IM")) { [double]$ratings["IM"] } else { 50.0 }
    $relevance = if ($ratings.ContainsKey("RT")) { [double]$ratings["RT"] } else { 50.0 }

    if (-not $tasksByCode.ContainsKey($code)) {
      $tasksByCode[$code] = @()
    }
    $tasksByCode[$code] += [pscustomobject]@{
      id = $taskId
      text = $taskText
      importance = $importance
      relevance = $relevance
    }
  }

  $technologyByCode = @{}
  foreach ($row in @($technologyRows)) {
    $code = Get-RowValue -Row $row -Names @("O*NET-SOC Code", "O*NET-SOC Code ")
    if (-not $code) { continue }

    if (-not $technologyByCode.ContainsKey($code)) {
      $technologyByCode[$code] = @()
    }

    $hot = (Get-RowValue -Row $row -Names @("Hot Technology", "Hot Technology ") -Default "") -match "^(Y|Yes|1|True)$"
    $inDemand = (Get-RowValue -Row $row -Names @("In Demand", "In Demand ") -Default "") -match "^(Y|Yes|1|True)$"
    $technologyByCode[$code] += [pscustomobject]@{
      title = Get-RowValue -Row $row -Names @("Commodity Title", "Example", "Technology Skill", "Technology Skill ")
      hot = $hot
      inDemand = $inDemand
    }
  }

  foreach ($row in @($occupationRows)) {
    $code = Get-RowValue -Row $row -Names @("O*NET-SOC Code", "O*NET-SOC Code ")
    $title = Get-RowValue -Row $row -Names @("Title", "Title ")
    if (-not $code -or -not $title) { continue }

    $onetOccupation = [pscustomobject]@{
      code = $code
      title = $title
      tasks = if ($tasksByCode.ContainsKey($code)) { @($tasksByCode[$code]) } else { @() }
      technologySkills = if ($technologyByCode.ContainsKey($code)) { @($technologyByCode[$code]) } else { @() }
      jobZone = if ($jobZonesByCode.ContainsKey($code)) { [int]$jobZonesByCode[$code] } else { 0 }
    }

    $onet.occupations[$code] = $onetOccupation
    Add-OnetTitleCandidate -OnetData $onet -Code $code -Title $title -Source "occupation"
  }

  foreach ($row in @($sampleTitleRows)) {
    $code = Get-RowValue -Row $row -Names @("O*NET-SOC Code", "O*NET-SOC Code ")
    $title = Get-RowValue -Row $row -Names @("Reported Job Title", "Title", "Title ")
    if (-not $code -or -not $title) { continue }
    if (-not $onet.occupations.ContainsKey($code)) { continue }
    Add-OnetTitleCandidate -OnetData $onet -Code $code -Title $title -Source "sample"
  }

  $onet.available = ($onet.occupations.Count -gt 0 -and $onet.titleCandidates.Count -gt 0)
  if ($onet.available) {
    Write-Step "O*NET ready: $($onet.occupations.Count) occupations, $($onet.titleCandidates.Count) title candidates"
  }
  return $onet
}

function Get-OnetDirectOccupation {
  param(
    $OnetData,
    [string]$Code
  )

  if ($null -eq $OnetData -or -not $OnetData.available -or -not $Code) {
    return $null
  }

  if ($OnetData.occupations.ContainsKey($Code)) {
    return [pscustomobject]@{
      occupation = $OnetData.occupations[$Code]
      score = 1.0
      source = "manual"
      matchedTitle = $OnetData.occupations[$Code].title
    }
  }

  return $null
}

function Find-OnetOccupation {
  param(
    $OnetData,
    [string]$Title,
    [string]$PreferredCode = ""
  )

  if ($null -eq $OnetData -or -not $OnetData.available) {
    return $null
  }

  $direct = Get-OnetDirectOccupation -OnetData $OnetData -Code $PreferredCode
  if ($null -ne $direct) {
    return $direct
  }

  $normalized = Normalize-TitleKey -Value $Title
  if (-not $normalized) { return $null }
  $tokens = @(Get-TextTokens -Value $Title)

  if ($OnetData.manualMap.ContainsKey($normalized)) {
    $mapped = Get-OnetDirectOccupation -OnetData $OnetData -Code ([string]$OnetData.manualMap[$normalized])
    if ($null -ne $mapped) {
      $mapped.source = "manual_map"
      return $mapped
    }
  }

  if ($OnetData.titleIndex.ContainsKey($normalized)) {
    $exact = @($OnetData.titleIndex[$normalized] | Sort-Object { if ($_.source -eq "occupation") { 0 } else { 1 } } | Select-Object -First 1)
    if ($exact.Count -gt 0 -and $OnetData.occupations.ContainsKey($exact[0].code)) {
      return [pscustomobject]@{
        occupation = $OnetData.occupations[$exact[0].code]
        score = 1.0
        source = [string]$exact[0].source
        matchedTitle = [string]$exact[0].title
      }
    }
  }

  $best = $null
  $bestScore = 0.0
  foreach ($candidate in @($OnetData.titleCandidates)) {
    $score = Get-TokenSimilarity -Left $tokens -Right $candidate.tokens
    if ($candidate.normalizedTitle -eq $normalized) {
      $score = [Math]::Max($score, 1.0)
    }
    elseif ($candidate.normalizedTitle.Contains($normalized) -or $normalized.Contains($candidate.normalizedTitle)) {
      $score += 0.15
    }
    if ($candidate.source -eq "occupation") {
      $score += 0.03
    }

    if ($score -gt $bestScore) {
      $bestScore = $score
      $best = $candidate
    }
  }

  if ($null -eq $best -or $bestScore -lt 0.52) {
    return $null
  }

  return [pscustomobject]@{
    occupation = $OnetData.occupations[$best.code]
    score = [Math]::Round($bestScore, 3)
    source = [string]$best.source
    matchedTitle = [string]$best.title
  }
}

function Get-KeywordSignal {
  param(
    [string]$Text,
    [string[]]$Patterns,
    [int]$Saturation = 3
  )

  if (-not $Text -or $null -eq $Patterns -or $Patterns.Count -eq 0) {
    return 0.0
  }

  $hits = 0
  foreach ($pattern in $Patterns) {
    if ($Text.Contains($pattern)) {
      $hits += 1
    }
  }

  return Clamp-Unit ($hits / [double][Math]::Max(1, $Saturation))
}

function Get-GroupProfile {
  param([string]$MajorGroup)

  switch ($MajorGroup) {
    "Management" { return @{ replacement = 0.38; augmentation = 0.62; historical = 0.58; human = 0.55 } }
    "Business and Financial Operations" { return @{ replacement = 0.62; augmentation = 0.56; historical = 0.68; human = 0.40 } }
    "Computer and Mathematical" { return @{ replacement = 0.46; augmentation = 0.82; historical = 0.76; human = 0.30 } }
    "Architecture and Engineering" { return @{ replacement = 0.38; augmentation = 0.71; historical = 0.64; human = 0.55 } }
    "Life, Physical, and Social Science" { return @{ replacement = 0.41; augmentation = 0.69; historical = 0.66; human = 0.50 } }
    "Community and Social Service" { return @{ replacement = 0.23; augmentation = 0.46; historical = 0.38; human = 0.78 } }
    "Legal" { return @{ replacement = 0.36; augmentation = 0.61; historical = 0.52; human = 0.72 } }
    "Educational Instruction and Library" { return @{ replacement = 0.31; augmentation = 0.53; historical = 0.46; human = 0.72 } }
    "Arts, Design, Entertainment, Sports, and Media" { return @{ replacement = 0.48; augmentation = 0.67; historical = 0.60; human = 0.45 } }
    "Healthcare Practitioners and Technical" { return @{ replacement = 0.20; augmentation = 0.47; historical = 0.36; human = 0.88 } }
    "Healthcare Support" { return @{ replacement = 0.24; augmentation = 0.40; historical = 0.32; human = 0.84 } }
    "Protective Service" { return @{ replacement = 0.16; augmentation = 0.34; historical = 0.28; human = 0.90 } }
    "Food Preparation and Serving Related" { return @{ replacement = 0.44; augmentation = 0.25; historical = 0.45; human = 0.58 } }
    "Building and Grounds Cleaning and Maintenance" { return @{ replacement = 0.46; augmentation = 0.22; historical = 0.43; human = 0.62 } }
    "Personal Care and Service" { return @{ replacement = 0.28; augmentation = 0.31; historical = 0.30; human = 0.82 } }
    "Sales and Related" { return @{ replacement = 0.58; augmentation = 0.49; historical = 0.61; human = 0.37 } }
    "Office and Administrative Support" { return @{ replacement = 0.74; augmentation = 0.51; historical = 0.72; human = 0.28 } }
    "Farming, Fishing, and Forestry" { return @{ replacement = 0.40; augmentation = 0.27; historical = 0.42; human = 0.67 } }
    "Construction and Extraction" { return @{ replacement = 0.22; augmentation = 0.29; historical = 0.25; human = 0.82 } }
    "Installation, Maintenance, and Repair" { return @{ replacement = 0.20; augmentation = 0.33; historical = 0.24; human = 0.84 } }
    "Production" { return @{ replacement = 0.52; augmentation = 0.31; historical = 0.56; human = 0.52 } }
    "Transportation and Material Moving" { return @{ replacement = 0.40; augmentation = 0.28; historical = 0.48; human = 0.65 } }
    "Military Specific Occupations" { return @{ replacement = 0.19; augmentation = 0.33; historical = 0.29; human = 0.90 } }
    default { return @{ replacement = 0.40; augmentation = 0.40; historical = 0.40; human = 0.50 } }
  }
}

function Get-AutomationSignals {
  param(
    [string]$Title,
    [string]$MajorGroup
  )

  $text = Normalize-Text -Value "$Title $MajorGroup"

  $automationSignal = Get-KeywordSignal -Text $text -Patterns @(
    "administrative","admin","assistant","office","clerical","records","document","support",
    "budget","account","claims","contract","procurement","compliance","analyst","writer",
    "editor","translator","customer service","human resources","supply","program"
  )
  $digitalSignal = Get-KeywordSignal -Text $text -Patterns @(
    "software","developer","programmer","data","cyber","information technology","systems",
    "network","cloud","ai","machine learning","statistic","mathematics","research",
    "scientist","intelligence","communications","public affairs","design"
  )
  $careSignal = Get-KeywordSignal -Text $text -Patterns @(
    "nurse","nursing","physician","doctor","surgeon","dentist","dental","medical","health","therapist",
    "counselor","social worker","social service","attorney","lawyer","judge","police",
    "firefighter","correctional","emergency","paramedic","ranger","teacher","instructor"
  )
  $fieldSignal = Get-KeywordSignal -Text $text -Patterns @(
    "mechanic","maintenance","repair","technician","construction","electric","plumb","welder",
    "machin","operator","pilot","driver","transport","equipment","installation","field",
    "forestry","agriculture","inspector"
  )
  $rewriteSignal = Get-KeywordSignal -Text $text -Patterns @(
    "analyst","research","communications","budget","account","contract","procurement",
    "teacher","instructional","designer","software","data","cyber","quality assurance"
  )

  return @{
    automation = $automationSignal
    digital = $digitalSignal
    care = $careSignal
    field = $fieldSignal
    rewrite = $rewriteSignal
  }
}

function Get-TitleMajorGroupHint {
  param([string]$Title)

  $text = Normalize-Text -Value $Title
  if (-not $text) { return "" }

  $exactTitleHints = @{
    "aviation safety" = "Transportation and Material Moving"
    "business and industry student trainee" = "Business and Financial Operations"
    "boiler plant operating" = "Production"
    "cash processing" = "Office and Administrative Support"
    "cemetery caretaking" = "Building and Grounds Cleaning and Maintenance"
    "compliance inspection and support" = "Protective Service"
    "consumer safety" = "Protective Service"
    "consumer safety inspection" = "Protective Service"
    "contact representative" = "Office and Administrative Support"
    "drill rig operating" = "Construction and Extraction"
    "electroplating" = "Production"
    "explosives safety series" = "Protective Service"
    "foreign affairs" = "Life, Physical, and Social Science"
    "fuel distribution system operating" = "Production"
    "gardening" = "Building and Grounds Cleaning and Maintenance"
    "general business and industry" = "Business and Financial Operations"
    "general inspection investigation enforcement and compliance series" = "Protective Service"
    "general inspection investigation enforcement and compliance" = "Protective Service"
    "general investigation" = "Protective Service"
    "general supply" = "Business and Financial Operations"
    "guide" = "Personal Care and Service"
    "industrial hygiene" = "Life, Physical, and Social Science"
    "intelligence" = "Life, Physical, and Social Science"
    "laboratory working" = "Life, Physical, and Social Science"
    "letterpress operating" = "Production"
    "mail and file" = "Office and Administrative Support"
    "marine survey technical" = "Architecture and Engineering"
    "materials examining and identifying" = "Production"
    "materials handler" = "Transportation and Material Moving"
    "meatcutting" = "Production"
    "miscellaneous aircraft overhaul" = "Installation, Maintenance, and Repair"
    "miscellaneous armament work" = "Production"
    "miscellaneous plant and animal work" = "Farming, Fishing, and Forestry"
    "miscellaneous warehousing and stock handling" = "Transportation and Material Moving"
    "model making" = "Production"
    "motor carrier safety" = "Protective Service"
    "non destructive testing" = "Production"
    "non-destructive testing" = "Production"
    "packing" = "Transportation and Material Moving"
    "passport and visa examining" = "Office and Administrative Support"
    "pest controlling" = "Building and Grounds Cleaning and Maintenance"
    "property disposal" = "Business and Financial Operations"
    "purchasing" = "Business and Financial Operations"
    "realty" = "Sales and Related"
    "rigging" = "Construction and Extraction"
    "secretary" = "Office and Administrative Support"
    "store working" = "Transportation and Material Moving"
    "tools and parts attending" = "Transportation and Material Moving"
    "tractor operating" = "Transportation and Material Moving"
  }
  $exactHint = $exactTitleHints[$text]
  if ($exactHint) { return $exactHint }

  if (Test-TextTerms -Text $text -Terms @(
    "dental", "nurse", "nursing", "medical", "health", "physician", "therapist",
    "optometrist", "orthotist", "prosthetist", "podiatrist", "pharmacist",
    "dietitian", "nutritionist", "pathology", "audiology", "radiologic",
    "laboratory science", "medical technician", "clinical laboratory"
  )) {
    return "Healthcare Practitioners and Technical"
  }
  if (Test-TextTerms -Text $text -Terms @(
    "social service", "social worker", "counselor", "counseling", "chaplain"
  )) {
    return "Community and Social Service"
  }
  if (Test-TextTerms -Text $text -Terms @(
    "police", "fire", "correction", "ranger", "security guard",
    "security administration", "border patrol", "criminal investigation",
    "investigative", "customs and border protection"
  )) {
    return "Protective Service"
  }
  if (Test-TextTerms -Text $text -Terms @(
    "teacher", "instructor", "library", "librarian", "education", "training", "instructional"
  )) {
    return "Educational Instruction and Library"
  }
  if (Test-TextTerms -Text $text -Terms @(
    "telecommunications", "telecommunications processing", "telephone operating",
    "security clerical and assistance"
  )) {
    return "Office and Administrative Support"
  }
  if (Test-TextTerms -Text $text -Terms @(
    "attorney", "lawyer", "judge", "legal", "paralegal"
  )) {
    return "Legal"
  }
  if (Test-TextTerms -Text $text -Terms @(
    "art", "artist", "arts", "design", "designer", "music", "musician",
    "museum", "curator", "public affairs", "government information",
    "visual information", "visual", "audiovisual", "audio visual", "video",
    "broadcast", "media", "editor", "editing", "writer", "writing",
    "photographer", "photography", "journal", "recreation", "sports",
    "athletic", "theater", "theatre", "illustrating", "illustration", "entertainment"
  )) {
    return "Arts, Design, Entertainment, Sports, and Media"
  }
  if (Test-TextTerms -Text $text -Terms @(
    "statistics", "statistical", "mathematical statistics", "data science"
  )) {
    return "Computer and Mathematical"
  }
  if (Test-TextTerms -Text $text -Terms @(
    "physics", "chemistry", "meteorology", "meteorological", "biology", "biological",
    "microbiology", "pharmacology", "entomology", "archeology", "archaeology",
    "geography", "psychology", "economist", "economics", "history", "social science"
  )) {
    return "Life, Physical, and Social Science"
  }
  if (Test-TextTerms -Text $text -Terms @(
    "food service", "food services", "cooking", "cook", "waiter", "bartending", "bartender"
  )) {
    return "Food Preparation and Serving Related"
  }
  if (Test-TextTerms -Text $text -Terms @(
    "transportation", "traffic", "dispatching", "motor vehicle", "ship pilot",
    "small craft", "air traffic control", "aircraft operation"
  )) {
    return "Transportation and Material Moving"
  }
  if (Test-TextTerms -Text $text -Terms @(
    "maintenance", "mechanic", "repair", "technician", "machining", "toolmaking",
    "calibrating", "instrument mechanic"
  )) {
    return "Installation, Maintenance, and Repair"
  }
  if (Test-TextTerms -Text $text -Terms @(
    "construction", "carpentry", "carpenter", "electrician", "plumbing", "plumber",
    "pipefitting", "masonry", "welding", "sheet metal", "painting"
  )) {
    return "Construction and Extraction"
  }
  if (Test-TextTerms -Text $text -Terms @(
    "engineer", "engineering", "architect", "electronics technical"
  )) {
    return "Architecture and Engineering"
  }
  if (Test-TextTerms -Text $text -Terms @(
    "software", "computer", "cyber", "data", "information technology", "it specialist"
  )) {
    return "Computer and Mathematical"
  }

  return ""
}

function Get-NormalizedMajorGroup {
  param(
    [string]$RawMajorGroup,
    [string]$Title
  )

  $known = @($script:socMap.socMajorGroups)
  $titleHint = Get-TitleMajorGroupHint -Title $Title
  $overrideableGroups = @(
    "Office and Administrative Support",
    "Business and Financial Operations",
    "Other",
    "Production",
    "Installation, Maintenance, and Repair",
    "Computer and Mathematical"
  )
  if ($RawMajorGroup -and $known -contains $RawMajorGroup) {
    if (
      $titleHint -and
      $titleHint -ne $RawMajorGroup -and
      $overrideableGroups -contains $RawMajorGroup
    ) {
      return $titleHint
    }
    return $RawMajorGroup
  }

  if ($RawMajorGroup) {
    $mapped = Resolve-MajorGroup -CategoryName $RawMajorGroup -FallbackName ""
    if ($mapped -and $known -contains $mapped) {
      if (
        $titleHint -and
        $titleHint -ne $mapped -and
        $overrideableGroups -contains $mapped
      ) {
        return $titleHint
      }
      return $mapped
    }
  }

  if ($titleHint) {
    return $titleHint
  }

  if ($Title) {
    $mapped = Resolve-MajorGroup -CategoryName $Title -FallbackName "Other"
    if ($mapped) { return $mapped }
  }

  return "Other"
}

function Get-ReplacementScore {
  param(
    [string]$Title,
    [string]$MajorGroup
  )

  $profile = Get-GroupProfile -MajorGroup $MajorGroup
  $signals = Get-AutomationSignals -Title $Title -MajorGroup $MajorGroup
  return Clamp-Unit (
    [double]$profile.replacement +
    (0.18 * [double]$signals.automation) +
    (0.06 * [double]$signals.digital) -
    (0.20 * [double]$signals.care) -
    (0.14 * [double]$signals.field)
  )
}

function Get-AugmentationScore {
  param(
    [string]$Title,
    [string]$MajorGroup
  )

  $profile = Get-GroupProfile -MajorGroup $MajorGroup
  $signals = Get-AutomationSignals -Title $Title -MajorGroup $MajorGroup
  return Clamp-Unit (
    [double]$profile.augmentation +
    (0.22 * [double]$signals.digital) +
    (0.08 * [double]$signals.automation) +
    (0.10 * [double]$signals.rewrite) -
    (0.12 * [double]$signals.field)
  )
}

function Get-HumanCriticality {
  param(
    [string]$Title,
    [string]$MajorGroup
  )

  $profile = Get-GroupProfile -MajorGroup $MajorGroup
  $signals = Get-AutomationSignals -Title $Title -MajorGroup $MajorGroup
  return Clamp-Unit (
    [double]$profile.human +
    (0.24 * [double]$signals.care) +
    (0.12 * [double]$signals.field) -
    (0.14 * [double]$signals.automation)
  )
}

function Get-HistoricalScore {
  param(
    [string]$Title,
    [string]$MajorGroup
  )

  $profile = Get-GroupProfile -MajorGroup $MajorGroup
  $signals = Get-AutomationSignals -Title $Title -MajorGroup $MajorGroup
  $exposure = Clamp-Unit (
    [double]$profile.historical +
    (0.16 * [double]$signals.automation) +
    (0.18 * [double]$signals.digital) -
    (0.12 * [double]$signals.care) -
    (0.08 * [double]$signals.field)
  )
  return Clamp-Unit (1 - [Math]::Exp(-1.8 * $exposure))
}

function Get-HeuristicProfile {
  param(
    [string]$Title,
    [string]$MajorGroup
  )

  return [pscustomobject]@{
    replacement = Get-ReplacementScore -Title $Title -MajorGroup $MajorGroup
    augmentation = Get-AugmentationScore -Title $Title -MajorGroup $MajorGroup
    human = Get-HumanCriticality -Title $Title -MajorGroup $MajorGroup
    historical = Get-HistoricalScore -Title $Title -MajorGroup $MajorGroup
    source = "heuristic"
    taskCount = 0
    techCount = 0
    onetCode = ""
    onetTitle = ""
    matchScore = 0.0
    matchSource = ""
  }
}

function Get-TaskProfile {
  param([string]$TaskText)

  $text = Normalize-Text -Value $TaskText
  $automation = Get-KeywordSignal -Text $text -Patterns @(
    "record","records","document","documentation","report","reports","compile","prepare",
    "verify","process","review","schedule","track","monitor","calculate","classify",
    "code","program","analyze","analysis","respond","summarize","draft","audit"
  ) -Saturation 4
  $digital = Get-KeywordSignal -Text $text -Patterns @(
    "software","system","systems","database","data","statistical","model","models",
    "design","research","develop","testing","network","information","cyber","code"
  ) -Saturation 4
  $care = Get-KeywordSignal -Text $text -Patterns @(
    "patient","patients","client","clients","care","treat","therapy","counsel",
    "diagnose","interview","negotiate","litigate","teach","train","protect","supervise"
  ) -Saturation 4
  $field = Get-KeywordSignal -Text $text -Patterns @(
    "repair","install","inspect","maintain","operate","equipment","machinery",
    "construction","field","travel","lift","weld","drive","respond","fire","patrol"
  ) -Saturation 4

  return [pscustomobject]@{
    replacement = Clamp-Unit(0.08 + (0.72 * $automation) + (0.12 * $digital) - (0.42 * $care) - (0.28 * $field))
    augmentation = Clamp-Unit(0.12 + (0.48 * $digital) + (0.22 * $automation) - (0.16 * $field) - (0.08 * $care))
    human = Clamp-Unit(0.10 + (0.72 * $care) + (0.38 * $field) - (0.18 * $automation))
  }
}

function Get-OnetTechnologySignal {
  param($TechnologySkills)

  $skills = @($TechnologySkills)
  if ($skills.Count -eq 0) { return 0.0 }

  $hot = @($skills | Where-Object { $_.hot }).Count
  $inDemand = @($skills | Where-Object { $_.inDemand }).Count
  $density = (($hot * 1.0) + ($inDemand * 0.7) + ($skills.Count * 0.25)) / 8.0
  return Clamp-Unit $density
}

function Get-OnetProfile {
  param(
    [string]$Title,
    [string]$MajorGroup,
    $OnetMatch
  )

  $heuristic = Get-HeuristicProfile -Title $Title -MajorGroup $MajorGroup
  if ($null -eq $OnetMatch -or $null -eq $OnetMatch.occupation) {
    return $heuristic
  }

  $occupation = $OnetMatch.occupation
  $tasks = @($occupation.tasks)
  $techSignal = Get-OnetTechnologySignal -TechnologySkills $occupation.technologySkills
  $taskCount = $tasks.Count
  $taskCoverage = Clamp-Unit ($taskCount / 10.0)

  if ($taskCount -eq 0) {
    $partialExposure = Clamp-Unit ((0.55 * $heuristic.replacement) + (0.20 * $heuristic.augmentation) + (0.25 * $techSignal))
    return [pscustomobject]@{
      replacement = $heuristic.replacement
      augmentation = Clamp-Unit((0.75 * $heuristic.augmentation) + (0.25 * $techSignal))
      human = Clamp-Unit((0.85 * $heuristic.human) + (0.15 * ($occupation.jobZone / 5.0)))
      historical = Clamp-Unit(1 - [Math]::Exp(-1.8 * $partialExposure))
      source = "onet_partial"
      taskCount = 0
      techCount = @($occupation.technologySkills).Count
      onetCode = [string]$occupation.code
      onetTitle = [string]$occupation.title
      matchScore = [double]$OnetMatch.score
      matchSource = [string]$OnetMatch.source
    }
  }

  $weightedReplacement = 0.0
  $weightedAugmentation = 0.0
  $weightedHuman = 0.0
  $weightTotal = 0.0
  foreach ($task in $tasks) {
    $signals = Get-TaskProfile -TaskText ([string]$task.text)
    $weight = [Math]::Max(1.0, ([double]$task.importance * [double]$task.relevance))
    $weightTotal += $weight
    $weightedReplacement += ($weight * [double]$signals.replacement)
    $weightedAugmentation += ($weight * [double]$signals.augmentation)
    $weightedHuman += ($weight * [double]$signals.human)
  }

  if ($weightTotal -le 0) {
    return $heuristic
  }

  $taskReplacement = $weightedReplacement / $weightTotal
  $taskAugmentation = $weightedAugmentation / $weightTotal
  $taskHuman = $weightedHuman / $weightTotal
  $jobZoneSignal = Clamp-Unit (($occupation.jobZone - 1) / 4.0)

  $replacement = Clamp-Unit(($taskCoverage * $taskReplacement) + ((1 - $taskCoverage) * $heuristic.replacement))
  $augmentation = Clamp-Unit(($taskCoverage * ((0.75 * $taskAugmentation) + (0.25 * $techSignal))) + ((1 - $taskCoverage) * $heuristic.augmentation))
  $human = Clamp-Unit(($taskCoverage * ((0.75 * $taskHuman) + (0.25 * $jobZoneSignal))) + ((1 - $taskCoverage) * $heuristic.human))
  $exposure = Clamp-Unit((0.58 * $replacement) + (0.22 * $augmentation) + (0.20 * $techSignal) - (0.15 * $human))
  $historical = Clamp-Unit(1 - [Math]::Exp(-1.8 * $exposure))

  return [pscustomobject]@{
    replacement = $replacement
    augmentation = $augmentation
    human = $human
    historical = $historical
    source = "onet"
    taskCount = $taskCount
    techCount = @($occupation.technologySkills).Count
    onetCode = [string]$occupation.code
    onetTitle = [string]$occupation.title
    matchScore = [double]$OnetMatch.score
    matchSource = [string]$OnetMatch.source
  }
}

function Get-TrendWeakness {
  param([double[]]$Counts)
  if ($null -eq $Counts -or $Counts.Count -le 1) { return 0.5 }

  $latest = [double]$Counts[-1]
  $previous = @($Counts[0..($Counts.Count - 2)] | Select-Object -Last 7 | ForEach-Object { [double]$_ })
  $previousAverage = Get-SafeAverage -Values $previous
  if ($previousAverage -le 0) {
    if ($latest -le 0) { return 0.5 }
    return 0.25
  }

  $delta = ($latest - $previousAverage) / [Math]::Max($previousAverage, 1.0)
  return Clamp-Unit (1 / (1 + [Math]::Exp(4 * $delta)))
}

function Get-HiringRealizationScore {
  param(
    [double[]]$Counts,
    [double]$Augmentation,
    [double[]]$GroupPopulation,
    [double[]]$GlobalPopulation
  )

  $latest = if ($null -eq $Counts -or $Counts.Count -eq 0) { 0.0 } else { [double]$Counts[-1] }
  $logCount = [Math]::Log(1 + [Math]::Max(0.0, $latest))
  $groupPercentile = Get-EmpiricalPercentile -Value $logCount -Population $GroupPopulation
  $globalPercentile = Get-EmpiricalPercentile -Value $logCount -Population $GlobalPopulation
  $activeDemand = Clamp-Unit ((0.7 * $groupPercentile) + (0.3 * $globalPercentile))
  $demandWeakness = Clamp-Unit (1 - $activeDemand)
  $trendWeakness = Get-TrendWeakness -Counts $Counts
  $substitutionSignal = Clamp-Unit ((0.65 * $demandWeakness) + (0.35 * $trendWeakness))
  $rewriteSignal = Clamp-Unit ($Augmentation * (0.55 + (0.45 * $activeDemand)))

  return @{
    score = Clamp-Unit ((0.6 * $substitutionSignal) + (0.4 * $rewriteSignal))
    activeDemand = $activeDemand
    demandWeakness = $demandWeakness
    trendWeakness = $trendWeakness
    substitutionSignal = $substitutionSignal
    rewriteSignal = $rewriteSignal
  }
}

function Get-ImpactScore {
  param(
    [double]$Replacement,
    [double]$Augmentation,
    [double]$HiringRealization,
    [double]$HistoricalAI,
    [double]$HumanCriticality
  )

  $impact = Clamp-Unit (
    (0.50 * $Replacement) +
    (0.20 * $Augmentation) +
    (0.20 * $HiringRealization) +
    (0.10 * $HistoricalAI)
  )

  if ($HumanCriticality -gt 0.7) {
    $impact = [Math]::Min($impact, 0.85)
  }

  return Clamp-Unit $impact
}

function Get-AirsSummary {
  param(
    [string]$MajorGroup,
    [double]$Replacement,
    [double]$Augmentation,
    [double]$Hiring,
    [double]$Historical,
    [double]$ActiveDemand
  )

  $pairs = @(
    [pscustomobject]@{ key = "replacement"; zh = "replacement pressure"; en = "replacement pressure"; value = $Replacement },
    [pscustomobject]@{ key = "augmentation"; zh = "job redesign"; en = "job redesign"; value = $Augmentation },
    [pscustomobject]@{ key = "hiring"; zh = "hiring realization"; en = "hiring realization"; value = $Hiring },
    [pscustomobject]@{ key = "historical"; zh = "historical exposure"; en = "historical exposure"; value = $Historical }
  ) | Sort-Object value -Descending

  $driver = $pairs[0]
  if ($ActiveDemand -ge 0.67) {
    $demandZh = "still active"
    $demandEn = "still active"
  }
  elseif ($ActiveDemand -le 0.33) {
    $demandZh = "already weak"
    $demandEn = "already weak"
  }
  else {
    $demandZh = "in a middle range"
    $demandEn = "in a middle range"
  }

  return @{
    zh = "This occupation is currently driven most by $($driver.zh); hiring versus peer roles is $demandZh."
    en = "This occupation is currently driven most by $($driver.en); hiring versus peer roles is $demandEn."
  }
}




function Build-MonthlyAirs {
  param(
    [double[]]$Counts,
    [double]$Replacement,
    [double]$Augmentation,
    [double]$Historical,
    [double]$HumanCriticality,
    [double[]]$GroupPopulation,
    [double[]]$GlobalPopulation
  )

  if ($null -eq $Counts -or $Counts.Count -eq 0) { return @() }

  [double[]]$window = if ($Counts.Count -gt 12) {
    @($Counts[($Counts.Count - 12)..($Counts.Count - 1)] | ForEach-Object { [double]$_ })
  }
  else {
    @($Counts | ForEach-Object { [double]$_ })
  }
  $series = @()
  for ($i = 0; $i -lt $window.Count; $i += 1) {
    $prefix = @($window[0..$i] | ForEach-Object { [double]$_ })
    $hiringState = Get-HiringRealizationScore -Counts $prefix -Augmentation $Augmentation -GroupPopulation $GroupPopulation -GlobalPopulation $GlobalPopulation
    $impact = Get-ImpactScore -Replacement $Replacement -Augmentation $Augmentation -HiringRealization ([double]$hiringState.score) -HistoricalAI $Historical -HumanCriticality $HumanCriticality
    $series += [Math]::Round((100 * (1 - $impact)), 1)
  }

  if ($series.Count -lt 12) {
    $fill = if ($series.Count -gt 0) { $series[0] } else { 100.0 }
    $padding = @()
    for ($i = $series.Count; $i -lt 12; $i += 1) {
      $padding += $fill
    }
    $series = @($padding + $series)
  }

  return @($series)
}

function Resolve-MajorGroup {
  param(
    [string]$CategoryName,
    [string]$FallbackName = ""
  )

  if (-not $CategoryName) {
    if ($FallbackName) { return $FallbackName }
    return "Other"
  }

  $byCategoryName = Get-JsonValue -Object $script:socMap -Name "byCategoryName"
  $exact = Get-JsonValue -Object $byCategoryName -Name $CategoryName
  if ($null -ne $exact -and $exact -ne "") {
    return $exact
  }

  $needle = $CategoryName.ToLowerInvariant()
  $rules = @($script:socMap.byNameContains)
  foreach ($rule in $rules) {
    $match = Get-JsonValue -Object $rule -Name "match"
    $group = Get-JsonValue -Object $rule -Name "group"
    if ($match -and $group -and $needle.Contains([string]$match)) {
      return [string]$group
    }
  }

  if ($FallbackName) {
    return $FallbackName
  }
  return "Other"
}

function Get-CategoryFromPosting {
  param($Descriptor)
  $categories = @()
  if ($null -ne $Descriptor.JobCategory) {
    $categories = @($Descriptor.JobCategory)
  }
  if ($categories.Count -eq 0) {
    return $null
  }
  $major = $categories[0]
  $detail = $categories[$categories.Count - 1]
  $categoryName = [string]$detail.Name
  $mappedMajor = Resolve-MajorGroup -CategoryName $categoryName -FallbackName ([string]$major.Name)
  return [pscustomobject]@{
    code = [string]$detail.Code
    title = $categoryName
    majorGroup = $mappedMajor
  }
}

function Invoke-USAJOBSPage {
  param([int]$Page)
  $uri = "https://data.usajobs.gov/api/search?DatePosted=$DatePosted&ResultsPerPage=$ResultsPerPage&Page=$Page"
  for ($attempt = 1; $attempt -le $RetryCount; $attempt += 1) {
    try {
      $invokeArgs = @{
        Method = "Get"
        Uri = $uri
        Headers = $Headers
        TimeoutSec = $TimeoutSeconds
        ErrorAction = "Stop"
      }
      $command = Get-Command Invoke-RestMethod
      if ($null -ne $command -and $command.Parameters.ContainsKey("SkipHeaderValidation")) {
        $invokeArgs.SkipHeaderValidation = $true
      }
      return Invoke-RestMethod @invokeArgs
    }
    catch {
      if ($attempt -ge $RetryCount) {
        throw
      }
      Start-Sleep -Seconds ($RetryDelaySeconds * $attempt)
    }
  }
}

$script:socMap = Read-JsonFile -Path $MapPath
if ($null -eq $script:socMap) {
  $script:socMap = New-DefaultSocMap
}
Write-Step "SOC map loaded"
$script:onetData = Load-OnetData -Dir $OnetDataDir

$page = 1
$total = 0
$maxPageAllowed = $MaxPages
$aggregates = @{}

if (-not $UseExistingHistoryOnly) {
  do {
    $response = Invoke-USAJOBSPage -Page $page
    $result = $response.SearchResult
    if ($null -eq $result) { break }

    $total = [int]$result.SearchResultCountAll
    $items = @($result.SearchResultItems)

    foreach ($item in $items) {
      $desc = $item.MatchedObjectDescriptor
      if ($null -eq $desc) { continue }
      $category = Get-CategoryFromPosting -Descriptor $desc
      if ($null -eq $category -or -not $category.code) { continue }

      if (-not $aggregates.ContainsKey($category.code)) {
        $aggregates[$category.code] = [pscustomobject]@{
          code = $category.code
          title = $category.title
          majorGroup = $category.majorGroup
          count = 0
        }
      }
      $aggregates[$category.code].count += 1
    }

    $page += 1
    if ($page -gt $maxPageAllowed) { break }
  } while (($page - 1) * $ResultsPerPage -lt $total)
}

$today = (Get-Date).ToString("yyyy-MM-dd")
Write-Step "Loading USAJOBS history"
$history = Read-JsonFile -Path $HistoryPath
if ($null -eq $history) {
  if ($UseExistingHistoryOnly) {
    throw "History file not found for -UseExistingHistoryOnly: $HistoryPath"
  }
  $history = [pscustomobject]@{
    source = "USAJOBS"
    lastRun = $today
    series = @()
  }
}

$seriesIndex = @{}
foreach ($entry in @($history.series)) {
  $seriesIndex[$entry.code] = $entry
}

if (-not $UseExistingHistoryOnly) {
  foreach ($code in $aggregates.Keys) {
    $agg = $aggregates[$code]
    if (-not $seriesIndex.ContainsKey($code)) {
      $seriesIndex[$code] = [pscustomobject]@{
        code = $code
        name = $agg.title
        majorGroup = $agg.majorGroup
        daily = @()
      }
    }
    $daily = @($seriesIndex[$code].daily | Where-Object { $_.date -ne $today })
    $daily += [pscustomobject]@{ date = $today; count = $agg.count }
    $seriesIndex[$code].daily = $daily
  }

  $history.series = @($seriesIndex.Values | Sort-Object code)
  $history.lastRun = $today
  Write-JsonFile -Path $HistoryPath -Value $history
}

$baseline = Read-JsonFile -Path $BaselinePath
if ($null -eq $baseline) {
  $baseline = New-DefaultBaseline
  Write-JsonFile -Path $BaselinePath -Value $baseline
}
Write-Step "Baseline loaded"

$dates = @($history.series | ForEach-Object { $_.daily } | ForEach-Object { $_.date } | Sort-Object -Unique)
if ($dates.Count -gt 12) {
  $dates = $dates[-12..-1]
}

$labels = @("stable", "light", "augmenting", "restructuring", "high_risk")
$regions = @($Region)
$groups = @($script:socMap.socMajorGroups)

$entrySnapshots = @()
foreach ($entry in @($history.series)) {
  $normalizedMajorGroup = Get-NormalizedMajorGroup -RawMajorGroup ([string]$entry.majorGroup) -Title ([string]$entry.name)
  $daily = @($entry.daily | Sort-Object date)
  $counts = @($daily | ForEach-Object { [double]$_.count })
  $latestCount = if ($counts.Count -gt 0) { [double]$counts[-1] } else { 0.0 }

  $entrySnapshots += [pscustomobject]@{
    code = $entry.code
    title = [string]$entry.name
    rawMajorGroup = [string]$entry.majorGroup
    majorGroup = $normalizedMajorGroup
    daily = $daily
    counts = $counts
    latestCount = $latestCount
  }
}

$groupPopulationMap = @{}
foreach ($group in $groups) {
  $groupCounts = @($entrySnapshots | Where-Object { $_.majorGroup -eq $group } | ForEach-Object { [Math]::Log(1 + $_.latestCount) })
  $groupPopulationMap[$group] = if ($groupCounts.Count -gt 0) { $groupCounts } else { @([Math]::Log(1)) }
}
$globalPopulation = @($entrySnapshots | ForEach-Object { [Math]::Log(1 + $_.latestCount) })
if ($globalPopulation.Count -eq 0) {
  $globalPopulation = @([Math]::Log(1))
}

$occupations = @()
Write-Step "Calculating AIRS scores"
foreach ($entry in @($entrySnapshots)) {
  $code = $entry.code
  $codes = Get-JsonValue -Object $baseline -Name "codes"
  $config = Get-JsonValue -Object $codes -Name $code
  $baselineDefaults = Get-JsonValue -Object $baseline -Name "defaults"
  $majorGroup = $entry.majorGroup
  $preferredOnetCode = if ($null -ne $config) { [string](Get-JsonValue -Object $config -Name "onetCode") } else { "" }
  $onetMatch = Find-OnetOccupation -OnetData $script:onetData -Title $entry.title -PreferredCode $preferredOnetCode
  $profile = Get-OnetProfile -Title $entry.title -MajorGroup $majorGroup -OnetMatch $onetMatch
  $replacement = [double]$profile.replacement
  $augmentation = [double]$profile.augmentation
  $historical = [double]$profile.historical
  $humanCriticality = [double]$profile.human
  $groupPopulation = $groupPopulationMap[$majorGroup]
  $hiringState = Get-HiringRealizationScore -Counts $entry.counts -Augmentation $augmentation -GroupPopulation $groupPopulation -GlobalPopulation $globalPopulation
  $hiring = [double]$hiringState.score
  $impact = Get-ImpactScore -Replacement $replacement -Augmentation $augmentation -HiringRealization $hiring -HistoricalAI $historical -HumanCriticality $humanCriticality
  $airs = [Math]::Round((100 * (1 - $impact)), 1)

  if ($null -ne $config) {
    $replacement = Get-NumericJsonValue -Object $config -Name "replacement" -Default $replacement
    $augmentation = Get-NumericJsonValue -Object $config -Name "augmentation" -Default $augmentation
    $hiring = Get-NumericJsonValue -Object $config -Name "hiring" -Default $hiring
    $historical = Get-NumericJsonValue -Object $config -Name "historical" -Default $historical
    $humanCriticality = Get-NumericJsonValue -Object $config -Name "humanCriticality" -Default $humanCriticality
    $impact = Get-ImpactScore -Replacement $replacement -Augmentation $augmentation -HiringRealization $hiring -HistoricalAI $historical -HumanCriticality $humanCriticality
    $airs = [Math]::Round((100 * (1 - $impact)), 1)
    $manualAirs = Get-JsonValue -Object $config -Name "airs"
    if ($null -ne $manualAirs -and $manualAirs -ne "") {
      $airs = [Math]::Round((Clamp-Range -Value ([double]$manualAirs) -Min 0 -Max 100), 1)
    }
  }

  $label = Get-LabelFromAirs -Airs $airs
  $latest = ($entry.daily | Select-Object -Last 1)
  $postings = if ($null -ne $latest) { [int]$latest.count } else { 0 }
  $summaryPair = Get-AirsSummary -MajorGroup $majorGroup -Replacement $replacement -Augmentation $augmentation -Hiring $hiring -Historical $historical -ActiveDemand ([double]$hiringState.activeDemand)
  $summaryEn = [string]$summaryPair.en
  $summaryZh = [string]$summaryPair.zh
  if ($null -ne $config) {
    $summaryEn = [string](Get-JsonValue -Object $config -Name "summary")
    $baselineSummary = [string](Get-JsonValue -Object $baselineDefaults -Name "summary")
    if ((-not $summaryEn) -and $baselineSummary -and $baselineSummary -notmatch "^Auto-calculated") {
      $summaryEn = $baselineSummary
    }
    if (-not $summaryEn) { $summaryEn = [string]$summaryPair.en }
    $summaryZh = [string](Get-JsonValue -Object $config -Name "summaryZh")
    if (-not $summaryZh) { $summaryZh = [string](Get-JsonValue -Object $config -Name "summary") }
    if (-not $summaryZh) { $summaryZh = [string]$summaryPair.zh }
  }
  else {
    $defaultSummary = [string](Get-JsonValue -Object $baselineDefaults -Name "summary")
    if ($defaultSummary -and $defaultSummary -notmatch "^Auto-calculated") {
      $summaryEn = $defaultSummary
    }
  }
  $monthlyAirs = Build-MonthlyAirs -Counts $entry.counts -Replacement $replacement -Augmentation $augmentation -Historical $historical -HumanCriticality $humanCriticality -GroupPopulation $groupPopulation -GlobalPopulation $globalPopulation
  $demandPercentile = [Math]::Round((100 * [double]$hiringState.activeDemand), 0)
  $replacementPct = [Math]::Round((100 * $replacement), 0)
  $augmentationPct = [Math]::Round((100 * $augmentation), 0)
  $hiringPct = [Math]::Round((100 * $hiring), 0)
  $historicalPct = [Math]::Round((100 * $historical), 0)
  $profileSource = [string]$profile.source
  $onetCode = [string]$profile.onetCode
  $onetTitle = [string]$profile.onetTitle
  $onetMatchScore = [Math]::Round([double]$profile.matchScore, 3)
  $onetTaskCount = [int]$profile.taskCount
  $onetTechCount = [int]$profile.techCount
  $sourceEvidence = if ($onetCode) {
    "Feature source: $profileSource; O*NET $onetCode ($onetTitle), match score $onetMatchScore, tasks $onetTaskCount, technology skills $onetTechCount."
  }
  else {
    "Feature source: $profileSource."
  }
  $taskPreview = @()
  if ($null -ne $onetMatch -and $null -ne $onetMatch.occupation) {
    $taskPreview = @($onetMatch.occupation.tasks | Sort-Object { -1 * ([double]$_.importance * [double]$_.relevance) } | Select-Object -First 5 | ForEach-Object { [string]$_.text })
  }

  $occupations += [pscustomobject]@{
    socCode = $code
    title = $entry.title
    titleZh = $entry.title
    majorGroup = $majorGroup
    onetCode = $onetCode
    onetTitle = $onetTitle
    onetMatchScore = $onetMatchScore
    featureSource = $profileSource
    label = $label
    summary = $summaryEn
    summaryZh = $summaryZh
    regions = @{
      $Region = @{
        airs = $airs
        replacement = [Math]::Round($replacement, 3)
        augmentation = [Math]::Round($augmentation, 3)
        hiring = [Math]::Round($hiring, 3)
        historical = [Math]::Round($historical, 3)
        postings = $postings
      }
    }
    monthlyAirs = $monthlyAirs
    evidence = @(
      "Normalized BLS major group: $majorGroup",
      "Current postings: $postings; peer-demand percentile: $demandPercentile%",
      "Replacement $replacementPct%, augmentation $augmentationPct%, hiring realization $hiringPct%, historical exposure $historicalPct%.",
      $sourceEvidence
    )
    evidenceZh = @(
      "Normalized BLS major group: $majorGroup",
      "Current postings: $postings; peer-demand percentile: $demandPercentile%",
      "Replacement $replacementPct%, augmentation $augmentationPct%, hiring realization $hiringPct%, historical exposure $historicalPct%.",
      $sourceEvidence
    )
    tasks = $taskPreview
  }
}
Write-Step "Prepared $($entrySnapshots.Count) occupation history snapshots"

$output = [pscustomobject]@{
  dates = $dates
  regions = $regions
  labels = $labels
  groups = $groups
  occupations = @($occupations | Sort-Object { $_.regions.$Region.airs })
}

Write-Step "Writing output JSON"
Write-JsonFile -Path $OutputPath -Value $output

Write-Host "USAJOBS sync complete. Occupations: $($occupations.Count). Output: $OutputPath"
