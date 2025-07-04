import { useSafeCacheInvalidation } from './useComponentSafety';
import { useFeedCacheInvalidation } from './useCacheEvents';
import { FeedsCacheManager } from './useFeedsCache';

/**
 * 增强的缓存失效Hook
 * 
 * 统一处理缓存失效逻辑，避免重复代码
 * 同时清除所有相关缓存并失效当前页面缓存
 */
export function useEnhancedCacheInvalidation(invalidateFunction: () => void) {
  // 创建增强的缓存失效函数
  const enhancedInvalidation = useSafeCacheInvalidation(() => {
    // 首先清除所有文章相关缓存
    FeedsCacheManager.clearAllFeeds();
    // 然后失效当前页面的缓存
    invalidateFunction();
  });

  // 监听文章发布/更新/删除事件
  useFeedCacheInvalidation(enhancedInvalidation);

  return enhancedInvalidation;
}
