# GitHub Actions 自动更新说明

这套网站现在可以通过 GitHub Actions 自动更新数据，不需要你每次手动在本地运行脚本。

## 已新增的工作流

- `.github/workflows/update-airs-daily.yml`
  - 用途：每小时拉取最新招聘数据，并重建 `backend/data/airs_data.json`
  - 默认来源：`USAJOBS`
  - 可选来源：`CareerOneStop Jobs V2`
  - 频率：每小时一次
  - 时间：每小时 `15` 分运行一次

- `.github/workflows/update-onet-monthly.yml`
  - 用途：每月检查并更新 O-NET 数据，再重建 `backend/data/airs_data.json`
  - 频率：每月一次
  - 时间：每月 1 日 `03:00 UTC`，即北京时间 `11:00`

两个工作流都会在数据变化时自动提交回仓库。GitHub Pages 会随后自动重新发布页面。

## 启用前必须配置的 Secrets

进入 GitHub 仓库：

`Settings -> Secrets and variables -> Actions`

至少添加这两个 Repository secrets：

- `USAJOBS_API_KEY`
- `USAJOBS_USER_EMAIL`

说明：

- `USAJOBS_API_KEY`：你的 USAJOBS API Key
- `USAJOBS_USER_EMAIL`：申请 USAJOBS API 时使用的邮箱

如果这两个 secret 没填，日更工作流会直接失败。

如果你还想启用第二招聘源 `CareerOneStop Jobs V2`，再添加：

- `CAREERONESTOP_API_TOKEN`
- `CAREERONESTOP_USER_ID`

可选 Repository variable：

- `CAREERONESTOP_LOCATION`

说明：

- `CAREERONESTOP_API_TOKEN`：CareerOneStop API token
- `CAREERONESTOP_USER_ID`：CareerOneStop API userId
- `CAREERONESTOP_LOCATION`：默认可设为 `US`，用于全国范围聚合

如果这两个 CareerOneStop secrets 没填，工作流不会失败，只会自动跳过该来源。

## 如何手动运行

进入仓库：

`Actions`

然后：

1. 选择 `Update AIRS Data Daily`
2. 点击 `Run workflow`

或者：

1. 选择 `Update O-NET Data Monthly`
2. 点击 `Run workflow`

月更工作流有一个 `force` 开关：

- `true`：强制重新下载并重建
- `false`：只按默认逻辑检查

## 自动更新后会改哪些文件

日更通常会改：

- `backend/data/usajobs_history.json`
- `backend/data/careeronestop_history.json`
- `backend/data/airs_data.json`

月更通常会改：

- `backend/data/onet/*`
- `backend/data/airs_data.json`

## 你发布后还需要手动做什么

正常情况下，不需要。

只要：

1. GitHub Pages 已经正常发布
2. 上面的两个 Actions secrets 已配置
3. Actions 没被手动关闭

网站就会按计划自动更新数据。

## 建议的首次检查

首次启用后，建议手动跑一次这两个工作流，确认：

1. `Update AIRS Data Daily` 成功
2. `Update O-NET Data Monthly` 成功
3. 仓库里出现新的自动提交
4. GitHub Pages 页面刷新后能看到更新后的数据
