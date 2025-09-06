# QTools

# QTools v2.3.0

QTools 是一个可以以 **油猴脚本** 或 **Chrome 插件** 形态运行的浏览器端小工具，用于抓取与导出 Cookie、拦截与记录网络请求（Fetch/XHR）、规则筛选与匿名化、数据离线导出（JSON/CSV）等。

## ✨ 主要特性

### 🍪 Cookie 管理
- **智能合并**: 自动合并 `document.cookie`、`cookieStore API`、扩展 API 等多源 Cookie
- **跨路径探测**: 自动探测 `/admin`、`/api`、`/login` 等常见路径下的 Cookie
- **批量导出**: 支持 JSON 格式批量导出，可直接用于 API 调用

### 🌐 网络请求监控
- **全面拦截**: 支持 Fetch、XMLHttpRequest、sendBeacon、EventSource、WebSocket
- **详细记录**: 捕获请求/响应头、请求/响应体、状态码、耗时等完整信息
- **智能过滤**: 支持正则表达式过滤规则，可按 URL 模式筛选
- **HAR 导出**: 标准 HAR (HTTP Archive) 格式导出，兼容各种分析工具

### 🎯 灵活筛选
- **同源控制**: 可选择仅监控同源请求或包含跨域请求  
- **规则过滤**: 内置 API 路径匹配规则，支持自定义正则表达式
- **黑名单保护**: 内置金融网站黑名单，确保敏感信息安全

### 🛡️ 安全与隐私
- **域名黑名单**: 自动屏蔽银行、支付等敏感网站
- **本地存储**: 所有数据仅在本地存储，不上传到任何服务器
- **数据控制**: 用户完全控制数据的收集、导出和清理

## 🚀 快速开始

### 方式一：Tampermonkey 油猴脚本（推荐）

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展
2. 复制 `userscript/qtools.user.js` 中的脚本代码
3. 在 Tampermonkey 中创建新脚本，粘贴代码并保存
4. 访问任意网页，点击右下角的 "🍪 QTools" 浮动按钮

### 方式二：Chrome 扩展

1. 克隆或下载本项目
2. 打开 Chrome 浏览器，进入 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"，选择 `extension` 文件夹
5. 扩展安装后，访问网页时点击工具栏中的 QTools 图标

## 🎮 使用说明

### 基础操作

1. **启用抓取**: 点击浮动按钮打开面板，启用网络请求抓取功能
2. **查看数据**: 在面板中实时查看抓取到的请求和 Cookie
3. **导出数据**: 支持 JSON、HAR 等格式导出
4. **清理数据**: 可随时清空已收集的数据

### 高级设置

- **同源请求**: 仅抓取与当前页面同源的请求
- **全部请求**: 抓取所有请求，忽略过滤规则
- **过滤规则**: 使用正则表达式自定义 URL 过滤规则

### 默认过滤规则

```javascript
/(\/api\/|\/prod-api\/|\/graphql|\/v[0-9]+\/|\/ajax\/)/i
```

匹配常见的 API 请求路径，可根据需要自定义。

## 📁 项目结构

```
QTools/
├── userscript/           # 油猴脚本版本
│   └── qtools.user.js   # 主脚本文件 (v2.3.0)
├── extension/           # Chrome 扩展版本
│   ├── manifest.json    # 扩展清单 (v2.3.0)
│   ├── background.js    # 后台脚本
│   ├── content.js       # 内容脚本
│   └── ui/             # 用户界面
│       ├── popup.html   # 弹窗页面
│       └── popup.js     # 弹窗脚本
├── src/                # 共享代码模块
│   ├── core.js         # 核心功能模块
│   ├── ui.js           # UI 组件模块
│   └── utils.js        # 工具函数模块
├── docs/               # 文档
│   └── development.md  # 开发指南
├── README.md           # 项目说明
├── package.json        # 项目配置
├── LICENSE             # 开源协议
└── CHANGELOG.md        # 更新日志
```

## 🛠️ 技术架构

### 核心架构

QTools 采用统一的核心架构，油猴脚本版本为主要实现，Chrome 扩展版本基于其适配：

- **网络拦截**: 通过注入脚本 Hook 原生 API (fetch、XMLHttpRequest 等)
- **Cookie 合并**: 多源 Cookie 智能合并 (document.cookie、cookieStore、扩展 API)
- **数据存储**: localStorage 本地存储，按域名分组管理
- **UI 组件**: 原生 JavaScript + CSS，轻量级无依赖

### 双模式支持

