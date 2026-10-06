# PlatVault

PlatVault 是一个 Chrome Manifest V3 扩展，提供 Warframe 仓库估价、核桃分析和紫卡截图分析。

## 功能

- 拖入或粘贴 PNG、JPEG、WebP 截图；可预览和移除截图。
- 在本地使用 Tesseract.js OCR 识别截图，图片不会上传。
- 仓库估价：匹配 WFM 商品目录，查询订单价格并显示杜卡德/白金建议。
- 核桃分析：识别核桃名称和数量，结合公开奖励数据与 WFM 价格给出分类参考。
- 紫卡分析：复用已上传截图，识别武器和词条，在线查询武器面板与 Riven 倾向，展示词条评分、毕业目标、数值上限和锁定参考。

## 使用

1. 在 Chrome 中加载扩展并点击工具栏图标打开 PlatVault。
2. 将截图拖入页面，或聚焦上传区域后使用 `Ctrl/Cmd + V` 粘贴。
3. 选择仓库估价、核桃分析或紫卡分析，查看识别结果和分析建议。

支持单张不超过 20 MB 的 PNG、JPEG、WebP 图片。紫卡分析只发送识别出的武器名称到 WarframeStatus 查询武器数据；完整截图在本地处理。

## 开发与验证

需要 Node.js 20 或更高版本。

```sh
npm install
npm run dev
npm test
npm run lint
npm run build
```

构建后在 `chrome://extensions` 启用开发者模式，通过“加载已解压的扩展程序”选择 `dist/`。

## 项目结构

```text
src/
├── dashboard/       # 页面与功能模块
├── lib/              # OCR、匹配、分析、数据访问和价格计算
└── workers/          # 本地 OCR Worker
```

市场数据由 [warframe.market](https://warframe.market/) 提供；武器数据由 [WarframeStatus](https://api.warframestat.us/) 提供。PlatVault 是独立第三方工具，与 Digital Extremes、warframe.market 和 WarframeStatus 均无隶属关系。
