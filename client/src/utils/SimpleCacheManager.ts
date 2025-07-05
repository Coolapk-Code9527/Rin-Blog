/**
 * 轻量级缓存管理器
 * 
 * 专注于统一基础缓存操作，避免过度工程化
 * 主要目标：减少代码冗余，统一缓存接口，保持简单实用
 */

import { CACHE_CONFIG } from './clientCacheConfig';

/**
 * 缓存存储类型
 */
export type StorageType = 'session' | 'local';

/**
 * 缓存选项
 */
export interface CacheOptions {
  /** 过期时间（毫秒），默认使用CACHE_CONFIG.API.DEFAULT_STALE_TIME */
  expireTime?: number;
  /** 存储类型，默认session */
  storage?: StorageType;
  /** 是否在设置时验证数据 */
  validate?: boolean;
}

/**
 * 缓存数据结构
 */
interface CacheData<T = any> {
  data: T;
  timestamp: number;
  expireTime: number;
}

/**
 * 轻量级缓存管理器
 * 
 * 提供统一的缓存操作接口，整合分散的缓存逻辑
 */
export class SimpleCacheManager {
  private static instance: SimpleCacheManager;
  
  /**
   * 获取单例实例
   */
  static getInstance(): SimpleCacheManager {
    if (!SimpleCacheManager.instance) {
      SimpleCacheManager.instance = new SimpleCacheManager();
    }
    return SimpleCacheManager.instance;
  }

  /**
   * 获取存储对象
   */
  private getStorage(type: StorageType): Storage {
    return type === 'local' ? localStorage : sessionStorage;
  }

  /**
   * 生成完整的缓存键
   *
   * 简化逻辑，明确的向后兼容规则
   */
  private getFullKey(key: string, storage: StorageType): string {
    // 如果已经有前缀，直接使用
    if (key.startsWith('api_cache_') || key.startsWith('local_cache_')) {
      return key;
    }

    // 向后兼容规则：特定的键保持原有格式
    if (storage === 'local') {
      // 表单缓存键（包含/）和特定的缓存键保持原格式
      if (key.includes('/') || key === 'website_stats_cache') {
        return key;
      }
    }

    // 新的缓存键使用统一前缀
    const prefix = storage === 'session' ? 'api_cache_' : 'local_cache_';
    return `${prefix}${key}`;
  }

  /**
   * 获取缓存数据及其元数据
   */
  getWithMetadata<T = any>(key: string, options: CacheOptions = {}): { data: T; timestamp: number; expireTime: number } | null {
    const { storage = 'session', expireTime = CACHE_CONFIG.API.DEFAULT_STALE_TIME } = options;

    try {
      const storageObj = this.getStorage(storage);
      const fullKey = this.getFullKey(key, storage);
      const cached = storageObj.getItem(fullKey);

      if (!cached) {
        return null;
      }

      let cacheData: CacheData<T>;

      try {
        cacheData = JSON.parse(cached);
      } catch (parseError) {
        // 解析失败，清理无效缓存
        this.remove(key, options);
        return null;
      }

      // 检查数据结构
      if (!cacheData || typeof cacheData !== 'object' || !('data' in cacheData) || !('timestamp' in cacheData)) {
        this.remove(key, options);
        return null;
      }

      // 检查是否过期
      const now = Date.now();
      const actualExpireTime = cacheData.expireTime || expireTime;
      if (now - cacheData.timestamp > actualExpireTime) {
        this.remove(key, options);
        return null;
      }

      return {
        data: cacheData.data,
        timestamp: cacheData.timestamp,
        expireTime: actualExpireTime
      };
    } catch (error) {
      console.warn('Failed to get cached data with metadata:', error);
      return null;
    }
  }

