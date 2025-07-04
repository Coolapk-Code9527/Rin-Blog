/**
 * 缓存同步管理器
 * 
 * 解决多用户缓存不同步问题：
 * - 定期检查服务端缓存版本
 * - 当检测到服务端数据更新时，清理本地缓存
 * - 确保所有用户看到一致的数据
 */

// 延迟导入client，避免循环依赖
import { cacheManager } from './SimpleCacheManager';

class CacheSyncManager {
  private lastCheckTime = 0;
  private lastServerVersion = 0;
  private checkInterval = 30000; // 30秒检查一次
  private isChecking = false;

  /**
   * 开始缓存同步检查
   */
  start() {
    // 立即检查一次
    this.checkCacheVersion();
    
    // 定期检查
    setInterval(() => {
      this.checkCacheVersion();
    }, this.checkInterval);
  }

  /**
   * 检查服务端缓存版本
   */
  private async checkCacheVersion() {
    if (this.isChecking) return;

    try {
      this.isChecking = true;
      const now = Date.now();

      // 避免频繁检查
      if (now - this.lastCheckTime < this.checkInterval) {
        return;
      }

      this.lastCheckTime = now;

      // 动态导入client，避免循环依赖
      const { client } = await import('../main');

      // 调用服务端API检查缓存版本
      const response = await client.feed['cache-version'].get();
      
      if (response.data && typeof response.data === 'object' && 'version' in response.data) {
        const serverVersion = response.data.version as number;
        
        // 如果服务端版本更新，清理本地缓存
        if (this.lastServerVersion > 0 && serverVersion > this.lastServerVersion) {
          console.log('🔄 检测到服务端数据更新，清理本地缓存');
          this.clearAllCaches();
          
          // 触发全局缓存更新事件
          window.dispatchEvent(new CustomEvent('cache-sync-updated'));
        }
        
        this.lastServerVersion = serverVersion;
      }
    } catch (error) {
      // 静默处理错误，避免影响用户体验
      console.warn('缓存版本检查失败:', error);
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * 清理所有相关缓存
   */
  private clearAllCaches() {
    try {
      // 清理文章相关缓存
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

      patterns.forEach(pattern => {
        cacheManager.clearByPattern(pattern, 'session', true);
      });
      
      console.log('✅ 本地缓存已清理');
    } catch (error) {
      console.warn('缓存清理失败:', error);
    }
  }

  /**
   * 手动触发缓存检查
   */
  forceCheck() {
    this.lastCheckTime = 0; // 重置检查时间
    this.checkCacheVersion();
  }
}

// 创建全局实例
export const cacheSyncManager = new CacheSyncManager();

// 自动启动缓存同步
if (typeof window !== 'undefined') {
  // 页面加载后启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      cacheSyncManager.start();
    });
  } else {
    cacheSyncManager.start();
  }
}
