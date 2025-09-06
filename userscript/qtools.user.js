// ==UserScript==
// @name         QTools - Cookie & Network Capture Tool
// @namespace    https://github.com/actele/QTools
// @version      2.3.0
// @description  稳定抓取 fetch/XHR/sendBeacon/SSE/WebSocket；只在顶层窗口显示按钮；watchdog 防覆盖；设置里可切换开关/全量/同源/过滤正则 & Cookie回显端点；Cookie合并多Path(非HttpOnly) + 一键抓全(含HttpOnly,需端点)；网络面板支持实时筛选与导出HAR；Alt+N 网络面板；Alt+Shift+G 开/关本域抓取（仅自测/合法用途）
// @author       actele
// @match        *://*/*
// @run-at       document-start
// @inject-into  page
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function () {
  'use strict';

  /** ===== 默认配置 ===== */
  const BTN_TEXT = '🍪 QTools';
  const BTN_INIT_POS = { right: 16, bottom: 16 };
  const SHOW_TOAST = true;

  const DEFAULT_ON  = false;   // 初次默认关闭本域抓取
  const DEFAULT_ALL = false;   // 默认按过滤
  const DEFAULT_SAME = true;   // 默认仅同源
  const DEFAULT_FILTER_REGEX = String(/(\/api\/|\/prod-api\/|\/graphql|\/v[0-9]+\/|\/ajax\/)/i);
  const DEFAULT_COOKIE_ECHO_ENDPOINT = ''; // 例: /__echo_cookie__ （同源优先）

  // 抓取细节
  const CAPTURE_REQ_HEADERS = true;
  const CAPTURE_RES_HEADERS = true;
  const CAPTURE_REQ_BODY   = true;
  const CAPTURE_RES_BODY   = true;
  const CAPTURE_SEND_BEACON = true;
  const CAPTURE_SSE = true;
  const CAPTURE_WEBSOCKET = true;

  const MAX_BODY_KB = 128;
  const MAX_LOGS = 1000;

  // 黑名单域（强制关闭）
  const DOMAIN_BLACKLIST = [
    /(?:^|\.)alipay\.com$/i,
    /(?:^|\.)paypal\.com$/i,
    /(?:^|\.)stripe\.com$/i,
    /(bank|icbc|ccb|abc|cmb|citic|spdb|ceb|psbc)/i,
  ];
  /** ==================== */

  const ORIGIN = location.origin;
  const STORE_KEY = '__qtools_site_prefs__';

  function loadAllPrefs(){ try { return JSON.parse(GM_getValue(STORE_KEY, '{}')); } catch { return {}; } }
  function saveAllPrefs(p){ GM_setValue(STORE_KEY, JSON.stringify(p || {})); }
  function isBlacklistedHost(){ return DOMAIN_BLACKLIST.some(re => { try { return re.test(location.hostname); } catch { return false; } }); }

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

  // ===== 工具 =====
  const NETLOGS = [];
  const clamp = () => { while (NETLOGS.length > MAX_LOGS) NETLOGS.shift(); };
  function toast(msg, ttl=1500){ if(!SHOW_TOAST) return; const t=document.createElement('div'); t.className='qtools-toast'; t.textContent=msg; document.documentElement.appendChild(t); setTimeout(()=>t.remove(), ttl); }
  function copy(t){ if(typeof GM_setClipboard==='function'){ GM_setClipboard(t,{type:'text'}); return Promise.resolve(); } if(navigator.clipboard?.writeText) return navigator.clipboard.writeText(t); const ta=document.createElement('textarea'); ta.value=t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); return Promise.resolve(); }
  function parseCookie(s){ const o={}; (s||'').split(';').forEach(p=>{ const i=p.indexOf('='); if(i===-1) return; const k=decodeURIComponent(p.slice(0,i).trim()); let v=p.slice(i+1).trim(); try{ v=decodeURIComponent(v) }catch{} o[k]=v; }); return o; }
  function toHeader(obj){ return Object.entries(obj).map(([k,v])=>`${k}=${v}`).join('; '); }
  function kbLimit(str){ if(typeof str!=='string') return str; const max=MAX_BODY_KB*1024; if(new TextEncoder().encode(str).length>max) return str.slice(0,max)+`\n/* truncated at ${MAX_BODY_KB}KB */`; return str; }
  function compileRegex(str){ try{ const m=String(str||'').trim(); if(/^\/.*\/[a-z]*$/i.test(m)){ const body=m.replace(/^\/(.*)\/[a-z]*$/i,'$1'); const flags=m.replace(/^\/.*\/([a-z]*)$/i,'$1'); return new RegExp(body,flags); } const esc=m.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); return new RegExp(esc,'i'); }catch{ return /(\/api\/|\/prod-api\/|\/graphql|\/v[0-9]+\/|\/ajax\/)/i; } }
  function isSameOrigin(u){ try{ return new URL(u, location.href).origin === location.origin; }catch{ return false; } }
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

  // ===== Cookie Store API：尽量合并多 Path 的可读 Cookie（非 HttpOnly）=====
  async function readAllVisibleCookies() {
    const base = parseCookie(document.cookie || '');
    if (!('cookieStore' in navigator) || typeof navigator.cookieStore.getAll !== 'function') {
      return base;
    }
    const prefixPaths = [];
    const segs = (location.pathname || '/').split('/').filter(Boolean);
    let cur = '';
    for (let i = 0; i < segs.length; i++) { cur += '/' + segs[i]; prefixPaths.push(cur); }
    const candidates = new Set(['/', ...prefixPaths, '/admin', '/api', '/app', '/login', '/static']
      .map(p => new URL(p, location.origin).toString()));
    const merged = { ...base };
    try {
      for (const url of candidates) {
        const list = await navigator.cookieStore.getAll({ url });
        for (const c of list) { if (!(c.name in merged)) merged[c.name] = c.value; }
      }
    } catch (e) { console.debug('[QTools] cookieStore.getAll fallback:', e); }
    return merged;
  }

  // ===== 样式 =====
  GM_addStyle(`
    .qtools-fab{position:fixed;right:${BTN_INIT_POS.right}px;bottom:${BTN_INIT_POS.bottom}px;z-index:2147483647;
      padding:10px 14px;border-radius:999px;box-shadow:0 6px 18px rgba(0,0,0,.2);background:#111;color:#fff;
      font-size:14px;cursor:grab;opacity:.92;display:inline-flex;align-items:center;gap:8px;
      font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif;}
    .qtools-fab:active{cursor:grabbing;}
    .qtools-fab-badge{position:absolute;right:-6px;top:-6px;background:#16a34a;color:#fff;border-radius:10px;padding:2px 6px;font-size:10px;line-height:1;}
    .qtools-fab-badge.off{background:#6b7280;}
    .qtools-toast{position:fixed;left:50%;transform:translateX(-50%);bottom:72px;background:#111;color:#fff;
      padding:8px 12px;border-radius:8px;font-size:12px;box-shadow:0 6px 18px rgba(0,0,0,.2);z-index:2147483647;opacity:.95;}
    .qtools-panel-mask{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;}
    .qtools-panel{width:min(1000px,94vw);max-height:86vh;overflow:auto;background:#fff;border-radius:12px;
      padding:16px 16px 12px;font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,Arial,"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif;color:#111;box-shadow:0 10px 32px rgba(0,0,0,.25);}
    .qtools-panel pre{white-space:pre-wrap;word-break:break-all;border:1px solid #eee;border-radius:8px;padding:10px;margin:0;background:#fafafa;}
    .qtools-btn{padding:6px 10px;border-radius:8px;border:1px solid #eaeaea;background:#f7f7f7;cursor:pointer;}
    .qtools-btn:hover{background:#efefef;}
    .qtools-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;}
    .qtools-actions{display:flex;gap:8px;flex-wrap:wrap;}
    .qtools-table{width:100%;border-collapse:collapse;font-size:13px;}
    .qtools-table th,.qtools-table td{padding:6px 8px;border-bottom:1px solid #eee;vertical-align:top;text-align:left;}
    .qtools-badge{display:inline-block;padding:2px 6px;border-radius:6px;background:#f0f0f0;font-size:12px;}
    .qtools-link{color:#1677ff;cursor:pointer;text-decoration:underline;}
    .qtools-nowrap{white-space:nowrap;}
    .qtools-row{display:flex;align-items:center;gap:8px;margin:6px 0;flex-wrap:wrap;}
    .qtools-row label{display:flex;align-items:center;gap:6px;}
    .qtools-input{padding:6px 8px;border:1px solid #e5e7eb;border-radius:8px;min-width:320px;}
    .qtools-filter{flex:1; min-width:240px;}
    .qtools-hint{color:#666;font-size:12px;}
  `);

  // ===== 仅顶层窗口显示按钮（防重复） =====
  const FAB_ID = 'qtools-fab';
  function mountFabOnce(){
    if(!isTopWindow()) return;
    if(window.__QTOOLS_FAB_EXIST__) return;
    if(document.getElementById(FAB_ID)) return;
    window.__QTOOLS_FAB_EXIST__ = true;

    const btn = document.createElement('div');
    btn.id = FAB_ID;
    btn.className = 'qtools-fab';
    btn.innerHTML = `<span>${BTN_TEXT}</span>`;
    btn.title = '点击查看 Cookie/UA；Alt+N 网络面板；Alt+Shift+G 开/关本域抓取';

    const badge = document.createElement('div');
    badge.className = 'qtools-fab-badge off';
    badge.textContent = 'OFF';
    btn.appendChild(badge);

    function updateBadge(){
      const st = getState();
      badge.textContent = st.on ? 'ON' : 'OFF';
      badge.classList.toggle('off', !st.on);
    }
    updateBadge();
    window.__QTOOLS_UPDATE_BADGE__ = updateBadge; // 外部刷新

    // 记忆位置
    const POS_KEY='__qtools_fab_pos__';
    try{
      const s=JSON.parse(localStorage.getItem(POS_KEY)||'{}');
      if(typeof s.right==='number') btn.style.right=s.right+'px';
      if(typeof s.bottom==='number') btn.style.bottom=s.bottom+'px';
    }catch{}
    const savePos=()=>{ const r=parseInt(btn.style.right,10)||BTN_INIT_POS.right; const b=parseInt(btn.style.bottom,10)||BTN_INIT_POS.bottom; localStorage.setItem(POS_KEY, JSON.stringify({right:r,bottom:b})); };
    (function(){ let sx=0,sy=0,sr=0,sb=0,drag=false;
      const dn=(x,y)=>{ drag=true; btn.style.transition='none'; btn.style.cursor='grabbing';
        sx=x; sy=y; const rect=btn.getBoundingClientRect(); sr=innerWidth-rect.right; sb=innerHeight-rect.bottom; };
      const mv=(x,y)=>{ if(!drag) return; btn.style.right=Math.max(4, sr-(x-sx))+'px'; btn.style.bottom=Math.max(4, sb-(y-sy))+'px'; };
      const up=()=>{ if(!drag) return; drag=false; btn.style.cursor='grab'; btn.style.transition=''; savePos(); };
      btn.addEventListener('mousedown',e=>{ dn(e.clientX,e.clientY); e.preventDefault(); });
      addEventListener('mousemove',e=>mv(e.clientX,e.clientY));
      addEventListener('mouseup',up);
      btn.addEventListener('touchstart',e=>{ const t=e.touches[0]; dn(t.clientX,t.clientY); },{passive:true});
      addEventListener('touchmove',e=>{ const t=e.touches[0]; mv(t.clientX,t.clientY); },{passive:true});
      addEventListener('touchend',up);
    })();

    // 打开 Cookie/UA 面板（异步合并可读 Cookie）
    btn.addEventListener('click', async ()=> { const parsed=await readAllVisibleCookies(); openCookiePanel(parsed); });

    // 安装与保活
    const ensure=()=>{ if(!document.getElementById(FAB_ID)) document.documentElement.appendChild(btn); };
    new MutationObserver(ensure).observe(document.documentElement,{childList:true,subtree:true}); ensure();

    // 快捷键（顶层）
    addEventListener('keydown', (e) => {
      if (e.altKey && !e.shiftKey && e.code === 'KeyN') { openNetPanel(); }
      if (e.altKey && e.shiftKey && e.code === 'KeyG') {
        const st = getState();
        if (st.black) { toast('该域在黑名单，已强制关闭'); return; }
        setState({ on: !st.on });
        toast(`本域抓取：${!st.on ? '开启' : '关闭'}`);
        updateBadge();
      }
    }, { capture: true });
  }
  function updateBadge(){ try{ window.__QTOOLS_UPDATE_BADGE__ && window.__QTOOLS_UPDATE_BADGE__(); }catch{} }

  // ===== 通用弹窗工具：武装延迟 + 内部阻断 =====
  function armMask(mask){ mask.dataset.armed='0'; requestAnimationFrame(()=>{ mask.dataset.armed='1'; }); }
  function makeMaskClose(mask, panel){
    panel.addEventListener('click', e=>e.stopPropagation());
    mask.addEventListener('click', (e)=>{ if(e.target!==mask) return; if(mask.dataset.armed!=='1'){ e.preventDefault(); return; } mask.remove(); });
  }

  // ===== Cookie 回显端点 =====
  async function fetchEchoCookie(endpoint){
    if(!endpoint){ toast('请先在设置里配置"Cookie 回显端点"'); throw new Error('no endpoint');}
    const res = await fetch(endpoint, { method:'GET', credentials:'include' });
    const text = await res.text();
    try{
      const j = JSON.parse(text);
      const val = j.cookieHeader || j.cookie || j.headers?.cookie || '';
      return String(val||'').trim() || text.trim();
    }catch{
      return text.trim();
    }
  }

  // ===== Cookie/UA 面板 =====
  function openCookiePanel(obj){
    const mask=document.createElement('div'); mask.className='qtools-panel-mask'; armMask(mask);
    const panel=document.createElement('div'); panel.className='qtools-panel'; makeMaskClose(mask,panel);

    const jsonStr=JSON.stringify(obj,null,2);
    const headerStr=toHeader(obj);
    const uaStr=navigator.userAgent;
    const st=getState();

    panel.innerHTML = `
      <div class="qtools-head">
        <strong>Cookie 预览（仅非 HttpOnly，可读 ${Object.keys(obj).length} 条）</strong>
        <div class="qtools-actions">
          <button class="qtools-btn" id="cph">复制 Header</button>
          <button class="qtools-btn" id="cpj">复制 JSON</button>
          <button class="qtools-btn" id="cpu">复制 UA</button>
          <button class="qtools-btn" id="full">抓全 Cookie（需端点）</button>
          <button class="qtools-btn" id="opn">网络请求</button>
          <button class="qtools-btn" id="cfg">设置</button>
          <button class="qtools-btn" id="cls">关闭</button>
        </div>
      </div>
      <pre>${Object.entries(obj).map(([k,v])=>`${k} = ${v}`).join('\n') || '(无可读 Cookie)'}</pre>
      <pre style="margin-top:10px;">User-Agent: ${uaStr}</pre>
      <div class="qtools-hint" style="margin-top:8px;">
        * 浏览器 JS 读不到 HttpOnly；"抓全 Cookie"需回显端点。<br/>
        * 当前站点：${st.on ? '抓取开启' : '抓取关闭'}；仅同源：${st.same ? '是' : '否'}；模式：${st.all ? '全量' : '按过滤'}；过滤：${st.filter}；回显端点：${st.echo||'(未配置)'}
      </div>
    `;
    mask.appendChild(panel); document.documentElement.appendChild(mask);

    panel.querySelector('#cls').addEventListener('click',(e)=>{ e.stopPropagation(); mask.remove(); });
    panel.querySelector('#cph').addEventListener('click',async(e)=>{ e.stopPropagation(); await copy(headerStr); toast('已复制 Header'); });
    panel.querySelector('#cpj').addEventListener('click',async(e)=>{ e.stopPropagation(); await copy(jsonStr); toast('已复制 JSON'); });
    panel.querySelector('#cpu').addEventListener('click',async(e)=>{ e.stopPropagation(); await copy(uaStr); toast('已复制 UA'); });
    panel.querySelector('#opn').addEventListener('click',(e)=>{ e.preventDefault(); e.stopPropagation(); mask.remove(); setTimeout(()=>openNetPanel(),0); });
    panel.querySelector('#cfg').addEventListener('click',(e)=>{ e.preventDefault(); e.stopPropagation(); mask.remove(); setTimeout(()=>openSettingsPanel(),0); });
    panel.querySelector('#full').addEventListener('click', async (e)=>{
      e.preventDefault(); e.stopPropagation();
      try{
        const raw = await fetchEchoCookie(getState().echo);
        if(!raw){ toast('端点返回为空'); return; }
        const mm=document.createElement('div'); mm.className='qtools-panel-mask'; armMask(mm);
        const pp=document.createElement('div'); pp.className='qtools-panel'; makeMaskClose(mm,pp);
        pp.innerHTML = `
          <div class="qtools-head">
            <strong>完整 Cookie（包含 HttpOnly，来自服务端回显）</strong>
            <div class="qtools-actions">
              <button class="qtools-btn" id="cp">复制</button>
              <button class="qtools-btn" id="close">关闭</button>
            </div>
          </div>
          <pre>${raw}</pre>
          <div class="qtools-hint">这是"请求头 Cookie"原文；可直接粘贴到工具或 cURL。</div>
        `;
        mm.appendChild(pp); document.documentElement.appendChild(mm);
        pp.querySelector('#cp').addEventListener('click', async (x)=>{ x.stopPropagation(); await copy(raw); toast('已复制'); });
        pp.querySelector('#close').addEventListener('click', (x)=>{ x.stopPropagation(); mm.remove(); });
      }catch(err){ console.error(err); toast('抓全失败：端点无响应或跨域受限'); }
    });
  }

  // ===== 设置面板 =====
  function openSettingsPanel(){
    const st=getState();
    const mask=document.createElement('div'); mask.className='qtools-panel-mask'; armMask(mask);
    const panel=document.createElement('div'); panel.className='qtools-panel'; makeMaskClose(mask,panel);

    panel.innerHTML = `
      <div class="qtools-head">
        <strong>抓取设置（仅当前站点）</strong>
        <div class="qtools-actions">
          <button class="qtools-btn" id="save">保存</button>
          <button class="qtools-btn" id="cls">关闭</button>
        </div>
      </div>
      <div class="qtools-row">
        <label><input type="checkbox" id="on"   ${st.on?'checked':''}/> 开启抓取（ON/OFF）</label>
        <label><input type="checkbox" id="all"  ${st.all?'checked':''}/> 全量抓取（忽略过滤）</label>
        <label><input type="checkbox" id="same" ${st.same?'checked':''}/> 仅同源</label>
      </div>
      <div class="qtools-row">
        <div>过滤正则：</div>
        <input class="qtools-input" id="re" value="${String(st.filter).replace(/"/g,'&quot;')}"/>
        <button class="qtools-btn" id="test">测试</button>
      </div>
      <div class="qtools-row">
        <div>Cookie 回显端点：</div>
        <input class="qtools-input" id="echo" placeholder="/__echo_cookie__" value="${String(st.echo||'').replace(/"/g,'&quot;')}"/>
      </div>
      <div class="qtools-hint">
        * 端点需返回"请求头 Cookie"；可返回 JSON: {"cookieHeader":"..."} 或纯文本。建议同源部署。<br/>
        * 过滤正则可用 /.../i，或直接关键字（按包含匹配）。
      </div>
    `;
    mask.appendChild(panel); document.documentElement.appendChild(mask);

    panel.querySelector('#cls').addEventListener('click',(e)=>{ e.stopPropagation(); mask.remove(); });
    panel.querySelector('#test').addEventListener('click',(e)=>{ e.stopPropagation(); try{ const re=compileRegex(panel.querySelector('#re').value.trim()); toast(`正则可用：${re}`);}catch{ toast('正则无效'); } });
    panel.querySelector('#save').addEventListener('click',(e)=>{
      e.stopPropagation();
      const on   = panel.querySelector('#on').checked;
      const all  = panel.querySelector('#all').checked;
      const same = panel.querySelector('#same').checked;
      const reStr= panel.querySelector('#re').value.trim() || DEFAULT_FILTER_REGEX;
      const echo = panel.querySelector('#echo').value.trim();
      setState({ on, all, same, filter: reStr, echo });
      toast('已保存设置'); mask.remove(); updateBadge();
    });
  }

  // ===== HAR 导出 =====
  function toHarHeaders(obj) {
    if (!obj) return [];
    return Object.entries(obj).map(([name, value]) => ({ name: String(name), value: String(value) }));
  }
  function toQueryString(url) {
    try {
      const u = new URL(url, location.href);
      return Array.from(u.searchParams.entries()).map(([name, value]) => ({ name, value }));
    } catch { return []; }
  }
  function buildHar() {
    const started = new Date();
    const log = {
      log: {
        version: '1.2',
        creator: { name: 'QTools', version: '2.3.0' },
        pages: [{
          startedDateTime: started.toISOString(),
          id: 'page_1',
          title: document.title || location.href,
          pageTimings: { onContentLoad: -1, onLoad: -1 }
        }],
        entries: NETLOGS.map((x) => {
          const startedDateTime = new Date(x.startTime || Date.now()).toISOString();
          const time = Number.isFinite(x.duration) ? x.duration : 0;
          const reqHeaders = toHarHeaders(x.request?.headers);
          const resHeaders = toHarHeaders(x.response?.headers);
          const postData = x.request?.body == null ? undefined : {
            mimeType: typeof x.request.body === 'string' ? 'text/plain' : 'application/json',
            text: typeof x.request.body === 'string' ? String(x.request.body) : JSON.stringify(x.request.body, null, 2)
          };
          const content = x.response?.body == null ? { size: -1, mimeType: resHeaders.find(h=>h.name.toLowerCase()==='content-type')?.value || '' }
            : { size: -1, mimeType: resHeaders.find(h=>h.name.toLowerCase()==='content-type')?.value || 'text/plain', text: typeof x.response.body === 'string' ? String(x.response.body) : JSON.stringify(x.response.body, null, 2) };
          return {
            pageref: 'page_1',
            startedDateTime,
            time,
            request: {
              method: x.method || 'GET',
              url: x.url || '',
              httpVersion: 'HTTP/1.1',
              headers: reqHeaders,
              queryString: toQueryString(x.url || ''),
              headersSize: -1,
              bodySize: -1,
              postData
            },
            response: {
              status: Number.isFinite(x.status) ? x.status : 0,
              statusText: '',
              httpVersion: 'HTTP/1.1',
              headers: resHeaders,
              cookies: [],
              content,
              redirectURL: '',
              headersSize: -1,
              bodySize: -1
            },
            cache: {},
            timings: { send: 0, wait: time, receive: 0 }
          };
        })
      }
    };
    return log;
  }
  function downloadHar() {
    const har = buildHar();
    const blob = new Blob([JSON.stringify(har, null, 2)], { type: 'application/json' });
    const ts = new Date().toISOString().replace(/[:.]/g,'-');
    const a = document.createElement('a');
    a.download = `qtools-${location.hostname}-${ts}.har`;
    a.href = URL.createObjectURL(blob);
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    toast('已导出 HAR');
  }

  // ===== 网络面板（实时筛选 + 导出HAR） =====
  function rowHTML(x, i) {
    const color = x.status >= 200 && x.status < 400 ? '#52c41a' : (x.status ? '#faad14' : '#ff4d4f');
    return `<tr>
      <td class="qtools-nowrap"><span class="qtools-badge" title="${new Date(x.startTime).toLocaleString()}">${x.method}</span></td>
      <td style="max-width:580px;word-break:break-all;"><div>${x.url}</div><div style="color:#666;font-size:12px;">${x.status ?? '-'} • ${x.duration ?? '-'}ms</div></td>
      <td class="qtools-nowrap"><span style="color:${color}">${x.status ?? '-'}</span></td>
      <td class="qtools-nowrap">${x.duration ?? '-'}ms</td>
      <td class="qtools-nowrap"><span class="qtools-link" data-i="${i}" data-act="detail">详情</span></td>
    </tr>`;
  }
  function openNetDetail(x){
    const mask=document.createElement('div'); mask.className='qtools-panel-mask'; armMask(mask);
    const panel=document.createElement('div'); panel.className='qtools-panel'; makeMaskClose(mask,panel);
    const reqH=x.request?.headers?JSON.stringify(x.request.headers,null,2):'{}';
    const resH=x.response?.headers?JSON.stringify(x.response.headers,null,2):'{}';
    const reqB=x.request?.body??''; const resB=x.response?.body??'';
    panel.innerHTML = `
      <div class="qtools-head">
        <strong>${x.method} ${x.status ?? '-'} • ${x.duration ?? '-'}ms</strong>
        <div class="qtools-actions">
          <button class="qtools-btn" id="copy">复制全部JSON</button>
          <button class="qtools-btn" id="cls">关闭</button>
        </div>
      </div>
      <div style="margin-bottom:6px;word-break:break-all;"><b>URL:</b> ${x.url}</div>
      <pre><b>Request Headers</b>\n${reqH}</pre>
      ${reqB ? `<pre style="margin-top:8px;"><b>Request Body</b>\n${typeof reqB==='string'?reqB:JSON.stringify(reqB,null,2)}</pre>`:''}
      <pre style="margin-top:8px;"><b>Response Headers</b>\n${resH}</pre>
      ${resB ? `<pre style="margin-top:8px;"><b>Response Body</b>\n${typeof resB==='string'?resB:JSON.stringify(resB,null,2)}</pre>`:''}
    `;
    mask.appendChild(panel); document.documentElement.appendChild(mask);
    panel.querySelector('#copy').addEventListener('click', async (e)=>{ e.stopPropagation(); await copy(JSON.stringify(x,null,2)); toast('已复制'); });
    panel.querySelector('#cls').addEventListener('click', (e)=>{ e.stopPropagation(); mask.remove(); });
  }

  function openNetPanel(){
    const mask=document.createElement('div'); mask.className='qtools-panel-mask'; armMask(mask);
    const panel=document.createElement('div'); panel.className='qtools-panel'; makeMaskClose(mask,panel);
    const st=getState();

    // 过滤状态
    let filterStr = '';
    let filterIsRegex = false;
    let live = true;

    // 渲染函数（按过滤与最新数据）
    function filteredLogs() {
      if (!filterStr) return NETLOGS;
      try {
        if (filterIsRegex) {
          const re = new RegExp(filterStr, 'i');
          return NETLOGS.filter(x => re.test(x.url) || re.test(x.method) || re.test(String(x.status)));
        } else {
          const s = filterStr.toLowerCase();
          return NETLOGS.filter(x => (x.url||'').toLowerCase().includes(s) ||
                                     (x.method||'').toLowerCase().includes(s) ||
                                     String(x.status||'').toLowerCase().includes(s));
        }
      } catch { return NETLOGS; }
    }
    function renderTable() {
      const rows = filteredLogs().map((x, i) => rowHTML(x, i)).reverse().join('');
      const tb = panel.querySelector('#tb');
      tb.innerHTML = rows || `<tr><td colspan="5" style="color:#666;">暂无记录（Alt+N 打开；设置里可切换开关/全量/同源/过滤）</td></tr>`;
      // 绑定详情
      tb.querySelectorAll('[data-act="detail"]').forEach(el => {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = Number(el.getAttribute('data-i'));
          const item = filteredLogs()[filteredLogs().length - 1 - idx]; // 因 reverse 显示，计算回原索引
          openNetDetail(item || NETLOGS[idx]);
        });
      });
    }

    panel.innerHTML = `
      <div class="qtools-head">
        <strong>网络请求（${st.on ? (st.all ? '全量抓取' : '按过滤') : '已关闭'}；共 <span id="cnt">${NETLOGS.length}</span> 条）</strong>
        <div class="qtools-actions">
          <input class="qtools-input qtools-filter" id="kw" placeholder="关键词或正则（勾选Regex）实时筛选 URL/方法/状态"/>
          <label><input type="checkbox" id="isre"/> Regex</label>
          <label><input type="checkbox" id="live" checked/> Live</label>
          <button class="qtools-btn" id="har">导出 HAR</button>
          <button class="qtools-btn" id="cp">复制全部JSON</button>
          <button class="qtools-btn" id="clr">清空</button>
          <button class="qtools-btn" id="cfg">设置</button>
          <button class="qtools-btn" id="cls">关闭</button>
        </div>
      </div>
      <table class="qtools-table">
        <thead><tr><th>方法</th><th>URL / 状态</th><th>状态</th><th>耗时</th><th>操作</th></tr></thead>
        <tbody id="tb"></tbody>
      </table>
      <div class="qtools-hint" style="margin-top:8px;">
        本域：${st.on ? 'ON' : 'OFF'}；仅同源：${st.same ? '是' : '否'}；模式：${st.all ? '全量' : '按过滤'}；过滤：${st.filter}；回显端点：${st.echo||'(未配置)'}
      </div>
    `;
    mask.appendChild(panel); document.documentElement.appendChild(mask);

    // 首渲染
    renderTable();

    // 交互
    const kw = panel.querySelector('#kw');
    const isre = panel.querySelector('#isre');
    const liveChk = panel.querySelector('#live');
    const cnt = panel.querySelector('#cnt');

    function doFilterRender(){
      filterStr = kw.value.trim();
      filterIsRegex = isre.checked;
      renderTable();
    }
    kw.addEventListener('input', doFilterRender);
    isre.addEventListener('change', doFilterRender);

    // Live 刷新
    const timer = setInterval(() => {
      if (!document.body.contains(panel)) { clearInterval(timer); return; }
      if (!live) return;
      cnt.textContent = String(NETLOGS.length);
      renderTable();
    }, 800);
    liveChk.addEventListener('change', () => { live = liveChk.checked; });

    panel.querySelector('#cls').addEventListener('click',(e)=>{ e.stopPropagation(); clearInterval(timer); mask.remove(); });
    panel.querySelector('#cp').addEventListener('click', async (e)=>{ e.stopPropagation(); await copy(JSON.stringify(NETLOGS,null,2)); toast('已复制'); });
    panel.querySelector('#clr').addEventListener('click',(e)=>{ e.stopPropagation(); NETLOGS.length=0; renderTable(); toast('已清空'); });
    panel.querySelector('#cfg').addEventListener('click',(e)=>{ e.stopPropagation(); clearInterval(timer); mask.remove(); setTimeout(()=>openSettingsPanel(),0); });
    panel.querySelector('#har').addEventListener('click',(e)=>{ e.stopPropagation(); downloadHar(); });
  }

  // ===== 页面上下文 Hook（所有 frame 都注入；只顶层有 UI） =====
  const INJECT = `
    (function(){
      const CAPTURE_REQ_HEADERS=${CAPTURE_REQ_HEADERS}, CAPTURE_RES_HEADERS=${CAPTURE_RES_HEADERS},
            CAPTURE_REQ_BODY=${CAPTURE_REQ_BODY}, CAPTURE_RES_BODY=${CAPTURE_RES_BODY},
            CAPTURE_SEND_BEACON=${CAPTURE_SEND_BEACON}, CAPTURE_SSE=${CAPTURE_SSE}, CAPTURE_WEBSOCKET=${CAPTURE_WEBSOCKET},
            MAX_BODY_KB=${MAX_BODY_KB};
      const enc=new TextEncoder(); const kbLimit=(s)=>{ if(typeof s!=='string') return s; const max=MAX_BODY_KB*1024; if(enc.encode(s).length>max) return s.slice(0,max)+"\\n/* truncated at "+MAX_BODY_KB+"KB */"; return s; };
      const safeJSON=(t)=>{ try{return JSON.parse(t)}catch{return t} };
      const post=(entry)=>{ try{ window.postMessage({__QTOOLS_NET__:true, entry}, '*'); }catch{} try{ if(window.top && window.top!==window) window.top.postMessage({__QTOOLS_NET__:true, entry}, '*'); }catch{} };

      // fetch
      const origFetch=window.fetch;
      const fetchWrap=async function(input, init={}) {
        const start=performance.now();
        const url=(typeof input==='string')?input:(input?.url||'');
        const method=(init?.method||(typeof input!=='string'?input.method:'GET')||'GET').toUpperCase();
        let reqH={}, reqB;
        if(CAPTURE_REQ_HEADERS){ try{ const h=(init?.headers||(typeof input!=='string'?input.headers:null)); if(h) reqH=Object.fromEntries(new Headers(h).entries()); }catch{} }
        if(CAPTURE_REQ_BODY && init?.body!=null){
          try{ if(typeof init.body==='string') reqB=safeJSON(kbLimit(init.body));
               else if(init.body instanceof Blob) reqB="Blob("+(init.body.type||"unknown")+", "+init.body.size+" bytes)";
               else if(init.body instanceof FormData){ const o={}; for(const [k,v] of init.body.entries()) o[k]=(v instanceof File)? "File("+v.name+","+v.size+")": String(v); reqB=o; }
               else reqB='[unsupported body]'; }catch{}
        }
        try{
          const res=await origFetch.apply(this, arguments);
          const end=performance.now(); const clone=res.clone(); let resH={}, body='';
          if(CAPTURE_RES_HEADERS){ try{ resH=Object.fromEntries(clone.headers.entries()); }catch{} }
          if(CAPTURE_RES_BODY){ try{ body=kbLimit(await clone.text()); }catch{ body='[read body failed]'; } }
          post({ type:'fetch', method, url, startTime: Date.now(), duration: Math.round(end-start), status: res.status,
                 request:{ headers:reqH, body:reqB }, response:{ headers:resH, body:safeJSON(body) } });
          return res;
        }catch(err){
          post({ type:'fetch', method, url, startTime: Date.now(), duration: Math.round(performance.now()-start), status:0, error:String(err),
                 request:{ headers:reqH, body:reqB } });
          throw err;
        }
      };
      try{ Object.defineProperty(window,'fetch',{value:fetchWrap,writable:false,configurable:false}); fetchWrap.toString=()=>origFetch.toString(); }catch{ window.fetch=fetchWrap; }

      // XHR
      const XHR=XMLHttpRequest, openOrig=XHR.prototype.open, sendOrig=XHR.prototype.send;
      XHR.prototype.open=function(m,u){ this.__qtools={method:String(m||'GET').toUpperCase(), url:String(u||''), start:0}; return openOrig.apply(this, arguments); };
      XHR.prototype.send=function(body){
        const info=this.__qtools||(this.__qtools={}); info.start=performance.now();
        let reqB;
        if(CAPTURE_REQ_BODY && body!=null){
          try{ if(typeof body==='string') reqB=safeJSON(kbLimit(body));
               else if(body instanceof Blob) reqB="Blob("+(body.type||"unknown")+", "+body.size+" bytes)";
               else if(body instanceof FormData){ const o={}; for(const [k,v] of body.entries()) o[k]=(v instanceof File)? "File("+v.name+","+v.size+")": String(v); reqB=o; }
               else reqB='[unsupported body]'; }catch{}
        }
        this.addEventListener('loadend', function(){
          const end=performance.now(), status=this.status||0;
          let resH={}; if(${CAPTURE_RES_HEADERS}){ try{ const raw=this.getAllResponseHeaders(); raw.trim().split(/[\\r\\n]+/).forEach(line=>{ const i=line.indexOf(':'); if(i>0) resH[line.slice(0,i).trim().toLowerCase()]=line.slice(i+1).trim(); }); }catch{} }
          let bodyText=''; if(${CAPTURE_RES_BODY}){ try{ bodyText=(this.responseType===''||this.responseType==='text')? String(this.response||'') : ('[responseType='+this.responseType+']'); bodyText=kbLimit(bodyText); }catch{ bodyText='[read body failed]'; } }
          post({ type:'xhr', method:info.method, url:info.url, startTime: Date.now(), duration: Math.round(end-info.start), status,
                 request:{ body:reqB }, response:{ headers:resH, body:safeJSON(bodyText) } });
        });
        return sendOrig.apply(this, arguments);
      };

      // sendBeacon
      if(${CAPTURE_SEND_BEACON} && navigator.sendBeacon){
        const sbOrig=navigator.sendBeacon.bind(navigator);
        const sbWrap=function(url,data){
          let body=null; try{ if(typeof data==='string') body=kbLimit(data); else if(data instanceof Blob) body="Blob("+(data.type||"unknown")+", "+data.size+" bytes)"; else if(data) body=String(data); }catch{}
          post({ type:'beacon', method:'BEACON', url:String(url||''), startTime: Date.now(), status:0, request:{ body: body? safeJSON(body): null } });
          return sbOrig(url,data);
        };
        try{ Object.defineProperty(navigator,'sendBeacon',{value:sbWrap,writable:false,configurable:false}); }catch{ navigator.sendBeacon=sbWrap; }
      }

      // EventSource
      if(${CAPTURE_SSE} && window.EventSource){
        const ESOrig=window.EventSource;
        const ESWrap=function(url,config){
          const es=new ESOrig(url,config);
          try{ post({ type:'sse', method:'SSE', url:String(url||''), startTime: Date.now(), status:0 });
               es.addEventListener('error',()=> post({ type:'sse', method:'SSE', url:String(url||''), startTime: Date.now(), status:-1 })); }catch{}
          return es;
        };
        try{ Object.defineProperty(window,'EventSource',{value:ESWrap,writable:false,configurable:false}); }catch{ window.EventSource=ESWrap; }
      }

      // WebSocket
      if(${CAPTURE_WEBSOCKET} && window.WebSocket){
        const WSOrig=window.WebSocket;
        const WSWrap=function(url,protocols){
          const ws=new WSOrig(url,protocols); const u=String(url||''); const start=Date.now();
          try{ post({ type:'ws', method:'WS', url:u, startTime:start, status:0 });
               ws.addEventListener('close',(e)=> post({ type:'ws', method:'WS', url:u, startTime:start, status:e.code||0 })); }catch{}
          return ws;
        };
        try{ Object.defineProperty(window,'WebSocket',{value:WSWrap,writable:false,configurable:false}); }catch{ window.WebSocket=WSWrap; }
      }

      // Watchdog
      setInterval(()=>{ try{ if(window.fetch!==fetchWrap) Object.defineProperty(window,'fetch',{value:fetchWrap,writable:false,configurable:false}); }catch{ window.fetch=fetchWrap; }
                        try{ if(XMLHttpRequest.prototype.open!==XHR.prototype.open) XMLHttpRequest.prototype.open=XHR.prototype.open;
                             if(XMLHttpRequest.prototype.send!==XHR.prototype.send) XMLHttpRequest.prototype.send=XHR.prototype.send; }catch{} }, 1000);

      // Ready
      try{ window.postMessage({__QTOOLS_NET_READY__:true}, '*'); if(window.top && window.top!==window) window.top.postMessage({__QTOOLS_NET_READY__:true}, '*'); }catch{}
    })();
  `;
  const script=document.createElement('script'); script.textContent=INJECT;
  (document.documentElement||document.head||document.body).appendChild(script); script.remove();

  // ===== 接收 & 过滤入表 =====
  addEventListener('message', (e) => {
    const d=e.data;
    if(d?.__QTOOLS_NET_READY__){ const st=getState(); if(st.on) console.log('[QTools] Net hook ready'); return; }
    if(!d?.__QTOOLS_NET__ || !d.entry) return;
    if(!shouldKeep(d.entry)) return;
    NETLOGS.push(d.entry); clamp();
  });

  // ===== 顶层挂载按钮；所有 frame 都注入 hook =====
  if(isTopWindow()){
    const ensure=()=>{ if(!document.getElementById(FAB_ID)) mountFabOnce(); };
    new MutationObserver(ensure).observe(document.documentElement,{childList:true,subtree:true}); ensure();
  }

  // 暴露到全局供调试使用
  window.QTools = {
    getState,
    setState,
    NETLOGS,
    openCookiePanel,
    openNetPanel,
    openSettingsPanel,
    readAllVisibleCookies,
    downloadHar
  };

})();
