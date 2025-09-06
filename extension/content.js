// QTools Chrome Extension - Content Script v2.3.0
// 基于油猴脚本版本的扩展适配

(function() {
  'use strict';
  
  // 避免重复注入
  if (window.QToolsExtension) return;
  window.QToolsExtension = true;
  
  /** ===== 配置 - 从扩展存储中读取 ===== */
  const BTN_TEXT = '🍪 QTools';
  const BTN_INIT_POS = { right: 16, bottom: 16 };
  const SHOW_TOAST = true;

  const DEFAULT_ON  = false;
  const DEFAULT_ALL = false;
  const DEFAULT_SAME = true;
  const DEFAULT_FILTER_REGEX = String(/(\/api\/|\/prod-api\/|\/graphql|\/v[0-9]+\/|\/ajax\/)/i);
  const DEFAULT_COOKIE_ECHO_ENDPOINT = '';

  const CAPTURE_REQ_HEADERS = true;
  const CAPTURE_RES_HEADERS = true;
  const CAPTURE_REQ_BODY   = true;
  const CAPTURE_RES_BODY   = true;
  const CAPTURE_SEND_BEACON = true;
  const CAPTURE_SSE = true;
  const CAPTURE_WEBSOCKET = true;

  const MAX_BODY_KB = 128;
  const MAX_LOGS = 1000;

  const DOMAIN_BLACKLIST = [
    /(?:^|\.)alipay\.com$/i,
    /(?:^|\.)paypal\.com$/i,
    /(?:^|\.)stripe\.com$/i,
    /(bank|icbc|ccb|abc|cmb|citic|spdb|ceb|psbc)/i,
  ];

  const ORIGIN = location.origin;
  const STORE_KEY = '__qtools_site_prefs__';

  // 扩展存储适配器
  function loadAllPrefs(){ 
    try { 
      return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); 
    } catch { 
      return {}; 
    } 
  }
  function saveAllPrefs(p){ 
    localStorage.setItem(STORE_KEY, JSON.stringify(p || {})); 
  }
  function isBlacklistedHost(){ 
    return DOMAIN_BLACKLIST.some(re => { 
      try { 
        return re.test(location.hostname); 
      } catch { 
        return false; 
      } 
    }); 
  }

  function getState() {
    const all = loadAllPrefs();
    const per = all[ORIGIN] || {};
    const black = isBlacklistedHost();
    if (black) return { on:false, all:false, same:true, filter: DEFAULT_FILTER_REGEX, echo: '', black:true };
    return {
      on    : typeof per.on    === 'boolean' ? per.on    : DEFAULT_ON,
      all   : typeof per.all   === 'boolean' ? per.all   : DEFAULT_ALL,
      same  : typeof per.same  === 'boolean' ? per.same  : DEFAULT_SAME,
      filter: typeof per.filter=== 'string'  ? per.filter: DEFAULT_FILTER_REGEX,
      echo  : typeof per.echo  === 'string'  ? per.echo  : DEFAULT_COOKIE_ECHO_ENDPOINT,
      black : false,
    };
  }
  function setState(patch){
    const all = loadAllPrefs();
    const per = all[ORIGIN] || {};
    all[ORIGIN] = { ...per, ...patch };
    saveAllPrefs(all);
    if (isTopWindow()) updateBadge();
  }

  function isTopWindow(){ try { return window.top === window; } catch { return true; } }
  function updateBadge(){
    const st = getState();
    chrome.runtime.sendMessage({ type: 'UPDATE_BADGE', on: st.on });
  }

  // ===== 工具函数 =====
  const NETLOGS = [];
  const clamp = () => { while (NETLOGS.length > MAX_LOGS) NETLOGS.shift(); };
  function toast(msg, ttl=1500){ 
    if(!SHOW_TOAST) return; 
    const t=document.createElement('div'); 
    t.className='qtools-toast'; 
    t.textContent=msg; 
    document.documentElement.appendChild(t); 
    setTimeout(()=>t.remove(), ttl); 
  }
  
  // 扩展版本的复制函数（使用chrome API）
  function copy(text){ 
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      // 发送到 background script 处理
      chrome.runtime.sendMessage({type: 'COPY_TEXT', text}, (response) => {
        if (chrome.runtime.lastError) {
          // 降级到传统方法
          fallbackCopy(text);
        }
      });
    } else {
      fallbackCopy(text);
    }
    return Promise.resolve(); 
  }
  
  function fallbackCopy(text) {
    if(navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      return;
    }
    const ta=document.createElement('textarea'); 
    ta.value=text; 
    document.body.appendChild(ta); 
    ta.select(); 
    document.execCommand('copy'); 
    ta.remove();
  }

  function parseCookie(s){ 
    const o={}; 
    (s||'').split(';').forEach(p=>{ 
      const i=p.indexOf('='); 
      if(i===-1) return; 
      const k=decodeURIComponent(p.slice(0,i).trim()); 
      let v=p.slice(i+1).trim(); 
      try{ v=decodeURIComponent(v) }catch{} 
      o[k]=v; 
    }); 
    return o; 
  }
  
  function toHeader(obj){ 
    return Object.entries(obj).map(([k,v])=>`${k}=${v}`).join('; '); 
  }
  
  function kbLimit(str){ 
    if(typeof str!=='string') return str; 
    const max=MAX_BODY_KB*1024; 
    if(new TextEncoder().encode(str).length>max) 
      return str.slice(0,max)+`\n/* truncated at ${MAX_BODY_KB}KB */`; 
    return str; 
  }
  
  function compileRegex(str){ 
    try{ 
      const m=String(str||'').trim(); 
      if(/^\/.*\/[a-z]*$/i.test(m)){ 
        const body=m.replace(/^\/(.*)\/[a-z]*$/i,'$1'); 
        const flags=m.replace(/^\/.*\/([a-z]*)$/i,'$1'); 
        return new RegExp(body,flags); 
      } 
      const esc=m.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); 
      return new RegExp(esc,'i'); 
    }catch{ 
      return /(\/api\/|\/prod-api\/|\/graphql|\/v[0-9]+\/|\/ajax\/)/i; 
    } 
  }
  
  function isSameOrigin(u){ 
    try{ 
      return new URL(u, location.href).origin === location.origin; 
    }catch{ 
      return false; 
    } 
  }
  
  function shouldKeep(entry){
    const st=getState();
    if(!st.on || st.black) return false;
    if(!entry?.url) return false;
    if(!st.all){
      if(st.same && !isSameOrigin(entry.url)) return false;
      const re=compileRegex(st.filter);
      try{ if(!re.test(String(entry.url))) return false; }catch{ return false; }
    }
    return true;
  }

  // ===== Cookie 合并逻辑 =====
  async function readAllVisibleCookies() {
    const base = parseCookie(document.cookie || '');
    
    // 尝试使用扩展 API 获取更多 Cookie
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      try {
        const response = await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            type: 'GET_COOKIES',
            domain: location.hostname
          }, resolve);
        });
        
        if (response && response.success && response.cookies) {
          const merged = { ...base };
          response.cookies.forEach(cookie => {
            if (!(cookie.name in merged)) {
              merged[cookie.name] = cookie.value;
            }
          });
          return merged;
        }
      } catch (error) {
        console.warn('[QTools] 扩展 Cookie API 调用失败:', error);
      }
    }
    
    // 降级到 Cookie Store API
    if (!('cookieStore' in navigator) || typeof navigator.cookieStore.getAll !== 'function') {
      return base;
    }
    
    const prefixPaths = [];
    const segs = (location.pathname || '/').split('/').filter(Boolean);
    let cur = '';
    for (let i = 0; i < segs.length; i++) { 
      cur += '/' + segs[i]; 
      prefixPaths.push(cur); 
    }
    const candidates = new Set(['/', ...prefixPaths, '/admin', '/api', '/app', '/login', '/static']
      .map(p => new URL(p, location.origin).toString()));
    const merged = { ...base };
    try {
      for (const url of candidates) {
        const list = await navigator.cookieStore.getAll({ url });
        for (const c of list) { 
          if (!(c.name in merged)) merged[c.name] = c.value; 
        }
      }
    } catch (e) { 
      console.debug('[QTools] cookieStore.getAll fallback:', e); 
    }
    return merged;
  }

  // ===== 注入脚本到页面上下文 =====
  const INJECT = `
    (function(){
      'use strict';
      if(window.__QTOOLS_NET_INJECTED__) return;
      window.__QTOOLS_NET_INJECTED__ = true;
      
      const CAPTURE_REQ_HEADERS=${CAPTURE_REQ_HEADERS}, CAPTURE_RES_HEADERS=${CAPTURE_RES_HEADERS},
            CAPTURE_REQ_BODY=${CAPTURE_REQ_BODY}, CAPTURE_RES_BODY=${CAPTURE_RES_BODY},
            CAPTURE_SEND_BEACON=${CAPTURE_SEND_BEACON}, CAPTURE_SSE=${CAPTURE_SSE}, CAPTURE_WEBSOCKET=${CAPTURE_WEBSOCKET},
            MAX_BODY_KB=${MAX_BODY_KB};
      
      const kbLimit = (str) => {
        if(typeof str !== 'string') return str;
        const max = MAX_BODY_KB * 1024;
        if(new TextEncoder().encode(str).length > max) 
          return str.slice(0, max) + \`\\n/* truncated at \${MAX_BODY_KB}KB */\`;
        return str;
      };
      
      const post = (entry) => { 
        try{ 
          window.postMessage({__QTOOLS_NET__:true, entry}, '*'); 
        }catch{} 
        try{ 
          if(window.top && window.top !== window) 
            window.top.postMessage({__QTOOLS_NET__:true, entry}, '*'); 
        }catch{} 
      };
      
      // Hook fetch
      const originalFetch = window.fetch;
      window.fetch = function(...args) {
        const startTime = Date.now();
        const url = args[0];
        const options = args[1] || {};
        
        const reqHeaders = {};
        if(CAPTURE_REQ_HEADERS && options.headers) {
          if(options.headers instanceof Headers) {
            for(const [k,v] of options.headers.entries()) reqHeaders[k] = v;
          } else if(typeof options.headers === 'object') {
            Object.assign(reqHeaders, options.headers);
          }
        }
        
        return originalFetch.apply(this, args).then(response => {
          const endTime = Date.now();
          const resHeaders = {};
          if(CAPTURE_RES_HEADERS) {
            for(const [k,v] of response.headers.entries()) resHeaders[k] = v;
          }
          
          post({
            method: options.method || 'GET',
            url: url.toString(),
            status: response.status,
            statusText: response.statusText,
            requestHeaders: reqHeaders,
            responseHeaders: resHeaders,
            requestBody: CAPTURE_REQ_BODY ? kbLimit(options.body) : undefined,
            responseBody: CAPTURE_RES_BODY ? '[Response body not captured in fetch hook]' : undefined,
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
        const data = { startTime: 0, method: '', url: '', reqHeaders: {}, reqBody: '' };
        
        const originalOpen = xhr.open;
        xhr.open = function(method, url, ...args) {
          data.startTime = Date.now();
          data.method = method;
          data.url = url;
          return originalOpen.apply(this, [method, url, ...args]);
        };
        
        const originalSetRequestHeader = xhr.setRequestHeader;
        xhr.setRequestHeader = function(name, value) {
          if(CAPTURE_REQ_HEADERS) data.reqHeaders[name] = value;
          return originalSetRequestHeader.apply(this, arguments);
        };
        
        const originalSend = xhr.send;
        xhr.send = function(body) {
          if(CAPTURE_REQ_BODY) data.reqBody = kbLimit(body);
          return originalSend.apply(this, arguments);
        };
        
        xhr.addEventListener('loadend', function() {
          const endTime = Date.now();
          const resHeaders = {};
          if(CAPTURE_RES_HEADERS) {
            const headerStr = xhr.getAllResponseHeaders();
            headerStr.split('\\r\\n').forEach(line => {
              const colonIndex = line.indexOf(':');
              if(colonIndex > 0) {
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
      if(CAPTURE_SEND_BEACON && navigator.sendBeacon) {
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
      if(CAPTURE_SSE) {
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
      if(CAPTURE_WEBSOCKET) {
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
      
      // Ready
      try{ 
        window.postMessage({__QTOOLS_NET_READY__:true}, '*'); 
        if(window.top && window.top !== window) 
          window.top.postMessage({__QTOOLS_NET_READY__:true}, '*'); 
      }catch{}
    })();
  `;
  
  const script = document.createElement('script'); 
  script.textContent = INJECT;
  (document.documentElement || document.head || document.body).appendChild(script); 
  script.remove();

  // ===== CSS 样式 =====
  const css = ".qtools-btn { position: fixed; z-index: 999999; background: linear-gradient(45deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 25px; padding: 10px 16px; font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); user-select: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.2); }";
  
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // ===== 消息监听 =====
  addEventListener('message', (e) => {
    const d = e.data;
    if (d?.__QTOOLS_NET_READY__) { 
      const st = getState(); 
      if (st.on) console.log('[QTools] Net hook ready'); 
      return; 
    }
    if (!d?.__QTOOLS_NET__ || !d.entry) return;
    if (!shouldKeep(d.entry)) return;
    NETLOGS.push(d.entry); 
    clamp();
  });

  // 处理来自 popup 的消息
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'GET_DATA') {
        readAllVisibleCookies().then(cookies => {
          sendResponse({
            requests: NETLOGS,
            cookies: Object.entries(cookies).map(([name, value]) => ({ name, value })),
            config: getState()
          });
        });
        return true; // 异步响应
      } else if (request.type === 'EXPORT_DATA') {
        if (request.dataType === 'requests') {
          copy(JSON.stringify(NETLOGS, null, 2));
          toast('已复制请求数据');
        }
      } else if (request.type === 'CLEAR_REQUESTS') {
        NETLOGS.length = 0;
        sendResponse({ success: true });
      } else if (request.type === 'UPDATE_SETTING') {
        setState({ [request.key]: request.value });
        sendResponse({ success: true });
      }
    });
  }

  // 暴露到全局供调试
  window.QTools = {
    getState,
    setState,
    NETLOGS,
    readAllVisibleCookies
  };

})();
