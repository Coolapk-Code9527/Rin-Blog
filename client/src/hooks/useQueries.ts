import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CACHE_KEYS } from '../lib/cacheKeys'
import { CACHE_TIMES } from '../lib/queryClient'
import { client } from '../main'
import { headersWithAuth } from '../utils/auth'

// 安全的错误处理函数
function createApiError(response: any, defaultMessage: string = 'API request failed'): Error {
  if (response.error) {
    // 安全地提取错误信息
    const errorValue = response.error.value;
    if (typeof errorValue === 'string') {
      return new Error(errorValue);
    } else if (typeof errorValue === 'object' && errorValue?.message) {
      return new Error(errorValue.message);
    } else {
      return new Error(`${defaultMessage}: ${JSON.stringify(errorValue)}`);
    }
  }
  return new Error(defaultMessage);
}

// 文章类型枚举 - 与现有useFeedsCache保持一致
export type FeedType = 'draft' | 'unlisted' | 'normal' | 'all';

// 文章数据结构 - 与现有useFeedsCache保持一致
export interface FeedsData {
  data: any[];
  size: number;
  page?: number;
  limit?: number;
  hasNext?: boolean;
}

// useFeedsCache配置接口 - 与现有接口保持一致
interface UseFeedsCacheConfig {
  type?: FeedType;
  page?: number;
  limit?: number;
  sortByTime?: boolean;
  staleTime?: number;
  enabled?: boolean;
}

// 获取文章列表 - 兼容现有useFeedsCache接口
export function useFeeds(config: UseFeedsCacheConfig = {}) {
  const {
    type = 'all',
    page = 1,
    limit = 9999,
    sortByTime = false,
    enabled = true
  } = config;

  const result = useQuery({
    queryKey: CACHE_KEYS.feeds(type),
    staleTime: CACHE_TIMES.SHORT,  // 文章列表2分钟过期，确保及时更新
    queryFn: async (): Promise<FeedsData> => {
      const response = await client.feed.index.get({
        query: {
          page,
          limit,
          type,
          lightweight: true,
          ...(sortByTime && { sortByTime: true })
        },
        headers: headersWithAuth()
      });

      if (response.error) {
        throw createApiError(response, 'Failed to fetch feeds');
      }

      if (!response.data || typeof response.data === 'string') {
        throw new Error('Invalid response data');
      }

      const apiData = response.data as any;

      return {
        data: Array.isArray(apiData.data) ? apiData.data : [],
        size: typeof apiData.size === 'number' ? apiData.size : 0,
        page: typeof apiData.page === 'number' ? apiData.page : page,
        limit: typeof apiData.limit === 'number' ? apiData.limit : limit,
        hasNext: typeof apiData.hasNext === 'boolean' ? apiData.hasNext : false
      } as FeedsData;
    },
    enabled
  });

  // 返回与现有useFeedsCache兼容的接口
  return {
    data: result.data,
    loading: result.isLoading,
    error: result.error,
    invalidate: result.refetch,
    // 提供便捷的数据访问 - 与现有接口保持一致
    feeds: result.data?.data || [],
    totalSize: result.data?.size || 0,
    currentPage: result.data?.page || page,
    pageLimit: result.data?.limit || limit
  };
}

// 兼容现有useFeedsCache接口的别名
export const useFeedsCache = useFeeds;

// 获取单个文章
export function useFeed(id: string) {
  return useQuery({
    queryKey: CACHE_KEYS.feed(id),
    staleTime: CACHE_TIMES.MEDIUM,  // 单篇文章5分钟过期，内容相对稳定
    queryFn: async () => {
      const response = await client.feed({ id }).get({
        headers: headersWithAuth()
      });

      if (response.error) {
        throw createApiError(response, 'Failed to fetch feed');
      }

      return response.data;
    },
    enabled: !!id && id !== "0" && !isNaN(Number(id)) && Number(id) > 0
  })
}

