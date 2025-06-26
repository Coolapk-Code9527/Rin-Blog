/**
 * API缓存拦截器
 * 
 * 为treaty客户端提供智能缓存策略，包括缓存失效、更新机制和条件请求
 */

import { globalCache } from './memoryCache';
import { CACHE_STRATEGIES, generateCacheControl, isCacheable, getCacheExpiration } from './httpCache';

interface CachedResponse {
  data: any;
  headers: Record<string, string>;
  status: number;
  timestamp: number;
  etag?: string;
  lastModified?: string;
}

interface CacheInterceptorOptions {
  enabled: boolean;
  defaultTTL: number;
  useConditionalRequests: boolean;
  cacheStrategies: Record<string, keyof typeof CACHE_STRATEGIES>;
}

const DEFAULT_OPTIONS: CacheInterceptorOptions = {
  enabled: true,
  defaultTTL: 5 * 60 * 1000, // 5分钟
  useConditionalRequests: true,
  cacheStrategies: {
    '/api/tag/index': 'API_LONG_TERM',
    '/api/config': 'API_LONG_TERM',
    '/api/feed/index': 'API_MEDIUM_TERM',
    '/api/feed/': 'API_MEDIUM_TERM',
    '/api/feed/comment': 'API_SHORT_TERM',
    '/api/search': 'API_SHORT_TERM'
  }
};

/**
 * API缓存拦截器类
 */
export class ApiCacheInterceptor {
  private options: CacheInterceptorOptions;
  private stats = {
    requests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    conditionalRequests: 0,
    notModified: 0
  };

  constructor(options: Partial<CacheInterceptorOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 拦截请求，实现缓存逻辑
   */
  async intercept(
    url: string,
    init: RequestInit = {},
    originalFetch: typeof fetch = fetch
  ): Promise<Response> {
    if (!this.options.enabled) {
      return originalFetch(url, init);
    }

    this.stats.requests++;

    const method = init.method || 'GET';
    
    // 只缓存GET请求
    if (method !== 'GET') {
      // 对于非GET请求，可能需要清理相关缓存
      this.invalidateRelatedCache(url, method);
      return originalFetch(url, init);
    }

    const cacheKey = this.generateCacheKey(url, init);
    const cachedResponse = this.getCachedResponse(cacheKey);

    // 检查缓存是否有效
    if (cachedResponse && this.isCacheValid(cachedResponse)) {
      this.stats.cacheHits++;
      console.log(`Cache hit for ${url}`);
      return this.createResponseFromCache(cachedResponse);
    }

    // 准备条件请求头
    const conditionalHeaders = this.prepareConditionalHeaders(cachedResponse);
    const requestInit = {
      ...init,
      headers: {
        ...init.headers,
        ...conditionalHeaders
      }
    };

    try {
      const response = await originalFetch(url, requestInit);

      // 处理304 Not Modified
      if (response.status === 304 && cachedResponse) {
        this.stats.notModified++;
        console.log(`304 Not Modified for ${url}`);
        
        // 更新缓存时间戳
        this.updateCacheTimestamp(cacheKey);
        return this.createResponseFromCache(cachedResponse);
      }

      // 缓存新响应
      if (this.shouldCache(url, response)) {
        await this.cacheResponse(cacheKey, response.clone());
      }

      this.stats.cacheMisses++;
      return response;

    } catch (error) {
      // 网络错误时，如果有缓存则返回缓存
      if (cachedResponse) {
        console.log(`Network error, serving stale cache for ${url}`);
        return this.createResponseFromCache(cachedResponse);
      }
      throw error;
    }
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(url: string, init: RequestInit): string {
    const urlObj = new URL(url);
    const searchParams = urlObj.searchParams.toString();
    const headers = JSON.stringify(init.headers || {});
    
    return `api_cache_${urlObj.pathname}_${searchParams}_${headers}`;
  }

  /**
   * 获取缓存响应
   */
  private getCachedResponse(cacheKey: string): CachedResponse | null {
    return globalCache.get(cacheKey);
  }

  /**
   * 检查缓存是否有效
   */
  private isCacheValid(cachedResponse: CachedResponse): boolean {
    const now = Date.now();
    const age = now - cachedResponse.timestamp;
    
    // 检查TTL
    const ttl = this.getTTLForResponse(cachedResponse);
    return age < ttl;
  }

  /**
   * 获取响应的TTL
   */
  private getTTLForResponse(cachedResponse: CachedResponse): number {
    // 从Cache-Control头中解析max-age
    const cacheControl = cachedResponse.headers['cache-control'];
    if (cacheControl) {
      const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
      if (maxAgeMatch) {
        return parseInt(maxAgeMatch[1]) * 1000;
      }
    }

    return this.options.defaultTTL;
  }

  /**
   * 准备条件请求头
   */
  private prepareConditionalHeaders(cachedResponse: CachedResponse | null): Record<string, string> {
    if (!this.options.useConditionalRequests || !cachedResponse) {
      return {};
    }

    const headers: Record<string, string> = {};

    if (cachedResponse.etag) {
      headers['If-None-Match'] = cachedResponse.etag;
    }

    if (cachedResponse.lastModified) {
      headers['If-Modified-Since'] = cachedResponse.lastModified;
    }

    if (Object.keys(headers).length > 0) {
      this.stats.conditionalRequests++;
    }

    return headers;
  }

  /**
   * 判断是否应该缓存响应
   */
  private shouldCache(url: string, response: Response): boolean {
    if (!response.ok) {
      return false;
    }

    // 检查是否有缓存策略
    const urlObj = new URL(url);
    const strategy = this.getCacheStrategy(urlObj.pathname);
    
    if (strategy === 'NO_CACHE' || strategy === 'NO_STORE') {
      return false;
    }

    return isCacheable(response);
  }

  /**
   * 获取URL的缓存策略
   */
  private getCacheStrategy(pathname: string): keyof typeof CACHE_STRATEGIES {
    // 精确匹配
    if (this.options.cacheStrategies[pathname]) {
      return this.options.cacheStrategies[pathname];
    }

    // 前缀匹配
    for (const [pattern, strategy] of Object.entries(this.options.cacheStrategies)) {
      if (pathname.startsWith(pattern)) {
        return strategy;
      }
    }

    return 'API_SHORT_TERM'; // 默认策略
  }

  /**
   * 缓存响应
   */
  private async cacheResponse(cacheKey: string, response: Response): Promise<void> {
    try {
      const data = await response.json();
      const headers: Record<string, string> = {};
      
      // 复制重要的响应头
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });

      const cachedResponse: CachedResponse = {
        data,
        headers,
        status: response.status,
        timestamp: Date.now(),
        etag: response.headers.get('etag') || undefined,
        lastModified: response.headers.get('last-modified') || undefined
      };

      // 计算TTL
      const ttl = this.getTTLFromHeaders(response) || this.options.defaultTTL;
      
      globalCache.set(cacheKey, cachedResponse, ttl);
      console.log(`Cached response for ${cacheKey}`);

    } catch (error) {
      console.warn('Failed to cache response:', error);
    }
  }

