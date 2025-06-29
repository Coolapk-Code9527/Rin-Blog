import React from "react"
import { useEffect, useState } from "react"
import { Helmet } from 'react-helmet-async'
import { useTranslation } from "react-i18next"
import { FeedCard } from "../components/feed_card"
import { Waiting } from "../components/loading"
import { client } from "../main"
import { headersWithAuth } from "../utils/auth"
import { siteName } from "../utils/constants"
import { PageContainer } from "../components/container"
import { Link, useSearch } from "wouter"
import { HashTag } from "../components/hashtag"
import { Pagination } from "../components/pagination"
import { tryInt } from "../utils/int"
import { useHashtagFeedsCache, useTagsCache } from "../hooks/useFeedsCache"

type FeedsData = {
    name: string;
    id: number;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
    feeds: {
        hashtags: {
            name: string;
            id: number;
        }[];
        id: number;
        title: string | null;
        summary: string;
        content: string;
        createdAt: Date;
        updatedAt: Date;
        user: {
            id: number;
            username: string;
            avatar: string | null;
        };
    }[] | undefined;
}

export function HashtagPage({ name }: { name: string }) {
    const { t } = useTranslation()
    const query = new URLSearchParams(useSearch());

    // 使用缓存Hook替代直接API调用
    const { data: hashtag, loading, invalidate: invalidateHashtagCache } = useHashtagFeedsCache(name, !!name);

    const [sort, setSort] = useState<'new' | 'old'>('new');
    const page = tryInt(1, query.get("page"))

    // 使用ref来稳定invalidate函数的引用
    const invalidateHashtagCacheRef = React.useRef(invalidateHashtagCache);
    invalidateHashtagCacheRef.current = invalidateHashtagCache;

    // 监听文章发布/更新事件，失效缓存
    React.useEffect(() => {
        const handleFeedPublished = () => {
            invalidateHashtagCacheRef.current();
        };

        const handleFeedUpdated = () => {
            invalidateHashtagCacheRef.current();
        };

        window.addEventListener('feed-published', handleFeedPublished);
        window.addEventListener('feed-updated', handleFeedUpdated);

        return () => {
            window.removeEventListener('feed-published', handleFeedPublished);
            window.removeEventListener('feed-updated', handleFeedUpdated);
        };
    }, []); // 移除依赖，使用ref来访问最新的函数
    const limit = tryInt(10, query.get("limit"), process.env.PAGE_SIZE)

    // 页面变化时滚动到顶部
    React.useEffect(() => {
        if (page > 1) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [page])

    // 文章排序
    const sortedFeeds = React.useMemo(() => {
      if (!hashtag?.feeds) return [];
      const arr = [...hashtag.feeds];
      if (sort === 'new') {
        arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      } else {
        arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      }
      return arr;
    }, [hashtag, sort]);

    // 前端分页逻辑 - 对排序后的数据进行分页
    const paginatedFeeds = React.useMemo(() => {
        if (!sortedFeeds.length) return [];

        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedData = sortedFeeds.slice(startIndex, endIndex);

        return paginatedData;
    }, [sortedFeeds, page, limit]);

    // 计算总页数
    const totalPages = React.useMemo(() => {
        if (!sortedFeeds.length) return 1;
        return Math.ceil(sortedFeeds.length / limit);
    }, [sortedFeeds.length, limit]);

    // 相关标签推荐（同一文章下的其他标签，去重）
    const relatedTags = React.useMemo(() => {
      if (!hashtag?.feeds) return [];
      const set = new Set<string>();
      hashtag.feeds.forEach(feed => {
        feed.hashtags.forEach(tag => {
          if (tag.name !== hashtag.name) set.add(tag.name);
        });
      });
      return Array.from(set).slice(0, 8);
    }, [hashtag]);

    return (
        <>
            <Helmet>
                <title>{`${hashtag?.name} - ${process.env.NAME}`}</title>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={hashtag?.name} />
                <meta property="og:image" content={process.env.AVATAR} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={document.URL} />
                <meta name="description" content={t("hashtagDetail.metaDescription", {
                    name: hashtag?.name,
                    description: hashtag?.description ? `：${hashtag.description}` : '',
                    count: hashtag?.feeds?.length || 0
                })} />
            </Helmet>
            <PageContainer maxWidth="max-w-6xl" className="w-full">
                <Waiting for={hashtag || !loading}>
                    <main className="w-full flex flex-col mb-3 ani-show">
                        {/* 页面标题区域 - 与其他标准页面保持一致 */}
                        <div className="flex flex-col space-y-3 mb-3">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-2 sm:py-3 gap-3 sm:gap-3">
                                {/* 左侧：标签名称和文章数量 - 优化移动端布局 */}
                                <div className="flex flex-row items-center gap-2 sm:gap-3 w-full sm:w-auto flex-wrap">
                                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white relative group flex-shrink-0 flex items-center">
                                        <HashTag name={hashtag?.name || ''} />
                                        <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-theme group-hover:w-full transition-all duration-300"></span>
                                    </h1>
                                    <div className="py-1.5 px-2.5 sm:px-3 bg-gray-100/80 dark:bg-gray-800/80 rounded-lg text-xs sm:text-sm text-gray-600 dark:text-gray-400 flex items-center font-medium border border-gray-200/60 dark:border-gray-700/60 flex-shrink-0">
                                        <i className="ri-article-line text-theme text-xs sm:text-sm"></i>
                                        <span className="ml-1 sm:ml-1.5">{t('article.total$count', { count: hashtag?.feeds?.length || 0 })}</span>
                                    </div>
                                </div>

                                {/* 右侧：排序选择 */}
                                <div className="flex gap-2 items-center">
                                    <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">{t('hashtagDetail.sort')}:</span>
                                    <button
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 ease-out transform hover:scale-[0.98] active:scale-[0.96] ${sort === 'new' ? 'bg-theme/10 text-theme border-theme/30 dark:bg-theme/20 dark:border-theme/25 shadow-enhanced backdrop-blur-sm' : 'bg-gray-100/80 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300 border-gray-200/60 dark:border-gray-700/60 hover:bg-gray-50 dark:hover:bg-gray-750 hover:text-theme dark:hover:text-theme shadow-enhanced'}`}
                                        onClick={() => setSort('new')}
                                    >
                                        {t('hashtagDetail.latest')}
                                    </button>
                                    <button
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 ease-out transform hover:scale-[0.98] active:scale-[0.96] ${sort === 'old' ? 'bg-theme/10 text-theme border-theme/30 dark:bg-theme/20 dark:border-theme/25 shadow-enhanced backdrop-blur-sm' : 'bg-gray-100/80 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300 border-gray-200/60 dark:border-gray-700/60 hover:bg-gray-50 dark:hover:bg-gray-750 hover:text-theme dark:hover:text-theme shadow-enhanced'}`}
                                        onClick={() => setSort('old')}
                                    >
                                        {t('hashtagDetail.oldest')}
                                    </button>
                                </div>
                            </div>

                            {/* 标签描述和相关标签 */}
                            {(hashtag?.description || relatedTags.length > 0) && (
                                <div className="flex flex-col gap-2">
                                    {hashtag?.description && (
                                        <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50/80 dark:bg-gray-800/50 px-3 py-2 rounded-lg border border-gray-200/60 dark:border-gray-700/60">
                                            {hashtag.description}
                                        </div>
                                    )}
                                    {relatedTags.length > 0 && (
                                        <div className="flex flex-row flex-wrap gap-2 items-center">
                                            <span className="text-xs text-gray-400 font-medium">{t('hashtagDetail.relatedTags')}:</span>
                                            {relatedTags.map(tag => (
                                                <Link key={tag} href={`/hashtag/${tag}`} className="inline-block">
                                                    <HashTag name={tag} />
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 标准渐变分割线 */}
                            <div className="w-full mb-2">
                                <hr className="h-0.5 border-0 bg-gradient-to-r from-transparent via-theme/40 dark:via-theme/30 to-transparent" />
                            </div>
                        </div>
                        {/* 文章列表区域 */}
                        <Waiting for={!loading}>
                            {sortedFeeds.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <i className="ri-emotion-unhappy-line text-5xl text-gray-300 dark:text-gray-600 mb-4"></i>
                                    <div className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-2">{t('hashtagDetail.noArticles')}</div>
                                    <HotTagsRecommend />
                                </div>
                            ) : (
                                <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5 lg:gap-5 xl:gap-6">
                                    {paginatedFeeds.map(({ id, ...feed }: any) => (
                                        <div key={id} className="w-full max-w-md mx-auto md:max-w-none">
                                            <FeedCard id={id} {...feed} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Waiting>
                    </main>
                </Waiting>
            </PageContainer>

            {/* 分页控制 - 与文章列表页面保持一致 */}
            {paginatedFeeds.length > 0 && totalPages > 1 && (
                <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 md:px-8 transition-all duration-300">
                    <div className="flex justify-center mt-6 w-full">
                        <Pagination
                            currentPage={page}
                            totalPages={totalPages}
                            basePath={`/hashtag/${encodeURIComponent(name)}`}
                            className="gap-2"
                        />
                    </div>
                </div>
            )}
        </>
    )
}

// 热门标签推荐组件
function HotTagsRecommend() {
  const { t } = useTranslation();

  // 使用缓存Hook替代直接API调用
  const { data: allTags } = useTagsCache();
  const tags = React.useMemo(() => {
    if (!allTags) return [];
    return allTags.sort((a, b) => b.feeds - a.feeds).slice(0, 8);
  }, [allTags]);

  if (!tags.length) return null;
  return (
    <div className="mt-4 flex flex-row flex-wrap gap-2 items-center justify-center">
      <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">{t('hashtagDetail.hotTags')}:</span>
      {tags.map(tag => (
        <Link key={tag.name} href={`/hashtag/${tag.name}`} className="inline-block">
          <HashTag name={tag.name} />
        </Link>
      ))}
    </div>
  );
}
