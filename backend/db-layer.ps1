function To-StringArray {
  param($Value)

  if ($null -eq $Value) {
    return @()
  }
  if ($Value -is [string]) {
    return @($Value)
  }
  if ($Value -is [System.Array]) {
    return @($Value | ForEach-Object { [string]$_ })
  }

  return @([string]$Value)
}

function Quote-SqlObjectName {
  param([Parameter(Mandatory = $true)][string]$Name)

  if ($Name -notmatch '^[A-Za-z0-9_\.\[\]]+$') {
    throw "Invalid SQL object name: $Name"
  }

  return $Name
}

function To-DbNull {
  param($Value)

  if ($null -eq $Value) {
    return [DBNull]::Value
  }

  return $Value
}

function Convert-DataTableToObjects {
  param([Parameter(Mandatory = $true)][System.Data.DataTable]$Table)

  $rows = @()
  foreach ($dataRow in $Table.Rows) {
    $item = [ordered]@{}
    foreach ($column in $Table.Columns) {
      $value = $dataRow[$column.ColumnName]
      if ($value -is [DBNull]) {
        $value = $null
      }
      $item[$column.ColumnName] = $value
    }
    $rows += [pscustomobject]$item
  }

  return @($rows)
}

function Resolve-DbConfigPath {
  param([string]$ExplicitPath = "")

  $candidates = @()
  if ($ExplicitPath) {
    $candidates += $ExplicitPath
  }
  if ($env:AIRS_DB_CONFIG) {
    $candidates += $env:AIRS_DB_CONFIG
  }
  $candidates += $DefaultDbConfigPath

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
      return [System.IO.Path]::GetFullPath($candidate)
    }
  }

  return $null
}

function Get-DbConfig {
  param([string]$ExplicitPath = "")

  $configPath = Resolve-DbConfigPath -ExplicitPath $ExplicitPath
  $raw = $null
  if ($configPath) {
    $raw = Get-Content -Path $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
  }

  $provider = Or-Default (Get-JsonValue -Object $raw -Name "provider") (Or-Default $env:AIRS_DB_PROVIDER "SqlServer")
  $connectionString = Or-Default (Get-JsonValue -Object $raw -Name "connectionString") $env:AIRS_DB_CONNECTION_STRING
  if (-not $connectionString) {
    return $null
  }

  $tables = Get-JsonValue -Object $raw -Name "tables"
  $metadata = Get-JsonValue -Object $raw -Name "metadata"

  return [pscustomobject]@{
    provider = $provider
    connectionString = $connectionString
    configPath = $configPath
    dailyTable = Or-Default (Get-JsonValue -Object $tables -Name "daily") (Or-Default $env:AIRS_DB_DAILY_TABLE "mart_airs_daily_api")
    evidenceTable = Or-Default (Get-JsonValue -Object $tables -Name "evidence") (Or-Default $env:AIRS_DB_EVIDENCE_TABLE "mart_airs_evidence_api")
    taskTable = Or-Default (Get-JsonValue -Object $tables -Name "tasks") (Or-Default $env:AIRS_DB_TASK_TABLE "mart_airs_task_exposure_api")
    commandTimeoutSeconds = [int](Or-Default (Get-JsonValue -Object $raw -Name "commandTimeoutSeconds") (Or-Default $env:AIRS_DB_COMMAND_TIMEOUT "30"))
    metadataDates = To-StringArray (Get-JsonValue -Object $metadata -Name "dates")
    metadataRegions = To-StringArray (Get-JsonValue -Object $metadata -Name "regions")
    metadataLabels = To-StringArray (Get-JsonValue -Object $metadata -Name "labels")
  }
}

function New-DbConnection {
  param([Parameter(Mandatory = $true)]$Config)

  switch ($Config.provider.ToLowerInvariant()) {
    "sqlserver" {
      $connection = New-Object System.Data.SqlClient.SqlConnection $Config.connectionString
    }
    "odbc" {
      $connection = New-Object System.Data.Odbc.OdbcConnection $Config.connectionString
    }
    default {
      throw "Unsupported database provider: $($Config.provider)"
    }
  }

  $connection.Open()
  return $connection
}

