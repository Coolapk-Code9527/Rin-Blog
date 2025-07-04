/**
 * 智能缓存同步管理器
 * 
 * 基于Context7最佳实践：
 * - 避免定期检查：不使用setInterval等定期轮询
 * - 事件驱动：基于用户操作和页面可见性变化
 * - 设置冷却期：避免短时间内重复检查
 * - 优雅降级：网络错误时继续使用缓存
 * - 批量处理：合并多个版本检查请求
 */

import { cacheManager } from './SimpleCacheManager';

class SmartCacheSync {
  private lastCheckTime = 0;
  private cooldownPeriod = 30000; // 30秒冷却期
  private isChecking = false;
  private pendingCheck: Promise<void> | null = null;
  private lastServerVersion = 0;

  constructor() {
    this.setupEventListeners();
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners() {
    // 页面可见性变化时检查
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.triggerCheck('visibility_change');
      }
    });

    // 窗口获得焦点时检查
    window.addEventListener('focus', () => {
      this.triggerCheck('window_focus');
    });

    // 用户交互时检查（节流）
    this.setupUserInteractionListeners();
  }

  /**
   * 设置用户交互监听器
   */
  private setupUserInteractionListeners() {
    let interactionTimer: NodeJS.Timeout | null = null;

    const handleUserInteraction = () => {
      if (interactionTimer) return;
      
      interactionTimer = setTimeout(() => {
        this.triggerCheck('user_interaction');
        interactionTimer = null;
      }, 5000); // 5秒内的交互只触发一次检查
    };

    // 监听关键用户交互
    ['click', 'scroll', 'keydown'].forEach(event => {
      document.addEventListener(event, handleUserInteraction, { passive: true });
    });
  }

  /**
   * 触发缓存检查
   */
  private async triggerCheck(trigger: string) {
    const now = Date.now();
    
    // 冷却期检查
    if (now - this.lastCheckTime < this.cooldownPeriod) {
      return;
    }

    // 批量处理：如果已有检查在进行，等待其完成
    if (this.pendingCheck) {
      return this.pendingCheck;
    }

    this.pendingCheck = this.performCheck(trigger);
    
    try {
      await this.pendingCheck;
    } finally {
      this.pendingCheck = null;
    }
  }

  /**
   * 执行缓存检查
   */
  private async performCheck(trigger: string) {
    if (this.isChecking) return;

    try {
      this.isChecking = true;
      this.lastCheckTime = Date.now();

      console.log(`🔄 Smart cache check triggered by: ${trigger}`);

      // 动态导入client，避免循环依赖
      const { client } = await import('../main');
      
      // 检查服务端数据版本
      const response = await client.feed.index.get({
        query: {
          type: 'normal',
          page: 1,
          limit: 1
        }
      });

      if (response.data && response.data.data && Array.isArray(response.data.data) && response.data.data.length > 0) {
        // 使用第一篇文章的更新时间作为版本号
        const latestUpdateTime = new Date(response.data.data[0].createdAt || response.data.data[0].updatedAt).getTime();
        
        // 如果服务端版本更新，清理本地缓存
        if (this.lastServerVersion > 0 && latestUpdateTime > this.lastServerVersion) {
          console.log('🔄 检测到服务端数据更新，清理本地缓存');
          this.clearAllCaches();
          
          // 触发全局缓存更新事件
          window.dispatchEvent(new CustomEvent('smart-cache-updated', {
            detail: { trigger, oldVersion: this.lastServerVersion, newVersion: latestUpdateTime }
          }));
        }
        
        this.lastServerVersion = latestUpdateTime;
      }
    } catch (error) {
      // 优雅降级：网络错误时继续使用缓存
      console.warn('Smart cache check failed, continuing with cached data:', error);
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
   * 手动触发缓存检查（用于关键操作后）
   */
  forceCheck() {
    this.lastCheckTime = 0; // 重置冷却期
    this.triggerCheck('manual_force');
  }

  /**
   * 设置冷却期
   */
  setCooldownPeriod(ms: number) {
    this.cooldownPeriod = ms;
  }
}

// 创建全局实例
export const smartCacheSync = new SmartCacheSync();

// 自动启动智能缓存同步
if (typeof window !== 'undefined') {
  // 页面加载后启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('🚀 Smart cache sync initialized');
    });
  } else {
    console.log('🚀 Smart cache sync initialized');
  }
}
