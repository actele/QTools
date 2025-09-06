// QTools Core Module v2.3.0
// 基于油猴脚本的核心功能模块，提供网络请求拦截、Cookie 管理等功能

export class QToolsCore {
  constructor(options = {}) {
    this.config = {
      // 默认配置
      DEFAULT_ON: false,
      DEFAULT_ALL: false,
      DEFAULT_SAME: true,
      DEFAULT_FILTER_REGEX: /(\/api\/|\/prod-api\/|\/graphql|\/v[0-9]+\/|\/ajax\/)/i,
      
      // 捕获配置
      CAPTURE_REQ_HEADERS: true,
      CAPTURE_RES_HEADERS: true,
      CAPTURE_REQ_BODY: true,
      CAPTURE_RES_BODY: true,
      CAPTURE_SEND_BEACON: true,
      CAPTURE_SSE: true,
      CAPTURE_WEBSOCKET: true,
      
      // 限制配置
      MAX_BODY_KB: 128,
      MAX_LOGS: 1000,
      
      // 黑名单域名
      DOMAIN_BLACKLIST: [
        /(?:^|\.)alipay\.com$/i,
        /(?:^|\.)paypal\.com$/i,
        /(?:^|\.)stripe\.com$/i,
        /(bank|icbc|ccb|abc|cmb|citic|spdb|ceb|psbc)/i,
      ],
      
      ...options
    };
    
    this.storage = new QToolsStorage();
    this.logger = new QToolsLogger();
    this.netLogs = [];
    this.isInitialized = false;
  }
  
  // 初始化
  init() {
    if (this.isInitialized) return;
    
    this.logger.info('QTools Core initializing...');
    
    // 检查黑名单
    if (this.isBlacklistedHost()) {
      this.logger.warn('Current host is blacklisted');
      return false;
    }
    
    // 注入网络监控
    this.injectNetworkHooks();
    
    this.isInitialized = true;
    this.logger.info('QTools Core initialized successfully');
    return true;
  }
  
  // 检查是否在黑名单中
  isBlacklistedHost() {
    return this.config.DOMAIN_BLACKLIST.some(regex => {
      try {
        return regex.test(location.hostname);
      } catch (error) {
        this.logger.error('Blacklist check error:', error);
        return false;
      }
    });
  }
  
  // 注入网络监控 Hook
  injectNetworkHooks() {
    const script = document.createElement('script');
    script.textContent = this.generateInjectScript();
    (document.documentElement || document.head || document.body).appendChild(script);
    script.remove();
    
    // 监听来自注入脚本的消息
    window.addEventListener('message', (event) => {
      this.handleNetworkMessage(event);
    });
  }
  
