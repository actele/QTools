// QTools UI 组件库

/**
 * 浮动面板组件
 */
export class FloatingPanel {
  constructor(options = {}) {
    this.options = {
      title: 'QTools',
      position: { top: 20, right: 20 },
      draggable: true,
      collapsible: true,
      closable: true,
      zIndex: 999999,
      ...options
    };
    
    this.element = null;
    this.isDragging = false;
    this.isCollapsed = false;
    this.callbacks = {};
  }
  
  // 创建面板
  create() {
    this.element = document.createElement('div');
    this.element.className = 'qtools-floating-panel';
    this.element.innerHTML = this.getHTML();
    
    this.applyStyles();
    this.bindEvents();
    
    document.body.appendChild(this.element);
    return this.element;
  }
  
  // 获取面板 HTML
  getHTML() {
    return `
      <div class="qtools-panel-header">
        <span class="qtools-panel-title">${this.options.title}</span>
        <div class="qtools-panel-controls">
          ${this.options.collapsible ? '<button class="qtools-btn-toggle" title="收起/展开">−</button>' : ''}
          ${this.options.closable ? '<button class="qtools-btn-close" title="关闭">×</button>' : ''}
        </div>
      </div>
      <div class="qtools-panel-content">
        <div class="qtools-panel-body"></div>
      </div>
    `;
  }
  
  // 应用样式
  applyStyles() {
    if (!document.getElementById('qtools-panel-styles')) {
      const style = document.createElement('style');
      style.id = 'qtools-panel-styles';
      style.textContent = this.getCSS();
      document.head.appendChild(style);
    }
    
    this.element.style.cssText = `
      position: fixed;
      top: ${this.options.position.top}px;
      right: ${this.options.position.right}px;
      z-index: ${this.options.zIndex};
    `;
  }
  
  // 获取样式
  getCSS() {
    return `
      .qtools-floating-panel {
        width: 280px;
        background: #ffffff;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        font-size: 14px;
        line-height: 1.4;
        user-select: none;
        overflow: hidden;
      }
      
      .qtools-panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        cursor: move;
      }
      
      .qtools-panel-title {
        font-weight: 600;
        font-size: 16px;
      }
      
      .qtools-panel-controls {
        display: flex;
        gap: 4px;
      }
      
      .qtools-panel-controls button {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        width: 24px;
        height: 24px;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        transition: background-color 0.2s;
      }
      
      .qtools-panel-controls button:hover {
        background: rgba(255, 255, 255, 0.3);
      }
      
      .qtools-panel-content {
        max-height: 400px;
        overflow-y: auto;
      }
      
      .qtools-panel-body {
        padding: 16px;
      }
      
      .qtools-floating-panel.collapsed .qtools-panel-content {
        display: none;
      }
      
      .qtools-stats {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
        margin-bottom: 16px;
      }
      
      .qtools-stat {
        text-align: center;
        padding: 12px;
        background: #f8fafc;
        border-radius: 6px;
        border: 1px solid #e2e8f0;
      }
      
      .qtools-stat-number {
        display: block;
        font-size: 24px;
        font-weight: 700;
        color: #3b82f6;
        margin-bottom: 4px;
      }
      
      .qtools-stat-label {
        font-size: 12px;
        color: #64748b;
        font-weight: 500;
      }
      
      .qtools-button-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      .qtools-button {
        padding: 10px 16px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        transition: all 0.2s;
        text-align: center;
      }
      
      .qtools-button.primary {
        background: #3b82f6;
        color: white;
      }
      
      .qtools-button.primary:hover {
        background: #2563eb;
        transform: translateY(-1px);
      }
      
      .qtools-button.secondary {
        background: #f1f5f9;
        color: #475569;
        border: 1px solid #e2e8f0;
      }
      
      .qtools-button.secondary:hover {
        background: #e2e8f0;
      }
      
      .qtools-button.danger {
        background: #ef4444;
        color: white;
      }
      
      .qtools-button.danger:hover {
        background: #dc2626;
      }
      
      .qtools-toggle {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid #e2e8f0;
        margin-bottom: 8px;
      }
      
      .qtools-toggle:last-child {
        border-bottom: none;
        margin-bottom: 0;
      }
      
      .qtools-toggle label {
        font-size: 13px;
        color: #374151;
        cursor: pointer;
      }
      
      .qtools-toggle input[type="checkbox"] {
        margin: 0;
        cursor: pointer;
      }
      
      .qtools-request-item {
        padding: 8px 0;
        border-bottom: 1px solid #f1f5f9;
        font-size: 12px;
      }
      
      .qtools-request-item:last-child {
        border-bottom: none;
      }
      
      .qtools-request-method {
        display: inline-block;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 10px;
        font-weight: 600;
        margin-right: 8px;
        min-width: 40px;
        text-align: center;
      }
      
      .qtools-request-method.GET { background: #dcfce7; color: #166534; }
      .qtools-request-method.POST { background: #dbeafe; color: #1d4ed8; }
      .qtools-request-method.PUT { background: #fef3c7; color: #92400e; }
      .qtools-request-method.DELETE { background: #fecaca; color: #991b1b; }
      
      .qtools-request-status {
        font-weight: 600;
        margin-right: 8px;
      }
      
      .qtools-request-status.success { color: #059669; }
      .qtools-request-status.error { color: #dc2626; }
      
      .qtools-request-url {
        color: #374151;
        word-break: break-all;
      }
      
      .qtools-request-meta {
        color: #6b7280;
        font-size: 11px;
        margin-top: 4px;
      }
    `;
  }
  