function New-DbDataAdapter {
  param(
    [Parameter(Mandatory = $true)]$Command,
    [Parameter(Mandatory = $true)]$Connection
  )

  if ($Connection -is [System.Data.SqlClient.SqlConnection]) {
    return New-Object System.Data.SqlClient.SqlDataAdapter $Command
  }
  if ($Connection -is [System.Data.Odbc.OdbcConnection]) {
    return New-Object System.Data.Odbc.OdbcDataAdapter $Command
  }

  throw "Unsupported adapter type: $($Connection.GetType().FullName)"
}

function New-DbCommand {
  param(
    [Parameter(Mandatory = $true)]$Connection,
    [Parameter(Mandatory = $true)][string]$Sql,
    [hashtable]$Parameters = @{},
    [int]$CommandTimeout = 30
  )

  $command = $Connection.CreateCommand()
  $command.CommandText = $Sql
  $command.CommandTimeout = $CommandTimeout

  if ($Connection -is [System.Data.Odbc.OdbcConnection]) {
    $tokens = [regex]::Matches($Sql, "@[A-Za-z0-9_]+") | ForEach-Object { $_.Value.Substring(1) }
    foreach ($name in $tokens) {
      $value = $null
      if ($Parameters.ContainsKey($name)) {
        $value = $Parameters[$name]
      }
      $parameter = $command.CreateParameter()
      $parameter.Value = To-DbNull -Value $value
      [void]$command.Parameters.Add($parameter)
    }
    $command.CommandText = [regex]::Replace($Sql, "@[A-Za-z0-9_]+", "?")
    return $command
  }

  foreach ($name in $Parameters.Keys) {
    $parameter = $command.CreateParameter()
    $parameter.ParameterName = "@$name"
    $parameter.Value = To-DbNull -Value $Parameters[$name]
    [void]$command.Parameters.Add($parameter)
  }

  return $command
}

function Invoke-DbQuery {
  param(
    [Parameter(Mandatory = $true)]$Config,
    [Parameter(Mandatory = $true)][string]$Sql,
    [hashtable]$Parameters = @{}
  )

  $connection = $null
  $adapter = $null
  try {
    $connection = New-DbConnection -Config $Config
    $command = New-DbCommand -Connection $connection -Sql $Sql -Parameters $Parameters -CommandTimeout $Config.commandTimeoutSeconds
    $adapter = New-DbDataAdapter -Command $command -Connection $connection
    $table = New-Object System.Data.DataTable
    [void]$adapter.Fill($table)
    return Convert-DataTableToObjects -Table $table
  }
  finally {
    if ($null -ne $adapter) {
      $adapter.Dispose()
    }
    if ($null -ne $connection) {
      if ($connection.State -ne [System.Data.ConnectionState]::Closed) {
        $connection.Close()
      }
      $connection.Dispose()
    }
  }
}

function Get-ServerTimestamp {
  return (Get-Date).ToString("yyyy-MM-ddTHH:mm:sszzz")
}

function Resolve-Date {
  param(
    [string]$RequestedDate,
    [string[]]$AvailableDates,
    [string]$FallbackDate = ""
  )

  if ($RequestedDate -and ($AvailableDates -contains $RequestedDate)) {
    return $RequestedDate
  }
  if ($AvailableDates.Count -gt 0) {
    return $AvailableDates[-1]
  }

  return $FallbackDate
}

function Get-FilledSeries {
  param(
    [object[]]$Series,
    [double]$FillValue
  )

  $values = @()
  foreach ($value in @($Series)) {
    $values += [double]$value
  }

  if ($values.Count -eq 0) {
    $values = @([double]$FillValue)
  }

  while ($values.Count -lt 12) {
    $values = ,([double]$values[0]) + $values
  }

  if ($values.Count -gt 12) {
    $start = $values.Count - 12
    $values = $values[$start..($values.Count - 1)]
  }

  return @($values)
}