  // 生成注入脚本
  generateInjectScript() {
    const { 
      CAPTURE_REQ_HEADERS, CAPTURE_RES_HEADERS, CAPTURE_REQ_BODY, 
      CAPTURE_RES_BODY, CAPTURE_SEND_BEACON, CAPTURE_SSE, 
      CAPTURE_WEBSOCKET, MAX_BODY_KB 
    } = this.config;
    
    return `
      (function() {
        'use strict';
        if (window.__QTOOLS_NET_INJECTED__) return;
        window.__QTOOLS_NET_INJECTED__ = true;
        
        const CAPTURE_REQ_HEADERS = ${CAPTURE_REQ_HEADERS};
        const CAPTURE_RES_HEADERS = ${CAPTURE_RES_HEADERS};
        const CAPTURE_REQ_BODY = ${CAPTURE_REQ_BODY};
        const CAPTURE_RES_BODY = ${CAPTURE_RES_BODY};
        const CAPTURE_SEND_BEACON = ${CAPTURE_SEND_BEACON};
        const CAPTURE_SSE = ${CAPTURE_SSE};
        const CAPTURE_WEBSOCKET = ${CAPTURE_WEBSOCKET};
        const MAX_BODY_KB = ${MAX_BODY_KB};
        
        const kbLimit = (str) => {
          if (typeof str !== 'string') return str;
          const max = MAX_BODY_KB * 1024;
          if (new TextEncoder().encode(str).length > max) {
            return str.slice(0, max) + '\\n/* truncated at ' + MAX_BODY_KB + 'KB */';
          }
          return str;
        };
        
        const post = (entry) => {
          try {
            window.postMessage({ __QTOOLS_NET__: true, entry }, '*');
          } catch (error) {
            console.warn('QTools post message failed:', error);
          }
        };
        
        // Hook fetch
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
          const startTime = Date.now();
          const url = args[0];
          const options = args[1] || {};
          
          const reqHeaders = {};
          if (CAPTURE_REQ_HEADERS && options.headers) {
            if (options.headers instanceof Headers) {
              for (const [k, v] of options.headers.entries()) {
                reqHeaders[k] = v;
              }
            } else if (typeof options.headers === 'object') {
              Object.assign(reqHeaders, options.headers);
            }
          }
          
          return originalFetch.apply(this, args).then(response => {
            const endTime = Date.now();
            const resHeaders = {};
            
            if (CAPTURE_RES_HEADERS) {
              for (const [k, v] of response.headers.entries()) {
                resHeaders[k] = v;
              }
            }
            
            post({
              method: options.method || 'GET',
              url: url.toString(),
              status: response.status,
              statusText: response.statusText,
              requestHeaders: reqHeaders,
              responseHeaders: resHeaders,
              requestBody: CAPTURE_REQ_BODY ? kbLimit(options.body) : undefined,
              responseBody: CAPTURE_RES_BODY ? '[Fetch response body not captured]' : undefined,
              duration: endTime - startTime,
              timestamp: new Date().toISOString(),
              type: 'fetch'
            });
            
            return response;
          }).catch(error => {
            const endTime = Date.now();
            post({
              method: options.method || 'GET',
              url: url.toString(),
              status: 0,
              statusText: 'Network Error',
              requestHeaders: reqHeaders,
              requestBody: CAPTURE_REQ_BODY ? kbLimit(options.body) : undefined,
              duration: endTime - startTime,
              timestamp: new Date().toISOString(),
              type: 'fetch',
              error: error.message
            });
            throw error;
          });
        };
        
        // Hook XMLHttpRequest
        const OriginalXHR = window.XMLHttpRequest;
        window.XMLHttpRequest = function() {
          const xhr = new OriginalXHR();
          const data = { 
            startTime: 0, 
            method: '', 
            url: '', 
            reqHeaders: {}, 
            reqBody: '' 
          };
          
          const originalOpen = xhr.open;
          xhr.open = function(method, url, ...args) {
            data.startTime = Date.now();
            data.method = method;
            data.url = url;
            return originalOpen.apply(this, [method, url, ...args]);
          };
          
          const originalSetRequestHeader = xhr.setRequestHeader;
          xhr.setRequestHeader = function(name, value) {
            if (CAPTURE_REQ_HEADERS) {
              data.reqHeaders[name] = value;
            }
            return originalSetRequestHeader.apply(this, arguments);
          };
          
          const originalSend = xhr.send;
          xhr.send = function(body) {
            if (CAPTURE_REQ_BODY) {
              data.reqBody = kbLimit(body);
            }
            return originalSend.apply(this, arguments);
          };
          
          xhr.addEventListener('loadend', function() {
            const endTime = Date.now();
            const resHeaders = {};
            
            if (CAPTURE_RES_HEADERS) {
              const headerStr = xhr.getAllResponseHeaders();
              headerStr.split('\\r\\n').forEach(line => {
                const colonIndex = line.indexOf(':');
                if (colonIndex > 0) {
                  const key = line.slice(0, colonIndex).trim();
                  const value = line.slice(colonIndex + 1).trim();
                  resHeaders[key] = value;
                }
              });
            }
            
            post({
              method: data.method,
              url: data.url,
              status: xhr.status,
              statusText: xhr.statusText,
              requestHeaders: data.reqHeaders,
              responseHeaders: resHeaders,
              requestBody: data.reqBody,
              responseBody: CAPTURE_RES_BODY ? kbLimit(xhr.responseText) : undefined,
              duration: endTime - data.startTime,
              timestamp: new Date().toISOString(),
              type: 'xhr'
            });
          });
          
          return xhr;
        };
        
        // Hook sendBeacon
        if (CAPTURE_SEND_BEACON && navigator.sendBeacon) {
          const originalSendBeacon = navigator.sendBeacon;
          navigator.sendBeacon = function(url, data) {
            post({
              method: 'POST',
              url: url.toString(),
              status: 200,
              statusText: 'OK',
              requestBody: CAPTURE_REQ_BODY ? kbLimit(data) : undefined,
              timestamp: new Date().toISOString(),
              type: 'sendBeacon'
            });
            return originalSendBeacon.apply(this, arguments);
          };
        }
        
        // Hook EventSource (SSE)
        if (CAPTURE_SSE && window.EventSource) {
          const OriginalEventSource = window.EventSource;
          window.EventSource = function(url, options) {
            const es = new OriginalEventSource(url, options);
            post({
              method: 'GET',
              url: url.toString(),
              status: 200,
              statusText: 'SSE Connection',
              timestamp: new Date().toISOString(),
              type: 'eventsource'
            });
            return es;
          };
        }
        
        // Hook WebSocket
        if (CAPTURE_WEBSOCKET && window.WebSocket) {
          const OriginalWebSocket = window.WebSocket;
          window.WebSocket = function(url, protocols) {
            const ws = new OriginalWebSocket(url, protocols);
            post({
              method: 'WEBSOCKET',
              url: url.toString(),
              status: 101,
              statusText: 'Switching Protocols',
              timestamp: new Date().toISOString(),
              type: 'websocket'
            });
            return ws;
          };
        }
        
        // 通知就绪
        try {
          window.postMessage({ __QTOOLS_NET_READY__: true }, '*');
          if (window.top && window.top !== window) {
            window.top.postMessage({ __QTOOLS_NET_READY__: true }, '*');
          }
        } catch (error) {
          console.warn('QTools ready message failed:', error);
        }
      })();
    `;
  }
  
