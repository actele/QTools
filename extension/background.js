// QTools Chrome Extension - Background Script v2.3.0
// 服务工作器，处理扩展生命周期、API调用和消息转发

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[QTools] Extension installed/updated:', details.reason);
  
  // 设置默认 badge
  chrome.action.setBadgeText({ text: '' });
  chrome.action.setBadgeBackgroundColor({ color: '#667eea' });
});

// 处理来自 content script 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_COOKIES') {
    // 获取指定域名的 cookies
    if (chrome.cookies) {
      chrome.cookies.getAll({ domain: request.domain }, (cookies) => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true, cookies });
        }
      });
    } else {
      sendResponse({ success: false, error: 'Cookies API not available' });
    }
    return true; // 异步响应
  }
  
  if (request.type === 'COPY_TEXT') {
    // 复制文本到剪贴板
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(request.text).then(() => {
        sendResponse({ success: true });
      }).catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    } else {
      sendResponse({ success: false, error: 'Clipboard API not available' });
    }
    return true; // 异步响应
  }
  
  if (request.type === 'UPDATE_BADGE') {
    // 更新扩展图标 badge
    const badgeText = request.on ? '●' : '';
    const badgeColor = request.on ? '#22c55e' : '#ef4444';
    
    chrome.action.setBadgeText({ 
      text: badgeText,
      tabId: sender.tab?.id 
    });
    chrome.action.setBadgeBackgroundColor({ 
      color: badgeColor,
      tabId: sender.tab?.id 
    });
    
    sendResponse({ success: true });
  }
  
  // 其他消息类型的处理可以在这里添加
});

// 处理扩展图标点击事件
chrome.action.onClicked.addListener((tab) => {
  // 发送消息到 content script 触发面板显示
  chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn('[QTools] Failed to communicate with content script:', chrome.runtime.lastError.message);
      
      // 如果 content script 未注入，则注入它
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('[QTools] Failed to inject content script:', chrome.runtime.lastError.message);
        }
      });
    }
  });
});

// 标签页更新监听（可选）
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // 页面加载完成时重置 badge
    chrome.action.setBadgeText({ text: '', tabId });
  }
});

// 处理存储变化（可选）
chrome.storage.onChanged.addListener((changes, namespace) => {
  console.log('[QTools] Storage changed:', changes, namespace);
});

// 错误处理
chrome.runtime.onSuspend.addListener(() => {
  console.log('[QTools] Service worker suspending...');
});

// 调试信息
console.log('[QTools] Background script loaded v2.3.0');
