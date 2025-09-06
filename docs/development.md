# QTools 开发文档

## 开发环境设置

### 项目结构

QTools 采用模块化设计，主要包含以下模块：

- **核心模块** (`src/core.js`)：网络拦截、Cookie 管理、数据处理
- **UI 模块** (`src/ui.js`)：浮动面板、组件库
- **工具模块** (`src/utils.js`)：通用工具函数

### Chrome 扩展开发

1. 修改 `extension/` 目录下的文件
2. 在 Chrome 中重新加载扩展
3. 测试功能

### 油猴脚本开发

1. 修改 `userscript/qtools.user.js`
2. 在 Tampermonkey 中更新脚本
3. 刷新页面测试

## API 文档

### 核心类

#### NetworkInterceptor

网络请求拦截器类，用于 Hook fetch 和 XMLHttpRequest。

```javascript
const interceptor = new NetworkInterceptor((request) => {
  console.log('Captured request:', request);
});

interceptor.install(); // 开始拦截
interceptor.uninstall(); // 停止拦截
```

#### CookieManager

Cookie 管理类，用于获取和管理页面 Cookie。

```javascript
const cookieManager = new CookieManager();
const cookies = cookieManager.getPageCookies();
```

#### DataExporter

数据导出类，支持 JSON 和 CSV 格式导出。

```javascript
const exporter = new DataExporter();
exporter.exportAsJSON(data, { filename: 'my-data.json' });
exporter.exportAsCSV(data, { filename: 'my-data.csv' });
```

### UI 组件

#### FloatingPanel

浮动面板组件，提供可拖拽的面板界面。

```javascript
const panel = new FloatingPanel({
  title: 'My Tool',
  position: { top: 20, right: 20 }
});

panel.create();
panel.setContent('<div>Panel content</div>');
```

## 扩展开发指南

### 添加新的网络过滤规则

```javascript
// 在 DataFilter 类中添加新的过滤方法
class CustomFilter extends DataFilter {
  shouldIgnoreUrl(url) {
    // 自定义过滤逻辑
    if (url.includes('analytics')) {
      return true;
    }
    return super.shouldIgnoreUrl(url);
  }
}
```

### 添加新的导出格式

```javascript
// 在 DataExporter 类中添加新的导出方法
class CustomExporter extends DataExporter {
  exportAsXML(data, options = {}) {
    // 实现 XML 导出逻辑
    const xml = this.convertToXML(data);
    const blob = new Blob([xml], { type: 'application/xml' });
    this.downloadBlob(blob, options.filename || 'data.xml');
  }
}
```

### 自定义 UI 组件

```javascript
// 继承现有组件或创建新组件
class CustomPanel extends FloatingPanel {
  getHTML() {
    return `
      <div class="custom-panel">
        ${super.getHTML()}
        <div class="custom-content">
          <!-- 自定义内容 -->
        </div>
      </div>
    `;
  }
}
```

## 调试技巧

### Chrome 扩展调试

1. 打开 Chrome 开发者工具
2. 在 Console 中访问 `window.QTools` 对象
3. 查看 Background 页面的日志

### 油猴脚本调试

1. 在页面上按 F12 打开开发者工具
2. 在 Console 中输入 `QTools` 查看对象
3. 使用 `console.log` 输出调试信息

### 常见问题排查

- **网络请求未被拦截**：检查 Hook 是否正确安装
- **Cookie 读取失败**：检查页面域名和 Cookie 设置
- **面板不显示**：检查 CSS 样式和 z-index

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

### 代码规范

- 使用 ES6+ 语法
- 遵循 JSDoc 注释规范
- 保持代码简洁可读
- 添加适当的错误处理

### 测试

在提交代码前，请确保：

- [ ] 在 Chrome 扩展模式下测试
- [ ] 在油猴脚本模式下测试
- [ ] 测试主要功能（网络拦截、Cookie 收集、数据导出）
- [ ] 检查是否有控制台错误
