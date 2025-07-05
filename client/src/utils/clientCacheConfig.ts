/**
 * 客户端特定的缓存配置
 * 
 * 包含客户端独有的缓存配置，如缓存键命名规范、批量保存配置等
 * 
 * @version 2.0.0 - 精简重构版本
 */

import { UNIFIED_CACHE_CONFIG, CACHE_TIMES } from '../../../shared/cacheConstants';

// 重新导出共享配置，保持向后兼容
export { CACHE_TIMES, CacheUtils, getRecommendedCacheTime } from '../../../shared/cacheConstants';
export const CACHE_CONFIG = UNIFIED_CACHE_CONFIG;

// 向后兼容的别名
export const SHORT_CACHE = CACHE_TIMES.SHORT;
export const MEDIUM_CACHE = CACHE_TIMES.MEDIUM;
export const LONG_CACHE = CACHE_TIMES.LONG;
export const REALTIME_CACHE = CACHE_TIMES.REALTIME;

/**
 * 客户端后端缓存配置
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
