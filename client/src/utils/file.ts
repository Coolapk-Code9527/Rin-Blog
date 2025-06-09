// 文件相关工具函数

/**
 * 获取 S3/R2 访问域名（优先 context config，其次 sessionStorage）
 */
export function getS3AccessHost(config?: any): string {
  if (config && typeof config.get === 'function') {
    const host = config.get('S3_ACCESS_HOST');
    if (host) return host;
  }
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const cfg = JSON.parse(window.sessionStorage.getItem('config') || '{}');
      if (cfg.S3_ACCESS_HOST) return cfg.S3_ACCESS_HOST;
    } catch {}
  }
  return '';
}

/**
 * 拼接文件完整URL（如无host则原样返回）
 */
export function getFileUrl(path: string, config?: any): string {
  if (!path) return '';
  const host = getS3AccessHost(config);
  if (!host) return path;
  return host.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '');
}

/**
 * 判断链接是否为本站文件（支持多种host、相对路径、规范化）
 */
export function isInternalFileLink(url: string, config?: any): boolean {
  if (!url) return false;
  try {
    let host = getS3AccessHost(config);
    // 兜底：如host仍为空，直接返回false并输出警告，避免硬编码
    if (!host) {
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.warn('S3_ACCESS_HOST 未注入，无法识别站内文件链接，请检查后端 /config/client 配置和前端注入逻辑');
      }
      return false;
    }
    // 1. 相对路径
    if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) return true;
    // 2. 绝对路径但无host
    if (/^([a-zA-Z0-9_\-]+)?\/?[\w\-/]+\.[\w]+$/.test(url)) return true;
    // 3. host匹配（增强：忽略协议、端口、末尾/、大小写）
    const normalize = (h: string) => h.replace(/^https?:\/\//, '').replace(/[:/]+$/, '').toLowerCase();
    try {
      const u = new URL(url, window.location.origin);
      const hostUrl = new URL(host, window.location.origin);
      if (normalize(u.host) === normalize(hostUrl.host)) return true;
      if (normalize(u.hostname) === normalize(hostUrl.hostname)) return true;
    } catch {}
    // 4. 当前站点host
    try {
      const u = new URL(url, window.location.origin);
      if (normalize(u.host) === normalize(window.location.host)) return true;
    } catch {}
    return false;
  } catch {
    return false;
  }
} 