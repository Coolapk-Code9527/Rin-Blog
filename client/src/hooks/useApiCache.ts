import { useState, useEffect, useCallback, useRef } from 'react';

// 全局时间戳计数器，确保唯一性
let timestampCounter = 0;

/**
 * 生成唯一的高精度时间戳
 */
function generateUniqueTimestamp(): number {
  const now = performance.now() + performance.timeOrigin;
  const uniqueTimestamp = now + (timestampCounter++ / 1000000); // 添加微秒级别的递增
  return uniqueTimestamp;
}

/**
 * 自定义序列化工具
 * 正确处理Date对象、函数等特殊类型
 */
class CacheSerializer {
  /**
   * 序列化数据
   */
  static serialize(data: any): string {
    return JSON.stringify(data, (key, value) => {
      // 处理Date对象
      if (value instanceof Date) {
        return {
          __type: 'Date',
          __value: value.toISOString()
        };
      }

      // 处理RegExp对象
      if (value instanceof RegExp) {
        return {
          __type: 'RegExp',
          __value: value.toString()
        };
      }

      // 处理函数（通常不应该缓存，但提供降级处理）
      if (typeof value === 'function') {
        return {
          __type: 'Function',
          __value: '[Function]'
        };
      }

      // 处理undefined（JSON.stringify会忽略undefined）
      if (value === undefined) {
        return {
          __type: 'undefined',
          __value: null
        };
      }

      return value;
    });
  }

  /**
   * 反序列化数据
   */
  static deserialize(jsonString: string): any {
    try {
      return JSON.parse(jsonString, (key, value) => {
        // 检查是否是特殊类型标记
        if (value && typeof value === 'object' && value.__type) {
          switch (value.__type) {
            case 'Date':
              return new Date(value.__value);

            case 'RegExp':
              // 解析RegExp字符串
              const match = value.__value.match(/^\/(.*)\/([gimuy]*)$/);
              if (match) {
                return new RegExp(match[1], match[2]);
              }
              return new RegExp(value.__value);

            case 'Function':
              // 函数无法恢复，返回空函数
              return () => {};

            case 'undefined':
              return undefined;

            default:
              return value;
          }
        }

        return value;
      });
    } catch (error) {
      console.warn('Failed to deserialize cache data:', error);
      return null;
    }
  }

