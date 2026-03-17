# API Contract

## `GET /api/airs/summary`

### Query params

- `date`
- `region`
- `majorGroup`
- `label`
- `q`

### Response

```json
{
  "updatedAt": "2026-03-08T10:30:00+08:00",
  "date": "2026-03-08",
  "avgAirs": 51.7,
  "highRiskCount": 1,
  "occupationCount": 6
}
```

## `GET /api/airs/occupations`

### Query params

- `date`
- `region`
- `majorGroup`
- `label`
- `q`

### Response

```json
{
  "updatedAt": "2026-03-08T10:30:00+08:00",
  "date": "2026-03-08",
  "dates": ["2025-12-31", "2026-01-31", "2026-02-28", "2026-03-08"],
  "regions": ["National", "West", "Midwest", "South", "Northeast"],
  "labels": ["stable", "light", "augmenting", "restructuring", "high_risk"],
  "occupations": [
    {
      "socCode": "15-1252",
      "title": "Software Developers",
      "titleZh": "Software Developers",
      "majorGroup": "Computer and Mathematical",
      "label": "augmenting",
      "summary": "Coding copilots reshape hiring, but firms still recruit for design, review, and product delivery.",
      "summaryZh": "Coding copilots reshape hiring, but firms still recruit for design, review, and product delivery.",
      "airs": 63,
      "replacement": 0.49,
      "augmentation": 0.88,
      "hiring": 0.56,
      "historical": 0.61,
      "postings": 12840,
      "monthlyAirs": [74, 73, 72, 70, 69, 68, 67, 67, 66, 65, 64, 63]
    }
  ]
}
```

## `GET /api/airs/{soc_code}`

### Query params

- `date`
- `region`

### Response

```json
{
  "updatedAt": "2026-03-08T10:30:00+08:00",
  "date": "2026-03-08",
  "dates": ["2025-12-31", "2026-01-31", "2026-02-28", "2026-03-08"],
  "regions": ["National", "West", "Midwest", "South", "Northeast"],
  "occupation": {
    "socCode": "15-1252",
    "title": "Software Developers",
    "titleZh": "Software Developers",
    "majorGroup": "Computer and Mathematical",
    "label": "augmenting",
    "summary": "Coding copilots reshape hiring, but firms still recruit for design, review, and product delivery.",
    "summaryZh": "Coding copilots reshape hiring, but firms still recruit for design, review, and product delivery.",
    "airs": 63,
    "replacement": 0.49,
    "augmentation": 0.88,
    "hiring": 0.56,
    "historical": 0.61,
    "postings": 12840,
    "monthlyAirs": [74, 73, 72, 70, 69, 68, 67, 67, 66, 65, 64, 63],
    "evidence": ["Evidence line"],
    "evidenceZh": ["Evidence line"],
    "tasks": [
      { "name": "Coding", "nameZh": "Coding", "score": 0.82 }
    ],
    "regionMetrics": {}
  }
}
```
