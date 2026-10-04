# PlatVault

PlatVault 是一个 Chrome 扩展，用于识别 Warframe 仓库截图中的物品，并查询 [warframe.market（WFM）](https://warframe.market/) 上的白金价格。

点击 Chrome 工具栏中的 PlatVault 图标即可打开仓库估价器。添加截图后，扩展会在本地识别物品名称、按截图顺序排列，并自动查询可匹配的商品。

## 功能

- 支持拖放、文件选择和 `Ctrl/Cmd + V` 粘贴 PNG、JPG、WebP 截图，可一次添加多张。
- 使用扩展内置的简体中文 Tesseract OCR 模型在本地识别截图；截图不会上传。
- 识别结果按截图从上到下、每行从左到右排列。
- 识别完成后自动查询 WFM；查询到的商品名称可跳转至中文 WFM 商品页。
- 结果表显示商品名、售价、参考价、杜卡德和白金/杜卡德建议；可点击“建议”列排序。
- 白金/杜卡德建议默认按 `8 D/p` 计算，也可以在结果页调整阈值。

## 使用方法

1. 在 Chrome 中点击 PlatVault 扩展图标，打开仓库估价器。
2. 将截图拖入页面，点击选择图片，或在页面中粘贴截图。支持 PNG、JPG 和 WebP。
3. 点击“开始识别”。识别后会直接查询价格并显示结果。
4. 查看结果；点击“建议”列标题可在杜卡德优先、白金优先和原顺序之间切换。
5. 使用“清空本次扫描”开始新一轮估价。

## 价格与建议

- **售价**：当前游戏中在线卖家的最低可见卖价。
- **参考价**：取当前游戏中在线卖家最低五个卖价的中位数；有效卖家不足三个时取其中最低价。
- **杜卡德**：WFM 商品目录提供的杜卡德价值；目录没有该数据时显示 `—`。
- **建议**：杜卡德价值除以售价，达到阈值时建议 `🪙杜卡德`，否则建议 `💰白金`。没有有效售价或杜卡德数据时显示 `—`。
- 无法精确匹配到 WFM 商品或没有有效价格时，价格显示 `—`。

价格来自 WFM 当前订单数据，查询结果不会缓存。WFM 商品目录会缓存在浏览器本地，以减少重复下载。

## 隐私与网络访问

截图解码和 OCR 都在浏览器本地运行。截图只保留在当前页面会话中，移除截图、清空扫描或关闭页面后会释放。扩展只向 WFM 请求商品目录和匹配商品的订单信息，不会连接 Warframe 游戏进程，也不需要登录 PlatVault 账号。

## 本地开发

开发环境需要 Node.js 20 或更高版本。

```sh
npm install
npm run dev
```

本地开发模式通过 Vite 代理访问 WFM API。运行代码检查、测试和生产构建：

```sh
npm run lint
npm test
npm run build
```

如果需要从已安装的 Tesseract 依赖重新生成 OCR 运行时文件，可执行：

```sh
npm run prepare:ocr-assets
```

## 在 Chrome 中加载

1. 执行 `npm run build`。
2. 打开 `chrome://extensions`，启用“开发者模式”。
3. 点击“加载已解压的扩展程序”，选择项目的 `dist/` 目录。
4. 点击工具栏中的 PlatVault 图标打开估价器。

## 项目结构

```text
src/
├── dashboard/       # 截图导入、进度和价格结果界面
├── lib/
│   ├── image/       # 图片预处理
│   ├── matching/    # OCR 文本标准化和 WFM 商品匹配
│   ├── ocr/         # OCR 服务和识别结果解析
│   ├── storage/     # 浏览器本地存储
│   ├── valuation/   # 订单价格计算
│   └── wfm/         # WFM API、商品目录和请求限流
└── workers/         # 后台 OCR Worker
```

OCR 使用的简体中文模型位于 `public/ocr-data/chi_sim.traineddata.gz`，随扩展本地加载，不会上传。

## 数据来源与声明

市场数据由 [warframe.market](https://warframe.market/) 提供。PlatVault 是独立第三方工具，与 Digital Extremes 和 warframe.market 均无隶属关系。