  /**
   * 验证序列化数据的完整性
   */
  static validateSerialization(original: any, serialized: string): boolean {
    try {
      const deserialized = this.deserialize(serialized);

      // 简单的深度比较（不完美，但足够用于缓存验证）
      return JSON.stringify(original) === JSON.stringify(deserialized);
    } catch {
      return false;
    }
  }
}

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
    staleTime = 10 * 60 * 1000, // 优化：默认10分钟（从5分钟延长）
    cacheTime = 60 * 60 * 1000, // 优化：默认60分钟（从30分钟延长）
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
  const retryTimersRef = useRef<NodeJS.Timeout[]>([]);

  // 组件卸载时清理
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // 清理所有重试定时器
      retryTimersRef.current.forEach(timer => clearTimeout(timer));
      retryTimersRef.current = [];
    };
  }, []);

  /**
   * 获取缓存数据
   */
  const getCachedData = useCallback((): CacheData<T> | null => {
    try {
      const cached = sessionStorage.getItem(`api_cache_${key}`);
      if (!cached) return null;

      const cacheData: CacheData<T> = CacheSerializer.deserialize(cached);

      // 检查反序列化是否成功
      if (!cacheData) {
        sessionStorage.removeItem(`api_cache_${key}`);
        return null;
      }

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
   * 检查并清理过期缓存
   */
  const cleanExpiredCache = useCallback(() => {
    try {
      const now = Date.now();
      const keysToRemove: string[] = [];

      for (let i = 0; i < sessionStorage.length; i++) {
        const storageKey = sessionStorage.key(i);
        if (storageKey?.startsWith('api_cache_')) {
          try {
            const cached = CacheSerializer.deserialize(sessionStorage.getItem(storageKey) || '');
            if (!cached || now - cached.timestamp > cached.cacheTime) {
              keysToRemove.push(storageKey);
            }
          } catch {
            keysToRemove.push(storageKey);
          }
        }
      }

      keysToRemove.forEach(key => sessionStorage.removeItem(key));
      return keysToRemove.length;
    } catch (error) {
      console.warn('Failed to clean expired cache:', error);
      return 0;
    }
  }, []);

  /**
   * 检查存储容量并清理
   */
  const ensureStorageCapacity = useCallback((dataSize: number) => {
    const maxSize = 4 * 1024 * 1024; // 4MB限制，留出安全边际

    try {
      // 估算当前使用量
      let currentSize = 0;
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) {
          currentSize += (sessionStorage.getItem(key) || '').length;
        }
      }

      // 如果加上新数据会超出限制，先清理过期缓存
      if (currentSize + dataSize > maxSize) {
        cleanExpiredCache();

        // 重新计算大小
        currentSize = 0;
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key) {
            currentSize += (sessionStorage.getItem(key) || '').length;
          }
        }

        // 如果还是超出，实施LRU清理
        if (currentSize + dataSize > maxSize) {
          const cacheEntries: Array<{key: string, timestamp: number}> = [];

          for (let i = 0; i < sessionStorage.length; i++) {
            const storageKey = sessionStorage.key(i);
            if (storageKey?.startsWith('api_cache_')) {
              try {
                const cached = CacheSerializer.deserialize(sessionStorage.getItem(storageKey) || '');
                if (cached && cached.timestamp) {
                  cacheEntries.push({ key: storageKey, timestamp: cached.timestamp });
                } else {
                  sessionStorage.removeItem(storageKey);
                }
              } catch {
                sessionStorage.removeItem(storageKey);
              }
            }
          }

          // 按时间戳排序，移除最旧的缓存
          cacheEntries.sort((a, b) => a.timestamp - b.timestamp);

          for (const entry of cacheEntries) {
            // 修复：先获取项目大小，再删除项目
            const itemSize = (sessionStorage.getItem(entry.key) || '').length;
            sessionStorage.removeItem(entry.key);
            currentSize -= itemSize;

            if (currentSize + dataSize <= maxSize) {
              break;
            }
          }
        }
      }

      return true;
    } catch (error) {
      console.warn('Failed to ensure storage capacity:', error);
      return false;
    }
  }, [cleanExpiredCache]);

  /**
   * 设置缓存数据
   */
  const setCachedData = useCallback((newData: T) => {
    try {
      const cacheData: CacheData<T> = {
        data: newData,
        timestamp: generateUniqueTimestamp(),
        staleTime,
        cacheTime
      };

      const serializedData = CacheSerializer.serialize(cacheData);

      // 验证序列化完整性（开发环境）
      if (process.env.NODE_ENV === 'development') {
        if (!CacheSerializer.validateSerialization(cacheData, serializedData)) {
          console.warn('Cache serialization validation failed for key:', key);
        }
      }

      // 确保有足够的存储空间
      if (ensureStorageCapacity(serializedData.length)) {
        sessionStorage.setItem(`api_cache_${key}`, serializedData);
      } else {
        console.warn('Unable to cache data: insufficient storage capacity');
      }
    } catch (error) {
      console.warn('Failed to cache data:', error);
    }
  }, [key, staleTime, cacheTime, ensureStorageCapacity]);

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

      // 重试逻辑（只有组件仍然挂载时才重试）
      if (retryCountRef.current < retryCount && mountedRef.current) {
        retryCountRef.current++;
        const retryTimer = setTimeout(() => {
          if (mountedRef.current) {
            fetchingRef.current = false;
            fetchData(false);
          }
        }, retryDelay * retryCountRef.current);

        // 跟踪定时器以便清理
        retryTimersRef.current.push(retryTimer);
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
   * 使缓存失效并重新获取数据
   */
  const invalidate = useCallback(async () => {
    try {
      // 安全地移除sessionStorage中的缓存
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.removeItem(`api_cache_${key}`);
      }

      // 安全地更新状态
      if (setData) {
        setData(undefined);
      }
      if (setIsStale) {
        setIsStale(false);
      }
      if (setError) {
        setError(null);
      }

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