  /**
   * 获取缓存数据
   */
  get<T = any>(key: string, options: CacheOptions = {}): T | null {
    const { storage = 'session', expireTime = CACHE_CONFIG.API.DEFAULT_STALE_TIME } = options;

    try {
      const storageObj = this.getStorage(storage);
      const fullKey = this.getFullKey(key, storage);
      const cached = storageObj.getItem(fullKey);

      if (!cached) {
        return null;
      }

      let cacheData: CacheData<T>;

      try {
        cacheData = JSON.parse(cached);
      } catch (parseError) {
        // 解析失败，清理无效缓存
        this.remove(key, options);
        return null;
      }

      // 检查数据结构并处理旧格式数据
      if (!cacheData || typeof cacheData !== 'object') {
        this.remove(key, options);
        return null;
      }

      // 处理旧格式数据（没有expireTime字段）
      if ('data' in cacheData && 'timestamp' in cacheData && !('expireTime' in cacheData)) {
        // 这是旧格式数据，添加expireTime字段并重新保存
        const migratedData: CacheData<T> = {
          data: (cacheData as any).data,
          timestamp: (cacheData as any).timestamp,
          expireTime: expireTime
        };

        // 重新保存迁移后的数据
        try {
          storageObj.setItem(fullKey, JSON.stringify(migratedData));
          cacheData = migratedData;
        } catch (saveError) {
          // 保存失败，但仍然可以使用数据
          console.warn('Failed to migrate cache data format:', saveError);
          cacheData = migratedData;
        }
      }

      // 检查必要字段
      if (!('data' in cacheData) || !('timestamp' in cacheData)) {
        this.remove(key, options);
        return null;
      }

      // 检查是否过期
      const now = Date.now();
      const dataExpireTime = cacheData.expireTime || expireTime;
      if (now - cacheData.timestamp > dataExpireTime) {
        this.remove(key, options);
        return null;
      }

      return cacheData.data;
    } catch (error) {
      console.warn(`Failed to get cache for key: ${key}`, error);
      // 发生错误时尝试清理，但不抛出异常
      try {
        this.remove(key, options);
      } catch (removeError) {
        // 清理也失败，记录但继续
        console.warn(`Failed to remove invalid cache for key: ${key}`, removeError);
      }
      return null;
    }
  }

  /**
   * 设置缓存数据
   */
  set<T = any>(key: string, data: T, options: CacheOptions = {}): boolean {
    const { 
      expireTime = CACHE_CONFIG.API.DEFAULT_STALE_TIME, 
      storage = 'session',
      validate = false 
    } = options;

    try {
      // 可选的数据验证
      if (validate && (data === null || data === undefined)) {
        console.warn(`Invalid data for cache key: ${key}`);
        return false;
      }

      const storageObj = this.getStorage(storage);
      const fullKey = this.getFullKey(key, storage);
      
      const cacheData: CacheData<T> = {
        data,
        timestamp: Date.now(),
        expireTime
      };

      storageObj.setItem(fullKey, JSON.stringify(cacheData));
      return true;
    } catch (error) {
      console.warn(`Failed to set cache for key: ${key}`, error);

      // 存储失败时尝试清理过期缓存后重试
      const cleanedCount = this.clearExpired(storage);

      // 只有清理了一些缓存才重试
      if (cleanedCount > 0) {
        try {
          const storageObj = this.getStorage(storage);
          const fullKey = this.getFullKey(key, storage);
          storageObj.setItem(fullKey, JSON.stringify({
            data,
            timestamp: Date.now(),
            expireTime
          }));
          console.log(`Cache set successful after cleaning ${cleanedCount} expired items`);
          return true;
        } catch (retryError) {
          console.warn(`Failed to set cache after cleanup for key: ${key}`, retryError);
          return false;
        }
      } else {
        // 没有清理到任何缓存，可能是存储空间真的不足
        console.warn(`Storage quota exceeded for key: ${key}, no expired cache to clean`);
        return false;
      }
    }
  }

  /**
   * 删除缓存数据
   */
  remove(key: string, options: CacheOptions = {}): boolean {
    const { storage = 'session' } = options;
    
    try {
      const storageObj = this.getStorage(storage);
      const fullKey = this.getFullKey(key, storage);
      storageObj.removeItem(fullKey);
      return true;
    } catch (error) {
      console.warn(`Failed to remove cache for key: ${key}`, error);
      return false;
    }
  }

  /**
   * 检查缓存是否存在且未过期
   */
  has(key: string, options: CacheOptions = {}): boolean {
    return this.get(key, options) !== null;
  }