  // 处理网络消息
  handleNetworkMessage(event) {
    const data = event.data;
    
    if (data?.__QTOOLS_NET_READY__) {
      this.logger.info('Network hooks ready');
      return;
    }
    
    if (!data?.__QTOOLS_NET__ || !data.entry) return;
    
    if (this.shouldKeepEntry(data.entry)) {
      this.addNetworkLog(data.entry);
    }
  }
  
  // 判断是否应该保留请求记录
  shouldKeepEntry(entry) {
    const state = this.getState();
    
    if (!state.on || state.black) return false;
    if (!entry?.url) return false;
    
    if (!state.all) {
      if (state.same && !this.isSameOrigin(entry.url)) return false;
      
      const regex = this.compileRegex(state.filter);
      try {
        if (!regex.test(String(entry.url))) return false;
      } catch (error) {
        this.logger.warn('Filter regex test failed:', error);
        return false;
      }
    }
    
    return true;
  }
  
  // 添加网络日志
  addNetworkLog(entry) {
    this.netLogs.push(entry);
    
    // 限制日志数量
    while (this.netLogs.length > this.config.MAX_LOGS) {
      this.netLogs.shift();
    }
  }
  
  // 获取当前状态
  getState() {
    return this.storage.getState();
  }
  
  // 设置状态
  setState(patch) {
    return this.storage.setState(patch);
  }
  
  // 判断同源
  isSameOrigin(url) {
    try {
      return new URL(url, location.href).origin === location.origin;
    } catch (error) {
      return false;
    }
  }
  
  // 编译正则表达式
  compileRegex(str) {
    try {
      const m = String(str || '').trim();
      if (/^\/.*\/[a-z]*$/i.test(m)) {
        const body = m.replace(/^\/(.*)\/[a-z]*$/i, '$1');
        const flags = m.replace(/^\/.*\/([a-z]*)$/i, '$1');
        return new RegExp(body, flags);
      }
      const escaped = m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(escaped, 'i');
    } catch (error) {
      this.logger.warn('Regex compile failed:', error);
      return this.config.DEFAULT_FILTER_REGEX;
    }
  }
  
  // 获取网络日志
  getNetworkLogs() {
    return [...this.netLogs];
  }
  
  // 清空网络日志
  clearNetworkLogs() {
    this.netLogs.length = 0;
  }
  
  // 导出 HAR 格式
  exportHAR() {
    return {
      log: {
        version: '1.2',
        creator: { 
          name: 'QTools', 
          version: '2.3.0' 
        },
        entries: this.netLogs.map(entry => ({
          startedDateTime: entry.timestamp,
          time: entry.duration || 0,
          request: {
            method: entry.method || 'GET',
            url: entry.url,
            headers: this.objectToHarHeaders(entry.requestHeaders || {}),
            postData: entry.requestBody ? { text: entry.requestBody } : undefined
          },
          response: {
            status: entry.status || 0,
            statusText: entry.statusText || '',
            headers: this.objectToHarHeaders(entry.responseHeaders || {}),
            content: { text: entry.responseBody || '' }
          }
        }))
      }
    };
  }
  
  // 对象转 HAR headers 格式
  objectToHarHeaders(obj) {
    return Object.entries(obj).map(([name, value]) => ({ name, value }));
  }
  
  // 销毁
  destroy() {
    this.clearNetworkLogs();
    this.isInitialized = false;
    this.logger.info('QTools Core destroyed');
  }
}

// 存储管理器
class QToolsStorage {
  constructor() {
    this.origin = location.origin;
    this.storeKey = '__qtools_site_prefs__';
  }
  
  loadAllPrefs() {
    try {
      return JSON.parse(localStorage.getItem(this.storeKey) || '{}');
    } catch (error) {
      console.warn('Load prefs failed:', error);
      return {};
    }
  }
  
  saveAllPrefs(prefs) {
    try {
      localStorage.setItem(this.storeKey, JSON.stringify(prefs || {}));
    } catch (error) {
      console.warn('Save prefs failed:', error);
    }
  }
  
  getState() {
    const all = this.loadAllPrefs();
    const per = all[this.origin] || {};
    
    return {
      on: typeof per.on === 'boolean' ? per.on : false,
      all: typeof per.all === 'boolean' ? per.all : false,
      same: typeof per.same === 'boolean' ? per.same : true,
      filter: typeof per.filter === 'string' ? per.filter : String(/(\/api\/|\/prod-api\/|\/graphql|\/v[0-9]+\/|\/ajax\/)/i),
      echo: typeof per.echo === 'string' ? per.echo : '',
      black: false
    };
  }
  
  setState(patch) {
    const all = this.loadAllPrefs();
    const per = all[this.origin] || {};
    all[this.origin] = { ...per, ...patch };
    this.saveAllPrefs(all);
  }
}

// 日志管理器
class QToolsLogger {
  constructor() {
    this.prefix = '[QTools]';
  }
  
  info(message, ...args) {
    console.log(this.prefix, message, ...args);
  }
  
  warn(message, ...args) {
    console.warn(this.prefix, message, ...args);
  }
  
  error(message, ...args) {
    console.error(this.prefix, message, ...args);
  }
}
