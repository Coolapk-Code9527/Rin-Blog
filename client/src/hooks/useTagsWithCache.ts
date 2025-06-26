import { useApiCache, CACHE_CONFIGS } from './useApiCache';
import { client } from '../main';

interface Tag {
  id: number;
  name: string;
  feeds: number;
  description?: string;
}

/**
 * 带缓存的标签数据Hook
 *
 * 基于通用缓存Hook重构，提供智能缓存策略，减少重复API请求，提升用户体验
 *
 * @param maxTags 最大标签数量
 * @returns 标签数据、加载状态、错误信息和强制刷新函数
 */
export function useTagsWithCache(maxTags: number = 10) {
  // 创建包含maxTags参数的缓存键
  const cacheKey = `${CACHE_CONFIGS.TAGS.key}_${maxTags}`;

  const cacheConfig = {
    ...CACHE_CONFIGS.TAGS,
    key: cacheKey
  };

  // API获取函数
  const fetcher = async () => {
    const response = await client.tag.index.get();

    if (response.error) {
      throw new Error(response.error.value as string);
    }

    // 处理和排序标签数据
    const sortedTags = (response.data || [])
      .filter((tag: Tag) => tag.feeds > 0) // 只显示有文章的标签
      .sort((a: Tag, b: Tag) => b.feeds - a.feeds) // 按文章数量排序
      .slice(0, maxTags); // 限制数量

    return sortedTags;
  };

  const { data: tags, loading, error, refresh: refreshTags } = useApiCache({
    cacheConfig,
    fetcher,
    params: [maxTags],
    onSuccess: (data) => {
      console.log(`Loaded ${data.length} tags from cache or API`);
    },
    onError: (error) => {
      console.error('Failed to load tags:', error);
    }
  });

  return {
    tags: tags || [],
    loading,
    error,
    refreshTags
  };
}

/**
 * 清理过期的标签缓存
 *
 * 可以在应用启动时调用，清理过期的缓存数据
 */
export function clearExpiredTagsCache(): void {
  // 清理所有标签相关缓存
  Object.keys(sessionStorage).forEach(key => {
    if (key.startsWith(CACHE_CONFIGS.TAGS.key)) {
      sessionStorage.removeItem(key);
    }
  });

  // 兼容旧的缓存键
  sessionStorage.removeItem('tagcloud_cache');

  console.log('Cleared all tags cache');
}
