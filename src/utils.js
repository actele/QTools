// QTools 工具函数库

/**
 * 深度克隆对象
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item));
  }
  
  if (typeof obj === 'object') {
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
  
  return obj;
}

/**
 * 防抖函数
 */
export function debounce(func, wait, immediate = false) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      timeout = null;
      if (!immediate) func.apply(this, args);
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(this, args);
  };
}

/**
 * 节流函数
 */
export function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 格式化时间间隔
 */
export function formatDuration(ms) {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * 格式化时间戳
 */
export function formatTimestamp(timestamp, includeDate = false) {
  const date = new Date(timestamp);
  
  if (includeDate) {
    return date.toLocaleString();
  } else {
    return date.toLocaleTimeString();
  }
}

/**
 * 截断文本
 */
export function truncateText(text, maxLength, suffix = '...') {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + suffix;
}

/**
 * 解析 URL
 */
export function parseUrl(url) {
  try {
    const urlObj = new URL(url);
    return {
      protocol: urlObj.protocol,
      hostname: urlObj.hostname,
      port: urlObj.port,
      pathname: urlObj.pathname,
      search: urlObj.search,
      hash: urlObj.hash,
      origin: urlObj.origin
    };
  } catch (error) {
    return null;
  }
}

/**
 * 获取域名
 */
export function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * 检查是否为有效的 URL
 */
export function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}

/**
 * 生成唯一 ID
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * 安全的 JSON 解析
 */
export function safeJsonParse(str, defaultValue = null) {
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue;
  }
}

/**
 * 安全的 JSON 字符串化
 */
export function safeJsonStringify(obj, space = 0) {
  try {
    return JSON.stringify(obj, null, space);
  } catch {
    return '';
  }
}

/**
 * 检查是否为移动设备
 */
export function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * 检查是否支持 localStorage
 */
export function supportsLocalStorage() {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * 检查是否支持 IndexedDB
 */
export function supportsIndexedDB() {
  return 'indexedDB' in window && indexedDB !== null;
}

/**
 * 异步延迟
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 重试函数
 */
export async function retry(fn, options = {}) {
  const {
    retries = 3,
    delay: retryDelay = 1000,
    backoff = false
  } = options;
  
  let lastError;
  
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (i === retries) {
        throw error;
      }
      
      const delayTime = backoff ? retryDelay * Math.pow(2, i) : retryDelay;
      await delay(delayTime);
    }
  }
  
  throw lastError;
}

/**
 * 批处理函数
 */
export function batchProcessor(processFn, batchSize = 10) {
  return async function(items) {
    const results = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(processFn));
      results.push(...batchResults);
    }
    
    return results;
  };
}

/**
 * 创建事件发射器
 */
export function createEventEmitter() {
  const events = {};
  
  return {
    on(event, callback) {
      if (!events[event]) {
        events[event] = [];
      }
      events[event].push(callback);
    },
    
    off(event, callback) {
      if (events[event]) {
        events[event] = events[event].filter(cb => cb !== callback);
      }
    },
    
    emit(event, ...args) {
      if (events[event]) {
        events[event].forEach(callback => callback(...args));
      }
    },
    
    once(event, callback) {
      const onceCallback = (...args) => {
        callback(...args);
        this.off(event, onceCallback);
      };
      this.on(event, onceCallback);
    }
  };
}

/**
 * 数组去重
 */
export function uniqueArray(arr, key) {
  if (key) {
    const seen = new Set();
    return arr.filter(item => {
      const keyValue = item[key];
      if (seen.has(keyValue)) {
        return false;
      }
      seen.add(keyValue);
      return true;
    });
  } else {
    return [...new Set(arr)];
  }
}

/**
 * 对象数组排序
 */
export function sortBy(arr, key, order = 'asc') {
  return arr.sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    
    if (aVal < bVal) return order === 'asc' ? -1 : 1;
    if (aVal > bVal) return order === 'asc' ? 1 : -1;
    return 0;
  });
}

/**
 * 数组分组
 */
export function groupBy(arr, key) {
  return arr.reduce((groups, item) => {
    const group = item[key];
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(item);
    return groups;
  }, {});
}

/**
 * 扁平化对象
 */
export function flattenObject(obj, prefix = '') {
  const flattened = {};
  
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        Object.assign(flattened, flattenObject(obj[key], newKey));
      } else {
        flattened[newKey] = obj[key];
      }
    }
  }
  
  return flattened;
}

/**
 * 合并对象
 */
export function mergeDeep(target, ...sources) {
  if (!sources.length) return target;
  const source = sources.shift();
  
  if (target && source && typeof target === 'object' && typeof source === 'object') {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object') {
        if (!target[key]) Object.assign(target, { [key]: {} });
        mergeDeep(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }
  
  return mergeDeep(target, ...sources);
}

/**
 * 检查值是否为空
 */
export function isEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && Object.keys(value).length === 0) return true;
  return false;
}

/**
 * 随机字符串生成器
 */
export function randomString(length = 10, chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 颜色工具
 */
export const colorUtils = {
  // 根据状态码获取颜色
  getStatusColor(status) {
    if (status >= 200 && status < 300) return '#10b981'; // 绿色
    if (status >= 300 && status < 400) return '#f59e0b'; // 黄色
    if (status >= 400 && status < 500) return '#ef4444'; // 红色
    if (status >= 500) return '#8b5cf6'; // 紫色
    return '#6b7280'; // 灰色
  },
  
  // 根据请求方法获取颜色
  getMethodColor(method) {
    const colors = {
      GET: '#10b981',
      POST: '#3b82f6',
      PUT: '#f59e0b',
      DELETE: '#ef4444',
      PATCH: '#8b5cf6',
      HEAD: '#6b7280',
      OPTIONS: '#64748b'
    };
    return colors[method?.toUpperCase()] || '#6b7280';
  },
  
  // 十六进制转 RGB
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  },
  
  // RGB 转十六进制
  rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
};
