import { useApiCache, CACHE_CONFIGS } from './useApiCache';
import { client } from '../main';

interface Feed {
  id: string;
  title: string;
  avatar?: string;
  draft?: number;
  listed?: number;
  top?: number;
  summary: string;
  hashtags: { id: number; name: string }[];
  createdAt: Date;
  updatedAt: Date;
  pv?: number;
  uv?: number;
}

interface FeedsParams {
  page?: number;
  limit?: number;
  search?: string;
  tag?: string;
  sort?: string;
}

/**
 * 文章列表缓存Hook
 * 
 * 基于通用缓存Hook实现文章列表的智能缓存
 * 支持分页、搜索、标签筛选等参数变化时自动失效缓存
 * 
 * @param params 查询参数
 * @returns 文章列表数据、加载状态、错误信息和刷新函数
 */
export function useFeedsCache(params: FeedsParams = {}) {
  const {
    page = 1,
    limit = 10,
    search,
    tag,
    sort = 'createdAt'
  } = params;

  // 创建缓存键，包含所有参数
  const cacheKey = `${CACHE_CONFIGS.FEEDS.key}_${page}_${limit}_${search || ''}_${tag || ''}_${sort}`;
  
  const cacheConfig = {
    ...CACHE_CONFIGS.FEEDS,
    key: cacheKey
  };

  // API获取函数
  const fetcher = async () => {
    const response = await client.feed.index.get({
      query: {
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
        ...(tag && { tag }),
        ...(sort && { sort })
      }
    });

    if (response.error) {
      throw new Error(response.error.value as string);
    }

    // 转换日期字段
    const feeds = (response.data?.data || []).map((feed: any) => ({
      ...feed,
      createdAt: new Date(feed.createdAt),
      updatedAt: new Date(feed.updatedAt)
    }));

    return {
      data: feeds,
      total: response.data?.size || 0,
      hasNext: response.data?.hasNext || false
    };
  };

  return useApiCache({
    cacheConfig,
    fetcher,
    params: [page, limit, search, tag, sort],
    onSuccess: (data) => {
      console.log(`Loaded ${data.data.length} feeds from ${data.data.length > 0 ? 'cache or API' : 'API'}`);
    },
    onError: (error) => {
      console.error('Failed to load feeds:', error);
    }
  });
}

/**
 * 文章详情缓存Hook
 * 
 * @param feedId 文章ID
 * @returns 文章详情数据、加载状态、错误信息和刷新函数
 */
export function useFeedDetailCache(feedId: string | null) {
  const cacheKey = `${CACHE_CONFIGS.FEED_DETAIL.key}_${feedId}`;
  
  const cacheConfig = {
    ...CACHE_CONFIGS.FEED_DETAIL,
    key: cacheKey
  };

  // API获取函数
  const fetcher = async () => {
    if (!feedId) {
      throw new Error('Feed ID is required');
    }

    const response = await client.feed({ id: feedId }).get();

    if (response.error) {
      throw new Error(response.error.value as string);
    }

    // 转换日期字段
    const feed = response.data ? {
      ...response.data,
      createdAt: new Date(response.data.createdAt),
      updatedAt: new Date(response.data.updatedAt)
    } : null;

    return feed;
  };

  return useApiCache({
    cacheConfig,
    fetcher,
    params: [feedId],
    enabled: !!feedId,
    onSuccess: () => {
      console.log(`Loaded feed detail for ${feedId} from cache or API`);
    },
    onError: (error) => {
      console.error(`Failed to load feed detail for ${feedId}:`, error);
    }
  });
}

/**
 * 评论缓存Hook
 * 
 * @param feedId 文章ID
 * @returns 评论数据、加载状态、错误信息和刷新函数
 */
export function useCommentsCache(feedId: string | null) {
  const cacheKey = `${CACHE_CONFIGS.COMMENTS.key}_${feedId}`;
  
  const cacheConfig = {
    ...CACHE_CONFIGS.COMMENTS,
    key: cacheKey
  };

  // API获取函数
  const fetcher = async () => {
    if (!feedId) {
      throw new Error('Feed ID is required');
    }

    const response = await client.feed.comment({ feed: feedId }).get();

    if (response.error) {
      throw new Error(response.error.value as string);
    }

    // 转换日期字段
    const comments = (response.data || []).map((comment: any) => ({
      ...comment,
      createdAt: new Date(comment.createdAt),
      updatedAt: new Date(comment.updatedAt)
    }));

    return comments;
  };

  return useApiCache({
    cacheConfig,
    fetcher,
    params: [feedId],
    enabled: !!feedId,
    onSuccess: (data) => {
      console.log(`Loaded ${data.length} comments for ${feedId} from cache or API`);
    },
    onError: (error) => {
      console.error(`Failed to load comments for ${feedId}:`, error);
    }
  });
}

/**
 * 用户配置缓存Hook
 *
 * @param type 配置类型
 * @returns 用户配置数据、加载状态、错误信息和刷新函数
 */
export function useConfigCache(type: "client" | "server" = "client") {
  const cacheKey = `${CACHE_CONFIGS.CONFIG.key}_${type}`;

  const cacheConfig = {
    ...CACHE_CONFIGS.CONFIG,
    key: cacheKey
  };

  return useApiCache({
    cacheConfig,
    fetcher: async () => {
      const response = await client.config({ type }).get();

      if (response.error) {
        throw new Error(response.error.value as string);
      }

      return response.data;
    },
    params: [type],
    onSuccess: () => {
      console.log(`Loaded ${type} config from cache or API`);
    },
    onError: (error) => {
      console.error(`Failed to load ${type} config:`, error);
    }
  });
}

/**
 * 清理所有文章相关缓存
 * 
 * 在文章发布、编辑、删除后调用，确保缓存数据的一致性
 */
export function clearFeedsCache(): void {
  // 清理文章列表缓存
  Object.keys(sessionStorage).forEach(key => {
    if (key.startsWith(CACHE_CONFIGS.FEEDS.key)) {
      sessionStorage.removeItem(key);
    }
  });

  // 清理文章详情缓存
  Object.keys(sessionStorage).forEach(key => {
    if (key.startsWith(CACHE_CONFIGS.FEED_DETAIL.key)) {
      sessionStorage.removeItem(key);
    }
  });

  console.log('Cleared all feeds cache');
}

/**
 * 清理特定文章的缓存
 * 
 * @param feedId 文章ID
 */
export function clearFeedCache(feedId: string): void {
  // 清理特定文章详情缓存
  const detailKey = `${CACHE_CONFIGS.FEED_DETAIL.key}_${feedId}`;
  sessionStorage.removeItem(detailKey);

  // 清理该文章的评论缓存
  const commentsKey = `${CACHE_CONFIGS.COMMENTS.key}_${feedId}`;
  sessionStorage.removeItem(commentsKey);

  console.log(`Cleared cache for feed ${feedId}`);
}