  // 绑定事件
  bindEvents() {
    if (this.options.draggable) {
      this.makeDraggable();
    }
    
    // 切换收起/展开
    const toggleBtn = this.element.querySelector('.qtools-btn-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggle());
    }
    
    // 关闭面板
    const closeBtn = this.element.querySelector('.qtools-btn-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }
  }
  
  // 使面板可拖拽
  makeDraggable() {
    const header = this.element.querySelector('.qtools-panel-header');
    let startX, startY, startLeft, startTop;
    
    header.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseInt(window.getComputedStyle(this.element).left, 10);
      startTop = parseInt(window.getComputedStyle(this.element).top, 10);
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      e.preventDefault();
    });
    
    const handleMouseMove = (e) => {
      if (!this.isDragging) return;
      
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      this.element.style.left = (startLeft + deltaX) + 'px';
      this.element.style.top = (startTop + deltaY) + 'px';
      this.element.style.right = 'auto';
    };
    
    const handleMouseUp = () => {
      this.isDragging = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }
  
  // 切换收起/展开
  toggle() {
    this.isCollapsed = !this.isCollapsed;
    this.element.classList.toggle('collapsed', this.isCollapsed);
    
    const toggleBtn = this.element.querySelector('.qtools-btn-toggle');
    if (toggleBtn) {
      toggleBtn.textContent = this.isCollapsed ? '+' : '−';
    }
    
    this.emit('toggle', { collapsed: this.isCollapsed });
  }
  
  // 关闭面板
  close() {
    this.element.style.display = 'none';
    this.emit('close');
  }
  
  // 显示面板
  show() {
    this.element.style.display = 'block';
    this.emit('show');
  }
  
  // 设置内容
  setContent(html) {
    const body = this.element.querySelector('.qtools-panel-body');
    if (body) {
      body.innerHTML = html;
    }
  }
  
  // 添加事件监听
  on(event, callback) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
  }
  
  // 触发事件
  emit(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(callback => callback(data));
    }
  }
  
  // 销毁面板
  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.callbacks = {};
  }
}

/**
 * 统计显示组件
 */
export class StatsDisplay {
  constructor(container) {
    this.container = container;
    this.stats = {
      requests: 0,
      cookies: 0,
      errors: 0
    };
  }
  
  // 更新统计数据
  update(stats) {
    this.stats = { ...this.stats, ...stats };
    this.render();
  }
  
  // 渲染统计显示
  render() {
    this.container.innerHTML = `
      <div class="qtools-stats">
        <div class="qtools-stat">
          <span class="qtools-stat-number">${this.stats.requests}</span>
          <span class="qtools-stat-label">请求数</span>
        </div>
        <div class="qtools-stat">
          <span class="qtools-stat-number">${this.stats.cookies}</span>
          <span class="qtools-stat-label">Cookie</span>
        </div>
        <div class="qtools-stat">
          <span class="qtools-stat-number">${this.stats.errors}</span>
          <span class="qtools-stat-label">错误数</span>
        </div>
      </div>
    `;
  }
}

/**
 * 请求列表组件
 */
