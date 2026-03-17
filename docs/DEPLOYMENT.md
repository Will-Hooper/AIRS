# Deployment

For a production-ready reverse-proxy setup, see [PRODUCTION_DEPLOYMENT.md](/E:/Codex/docs/PRODUCTION_DEPLOYMENT.md).

## Local run

From `E:\Codex`:

```powershell
.\start.ps1 -StrictDataMode
```

Open `http://localhost:8080`.

The root route now serves `home.html`.

The current HTML defaults are already set to:

- `production`
- `strict data mode = true`

That means the site will fail closed when live data is unavailable. If you only want a temporary local demo with mock data, pass:

```text
http://localhost:8080/home.html?strictDataMode=0&environment=development
```

## Runtime requirement for the PowerShell dev server

`backend/server.ps1` uses `System.Net.HttpListener`.

If the runtime reports `System.PlatformNotSupportedException`, do not use the PowerShell dev server as the final deployment shape. Use:

- IIS
- Nginx
- another reverse proxy / application host in front of the app

## SQL Server quick start

1. Run [sql/init_sqlserver_bootstrap.sql](/E:/Codex/sql/init_sqlserver_bootstrap.sql) in SQL Server Management Studio or `sqlcmd`.
2. Copy [backend/db.config.example.json](/E:/Codex/backend/db.config.example.json) to `backend/db.config.json`.
3. Update the SQL Server connection string.
4. Start the app with `.\start.ps1 -DbConfigPath E:\Codex\backend\db.config.json`.

## USAJOBS (no database) quick start

1. Get an API key from USAJOBS and note the email you will use as `User-Agent`.
2. Run the sync to generate `backend/data/airs_data.json`:

```powershell
$env:USAJOBS_API_KEY="your_key_here"
$env:USAJOBS_USER_EMAIL="you@company.com"
.\backend\usajobs_sync.ps1 -DatePosted 1
```

3. Start the app:

```powershell
.\start.ps1
```

If you want SOC major group mapping, update `backend\data\usajobs_soc_map.json`.

If you want custom AIRS baselines per occupational series, copy
`backend\data\airs_baseline.example.json` to `backend\data\airs_baseline.json` and edit it.

## What gets served

- Static files from the project root
- JSON API from `backend/server.ps1`
- Mock dataset from `backend/data/airs_data.json`

## API routes

- `/api/airs/summary`
- `/api/airs/occupations`
- `/api/airs/{soc_code}`

## Replace mock data with real data

1. Copy [backend/db.config.example.json](/E:/Codex/backend/db.config.example.json) to `backend/db.config.json`.
2. Fill in the real SQL Server or ODBC connection string.
3. Point the table names at warehouse views with the API schema:
   `mart_airs_daily_api`, `mart_airs_evidence_api`, `mart_airs_task_exposure_api`.
4. Reuse the SQL in [sql/api_queries.sql](/E:/Codex/sql/api_queries.sql) and [sql/warehouse_views.sql](/E:/Codex/sql/warehouse_views.sql).
5. Start the server with:

```powershell
.\start.ps1
```

Or with an explicit config file:

```powershell
.\start.ps1 -DbConfigPath E:\Codex\backend\db.config.json
```

If the database is unavailable and strict mode is off, the API automatically falls back to `backend/data/airs_data.json`.

## Production notes

- Put the PowerShell API behind IIS, Nginx, or an internal reverse proxy.
- Cache summary and list responses for 1-5 minutes.
- Refresh the warehouse-backed mart on a daily cadence and today-level increments every 15 minutes.

## Strict data mode

If you want production to fail closed instead of falling back to mock data:

1. Start the server with strict mode:

```powershell
.\start.ps1 -StrictDataMode
```

Or set:

```powershell
$env:AIRS_STRICT_DATA_MODE="true"
```

2. The HTML runtime flags are already strict by default in:

- [home.html](/E:/Codex/home.html)
- [occupation-view.html](/E:/Codex/occupation-view.html)

They currently use:

```html
<meta name="airs-environment" content="production">
<meta name="airs-strict-data-mode" content="true">
```

With strict mode enabled:

- backend API returns `503` when live data is unavailable
- frontend does not fall back to mock data
- pages show an explicit live-data-unavailable message
