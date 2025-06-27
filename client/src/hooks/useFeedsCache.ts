import { useMemo } from 'react';
import { useApiCache } from './useApiCache';
import { client } from '../main';
import { headersWithAuth } from '../utils/auth';

/**
 * 文章类型枚举
 */
export type FeedType = 'all' | 'public' | 'private';

/**
 * 文章数据结构
 */
export interface FeedsData {
  data: any[];
  size: number;
  page?: number;
  limit?: number;
  hasNext?: boolean;
}

/**
 * useFeedsCache配置
 */
interface UseFeedsCacheConfig {
  /** 文章类型 */
  type?: FeedType;
  /** 页码 */
  page?: number;
  /** 每页数量 */
  limit?: number;
  /** 是否按时间排序 */
  sortByTime?: boolean;
  /** 缓存时间（毫秒），默认5分钟 */
  staleTime?: number;
  /** 是否启用缓存 */
  enabled?: boolean;
}

/**
 * 带缓存的文章列表Hook
 * 
 * 基于useApiCache实现的文章数据获取，支持：
 * - 5分钟缓存时间
 * - 后台自动更新
 * - 类型安全的数据获取
 * - 智能缓存键生成
 * 
 * @param config 配置选项
 * @returns 文章数据、状态和控制方法
 */
export function useFeedsCache(config: UseFeedsCacheConfig = {}) {
  const {
    type = 'all',
    page = 1,
    limit = 9999, // 获取所有数据，参考现有实现
    sortByTime = false,
    staleTime = 5 * 60 * 1000, // 5分钟缓存
    enabled = true
  } = config;

  // 生成唯一的缓存键 - 改进版本，避免冲突
  const cacheKey = useMemo(() => {
    // 使用固定顺序的键值对，确保一致性
    const keyParts = [
      `type:${type}`,
      `page:${page}`,
      `limit:${limit}`,
      `sort:${sortByTime ? 'time' : 'default'}`
    ];
    return `feeds_${keyParts.join('_')}`;
  }, [type, page, limit, sortByTime]);

  // 数据获取函数
  const fetcher = useMemo(() => async (): Promise<FeedsData> => {
    const response = await client.feed.index.get({
      query: {
        page,
        limit,
        type,
        ...(sortByTime && { sortByTime: true })
      },
      headers: headersWithAuth()
    });

    if (response.error) {
      throw new Error(response.error.value as string);
    }

    if (!response.data || typeof response.data === 'string') {
      throw new Error('Invalid response data');
    }

    // 确保返回的数据符合FeedsData接口，添加基本验证
    const apiData = response.data as any;

    // 基本数据验证
    if (!apiData || typeof apiData !== 'object') {
      throw new Error('Invalid API response format');
    }

    return {
      data: Array.isArray(apiData.data) ? apiData.data : [],
      size: typeof apiData.size === 'number' ? apiData.size : 0,
      page: typeof apiData.page === 'number' ? apiData.page : page,
      limit: typeof apiData.limit === 'number' ? apiData.limit : limit,
      hasNext: typeof apiData.hasNext === 'boolean' ? apiData.hasNext : false
    } as FeedsData;
  }, [type, page, limit, sortByTime]);

  // 使用通用API缓存Hook
  const result = useApiCache(cacheKey, fetcher, {
    staleTime,
    enabled,
    refetchOnWindowFocus: true,
    retryCount: 3
  });

  return {
    ...result,
    // 提供便捷的数据访问
    feeds: result.data?.data || [],
    totalSize: result.data?.size || 0,
    currentPage: result.data?.page || page,
    pageLimit: result.data?.limit || limit
  };
}

/**
 * 最近文章缓存Hook
 * 
 * 专门用于获取最近发布的文章，用于侧边栏等组件
 */
