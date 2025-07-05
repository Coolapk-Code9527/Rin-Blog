/**
 * 统一缓存系统 - 超激进精简版本
 *
 * 将所有缓存相关功能合并到一个文件中：
 * - 缓存管理器
 * - 缓存配置
 * - 缓存Hook
 * - 缓存工具
 *
 * @version 3.0.0 - 超激进精简版本
 * 替代：SimpleCacheManager、useFeedsCache、useApiCache、CacheEventManager等12个文件
 */

import { useState, useEffect, useCallback } from 'react';

// 导入API客户端和工具
let client: any;
let headersWithAuth: any;

// 延迟导入，避免循环依赖
const getApiClient = async () => {
  if (!client) {
    const { client: apiClient } = await import('../main');
    const { headersWithAuth: authHeaders } = await import('../utils/auth');
    client = apiClient;
    headersWithAuth = authHeaders;
  }
  return { client, headersWithAuth };
};

// ===== 缓存配置 =====

/** 缓存时间常量（毫秒） */
export const CACHE_TIMES = {
  REALTIME: 1 * 60 * 1000,    // 1分钟
  SHORT: 2 * 60 * 1000,       // 2分钟  
  MEDIUM: 10 * 60 * 1000,     // 10分钟
  LONG: 30 * 60 * 1000        // 30分钟
} as const;

/** 统一缓存配置 */
export const CACHE_CONFIG = {
  FEEDS: {
    LIST: CACHE_TIMES.REALTIME,    // 文章列表：1分钟
    SINGLE: CACHE_TIMES.MEDIUM,    // 单篇文章：10分钟
    SEARCH: CACHE_TIMES.SHORT      // 搜索结果：2分钟
  },
  TAGS: {
    LIST: CACHE_TIMES.MEDIUM,      // 标签列表：10分钟
    FEEDS: CACHE_TIMES.SHORT       // 标签文章：2分钟
  },
  FILES: {
    LIST: CACHE_TIMES.SHORT,       // 文件列表：2分钟
    DETAIL: CACHE_TIMES.MEDIUM     // 文件详情：10分钟
  },
  CONFIG: {
    CLIENT: CACHE_TIMES.LONG,      // 客户端配置：30分钟
    SERVER: CACHE_TIMES.LONG       // 服务端配置：30分钟
  },
  COMMENTS: {
    LIST: CACHE_TIMES.MEDIUM       // 评论列表：10分钟
  },
  FRIENDS: {
    LIST: CACHE_TIMES.MEDIUM       // 友情链接：10分钟
  },
  TIMELINE: {
    LIST: CACHE_TIMES.SHORT        // 时间线：2分钟
  },
  STATS: {
    WEBSITE: CACHE_TIMES.MEDIUM    // 网站统计：10分钟
  }
} as const;

/** 缓存键模式 */
export const CACHE_KEYS = {
  FEED: (id: string) => `feed_id:${id}`,
  FEEDS: (type: string, page: number, limit: number, sort: string) => 
    `feeds_type:${type}_page:${page}_limit:${limit}_sort:${sort}`,
  SEARCH: (keyword: string, page: number, limit: number) => 
    `search_keyword:${encodeURIComponent(keyword)}_page:${page}_limit:${limit}`,
  TAGS: () => 'tags_list',
  TAG_FEEDS: (tag: string) => `tags_feeds_tag:${encodeURIComponent(tag)}`,
  FILES: (path: string, search: string, sortBy: string, sortOrder: string, page: number, limit: number) =>
    `files_path:${encodeURIComponent(path)}_search:${encodeURIComponent(search)}_sort:${sortBy}_order:${sortOrder}_page:${page}_limit:${limit}`,
  CONFIG: (type: string) => `config_type:${type}`,
  COMMENTS: (feedId: string) => `comments_feed:${feedId}`,
  TIMELINE: () => 'timeline_feeds',
  RECENT_POSTS: (limit: number) => `recent_posts_limit:${limit}`,
  ADJACENT_FEEDS: (id: string) => `adjacent_feeds_id:${id}`,
  FRIENDS: () => 'friends_list'
} as const;

// ===== 缓存管理器 =====

interface CacheItem<T = any> {
  data: T;
  timestamp: number;
  expireTime: number;
}

class UnifiedCacheManager {
  private prefix = 'api_cache_';

  /** 获取缓存 */
  get<T>(key: string, maxAge: number = CACHE_TIMES.MEDIUM): T | null {
    try {
      const fullKey = this.prefix + key;
      const item = sessionStorage.getItem(fullKey);
      if (!item) return null;

      const cached: CacheItem<T> = JSON.parse(item);
      const now = Date.now();
      
      if (now - cached.timestamp > maxAge) {
        this.remove(key);
        return null;
      }
      
      return cached.data;
    } catch {
      return null;
    }
  }

