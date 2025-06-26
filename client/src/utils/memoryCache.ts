/**
 * 轻量级内存缓存系统
 * 
 * 提供高性能的内存缓存，支持TTL、LRU淘汰策略和缓存统计
 */

interface CacheItem<T> {
  value: T;
  timestamp: number;
  ttl: number; // 生存时间（毫秒）
  accessCount: number;
  lastAccessed: number;
}

interface CacheOptions {
  maxSize?: number; // 最大缓存项数量
  defaultTTL?: number; // 默认TTL（毫秒）
  cleanupInterval?: number; // 清理间隔（毫秒）
  enableStats?: boolean; // 是否启用统计
}

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalRequests: number;
  size: number;
  maxSize: number;
  memoryUsage: number; // 估算的内存使用量（字节）
}

/**
 * 内存缓存类
 */
export class MemoryCache<T = any> {
  private cache = new Map<string, CacheItem<T>>();
  private stats: CacheStats;
  private cleanupTimer: number | null = null;
  private readonly options: Required<CacheOptions>;

  constructor(options: CacheOptions = {}) {
    this.options = {
      maxSize: options.maxSize || 1000,
      defaultTTL: options.defaultTTL || 5 * 60 * 1000, // 5分钟
      cleanupInterval: options.cleanupInterval || 60 * 1000, // 1分钟
      enableStats: options.enableStats !== false
    };

    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalRequests: 0,
      size: 0,
      maxSize: this.options.maxSize,
      memoryUsage: 0
    };

    // 启动定期清理
    this.startCleanup();
  }

  /**
   * 设置缓存项
   */
  set(key: string, value: T, ttl?: number): void {
    const now = Date.now();
    const itemTTL = ttl || this.options.defaultTTL;

    // 如果缓存已满，使用LRU策略移除最少使用的项
    if (this.cache.size >= this.options.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const item: CacheItem<T> = {
      value,
      timestamp: now,
      ttl: itemTTL,
      accessCount: 0,
      lastAccessed: now
    };

    this.cache.set(key, item);
    this.updateStats();
  }

  /**
   * 获取缓存项
   */
  get(key: string): T | null {
    this.stats.totalRequests++;

    const item = this.cache.get(key);
    
    if (!item) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    const now = Date.now();
    
    // 检查是否过期
    if (now - item.timestamp > item.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      this.updateStats();
      return null;
    }

    // 更新访问信息
    item.accessCount++;
    item.lastAccessed = now;

    this.stats.hits++;
    this.updateHitRate();
    
    return item.value;
  }

  /**
   * 检查缓存项是否存在且未过期
   */
  has(key: string): boolean {
    const item = this.cache.get(key);
    
    if (!item) {
      return false;
    }

    const now = Date.now();
    
    if (now - item.timestamp > item.ttl) {
      this.cache.delete(key);
      this.updateStats();
      return false;
    }

    return true;
  }

  /**
   * 删除缓存项
   */
  delete(key: string): boolean {
    const result = this.cache.delete(key);
    if (result) {
      this.updateStats();
    }
    return result;
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
    this.updateStats();
  }

  /**
   * 获取或设置缓存项（如果不存在则调用factory函数）
   */
  async getOrSet<R = T>(
    key: string,
    factory: () => Promise<R> | R,
    ttl?: number
  ): Promise<R> {
    const cached = this.get(key);

    if (cached !== null) {
      return cached as unknown as R;
    }

    const value = await factory();
    this.set(key, value as any, ttl);
    return value;
  }

  /**
   * 批量获取缓存项
   */
  mget(keys: string[]): Array<T | null> {
    return keys.map(key => this.get(key));
  }

  /**
   * 批量设置缓存项
   */
  mset(items: Array<{ key: string; value: T; ttl?: number }>): void {
    items.forEach(({ key, value, ttl }) => {
      this.set(key, value, ttl);
    });
  }

  /**
   * 获取所有缓存键
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalRequests: 0,
      size: this.cache.size,
      maxSize: this.options.maxSize,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * 手动清理过期项
   */
  cleanup(): number {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.updateStats();
    }

    return removedCount;
  }

  /**
   * 销毁缓存实例
   */
  destroy(): void {
    this.stopCleanup();
    this.clear();
  }

  /**
   * LRU淘汰策略
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, item] of this.cache.entries()) {
      if (item.lastAccessed < oldestTime) {
        oldestTime = item.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * 更新统计信息
   */
  private updateStats(): void {
    if (!this.options.enableStats) return;

    this.stats.size = this.cache.size;
    this.stats.memoryUsage = this.estimateMemoryUsage();
  }

  /**
   * 更新命中率
   */
  private updateHitRate(): void {
    if (!this.options.enableStats) return;

    this.stats.hitRate = this.stats.totalRequests > 0 
      ? this.stats.hits / this.stats.totalRequests 
      : 0;
  }

  /**
   * 估算内存使用量
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;

    for (const [key, item] of this.cache.entries()) {
      // 估算键的大小
      totalSize += key.length * 2; // UTF-16字符

      // 估算值的大小（简化计算）
      try {
        const serialized = JSON.stringify(item.value);
        totalSize += serialized.length * 2;
      } catch {
        totalSize += 100; // 默认估算
      }

      // 元数据大小
      totalSize += 64; // 时间戳、计数器等
    }

    return totalSize;
  }

  /**
   * 启动定期清理
   */
  private startCleanup(): void {
    if (this.cleanupTimer) return;

    this.cleanupTimer = window.setInterval(() => {
      const removed = this.cleanup();
      if (removed > 0) {
        console.log(`Memory cache cleaned up ${removed} expired items`);
      }
    }, this.options.cleanupInterval);
  }

  /**
   * 停止定期清理
   */
  private stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

/**
 * 全局缓存实例
 */
export const globalCache = new MemoryCache({
  maxSize: 1000,
  defaultTTL: 5 * 60 * 1000, // 5分钟
  cleanupInterval: 60 * 1000, // 1分钟
  enableStats: true
});

/**
 * 创建专用缓存实例
 */
export function createCache<T = any>(options: CacheOptions = {}): MemoryCache<T> {
  return new MemoryCache<T>(options);
}

/**
 * 缓存装饰器（用于函数结果缓存）
 */
export function cached<T extends (...args: any[]) => any>(
  ttl?: number,
  keyGenerator?: (...args: Parameters<T>) => string
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const cache = createCache({ defaultTTL: ttl });

    descriptor.value = async function (...args: Parameters<T>) {
      const key = keyGenerator 
        ? keyGenerator(...args)
        : `${propertyKey}_${JSON.stringify(args)}`;

      return cache.getOrSet(key, () => originalMethod.apply(this, args), ttl);
    };

    return descriptor;
  };
}

/**
 * 简单的函数结果缓存
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  options: { ttl?: number; keyGenerator?: (...args: Parameters<T>) => string } = {}
): T {
  const cache = createCache({ defaultTTL: options.ttl });

  return ((...args: Parameters<T>) => {
    const key = options.keyGenerator 
      ? options.keyGenerator(...args)
      : JSON.stringify(args);

    return cache.getOrSet(key, () => fn(...args), options.ttl);
  }) as T;
}