export class RequestList {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      maxItems: 50,
      showDetails: true,
      ...options
    };
    this.requests = [];
  }
  
  // 添加请求
  addRequest(request) {
    this.requests.unshift(request);
    if (this.requests.length > this.options.maxItems) {
      this.requests = this.requests.slice(0, this.options.maxItems);
    }
    this.render();
  }
  
  // 清空请求
  clear() {
    this.requests = [];
    this.render();
  }
  
  // 渲染请求列表
  render() {
    if (this.requests.length === 0) {
      this.container.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 20px;">暂无请求记录</div>';
      return;
    }
    
    const html = this.requests.map(request => this.renderRequestItem(request)).join('');
    this.container.innerHTML = html;
  }
  
  // 渲染单个请求项
  renderRequestItem(request) {
    const statusClass = request.status >= 200 && request.status < 300 ? 'success' : 'error';
    const time = new Date(request.timestamp).toLocaleTimeString();
    const url = this.truncateUrl(request.url);
    
    return `
      <div class="qtools-request-item">
        <div>
          <span class="qtools-request-method ${request.method}">${request.method}</span>
          <span class="qtools-request-status ${statusClass}">${request.status}</span>
          <span class="qtools-request-url">${url}</span>
        </div>
        ${this.options.showDetails ? `
          <div class="qtools-request-meta">
            ${request.duration}ms · ${this.formatSize(request.size)} · ${time}
          </div>
        ` : ''}
      </div>
    `;
  }
  
  // 截断 URL
  truncateUrl(url) {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname + urlObj.search;
      return path.length > 50 ? path.substring(0, 50) + '...' : path;
    } catch {
      return url.length > 50 ? url.substring(0, 50) + '...' : url;
    }
  }
  
  // 格式化文件大小
  formatSize(bytes) {
    if (!bytes || bytes === 0) return '0B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
  }
}

/**
 * Cookie 列表组件
 */
export class CookieList {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      maxItems: 100,
      showValues: true,
      ...options
    };
    this.cookies = [];
  }
  
  // 设置 Cookie 数据
  setCookies(cookies) {
    this.cookies = cookies.slice(0, this.options.maxItems);
    this.render();
  }
  
  // 渲染 Cookie 列表
  render() {
    if (this.cookies.length === 0) {
      this.container.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 20px;">暂无 Cookie 数据</div>';
      return;
    }
    
    const html = this.cookies.map(cookie => this.renderCookieItem(cookie)).join('');
    this.container.innerHTML = html;
  }
  
  // 渲染单个 Cookie 项
  renderCookieItem(cookie) {
    const value = this.options.showValues ? 
      this.truncateValue(cookie.value) : 
      '[隐藏]';
    
    return `
      <div class="qtools-request-item">
        <div>
          <strong>${cookie.name}</strong>
          <span style="color: #6b7280; margin-left: 8px;">${value}</span>
        </div>
        <div class="qtools-request-meta">
          ${cookie.domain} · ${cookie.path} · ${cookie.secure ? 'Secure' : ''} ${cookie.httpOnly ? 'HttpOnly' : ''}
        </div>
      </div>
    `;
  }
  
  // 截断值
  truncateValue(value) {
    if (!value) return '';
    return value.length > 30 ? value.substring(0, 30) + '...' : value;
  }
}

/**
 * 设置面板组件
 */
export class SettingsPanel {
  constructor(container, initialConfig = {}) {
    this.container = container;
    this.config = initialConfig;
    this.callbacks = {};
  }
  
  // 渲染设置面板
  render() {
    this.container.innerHTML = `
      <div class="qtools-toggle">
        <label>拦截网络请求</label>
        <input type="checkbox" id="capture-requests" ${this.config.captureRequests ? 'checked' : ''}>
      </div>
      <div class="qtools-toggle">
        <label>收集 Cookie</label>
        <input type="checkbox" id="capture-cookies" ${this.config.captureCookies ? 'checked' : ''}>
      </div>
      <div class="qtools-toggle">
        <label>数据匿名化</label>
        <input type="checkbox" id="anonymize-data" ${this.config.anonymize ? 'checked' : ''}>
      </div>
      <div class="qtools-toggle">
        <label>显示面板</label>
        <input type="checkbox" id="show-panel" ${this.config.showPanel !== false ? 'checked' : ''}>
      </div>
    `;
    
    this.bindEvents();
  }
  
  // 绑定事件
  bindEvents() {
    const checkboxes = this.container.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const key = e.target.id.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        this.config[key] = e.target.checked;
        this.emit('change', { key, value: e.target.checked, config: this.config });
      });
    });
  }
  
  // 更新配置
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.render();
  }
  
  // 添加事件监听
  on(event, callback) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
  }
  
  // 触发事件
  emit(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(callback => callback(data));
    }
  }
}
