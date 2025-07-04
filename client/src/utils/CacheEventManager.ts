/**
 * 统一缓存事件管理器
 * 
 * 提供统一的缓存失效事件管理机制，确保数据修改操作后相关缓存能够及时失效
 * 
 * 功能特点：
 * - 事件驱动的缓存失效机制
 * - 支持多种数据类型的缓存失效
 * - 防止重复事件触发
 * - 类型安全的事件处理
 */

export type CacheEventType = 
  | 'feed-published'    // 文章发布
  | 'feed-updated'      // 文章更新
  | 'feed-deleted'      // 文章删除
  | 'config-updated'    // 配置更新
  | 'friend-updated'    // 友情链接更新
  | 'file-uploaded'     // 文件上传
  | 'cache-cleared';    // 缓存清理

export interface CacheEventDetail {
  feedId?: number | string;
  configType?: 'client' | 'server';
  title?: string;
  tags?: string[];
  [key: string]: any;
}

export interface CacheEventListener {
  (event: CustomEvent<CacheEventDetail>): void;
}

/**
 * 缓存事件管理器
 */
export class CacheEventManager {
  private static instance: CacheEventManager;
  
  // 事件监听器注册表
  private listeners: Map<CacheEventType, Set<CacheEventListener>> = new Map();
  
  // 防抖定时器
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  
  // 配置
  private readonly DEBOUNCE_DELAY = 100; // 100ms防抖延迟
  
  private constructor() {}
  
  static getInstance(): CacheEventManager {
    if (!CacheEventManager.instance) {
      CacheEventManager.instance = new CacheEventManager();
    }
    return CacheEventManager.instance;
  }
  
  /**
   * 触发缓存事件
   * 
   * @param eventType 事件类型
   * @param detail 事件详情
   * @param debounce 是否防抖（默认true）
   */
  emit(eventType: CacheEventType, detail?: CacheEventDetail, debounce: boolean = true): void {
    if (debounce) {
      this.emitWithDebounce(eventType, detail);
    } else {
      this.emitImmediate(eventType, detail);
    }
  }
  
  /**
   * 立即触发事件
   * 只通过window事件系统触发，避免重复处理
   */
  private emitImmediate(eventType: CacheEventType, detail?: CacheEventDetail): void {
    const event = new CustomEvent(eventType, { detail });
    window.dispatchEvent(event);
  }
  
  /**
   * 防抖触发事件
   */
  private emitWithDebounce(eventType: CacheEventType, detail?: CacheEventDetail): void {
    const key = `${eventType}_${JSON.stringify(detail)}`;
    
    // 清除之前的定时器
    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // 设置新的定时器
    const timer = setTimeout(() => {
      this.emitImmediate(eventType, detail);
      this.debounceTimers.delete(key);
    }, this.DEBOUNCE_DELAY);
    
    this.debounceTimers.set(key, timer);
  }
  
  /**
   * 监听缓存事件
   *
   * @param eventType 事件类型
   * @param listener 监听器函数
   * @returns 取消监听的函数
   */
  on(eventType: CacheEventType, listener: CacheEventListener): () => void {
    // 只维护内部listeners用于管理，不重复绑定window事件
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    this.listeners.get(eventType)!.add(listener);

    // 直接使用window事件系统，避免双重绑定
    window.addEventListener(eventType, listener as EventListener);

    // 返回取消监听的函数
    return () => {
      this.off(eventType, listener);
    };
  }
  
  /**
   * 取消监听缓存事件
   * 
   * @param eventType 事件类型
   * @param listener 监听器函数
   */
  off(eventType: CacheEventType, listener: CacheEventListener): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.listeners.delete(eventType);
      }
    }
    
    window.removeEventListener(eventType, listener as EventListener);
  }
  
  /**
   * 清理所有监听器
   */
  clear(): void {
    for (const [eventType, listeners] of this.listeners) {
      for (const listener of listeners) {
        window.removeEventListener(eventType, listener as EventListener);
      }
    }
    
    this.listeners.clear();
    
    // 清理防抖定时器
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }
  
  /**
   * 获取当前监听器数量（用于调试）
   */
  getListenerCount(): number {
    let count = 0;
    for (const listeners of this.listeners.values()) {
      count += listeners.size;
    }
    return count;
  }
}

/**
 * 全局缓存事件管理器实例
 */
export const cacheEventManager = CacheEventManager.getInstance();

/**
 * 便捷的缓存失效函数
 */
export const invalidateCache = {
  /**
   * 文章发布后失效相关缓存
   */
  onFeedPublished: (feedId: number | string, title?: string, tags?: string[]) => {
    cacheEventManager.emit('feed-published', { feedId, title, tags });
  },
  
  /**
   * 文章更新后失效相关缓存
   */
  onFeedUpdated: (feedId: number | string, title?: string, tags?: string[]) => {
    cacheEventManager.emit('feed-updated', { feedId, title, tags });
  },
  
  /**
   * 文章删除后失效相关缓存
   */
  onFeedDeleted: (feedId: number | string) => {
    console.log(`📡 [DEBUG] invalidateCache.onFeedDeleted() 被调用 - 文章ID: ${feedId}`);
    cacheEventManager.emit('feed-deleted', { feedId });
    console.log(`📡 [DEBUG] 已发送 feed-deleted 事件 - 文章ID: ${feedId}`);
  },
  
  /**
   * 配置更新后失效相关缓存
   */
  onConfigUpdated: (configType: 'client' | 'server') => {
    cacheEventManager.emit('config-updated', { configType });
  },
  
  /**
   * 友情链接更新后失效相关缓存
   */
  onFriendUpdated: () => {
    cacheEventManager.emit('friend-updated');
  },
  
  /**
   * 文件上传后失效相关缓存
   */
  onFileUploaded: () => {
    cacheEventManager.emit('file-uploaded');
  },
  
  /**
   * 缓存清理后失效所有缓存
   */
  onCacheCleared: () => {
    cacheEventManager.emit('cache-cleared');
  }
};