  /**
   * 清理过期缓存
   */
  clearExpired(storage: StorageType = 'session'): number {
    try {
      const storageObj = this.getStorage(storage);
      const prefix = storage === 'session' ? 'api_cache_' : 'local_cache_';
      const keysToRemove: string[] = [];
      const now = Date.now();

      // 遍历所有键
      for (let i = 0; i < storageObj.length; i++) {
        const key = storageObj.key(i);
        if (key?.startsWith(prefix)) {
          try {
            const cached = storageObj.getItem(key);
            if (cached) {
              const cacheData: CacheData = JSON.parse(cached);
              if (!cacheData || now - cacheData.timestamp > cacheData.expireTime) {
                keysToRemove.push(key);
              }
            }
          } catch {
            // 解析失败的缓存也要清理
            keysToRemove.push(key);
          }
        }
      }

      // 批量删除
      keysToRemove.forEach(key => storageObj.removeItem(key));
      return keysToRemove.length;
    } catch (error) {
      console.warn('Failed to clear expired cache:', error);
      return 0;
    }
  }

  /**
   * 按模式清理缓存
   *
   * 支持精确匹配和模糊匹配
   */
  clearByPattern(pattern: string, storage: StorageType = 'session', exact: boolean = false): number {
    try {
      const storageObj = this.getStorage(storage);
      const keysToRemove: string[] = [];

      // 遍历所有键
      for (let i = 0; i < storageObj.length; i++) {
        const key = storageObj.key(i);
        if (!key) continue;

        let shouldRemove = false;

        if (exact) {
          // 精确匹配：键必须完全等于模式或以模式开头
          shouldRemove = key === pattern || key.startsWith(pattern);
        } else {
          // 模糊匹配：键包含模式
          shouldRemove = key.includes(pattern);
        }

        // 额外检查：确保是我们管理的缓存键
        const isOurCache = key.startsWith('api_cache_') ||
                          key.startsWith('local_cache_') ||
                          (storage === 'local' && (key.includes('/') || key === 'website_stats_cache'));

        if (shouldRemove && isOurCache) {
          keysToRemove.push(key);
        }
      }

      return this.batchRemove(keysToRemove, storage);
    } catch (error) {
      console.warn(`Failed to clear cache by pattern: ${pattern}`, error);
      return 0;
    }
  }

  /**
   * 批量删除缓存键
   */
  private batchRemove(keys: string[], storage: StorageType): number {
    try {
      const storageObj = this.getStorage(storage);
      keys.forEach(key => storageObj.removeItem(key));
      return keys.length;
    } catch (error) {
      console.warn('Failed to batch remove cache keys:', error);
      return 0;
    }
  }