function Get-DbMeta {
  param([Parameter(Mandatory = $true)]$Config)

  if ($null -ne $Script:DbMetaCache) {
    return $Script:DbMetaCache
  }

  $dailyTable = Quote-SqlObjectName -Name $Config.dailyTable

  $dates = @($Config.metadataDates)
  if ($dates.Count -eq 0) {
    $datesSql = "SELECT DISTINCT CONVERT(varchar(10), dt, 23) AS value FROM $dailyTable ORDER BY value ASC;"
    $dates = @(Invoke-DbQuery -Config $Config -Sql $datesSql | ForEach-Object { [string]$_.value })
  }

  $regions = @($Config.metadataRegions)
  if ($regions.Count -eq 0) {
    $regionsSql = @"
SELECT DISTINCT region
FROM $dailyTable
ORDER BY CASE WHEN region = 'National' THEN 0 ELSE 1 END, region;
"@
    $regions = @(Invoke-DbQuery -Config $Config -Sql $regionsSql | ForEach-Object { [string]$_.region })
  }

  $labels = @($Config.metadataLabels)
  if ($labels.Count -eq 0) {
    $labelsSql = @"
SELECT DISTINCT label
FROM $dailyTable
ORDER BY CASE
  WHEN label = 'stable' THEN 1
  WHEN label = 'light' THEN 2
  WHEN label = 'augmenting' THEN 3
  WHEN label = 'restructuring' THEN 4
  WHEN label = 'high_risk' THEN 5
  ELSE 99
END, label;
"@
    $labels = @(Invoke-DbQuery -Config $Config -Sql $labelsSql | ForEach-Object { [string]$_.label })
  }

  $Script:DbMetaCache = [pscustomobject]@{
    dates = @($dates)
    regions = @($regions)
    labels = @($labels)
  }

  return $Script:DbMetaCache
}

function Get-DbOccupationRows {
  param(
    [Parameter(Mandatory = $true)]$Config,
    [Parameter(Mandatory = $true)][string]$Date,
    [string]$Region = "National",
    [string]$MajorGroup = "all",
    [string]$Label = "all",
    [string]$Query = "",
    [string]$SocCode = ""
  )

  $dailyTable = Quote-SqlObjectName -Name $Config.dailyTable

  $sql = @"
SELECT
  CONVERT(varchar(10), dt, 23) AS dt,
  region,
  soc_code AS socCode,
  soc_title AS title,
  COALESCE(soc_title_zh, soc_title) AS titleZh,
  major_group AS majorGroup,
  label,
  summary_text AS summary,
  COALESCE(summary_text_zh, summary_text) AS summaryZh,
  CAST(airs_score AS float) AS airs,
  CAST(replacement_score AS float) AS replacement,
  CAST(augmentation_score AS float) AS augmentation,
  CAST(hiring_realization_score AS float) AS hiring,
  CAST(historical_ai_score AS float) AS historical,
  CAST(posting_count AS int) AS postings
FROM $dailyTable
WHERE dt = @date
  AND (@region = 'all' OR region = @region)
  AND (@majorGroup = 'all' OR major_group = @majorGroup)
  AND (@label = 'all' OR label = @label)
  AND (@socCode = '' OR soc_code = @socCode)
  AND (
    @q = ''
    OR LOWER(soc_code) LIKE '%' + LOWER(@q) + '%'
    OR LOWER(soc_title) LIKE '%' + LOWER(@q) + '%'
    OR LOWER(COALESCE(soc_title_zh, '')) LIKE '%' + LOWER(@q) + '%'
  )
ORDER BY airs_score ASC, soc_code ASC;
"@

  return Invoke-DbQuery -Config $Config -Sql $sql -Parameters @{
    date = $Date
    region = $Region
    majorGroup = $MajorGroup
    label = $Label
    q = $Query
    socCode = $SocCode
  }
}

function Get-DbMonthlySeriesLookup {
  param(
    [Parameter(Mandatory = $true)]$Config,
    [Parameter(Mandatory = $true)][string]$Date,
    [Parameter(Mandatory = $true)][string]$Region,
    [string[]]$SocCodes
  )

  $lookup = @{}
  $requestedCodes = @($SocCodes | Where-Object { $_ } | Sort-Object -Unique)
  if ($requestedCodes.Count -eq 0) {
    return $lookup
  }

  $dailyTable = Quote-SqlObjectName -Name $Config.dailyTable
  $socParams = @()
  $parameters = @{
    date = $Date
    region = $Region
  }

  for ($index = 0; $index -lt $requestedCodes.Count; $index += 1) {
    $name = "soc$index"
    $socParams += "@$name"
    $parameters[$name] = $requestedCodes[$index]
  }

  $inClause = $socParams -join ", "
  $sql = @"
WITH monthly AS (
  SELECT
    soc_code,
    DATEFROMPARTS(YEAR(dt), MONTH(dt), 1) AS month_start,
    AVG(CAST(airs_score AS float)) AS airs
  FROM $dailyTable
  WHERE dt <= @date
    AND (@region = 'all' OR region = @region)
    AND soc_code IN ($inClause)
  GROUP BY soc_code, DATEFROMPARTS(YEAR(dt), MONTH(dt), 1)
),
ranked AS (
  SELECT
    soc_code AS socCode,
    month_start,
    airs,
    ROW_NUMBER() OVER (PARTITION BY soc_code ORDER BY month_start DESC) AS rn
  FROM monthly
)
SELECT
  socCode,
  CONVERT(varchar(10), month_start, 23) AS monthStart,
  airs
FROM ranked
WHERE rn <= 12
ORDER BY socCode ASC, monthStart ASC;
"@

  $rows = Invoke-DbQuery -Config $Config -Sql $sql -Parameters $parameters
  foreach ($row in $rows) {
    if (-not $lookup.ContainsKey($row.socCode)) {
      $lookup[$row.socCode] = @()
    }
    $lookup[$row.socCode] += [double]$row.airs
  }

  return $lookup
}