// 获取评论
export function useComments(feedId: string) {
  return useQuery({
    queryKey: CACHE_KEYS.comments(feedId),
    staleTime: CACHE_TIMES.REALTIME,  // 评论30秒过期，确保实时性
    queryFn: async () => {
      const response = await client.feed.comment({ feed: feedId }).get({
        headers: headersWithAuth()
      });

      if (response.error) {
        throw createApiError(response, 'Failed to fetch comments');
      }

      return response.data;
    },
    enabled: !!feedId
  })
}

// 获取配置
export function useConfig(type: "client" | "server") {
  return useQuery({
    queryKey: CACHE_KEYS.config(type),
    staleTime: CACHE_TIMES.LONG,  // 配置10分钟过期，变化频率低
    queryFn: async () => {
      const response = await client.config({ type }).get({
        headers: headersWithAuth()
      });

      if (response.error) {
        throw createApiError(response, 'Failed to fetch config');
      }

      return response.data;
    }
  })
}

// 获取友情链接
export function useFriends() {
  return useQuery({
    queryKey: CACHE_KEYS.friends(),
    staleTime: CACHE_TIMES.MEDIUM,  // 友情链接5分钟过期，变化不频繁
    queryFn: async () => {
      const response = await client.friend.index.get({
        headers: headersWithAuth()
      });

      if (response.error) {
        throw createApiError(response, 'Failed to fetch friends');
      }

      return response.data;
    }
  })
}

// 获取标签
export function useTags() {
  return useQuery({
    queryKey: CACHE_KEYS.tags(),
    staleTime: CACHE_TIMES.MEDIUM,  // 标签列表5分钟过期，变化不频繁
    queryFn: async () => {
      const response = await client.tag.index.get();

      if (response.error) {
        throw createApiError(response, 'Failed to fetch tags');
      }

      return response.data;
    }
  })
}

// 删除文章的mutation
export function useDeleteFeed() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await client.feed({ id }).delete(undefined, {
        headers: headersWithAuth()
      });

      if (response.error) {
        throw createApiError(response, 'Failed to delete feed');
      }

      return response.data;
    },
    onSuccess: (data, variables) => {
      // 删除成功后，失效相关查询 - 确保多用户缓存一致性
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'feeds' });
      queryClient.invalidateQueries({ queryKey: ['feed', variables] });
      // 也失效搜索结果，因为删除的文章可能在搜索结果中
      queryClient.invalidateQueries({ queryKey: ['search'] });
    }
  })
}

// 发布/更新文章的mutation
export function usePublishFeed() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: any) => {
      let response;

      if (data.id) {
        // 更新文章
        response = await client.feed({ id: data.id.toString() }).post(data, {
          headers: headersWithAuth()
        });
      } else {
        // 创建新文章
        response = await client.feed.index.post(data, {
          headers: headersWithAuth()
        });
      }

      if (response.error) {
        throw createApiError(response, 'Failed to publish feed');
      }

      return response.data;
    },
    onSuccess: (data, variables) => {
      // 发布/更新成功后，失效相关查询 - 确保多用户缓存一致性
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'feeds' });
      if (variables.id) {
        queryClient.invalidateQueries({ queryKey: ['feed', variables.id.toString()] });
      }
      // 失效搜索结果，因为新发布/更新的文章可能影响搜索结果
      queryClient.invalidateQueries({ queryKey: ['search'] });
    }
  })
}

// 发布评论的mutation
export function usePublishComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: any) => {
      const response = await client.feed.comment({ feed: data.feedId }).post(data, {
        headers: headersWithAuth()
      });

      if (response.error) {
        throw createApiError(response, 'Failed to publish comment');
      }

      return response.data;
    },
    onSuccess: (data, variables) => {
      // 发布评论成功后，失效相关查询 - 确保多用户缓存一致性
      queryClient.invalidateQueries({ queryKey: ['comments', variables.feedId] });
      // 也失效对应的文章查询，因为评论数量可能影响文章显示
      queryClient.invalidateQueries({ queryKey: ['feed', variables.feedId] });
    }
  })
}