  /**
   * 清理所有缓存
   */
  clearAll(storage: StorageType = 'session'): number {
    try {
      const storageObj = this.getStorage(storage);
      const prefix = storage === 'session' ? 'api_cache_' : 'local_cache_';
      const keysToRemove: string[] = [];

      // 遍历所有键
      for (let i = 0; i < storageObj.length; i++) {
        const key = storageObj.key(i);
        if (key?.startsWith(prefix)) {
          keysToRemove.push(key);
        }
      }

      return this.batchRemove(keysToRemove, storage);
    } catch (error) {
      console.warn('Failed to clear all cache:', error);
      return 0;
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats(storage: StorageType = 'session'): { count: number; size: number; expired: number; invalid: number } {
    try {
      const storageObj = this.getStorage(storage);
      let count = 0;
      let size = 0;
      let expired = 0;
      let invalid = 0;
      const now = Date.now();

      for (let i = 0; i < storageObj.length; i++) {
        const key = storageObj.key(i);
        if (!key) continue;

        // 检查是否是我们管理的缓存
        const isOurCache = key.startsWith('api_cache_') ||
                          key.startsWith('local_cache_') ||
                          (storage === 'local' && (key.includes('/') || key === 'website_stats_cache'));

        if (isOurCache) {
          count++;
          const value = storageObj.getItem(key);
          if (value) {
            size += value.length;

            // 检查缓存是否过期或无效
            try {
              const cacheData = JSON.parse(value);
              if (cacheData && typeof cacheData === 'object' && 'timestamp' in cacheData) {
                const expireTime = cacheData.expireTime || CACHE_CONFIG.API.DEFAULT_STALE_TIME;
                if (now - cacheData.timestamp > expireTime) {
                  expired++;
                }
              } else {
                invalid++;
              }
            } catch {
              invalid++;
            }
          }
        }
      }

      return { count, size, expired, invalid };
    } catch (error) {
      console.warn('Failed to get cache stats:', error);
      return { count: 0, size: 0, expired: 0, invalid: 0 };
    }
  }

  /**
   * 缓存健康检查
   */
  healthCheck(storage: StorageType = 'session'): { healthy: boolean; issues: string[]; stats: { count: number; size: number; expired: number; invalid: number } } {
    const stats = this.getStats(storage);
    const issues: string[] = [];

    // 检查过期缓存比例
    if (stats.count > 0) {
      const expiredRatio = stats.expired / stats.count;
      if (expiredRatio > 0.3) {
        issues.push(`High expired cache ratio: ${(expiredRatio * 100).toFixed(1)}%`);
      }

      const invalidRatio = stats.invalid / stats.count;
      if (invalidRatio > 0.1) {
        issues.push(`High invalid cache ratio: ${(invalidRatio * 100).toFixed(1)}%`);
      }
    }

    // 检查存储大小
    const sizeMB = stats.size / (1024 * 1024);
    if (sizeMB > 5) {
      issues.push(`Large cache size: ${sizeMB.toFixed(2)}MB`);
    }

    return {
      healthy: issues.length === 0,
      issues,
      stats
    };
  }
}

/**
 * 导出单例实例
 */
export const cacheManager = SimpleCacheManager.getInstance();

/**
 * 清理历史遗留的错误缓存键
 */
export function cleanupLegacyCache(): { cleaned: number; errors: string[] } {
  const errors: string[] = [];
  let cleaned = 0;

  try {
    // 清理sessionStorage中的错误格式缓存键
    const sessionKeys = Object.keys(sessionStorage);
    sessionKeys.forEach(key => {
      // 清理错误的api_api:格式
      if (key.startsWith('api_api:')) {
        try {
          sessionStorage.removeItem(key);
          cleaned++;
        } catch (error) {
          errors.push(`Failed to remove session key: ${key}`);
        }
      }

      // 清理其他可能的错误格式
      if (key.includes('api_api') || key.includes('cache_cache_')) {
        try {
          sessionStorage.removeItem(key);
          cleaned++;
        } catch (error) {
          errors.push(`Failed to remove session key: ${key}`);
        }
      }
    });

    // 清理localStorage中的错误格式缓存键
    const localKeys = Object.keys(localStorage);
    localKeys.forEach(key => {
      if (key.startsWith('api_api:') || key.includes('api_api') || key.includes('cache_cache_')) {
        try {
          localStorage.removeItem(key);
          cleaned++;
        } catch (error) {
          errors.push(`Failed to remove local key: ${key}`);
        }
      }
    });

    console.log(`Legacy cache cleanup completed: ${cleaned} items cleaned, ${errors.length} errors`);
  } catch (error) {
    errors.push(`General cleanup error: ${error}`);
  }

  return { cleaned, errors };
}

/**
 * 便捷的缓存操作函数
 */
export const cache = {
  get: <T = any>(key: string, options?: CacheOptions) => cacheManager.get<T>(key, options),
  getWithMetadata: <T = any>(key: string, options?: CacheOptions) => cacheManager.getWithMetadata<T>(key, options),
  set: <T = any>(key: string, data: T, options?: CacheOptions) => cacheManager.set(key, data, options),
  remove: (key: string, options?: CacheOptions) => cacheManager.remove(key, options),
  has: (key: string, options?: CacheOptions) => cacheManager.has(key, options),
  clearExpired: (storage?: StorageType) => cacheManager.clearExpired(storage),
  clearByPattern: (pattern: string, storage?: StorageType, exact?: boolean) => cacheManager.clearByPattern(pattern, storage, exact),
  clearAll: (storage?: StorageType) => cacheManager.clearAll(storage),
  getStats: (storage?: StorageType) => cacheManager.getStats(storage),
  healthCheck: (storage?: StorageType) => cacheManager.healthCheck(storage),
  cleanupLegacy: cleanupLegacyCache
};
