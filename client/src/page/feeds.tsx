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
import { useLocation } from 'react-router-dom';

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
    const [, setLocation] = useLocation(); // 确保 useLocation 已引入和使用

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
        const typeFromUrl = query.get("type") as FeedType || 'normal'
        // _setListState(typeFromUrl); // listState 将由 URL 驱动，在此处直接使用 typeFromUrl
        if (typeFromUrl !== listState) { // 只有当 URL 的 type 和当前 listState 不同时才更新 listState
            _setListState(typeFromUrl);
        }
        setStatus('loading')
        fetchFeeds(typeFromUrl) // 始终基于 URL 的 type 来获取数据
        ref.current = key
    }, [query.get("page"), query.get("type"), fetchFeeds]); // 移除 listState 从依赖项，因为它由 query.get("type") 驱动

    const { isLoading, isFetching, isError, data, error: queryError } = useQuery( // 重命名 error 防止与外部作用域冲突
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
                {/* 根据当前筛选状态动态更新标题 */}
                <meta property="og:title" content={
                    listState === 'draft' ? t('draft_bin') : 
                    listState === 'unlisted' ? t('unlisted') : 
                    t('article.title')
                } />
                <meta property="og:image" content={process.env.AVATAR} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={document.URL} />
            </Helmet>
            <Waiting for={feeds.draft.size + feeds.normal.size + feeds.unlisted.size > 0 || status === 'idle'}>
                <main className="w-full flex flex-col justify-center items-center mb-12 px-3 sm:px-4 md:px-6">
                    <div className="w-full max-w-6xl">
                        {/* 新的页面头部布局 */}
                        <div className="my-6 sm:my-8 space-y-5 sm:space-y-6">
                            {/* 顶部区域: 页面标题和新建文章按钮 */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                                    {t('article.title')} {/* 主标题固定为 "文章" */}
                                </h1>
                                {profile?.permission && (
                                    <Link
                                        href="/writing/new"
                                        className="shrink-0 w-full sm:w-auto px-4 py-2.5 sm:px-5 sm:py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 flex items-center justify-center shadow-md bg-gradient-to-r from-theme to-theme-dark text-white hover:shadow-lg hover:from-theme-hover hover:to-theme-dark-hover active:scale-95 focus:outline-none focus:ring-2 focus:ring-theme-dark focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                                    >
                                        <i className="ri-add-circle-line text-lg mr-2"></i>
                                        <span>{t('new_article')}</span>
                                    </Link>
                                )}
                            </div>

                            {/* 中部区域: 筛选器和当前视图文章统计 */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                                <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl shadow-sm">
                                    {[
                                        { type: 'normal', labelKey: 'article.all_articles', icon: 'ri-layout-grid-fill' },
                                        { type: 'draft', labelKey: 'draft_bin', icon: 'ri-draft-fill' },
                                        { type: 'unlisted', labelKey: 'unlisted', icon: 'ri-eye-off-fill' }
                                    ].map(filter => (
                                        (profile?.permission || filter.type === 'normal') ? (
                                            <button
                                                key={filter.type}
                                                onClick={() => {
                                                    const newType = filter.type as FeedType;
                                                    const currentQuery = new URLSearchParams(query.toString());
                                                    currentQuery.set("type", newType);
                                                    currentQuery.set("page", "1"); 
                                                    setLocation(`/?${currentQuery.toString()}`);
                                                }}
                                                title={t(filter.labelKey)}
                                                className={`px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 flex items-center space-x-1.5 whitespace-nowrap
                                                            ${listState === filter.type
                                                                ? 'bg-white dark:bg-gray-700 text-theme dark:text-theme-light shadow'
                                                                : 'text-gray-600 dark:text-gray-400 hover:bg-white/70 dark:hover:bg-gray-700/70 hover:text-gray-800 dark:hover:text-gray-100'
                                                            }`}
                                            >
                                                <i className={`${filter.icon} text-sm sm:text-base`}></i>
                                                <span className="hidden xs:inline">{t(filter.labelKey)}</span>
                                            </button>
                                        ) : null
                                    ))}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400 pt-1 sm:pt-0 sm:self-center">
                                    {t('article.total_in_current_view$count', { count: feeds[listState]?.size || 0 })}
                                </div>
                            </div>
                        </div>
                        
                        {/* 草稿箱/未列出状态的描述信息 */}
                        { (listState === 'draft' || listState === 'unlisted') && profile?.permission && (
                            <div className="mb-6 text-xs sm:text-sm text-yellow-700 dark:text-yellow-300 italic px-3.5 py-2.5 bg-yellow-50 dark:bg-yellow-900/40 border-l-4 border-yellow-400 dark:border-yellow-500 rounded-r-md shadow-sm">
                                {listState === 'draft' ? t('draft_description') : t('unlisted_description')}
                            </div>
                        )}

                        {/* 分隔线 */}
                        <div className="w-full mb-6 sm:mb-8">
                            <hr className="h-px border-0 bg-gradient-to-r from-transparent via-gray-300/50 dark:via-gray-700/40 to-transparent" />
                        </div>
                        
                        {/* 文章列表区域 */}
                        <Waiting for={status === 'idle'}>
                            {feeds[listState]?.data?.length > 0 ? (
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 w-full">
                                        {feeds[listState].data.map((feed, i) => (
                                            <LazyFeedCard key={`feed-card-${feed.id}-${i}`} {...feed} top={feed.top ?? 0} />
                                        ))}
                                    </div>
                                    
                                    {/* 分页控制 - 改进视觉样式和交互 */}
                                    <div className="flex justify-center mt-10 mb-4 w-full">
                                        <Pagination
                                            currentPage={page}
                                            totalPages={Math.ceil(feeds[listState].size / limit)}
                                            basePath={`/?type=${listState}`}
                                            className="gap-2"
                                        />
                                    </div>
                                    
                                    {/* 底部分隔线 */}
                                    <div className="w-full mb-8">
                                        <hr className="h-px border-0 bg-gradient-to-r from-transparent via-theme/40 dark:via-theme/30 to-transparent shadow-sm" />
                                    </div>
                                </>
                            ) : status === 'loading' ? (
                                // 加载状态显示骨架屏
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
                                // 空状态 - 添加创建文章按钮
                                <div className="w-full py-16 sm:py-24 flex flex-col items-center justify-center text-center space-y-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                                    <div className="text-5xl text-gray-300 dark:text-gray-600">
                                        <i className="ri-inbox-2-line"></i>
                                    </div>
                                    <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-300">{t('empty_list')}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
                                        {listState === 'draft' 
                                            ? t('empty_draft_description') 
                                            : listState === 'unlisted' 
                                                ? t('empty_unlisted_description')
                                                : t('empty_article_description')
                                        }
                                    </p>
                                    {profile?.permission && (listState === 'draft' || listState === 'unlisted' || feeds[listState]?.data?.length === 0) && (
                                        <Link href="/writing/new" className="mt-4 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 flex items-center justify-center shadow-md bg-gradient-to-r from-theme to-theme-dark text-white hover:shadow-lg hover:from-theme-hover hover:to-theme-dark-hover active:scale-95">
                                            <i className="ri-add-circle-line text-lg mr-2"></i>
                                            {t(feeds[listState]?.data?.length === 0 && listState === 'normal' ? 'create_first_article' : 'create_now')}
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
