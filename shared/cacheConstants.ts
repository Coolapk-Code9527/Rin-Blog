/**
 * 统一的缓存配置 - 共享基础配置
 * 
 * 这个文件包含客户端和服务端共享的缓存配置，
 * 消除重复代码，遵循DRY原则。
 * 
 * @version 2.0.0 - 精简重构版本
 */

/**
 * 缓存时间分类标准：
 * 
 * REALTIME (1分钟) - 关键资源的快速验证
 * SHORT (2分钟) - 列表数据、搜索结果
 * MEDIUM (10分钟) - 内容数据、统计数据  
 * LONG (30分钟) - 配置数据、稳定内容
 */

// 基础缓存时间常量（毫秒）
export const CACHE_TIMES = {
  /** 实时缓存：1分钟 - 用于关键资源的快速验证 */
  REALTIME: 1 * 60 * 1000,
  
  /** 短期缓存：2分钟 - 用于列表数据、搜索结果 */
  SHORT: 2 * 60 * 1000,
  
  /** 中期缓存：10分钟 - 用于内容数据、统计数据 */
  MEDIUM: 10 * 60 * 1000,
  
  /** 长期缓存：30分钟 - 用于配置数据、稳定内容 */
  LONG: 30 * 60 * 1000
} as const;

// 向后兼容的别名
export const SHORT_CACHE = CACHE_TIMES.SHORT;
export const MEDIUM_CACHE = CACHE_TIMES.MEDIUM;
export const LONG_CACHE = CACHE_TIMES.LONG;
export const REALTIME_CACHE = CACHE_TIMES.REALTIME;

/**
 * 统一的缓存配置 - 适用于客户端和服务端
 */
export const UNIFIED_CACHE_CONFIG = {
  // API数据缓存
  API: {
    /** 默认API缓存时间（10分钟） */
    DEFAULT_STALE_TIME: MEDIUM_CACHE,
    /** 默认缓存保持时间（60分钟） */
    DEFAULT_CACHE_TIME: LONG_CACHE * 2, // 60分钟
  },
  
  // 文章相关缓存
  FEEDS: {
    /** 文章列表缓存 - 1分钟，优化多用户数据一致性 */
    LIST: REALTIME_CACHE,
    /** 单篇文章缓存 - 10分钟，优化文章更新后的数据一致性 */
    SINGLE: MEDIUM_CACHE,
    /** 搜索结果缓存 */
    SEARCH: SHORT_CACHE,
  },
  
  // 标签和分类缓存
  TAGS: {
    /** 标签列表缓存 */
    LIST: MEDIUM_CACHE,
    /** 标签文章列表缓存 */
    FEEDS: SHORT_CACHE, // 2分钟，提高数据一致性
  },
  
  // 文件管理缓存
  FILES: {
    /** 文件列表缓存 */
    LIST: SHORT_CACHE,
    /** 文件详情缓存 */
    DETAIL: MEDIUM_CACHE,
  },
  
  // 统计数据缓存
  STATS: {
    /** 网站统计缓存 */
    WEBSITE: MEDIUM_CACHE,
    /** 访问统计缓存 */
    VISITS: MEDIUM_CACHE,
  },
  
  // 配置数据缓存
  CONFIG: {
    /** 客户端配置缓存 */
    CLIENT: LONG_CACHE,
    /** 服务端配置缓存 */
    SERVER: LONG_CACHE,
  },

  // 评论数据缓存
  COMMENTS: {
    /** 评论列表缓存 */
    LIST: MEDIUM_CACHE, // 10分钟，评论更新频率中等
  },

  // 友情链接缓存
  FRIENDS: {
    /** 友情链接列表缓存 */
    LIST: MEDIUM_CACHE, // 10分钟，友情链接更新频率低
  },

  // 时间线缓存
  TIMELINE: {
    /** 时间线数据缓存 */
    LIST: SHORT_CACHE, // 2分钟，提高数据一致性
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
  dataType: keyof typeof UNIFIED_CACHE_CONFIG,
  subType?: string
): number {
  const config = UNIFIED_CACHE_CONFIG[dataType];
  
  if (typeof config === 'number') {
    return config;
  }
  
  if (subType && typeof config === 'object' && subType in config) {
    return (config as any)[subType];
  }
  
  // 默认返回中期缓存时间
  return MEDIUM_CACHE;
}

// 导出类型定义
export type CacheConfigType = typeof UNIFIED_CACHE_CONFIG;
export type CacheDataType = keyof CacheConfigType;
