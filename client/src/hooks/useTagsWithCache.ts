import { useMemo } from 'react';
import { client } from '../main';
import { CACHE_CONFIG, CACHE_KEY_PATTERNS } from '../utils/cacheConstants';
import { useApiCache } from './useApiCache';

/**
 * API响应错误检查工具
 */
const checkApiError = (response: any): void => {
  if (response.error) {
    throw new Error(response.error.value as string);
  }
};

interface Tag {
  id: number;
  name: string;
  feeds: number;
  description?: string;
}

/**
 * 带缓存的标签数据Hook
 *
 * 基于useApiCache实现，提供统一的缓存策略
 *
 * @param maxTags 最大标签数量
 * @returns 标签数据、加载状态、错误信息和强制刷新函数
 */
export function useTagsWithCache(maxTags: number = 10) {
  // 生成包含maxTags参数的缓存键，确保不同maxTags值有独立缓存
  const cacheKey = useMemo(() => {
    return `${CACHE_KEY_PATTERNS.TAGS.LIST()}_max:${maxTags}`;
  }, [maxTags]);

  // 数据获取函数
  const fetcher = useMemo(() => async (): Promise<Tag[]> => {
    const response = await client.tag.index.get();

    checkApiError(response);

    // 处理和排序标签数据
    const tags = response.data as Tag[] || [];
    const sortedTags = tags
      .filter((tag: Tag) => tag.feeds > 0) // 只显示有文章的标签
      .sort((a: Tag, b: Tag) => b.feeds - a.feeds) // 按文章数量排序
      .slice(0, maxTags); // 限制数量

    return sortedTags;
  }, [maxTags]);

  // 使用useApiCache进行缓存管理
  const { data: tags, loading, error, refetch } = useApiCache<Tag[]>(cacheKey, fetcher, {
    staleTime: CACHE_CONFIG.TAGS.LIST, // 使用统一配置：15分钟缓存
    enabled: true,
    refetchOnWindowFocus: true
  });

  return {
    tags: tags || [],
    loading,
    error,
    refreshTags: refetch
  };
}