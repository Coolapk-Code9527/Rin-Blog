import { useEffect, useRef, useState } from "react";
import { Helmet } from 'react-helmet-async';
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { HashTag } from "../components/hashtag";
import { Waiting } from "../components/loading";
import { client } from "../main";
import { siteName } from "../utils/constants";
import React from "react";
import { PageContainer } from "../components/container";

import type { Hashtag } from "../types/api";

const SORT_OPTIONS = [
  { value: 'count', label: '按文章数' },
  { value: 'alpha', label: '按字母' },
];

export function HashtagsPage() {
    const { t } = useTranslation();
    const [hashtags, setHashtags] = useState<Hashtag[]>([]);
    const [sort, setSort] = useState<'count' | 'alpha'>('count');
    const ref = useRef(false);
    useEffect(() => {
        if (ref.current) return;
        client.tag.index.get().then(({ data }) => {
            if (data && typeof data !== 'string') {
                setHashtags(data);
            }
        });
        ref.current = true;
    }, [])

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
                <meta name="description" content={`${t('hashtags')}：共${hashtags.length}个标签，热门标签：${hashtags.slice(0, 5).map(tag => tag.name).join('、')}`} />
            </Helmet>
            <PageContainer maxWidth="max-w-6xl" className="w-full">
                <Waiting for={hashtags}>
                    <main className="w-full flex flex-col justify-center items-center mb-3 ani-show">
                        <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between py-4 gap-2 sm:gap-3">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <h1 className="text-2xl font-bold text-gray-800 dark:text-white relative group">
                              {t('hashtags')}
                              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-theme group-hover:w-full transition-all duration-300"></span>
                            </h1>
                            <div className="py-1 sm:px-2.5 sm:py-1 bg-gray-100 dark:bg-gray-800/80 rounded-full text-base text-gray-500 dark:text-gray-400 flex items-center font-medium backdrop-blur-sm">
                              <i className="ri-hashtag mr-1"></i>
                              {t('article.total$count', { count: hashtags.length })}
                            </div>
                          </div>
                        </div>
                        {/* 渐变分割线 */}
                        <div className="w-full mb-2">
                          <hr className="h-px border-0 bg-gradient-to-r from-transparent via-theme/40 dark:via-theme/30 to-transparent" />
                        </div>
                        {/* 排序切换 */}
                        <div className="mb-4 flex gap-2 items-center w-full">
                          <span className="text-sm text-gray-500 dark:text-gray-400">{t('排序')}:</span>
                          {SORT_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all duration-200 ${sort === opt.value ? 'bg-theme/10 text-theme border-theme/30 dark:bg-theme/20 dark:border-theme/20' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 hover:text-theme dark:hover:text-theme'}`}
                              onClick={() => setSort(opt.value as any)}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        {/* 标签云布局 */}
                        {sortedTags.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
                            <i className="ri-emotion-unhappy-line text-4xl mb-2"></i>
                            <div>{t('暂无标签')}</div>
                          </div>
                        ) : (
                          <div className="w-full flex flex-row flex-wrap gap-3 items-start justify-start md:justify-start sm:gap-3 gap-2 md:gap-4 lg:gap-5">
                            {sortedTags.map((hashtag, index) => (
                              <div key={index} className="relative group flex flex-col items-center min-w-[80px] max-w-full">
                                <Link href={`/hashtag/${hashtag.name}`} className="inline-block w-full">
                                  <span className={`transition-all duration-200 ${getFontSize(hashtag.feeds)} break-all w-full text-center`} title={hashtag.description || ''} style={{display: 'inline-block', minWidth: 0, maxWidth: '100%'}}>
                                    <HashTag name={hashtag.name} />
                                  </span>
                                </Link>
                                <span className="text-xs text-gray-400 mt-1 select-none w-full text-center">{t("article.total_short$count", { count: hashtag.feeds })}</span>
                                {/* 简介tooltip */}
                                {hashtag.description && (
                                  <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-20 hidden group-hover:block bg-gray-900 text-white text-xs rounded px-2 py-1 shadow-lg whitespace-pre-line max-w-xs">
                                    {hashtag.description}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                    </main>
                </Waiting>
            </PageContainer>
        </>
    )
}