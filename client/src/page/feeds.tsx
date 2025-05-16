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
    
    // 临时添加缺失的本地化翻译键
    const localizedTexts = {
        'draft_description_short': '草稿模式，仅自己可见',
        'article_description_short': '已发布的文章',
        'unlisted_description_short': '未公开显示的文章',
        'draft_bin_short': '草稿箱',
        'unlisted_short': '未列出'
    };
    
    // 模拟t函数对于缺失的翻译键
    const getLocalizedText = (key: string, ...args: any[]) => {
        // 如果是已知的临时翻译键，返回对应的值
        if (key in localizedTexts) {
            return localizedTexts[key as keyof typeof localizedTexts];
        }
        // 否则使用原有的t函数
        return t(key, ...args);
    };
    
    // 使用优化的getLocalizedText替代t函数
    const tExt = getLocalizedText;
    
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
                <main className="w-full flex flex-col justify-center items-center mb-12 px-3 sm:px-4 md:px-6">
                    <div className="w-auto w-full max-w-6xl">
                        {/* 页面标题区域 - 全新设计 */}
                        <div className="mt-4 sm:mt-6 mb-6 sm:mb-8">
                            {/* 标题和统计信息 */}
                            <div className="flex flex-col space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                                    {/* 左侧标题 */}
                                    <div>
                                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white inline-block relative">
                                            <span>
                                                {listState === 'draft' 
                                                    ? t('draft_bin') 
                                                    : listState === 'normal' 
                                                        ? t('article.title') 
                                                        : t('unlisted')}
                                            </span>
                                            <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-theme via-theme-light to-transparent w-full rounded-full transform origin-left"></div>
                                        </h1>
                                        <div className="mt-2 flex items-center">
                                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                                {t('article.total$count', { count: feeds[listState]?.size })}
                                            </span>
                                            <span className="mx-2 text-gray-300 dark:text-gray-600">•</span>
                                            <span className="text-xs text-gray-500 dark:text-gray-500">
                                                {listState === 'draft' 
                                                    ? tExt('draft_description_short') 
                                                    : listState === 'normal' 
                                                        ? tExt('article_description_short')
                                                        : tExt('unlisted_description_short')}
                                            </span>
                                        </div>
                                    </div>

                                    {/* 右侧操作按钮组 - 仅在授权用户时显示 */}
                                    {profile?.permission && (
                                        <div className="flex flex-wrap gap-2 mt-3 sm:mt-0">
                                            {/* 新建文章按钮 */}
                                            <Link href="/writing/new"
                                                className="flex-none min-w-[100px] px-4 py-2 sm:py-2.5 rounded-lg text-sm font-medium bg-gradient-to-r from-theme to-theme-dark text-white shadow hover:shadow-md transition-all hover:translate-y-[-2px] flex items-center justify-center">
                                                <i className="ri-add-line mr-1.5"></i>
                                                <span>{t('new_article')}</span>
                                            </Link>

                                            {/* 分类筛选按钮组 */}
                                            <div className="flex gap-2 flex-1 sm:flex-none">
                                                <Link href={listState === 'draft' ? '/?type=normal' : '/?type=draft'} 
                                                    className={`flex-1 sm:flex-none min-w-[90px] px-3 py-2 sm:py-2.5 rounded-lg text-sm font-medium flex items-center justify-center transition-all
                                                    ${listState === 'draft' 
                                                    ? "bg-theme/10 text-theme border border-theme/20 hover:bg-theme/20" 
                                                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700"}`}>
                                                    <i className="ri-draft-line mr-1.5"></i>
                                                    <span>{tExt('draft_bin_short')}</span>
                                                </Link>
                                                <Link href={listState === 'unlisted' ? '/?type=normal' : '/?type=unlisted'} 
                                                    className={`flex-1 sm:flex-none min-w-[90px] px-3 py-2 sm:py-2.5 rounded-lg text-sm font-medium flex items-center justify-center transition-all
                                                    ${listState === 'unlisted' 
                                                    ? "bg-theme/10 text-theme border border-theme/20 hover:bg-theme/20" 
                                                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700"}`}>
                                                    <i className="ri-eye-off-line mr-1.5"></i>
                                                    <span>{tExt('unlisted_short')}</span>
                                                </Link>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            {/* 说明文本 - 仅在草稿和未列出状态下显示 */}
                            {(listState === 'draft' || listState === 'unlisted') && (
                                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700/50">
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {listState === 'draft' 
                                            ? t('draft_description') 
                                            : t('unlisted_description')
                                        }
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* 渐变分割线 */}
                        <div className="w-full mb-6 sm:mb-8">
                            <div className="h-px bg-gradient-to-r from-transparent via-theme/30 to-transparent"></div>
                        </div>
                        
                        <Waiting for={status === 'idle'}>
                            {feeds[listState]?.data?.length > 0 ? (
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6 w-full">
                                        {feeds[listState].data.map((feed, i) => (
                                            <FeedCard key={`feed-card-${feed.id}-${i}`} {...feed} />
                                        ))}
                                    </div>
                                    
                                    {/* 分页控制 - 改进视觉样式和交互 */}
                                    <div className="flex justify-center mt-8 sm:mt-10 mb-4 w-full">
                                        <Pagination
                                            currentPage={page}
                                            totalPages={Math.ceil(feeds[listState].size / limit)}
                                            basePath={`/?type=${listState}`}
                                            className="gap-2"
                                        />
                                    </div>
                                    
                                    {/* 底部分隔线 */}
                                    <div className="w-full mb-6 sm:mb-8">
                                        <hr className="h-px border-0 bg-gradient-to-r from-transparent via-theme/40 dark:via-theme/30 to-transparent shadow-sm" />
                                    </div>
                                </>
                            ) : status === 'loading' ? (
                                // 加载状态显示骨架屏
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6 w-full">
                                    {Array(6).fill(0).map((_, i) => (
                                        <div key={`skeleton-${i}`} className="block w-full rounded-2xl bg-white dark:bg-gray-800 h-full overflow-hidden border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col min-h-[260px] xs:min-h-[280px]">
                                            {/* 骨架屏卡片顶部 */}
                                            <div className="w-full h-40 xs:h-44 sm:h-48 overflow-hidden rounded-t-xl relative bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 animate-pulse">
                                                {/* 顶部通知标识占位 */}
                                                <div className="absolute top-3 right-3 w-16 h-6 rounded-full bg-gray-300/70 dark:bg-gray-600/70"></div>
                                            </div>
                                            
                                            {/* 骨架屏卡片内容区域 */}
                                            <div className="p-4 sm:p-5 flex-1 flex flex-col">
                                                {/* 标题占位 */}
                                                <div className="h-6 sm:h-7 bg-gray-200 dark:bg-gray-700 rounded-lg mb-2 w-3/4 animate-pulse"></div>
                                                <div className="h-4 sm:h-5 bg-gray-200 dark:bg-gray-700 rounded-lg mb-4 w-1/2 animate-pulse"></div>
                                                
                                                {/* 日期和状态占位 */}
                                                <div className="flex justify-between mb-3">
                                                    <div className="h-5 w-24 bg-gray-100 dark:bg-gray-800 rounded-full animate-pulse"></div>
                                                    <div className="h-5 w-16 bg-gray-100 dark:bg-gray-800 rounded-full animate-pulse"></div>
                                                </div>
                                                
                                                {/* 摘要占位 */}
                                                <div className="space-y-2 mb-4">
                                                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-full animate-pulse delay-75"></div>
                                                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-full animate-pulse delay-100"></div>
                                                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-4/5 animate-pulse delay-150"></div>
                                                </div>
                                                
                                                {/* 标签占位 */}
                                                <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-700/30">
                                                    <div className="flex gap-2">
                                                        <div className="h-6 w-16 bg-gray-100 dark:bg-gray-800 rounded-full animate-pulse delay-75"></div>
                                                        <div className="h-6 w-10 bg-gray-100 dark:bg-gray-800 rounded-full animate-pulse delay-150"></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                // 空状态 - 添加创建文章按钮
                                <div className="w-full py-12 sm:py-16 flex flex-col items-center justify-center text-center space-y-5 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50/50 dark:bg-gray-800/30">
                                    <div className="w-20 h-20 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 mb-1">
                                        <i className="ri-inbox-2-line text-4xl text-gray-400 dark:text-gray-500"></i>
                                    </div>
                                    <div className="max-w-md px-4">
                                        <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-2">{t('empty_list')}</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            {listState === 'draft' 
                                                ? t('empty_draft_description') 
                                                : listState === 'unlisted' 
                                                    ? t('empty_unlisted_description')
                                                    : t('empty_article_description')
                                            }
                                        </p>
                                    </div>
                                    {profile?.permission && (
                                        <Link href="/writing/new" className="px-5 py-2.5 rounded-lg text-sm font-medium bg-gradient-to-r from-theme to-theme-dark text-white shadow hover:shadow-md transition-all hover:translate-y-[-2px] flex items-center justify-center">
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
