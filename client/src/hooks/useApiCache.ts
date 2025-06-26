import { useState, useEffect, useCallback } from 'react';

interface CacheData<T> {
  data: T;
  timestamp: number;
  params?: any; // 缓存参数，用于参数变化时失效缓存
}

interface CacheConfig {
  key: string;
  duration: number; // 缓存持续时间（毫秒）
  storage?: 'session' | 'local'; // 存储类型
}

interface UseApiCacheOptions<T> {
  cacheConfig: CacheConfig;
  fetcher: (...args: any[]) => Promise<T>;
  params?: any[]; // API参数
  enabled?: boolean; // 是否启用缓存
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

/**
 * 通用API缓存Hook
 * 
 * 基于useTagsWithCache模式，提供通用的API缓存功能
 * 支持参数变化时自动失效缓存，支持localStorage和sessionStorage
 * 
 * @param options 缓存配置选项
 * @returns 数据、加载状态、错误信息和刷新函数
 */
export function useApiCache<T>({
  cacheConfig,
  fetcher,
  params = [],
  enabled = true,
  onSuccess,
  onError
}: UseApiCacheOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { key, duration, storage = 'session' } = cacheConfig;

  // 获取存储对象
  const getStorage = () => storage === 'local' ? localStorage : sessionStorage;

  /**
   * 从缓存中获取数据
   */
  const getCachedData = useCallback((): CacheData<T> | null => {
    try {
      const cached = getStorage().getItem(key);
      if (!cached) return null;

      const cacheData: CacheData<T> = JSON.parse(cached);
      const now = Date.now();

      // 检查缓存是否过期
      if (now - cacheData.timestamp > duration) {
        getStorage().removeItem(key);
        return null;
      }

      // 检查参数是否变化（简单的JSON比较）
      if (params.length > 0) {
        const currentParamsStr = JSON.stringify(params);
        const cachedParamsStr = JSON.stringify(cacheData.params || []);
        if (currentParamsStr !== cachedParamsStr) {
          getStorage().removeItem(key);
          return null;
        }
      }

      return cacheData;
    } catch (error) {
      console.warn(`Failed to parse cached data for ${key}:`, error);
      getStorage().removeItem(key);
      return null;
    }
  }, [key, duration, params, storage]);

  /**
   * 保存数据到缓存
   */
  const setCachedData = useCallback((newData: T) => {
    try {
      const cacheData: CacheData<T> = {
        data: newData,
        timestamp: Date.now(),
        params: params.length > 0 ? params : undefined
      };
      getStorage().setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.warn(`Failed to cache data for ${key}:`, error);
    }
  }, [key, params, storage]);

  /**
   * 从API获取数据
   */
  const fetchData = useCallback(async (useCache: boolean = true): Promise<void> => {
    if (!enabled) return;

    try {
      setLoading(true);
      setError(null);

      // 尝试从缓存获取数据
      if (useCache) {
        const cachedData = getCachedData();
        if (cachedData) {
          setData(cachedData.data);
          setLoading(false);
          onSuccess?.(cachedData.data);
          return;
        }
      }

      // 从API获取数据
      const result = await fetcher(...params);
      setData(result);

      // 保存到缓存
      setCachedData(result);

      onSuccess?.(result);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
      console.error(`Failed to fetch data for ${key}:`, err);
      setError(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setLoading(false);
    }
  }, [enabled, fetcher, params, getCachedData, setCachedData, key, onSuccess, onError]);

  /**
   * 强制刷新数据（跳过缓存）
   */
  const refresh = useCallback(() => {
    getStorage().removeItem(key);
    fetchData(false);
  }, [key, fetchData, storage]);

  /**
   * 清除缓存
   */
  const clearCache = useCallback(() => {
    getStorage().removeItem(key);
  }, [key, storage]);

  // 初始化数据加载
  useEffect(() => {
    if (!enabled) return;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 尝试从缓存获取数据
        const cachedData = getCachedData();
        if (cachedData) {
          setData(cachedData.data);
          setLoading(false);
          onSuccess?.(cachedData.data);
          return;
        }

        // 从API获取数据
        const result = await fetcher(...params);
        setData(result);

        // 保存到缓存
        setCachedData(result);

        onSuccess?.(result);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
        console.error(`Failed to fetch data for ${key}:`, err);
        setError(errorMessage);
        onError?.(err instanceof Error ? err : new Error(errorMessage));
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [enabled, key, JSON.stringify(params)]); // 使用JSON.stringify来稳定params依赖

  return {
    data,
    loading,
    error,
    refresh,
    clearCache
  };
}

/**
 * 清理过期的缓存数据
 * 
 * 可以在应用启动时调用，清理所有过期的缓存数据
 * 
 * @param storageType 存储类型
 * @param keyPrefix 缓存键前缀，只清理匹配的缓存
 */
export function clearExpiredCache(
  storageType: 'session' | 'local' = 'session',
  keyPrefix?: string
): void {
  try {
    const storage = storageType === 'local' ? localStorage : sessionStorage;
    const keys = Object.keys(storage);
    
    keys.forEach(key => {
      // 如果指定了前缀，只处理匹配的键
      if (keyPrefix && !key.startsWith(keyPrefix)) {
        return;
      }

      try {
        const cached = storage.getItem(key);
        if (!cached) return;

        const cacheData = JSON.parse(cached);
        
        // 检查是否是我们的缓存格式
        if (typeof cacheData === 'object' && cacheData.timestamp) {
          const now = Date.now();
          // 如果没有明确的过期时间，使用默认的1小时
          const maxAge = 60 * 60 * 1000; // 1小时
          
          if (now - cacheData.timestamp > maxAge) {
            storage.removeItem(key);
          }
        }
      } catch (error) {
        // 如果解析失败，可能是其他数据，跳过
        console.warn(`Failed to parse cache data for key ${key}:`, error);
      }
    });
  } catch (error) {
    console.warn('Failed to clear expired cache:', error);
  }
}

/**
 * 预定义的缓存配置
 */
export const CACHE_CONFIGS = {
  // 标签缓存（30分钟）
  TAGS: {
    key: 'api_cache_tags',
    duration: 30 * 60 * 1000,
    storage: 'session' as const
  },
  // 文章列表缓存（10分钟）
  FEEDS: {
    key: 'api_cache_feeds',
    duration: 10 * 60 * 1000,
    storage: 'session' as const
  },
  // 文章详情缓存（15分钟）
  FEED_DETAIL: {
    key: 'api_cache_feed_detail',
    duration: 15 * 60 * 1000,
    storage: 'session' as const
  },
  // 评论缓存（5分钟）
  COMMENTS: {
    key: 'api_cache_comments',
    duration: 5 * 60 * 1000,
    storage: 'session' as const
  },
  // 用户配置缓存（1小时）
  CONFIG: {
    key: 'api_cache_config',
    duration: 60 * 60 * 1000,
    storage: 'local' as const
  }
} as const;
