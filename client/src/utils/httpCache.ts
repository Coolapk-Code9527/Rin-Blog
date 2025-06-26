/**
 * HTTP缓存优化工具
 * 
 * 提供HTTP缓存头的配置和管理功能
 */

interface CacheHeaders {
  'Cache-Control': string;
  'ETag'?: string;
  'Last-Modified'?: string;
  'Expires'?: string;
}

interface CacheConfig {
  maxAge: number; // 缓存时间（秒）
  staleWhileRevalidate?: number; // 过期后仍可使用的时间（秒）
  mustRevalidate?: boolean; // 是否必须重新验证
  noCache?: boolean; // 是否禁用缓存
  noStore?: boolean; // 是否禁止存储
  public?: boolean; // 是否允许公共缓存
}

/**
 * 生成Cache-Control头
 */
export function generateCacheControl(config: CacheConfig): string {
  const directives: string[] = [];

  if (config.noStore) {
    directives.push('no-store');
    return directives.join(', ');
  }

  if (config.noCache) {
    directives.push('no-cache');
  } else {
    if (config.public) {
      directives.push('public');
    } else {
      directives.push('private');
    }

    directives.push(`max-age=${config.maxAge}`);

    if (config.staleWhileRevalidate) {
      directives.push(`stale-while-revalidate=${config.staleWhileRevalidate}`);
    }

    if (config.mustRevalidate) {
      directives.push('must-revalidate');
    }
  }

  return directives.join(', ');
}

/**
 * 预定义的缓存策略
 */
export const CACHE_STRATEGIES = {
  // 静态资源（1年）
  STATIC_ASSETS: {
    maxAge: 365 * 24 * 60 * 60, // 1年
    public: true,
    mustRevalidate: false
  },
  
  // HTML页面（5分钟）
  HTML_PAGES: {
    maxAge: 5 * 60, // 5分钟
    public: false,
    mustRevalidate: true,
    staleWhileRevalidate: 60 // 1分钟
  },
  
  // API响应（根据类型）
  API_LONG_TERM: {
    maxAge: 60 * 60, // 1小时
    public: false,
    mustRevalidate: true,
    staleWhileRevalidate: 5 * 60 // 5分钟
  },
  
  API_MEDIUM_TERM: {
    maxAge: 15 * 60, // 15分钟
    public: false,
    mustRevalidate: true,
    staleWhileRevalidate: 2 * 60 // 2分钟
  },
  
  API_SHORT_TERM: {
    maxAge: 5 * 60, // 5分钟
    public: false,
    mustRevalidate: true,
    staleWhileRevalidate: 60 // 1分钟
  },
  
  // 不缓存
  NO_CACHE: {
    maxAge: 0,
    noCache: true,
    mustRevalidate: true
  },
  
  // 不存储
  NO_STORE: {
    maxAge: 0,
    noStore: true
  }
} as const;

/**
 * 为fetch请求添加缓存头
 */
export function addCacheHeaders(
  init: RequestInit = {},
  strategy: keyof typeof CACHE_STRATEGIES
): RequestInit {
  const cacheConfig = CACHE_STRATEGIES[strategy];
  const cacheControl = generateCacheControl(cacheConfig);

  return {
    ...init,
    headers: {
      ...init.headers,
      'Cache-Control': cacheControl
    }
  };
}

/**
 * 检查响应是否可以缓存
 */
export function isCacheable(response: Response): boolean {
  // 检查状态码
  if (!response.ok) {
    return false;
  }

  // 检查Cache-Control头
  const cacheControl = response.headers.get('Cache-Control');
  if (cacheControl) {
    if (cacheControl.includes('no-cache') || 
        cacheControl.includes('no-store') ||
        cacheControl.includes('max-age=0')) {
      return false;
    }
  }

  // 检查方法
  if (response.url && new URL(response.url).searchParams.has('_t')) {
    // 包含时间戳参数，可能是为了避免缓存
    return false;
  }

  return true;
}

/**
 * 获取缓存过期时间
 */
export function getCacheExpiration(response: Response): Date | null {
  const cacheControl = response.headers.get('Cache-Control');
  
  if (cacheControl) {
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
    if (maxAgeMatch) {
      const maxAge = parseInt(maxAgeMatch[1]);
      return new Date(Date.now() + maxAge * 1000);
    }
  }

  const expires = response.headers.get('Expires');
  if (expires) {
    return new Date(expires);
  }

  return null;
}

/**
 * 检查缓存是否过期
 */
export function isCacheExpired(cachedAt: Date, maxAge: number): boolean {
  const now = Date.now();
  const cacheAge = now - cachedAt.getTime();
  return cacheAge > maxAge * 1000;
}

/**
 * 生成ETag
 */
export function generateETag(content: string): string {
  // 简单的哈希函数生成ETag
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为32位整数
  }
  return `"${Math.abs(hash).toString(16)}"`;
}

/**
 * 检查ETag是否匹配
 */
export function isETagMatch(etag1: string, etag2: string): boolean {
  return etag1 === etag2;
}

/**
 * 创建条件请求头
 */
export function createConditionalHeaders(
  etag?: string,
  lastModified?: string
): HeadersInit {
  const headers: HeadersInit = {};

  if (etag) {
    headers['If-None-Match'] = etag;
  }

  if (lastModified) {
    headers['If-Modified-Since'] = lastModified;
  }

  return headers;
}

/**
 * 处理304 Not Modified响应
 */
export function handle304Response(
  response: Response,
  cachedResponse: Response
): Response {
  if (response.status === 304) {
    // 更新缓存的头信息
    const updatedHeaders = new Headers(cachedResponse.headers);
    
    // 复制新的缓存控制头
    const newCacheControl = response.headers.get('Cache-Control');
    if (newCacheControl) {
      updatedHeaders.set('Cache-Control', newCacheControl);
    }

    const newExpires = response.headers.get('Expires');
    if (newExpires) {
      updatedHeaders.set('Expires', newExpires);
    }

    // 返回更新后的缓存响应
    return new Response(cachedResponse.body, {
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
      headers: updatedHeaders
    });
  }

  return response;
}

/**
 * 缓存统计信息
 */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalRequests: number;
}

let cacheStats: CacheStats = {
  hits: 0,
  misses: 0,
  hitRate: 0,
  totalRequests: 0
};

/**
 * 记录缓存命中
 */
export function recordCacheHit(): void {
  cacheStats.hits++;
  cacheStats.totalRequests++;
  cacheStats.hitRate = cacheStats.hits / cacheStats.totalRequests;
}

/**
 * 记录缓存未命中
 */
export function recordCacheMiss(): void {
  cacheStats.misses++;
  cacheStats.totalRequests++;
  cacheStats.hitRate = cacheStats.hits / cacheStats.totalRequests;
}

/**
 * 获取缓存统计信息
 */
export function getCacheStats(): CacheStats {
  return { ...cacheStats };
}

/**
 * 重置缓存统计信息
 */
export function resetCacheStats(): void {
  cacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalRequests: 0
  };
}
