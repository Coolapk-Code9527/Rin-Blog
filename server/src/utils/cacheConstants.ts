/**
 * 服务端缓存时间常量
 * 
 * 与客户端保持一致的缓存配置，遵循DRY原则
 * 对应客户端文件：client/src/utils/cacheConstants.ts
 */

/**
 * 缓存时间分类标准：
 * 
 * SHORT_CACHE (5分钟) - 列表数据、搜索结果
 * MEDIUM_CACHE (15分钟) - 内容数据、统计数据  
 * LONG_CACHE (30分钟) - 配置数据、稳定内容
 */

// 基础缓存时间常量（毫秒）
export const CACHE_TIMES = {
  /** 短期缓存：5分钟 - 用于列表数据、搜索结果 */
  SHORT: 5 * 60 * 1000,
  
  /** 中期缓存：15分钟 - 用于内容数据、统计数据 */
  MEDIUM: 15 * 60 * 1000,
  
  /** 长期缓存：30分钟 - 用于配置数据、稳定内容 */
  LONG: 30 * 60 * 1000,
  
  /** 实时缓存：2分钟 - 用于状态数据 */
  REALTIME: 2 * 60 * 1000
} as const;

// 向后兼容的别名
export const SHORT_CACHE = CACHE_TIMES.SHORT;
export const MEDIUM_CACHE = CACHE_TIMES.MEDIUM;
export const LONG_CACHE = CACHE_TIMES.LONG;
export const REALTIME_CACHE = CACHE_TIMES.REALTIME;

/**
 * 服务端特定数据类型的缓存配置
 */
export const SERVER_CACHE_CONFIG = {
  // 统计数据缓存
  STATS: {
    /** 网站统计缓存 - 与客户端CACHE_CONFIG.STATS.WEBSITE保持一致 */
    WEBSITE: MEDIUM_CACHE, // 15分钟
    /** 访问统计缓存 */
    VISITS: MEDIUM_CACHE, // 15分钟
  },
  
  // 文章相关缓存
  FEEDS: {
    /** 文章列表缓存 */
    LIST: MEDIUM_CACHE, // 15分钟
    /** 单篇文章缓存 */
    SINGLE: LONG_CACHE, // 30分钟
    /** 搜索结果缓存 */
    SEARCH: SHORT_CACHE, // 5分钟
  },
  
  // 标签和分类缓存
  TAGS: {
    /** 标签列表缓存 */
    LIST: MEDIUM_CACHE, // 15分钟
    /** 标签文章列表缓存 */
    FEEDS: MEDIUM_CACHE, // 15分钟
  },
  
  // 配置数据缓存
  CONFIG: {
    /** 客户端配置缓存 */
    CLIENT: LONG_CACHE, // 30分钟
    /** 服务端配置缓存 */
    SERVER: LONG_CACHE, // 30分钟
  },

  // 评论数据缓存
  COMMENTS: {
    /** 评论列表缓存 */
    LIST: MEDIUM_CACHE, // 15分钟
  },

  // 友情链接缓存
  FRIENDS: {
    /** 友情链接列表缓存 */
    LIST: MEDIUM_CACHE, // 15分钟
  },

  // 文件管理缓存
  FILES: {
    /** 文件列表缓存 */
    LIST: SHORT_CACHE, // 5分钟
    /** 文件详情缓存 */
    DETAIL: MEDIUM_CACHE, // 15分钟
  }
} as const;

/**
 * 缓存时间工具函数
 */
export const CacheUtils = {
  /**
   * 将分钟转换为毫秒
   */
  minutes: (minutes: number) => minutes * 60 * 1000,
  
  /**
   * 将小时转换为毫秒
   */
  hours: (hours: number) => hours * 60 * 60 * 1000,
  
  /**
   * 检查缓存是否过期
   */
  isExpired: (timestamp: number, maxAge: number) => {
    return Date.now() - timestamp > maxAge;
  },
  
  /**
   * 格式化缓存时间为可读字符串
   */
  formatDuration: (milliseconds: number) => {
    const minutes = Math.floor(milliseconds / (60 * 1000));
    if (minutes < 60) {
      return `${minutes}分钟`;
    }
    const hours = Math.floor(minutes / 60);
    return `${hours}小时${minutes % 60}分钟`;
  }
} as const;

/**
 * 获取推荐的缓存配置
 *
 * @param dataType 数据类型
 * @param subType 子类型（可选）
 * @returns 缓存时间（毫秒）
 */
export function getRecommendedCacheTime(
  dataType: keyof typeof SERVER_CACHE_CONFIG,
  subType?: string
): number {
  const config = SERVER_CACHE_CONFIG[dataType];
  
  if (typeof config === 'number') {
    return config;
  }
  
  if (subType && typeof config === 'object' && subType in config) {
    return (config as any)[subType];
  }
  
  // 默认返回中期缓存时间
  return MEDIUM_CACHE;
}
