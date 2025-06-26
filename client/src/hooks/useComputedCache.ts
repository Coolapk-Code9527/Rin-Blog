import { useMemo, useCallback } from 'react';
import { globalCache, createCache, memoize } from '../utils/memoryCache';

/**
 * 计算结果缓存Hook
 * 
 * 基于内存缓存系统，为计算密集型操作提供缓存支持
 */

/**
 * 缓存计算结果的Hook
 * 
 * @param computeFn 计算函数
 * @param deps 依赖项数组
 * @param cacheKey 缓存键
 * @param ttl 缓存时间（毫秒）
 * @returns 计算结果
 */
export function useComputedCache<T>(
  computeFn: () => T,
  deps: React.DependencyList,
  cacheKey: string,
  ttl: number = 5 * 60 * 1000 // 默认5分钟
): T {
  return useMemo(() => {
    // 生成包含依赖项的缓存键
    const fullKey = `${cacheKey}_${JSON.stringify(deps)}`;
    
    // 尝试从缓存获取
    const cached = globalCache.get(fullKey);
    if (cached !== null) {
      return cached;
    }

    // 计算新值并缓存
    const result = computeFn();
    globalCache.set(fullKey, result, ttl);
    
    return result;
  }, deps);
}

/**
 * 缓存异步计算结果的Hook
 * 
 * @param computeFn 异步计算函数
 * @param deps 依赖项数组
 * @param cacheKey 缓存键
 * @param ttl 缓存时间（毫秒）
 * @returns Promise<计算结果>
 */
export function useAsyncComputedCache<T>(
  computeFn: () => Promise<T>,
  deps: React.DependencyList,
  cacheKey: string,
  ttl: number = 5 * 60 * 1000
): () => Promise<T> {
  return useCallback(async () => {
    const fullKey = `${cacheKey}_${JSON.stringify(deps)}`;
    
    return globalCache.getOrSet(fullKey, computeFn, ttl);
  }, deps);
}

/**
 * 预定义的计算缓存函数
 */

// 简化的计算缓存实例
const computeCache = createCache({
  maxSize: 100, // 大幅减少
  defaultTTL: 5 * 60 * 1000, // 5分钟
  cleanupInterval: 10 * 60 * 1000 // 10分钟清理一次，减少频率
});

/**
 * 缓存Markdown渲染结果
 */
export const cachedMarkdownRender = memoize(
  (content: string, options?: any) => {
    // 这里应该是实际的Markdown渲染逻辑
    // 为了示例，我们返回一个简化的结果
    return {
      html: content, // 实际应该是渲染后的HTML
      toc: [], // 目录
      metadata: options
    };
  },
  {
    ttl: 15 * 60 * 1000, // 15分钟
    keyGenerator: (content, options) => `markdown_${content.length}_${JSON.stringify(options)}`
  }
);

/**
 * 缓存文本摘要生成
 */
export const cachedTextSummary = memoize(
  (text: string, maxLength: number = 150) => {
    if (text.length <= maxLength) {
      return text;
    }

    // 简单的摘要生成逻辑
    let summary = text.substring(0, maxLength);
    const lastSpace = summary.lastIndexOf(' ');
    
    if (lastSpace > maxLength * 0.8) {
      summary = summary.substring(0, lastSpace);
    }
    
    return summary + '...';
  },
  {
    ttl: 30 * 60 * 1000, // 30分钟
    keyGenerator: (text, maxLength) => `summary_${text.length}_${maxLength}`
  }
);

/**
 * 缓存日期格式化
 */
export const cachedDateFormat = memoize(
  (date: Date | string | number, format: string = 'relative') => {
    const dateObj = new Date(date);
    
    if (format === 'relative') {
      const now = new Date();
      const diff = now.getTime() - dateObj.getTime();
      
      const minutes = Math.floor(diff / (1000 * 60));
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      
      if (minutes < 1) return '刚刚';
      if (minutes < 60) return `${minutes}分钟前`;
      if (hours < 24) return `${hours}小时前`;
      if (days < 7) return `${days}天前`;
      
      return dateObj.toLocaleDateString();
    }
    
    if (format === 'full') {
      return dateObj.toLocaleString();
    }
    
    return dateObj.toLocaleDateString();
  },
  {
    ttl: 60 * 1000, // 1分钟（相对时间需要频繁更新）
    keyGenerator: (date, format) => `date_${new Date(date).getTime()}_${format}`
  }
);

/**
 * 缓存颜色生成
 */
export const cachedColorGeneration = memoize(
  (seed: string, type: 'gradient' | 'solid' = 'gradient') => {
    // 基于种子生成一致的颜色
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const hue = Math.abs(hash) % 360;
    const saturation = 60 + (Math.abs(hash) % 40); // 60-100%
    const lightness = 45 + (Math.abs(hash) % 20); // 45-65%
    
    if (type === 'solid') {
      return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }
    
    // 生成渐变色
    const hue2 = (hue + 30) % 360;
    return `linear-gradient(135deg, hsl(${hue}, ${saturation}%, ${lightness}%), hsl(${hue2}, ${saturation}%, ${lightness + 10}%))`;
  },
  {
    ttl: 60 * 60 * 1000, // 1小时
    keyGenerator: (seed, type) => `color_${seed}_${type}`
  }
);

/**
 * 缓存搜索结果高亮
 */
export const cachedSearchHighlight = memoize(
  (text: string, searchTerm: string) => {
    if (!searchTerm.trim()) {
      return text;
    }

    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  },
  {
    ttl: 10 * 60 * 1000, // 10分钟
    keyGenerator: (text, searchTerm) => `highlight_${text.length}_${searchTerm}`
  }
);

/**
 * 缓存文件大小格式化
 */
export const cachedFileSizeFormat = memoize(
  (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },
  {
    ttl: 60 * 60 * 1000, // 1小时
    keyGenerator: (bytes) => `filesize_${bytes}`
  }
);

/**
 * 缓存URL验证
 */
export const cachedUrlValidation = memoize(
  (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },
  {
    ttl: 30 * 60 * 1000, // 30分钟
    keyGenerator: (url) => `url_valid_${url}`
  }
);

/**
 * 缓存统计信息
 */
export function getCacheStats() {
  return {
    global: globalCache.getStats(),
    compute: computeCache.getStats()
  };
}

/**
 * 清理所有计算缓存
 */
export function clearComputeCache() {
  globalCache.clear();
  computeCache.clear();
  console.log('All compute caches cleared');
}

/**
 * 预热常用缓存
 */
export function warmupCache() {
  // 预热一些常用的计算结果
  const commonDates = [
    new Date(),
    new Date(Date.now() - 24 * 60 * 60 * 1000), // 昨天
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 一周前
  ];

  commonDates.forEach(date => {
    cachedDateFormat(date, 'relative');
    cachedDateFormat(date, 'full');
  });

  // 预热常用文件大小
  const commonSizes = [0, 1024, 1024 * 1024, 1024 * 1024 * 1024];
  commonSizes.forEach(size => {
    cachedFileSizeFormat(size);
  });

  console.log('Cache warmed up with common values');
}

/**
 * 在应用启动时调用
 */
export function initializeComputeCache() {
  // 清理过期缓存
  globalCache.cleanup();
  computeCache.cleanup();
  
  // 预热缓存
  warmupCache();
  
  console.log('Compute cache initialized');
}