1. **油猴脚本模式**: 
   - 直接注入页面，具有完整的页面访问权限
   - 支持所有功能，包括高级 Cookie 探测
   - 用户体验最佳，推荐使用

2. **Chrome 扩展模式**:
   - 基于 Manifest V3，符合最新扩展规范  
   - 通过 content script 与页面交互
   - 利用扩展 API 增强 Cookie 访问能力

## 🔧 开发指南

### 环境要求

- Node.js 16+ (用于开发工具)
- 现代浏览器 (Chrome 88+, Firefox 85+)
- Tampermonkey 4.10+ (油猴脚本模式)

### 开发流程

1. **安装依赖**:
   ```bash
   npm install
   ```

2. **开发调试**:
   - 油猴脚本: 直接修改 `userscript/qtools.user.js`
   - Chrome 扩展: 修改 `extension/` 目录下文件

3. **测试验证**:
   ```bash
   npm test
   ```

4. **构建发布**:
   ```bash
   npm run build
   ```

详细开发指南请参考 [development.md](docs/development.md)。

## 📝 更新日志

### v2.3.0 (2025-09-06)
- 🎉 **重大更新**: 基于生产级油猴脚本重构
- ✨ 新增 sendBeacon、EventSource、WebSocket 监控
- 🔧 改进 Cookie 合并算法，支持多路径探测
- 🎨 全新 UI 设计，支持拖拽和实时更新
- 🛡️ 增强安全性，添加域名黑名单保护
- 📦 HAR 格式导出支持
- 🐛 修复多个已知问题

### v1.0.0 (2025-08-28)
- 🎉 初始版本发布
- 🍪 基础 Cookie 抓取功能
- 🌐 Fetch/XHR 请求监控
- 📁 JSON/CSV 数据导出
- 🎯 基础过滤规则支持

完整更新日志请查看 [CHANGELOG.md](CHANGELOG.md)。

## 🤝 贡献指南

我们欢迎任何形式的贡献，包括但不限于：

- 🐛 报告 Bug
- 💡 提出新功能建议  
- 📝 改进文档
- 🔧 提交代码修复
- 🎨 UI/UX 改进

请查看 [贡献指南](CONTRIBUTING.md) 了解更多详情。

## 📄 开源协议

本项目采用 [MIT License](LICENSE) 开源协议。

## ⚠️ 免责声明

- 本工具仅用于合法的网络请求分析和开发调试用途
- 用户应当遵守相关法律法规，不得用于恶意目的
- 建议在使用前阅读目标网站的使用条款
- 对于因使用本工具造成的任何损失，开发者不承担责任

## 🙋‍♂️ 支持与反馈

如果您在使用过程中遇到问题或有任何建议，欢迎：

