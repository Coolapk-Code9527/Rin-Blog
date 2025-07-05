import { useState, useEffect, useCallback, useRef } from 'react';
import { CACHE_CONFIG } from '../utils/clientCacheConfig';
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
  etag?: string; // 添加ETag支持
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
   * 获取缓存数据 - 完全使用SimpleCacheManager统一架构
   */
  const getCachedData = useCallback((): CacheData<T> | null => {
    try {
      // 使用SimpleCacheManager的getWithMetadata方法获取完整信息
      const cacheResult = cacheManager.getWithMetadata<T>(key, {
        storage: 'session',
        expireTime: cacheTime
      });

      if (!cacheResult) return null;

      // 重新构造useApiCache期望的CacheData格式，保持原始时间戳
      return {
        data: cacheResult.data,
        timestamp: cacheResult.timestamp, // 使用原始时间戳，确保stale检查正确
        staleTime,
        cacheTime,
        etag: (cacheResult as any).etag // 保存ETag
      };
    } catch (error) {
      console.warn('Failed to get cached data:', error);
      return null;
    }
  }, [key, cacheTime, staleTime]);



  /**
   * 设置缓存数据 - 修复数据格式兼容性
   */
  const setCachedData = useCallback((newData: T, etag?: string) => {
    // 保存业务数据和ETag
    const dataToCache = etag ? { ...newData, etag } : newData;
    
    // 直接存储业务数据，让SimpleCacheManager处理包装
    cacheManager.set(key, dataToCache, {
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
   * 创建包含请求头的fetcher包装函数
   * 支持HTTP缓存控制
   */
  const wrappedFetcher = useCallback(async (etag?: string): Promise<{data: T, etag?: string}> => {
    // 如果原始fetcher是获取数据的函数，需要修改为支持HTTP缓存控制的版本
    if (typeof fetcher === 'function' && fetcher.toString().includes('fetch(')) {
      try {
        // 重构为自定义fetcher，添加ETag支持
        const response = await customFetch(fetcher.toString(), etag);
        // 如果返回304 Not Modified，表示数据未变化
        if (response.status === 304) {
          // 如果数据未变化，抛出特殊错误，外部捕获后使用缓存数据
          throw { notModified: true };
        }
        
        // 从响应中提取ETag
        const responseEtag = response.headers.get('ETag');
        const data = await response.json();
        return { data, etag: responseEtag || undefined };
      } catch (error) {
        if ((error as any).notModified) {
          throw error; // 重新抛出，以便外部处理
        }
        // 其他错误，使用原始fetcher
        const data = await fetcher();
        return { data };
      }
    } else {
      // 如果原始fetcher不是标准fetch调用，直接使用它
      const data = await fetcher();
      return { data };
    }
  }, [fetcher]);

  /**
   * 自定义fetch函数，支持HTTP缓存控制
   */
  const customFetch = useCallback(async (fetcherString: string, etag?: string) => {
    // 从fetcher字符串中提取URL和配置
    const urlMatch = fetcherString.match(/fetch\(['"]([^'"]+)['"]/);
    if (!urlMatch) {
      throw new Error('Cannot parse fetch URL from fetcher function');
    }
    
    const url = urlMatch[1];
    let options: RequestInit = {};
    
    // 尝试提取原始fetch的配置
    const optionsMatch = fetcherString.match(/fetch\([^,]+,\s*({[^}]+})/);
    if (optionsMatch) {
      try {
        // 这只是一个简单的尝试，不保证能正确解析所有配置
        // eslint-disable-next-line no-eval
        options = eval(`(${optionsMatch[1]})`);
      } catch (e) {
        console.warn('Failed to parse fetch options', e);
      }
    }
    
    // 添加ETag支持
    if (etag) {
      options.headers = {
        ...options.headers,
        'If-None-Match': etag
      };
    }
    
    // 执行fetch
    return await fetch(url, options);
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
      let cachedData: CacheData<T> | null = null;
      if (useCache) {
        cachedData = getCachedData();
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

      try {
        // 使用包含ETag的fetcher
        const { data: newData, etag } = await wrappedFetcher(cachedData?.etag);
        
        // 只有组件仍然挂载时才更新状态
        if (mountedRef.current) {
          setData(newData);
          setIsStale(false);
          setError(null);
          retryCountRef.current = 0;

          // 保存到缓存，包含ETag
          setCachedData(newData, etag);
        }
      } catch (err) {
        // 检查是否为304 Not Modified响应
        if ((err as any).notModified && cachedData) {
          // 数据未修改，使用缓存数据
          if (mountedRef.current) {
            setData(cachedData.data);
            setIsStale(false);
            setError(null);
            // 更新时间戳，重置过期时间
            const refreshedCache = {
              ...cachedData,
              timestamp: Date.now()
            };
            setCachedData(refreshedCache.data, refreshedCache.etag);
          }
          return;
        }
        
        // 其他错误情况，执行原有逻辑
        throw err;
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
  }, [enabled, key, wrappedFetcher, getCachedData, setCachedData, isDataStale, retryCount, retryDelay]);

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

// ApiCacheManager已合并到useFeedsCache.ts中的CacheManager
// 为了向后兼容，重新导出CacheManager
export { CacheManager as ApiCacheManager } from './useFeedsCache';
