import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'wouter';
import { useGlassEffect, GLASS_LAYERS } from '../../hooks/useGlassEffect';
import { client } from '../../main';

interface Tag {
  id: number;
  name: string;
  feeds: number;
  description?: string;
}

interface TagCloudProps {
  className?: string;
  maxTags?: number;
}

export function TagCloud({ className = '', maxTags = 10 }: TagCloudProps) {
  const { t } = useTranslation();
  const glassClass = useGlassEffect(GLASS_LAYERS.CARD);
  
  const [tags, setTags] = React.useState<Tag[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // 获取标签数据
  React.useEffect(() => {
    const fetchTags = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await client.tag.index.get();
        
        if (response.error) {
          throw new Error(response.error.value as string);
        }
        
        // 按文章数量排序，取前N个热门标签
        const sortedTags = (response.data || [])
          .filter((tag: Tag) => tag.feeds > 0) // 只显示有文章的标签
          .sort((a: Tag, b: Tag) => b.feeds - a.feeds)
          .slice(0, maxTags);
        
        setTags(sortedTags);
      } catch (err) {
        console.error('Failed to fetch tags:', err);
        setError(err instanceof Error ? err.message : 'Failed to load tags');
      } finally {
        setLoading(false);
      }
    };

    fetchTags();
  }, [maxTags]);

  // 计算标签字体大小（基于文章数量，但范围更小）
  const getTagSize = (feedCount: number, maxCount: number) => {
    if (maxCount === 0) return 'text-sm font-medium px-3 py-1.5';

    const ratio = feedCount / maxCount;
    if (ratio >= 0.8) return 'text-sm font-semibold px-3 py-2';
    if (ratio >= 0.6) return 'text-sm font-medium px-3 py-1.5';
    return 'text-sm font-medium px-2.5 py-1.5';
  };

  // 生成标签颜色（更鲜艳的颜色）
  const getTagColor = (index: number) => {
    const colors = [
      'bg-red-500 text-white hover:bg-red-600 border-red-500',
      'bg-emerald-500 text-white hover:bg-emerald-600 border-emerald-500',
      'bg-yellow-500 text-white hover:bg-yellow-600 border-yellow-500',
      'bg-blue-500 text-white hover:bg-blue-600 border-blue-500',
      'bg-purple-500 text-white hover:bg-purple-600 border-purple-500',
      'bg-pink-500 text-white hover:bg-pink-600 border-pink-500',
      'bg-indigo-500 text-white hover:bg-indigo-600 border-indigo-500',
      'bg-teal-500 text-white hover:bg-teal-600 border-teal-500',
      'bg-orange-500 text-white hover:bg-orange-600 border-orange-500',
      'bg-cyan-500 text-white hover:bg-cyan-600 border-cyan-500',
    ];
    return colors[index % colors.length];
  };

  if (loading) {
    return <TagCloudSkeleton className={className} />;
  }

  if (error) {
    return (
      <div className={`rounded-2xl ${glassClass} shadow-enhanced border border-neutral-200/60 dark:border-neutral-700/60 overflow-hidden ${className}`}>
        <div className="px-4 py-3 border-b border-neutral-200/60 dark:border-neutral-700/60">
          <h3 className="text-lg font-bold flex items-center gap-2 mt-0 mb-0">
            <i className="ri-price-tag-3-line text-theme"></i>
            {t('tagCloud.title', { defaultValue: '热门标签' })}
          </h3>
        </div>
        <div className="p-4 text-center">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t('tagCloud.error', { defaultValue: '加载标签失败' })}
          </p>
        </div>
      </div>
    );
  }

  if (tags.length === 0) {
    return (
      <div className={`rounded-2xl ${glassClass} shadow-enhanced border border-neutral-200/60 dark:border-neutral-700/60 overflow-hidden ${className}`}>
        <div className="px-4 py-3 border-b border-neutral-200/60 dark:border-neutral-700/60">
          <h3 className="text-lg font-bold flex items-center gap-2 mt-0 mb-0">
            <i className="ri-price-tag-3-line text-theme"></i>
            {t('tagCloud.title', { defaultValue: '热门标签' })}
          </h3>
        </div>
        <div className="p-4 text-center">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t('tagCloud.empty', { defaultValue: '暂无标签' })}
          </p>
        </div>
      </div>
    );
  }

  const maxFeedCount = Math.max(...tags.map(tag => tag.feeds));

  return (
    <div className={`rounded-2xl ${glassClass} shadow-enhanced border border-neutral-200/60 dark:border-neutral-700/60 overflow-hidden ${className}`}>
      {/* 头部 */}
      <div className="px-4 py-3 border-b border-neutral-200/60 dark:border-neutral-700/60">
        <h3 className="text-lg font-bold flex items-center gap-2 mt-0 mb-0">
          <i className="ri-price-tag-3-line text-theme"></i>
          {t('tagCloud.title', { defaultValue: '热门标签' })}
        </h3>
      </div>

      {/* 标签云内容 */}
      <div className="p-4">
        <div className="flex flex-wrap gap-2 justify-start">
          {tags.map((tag, index) => (
            <Link
              key={tag.id}
              href={`/tag/${encodeURIComponent(tag.name)}`}
              className={`
                inline-flex items-center gap-1.5 rounded-lg
                transition-all duration-200 hover:scale-105 shadow-sm hover:shadow-md
                ${getTagSize(tag.feeds, maxFeedCount)}
                ${getTagColor(index)}
              `}
            >
              <i className="ri-price-tag-3-line text-xs opacity-80"></i>
              <span>{tag.name}</span>
              <span className="text-xs opacity-80">
                {tag.feeds}
              </span>
            </Link>
          ))}
        </div>
        
        {/* 查看更多链接 */}
        <div className="mt-4 pt-3 border-t border-neutral-200/60 dark:border-neutral-700/60">
          <Link
            href="/hashtags"
            className="text-sm text-theme hover:text-theme-dark transition-colors duration-200 flex items-center gap-1"
          >
            <span>{t('tagCloud.viewAll', { defaultValue: '查看全部标签' })}</span>
            <i className="ri-arrow-right-s-line text-xs"></i>
          </Link>
        </div>
      </div>
    </div>
  );
}

// 标签云骨架屏
function TagCloudSkeleton({ className = '' }: { className?: string }) {
  const glassClass = useGlassEffect(GLASS_LAYERS.CARD);
  
  return (
    <div className={`rounded-2xl ${glassClass} shadow-enhanced border border-neutral-200/60 dark:border-neutral-700/60 overflow-hidden animate-pulse ${className}`}>
      <div className="px-4 py-3 border-b border-neutral-200/60 dark:border-neutral-700/60">
        <div className="h-6 bg-neutral-200 dark:bg-neutral-700 rounded w-24"></div>
      </div>
      <div className="p-4">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-6 bg-neutral-200 dark:bg-neutral-700 rounded"
              style={{ width: `${Math.random() * 40 + 40}px` }}
            ></div>
          ))}
        </div>
      </div>
    </div>
  );
}
