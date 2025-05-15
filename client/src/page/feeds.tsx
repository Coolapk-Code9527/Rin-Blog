import React, { useState, useRef, useEffect, useContext, useCallback } from "react"
import { Helmet } from 'react-helmet'
import { Link, useLocation } from "wouter"
import { FeedCard } from "../components/feed_card"
import { Waiting } from "../components/loading"
import { Pagination } from "../components/pagination"
import { client } from "../main"
import { ProfileContext } from "../state/profile"
import { headersWithAuth } from "../utils/auth"
import { siteName } from "../utils/constants"
import { tryInt } from "../utils/int"
import { useTranslation } from "react-i18next";

// 创建自定义useSearch hook以兼容wouter的最新版本
const useSearch = () => {
    const [location] = useLocation();
    // 获取?后面的所有内容，如果没有?则返回空字符串
    return location.includes('?') ? location.split('?')[1] : '';
};

// 懒加载Feed卡片组件
function LazyFeedCard({ id, ...props }: any) {
    const [isVisible, setIsVisible] = React.useState(false);
    const cardRef = React.useRef<HTMLDivElement>(null);
    const { t } = useTranslation();
    
    // 为占位符生成渐变背景
    const generatePlaceholderGradient = () => {
        // 使用ID保持一致的随机颜色
        const getHashCode = (str: string) => {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = ((hash << 5) - hash) + str.charCodeAt(i);
                hash = hash & hash; // 转换为32位整数
            }
            return Math.abs(hash);
        };
        
        const gradients = [
            'from-blue-100 to-purple-200 dark:from-blue-900/40 dark:to-purple-900/40',
            'from-green-100 to-blue-200 dark:from-green-900/40 dark:to-blue-900/40',
            'from-purple-100 to-pink-200 dark:from-purple-900/40 dark:to-pink-900/40',
            'from-yellow-100 to-red-200 dark:from-yellow-900/40 dark:to-red-900/40',
            'from-pink-100 to-rose-200 dark:from-pink-900/40 dark:to-rose-900/40',
            'from-indigo-100 to-blue-200 dark:from-indigo-900/40 dark:to-blue-900/40'
        ];
        
        const hash = getHashCode(id);
        return gradients[hash % gradients.length];
    };
    
    const placeholderGradient = generatePlaceholderGradient();

    React.useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.1, rootMargin: '200px 0px' }
        );

        if (cardRef.current) {
            observer.observe(cardRef.current);
        }

        return () => {
            observer.disconnect();
        };
    }, []);

    return (
        <div ref={cardRef} className="w-full h-full">
            {isVisible ? (
                <FeedCard id={id} {...props} />
            ) : (
                <div className="block w-full rounded-2xl bg-white dark:bg-gray-800 h-full overflow-hidden border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col min-h-[260px] xs:min-h-[280px] transition-all">
                    {/* 占位符卡片顶部 */}
                    <div className={`w-full h-44 xs:h-52 sm:h-56 md:h-60 overflow-hidden rounded-t-xl relative bg-gradient-to-r ${placeholderGradient} animate-pulse`}>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-10 h-10 rounded-full bg-white/20 dark:bg-gray-700/30 flex items-center justify-center backdrop-blur-sm">
                                <i className="ri-image-line text-white/50 dark:text-gray-500/70 text-xl"></i>
                            </div>
                        </div>
                    </div>
                    
                    {/* 占位符卡片内容区域 */}
                    <div className="p-4 sm:p-5 flex-1 flex flex-col">
                        {/* 标题占位 */}
                        <div className="h-6 sm:h-7 bg-gray-200 dark:bg-gray-700 rounded-md w-3/4 mb-2 animate-pulse"></div>
                        <div className="h-4 sm:h-5 bg-gray-200 dark:bg-gray-700 rounded-md w-1/2 mb-4 animate-pulse"></div>
                        
                        {/* 日期和状态占位 */}
                        <div className="flex justify-between mb-3">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-md w-1/4 animate-pulse"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-md w-1/5 animate-pulse"></div>
                        </div>
                        
                        {/* 摘要占位 */}
                        <div className="space-y-2 mb-4 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-md">
                            <div className="h-3 bg-gray-200 dark:bg-gray-700/70 rounded w-full animate-pulse"></div>
                            <div className="h-3 bg-gray-200 dark:bg-gray-700/70 rounded w-full animate-pulse"></div>
                            <div className="h-3 bg-gray-200 dark:bg-gray-700/70 rounded w-4/5 animate-pulse"></div>
                        </div>
                        
                        {/* 标签占位 */}
                        <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-700/30">
                            <div className="flex gap-2">
                                <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700/70 rounded-full animate-pulse"></div>
                                <div className="h-6 w-10 bg-gray-200 dark:bg-gray-700/70 rounded-full animate-pulse"></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

type FeedsData = {
    size: number,
    data: any[],
    hasNext: boolean
}

type FeedType = 'draft' | 'unlisted' | 'normal'

type FeedsMap = {
    [key in FeedType]: FeedsData
}

export function FeedsPage() {
    const { t } = useTranslation()
    const query = new URLSearchParams(useSearch());
    const profile = React.useContext(ProfileContext);
    const [listState, _setListState] = React.useState<FeedType>(query.get("type") as FeedType || 'normal')
    const [_, setLocation] = useLocation();
    const [status, setStatus] = React.useState<'loading' | 'idle'>('idle')
    const [feeds, setFeeds] = React.useState<FeedsMap>({
        draft: { size: 0, data: [], hasNext: false },
        unlisted: { size: 0, data: [], hasNext: false },
        normal: { size: 0, data: [], hasNext: false }
    })
    const page = tryInt(1, query.get("page"))
    const limit = tryInt(10, query.get("limit"), process.env.PAGE_SIZE)
    const ref = React.useRef("")
    
    // 使用useCallback优化函数
    const fetchFeeds = React.useCallback((type: FeedType) => {
        client.feed.index.get({
            query: {
                page: page,
                limit: limit,
                type: type
            },
            headers: headersWithAuth()
        }).then(({ data }) => {
            if (data && typeof data !== 'string') {
                setFeeds({
                    ...feeds,
                    [type]: data
                })
                
                // 预加载下一页数据
                if (data.hasNext) {
                    setTimeout(() => {
                        client.feed.index.get({
                            query: {
                                page: page + 1,
                                limit: limit,
                                type: type
                            },
                            headers: headersWithAuth()
                        });
                    }, 2000);
                }
                
                setStatus('idle')
            }
        })
    }, [page, limit, feeds]);
    
    React.useEffect(() => {
        const key = `${query.get("page")} ${query.get("type")}`
        if (ref.current == key) return
        const type = query.get("type") as FeedType || 'normal'
        if (type !== listState) {
            _setListState(type)
        }
        setStatus('loading')
        fetchFeeds(type)
        ref.current = key
    }, [query.get("page"), query.get("type"), fetchFeeds])
    
    return (
        <>
            <Helmet>
                <title>{`${t('article.title')} - ${process.env.NAME}`}</title>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={t('article.title')} />
                <meta property="og:image" content={process.env.AVATAR} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={document.URL} />
            </Helmet>
            <Waiting for={feeds.draft.size + feeds.normal.size + feeds.unlisted.size > 0 || status === 'idle'}>
                <main className="w-full flex flex-col justify-center items-center mb-12 px-4 sm:px-6">
                    <div className="wauto w-full max-w-6xl">
                        <div className="flex flex-col space-y-4 mb-8">
                            <div className="flex items-center justify-between py-4 sm:py-6 border-b border-gray-200/50 dark:border-gray-700/50">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4">
                                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white relative group">
                            {listState === 'draft' ? t('draft_bin') : listState === 'normal' ? t('article.title') : t('unlisted')}
                                        <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-theme group-hover:w-full transition-all duration-300"></span>
                                    </h1>
                                    <div className="px-2 py-1 mt-1 sm:mt-0 sm:px-3 sm:py-1.5 bg-gray-100 dark:bg-gray-800/80 rounded-full text-xs text-gray-500 dark:text-gray-400 flex items-center font-medium backdrop-blur-sm self-start sm:self-auto">
                                        <i className="ri-article-line mr-1.5"></i>
                                {t('article.total$count', { count: feeds[listState]?.size })}
                                    </div>
                                </div>
                                
                            {profile?.permission &&
                                    <div className="flex flex-row space-x-2 sm:space-x-3 items-center">
                                        <a 
                                            href={`/?type=${listState === 'draft' ? 'normal' : 'draft'}`}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setLocation(`/?type=${listState === 'draft' ? 'normal' : 'draft'}`);
                                            }}
                                            className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 flex items-center ${listState === 'draft' 
                                            ? "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 ring-1 ring-amber-500/30 hover:bg-amber-100 dark:hover:bg-amber-800/30" 
                                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"}`}>
                                            <i className="ri-draft-line mr-1 sm:mr-1.5"></i>
                                            <span className="hidden xs:inline">{t('draft_bin')}</span>
                                        </a>
                                        <a 
                                            href={`/?type=${listState === 'unlisted' ? 'normal' : 'unlisted'}`}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setLocation(`/?type=${listState === 'unlisted' ? 'normal' : 'unlisted'}`);
                                            }}
                                            className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 flex items-center ${listState === 'unlisted' 
                                            ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 ring-1 ring-indigo-500/30 hover:bg-indigo-100 dark:hover:bg-indigo-800/30" 
                                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"}`}>
                                            <i className="ri-eye-off-line mr-1 sm:mr-1.5"></i>
                                            <span className="hidden xs:inline">{t('unlisted')}</span>
                                        </a>
                                    </div>
                                }
                            </div>
                            
                            <div className="flex justify-between items-center -mt-2 sm:mt-0">
                                {/* 移除文章描述区域 */}
                            </div>
                        </div>
                        
                        <Waiting for={status === 'idle'}>
                            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-6 md:gap-7 ani-show w-full ${feeds[listState].data.length === 0 ? '' : 'mb-8'}`}>
                                {feeds[listState].data.length > 0 ? (
                                    feeds[listState].data.map(({ id, ...feed }: any) => (
                                        <LazyFeedCard key={id} id={id} {...feed} />
                                    ))
                                ) : (
                                    <div className="col-span-full text-center py-20 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/20 rounded-2xl border border-gray-100 dark:border-gray-800">
                                        <i className="ri-inbox-line text-5xl mb-4 block opacity-50"></i>
                                        <p className="text-lg">{t('no_articles')}</p>
                                        <p className="text-sm mt-2 text-gray-400 dark:text-gray-500">{t('no_articles_description')}</p>
                                    </div>
                                )}
                            </div>
                            
                            {/* 加载更多状态 */}
                            {status === 'loading' && feeds[listState].data.length > 0 && (
                                <div className="w-full flex justify-center py-8">
                                    <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
                                        <div className="w-5 h-5 border-2 border-theme border-t-transparent rounded-full animate-spin"></div>
                                        <span className="text-sm">{t('loading_more') || '加载更多...'}</span>
                                    </div>
                                </div>
                            )}
                            
                            {(page > 1 || feeds[listState]?.hasNext) && feeds[listState].data.length > 0 && (
                            <Pagination 
                                currentPage={page}
                                totalPages={Math.ceil(feeds[listState]?.size / limit) || 1}
                                basePath={`/?type=${listState}`}
                                className="ani-show"
                            />
                        )}
                    </Waiting>
                    </div>
                </main>
            </Waiting>
        </>
    )
}
