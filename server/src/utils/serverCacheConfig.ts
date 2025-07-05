/**
 * 服务端特定的缓存配置
 * 
 * 包含服务端独有的缓存配置和工具函数
 * 
 * @version 2.0.0 - 精简重构版本
 */

import { UNIFIED_CACHE_CONFIG, CACHE_TIMES, CacheUtils, getRecommendedCacheTime } from '../../../shared/cacheConstants';

// 重新导出共享配置，保持向后兼容
export { CACHE_TIMES, CacheUtils, getRecommendedCacheTime } from '../../../shared/cacheConstants';
export const SERVER_CACHE_CONFIG = UNIFIED_CACHE_CONFIG;

// 向后兼容的别名
export const SHORT_CACHE = CACHE_TIMES.SHORT;
export const MEDIUM_CACHE = CACHE_TIMES.MEDIUM;
export const LONG_CACHE = CACHE_TIMES.LONG;
export const REALTIME_CACHE = CACHE_TIMES.REALTIME;