- 提交 [GitHub Issues](https://github.com/yourusername/QTools/issues)
- 发起 [GitHub Discussions](https://github.com/yourusername/QTools/discussions)  
- 给项目点个 ⭐ Star 支持我们！

---

<div align="center">

**QTools** - 让网络请求和 Cookie 管理更简单 🚀

Made with ❤️ by QTools Team

</div>

## ✨ 特性

### 🍪 Cookie 采集与导出
- **页面可见 Cookie 读取**（userscript 形态）
- **扩展形态下通过 chrome.cookies 读取**（可读取非 HttpOnly 属性，但 **无法** 读取设置为 HttpOnly 的值；见 FAQ）
- **规则化筛选**（域名、名称通配、过期时间）
- **一键导出 JSON/CSV**

### 🌐 网络请求抓取（Fetch / XHR）
- **内容脚本层 非侵入式 "猴补丁" Hook**：fetch、XMLHttpRequest
- **记录请求/响应头、状态码、耗时、大小**（可选记录响应体片段）
- **可配置白名单/黑名单、敏感字段屏蔽与匿名化**

### 📊 可视化与离线
- **浮动面板**（开关/清空/搜索/导出）
- **本地存储**（IndexedDB/localStorage）或临时内存模式
- **Bulk 导出 JSON/CSV**，便于复现与分享（个人/团队）

### 🔧 双形态支持
- **Tampermonkey**：快速上手、零打包
- **Chrome Extension (MV3)**：更强权限与可靠度（chrome.cookies、更稳定的页面隔离与长期使用）

### 👨‍💻 开发者友好
- **TypeScript**（可选）
- **最小依赖，易扩展的 Hook 与数据管线**

## 📂 项目架构

```
qtools/
├─ extension/              # Chrome MV3 扩展
│  ├─ manifest.json       # 扩展清单文件
│  ├─ background.js       # 后台脚本
│  ├─ content.js          # 内容脚本
│  ├─ ui/                 # 漂浮面板 UI
│  │  ├─ popup.html       # 弹出窗口页面
│  │  └─ popup.js         # 弹出窗口脚本
│  └─ icons/              # 图标文件
├─ userscript/
│  └─ qtools.user.js      # 油猴脚本版本（完整功能）
├─ src/                   # 共享逻辑
│  ├─ core.js            # 核心功能模块
│  ├─ ui.js              # UI 组件库
│  └─ utils.js           # 工具函数库
├─ docs/                  # 文档
└─ README.md
```

## 🚀 快速开始

### 方式一：油猴脚本（推荐新手）

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展
2. 复制 `userscript/qtools.user.js` 的内容
3. 在 Tampermonkey 中创建新脚本，粘贴代码并保存
4. 访问任意网页，右上角会出现 QTools 浮动面板

### 方式二：Chrome 扩展

1. 克隆项目到本地
2. 打开 Chrome 浏览器，进入 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"，选择 `extension` 文件夹
5. 扩展安装完成，点击扩展图标即可使用

## 📖 功能说明

### 网络请求监控

QTools 通过非侵入式的方式 Hook 了 `fetch` 和 `XMLHttpRequest` API，能够自动捕获页面发出的所有网络请求，包括：

- 请求 URL、方法、头部信息
- 响应状态码、耗时、大小
- 错误信息（如果请求失败）

### Cookie 收集

- **油猴脚本模式**：只能读取页面可见的 Cookie（非 HttpOnly）
- **Chrome 扩展模式**：可以通过 `chrome.cookies` API 读取更多 Cookie 信息

### 数据导出

支持将收集的数据导出为：
- **JSON 格式**：包含完整的请求和 Cookie 数据
- **CSV 格式**：适合在 Excel 中分析

### 数据匿名化

启用匿名化功能后，敏感信息会被处理：
- URL 查询参数被移除
- 敏感请求头（如 Authorization、Cookie 等）被脱敏
- Cookie 值被掩码处理

## 🎯 使用场景

1. **前端开发调试**：监控页面 API 调用，分析请求响应
2. **接口测试**：记录测试过程中的网络请求，便于问题复现
3. **安全分析**：检查页面 Cookie 设置，发现潜在安全问题
4. **性能分析**：统计请求耗时，识别性能瓶颈
5. **数据导出**：将网络活动数据导出供进一步分析

## ⚙️ 配置选项

- **拦截网络请求**：是否启用网络请求监控
- **收集 Cookie**：是否收集页面 Cookie
- **数据匿名化**：是否对敏感数据进行脱敏处理
- **显示面板**：是否显示浮动面板

## 🔧 键盘快捷键

- `Ctrl/Cmd + Shift + Q`：切换面板显示/隐藏
- `Ctrl/Cmd + Shift + E`：快速导出 JSON 数据

## 🤔 常见问题

### Q: 为什么有些 Cookie 读取不到？
A: 设置了 `HttpOnly` 标志的 Cookie 无法通过 JavaScript 读取，这是浏览器的安全限制。Chrome 扩展模式下可以读取更多 Cookie，但仍然受到一些安全策略限制。

### Q: 会影响页面性能吗？
A: QTools 使用非侵入式的 Hook 技术，对页面性能影响极小。所有数据处理都是异步进行的。

### Q: 数据存储在哪里？
A: 数据存储在浏览器本地（localStorage 或 IndexedDB），不会上传到任何服务器。

### Q: 支持哪些浏览器？
A: 支持所有现代浏览器，包括 Chrome、Firefox、Safari、Edge 等。

## 🛠️ 开发

### 项目结构说明

- `src/core.js`：核心功能模块，包含网络拦截、Cookie 管理、数据过滤等
- `src/ui.js`：UI 组件库，包含浮动面板、统计显示等组件
- `src/utils.js`：通用工具函数
- `extension/`：Chrome 扩展相关文件
- `userscript/`：油猴脚本版本

### 自定义扩展

QTools 采用模块化设计，您可以轻松扩展功能：

```javascript
// 添加自定义请求过滤器
const filter = new DataFilter({
  blacklistDomains: ['example.com'],
  anonymize: true
});

// 添加自定义数据处理
QTools.on('request', (request) => {
  // 自定义处理逻辑
  console.log('New request:', request);
});
```

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**注意**：本工具仅用于开发测试目的，请遵守相关法律法规，不要用于非法用途。
