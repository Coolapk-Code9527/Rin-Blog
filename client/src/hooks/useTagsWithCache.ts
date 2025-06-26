import { useState, useEffect } from 'react';
import { client } from '../main';

interface Tag {
  id: number;
  name: string;
  feeds: number;
  description?: string;
}

interface CacheData {
  data: Tag[];
  timestamp: number;
  maxTags: number;
}

/**
 * 带缓存的标签数据Hook
 * 
 * 提供智能缓存策略，减少重复API请求，提升用户体验
 * 
 * @param maxTags 最大标签数量
 * @returns 标签数据、加载状态、错误信息和强制刷新函数
 */
export function useTagsWithCache(maxTags: number = 10) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 缓存配置
  const CACHE_KEY = 'tagcloud_cache';
  const CACHE_DURATION = 30 * 60 * 1000; // 30分钟缓存

  /**
   * 从缓存中获取数据
   */
  const getCachedData = (): CacheData | null => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const cacheData: CacheData = JSON.parse(cached);
      const now = Date.now();

      // 检查缓存是否过期或maxTags不匹配
      if (
        now - cacheData.timestamp > CACHE_DURATION ||
        cacheData.maxTags !== maxTags
      ) {
        sessionStorage.removeItem(CACHE_KEY);
        return null;
      }

      return cacheData;
    } catch (error) {
      console.warn('Failed to parse cached tags data:', error);
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
  };

  /**
   * 保存数据到缓存
   */
  const setCachedData = (data: Tag[]) => {
    try {
      const cacheData: CacheData = {
        data,
        timestamp: Date.now(),
        maxTags
      };
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache tags data:', error);
    }
  };

  /**
   * 从API获取标签数据
   */
  const fetchTags = async (useCache: boolean = true): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      // 尝试从缓存获取数据
      if (useCache) {
        const cachedData = getCachedData();
        if (cachedData) {
          setTags(cachedData.data);
          setLoading(false);
          return;
        }
      }

      // 从API获取数据
      const response = await client.tag.index.get();

      if (response.error) {
        throw new Error(response.error.value as string);
      }

      // 处理和排序标签数据
      const sortedTags = (response.data || [])
        .filter((tag: Tag) => tag.feeds > 0) // 只显示有文章的标签
        .sort((a: Tag, b: Tag) => b.feeds - a.feeds) // 按文章数量排序
        .slice(0, maxTags); // 限制数量

      setTags(sortedTags);
      
      // 保存到缓存
      setCachedData(sortedTags);

    } catch (err) {
      console.error('Failed to fetch tags:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tags');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 强制刷新数据（跳过缓存）
   */
  const refreshTags = () => {
    sessionStorage.removeItem(CACHE_KEY);
    fetchTags(false);
  };

  // 初始化数据加载
  useEffect(() => {
    fetchTags();
  }, [maxTags]);

  return {
    tags,
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
  try {
    const cached = sessionStorage.getItem('tagcloud_cache');
    if (!cached) return;

    const cacheData: CacheData = JSON.parse(cached);
    const now = Date.now();
    const CACHE_DURATION = 30 * 60 * 1000;

    if (now - cacheData.timestamp > CACHE_DURATION) {
      sessionStorage.removeItem('tagcloud_cache');
    }
  } catch (error) {
    sessionStorage.removeItem('tagcloud_cache');
  }
}
