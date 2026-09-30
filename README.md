# 莫弈·Vilhelm

《未定事件簿》角色 **莫弈** 的个人成长时间线记录与展示站（粉丝向非官方作品）。

纯前端静态站点：无后端、无数据库，内容以 JSON 数据文件维护，托管于 **Gitee Pages**。

## 功能

- **多条时间线**：主线剧情线、个人成长线、活动/节日线，可切换浏览
- **类别/标签筛选**：剧情/章节、角色状态/成长阶段、事件类型、地点/时期 四维度组合筛选
- **关键词搜索**：标题、正文、台词引用、标签
- **事件详情**：正文、插图灯箱、语音播放、台词引用、出场角色、重要度标记
- **点赞**：浏览器本地存储（访客各自可见）
- **统计面板**：事件总数、各时间线分布、成长阶段分布、素材量
- **响应式**：桌面与移动端适配

## 目录结构

```
vilhelm/
├── index.html         # 首页（角色档案）
├── timeline.html      # 时间线浏览
├── stats.html         # 成长统计
├── about.html         # 关于 / 版权声明
├── admin.html         # 管理端（开发中）
├── assets/            # 素材（图片 / 语音）
│   ├── images/moyi/
│   └── audio/moyi/
├── data/              # 数据文件（发布物）
│   ├── site.json      # 站点配置 + 角色 + 功能开关
│   ├── timelines.json # 时间线定义
│   ├── tags.json      # 类别与标签
│   ├── events.json    # 全部事件
│   └── schema.json    # 字段结构说明（校验用）
├── css/style.css      # 样式（简约杂志风）
├── js/                # 页面脚本
└── lib/               # 第三方库（Waline 等，按需）
```

## 本地运行

浏览器直接打开 HTML 会因 `fetch` 跨域限制无法加载数据，请用本地 HTTP 服务器：

```bash
# Python 方式
python -m http.server 8000
# 然后访问 http://localhost:8000/
```

## 数据维护

- 内容数据在 `data/*.json`：`site.json`（站点/角色/功能开关）、`timelines.json`（时间线）、`tags.json`（类别标签）、`events.json`（事件）。
- 事件按 `order` 字段在时间线内排序（剧情时间），`stage` 仅作展示。
- 素材文件放入 `assets/images/moyi/`、`assets/audio/moyi/`，事件中引用相对路径。
- 修改数据后推送到仓库，再到 Gitee Pages 服务页点击「更新」完成部署。

## 部署（静态托管）

> 注：原计划使用 Gitee Pages，该服务已下线（Gitee 官方确认暂无上线计划），托管方案待定。候选：自有服务器 Nginx / Cloudflare Pages / 腾讯云 CloudBase / 阿里云 OSS。

- 代码托管：Gitee 仓库 `vilhelm`（公开，master 分支）已就绪。
- 本地预览：`python -m http.server 8000` → `http://localhost:8000/`。
- 每次更新数据/素材：提交推送 Gitee → 按所选托管平台的规则更新部署。

## 版权声明

本站为粉丝向非官方作品，角色与素材版权归原游戏方（miHoYo）所有。
