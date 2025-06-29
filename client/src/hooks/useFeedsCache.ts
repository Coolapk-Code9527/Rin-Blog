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
    staleTime = 8 * 60 * 1000, // 优化：8分钟缓存（文章列表更新频率较低）
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
    staleTime: 15 * 60 * 1000, // 优化：15分钟缓存（最近文章更新频率更低）
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
    staleTime: 8 * 60 * 1000, // 优化：8分钟缓存（时间线更新频率适中）
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
    staleTime: 20 * 60 * 1000, // 优化：20分钟缓存（单篇文章内容相对稳定）
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
    staleTime: 12 * 60 * 1000, // 优化：12分钟缓存（标签页面更新频率较低）
    enabled: enabled && !!tagName,
    refetchOnWindowFocus: true
  });
}

/**
 * 搜索结果缓存Hook
 *
 * 用于搜索页面的结果缓存
 */
export function useSearchCache(keyword: string, page: number = 1, limit: number = 10, enabled: boolean = true) {
  const cacheKey = `search_keyword:${encodeURIComponent(keyword)}_page:${page}_limit:${limit}`;

  const fetcher = useMemo(() => async () => {
    const response = await client.search({ keyword }).get({
      query: {
        page,
        limit
      },
      headers: headersWithAuth()
    });

    if (response.error) {
      throw new Error(response.error.value as string);
    }

    if (!response.data || typeof response.data === 'string') {
      throw new Error('Search failed');
    }

    return response.data;
  }, [keyword, page, limit]);

  return useApiCache(cacheKey, fetcher, {
    staleTime: 5 * 60 * 1000, // 优化：5分钟缓存（搜索结果相对短期有效）
    enabled: enabled && !!keyword,
    refetchOnWindowFocus: false // 搜索结果不需要频繁刷新
  });
}

/**
 * 标签列表缓存Hook
 *
 * 用于标签页面的标签列表
 */
export function useTagsCache(enabled: boolean = true) {
  const cacheKey = 'tags_list';

  const fetcher = useMemo(() => async () => {
    const response = await client.tag.index.get();

    if (response.error) {
      throw new Error(response.error.value as string);
    }

    if (!response.data || typeof response.data === 'string') {
      throw new Error('Failed to fetch tags');
    }

    return response.data;
  }, []);

  return useApiCache(cacheKey, fetcher, {
    staleTime: 15 * 60 * 1000, // 优化：15分钟缓存（标签列表更新频率很低）
    enabled,
    refetchOnWindowFocus: true
  });
}

/**
 * 配置缓存Hook
 *
 * 用于设置页面的配置获取（仅读操作）
 */
export function useConfigCache(type: 'client' | 'server', enabled: boolean = true) {
  const cacheKey = `config_type:${type}`;

  const fetcher = useMemo(() => async () => {
    const response = await client.config({ type }).get({
      headers: headersWithAuth()
    });

    if (response.error) {
      throw new Error(response.error.value as string);
    }

    if (!response.data || typeof response.data === 'string') {
      throw new Error('Failed to fetch config');
    }

    return response.data;
  }, [type]);

  return useApiCache(cacheKey, fetcher, {
    staleTime: 10 * 60 * 1000, // 优化：10分钟缓存（配置更新频率中等）
    enabled,
    refetchOnWindowFocus: true
  });
}

/**
 * 友情链接缓存Hook
 *
 * 用于友情链接页面的数据获取和处理
 */
export function useFriendsCache(enabled: boolean = true) {
  const cacheKey = 'friends_list';

  const fetcher = useMemo(() => async () => {
    const response = await client.friend.index.get({
      headers: headersWithAuth()
    });

    if (response.error) {
      throw new Error(response.error.value as string);
    }

    if (!response.data) {
      throw new Error('Failed to fetch friends');
    }

    return response.data;
  }, []);

  const result = useApiCache(cacheKey, fetcher, {
    staleTime: 5 * 60 * 1000, // 优化：5分钟缓存（友情链接更新频率中等）
    enabled,
    refetchOnWindowFocus: true
  });

  // 处理数据过滤和分类
  const processedData = useMemo(() => {
    if (!result.data) return null;

    const friendList = result.data.friend_list || [];

    // 分类处理友情链接
    const friendsAvailable = friendList.filter(({ health, accepted }: any) =>
      health.length === 0 && accepted === 1
    );

    const friendsUnavailable = friendList.filter(({ health, accepted }: any) =>
      health.length > 0 && accepted === 1
    );

    const waitList = friendList.filter(({ accepted }: any) => accepted === 0);
    const refusedList = friendList.filter(({ accepted }: any) => accepted === -1);

    return {
      friendsAvailable,
      friendsUnavailable,
      waitList,
      refusedList,
      applyList: result.data.apply_list || []
    };
  }, [result.data]);

  return {
    ...result,
    processedData
  };
}

/**
 * 文件列表缓存Hook
 *
 * 用于FileManager组件的文件列表获取，支持复杂查询参数
 */
export function useFilesCache(
  currentPath: string = '/',
  search: string = '',
  sortBy: string = 'name',
  sortOrder: string = 'asc',
  currentPage: number = 1,
  itemsPerPage: number = 20,
  enabled: boolean = true
) {
  // 构建缓存键，包含所有查询参数
  const cacheKey = `files_path:${encodeURIComponent(currentPath)}_search:${encodeURIComponent(search)}_sort:${sortBy}_order:${sortOrder}_page:${currentPage}_limit:${itemsPerPage}`;

  const fetcher = useMemo(() => async () => {
    const { endpoint } = await import('../main');

    if (!endpoint) {
      throw new Error('API endpoint not configured');
    }

    const params = new URLSearchParams();
    params.append('path', currentPath);
    if (search) params.append('search', search);
    params.append('sort', sortBy);
    params.append('order', sortOrder);
    params.append('page', String(currentPage));
    params.append('limit', String(itemsPerPage));
    params.append('all', '1');

    const response = await fetch(`${endpoint}/files?${params.toString()}`, {
      headers: headersWithAuth()
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // 处理数据过滤（移除缩略图文件）
    let filesData = data.files || [];
    let total = data.total || 0;

    // 过滤缩略图文件（不在文件管理界面显示）
    filesData = filesData.filter((f: any) => {
      // 过滤以 thumb_ 开头的文件
      if (!f.isFolder && f.name && f.name.startsWith('thumb_')) {
        return false;
      }
      // 过滤视频缩略图文件（以 _thumbnail 结尾的文件）
      if (!f.isFolder && f.name && f.name.includes('_thumbnail.')) {
        return false;
      }
      return true;
    });

    // 处理根目录的虚拟文件夹逻辑
    if (currentPath === '/' && filesData.length > 0) {
      const virtualFolders = filesData.filter((f: any) => f.isFolder && f.id < 0);
      const dbItems = filesData.filter((f: any) => !(f.isFolder && f.id < 0));

      if (currentPage === 1) {
        filesData = [...virtualFolders, ...dbItems];
      } else {
        filesData = dbItems;
      }
      total = total - virtualFolders.length;
    }

    return {
      files: filesData,
      total
    };
  }, [currentPath, search, sortBy, sortOrder, currentPage, itemsPerPage]);

  return useApiCache(cacheKey, fetcher, {
    staleTime: 2 * 60 * 1000, // 优化：2分钟缓存（文件列表更新频率较高）
    enabled,
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
