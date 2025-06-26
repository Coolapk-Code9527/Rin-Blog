/**
 * 内存管理工具
 * 
 * 提供对象池化、内存泄漏防护和大对象引用管理
 */

/**
 * 对象池接口
 */
interface ObjectPool<T> {
  acquire(): T;
  release(obj: T): void;
  size(): number;
  clear(): void;
}

/**
 * 通用对象池实现
 */
class GenericObjectPool<T> implements ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset?: (obj: T) => void;
  private maxSize: number;

  constructor(factory: () => T, maxSize: number = 50, reset?: (obj: T) => void) {
    this.factory = factory;
    this.maxSize = maxSize;
    this.reset = reset;
  }

  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.factory();
  }

  release(obj: T): void {
    if (this.pool.length < this.maxSize) {
      if (this.reset) {
        this.reset(obj);
      }
      this.pool.push(obj);
    }
  }

  size(): number {
    return this.pool.length;
  }

  clear(): void {
    this.pool.length = 0;
  }
}

/**
 * 预定义的对象池
 */
export const ObjectPools = {
  // 数组池
  arrays: new GenericObjectPool<any[]>(
    () => [],
    30,
    (arr) => { arr.length = 0; }
  ),

  // 对象池
  objects: new GenericObjectPool<Record<string, any>>(
    () => ({}),
    30,
    (obj) => {
      for (const key in obj) {
        delete obj[key];
      }
    }
  ),

  // Map池
  maps: new GenericObjectPool<Map<string, any>>(
    () => new Map(),
    20,
    (map) => { map.clear(); }
  ),

  // Set池
  sets: new GenericObjectPool<Set<any>>(
    () => new Set(),
    20,
    (set) => { set.clear(); }
  )
};

/**
 * 弱引用管理器
 * 用于管理大对象的引用，防止内存泄漏
 * 注意：简化版本，兼容 Cloudflare Workers 环境
 */
class WeakReferenceManager {
  private refs = new WeakMap<object, string>();

  /**
   * 注册一个对象进行弱引用管理
   */
  register(obj: object, id: string): void {
    this.refs.set(obj, id);
  }

  /**
   * 手动取消注册
   */
  unregister(obj: object): void {
    this.refs.delete(obj);
  }

  /**
   * 检查对象是否已注册
   */
  has(obj: object): boolean {
    return this.refs.has(obj);
  }
}

export const weakRefManager = new WeakReferenceManager();

/**
 * 内存使用监控
 */
export class MemoryMonitor {
  private static instance: MemoryMonitor;
  private largeObjectThreshold = 1024 * 1024; // 1MB
  private largeObjects = new Set<WeakRef<object>>();

  static getInstance(): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor();
    }
    return MemoryMonitor.instance;
  }

  /**
   * 注册大对象进行监控
   */
  registerLargeObject(obj: object, size?: number): void {
    if (size && size < this.largeObjectThreshold) {
      return;
    }

    const weakRef = new WeakRef(obj);
    this.largeObjects.add(weakRef);
    
    // 定期清理已被垃圾回收的弱引用
    if (this.largeObjects.size > 100) {
      this.cleanupWeakRefs();
    }
  }

  /**
   * 清理已被垃圾回收的弱引用
   */
  private cleanupWeakRefs(): void {
    const toDelete: WeakRef<object>[] = [];
    
    for (const ref of this.largeObjects) {
      if (ref.deref() === undefined) {
        toDelete.push(ref);
      }
    }
    
    toDelete.forEach(ref => this.largeObjects.delete(ref));
  }

  /**
   * 获取当前监控的大对象数量
   */
  getLargeObjectCount(): number {
    this.cleanupWeakRefs();
    return this.largeObjects.size;
  }

  /**
   * 强制垃圾回收（仅在支持的环境中）
   */
  forceGC(): void {
    // Cloudflare Workers 环境中不支持手动 GC
    if (typeof global !== 'undefined' && global.gc) {
      global.gc();
    }
  }
}

/**
 * 内存优化工具函数
 */
export const MemoryUtils = {
  /**
   * 安全地处理大字符串，避免内存泄漏
   */
  async processLargeString(str: string, processor: (chunk: string) => void, chunkSize = 1000): Promise<void> {
    if (str.length <= chunkSize) {
      processor(str);
      return;
    }

    for (let i = 0; i < str.length; i += chunkSize) {
      const chunk = str.slice(i, i + chunkSize);
      processor(chunk);

      // 让出控制权，避免阻塞
      if (i % (chunkSize * 10) === 0) {
        // 在支持的环境中让出控制权
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  },

  /**
   * 深度克隆对象，使用对象池优化
   */
  deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime()) as unknown as T;
    }

    if (obj instanceof Array) {
      const arr = ObjectPools.arrays.acquire();
      try {
        for (let i = 0; i < obj.length; i++) {
          arr[i] = this.deepClone(obj[i]);
        }
        return arr as unknown as T;
      } finally {
        // 注意：这里不能释放arr，因为它被返回了
        // 实际使用中需要调用者负责释放
      }
    }

    const cloned = ObjectPools.objects.acquire();
    try {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          cloned[key] = this.deepClone(obj[key]);
        }
      }
      return cloned as T;
    } finally {
      // 注意：这里不能释放cloned，因为它被返回了
      // 实际使用中需要调用者负责释放
    }
  },

  /**
   * 释放对象池中的对象
   */
  releasePooledObject(obj: any): void {
    if (Array.isArray(obj)) {
      ObjectPools.arrays.release(obj);
    } else if (obj instanceof Map) {
      ObjectPools.maps.release(obj);
    } else if (obj instanceof Set) {
      ObjectPools.sets.release(obj);
    } else if (typeof obj === 'object' && obj !== null) {
      ObjectPools.objects.release(obj);
    }
  }
};

/**
 * 清理所有内存管理资源
 */
export function cleanupMemoryManager(): void {
  ObjectPools.arrays.clear();
  ObjectPools.objects.clear();
  ObjectPools.maps.clear();
  ObjectPools.sets.clear();
  
  const monitor = MemoryMonitor.getInstance();
  monitor.forceGC();
}