export function useRecentPostsCache(limit: number = 3) {
  const cacheKey = `recent_posts_limit:${limit}`;

  const fetcher = useMemo(() => async () => {
    const response = await client.feed.index.get({
      query: { 
        page: 1, 
        limit, 
        sortByTime: true 
      },
      headers: {}
    });

    if (response.error) {
      throw new Error(response.error.value as string);
    }

    if (!response.data || !Array.isArray(response.data.data)) {
      throw new Error('Invalid response data');
    }

    // 转换数据格式，匹配现有组件期望的格式
    return response.data.data.map((item: any) => ({
      id: item.id,
      title: item.title,
      createdAt: new Date(item.createdAt),
      content: item.content || "",
      summary: item.summary || "",
      avatar: item.avatar || "",
      thumbUrl: item.thumbUrl || ""
    }));
  }, [limit]);

  return useApiCache(cacheKey, fetcher, {
    staleTime: 10 * 60 * 1000, // 10分钟缓存
    refetchOnWindowFocus: true
  });
}

/**
 * 时间线数据缓存Hook
 *
 * 专门用于时间线页面的数据获取
 * 修复：使用正确的 /feed/timeline API 端点，并添加调试信息
 */
export function useTimelineCache() {
  const cacheKey = 'timeline_feeds';

  const fetcher = useMemo(() => async () => {
    const response = await client.feed.timeline.get({
      headers: headersWithAuth()
    });

    if (response.error) {
      throw new Error(response.error.value as string);
    }

    if (!response.data) {
      throw new Error('Invalid response data');
    }

    // Timeline API返回的是数组格式，转换为标准格式
    const timelineData = Array.isArray(response.data) ? response.data : [];
    return {
      data: timelineData,
      size: timelineData.length,
      hasNext: false
    };
  }, []);

  return useApiCache(cacheKey, fetcher, {
    staleTime: 5 * 60 * 1000, // 5分钟缓存
    refetchOnWindowFocus: true
  });
}

/**
 * 单个文章缓存Hook
 * 
 * 用于文章详情页的数据获取
 */
export function useFeedCache(id: string, enabled: boolean = true) {
  const cacheKey = `feed_id:${id}`;

  const fetcher = useMemo(() => async () => {
    const response = await client.feed({ id }).get({
      headers: headersWithAuth()
    });

    if (response.error) {
      throw new Error(response.error.value as string);
    }

    if (!response.data || typeof response.data === 'string') {
      throw new Error('Feed not found');
    }

    return response.data;
  }, [id]);

  return useApiCache(cacheKey, fetcher, {
    staleTime: 10 * 60 * 1000, // 10分钟缓存
    enabled: enabled && !!id,
    refetchOnWindowFocus: false // 文章内容不需要频繁刷新
  });
}

/**
 * 标签页面文章缓存Hook
 * 
 * 用于标签页面的文章列表
 */
export function useHashtagFeedsCache(tagName: string, enabled: boolean = true) {
  const cacheKey = `hashtag_feeds_tag:${encodeURIComponent(tagName)}`;

  const fetcher = useMemo(() => async () => {
    const nameDecoded = decodeURI(tagName);
    const response = await client.tag({ name: nameDecoded }).get({
      headers: headersWithAuth()
    });

    if (response.error) {
      throw new Error(response.error.value as string);
    }

    if (!response.data || typeof response.data === 'string') {
      throw new Error('Tag not found');
    }

    return response.data;
  }, [tagName]);

  return useApiCache(cacheKey, fetcher, {
    staleTime: 5 * 60 * 1000, // 5分钟缓存
    enabled: enabled && !!tagName,
    refetchOnWindowFocus: true
  });
}

/**
 * 缓存管理工具
 */
export const FeedsCacheManager = {
  /**
   * 清除所有文章相关缓存
   */
  clearAllFeeds: () => {
    const keys = ['feeds_', 'recent_posts_', 'timeline_feeds', 'feed_', 'hashtag_feeds_'];
    keys.forEach(prefix => {
      const storageKeys = Object.keys(sessionStorage);
      storageKeys.forEach(key => {
        if (key.startsWith(`api_cache_${prefix}`)) {
          sessionStorage.removeItem(key);
        }
      });
    });
  },

  /**
   * 清除特定类型的文章缓存
   */
  clearFeedsByType: (type: FeedType) => {
    const storageKeys = Object.keys(sessionStorage);
    storageKeys.forEach(key => {
      if (key.includes(`"type":"${type}"`)) {
        sessionStorage.removeItem(key);
      }
    });
  },

  /**
   * 清除单个文章缓存
   */
  clearFeed: (id: string) => {
    sessionStorage.removeItem(`api_cache_feed_${id}`);
  }
};
