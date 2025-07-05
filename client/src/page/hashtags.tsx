import { useState } from "react";
import { Helmet } from 'react-helmet-async';
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { HashTag } from "../components/hashtag";
import { Waiting } from "../components/loading";
import { useTagsCache } from "../hooks/useQueries";
import { siteName } from "../utils/constants";
import React from "react";
import { PageContainer } from "../components/container";
import { useGlassEffect } from "../hooks/useGlassEffect";
import { UnifiedContainer } from "../components/UnifiedContainer";

// Hashtag类型由useTagsCache Hook提供

// 将排序选项移到组件内部，以便使用翻译函数

export function HashtagsPage() {
    const { t } = useTranslation();

    // 使用缓存Hook替代直接API调用
    const { data: hashtags, loading } = useTagsCache();

    const [sort, setSort] = useState<'count' | 'alpha'>('count');

    // 使用智能毛玻璃效果
    const tagGlassClass = useGlassEffect('tag-enhanced');

    // 排序选项（使用翻译）
    const SORT_OPTIONS = [
      { value: 'count', label: t('sort.by_count') },
      { value: 'alpha', label: t('sort.by_alpha') },
    ];

    // 排序逻辑
    const sortedTags = React.useMemo(() => {
      let arr = [...(hashtags || [])].filter(({ feeds }) => feeds > 0);
      if (sort === 'count') {
        arr.sort((a, b) => b.feeds - a.feeds);
      } else {
        arr.sort((a, b) => a.name.localeCompare(b.name));
      }
      return arr;
    }, [hashtags, sort]);

    // 标签字号动态（文章数越多越大）
    const getFontSize = (count: number) => {
      if (count > 30) return 'text-2xl sm:text-3xl';
      if (count > 15) return 'text-xl sm:text-2xl';
      if (count > 5) return 'text-lg sm:text-xl';
      return 'text-base sm:text-lg';
    };

    return (
        <>
            <Helmet>
                <title>{`${t('hashtags')} - ${process.env.NAME}`}</title>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={t('hashtags')} />
                <meta property="og:image" content={process.env.AVATAR} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={document.URL} />
                <meta name="description" content={`${t('hashtags')}：${t('hashtagsPage.description', { count: hashtags?.length || 0, topTags: hashtags?.slice(0, 5).map(tag => tag.name).join('、') || '' })}`} />
            </Helmet>
            <PageContainer maxWidth="max-w-6xl" className="w-full">
                <Waiting for={hashtags || !loading}>
                    <main className="w-full flex flex-col ani-show">
                        {/* 页面标题区域 - 优化间距 */}
                        <div className="flex flex-col space-y-2.5 mb-4">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-1.5 sm:py-2 gap-2.5 sm:gap-3">
                            {/* 左侧：标题和标签数量 - 优化移动端布局 */}
                            <div className="flex flex-row items-center gap-2 sm:gap-2.5 w-full sm:w-auto flex-wrap">
                              <h1 className="text-2xl font-bold text-gray-800 dark:text-white relative group flex-shrink-0">
                                {t('hashtags')}
                                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-theme group-hover:w-full transition-all duration-300"></span>
                              </h1>
                              <div className={`py-1.5 px-2.5 sm:px-3 ${tagGlassClass} rounded-lg text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 flex items-center font-medium border border-neutral-200/60 dark:border-neutral-700/60 flex-shrink-0`}>
                                <i className="ri-hashtag text-theme text-xs sm:text-sm"></i>
                                <span className="ml-1 sm:ml-1.5">{t('article.total$count', { count: hashtags?.length || 0 })}</span>
                              </div>
                            </div>
                          </div>

                          {/* 上方渐变分割线 */}
                          <div className="w-full">
                            <hr className="h-0.5 border-0 bg-gradient-to-r from-transparent via-theme/40 dark:via-theme/30 to-transparent" />
                          </div>
                        </div>


                        {/* 标签云容器 - 使用统一容器高度系统 */}
                        <UnifiedContainer
                          heightType="responsive"
                          layoutType="with-header"
                          disablePadding={true}
                          className="hover:shadow-enhanced-lg transition-all duration-300"
                          title={
                            <div className="flex flex-row justify-between items-center gap-2 md:gap-4">
                              {/* 左侧：标题区域 */}
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <div className="px-2.5 py-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                  <i className="ri-hashtag text-blue-600 dark:text-blue-400 text-sm"></i>
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                  {t('hashtags')}
                                </h3>
                              </div>

                              {/* 右侧：排序切换区域 */}
                              <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap flex-shrink-0">
                                <span className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 font-medium flex-shrink-0">{t('sort.label')}:</span>
                                {SORT_OPTIONS.map(opt => (
                                  <button
                                    key={opt.value}
                                    className={`px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 ease-out transform hover:scale-[0.98] active:scale-[0.96] flex-shrink-0 ${sort === opt.value ? 'bg-theme/10 text-theme border-theme/30 dark:bg-theme/20 dark:border-theme/25 shadow-enhanced backdrop-blur-sm' : `${tagGlassClass} text-neutral-600 dark:text-neutral-300 border-neutral-200/60 dark:border-neutral-700/60 hover:bg-neutral-50 dark:hover:bg-neutral-750 hover:text-theme dark:hover:text-theme shadow-enhanced`}`}
                                    onClick={() => setSort(opt.value as any)}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          }
                          enableScroll={true}
                        >
                          <div className="px-2 sm:px-3 md:px-4 pt-3 sm:pt-4">
                            {sortedTags.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-neutral-400 dark:text-neutral-500">
                              <i className="ri-emotion-unhappy-line text-5xl mb-3 text-neutral-300 dark:text-neutral-600"></i>
                              <div className="text-lg font-medium">{t('hashtagsPage.noTags')}</div>
                            </div>
                          ) : (
                            <div className="w-full flex flex-row flex-wrap gap-1.5 sm:gap-2 md:gap-2.5 lg:gap-3 items-start justify-start">
                              {sortedTags.map((hashtag, index) => (
                                <div key={index} className="relative group flex flex-col items-center min-w-[75px] sm:min-w-[80px] md:min-w-[85px] max-w-full">
                                  <Link href={`/hashtag/${hashtag.name}`} className="inline-block w-full">
                                    <span className={`transition-all duration-200 ${getFontSize(hashtag.feeds)} break-all w-full text-center`} title={hashtag.description || ''} style={{display: 'inline-block', minWidth: 0, maxWidth: '100%'}}>
                                      <HashTag name={hashtag.name} />
                                    </span>
                                  </Link>
                                  <span className="text-xs text-neutral-400 dark:text-neutral-500 mt-1.5 select-none w-full text-center font-medium">{t("article.total_short$count", { count: hashtag.feeds })}</span>
                                  {/* 简介tooltip - 优化显示位置和样式 */}
                                  {hashtag.description && (
                                    <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-20 hidden group-hover:block bg-neutral-900/95 dark:bg-neutral-100/95 text-white dark:text-neutral-900 text-xs rounded-lg px-2.5 py-1.5 shadow-enhanced-lg whitespace-pre-line max-w-xs backdrop-blur-md">
                                      {hashtag.description}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          </div>
                        </UnifiedContainer>


                    </main>
                </Waiting>
            </PageContainer>
        </>
    )
}