  /** 设置缓存 */
  set<T>(key: string, data: T, maxAge: number = CACHE_TIMES.MEDIUM): void {
    try {
      const fullKey = this.prefix + key;
      const item: CacheItem<T> = {
        data,
        timestamp: Date.now(),
        expireTime: maxAge
      };
      sessionStorage.setItem(fullKey, JSON.stringify(item));
    } catch {
      // 静默失败，避免存储空间不足时的错误
    }
  }

  /** 删除缓存 */
  remove(key: string): void {
    try {
      const fullKey = this.prefix + key;
      sessionStorage.removeItem(fullKey);
    } catch {
      // 静默失败
    }
  }

  /** 检查缓存是否存在 */
  has(key: string): boolean {
    try {
      const fullKey = this.prefix + key;
      return sessionStorage.getItem(fullKey) !== null;
    } catch {
      return false;
    }
  }

  /** 清除所有缓存 */
  clear(): void {
    try {
      const keys = Object.keys(sessionStorage);
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          sessionStorage.removeItem(key);
        }
      });
    } catch {
      // 静默失败
    }
  }

  /** 清除特定前缀的缓存 */
  clearByPrefix(prefix: string): void {
    try {
      const keys = Object.keys(sessionStorage);
      const fullPrefix = this.prefix + prefix;
      keys.forEach(key => {
        if (key.startsWith(fullPrefix)) {
          sessionStorage.removeItem(key);
        }
      });
    } catch {
      // 静默失败
    }
  }

  /** 清除过期缓存 */
  clearExpired(): void {
    try {
      const keys = Object.keys(sessionStorage);
      const now = Date.now();
      
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          try {
            const item = sessionStorage.getItem(key);
            if (item) {
              const cached: CacheItem = JSON.parse(item);
              if (now - cached.timestamp > cached.expireTime) {
                sessionStorage.removeItem(key);
              }
            }
          } catch {
            // 删除损坏的缓存项
            sessionStorage.removeItem(key);
          }
        }
      });
    } catch {
      // 静默失败
    }
  }

  /** 清除所有文章相关缓存 */
  clearAllFeeds(): void {
    const patterns = [
      'feeds_', 'feed_', 'search_', 'tags_', 'timeline_', 'recent_posts_', 'adjacent_feeds_', 'comments_'
    ];
    patterns.forEach(pattern => this.clearByPrefix(pattern));
  }

  /** 清除特定文章缓存 */
  clearFeed(id: string): void {
    this.remove(CACHE_KEYS.FEED(id));
    this.clearByPrefix(`adjacent_feeds_id:${id}`);
  }

  /** 清除特定类型的文章缓存 */
  clearFeedsByType(type: string): void {
    this.clearByPrefix(`type:${type}`);
  }

  /** 获取缓存统计信息 */
  getStats(): { count: number; size: number } {
    try {
      const keys = Object.keys(sessionStorage);
      const cacheKeys = keys.filter(key => key.startsWith(this.prefix));
      let totalSize = 0;
      
      cacheKeys.forEach(key => {
        const item = sessionStorage.getItem(key);
        if (item) {
          totalSize += item.length;
        }
      });
      
      return {
        count: cacheKeys.length,
        size: totalSize
      };
    } catch {
      return { count: 0, size: 0 };
    }
  }
}

// 导出单例
export const cache = new UnifiedCacheManager();

// ===== 统一缓存Hook =====

interface UseCacheOptions {
  staleTime?: number;
  enabled?: boolean;
  refetchOnWindowFocus?: boolean;
  retryCount?: number;
}

interface UseCacheResult<T> {
  data: T | undefined;
  error: Error | null;
  isLoading: boolean;
  isValidating: boolean;
  mutate: () => void;
  invalidate: () => void;
}

/**
 * 统一缓存Hook - 替代所有其他缓存Hook
 * 
 * 替代：useApiCache、useFeedsCache、useSearchCache、useTagsCache等
 */