function Get-DbEvidenceItems {
  param(
    [Parameter(Mandatory = $true)]$Config,
    [Parameter(Mandatory = $true)][string]$Date,
    [Parameter(Mandatory = $true)][string]$Region,
    [Parameter(Mandatory = $true)][string]$SocCode
  )

  if (-not $Config.evidenceTable) {
    return @()
  }

  try {
    $evidenceTable = Quote-SqlObjectName -Name $Config.evidenceTable
    $sql = @"
SELECT
  evidence_text AS evidence,
  COALESCE(evidence_text_zh, evidence_text) AS evidenceZh
FROM $evidenceTable
WHERE dt = @date
  AND (@region = 'all' OR region = @region)
  AND soc_code = @socCode
ORDER BY sort_order ASC, evidence_text ASC;
"@
    return Invoke-DbQuery -Config $Config -Sql $sql -Parameters @{
      date = $Date
      region = $Region
      socCode = $SocCode
    }
  }
  catch {
    Write-Host "Evidence query failed; returning empty evidence list. $($_.Exception.Message)"
    return @()
  }
}

function Get-DbTaskItems {
  param(
    [Parameter(Mandatory = $true)]$Config,
    [Parameter(Mandatory = $true)][string]$SocCode
  )

  if (-not $Config.taskTable) {
    return @()
  }

  try {
    $taskTable = Quote-SqlObjectName -Name $Config.taskTable
    $sql = @"
SELECT
  task_name AS name,
  COALESCE(task_name_zh, task_name) AS nameZh,
  CAST(exposure_score AS float) AS score
FROM $taskTable
WHERE soc_code = @socCode
ORDER BY exposure_score DESC, task_name ASC;
"@
    return Invoke-DbQuery -Config $Config -Sql $sql -Parameters @{ socCode = $SocCode }
  }
  catch {
    Write-Host "Task query failed; returning empty task list. $($_.Exception.Message)"
    return @()
  }
}

function Try-RunDb {
  param([scriptblock]$Action)

  if ($null -eq $Script:DbConfig) {
    return $null
  }

  try {
    return & $Action
  }
  catch {
    if (Or-Default $Script:StrictDataMode $false) {
      Write-Host "Database request failed; strict data mode is enabled. $($_.Exception.Message)"
    }
    else {
      Write-Host "Database request failed; falling back to mock data. $($_.Exception.Message)"
    }
    return $null
  }
}

function Get-DbSummaryPayload {
  param(
    [string]$Date = "",
    [string]$Region = "National",
    [string]$MajorGroup = "all",
    [string]$Label = "all",
    [string]$Query = ""
  )

  $meta = Get-DbMeta -Config $Script:DbConfig
  $resolvedDate = Resolve-Date -RequestedDate $Date -AvailableDates $meta.dates -FallbackDate ""
  $rows = Get-DbOccupationRows -Config $Script:DbConfig -Date $resolvedDate -Region $Region -MajorGroup $MajorGroup -Label $Label -Query $Query

  $avgAirs = 0
  if (@($rows).Count -gt 0) {
    $avgAirs = [double](($rows | Measure-Object -Property airs -Average).Average)
  }

  return [pscustomobject]@{
    updatedAt = Get-ServerTimestamp
    date = $resolvedDate
    avgAirs = $avgAirs
    highRiskCount = @($rows | Where-Object { $_.label -eq "high_risk" }).Count
    occupationCount = @($rows).Count
  }
}

