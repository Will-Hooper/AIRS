# O*NET Integration

The AIRS sync script can now consume local O*NET export files and use them to improve:

- `replacement`
- `augmentation`
- `historical`
- `humanCriticality`

When O*NET data is available, the script blends task-level signals with the existing title/group heuristic. When O*NET data is not available, the script falls back to the heuristic-only path.

## Directory

Place the O*NET text export files in:

`E:\Codex\backend\data\onet`

Or pass a custom directory:

```powershell
powershell -ExecutionPolicy Bypass -File .\backend\usajobs_sync.ps1 -UseExistingHistoryOnly -OnetDataDir E:\path\to\onet
```

## Automatic update

You can now fetch the latest official O*NET text database automatically.

From the project root:

```powershell
.\sync_onet.ps1
```

Direct backend entry:

```powershell
powershell -ExecutionPolicy Bypass -File .\backend\onet_sync.ps1
```

The sync script:

1. checks the official O*NET database page
2. finds the latest `db_*_text.zip`
3. downloads the zip
4. extracts the supported files into `backend/data/onet`
5. rebuilds `airs_data.json`

Useful flags:

```powershell
.\sync_onet.ps1 -Force
.\sync_onet.ps1 -SkipRebuild
```

Sync metadata is written to:

`E:\Codex\backend\data\onet\sync_meta.json`

## Supported files

Required for task-level AIRS:

- `Occupation Data.txt`
- `Task Statements.txt`
- `Task Ratings.txt`

Optional but recommended:

- `Technology Skills.txt`
- `Job Zones.txt`
- `Sample of Reported Titles.txt`
- `series_to_onet.json`

## Matching

The script matches a USAJOBS occupation to O*NET in this order:

1. `onetCode` from `airs_baseline.json`
2. `series_to_onet.json`
3. exact normalized title match
4. sample-title / token-similarity match

`series_to_onet.json` is optional. Example:

```json
{
  "0681": "31-9091.00",
  "maintenance mechanic": "49-9071.00"
}
```

Keys may be either:

- the local occupation code
- the normalized lower-case occupation title

## Output fields

When O*NET is used, each occupation row in `airs_data.json` also includes:

- `onetCode`
- `onetTitle`
- `onetMatchScore`
- `featureSource`
- `tasks` (top weighted O*NET task statements)

`featureSource` values:

- `heuristic`
- `onet_partial`
- `onet`

## Notes

- Current matching is still title-based because the current USAJOBS dataset is not a native O*NET-SOC feed.
- For best results, provide `Sample of Reported Titles.txt` or explicit `series_to_onet.json` overrides.
- If no O*NET files are present, AIRS falls back to the heuristic-only path automatically.