export function useCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: UseCacheOptions = {}
): UseCacheResult<T> {
  const {
    staleTime = CACHE_TIMES.MEDIUM,
    enabled = true,
    refetchOnWindowFocus = false,
    retryCount = 3
  } = options;

  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [retryAttempts, setRetryAttempts] = useState(0);

  // 获取缓存数据
  const getCachedData = useCallback(() => {
    return cache.get<T>(key, staleTime);
  }, [key, staleTime]);

  // 获取数据
  const fetchData = useCallback(async (isRetry = false) => {
    if (!enabled) return;

    setIsValidating(true);
    setError(null);
    
    if (!isRetry) {
      setIsLoading(true);
    }

    try {
      const result = await fetcher();
      cache.set(key, result, staleTime);
      setData(result);
      setRetryAttempts(0);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      
      // 重试逻辑
      if (retryAttempts < retryCount) {
        setRetryAttempts(prev => prev + 1);
        setTimeout(() => fetchData(true), 1000 * Math.pow(2, retryAttempts));
      }
    } finally {
      setIsValidating(false);
      setIsLoading(false);
    }
  }, [key, fetcher, staleTime, enabled, retryAttempts, retryCount]);

  // 手动刷新
  const mutate = useCallback(() => {
    fetchData();
  }, [fetchData]);

  // 失效缓存并刷新
  const invalidate = useCallback(() => {
    cache.remove(key);
    fetchData();
  }, [key, fetchData]);

  // 初始化数据
  useEffect(() => {
    if (!enabled) return;

    const cachedData = getCachedData();
    if (cachedData) {
      setData(cachedData);
    } else {
      fetchData();
    }
  }, [enabled, getCachedData, fetchData]);

  // 窗口聚焦时刷新
  useEffect(() => {
    if (!refetchOnWindowFocus || !enabled) return;

    const handleFocus = () => {
      const cachedData = getCachedData();
      if (!cachedData) {
        fetchData();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetchOnWindowFocus, enabled, getCachedData, fetchData]);

  return {
    data,
    error,
    isLoading,
    isValidating,
    mutate,
    invalidate
  };
}

// ===== 便捷Hook =====

/**
 * 单篇文章缓存Hook
 */
export function useFeedCache(id: string, enabled: boolean = true) {
  const key = CACHE_KEYS.FEED(id);

  return useCache(key, async () => {
    const { client, headersWithAuth } = await getApiClient();
    const response = await client.feed({ id }).get({
      headers: headersWithAuth()
    });

    if (response.error) {
      throw new Error(response.error.value as string);
    }

    return response.data;
  }, {
    staleTime: CACHE_CONFIG.FEEDS.SINGLE,
    enabled: enabled && !!id,
    refetchOnWindowFocus: false
  });
}

/**
 * 评论缓存Hook
 */
export function useCommentsCache(feedId: string, enabled: boolean = true) {
  const key = CACHE_KEYS.COMMENTS(feedId);

  return useCache(key, async () => {
    const { client } = await getApiClient();
    const response = await client.feed.comment({ feed: feedId }).get();

    if (response.error) {
      throw new Error(response.error.value as string);
    }

    return response.data || [];
  }, {
    staleTime: CACHE_CONFIG.COMMENTS.LIST,
    enabled: enabled && !!feedId,
    refetchOnWindowFocus: true
  });
}

/**
 * 文章列表缓存Hook
 */
export function useFeedsCache(type = 'all', page = 1, limit = 10, sortByTime = false) {
  const key = CACHE_KEYS.FEEDS(type, page, limit, sortByTime ? 'time' : 'default');

  return useCache(key, async () => {
    const { client, headersWithAuth } = await getApiClient();
    const response = await client.feed.get({
      query: {
        type,
        page: page.toString(),
        limit: limit.toString(),
        sort: sortByTime ? 'time' : 'default'
      },
      headers: headersWithAuth()
    });

    if (response.error) {
      throw new Error(response.error.value as string);
    }

    return response.data;
  }, {
    staleTime: CACHE_CONFIG.FEEDS.LIST,
    refetchOnWindowFocus: true
  });
}

/**
 * 搜索结果缓存Hook
 */
export function useSearchCache(keyword: string, page = 1, limit = 10) {
  const key = CACHE_KEYS.SEARCH(keyword, page, limit);

  return useCache(key, async () => {
    if (!keyword) {
      return { data: [], size: 0, hasNext: false };
    }

    const { client, headersWithAuth } = await getApiClient();
    const response = await client.feed.search.get({
      query: {
        keyword,
        page: page.toString(),
        limit: limit.toString()
      },
      headers: headersWithAuth()
    });

    if (response.error) {
      throw new Error(response.error.value as string);
    }

    return response.data;
  }, {
    staleTime: CACHE_CONFIG.FEEDS.SEARCH,
    refetchOnWindowFocus: true,
    enabled: !!keyword
  });
}

/**
 * 标签缓存Hook
 */
export function useTagsCache() {
  const key = CACHE_KEYS.TAGS();

  return useCache(key, async () => {
    const { client, headersWithAuth } = await getApiClient();
    const response = await client.hashtag.get({
      headers: headersWithAuth()
    });

    if (response.error) {
      throw new Error(response.error.value as string);
    }

    return response.data;
  }, {
    staleTime: CACHE_CONFIG.TAGS.LIST,
    refetchOnWindowFocus: false
  });
}

/**
 * 时间线缓存Hook
 */
export function useTimelineCache() {
  const key = CACHE_KEYS.TIMELINE();

  return useCache(key, async () => {
    const { client, headersWithAuth } = await getApiClient();
    const response = await client.feed.timeline.get({
      headers: headersWithAuth()
    });

    if (response.error) {
      throw new Error(response.error.value as string);
    }

    return response.data;
  }, {
    staleTime: CACHE_CONFIG.TIMELINE.LIST,
    refetchOnWindowFocus: true
  });
}

/**
 * 相邻文章缓存Hook
 */
export function useAdjacentFeedsCache(id: string, enabled: boolean = true) {
  const key = CACHE_KEYS.ADJACENT_FEEDS(id);

  return useCache(key, async () => {
    const { client, headersWithAuth } = await getApiClient();
    const response = await client.feed.adjacent({ id }).get({
      headers: headersWithAuth()
    });

    if (response.error) {
      throw new Error(response.error.value as string);
    }

    return response.data;
  }, {
    staleTime: CACHE_CONFIG.FEEDS.SINGLE,
    enabled: enabled && !!id,
    refetchOnWindowFocus: false
  });
}

/**
 * 最近文章缓存Hook
 */
export function useRecentPostsCache(limit: number = 3) {
  const key = CACHE_KEYS.RECENT_POSTS(limit);

  return useCache(key, async () => {
    const { client, headersWithAuth } = await getApiClient();
    const response = await client.feed.recent.get({
      query: { limit: limit.toString() },
      headers: headersWithAuth()
    });

    if (response.error) {
      throw new Error(response.error.value as string);
    }

    return response.data;
  }, {
    staleTime: CACHE_CONFIG.FEEDS.LIST,
    refetchOnWindowFocus: true
  });
}

/**
 * 标签文章缓存Hook
 */
export function useHashtagFeedsCache(tag: string, enabled: boolean = true) {
  const key = CACHE_KEYS.TAG_FEEDS(tag);

  return useCache(key, async () => {
    const { client, headersWithAuth } = await getApiClient();
    const response = await client.feed.hashtag({ tag }).get({
      headers: headersWithAuth()
    });

    if (response.error) {
      throw new Error(response.error.value as string);
    }

    return response.data;
  }, {
    staleTime: CACHE_CONFIG.TAGS.FEEDS,
    enabled: enabled && !!tag,
    refetchOnWindowFocus: true
  });
}

/**
 * 友情链接缓存Hook
 */
export function useFriendsCache() {
  const key = CACHE_KEYS.FRIENDS();

  return useCache(key, async () => {
    const { client, headersWithAuth } = await getApiClient();
    const response = await client.friends.get({
      headers: headersWithAuth()
    });

    if (response.error) {
      throw new Error(response.error.value as string);
    }

    return response.data;
  }, {
    staleTime: CACHE_CONFIG.FRIENDS.LIST,
    refetchOnWindowFocus: false
  });
}

/**
 * 配置缓存Hook
 */
export function useConfigCache(type: 'client' | 'server') {
  const key = CACHE_KEYS.CONFIG(type);

  return useCache(key, async () => {
    const { client, headersWithAuth } = await getApiClient();
    const response = await client.config({ type }).get({
      headers: headersWithAuth()
    });

    if (response.error) {
      throw new Error(response.error.value as string);
    }

    return response.data;
  }, {
    staleTime: type === 'client' ? CACHE_CONFIG.CONFIG.CLIENT : CACHE_CONFIG.CONFIG.SERVER,
    refetchOnWindowFocus: false
  });
}

/**
 * 文件列表缓存Hook
 */
export function useFilesCache(
  path: string = '/',
  search: string = '',
  sortBy: string = 'name',
  sortOrder: string = 'asc',
  page: number = 1,
  limit: number = 50
) {
  const key = CACHE_KEYS.FILES(path, search, sortBy, sortOrder, page, limit);

  return useCache(key, async () => {
    const { client, headersWithAuth } = await getApiClient();
    const response = await client.files.get({
      query: {
        path,
        search,
        sortBy,
        sortOrder,
        page: page.toString(),
        limit: limit.toString()
      },
      headers: headersWithAuth()
    });

    if (response.error) {
      throw new Error(response.error.value as string);
    }

    return response.data;
  }, {
    staleTime: CACHE_CONFIG.FILES.LIST,
    refetchOnWindowFocus: true
  });
}

// ===== 向后兼容导出 =====

// 保持与现有代码的兼容性
export const CACHE_KEY_PATTERNS = CACHE_KEYS;
export const cacheManager = cache;

// 旧的别名（逐步废弃）
export const SHORT_CACHE = CACHE_TIMES.SHORT;
export const MEDIUM_CACHE = CACHE_TIMES.MEDIUM;
export const LONG_CACHE = CACHE_TIMES.LONG;
export const REALTIME_CACHE = CACHE_TIMES.REALTIME;
