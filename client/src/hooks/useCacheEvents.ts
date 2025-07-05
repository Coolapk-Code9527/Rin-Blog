import { useEffect, useCallback } from 'react';
import { 
  cacheEventManager, 
  CacheEventType, 
  CacheEventListener,
  CacheEventDetail 
} from '../utils/CacheEventManager';

/**
 * 缓存事件Hook
 * 
 * 提供简化的缓存事件监听和触发功能
 */
export function useCacheEvents() {
  /**
   * 监听缓存事件
   * 
   * @param eventType 事件类型
   * @param listener 监听器函数
   * @param deps 依赖数组
   */
  const on = useCallback((
    eventType: CacheEventType, 
    listener: CacheEventListener,
    deps: any[] = []
  ) => {
    useEffect(() => {
      return cacheEventManager.on(eventType, listener);
    }, deps);
  }, []);

  /**
   * 触发缓存事件
   */
  const emit = useCallback((
    eventType: CacheEventType, 
    detail?: CacheEventDetail, 
    debounce: boolean = true
  ) => {
    cacheEventManager.emit(eventType, detail, debounce);
  }, []);

  return { on, emit };
}

/**
 * 缓存失效Hook
 * 
 * 为特定的缓存Hook提供自动失效功能
 */
export function useCacheInvalidation(
  invalidateFunction: () => void,
  eventTypes: CacheEventType[],
  condition?: (detail?: CacheEventDetail) => boolean
) {
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    for (const eventType of eventTypes) {
      const listener: CacheEventListener = (event) => {
        // 如果有条件函数，检查是否满足条件
        if (condition && !condition(event.detail)) {
          return;
        }
        
        invalidateFunction();
      };

      const unsubscribe = cacheEventManager.on(eventType, listener);
      unsubscribers.push(unsubscribe);
    }

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [invalidateFunction, eventTypes, condition]);
}

/**
 * 文章相关缓存失效Hook
 * 
 * 专门用于文章列表、搜索等页面的缓存失效
 */
export function useFeedCacheInvalidation(invalidateFunction: () => void) {
  useCacheInvalidation(
    invalidateFunction,
    ['feed-published', 'feed-updated', 'feed-deleted']
  );
}

/**
 * 配置相关缓存失效Hook
 * 
 * 专门用于配置页面的缓存失效
 */
export function useConfigCacheInvalidation(
  invalidateFunction: () => void,
  configType?: 'client' | 'server'
) {
  useCacheInvalidation(
    invalidateFunction,
    ['config-updated'],
    configType ? (detail) => detail?.configType === configType : undefined
  );
}

/**
 * 特定文章缓存失效Hook
 * 
 * 专门用于文章详情页的缓存失效
 */
export function useSpecificFeedCacheInvalidation(
  invalidateFunction: () => void,
  feedId: string | number
) {
  useCacheInvalidation(
    invalidateFunction,
    ['feed-updated', 'feed-deleted'],
    (detail) => detail?.feedId === feedId
  );
}
