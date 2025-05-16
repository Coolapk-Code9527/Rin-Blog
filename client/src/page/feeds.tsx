import React from "react"
import { Helmet } from 'react-helmet'
import { Link, useSearch } from "wouter"
import { FeedCard } from "../components/feed_card"
import { Waiting } from "../components/loading"
import { Pagination } from "../components/pagination"
import { client } from "../main"
import { ProfileContext } from "../state/profile"
import { headersWithAuth } from "../utils/auth"
import { siteName } from "../utils/constants"
import { tryInt } from "../utils/int"
import { useTranslation } from "react-i18next";
import { useEffect, useState, useContext } from 'react';
import { useHydrated } from 'react-hydrated';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { Helmet as HelmetAsync } from 'react-helmet-async';
import { LazyFeedCard } from '../components/feed_card';
import { FeedsPageSkeleton } from '../components/skeleton';
import { ThemeContext } from '../state/theme.context';
import usePageVisibility from '../hooks/use_page_visibility';

type FeedsData = {
    size: number,
    data: any[],
    hasNext: boolean
}

type FeedType = 'draft' | 'unlisted' | 'normal'

type FeedsMap = {
    [key in FeedType]: FeedsData
}

// 懒加载Feed卡片组件
function LazyFeedCard({ id, ...props }: any) {
    const [isVisible, setIsVisible] = React.useState(false);
    const [isIntersecting, setIsIntersecting] = React.useState(false); // 新增状态跟踪元素是否在视口内
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
                setIsIntersecting(entry.isIntersecting); // 更新元素是否在视口内的状态
                if (entry.isIntersecting) {
                    // 当元素进入视口时，设置一个短暂延迟后显示实际内容，以便平滑过渡
                    const timer = setTimeout(() => {
                    setIsVisible(true);
                    observer.disconnect();
                    }, 150); // 添加一个短暂延迟以实现错落有致的加载效果
                    return () => clearTimeout(timer);
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
                <div className={`block w-full rounded-2xl bg-white dark:bg-gray-800 h-full overflow-hidden border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col min-h-[260px] xs:min-h-[280px] transition-opacity duration-300 ${isIntersecting ? 'opacity-100' : 'opacity-40'}`}>
                    {/* 占位符卡片顶部 */}
                    <div className={`w-full h-40 xs:h-48 overflow-hidden rounded-t-xl relative bg-gradient-to-r ${placeholderGradient} animate-pulse`}>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-10 h-10 rounded-full bg-white/20 dark:bg-gray-700/30 flex items-center justify-center">
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
                        <div className="space-y-2 mb-4">
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

export function FeedsPage() {
    const { t } = useTranslation()
    const query = new URLSearchParams(useSearch());
    const profile = React.useContext(ProfileContext);
    const [listState, _setListState] = React.useState<FeedType>(query.get("type") as FeedType || 'normal')
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
    
    const { isLoading, isFetching, isError, data, error } = useQuery(
        ['feeds', page, listState],
        () => fetchFeeds(listState),
        {
            keepPreviousData: true,
            refetchOnWindowFocus: true,
            staleTime: 1000 * 60 * 5, // 5分钟内不重新获取
            onError: () => {
                setStatus('error');
            },
        }
    );

    // 标记是否为首次加载，用于显示骨架屏
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    
    // 首次加载完成后，关闭骨架屏
    useEffect(() => {
        if (status !== 'loading' && isInitialLoading) {
            // 延迟300ms关闭骨架屏，让UI切换更顺滑
            const timer = setTimeout(() => {
                setIsInitialLoading(false);
            }, 300);
            
            return () => clearTimeout(timer);
        }
    }, [status, isInitialLoading]);

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
                    <div className="w-auto w-full max-w-6xl">
                        {/* Bento风格的文章页头部设计 */}
                        <div className="bento-header mb-8 pt-8 pb-4">
                            {/* 标题和统计信息区 */}
                            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
                                {/* 左侧标题区 */}
                                <div className="flex flex-col">
                                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2 relative inline-block">
                                        {listState === 'draft' ? t('draft_bin') : listState === 'normal' ? t('article.title') : t('unlisted')}
                                        <div className="absolute -bottom-1 left-0 h-1 w-24 bg-gradient-to-r from-theme to-theme-dark rounded-full"></div>
                                    </h1>
                                    
                                    {/* 类型说明文字，有条件显示 */}
                                    {(listState === 'draft' || listState === 'unlisted') && (
                                        <div className="mt-3 text-sm text-gray-600 dark:text-gray-400 italic px-4 py-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-l-2 border-theme">
                                            {listState === 'draft' 
                                                ? t('draft_description') 
                                                : t('unlisted_description')
                                            }
                                        </div>
                                    )}
                                </div>
                                
                                {/* 右侧文章统计信息 */}
                                <div className="flex items-center justify-start lg:justify-end">
                                    <div className="flex items-center rounded-full px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium shadow-sm">
                                        <span className="flex items-center justify-center w-8 h-8 bg-white dark:bg-gray-700 rounded-full shadow-sm mr-3">
                                            <i className="ri-article-line text-theme"></i>
                                        </span>
                                        <span>{t('article.total$count', { count: feeds[listState]?.size })}</span>
                                    </div>
                                </div>
                            </div>
                            
                            {/* 操作按钮区 */}
                            {profile?.permission && (
                                <div className="bento-actions grid grid-cols-1 sm:grid-cols-12 gap-4">
                                    {/* 新建文章按钮 */}
                                    <div className="sm:col-span-4">
                                        <Link href="/writing/new"
                                            className="group w-full relative overflow-hidden px-4 py-3 rounded-xl flex items-center justify-center transition-all duration-300 bg-gradient-to-r from-theme to-theme-dark text-white shadow-md hover:shadow-lg hover:scale-[1.02]">
                                            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                                            <i className="ri-add-line mr-2 text-lg"></i>
                                            <span className="font-medium">{t('new_article')}</span>
                                        </Link>
                                    </div>
                                    
                                    {/* 内容分类按钮组 */}
                                    <div className="sm:col-span-8">
                                        <div className="flex rounded-xl overflow-hidden shadow-md h-full border border-gray-100 dark:border-gray-700">
                                            <Link href={listState === 'normal' ? '/' : '/?type=normal'} 
                                                className={`flex-1 flex items-center justify-center px-4 py-3 transition-colors duration-300 ${
                                                    listState === 'normal' 
                                                    ? "bg-gray-50 dark:bg-gray-800/80 text-theme border-b-2 border-theme" 
                                                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750"
                                                }`}>
                                                <i className="ri-file-list-line mr-2 text-lg"></i>
                                                <span className="font-medium">{t('article.title')}</span>
                                            </Link>
                                            
                                            <Link href={listState === 'draft' ? '/' : '/?type=draft'} 
                                                className={`flex-1 flex items-center justify-center px-4 py-3 transition-colors duration-300 ${
                                                    listState === 'draft' 
                                                    ? "bg-gray-50 dark:bg-gray-800/80 text-theme border-b-2 border-theme" 
                                                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750"
                                                }`}>
                                                <i className="ri-draft-line mr-2 text-lg"></i>
                                                <span className="font-medium">{t('draft_bin')}</span>
                                            </Link>
                                            
                                            <Link href={listState === 'unlisted' ? '/' : '/?type=unlisted'} 
                                                className={`flex-1 flex items-center justify-center px-4 py-3 transition-colors duration-300 ${
                                                    listState === 'unlisted' 
                                                    ? "bg-gray-50 dark:bg-gray-800/80 text-theme border-b-2 border-theme" 
                                                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750"
                                                }`}>
                                                <i className="ri-eye-off-line mr-2 text-lg"></i>
                                                <span className="font-medium">{t('unlisted')}</span>
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {/* 渐变分割线 */}
                        <div className="w-full h-[2px] mb-8 bg-gradient-to-r from-gray-100 dark:from-gray-800 via-theme-light/40 dark:via-theme-dark/40 to-gray-100 dark:to-gray-800 shadow-sm"></div>
                        
                        <Waiting for={status === 'idle'}>
                            {feeds[listState]?.data?.length > 0 ? (
                                <>
                                    {/* 文章卡片网格 */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 w-full">
                                        {feeds[listState].data.map((feed, i) => (
                                            <LazyFeedCard key={`feed-card-${feed.id}-${i}`} {...feed} />
                                        ))}
                                    </div>
                                    
                                    {/* 分页控制区 */}
                                    <div className="flex justify-center mt-10 mb-4 w-full">
                                        <Pagination
                                            currentPage={page}
                                            totalPages={Math.ceil(feeds[listState].size / limit)}
                                            basePath={`/?type=${listState}`}
                                            className="gap-2"
                                        />
                                    </div>
                                    
                                    {/* 底部分隔线 */}
                                    <div className="w-full mb-8 mt-8">
                                        <div className="h-[2px] bg-gradient-to-r from-gray-100 dark:from-gray-800 via-theme-light/40 dark:via-theme-dark/40 to-gray-100 dark:to-gray-800 shadow-sm"></div>
                                    </div>
                                </>
                            ) : status === 'loading' ? (
                                // 加载骨架屏
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 w-full">
                                    {Array(6).fill(0).map((_, i) => (
                                        <div key={`skeleton-${i}`} className="block w-full rounded-2xl bg-white dark:bg-gray-800 h-full overflow-hidden border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col min-h-[260px] xs:min-h-[280px]">
                                            {/* 骨架屏卡片顶部 */}
                                            <div className="w-full h-40 xs:h-48 overflow-hidden rounded-t-xl relative bg-gray-200 dark:bg-gray-700 animate-pulse">
                                            </div>
                                            
                                            {/* 骨架屏卡片内容区域 */}
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
                                                <div className="space-y-2 mb-4">
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
                                    ))}
                                </div>
                            ) : (
                                // 空状态设计
                                <div className="w-full py-16 sm:py-24 flex flex-col items-center justify-center text-center space-y-6 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                                    <div className="w-20 h-20 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500">
                                        <i className="ri-inbox-2-line text-4xl"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('empty_list')}</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                                            {listState === 'draft' 
                                                ? t('empty_draft_description') 
                                                : listState === 'unlisted' 
                                                    ? t('empty_unlisted_description')
                                                    : t('empty_article_description')
                                            }
                                        </p>
                                    </div>
                                    {profile?.permission && (
                                        <Link href="/writing/new" className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 bg-theme text-white hover:bg-theme-dark shadow-sm hover:shadow-md hover:scale-105">
                                            <i className="ri-add-line mr-2"></i>
                                            {t('create_now')}
                                        </Link>
                                    )}
                                </div>
                            )}
                        </Waiting>
                    </div>
                </main>
            </Waiting>
        </>
    )
}
