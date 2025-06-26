import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * API缓存配置接口
 */
interface ApiCacheConfig {
  /** 缓存时间（毫秒），默认5分钟 */
  staleTime?: number;
  /** 缓存保持时间（毫秒），默认30分钟 */
  cacheTime?: number;
  /** 窗口聚焦时是否重新获取，默认true */
  refetchOnWindowFocus?: boolean;
  /** 是否启用缓存，默认true */
  enabled?: boolean;
  /** 重试次数，默认3次 */
  retryCount?: number;
  /** 重试延迟（毫秒），默认1000ms */
  retryDelay?: number;
}

/**
 * 缓存数据结构
 */
interface CacheData<T> {
  data: T;
  timestamp: number;
  staleTime: number;
  cacheTime: number;
}

/**
 * Hook返回值接口
 */
interface UseApiCacheReturn<T> {
  /** 数据 */
  data: T | undefined;
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 是否为过期数据 */
  isStale: boolean;
  /** 强制刷新 */
  refetch: () => Promise<void>;
  /** 使缓存失效 */
  invalidate: () => void;
}

/**
 * 统一的API缓存Hook
 * 
 * 实现SWR（stale-while-revalidate）模式的数据获取策略
 * 
 * @param key 缓存键，用于标识唯一的API请求
 * @param fetcher 数据获取函数
 * @param config 缓存配置
 * @returns API数据、状态和控制方法
 */
export function useApiCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  config: ApiCacheConfig = {}
): UseApiCacheReturn<T> {
  const {
    staleTime = 5 * 60 * 1000, // 5分钟
    cacheTime = 30 * 60 * 1000, // 30分钟
    refetchOnWindowFocus = true,
    enabled = true,
    retryCount = 3,
    retryDelay = 1000
  } = config;

  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);

  // 使用ref避免重复请求和组件卸载后的状态更新
  const fetchingRef = useRef(false);
  const retryCountRef = useRef(0);
  const mountedRef = useRef(true);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * 获取缓存数据
   */
  const getCachedData = useCallback((): CacheData<T> | null => {
    try {
      const cached = sessionStorage.getItem(`api_cache_${key}`);
      if (!cached) return null;

      const cacheData: CacheData<T> = JSON.parse(cached);
      const now = Date.now();

      // 检查缓存是否过期
      if (now - cacheData.timestamp > cacheData.cacheTime) {
        sessionStorage.removeItem(`api_cache_${key}`);
        return null;
      }

      return cacheData;
    } catch (error) {
      console.warn('Failed to parse cached data:', error);
      sessionStorage.removeItem(`api_cache_${key}`);
      return null;
    }
  }, [key]);

  /**
   * 设置缓存数据
   */
  const setCachedData = useCallback((newData: T) => {
    try {
      const cacheData: CacheData<T> = {
        data: newData,
        timestamp: Date.now(),
        staleTime,
        cacheTime
      };
      sessionStorage.setItem(`api_cache_${key}`, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache data:', error);
    }
  }, [key, staleTime, cacheTime]);

  /**
   * 检查数据是否过期
   */
  const isDataStale = useCallback((cacheData: CacheData<T>): boolean => {
    return Date.now() - cacheData.timestamp > cacheData.staleTime;
  }, []);

  /**
   * 执行数据获取
   */
  const fetchData = useCallback(async (useCache: boolean = true): Promise<void> => {
    if (!enabled || fetchingRef.current || !mountedRef.current) return;

    try {
      if (mountedRef.current) {
        setError(null);
      }

      // 尝试从缓存获取数据
      if (useCache) {
        const cachedData = getCachedData();
        if (cachedData && mountedRef.current) {
          setData(cachedData.data);
          setIsStale(isDataStale(cachedData));

          // 如果数据未过期，直接返回
          if (!isDataStale(cachedData)) {
            setLoading(false);
            return;
          }
        }
      }

      // 设置加载状态
      if (!data && mountedRef.current) {
        setLoading(true);
      }

      fetchingRef.current = true;

      // 从API获取数据
      const newData = await fetcher();

      // 只有组件仍然挂载时才更新状态
      if (mountedRef.current) {
        setData(newData);
        setIsStale(false);
        setError(null);
        retryCountRef.current = 0;

        // 保存到缓存
        setCachedData(newData);
      }

    } catch (err) {
      console.error(`API fetch failed for key: ${key}`, err);

      // 重试逻辑（只有组件仍然挂载时才重试）
      if (retryCountRef.current < retryCount && mountedRef.current) {
        retryCountRef.current++;
        setTimeout(() => {
          if (mountedRef.current) {
            fetchingRef.current = false;
            fetchData(false);
          }
        }, retryDelay * retryCountRef.current);
        return;
      }

      // 只有组件仍然挂载时才更新错误状态
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
        retryCountRef.current = 0;
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
      fetchingRef.current = false;
    }
  }, [enabled, key, fetcher, getCachedData, setCachedData, isDataStale, data, retryCount, retryDelay]);

  /**
   * 强制刷新数据
   */
  const refetch = useCallback(async (): Promise<void> => {
    await fetchData(false);
  }, [fetchData]);

  /**
   * 使缓存失效
   */
  const invalidate = useCallback(() => {
    sessionStorage.removeItem(`api_cache_${key}`);
    setData(undefined);
    setIsStale(false);
    setError(null);
  }, [key]);

  // 初始化数据加载
  useEffect(() => {
    if (enabled) {
      fetchData();
    }
  }, [enabled, key]);

  // 窗口聚焦时重新获取数据
  useEffect(() => {
    if (!refetchOnWindowFocus || !enabled) return;

    const handleFocus = () => {
      const cachedData = getCachedData();
      if (cachedData && isDataStale(cachedData)) {
        fetchData();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetchOnWindowFocus, enabled, fetchData, getCachedData, isDataStale]);

  return {
    data,
    loading,
    error,
    isStale,
    refetch,
    invalidate
  };
}

/**
 * 全局缓存管理工具
 */
export const ApiCacheManager = {
  /**
   * 清除所有API缓存
   */
  clearAll: () => {
    const keys = Object.keys(sessionStorage);
    keys.forEach(key => {
      if (key.startsWith('api_cache_')) {
        sessionStorage.removeItem(key);
      }
    });
  },

  /**
   * 清除特定前缀的缓存
   */
  clearByPrefix: (prefix: string) => {
    const keys = Object.keys(sessionStorage);
    keys.forEach(key => {
      if (key.startsWith(`api_cache_${prefix}`)) {
        sessionStorage.removeItem(key);
      }
    });
  },

  /**
   * 获取缓存统计信息
   */
  getStats: () => {
    const keys = Object.keys(sessionStorage);
    const cacheKeys = keys.filter(key => key.startsWith('api_cache_'));
    
    return {
      totalCaches: cacheKeys.length,
      totalSize: cacheKeys.reduce((size, key) => {
        return size + (sessionStorage.getItem(key)?.length || 0);
      }, 0)
    };
  }
};
