import { useCallback, useEffect, useRef } from 'react';
import { client } from '../main';
import { cacheManager } from '../utils/SimpleCacheManager';

/**
 * 缓存版本检查Hook
 * 
 * 实现基于版本号的智能缓存刷新机制
 */
export function useCacheVersion() {
  const currentVersionRef = useRef<number>(0);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  /**
   * 获取当前客户端缓存版本
   */
  const getCurrentVersion = useCallback((): number => {
    const stored = localStorage.getItem('cache_version');
    return stored ? parseInt(stored) : 0;
  }, []);
  
  /**
   * 设置客户端缓存版本
   */
  const setCurrentVersion = useCallback((version: number): void => {
    currentVersionRef.current = version;
    localStorage.setItem('cache_version', version.toString());
    console.log(`🔄 [CLIENT VERSION] 更新客户端版本: ${version}`);
  }, []);
  
  /**
   * 检查服务端版本并决定是否需要刷新缓存
   */
  const checkVersion = useCallback(async (): Promise<boolean> => {
    try {
      const currentVersion = getCurrentVersion();
      
      // 动态导入endpoint以避免循环依赖
      const { endpoint } = await import('../main');

      const response = await fetch(`${endpoint}/feed/version?version=${currentVersion}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      const { contentVersion, needsUpdate } = data;
      
      if (needsUpdate) {
        console.log(`🔄 [CLIENT VERSION] 检测到版本更新: 客户端=${currentVersion}, 服务端=${contentVersion}`);
        
        // 清除所有相关缓存
        clearAllContentCache();
        
        // 更新客户端版本
        setCurrentVersion(contentVersion);
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.warn('版本检查异常:', error);
      return false;
    }
  }, [getCurrentVersion, setCurrentVersion]);
  
  /**
   * 清除所有内容相关缓存
   */
  const clearAllContentCache = useCallback((): void => {
    const patterns = [
      'api_cache_feeds_',
      'api_cache_recent_posts_',
      'api_cache_timeline_feeds',
      'api_cache_feed_',
      'api_cache_hashtag_feeds_',
      'api_cache_adjacent_feeds_',
      'api_cache_search_',
      'api_cache_tags_',
      'api_cache_comments_',
    ];
    
    let totalCleared = 0;
    patterns.forEach(pattern => {
      const cleared = cacheManager.clearByPattern(pattern, 'session', true);
      totalCleared += cleared;
    });
    
    console.log(`🧹 [CLIENT VERSION] 清除缓存: ${totalCleared} 个项目`);
  }, []);
  
  /**
   * 启动定期版本检查
   */
  const startVersionCheck = useCallback((interval: number = 60000): void => {
    // 清除现有定时器
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
    }
    
    // 立即检查一次
    checkVersion();
    
    // 设置定期检查
    checkIntervalRef.current = setInterval(checkVersion, interval);
    
    console.log(`🔄 [CLIENT VERSION] 启动版本检查，间隔: ${interval}ms`);
  }, [checkVersion]);
  
  /**
   * 停止版本检查
   */
  const stopVersionCheck = useCallback((): void => {
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
      console.log(`🔄 [CLIENT VERSION] 停止版本检查`);
    }
  }, []);
  
  /**
   * 手动触发版本检查和缓存刷新
   */
  const forceRefresh = useCallback(async (): Promise<boolean> => {
    console.log(`🔄 [CLIENT VERSION] 手动刷新缓存`);
    return await checkVersion();
  }, [checkVersion]);
  
  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      stopVersionCheck();
    };
  }, [stopVersionCheck]);
  
  // 初始化当前版本
  useEffect(() => {
    currentVersionRef.current = getCurrentVersion();
  }, [getCurrentVersion]);
  
  return {
    getCurrentVersion,
    setCurrentVersion,
    checkVersion,
    startVersionCheck,
    stopVersionCheck,
    forceRefresh,
    clearAllContentCache
  };
}

/**
 * 自动版本检查Hook
 * 
 * 在组件挂载时自动启动版本检查
 */
export function useAutoVersionCheck(interval: number = 60000, enabled: boolean = true) {
  const { startVersionCheck, stopVersionCheck } = useCacheVersion();
  
  useEffect(() => {
    if (enabled) {
      startVersionCheck(interval);
    } else {
      stopVersionCheck();
    }
    
    return () => {
      stopVersionCheck();
    };
  }, [enabled, interval, startVersionCheck, stopVersionCheck]);
}
