// QTools Extension Popup Script v2.3.0
// 与 content script 通信，提供 UI 控制界面

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[QTools Popup] Initializing...');
  
  // DOM 元素引用
  const elements = {
    statusIndicator: document.getElementById('status-indicator'),
    statusText: document.getElementById('status-text'),
    requestCount: document.getElementById('request-count'),
    cookieCount: document.getElementById('cookie-count'),
    toggleCapture: document.getElementById('toggle-capture'),
    clearData: document.getElementById('clear-data'),
    exportRequests: document.getElementById('export-requests'),
    exportCookies: document.getElementById('export-cookies'),
    exportHAR: document.getElementById('export-har'),
    settingSame: document.getElementById('setting-same'),
    settingAll: document.getElementById('setting-all'),
    loading: document.getElementById('loading'),
    errorMessage: document.getElementById('error-message')
  };
  
  let currentData = {
    requests: [],
    cookies: [],
    config: {
      on: false,
      all: false,
      same: true,
      black: false
    }
  };
  
  // 获取当前活动标签页
  async function getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }
  
  // 发送消息到 content script
  async function sendMessageToContent(message) {
    try {
      const tab = await getCurrentTab();
      if (!tab?.id) throw new Error('无法获取当前标签页');
      
      return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
    } catch (error) {
      console.warn('[QTools Popup] Message failed:', error);
      throw error;
    }
  }
  
  // 显示错误信息
  function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.style.display = 'block';
    setTimeout(() => {
      elements.errorMessage.style.display = 'none';
    }, 5000);
  }
  
  // 显示加载状态
  function setLoading(loading) {
    elements.loading.classList.toggle('show', loading);
  }
  
  // 更新 UI 状态
  function updateUI() {
    const { config, requests, cookies } = currentData;
    
    // 更新状态指示器
    elements.statusIndicator.classList.toggle('active', config.on && !config.black);
    
    // 更新状态文本
    if (config.black) {
      elements.statusText.textContent = '当前站点已被列入黑名单，无法进行抓取';
    } else if (config.on) {
      elements.statusText.textContent = '正在抓取网络请求和 Cookie 数据';
    } else {
      elements.statusText.textContent = '抓取功能已关闭，点击"启用抓取"开始监控';
    }
    
    // 更新统计数据
    elements.requestCount.textContent = requests.length;
    elements.cookieCount.textContent = cookies.length;
    
    // 更新按钮状态
    if (config.black) {
      elements.toggleCapture.textContent = '站点受限';
      elements.toggleCapture.disabled = true;
      elements.toggleCapture.className = 'btn btn-secondary';
    } else {
      elements.toggleCapture.textContent = config.on ? '停止抓取' : '启用抓取';
      elements.toggleCapture.disabled = false;
      elements.toggleCapture.className = config.on ? 'btn btn-danger' : 'btn btn-primary';
    }
    
    // 更新设置复选框
    elements.settingSame.checked = config.same;
    elements.settingAll.checked = config.all;
    
    // 更新导出按钮状态
    elements.exportRequests.disabled = requests.length === 0;
    elements.exportCookies.disabled = cookies.length === 0;
    elements.exportHAR.disabled = requests.length === 0;
    elements.clearData.disabled = requests.length === 0 && cookies.length === 0;
  }
  
  // 加载数据
  async function loadData() {
    try {
      setLoading(true);
      const response = await sendMessageToContent({ type: 'GET_DATA' });
      
      if (response) {
        currentData = response;
        updateUI();
      } else {
        throw new Error('未收到数据响应');
      }
    } catch (error) {
      console.error('[QTools Popup] Load data failed:', error);
      showError('无法与页面通信，请刷新页面后重试');
    } finally {
      setLoading(false);
    }
  }
  
  // 切换抓取状态
  async function toggleCapture() {
    try {
      const newState = !currentData.config.on;
      await sendMessageToContent({ 
        type: 'UPDATE_SETTING', 
        key: 'on', 
        value: newState 
      });
      
      currentData.config.on = newState;
      updateUI();
      
      // 显示状态提示
      const message = newState ? '已启用网络请求抓取' : '已停止网络请求抓取';
      showStatusToast(message);
    } catch (error) {
      showError('切换抓取状态失败');
    }
  }
  
  // 清空数据
  async function clearData() {
    try {
      await sendMessageToContent({ type: 'CLEAR_REQUESTS' });
      currentData.requests = [];
      currentData.cookies = [];
      updateUI();
      showStatusToast('已清空所有数据');
    } catch (error) {
      showError('清空数据失败');
    }
  }
  
  // 导出请求数据
  async function exportRequests() {
    try {
      await sendMessageToContent({ type: 'EXPORT_DATA', dataType: 'requests' });
      showStatusToast('请求数据已复制到剪贴板');
    } catch (error) {
      showError('导出请求数据失败');
    }
  }
  
  // 导出 Cookie
  async function exportCookies() {
    try {
      // 直接调用 content script 的导出功能
      const tab = await getCurrentTab();
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          if (window.QTools && window.QTools.exportCookies) {
            window.QTools.exportCookies();
          }
        }
      });
      showStatusToast('Cookie 数据已复制到剪贴板');
    } catch (error) {
      showError('导出 Cookie 失败');
    }
  }
  
  // 导出 HAR
  async function exportHAR() {
    try {
      const tab = await getCurrentTab();
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          if (window.QTools && window.QTools.exportHAR) {
            window.QTools.exportHAR();
          }
        }
      });
      showStatusToast('HAR 数据已复制到剪贴板');
    } catch (error) {
      showError('导出 HAR 失败');
    }
  }
  
  // 更新设置
  async function updateSetting(key, value) {
    try {
      await sendMessageToContent({ 
        type: 'UPDATE_SETTING', 
        key, 
        value 
      });
      
      currentData.config[key] = value;
      updateUI();
    } catch (error) {
      showError('更新设置失败');
    }
  }
  
  // 显示状态提示
  function showStatusToast(message) {
    // 简单的状态提示，可以后续改进
    console.log('[QTools] ' + message);
  }
  
  // 绑定事件监听器
  elements.toggleCapture.addEventListener('click', toggleCapture);
  elements.clearData.addEventListener('click', () => {
    if (confirm('确定要清空所有数据吗？')) {
      clearData();
    }
  });
  
  elements.exportRequests.addEventListener('click', exportRequests);
  elements.exportCookies.addEventListener('click', exportCookies);
  elements.exportHAR.addEventListener('click', exportHAR);
  
  elements.settingSame.addEventListener('change', (e) => {
    updateSetting('same', e.target.checked);
  });
  
  elements.settingAll.addEventListener('change', (e) => {
    updateSetting('all', e.target.checked);
  });
  
  // 定期刷新数据
  setInterval(() => {
    if (!elements.loading.classList.contains('show')) {
      loadData();
    }
  }, 2000);
  
  // 初始化加载
  await loadData();
  
  console.log('[QTools Popup] Initialized successfully');
});
