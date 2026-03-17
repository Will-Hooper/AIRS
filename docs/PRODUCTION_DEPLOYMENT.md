# Production Deployment

## 目标部署形态

推荐把项目拆成两层：

1. `IIS` 或 `Nginx` 对外提供静态页面和 HTTPS
2. `AIRS backend` 仅监听本机 `127.0.0.1:8080`

对外暴露的域名只进入反向代理，不要直接暴露 `backend/server.ps1`。

## 当前默认行为

当前仓库默认已经是正式发布口径：

- [home.html](/E:/Codex/home.html)
- [occupation-view.html](/E:/Codex/occupation-view.html)

页面默认值：

- `airs-environment = production`
- `airs-strict-data-mode = true`

这意味着真实数据不可用时，页面会直接报错，不会退回演示数据。

## 目录里的现成模板

- IIS 配置模板：[deploy/iis/web.config](/E:/Codex/deploy/iis/web.config)
- Nginx 配置模板：[deploy/nginx/airs.conf](/E:/Codex/deploy/nginx/airs.conf)
- Windows 后端启动脚本：[deploy/windows/run-backend.ps1](/E:/Codex/deploy/windows/run-backend.ps1)

## 方案 A：IIS

### 前提

- Windows Server / Windows 专业版
- 已安装 `IIS`
- 已安装 `URL Rewrite`
- 已启用 `Application Request Routing (ARR)` 并打开 proxy

### 步骤

1. 把站点物理路径指向 `E:\Codex`
2. 将 [deploy/iis/web.config](/E:/Codex/deploy/iis/web.config) 复制到站点根目录
3. 准备真实数据库配置：
   - `E:\Codex\backend\db.config.json`
4. 在服务器本机启动后端：

```powershell
powershell -ExecutionPolicy Bypass -File E:\Codex\deploy\windows\run-backend.ps1 -DbConfigPath E:\Codex\backend\db.config.json -StrictDataMode
```

5. 在 IIS 中绑定你的正式域名和 HTTPS 证书
6. 打开站点并检查：
   - `/home.html`
   - `/api/airs/summary`
   - `/occupation-view.html?soc=15-1252`

### 这个模板做了什么

- 根路径自动转到 `home.html`
- `/api/*` 反向代理到 `http://127.0.0.1:8080`
- 添加基础安全响应头
- 静态资源默认缓存 7 天

## 方案 B：Nginx

### 前提

- 已安装 Nginx
- 已准备正式域名和证书
- 后端仍在本机 `127.0.0.1:8080`

### 步骤

1. 把 [deploy/nginx/airs.conf](/E:/Codex/deploy/nginx/airs.conf) 复制到 Nginx 站点配置目录
2. 修改里面这几项：
   - `server_name`
   - `ssl_certificate`
   - `ssl_certificate_key`
   - `root`
3. 在服务器本机启动后端：

```powershell
powershell -ExecutionPolicy Bypass -File E:\Codex\deploy\windows\run-backend.ps1 -DbConfigPath E:\Codex\backend\db.config.json -StrictDataMode
```

4. 重载 Nginx
5. 检查首页、详情页和 `/api/airs/summary`

### 这个模板做了什么

- 80 自动跳 443
- 静态页面由 Nginx 直接提供
- `/api/*` 转发到本机后端
- 静态资源缓存 7 天
- 加入基础安全响应头

## 后端进程建议

不要手工开一个 PowerShell 窗口长期挂着。正式环境建议至少选一种：

1. `Task Scheduler` 开机自启 `deploy/windows/run-backend.ps1`
2. `NSSM` 把它包装成 Windows 服务
3. 交给现有运维平台拉起和守护

如果你使用 `NSSM`，程序可以直接填：

- `Path`: `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`
- `Arguments`: `-NoLogo -NoProfile -ExecutionPolicy Bypass -File E:\Codex\deploy\windows\run-backend.ps1 -DbConfigPath E:\Codex\backend\db.config.json -StrictDataMode`
- `Startup directory`: `E:\Codex`

## 上线前必须确认

1. `/api/airs/summary` 返回的 `mode` 是 `api`，不是 `mock`
2. 首页“数据来源”显示的是“真实数据库”，不是“演示数据”
3. 断开数据库后，页面明确报“实时数据不可用”
4. 域名、HTTPS、反向代理都在正式机器上验证通过
5. 手机和桌面端都做过人工验收

## 当前最现实的发布建议

如果你现在就要推进上线，优先顺序是：

1. 先在目标 Windows 服务器上跑通真实数据库
2. 优先上 `IIS` 方案
3. 只有在 IIS 不可用时，再改走 `Nginx`

对你这个项目而言，`IIS + 本机 PowerShell backend + 严格数据模式` 是最短路径。