// 搜索文章
export function useSearchFeeds(keyword: string, page: number = 1, limit: number = 10) {
  return useQuery({
    queryKey: CACHE_KEYS.search(keyword, page, limit),
    staleTime: CACHE_TIMES.SHORT,  // 搜索结果2分钟过期，保持相对新鲜
    queryFn: async () => {
      const response = await client.search({ keyword }).get({
        query: { page, limit },
        headers: headersWithAuth()
      });

      if (response.error) {
        throw createApiError(response, 'Failed to search feeds');
      }

      return response.data;
    },
    enabled: !!keyword
  });
}

// 兼容现有useSearchCache接口的别名
export function useSearchCache(keyword: string, page: number = 1, limit: number = 10, enabled: boolean = true) {
  const result = useSearchFeeds(keyword, page, limit);

  return {
    data: result.data,
    loading: result.isLoading,
    error: result.error,
    invalidate: result.refetch
  };
}

// 兼容现有useCommentsCache接口的别名
export function useCommentsCache(feedId: string, enabled: boolean = true) {
  const result = useComments(feedId);

  return {
    data: result.data || [],
    loading: result.isLoading,
    error: result.error,
    invalidate: result.refetch
  };
}

// 兼容现有useFeedCache接口的别名
export function useFeedCache(id: string, enabled: boolean = true) {
  const result = useFeed(id);

  return {
    data: result.data,
    loading: result.isLoading,
    error: result.error,
    invalidate: result.refetch
  };
}

// 获取相邻文章
export function useAdjacentFeeds(id: string) {
  return useQuery({
    queryKey: CACHE_KEYS.adjacent(id),
    staleTime: CACHE_TIMES.MEDIUM,  // 相邻文章5分钟过期
    queryFn: async () => {
      const response = await client.feed.adjacent({ id }).get();

      if (response.error) {
        throw createApiError(response, 'Failed to fetch adjacent feeds');
      }

      return response.data;
    },
    enabled: !!id && id !== "0" && !isNaN(Number(id)) && Number(id) > 0
  });
}

// 兼容现有useAdjacentFeedsCache接口的别名
export function useAdjacentFeedsCache(id: string, enabled: boolean = true) {
  const result = useAdjacentFeeds(id);

  return {
    data: result.data,
    loading: result.isLoading,
    error: result.error,
    invalidate: result.refetch
  };
}

// 获取最近文章
export function useRecentPosts(limit: number = 5) {
  return useQuery({
    queryKey: CACHE_KEYS.recentPosts(limit),
    staleTime: CACHE_TIMES.SHORT,  // 最近文章2分钟过期
    queryFn: async () => {
      const response = await client.feed.index.get({
        query: {
          limit,
          type: 'normal',
          sortByTime: true
        },
        headers: headersWithAuth()
      });

      if (response.error) {
        throw createApiError(response, 'Failed to fetch recent posts');
      }

      return response.data;
    }
  });
}

// 兼容现有useRecentPostsCache接口的别名
export function useRecentPostsCache(limit: number = 5) {
  const result = useRecentPosts(limit);

  return {
    data: result.data?.data || [],
    loading: result.isLoading,
    error: result.error,
    invalidate: result.refetch
  };
}

// 获取标签相关的文章
export function useHashtagFeeds(tagName: string, page: number = 1, limit: number = 10) {
  return useQuery({
    queryKey: CACHE_KEYS.hashtagFeeds(tagName, page, limit),
    staleTime: CACHE_TIMES.SHORT,  // 标签文章2分钟过期
    queryFn: async () => {
      const response = await client.tag({ name: tagName }).get({
        headers: headersWithAuth()
      });

      if (response.error) {
        throw createApiError(response, 'Failed to fetch hashtag feeds');
      }

      // 服务端返回的是完整的标签信息，包含feeds数组
      const tagData = response.data;

      // 安全检查：确保feeds是数组
      const feeds = Array.isArray(tagData?.feeds) ? tagData.feeds : [];

      // 模拟分页处理（服务端暂不支持分页）
      // 边界检查：确保page和limit是有效值
      const safePage = Math.max(1, Math.floor(page || 1));
      const safeLimit = Math.max(1, Math.min(100, Math.floor(limit || 10))); // 限制最大100条

      const startIndex = (safePage - 1) * safeLimit;
      const endIndex = startIndex + safeLimit;
      const paginatedFeeds = feeds.slice(startIndex, endIndex);

      return {
        size: feeds.length,
        data: paginatedFeeds,
        hasNext: endIndex < feeds.length
      };
    },
    enabled: !!tagName
  });
}

