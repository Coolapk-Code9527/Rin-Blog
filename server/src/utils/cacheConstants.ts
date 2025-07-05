/**
 * 服务端缓存时间常量 - 简化版本
 *
 * 重构后的简化配置，移除了过度复杂的缓存策略
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
 * 服务端特定数据类型的缓存配置 - 简化版本
 */
export const SERVER_CACHE_CONFIG = {
  // 统计数据缓存
  STATS: {
    /** 网站统计缓存 */
    WEBSITE: MEDIUM_CACHE, // 10分钟
    /** 访问统计缓存 */
    VISITS: MEDIUM_CACHE, // 10分钟
  },

  // 文章相关缓存
  FEEDS: {
    /** 文章列表缓存 - 1分钟，确保及时更新 */
    LIST: REALTIME_CACHE, // 1分钟
    /** 单篇文章缓存 */
    SINGLE: MEDIUM_CACHE, // 10分钟
    /** 搜索结果缓存 */
    SEARCH: SHORT_CACHE, // 2分钟
  },

  // 标签和分类缓存
  TAGS: {
    /** 标签列表缓存 */
    LIST: MEDIUM_CACHE, // 10分钟
    /** 标签文章列表缓存 */
    FEEDS: SHORT_CACHE, // 2分钟
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
    LIST: MEDIUM_CACHE, // 10分钟
  },

  // 友情链接缓存
  FRIENDS: {
    /** 友情链接列表缓存 */
    LIST: MEDIUM_CACHE, // 10分钟
  },

  // 文件管理缓存
  FILES: {
    /** 文件列表缓存 */
    LIST: SHORT_CACHE, // 2分钟
    /** 文件详情缓存 */
    DETAIL: MEDIUM_CACHE, // 10分钟
  }
} as const;