# AIRS 可视化网站

这是一个可直接演示、可静态发布、并带自动数据同步链路的 AIRS 网站，现已包含：

- 总览仪表盘
- 日期/地区/SOC 大类/标签筛选
- 职业详情页
- 纯前端 JSON 数据读取
- TypeScript 前端运行时
- TypeScript 数据同步 CLI（USAJOBS / CareerOneStop / O*NET）

## 页面

- [home.html](E:\Codex\home.html)：新首页入口
- [occupation-view.html](E:\Codex\occupation-view.html)：新职业详情页
- [index.html](E:\Codex\index.html)：旧版页面，当前不作为根入口

## 核心文件

- [src](E:\Codex\src)：前端 TypeScript 源码
- [dist](E:\Codex\dist)：前端编译产物
- [src-node](E:\Codex\src-node)：Node + TypeScript 数据同步源码
- [backend/data/airs_data.json](E:\Codex\backend\data\airs_data.json)：网站当前读取的数据文件
- [backend/usajobs_sync.ps1](E:\Codex\backend\usajobs_sync.ps1)：PowerShell 兼容入口，会优先转发到 Node CLI
- [backend/onet_sync.ps1](E:\Codex\backend\onet_sync.ps1)：PowerShell 兼容入口，会优先转发到 Node CLI
- [sql/api_queries.sql](E:\Codex\sql\api_queries.sql)：API 查询示例
- [sql/warehouse_views.sql](E:\Codex\sql\warehouse_views.sql)：数仓视图示例

## 运行

先编译前端与 Node CLI：

```powershell
npm install
npm run build
```

本地预览站：

```powershell
.\preview.ps1
```

前端数据重建：

```powershell
npm run sync:usajobs -- --useExistingHistoryOnly
npm run sync:onet -- --force
```

如果你习惯 PowerShell 旧入口，也可以继续用：

```powershell
.\backend\usajobs_sync.ps1 -UseExistingHistoryOnly
.\sync_onet.ps1 -Force
```

然后访问 [http://localhost:8090/home.html](http://localhost:8090/home.html)。

当前根路由默认打开 [home.html](E:\Codex\home.html)。

## 数据说明

当前网站为纯前端静态站，直接读取：

- [backend/data/airs_data.json](E:\Codex\backend\data\airs_data.json)

GitHub Actions 已接入两条自动同步链路：

1. `Update AIRS Data Daily`
2. `Update O-NET Data Monthly`

其中 `Update AIRS Data Daily` 当前会默认接入：

- `USAJOBS`
- `CareerOneStop Jobs V2`（配置密钥后自动启用）

## API 约定

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
