/**
 * 统一的缓存时间常量
 * 
 * 根据数据特性分类，提供标准化的缓存时间配置
 * 便于维护和调整缓存策略
 */

/**
 * 缓存时间分类标准：
 * 
 * SHORT_CACHE (5分钟) - 列表数据、搜索结果
 * - 文件列表、搜索结果等需要相对及时更新的数据
 * 
 * MEDIUM_CACHE (15分钟) - 内容数据、统计数据  
 * - 文章列表、标签列表、访问统计等中等频率更新的数据
 * 
 * LONG_CACHE (30分钟) - 配置数据、稳定内容
 * - 单篇文章内容、网站配置、用户偏好等相对稳定的数据
 */

// 基础缓存时间常量（毫秒）
export const CACHE_TIMES = {
  /** 短期缓存：5分钟 - 用于列表数据、搜索结果 */
  SHORT: 5 * 60 * 1000,
  
  /** 中期缓存：15分钟 - 用于内容数据、统计数据 */
  MEDIUM: 15 * 60 * 1000,
  
  /** 长期缓存：30分钟 - 用于配置数据、稳定内容 */
  LONG: 30 * 60 * 1000,
  
  /** 实时缓存：2分钟 - 用于状态数据（预留） */
  REALTIME: 2 * 60 * 1000
} as const;

// 向后兼容的别名
export const SHORT_CACHE = CACHE_TIMES.SHORT;
export const MEDIUM_CACHE = CACHE_TIMES.MEDIUM;
export const LONG_CACHE = CACHE_TIMES.LONG;
export const REALTIME_CACHE = CACHE_TIMES.REALTIME;

/**
 * 特定数据类型的缓存配置
 */
export const CACHE_CONFIG = {
  // API数据缓存
  API: {
    /** 默认API缓存时间（15分钟） */
    DEFAULT_STALE_TIME: MEDIUM_CACHE,
    /** 默认缓存保持时间（60分钟） */
    DEFAULT_CACHE_TIME: LONG_CACHE * 2, // 60分钟
  },
  
  // 文章相关缓存
  FEEDS: {
    /** 文章列表缓存 - 从15分钟缩短为5分钟，平衡性能和多用户数据一致性 */
    LIST: SHORT_CACHE,
    /** 单篇文章缓存 */
    SINGLE: LONG_CACHE,
    /** 搜索结果缓存 */
    SEARCH: SHORT_CACHE,
  },
  
  // 标签和分类缓存
  TAGS: {
    /** 标签列表缓存 */
    LIST: MEDIUM_CACHE,
    /** 标签文章列表缓存 */
    FEEDS: MEDIUM_CACHE,
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
    LIST: MEDIUM_CACHE, // 15分钟，评论更新频率中等
  },

  // 友情链接缓存
  FRIENDS: {
    /** 友情链接列表缓存 */
    LIST: MEDIUM_CACHE, // 15分钟，友情链接更新频率低
  },

  // 时间线缓存
  TIMELINE: {
    /** 时间线数据缓存 */
    LIST: MEDIUM_CACHE, // 15分钟，时间线更新频率中等
  }
} as const;

/**
 * 后端缓存配置
 */
export const BACKEND_CACHE_CONFIG = {
  /** 批量保存延迟时间（毫秒） */
  BATCH_SAVE_DELAY: 500, // 从1500ms优化到500ms，提高数据安全性
  
  /** 序列化阈值 */
  SERIALIZATION_THRESHOLD: 50,
  
  /** 批处理大小 */
  BATCH_SIZE: 20,
} as const;

/**
 * 统一的缓存键命名规范
 *
 * 格式标准：
 * - 使用下划线分隔不同部分
 * - 参数值使用冒号分隔键值对
 * - 特殊字符使用encodeURIComponent编码
 * - 保持键名简洁且具有描述性
 */
export const CACHE_KEY_PATTERNS = {
  /** API缓存键前缀 */
  API_PREFIX: 'api_cache_',

  /** 单篇文章缓存键格式：feed_id:value */
  FEED: (id: string | number) => `feed_id:${id}`,

  /** 文章列表缓存键格式：feeds_type:value_page:value_limit:value_sort:value */
  FEEDS: (type: string, page: number, limit: number, sort: string) =>
    `feeds_type:${type}_page:${page}_limit:${limit}_sort:${sort}`,

  /** 搜索结果缓存键格式：search_keyword:value_page:value_limit:value */
  SEARCH: (keyword: string, page: number, limit: number) =>
    `search_keyword:${encodeURIComponent(keyword)}_page:${page}_limit:${limit}`,

  /** 标签相关缓存键格式：tags_action:value_param:value */
  TAGS: {
    LIST: () => 'tags_list',
    FEEDS: (tagName: string) => `tags_feeds_tag:${encodeURIComponent(tagName)}`,
  },

  /** 文件管理缓存键格式：files_path:value_search:value_sort:value_order:value_page:value_limit:value */
  FILES: (path: string, search: string, sortBy: string, sortOrder: string, page: number, limit: number) =>
    `files_path:${encodeURIComponent(path)}_search:${encodeURIComponent(search)}_sort:${sortBy}_order:${sortOrder}_page:${page}_limit:${limit}`,

  /** 评论缓存键格式：comments_feed:value */
  COMMENTS: (feedId: string) => `comments_feed:${feedId}`,

  /** 配置缓存键格式：config_type:value */
  CONFIG: (type: string) => `config_type:${type}`,

  /** 时间线缓存键格式 */
  TIMELINE: () => 'timeline_feeds',

  /** 最近文章缓存键格式：recent_posts_limit:value */
  RECENT_POSTS: (limit: number) => `recent_posts_limit:${limit}`,

  /** 相邻文章缓存键格式：adjacent_feeds_id:value */
  ADJACENT_FEEDS: (id: string) => `adjacent_feeds_id:${id}`,

  /** 友情链接缓存键格式 */
  FRIENDS: () => 'friends_list',
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
