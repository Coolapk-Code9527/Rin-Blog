import { useState, useEffect, useCallback, useRef } from 'react';
import { CACHE_CONFIG } from '../utils/cacheConstants';
import { cache as cacheManager } from '../utils/SimpleCacheManager';

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
    staleTime = CACHE_CONFIG.API.DEFAULT_STALE_TIME, // 使用统一配置：15分钟
    cacheTime = CACHE_CONFIG.API.DEFAULT_CACHE_TIME, // 使用统一配置：60分钟
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
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * 获取缓存数据 - 使用SimpleCacheManager但获取完整信息
   */
  const getCachedData = useCallback((): CacheData<T> | null => {
    try {
      // 使用SimpleCacheManager的内部逻辑来获取完整的缓存信息
      const storageObj = sessionStorage;

      // 模拟SimpleCacheManager的getFullKey逻辑
      let fullKey = key;
      if (!key.startsWith('api_cache_')) {
        fullKey = `api_cache_${key}`;
      }

      const cached = storageObj.getItem(fullKey);
      if (!cached) return null;

      // 解析SimpleCacheManager的数据格式
      const simpleCacheData = JSON.parse(cached);

      if (!simpleCacheData || !simpleCacheData.data || !simpleCacheData.timestamp) {
        return null;
      }

      // 检查是否过期（使用SimpleCacheManager的过期逻辑）
      const now = Date.now();
      const expireTime = simpleCacheData.expireTime || cacheTime;
      if (now - simpleCacheData.timestamp > expireTime) {
        storageObj.removeItem(fullKey);
        return null;
      }

      // 重新构造useApiCache期望的CacheData格式，保持原始时间戳
      return {
        data: simpleCacheData.data,
        timestamp: simpleCacheData.timestamp, // 使用原始时间戳
        staleTime,
        cacheTime
      };
    } catch (error) {
      console.warn('Failed to get cached data:', error);
      return null;
    }
  }, [key, cacheTime, staleTime]);



  /**
   * 设置缓存数据 - 修复数据格式兼容性
   */
  const setCachedData = useCallback((newData: T) => {
    // 直接存储业务数据，让SimpleCacheManager处理包装
    cacheManager.set(key, newData, {
      storage: 'session',
      expireTime: cacheTime,
      validate: true
    });
  }, [key, cacheTime]);

  /**
   * 检查数据是否过期 - 简化逻辑
   * 由于SimpleCacheManager已经处理了过期检查，这里主要检查stale状态
   */
  const isDataStale = useCallback((cacheData: CacheData<T>): boolean => {
    // 如果能获取到数据，说明还在cacheTime内，检查是否超过staleTime
    return Date.now() - cacheData.timestamp > staleTime;
  }, [staleTime]);

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

      // 设置加载状态（避免依赖data，使用loading状态判断）
      if (mountedRef.current) {
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

      // 简化的重试逻辑
      if (retryCountRef.current < retryCount && mountedRef.current) {
        retryCountRef.current++;
        setTimeout(() => {
          if (mountedRef.current) {
            fetchingRef.current = false;
            fetchData(false);
          }
        }, retryDelay); // 使用固定延迟，移除指数退避
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
  }, [enabled, key, fetcher, getCachedData, setCachedData, isDataStale, retryCount, retryDelay]);

  /**
   * 强制刷新数据
   */
  const refetch = useCallback(async (): Promise<void> => {
    await fetchData(false);
  }, [fetchData]);

  /**
   * 使缓存失效并重新获取数据 - 使用SimpleCacheManager
   */
  const invalidate = useCallback(async () => {
    try {
      // 移除缓存
      cacheManager.remove(key, { storage: 'session' });

      // 重置状态
      setData(undefined);
      setIsStale(false);
      setError(null);

      // 立即重新获取数据
      if (enabled && mountedRef.current) {
        await fetchData(false);
      }
    } catch (error) {
      console.warn('Error during cache invalidation:', error);
    }
  }, [key, enabled, fetchData]);

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
 * 全局缓存管理工具 - 使用SimpleCacheManager
 */
export const ApiCacheManager = {
  /**
   * 清除所有API缓存
   */
  clearAll: () => cacheManager.clearAll('session'),

  /**
   * 清除特定前缀的缓存
   */
  clearByPrefix: (prefix: string) => cacheManager.clearByPattern(prefix, 'session', true),

  /**
   * 获取缓存统计信息
   */
  getStats: () => {
    const stats = cacheManager.getStats('session');
    return {
      totalCaches: stats.count,
      totalSize: stats.size
    };
  },

  /**
   * 缓存健康检查
   */
  healthCheck: () => cacheManager.healthCheck('session'),

  /**
   * 清理过期缓存
   */
  clearExpired: () => cacheManager.clearExpired('session')
};
