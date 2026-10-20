# AIP 售后文件库

一个纯静态的 PDF 仓库网页：把售后资料按分类放进 `files/`，网页就能搜索、筛选、在线预览，还能把单份文档的链接直接发给同事。

零依赖、零后端、零构建，托管在 GitHub Pages 上即可长期使用。

## 功能

- **分类归档**：`files/` 下每个目录就是一个分类，目录名数字前缀决定顺序
- **即时搜索**：标题 + 分类实时过滤，按 `/` 快速聚焦搜索框
- **在线预览**：点卡片右侧滑出 PDF 阅读器，支持下载、新窗口打开、复制分享链接
- **两种视图**：网格 / 列表，可按更新时间、标题、大小排序
- **分享直达**：每份文档都有独立链接（`#/d/文件路径`），打开即预览
- **索引自动化**：脚本扫描目录生成 `data/documents.json`，GitHub Actions 也可在推送后自动重建

## 目录结构

```
pdf-archive/
├── index.html              网页入口
├── site.json               站点标题、描述、仓库地址
├── files/                  ← PDF 全部放这里
│   ├── 01-产品手册/
│   ├── 02-维修与调试/
│   ├── 03-固件与软件/
│   ├── 04-常见问题/
│   ├── 05-表单与协议/
│   └── 06-培训资料/
├── data/
│   ├── documents.json      自动生成的索引（勿手改）
│   └── documents.js        索引的 JS 副本，便于本地直接打开
├── assets/                 样式与前端脚本
├── scripts/
│   ├── build_index.py      扫描 files/ 重建索引
│   └── add_pdf.py          一键归档 PDF
├── add-pdf.cmd             把 PDF 拖到它上面即可归档
├── update-index.cmd        双击重建索引
└── preview.cmd             双击本地预览
```

## 本地预览

双击 `preview.cmd`（等价于 `python -m http.server 8123`），浏览器打开 <http://localhost:8123>。

> 直接双击 `index.html` 也能看到列表（索引有一份 JS 副本），但 PDF 内嵌预览受浏览器本地文件策略限制，建议用上面的本地服务器。

## 添加文件

**方式一：网页上传（最省事）**

在 GitHub 仓库里进入 `files/` 下的某个分类目录 → `Add file` → `Upload files` → 拖入 PDF → 提交。
`data/documents.json` 会由仓库内置的 Action 自动重建（首次需在仓库 `Settings → Actions` 里允许运行）。

**方式二：拖到 `add-pdf.cmd` 上**

把 PDF 拖到 `add-pdf.cmd` 图标上松手，脚本会复制文件、重建索引、提交并推送。

**方式三：命令行**

```bash
python scripts/add_pdf.py "D:/资料/新手册.pdf" --category 产品手册 --push
python scripts/add_pdf.py a.pdf b.pdf --category 维修与调试
python scripts/build_index.py          # 只重建索引
```

## 调整分类

- **新增分类**：新建目录 `files/07-退换货/`，数字前缀只用于排序，网页显示时会自动去掉
- **改名**：直接改目录名
- **排序**：改数字前缀即可
- **不要**把 PDF 直接丢在 `files/` 根目录太久，它们会归入「未分类」

## 改站点标题

编辑 `site.json`：

```json
{
  "title": "AIP 售后文件库",
  "description": "售后资料集中存放，按分类归档，支持搜索与在线预览",
  "repo": "https://github.com/你的用户名/仓库名"
}
```

`repo` 填上仓库地址后，顶栏的 GitHub 按钮就会显示。

## 发布到 GitHub Pages

```bash
git init
git add -A
git commit -m "init: PDF 文件库"
git branch -M main
git remote add origin https://github.com/<用户名>/<仓库名>.git
git push -u origin main
```

然后在仓库 `Settings → Pages` 里把 Source 设为 `Deploy from a branch`，分支选 `main`、目录选 `/ (root)`，保存后访问
`https://<用户名>.github.io/<仓库名>/`。

## 说明

- 仓库内的示例 PDF 仅用于演示，可直接删除后替换成真实资料
- 公开仓库 = 文档公开可访问；涉密资料请改用私有仓库（私有仓库的 Pages 需要付费方案）
- 单个文件建议控制在 20 MB 以内，避免网页预览加载过慢
