# AIRS 可视化网站

这是一个可直接演示和继续接后端的 AIRS 网站骨架，现已包含：

- 总览仪表盘
- 日期/地区/SOC 大类/标签筛选
- 职业详情页
- mock 数据回退机制
- 可直接接真实 API 的数据层

## 页面

- [home.html](E:\Codex\home.html)：新首页入口
- [occupation-view.html](E:\Codex\occupation-view.html)：新职业详情页
- [index.html](E:\Codex\index.html)：旧版页面，当前不作为根入口

## 核心文件

- [apple-theme.css](E:\Codex\apple-theme.css)：新版视觉主题
- [styles.css](E:\Codex\styles.css)：旧版样式
- [landing-apple.js](E:\Codex\landing-apple.js)：新版首页交互
- [occupation-apple.js](E:\Codex\occupation-apple.js)：新版详情页交互
- [dashboard-app.js](E:\Codex\dashboard-app.js)：总览台逻辑
- [occupation-app.js](E:\Codex\occupation-app.js)：详情页逻辑
- [api-client.js](E:\Codex\api-client.js)：前端接口适配层
- [mock-data-v2.js](E:\Codex\mock-data-v2.js)：前端示例数据
- [backend/server.ps1](E:\Codex\backend\server.ps1)：本地 API 与静态文件服务
- [backend/data/airs_data.json](E:\Codex\backend\data\airs_data.json)：后端示例数据
- [sql/api_queries.sql](E:\Codex\sql\api_queries.sql)：API 查询示例
- [sql/warehouse_views.sql](E:\Codex\sql\warehouse_views.sql)：数仓视图示例

## 运行

建议直接在 `E:\Codex` 下启动本地服务：

```powershell
.\start.ps1
```

如果你要模拟正式发布时“真实数据不可用就直接报错”的行为，可用：

```powershell
.\start.ps1 -StrictDataMode
```

然后访问 [http://localhost:8080](http://localhost:8080)。

当前根路由默认打开 [home.html](E:\Codex\home.html)。

## API 约定

前端会优先请求真实接口；如果失败，会自动回退到 `mock-data-v2.js`。

建议提供以下接口：

1. `GET /api/airs/summary?date=2026-03-08&region=National`
2. `GET /api/airs/occupations?date=2026-03-08&region=National&majorGroup=...&label=...&q=...`
3. `GET /api/airs/{soc_code}?date=2026-03-08&region=National`

## 真实接入方式

如果你的后端已经能输出 `mart_airs_daily`、`occupation_daily_features` 聚合结果，前端基本不需要重写，只要保证接口字段和 `api-client.js` 的预期一致即可。

总览列表项建议至少返回：

```json
{
  "socCode": "43-9021",
  "title": "Data Entry Keyers",
  "majorGroup": "Office and Administrative Support",
  "label": "high_risk",
  "summary": "职业解释文本",
  "airs": 12,
  "replacement": 0.94,
  "augmentation": 0.31,
  "hiring": 0.91,
  "historical": 0.84,
  "postings": 510,
  "monthlyAirs": [24, 23, 22, 21, 19, 18, 17, 16, 15, 14, 13, 12]
}
```

## 部署说明

更完整的部署步骤见 [docs/DEPLOYMENT.md](E:\Codex\docs\DEPLOYMENT.md)。

接口字段定义见 [docs/API_CONTRACT.md](E:\Codex\docs\API_CONTRACT.md)。

正式上线前检查清单见 [docs/RELEASE_CHECKLIST.md](E:\Codex\docs\RELEASE_CHECKLIST.md)。

## Production Templates

- Reverse-proxy deployment guide: [docs/PRODUCTION_DEPLOYMENT.md](E:\Codex\docs\PRODUCTION_DEPLOYMENT.md)
- IIS config template: [deploy/iis/web.config](E:\Codex\deploy\iis\web.config)
- Nginx config template: [deploy/nginx/airs.conf](E:\Codex\deploy\nginx\airs.conf)
- Windows backend runner: [deploy/windows/run-backend.ps1](E:\Codex\deploy\windows\run-backend.ps1)
