# Static Deployment

## 当前架构

当前网站已经改成纯前端模式：

- 页面直接读取 `backend/data/airs_data.json`
- 不再依赖 `/api/*` 后端接口
- 详情页和首页都从同一个 JSON 文件取数

## 你发布时必须带上的文件

至少要带上这些：

- `home.html`
- `occupation-view.html`
- `maze-theme.css`
- `landing-neo.js`
- `occupation-neo.js`
- `i18n-neo.js`
- `api-client.js`
- `occupation-translation.js`
- `runtime-config.js`
- `backend/data/airs_data.json`

最简单的做法就是直接发布整个 `E:\Codex` 目录。

## 适合的发布方式

现在可以使用任何纯静态托管方式：

- IIS 静态站点
- GitHub Pages
- Netlify
- Vercel
- 任何能直接托管 HTML / CSS / JS / JSON 文件的服务

## IIS 最短路径

1. 站点物理路径指向 `E:\Codex`
2. 使用根目录下的 `web.config`
3. 绑定域名和 HTTPS
4. 打开 `/home.html` 验证页面
5. 直接访问 `/backend/data/airs_data.json`，确认 JSON 能打开

## 数据更新方式

以后更新数据，不需要改前端代码，只需要替换这个文件：

- `backend/data/airs_data.json`

如果你继续用 USAJOBS 同步脚本，更新完后重新上传这个 JSON 即可。

## 上线后检查

1. 首页能正常打开
2. 职业场能缩放、拖拽、点击
3. 筛选和搜索能正常工作
4. 详情页能正常打开
5. `/backend/data/airs_data.json` 返回 `200`