// 兼容现有useHashtagFeedsCache接口的别名
export function useHashtagFeedsCache(tagName: string, page: number = 1, limit: number = 10) {
  const result = useHashtagFeeds(tagName, page, limit);

  return {
    data: result.data,
    loading: result.isLoading,
    error: result.error,
    invalidate: result.refetch
  };
}

// 兼容现有useTagsCache接口的别名
export function useTagsCache() {
  const result = useTags();

  return {
    data: result.data || [],
    loading: result.isLoading,
    error: result.error,
    invalidate: result.refetch
  };
}

// 获取时间线数据
export function useTimeline() {
  return useQuery({
    queryKey: CACHE_KEYS.timeline(),
    staleTime: CACHE_TIMES.MEDIUM,  // 时间线5分钟过期
    queryFn: async () => {
      const response = await client.feed.timeline.get({
        headers: headersWithAuth()
      });

      if (response.error) {
        throw createApiError(response, 'Failed to fetch timeline');
      }

      return response.data;
    }
  });
}

// 兼容现有useTimelineCache接口的别名
export function useTimelineCache() {
  const result = useTimeline();

  return {
    data: { data: result.data || [] },
    loading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
    invalidate: result.refetch
  };
}

// 获取文件列表
export function useFiles(page: number = 1, limit: number = 20) {
  return useQuery({
    queryKey: CACHE_KEYS.files(page, limit),
    staleTime: CACHE_TIMES.SHORT,  // 文件列表2分钟过期
    queryFn: async () => {
      const response = await client.files.index.get({
        query: { page, limit },
        headers: headersWithAuth()
      });

      if (response.error) {
        throw createApiError(response, 'Failed to fetch files');
      }

      return response.data;
    }
  });
}

// 兼容现有useFilesCache接口的别名
export function useFilesCache(page: number = 1, limit: number = 20) {
  const result = useFiles(page, limit);

  return {
    data: result.data,
    loading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
    invalidate: result.refetch
  };
}

// 获取配置
export function useConfigQuery(type: 'client' | 'server') {
  return useQuery({
    queryKey: ['config', type],
    staleTime: CACHE_TIMES.LONG,  // 配置10分钟过期
    queryFn: async () => {
      const response = await client.config[type].get({
        headers: headersWithAuth()
      });

      if (response.error) {
        throw createApiError(response, 'Failed to fetch config');
      }

      return response.data;
    }
  });
}

// 兼容现有useConfigCache接口的别名
export function useConfigCache(type: 'client' | 'server') {
  const result = useConfigQuery(type);

  return {
    data: result.data,
    loading: result.isLoading,
    error: result.error,
    invalidate: result.refetch
  };
}

// 网站统计数据接口
interface WebsiteStats {
  totalViews: number;
  totalVisitors: number;
  todayViews: number;
  todayVisitors: number;
  runningDays: number;
}

// 获取网站统计数据
export function useWebsiteStats() {
  return useQuery({
    queryKey: ['website-stats'],
    staleTime: CACHE_TIMES.LONG,  // 统计数据10分钟过期
    queryFn: async (): Promise<WebsiteStats> => {
      const response = await client.stats.website.get();

      if (response.error) {
        throw createApiError(response, 'Failed to fetch website stats');
      }

      // 检查响应格式
      if (!response.data || !response.data.success) {
        throw new Error(response.data?.error || 'Invalid stats response');
      }

      return response.data.data as WebsiteStats;
    }
  });
}