  /**
   * 从响应头获取TTL
   */
  private getTTLFromHeaders(response: Response): number | null {
    const cacheControl = response.headers.get('cache-control');
    if (cacheControl) {
      const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
      if (maxAgeMatch) {
        return parseInt(maxAgeMatch[1]) * 1000;
      }
    }

    const expires = response.headers.get('expires');
    if (expires) {
      const expiresDate = new Date(expires);
      return expiresDate.getTime() - Date.now();
    }

    return null;
  }

  /**
   * 从缓存创建响应对象
   */
  private createResponseFromCache(cachedResponse: CachedResponse): Response {
    const headers = new Headers(cachedResponse.headers);
    headers.set('x-cache', 'HIT');
    headers.set('x-cache-timestamp', cachedResponse.timestamp.toString());

    return new Response(JSON.stringify(cachedResponse.data), {
      status: cachedResponse.status,
      headers
    });
  }

  /**
   * 更新缓存时间戳
   */
  private updateCacheTimestamp(cacheKey: string): void {
    const cachedResponse = globalCache.get(cacheKey);
    if (cachedResponse) {
      cachedResponse.timestamp = Date.now();
      globalCache.set(cacheKey, cachedResponse);
    }
  }

  /**
   * 失效相关缓存
   */
  private invalidateRelatedCache(url: string, method: string): void {
    const urlObj = new URL(url);
    const basePath = urlObj.pathname;

    // 根据请求方法和路径失效相关缓存
    const keysToInvalidate: string[] = [];

    globalCache.keys().forEach(key => {
      if (key.includes(basePath)) {
        // POST/PUT/DELETE请求可能影响相关的GET请求缓存
        if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
          keysToInvalidate.push(key);
        }
      }
    });

    keysToInvalidate.forEach(key => {
      globalCache.delete(key);
    });

    if (keysToInvalidate.length > 0) {
      console.log(`Invalidated ${keysToInvalidate.length} cache entries for ${method} ${url}`);
    }
  }

  /**
   * 手动失效缓存
   */
  invalidateCache(pattern?: string): number {
    if (!pattern) {
      const size = globalCache.size();
      globalCache.clear();
      return size;
    }

    const keysToDelete = globalCache.keys().filter(key => key.includes(pattern));
    keysToDelete.forEach(key => globalCache.delete(key));
    
    return keysToDelete.length;
  }

  /**
   * 获取缓存统计信息
   */
  getStats() {
    return {
      ...this.stats,
      hitRate: this.stats.requests > 0 ? this.stats.cacheHits / this.stats.requests : 0,
      cacheSize: globalCache.size(),
      memoryUsage: globalCache.getStats().memoryUsage
    };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      requests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      conditionalRequests: 0,
      notModified: 0
    };
  }
}

// 全局缓存拦截器实例
export const apiCacheInterceptor = new ApiCacheInterceptor();

/**
 * 创建带缓存的fetch函数
 */
export function createCachedFetch(
  options: Partial<CacheInterceptorOptions> = {}
): typeof fetch {
  const interceptor = new ApiCacheInterceptor(options);
  
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    return interceptor.intercept(url, init);
  };
}

/**
 * 为treaty客户端添加缓存支持
 */
export function enhanceTreatyWithCache(client: any, options: Partial<CacheInterceptorOptions> = {}) {
  const interceptor = new ApiCacheInterceptor(options);
  
  // 这里需要根据treaty的具体实现来添加拦截器
  // 由于treaty的内部实现可能不同，这里提供一个通用的思路
  
  return {
    ...client,
    // 添加缓存控制方法
    cache: {
      invalidate: (pattern?: string) => interceptor.invalidateCache(pattern),
      getStats: () => interceptor.getStats(),
      resetStats: () => interceptor.resetStats()
    }
  };
}