function Get-DbOccupationsPayload {
  param(
    [string]$Date = "",
    [string]$Region = "National",
    [string]$MajorGroup = "all",
    [string]$Label = "all",
    [string]$Query = ""
  )

  $meta = Get-DbMeta -Config $Script:DbConfig
  $resolvedDate = Resolve-Date -RequestedDate $Date -AvailableDates $meta.dates -FallbackDate ""
  $rows = Get-DbOccupationRows -Config $Script:DbConfig -Date $resolvedDate -Region $Region -MajorGroup $MajorGroup -Label $Label -Query $Query
  $seriesLookup = Get-DbMonthlySeriesLookup -Config $Script:DbConfig -Date $resolvedDate -Region $Region -SocCodes @($rows | ForEach-Object { $_.socCode })

  $occupations = foreach ($row in $rows) {
    $series = @()
    if ($seriesLookup.ContainsKey($row.socCode)) {
      $series = $seriesLookup[$row.socCode]
    }

    [pscustomobject]@{
      socCode = $row.socCode
      title = $row.title
      titleZh = Or-Default $row.titleZh $row.title
      majorGroup = $row.majorGroup
      label = $row.label
      summary = $row.summary
      summaryZh = Or-Default $row.summaryZh $row.summary
      airs = [double]$row.airs
      replacement = [double]$row.replacement
      augmentation = [double]$row.augmentation
      hiring = [double]$row.hiring
      historical = [double]$row.historical
      postings = [int]$row.postings
      monthlyAirs = Get-FilledSeries -Series $series -FillValue ([double]$row.airs)
      evidence = @()
      evidenceZh = @()
      tasks = @()
      regionMetrics = @{}
    }
  }

  return [pscustomobject]@{
    updatedAt = Get-ServerTimestamp
    date = $resolvedDate
    dates = $meta.dates
    regions = $meta.regions
    labels = $meta.labels
    occupations = @($occupations)
  }
}

function Get-DbDetailPayload {
  param(
    [Parameter(Mandatory = $true)][string]$SocCode,
    [string]$Date = "",
    [string]$Region = "National"
  )

  $meta = Get-DbMeta -Config $Script:DbConfig
  $resolvedDate = Resolve-Date -RequestedDate $Date -AvailableDates $meta.dates -FallbackDate ""
  $row = Get-DbOccupationRows -Config $Script:DbConfig -Date $resolvedDate -Region $Region -SocCode $SocCode | Select-Object -First 1
  if ($null -eq $row) {
    return $null
  }

  $seriesLookup = Get-DbMonthlySeriesLookup -Config $Script:DbConfig -Date $resolvedDate -Region $Region -SocCodes @($SocCode)
  $series = @()
  if ($seriesLookup.ContainsKey($SocCode)) {
    $series = $seriesLookup[$SocCode]
  }

  $evidenceRows = Get-DbEvidenceItems -Config $Script:DbConfig -Date $resolvedDate -Region $Region -SocCode $SocCode
  $taskRows = Get-DbTaskItems -Config $Script:DbConfig -SocCode $SocCode

  return [pscustomobject]@{
    updatedAt = Get-ServerTimestamp
    date = $resolvedDate
    dates = $meta.dates
    regions = $meta.regions
    occupation = [pscustomobject]@{
      socCode = $row.socCode
      title = $row.title
      titleZh = Or-Default $row.titleZh $row.title
      majorGroup = $row.majorGroup
      label = $row.label
      summary = $row.summary
      summaryZh = Or-Default $row.summaryZh $row.summary
      airs = [double]$row.airs
      replacement = [double]$row.replacement
      augmentation = [double]$row.augmentation
      hiring = [double]$row.hiring
      historical = [double]$row.historical
      postings = [int]$row.postings
      monthlyAirs = Get-FilledSeries -Series $series -FillValue ([double]$row.airs)
      evidence = @($evidenceRows | ForEach-Object { $_.evidence })
      evidenceZh = @($evidenceRows | ForEach-Object { Or-Default $_.evidenceZh $_.evidence })
      tasks = @($taskRows | ForEach-Object {
        [pscustomobject]@{
          name = $_.name
          nameZh = Or-Default $_.nameZh $_.name
          score = [double]$_.score
        }
      })
      regionMetrics = @{}
    }
  }
}
