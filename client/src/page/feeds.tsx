import React from "react"
import { Helmet } from 'react-helmet'
import { Link, useSearch, useSearchParams } from "wouter"
import { FeedCard } from "../components/feed_card"
import { Waiting } from "../components/loading"
import { Pagination } from "../components/pagination"
import { client } from "../main"
import { ProfileContext } from "../state/profile"
import { headersWithAuth } from "../utils/auth"
import { siteName } from "../utils/constants"
import { tryInt } from "../utils/int"
import { useTranslation } from "react-i18next";
import { Button } from "../components/button"
import { useLocation } from "wouter"

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
    const [searchParams] = useSearchParams();
    const page = searchParams.get('page') ? parseInt(searchParams.get('page') as string) : 1;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit') as string) : 12;
    const [error, setError] = React.useState<string | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [feeds, setFeeds] = React.useState<Feed[]>([]);
    const [hasMore, setHasMore] = React.useState(false);
    const [totalCount, setTotalCount] = React.useState(0);
    const { t, i18n } = useTranslation();
    const { client } = React.useContext(ClientContext);
    const { user } = React.useContext(UserContext);
    const [, setLocation] = useLocation();

    // 获取文章列表数据
    React.useEffect(() => {
        const getFeeds = async () => {
            setLoading(true);
            setError(null);
            try {
                const resp = await client.getFeeds({
                    locale: i18n.language,
                    timezone: new Date().getTimezoneOffset(),
                    page,
                    limit,
                });
                
                if (resp.status === "ok") {
                    const results = resp.data.results;
                    results.map((feed: any) => {
                        feed.createdAt = new Date(feed.createdAt);
                        feed.updatedAt = new Date(feed.updatedAt);
                        return feed;
                    });
                    setFeeds(results);
                    setHasMore(resp.data.hasMore);
                    setTotalCount(resp.data.count);
                    document.title = `${t('nav.feeds')} | ${t('title')}`;
                } else {
                    setError(resp.message);
                }
            } catch (e: any) {
                setError(e.toString());
            }
            setLoading(false);
        };
        
        getFeeds();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [i18n.language, page, limit]);

    if (loading) {
        return <Waiting />;
    }

    if (error) {
        return <div className="flex flex-col h-screen items-center justify-center">
            <div className="p-4 bg-red-50 dark:bg-red-900/30 rounded-lg max-w-xl w-full">
                <div className="text-xl font-bold text-red-700 dark:text-red-400 text-center mb-2">
                    <i className="ri-error-warning-line mr-2"></i>
                    {t('error.title')}
                </div>
                <div className="text-center text-red-600 dark:text-red-300">
                    {error}
                </div>
            </div>
        </div>;
    }

    return (
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
            {/* 页面头部 - 标题与统计信息 */}
            <div className="mb-6 md:mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center">
                        <i className="ri-article-line mr-2 text-theme"></i>
                        {t('nav.feeds')}
                        <span className="ml-3 text-sm font-normal bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 py-1 px-2 rounded-lg">
                            {t('total')}: {totalCount}
                        </span>
                    </h1>
                    
                    <div className="flex items-center space-x-2">
                        {/* 搜索按钮 */}
                        <Button
                            type="button"
                            className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                            onClick={() => setLocation('/search')}
                        >
                            <i className="ri-search-line mr-1.5"></i>
                            {t('search')}
                        </Button>
                        
                        {/* 发布新文章按钮 */}
                        {user && (
                            <Button
                                type="button"
                                className="bg-theme hover:bg-theme-dark text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                onClick={() => setLocation('/writing')}
                            >
                                <i className="ri-add-line mr-1.5"></i>
                                {t('new_article')}
                            </Button>
                        )}
                    </div>
                </div>
                
                {/* 分割线 */}
                <div className="h-1 bg-gradient-to-r from-theme/80 to-transparent rounded-full"></div>
            </div>
            
            {/* 文章列表区域 */}
            {feeds.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                    {feeds.map((feed) => (
                        <div key={feed.id} className="h-full">
                            <FeedCard {...feed} />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <img 
                        src="/empty.svg" 
                        alt={t('no_feeds')} 
                        className="w-48 h-48 mb-4 opacity-80 dark:opacity-60" 
                    />
                    <h3 className="text-xl font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('no_feeds')}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 max-w-md mb-6">
                        {t('no_feeds_desc')}
                    </p>
                    
                    {user ? (
                        <Button
                            type="button"
                            className="bg-theme hover:bg-theme-dark text-white px-5 py-2.5 rounded-lg text-base font-medium transition-colors"
                            onClick={() => setLocation('/writing')}
                        >
                            <i className="ri-add-line mr-2"></i>
                            {t('write_first_article')}
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            className="bg-theme hover:bg-theme-dark text-white px-5 py-2.5 rounded-lg text-base font-medium transition-colors"
                            onClick={() => setLocation('/login')}
                        >
                            <i className="ri-login-box-line mr-2"></i>
                            {t('login_to_write')}
                        </Button>
                    )}
                </div>
            )}
            
            {/* 分页控制区域 */}
            {feeds.length > 0 && (
                <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                        {t('showing')} {(page - 1) * limit + 1} - {Math.min(page * limit, totalCount)} {t('of')} {totalCount} {t('articles')}
                    </div>
                    
                    <div className="flex items-center space-x-2">
                        {/* 上一页按钮 */}
                        {page > 1 && (
                            <Button
                                type="button"
                                className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                onClick={() => setLocation(`/feeds?page=${page - 1}&limit=${limit}`)}
                            >
                                <i className="ri-arrow-left-line mr-1.5"></i>
                                {t('prev')}
                            </Button>
                        )}
                        
                        {/* 当前页码显示 */}
                        <span className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm text-gray-700 dark:text-gray-300">
                            {page}
                        </span>
                        
                        {/* 下一页按钮 */}
                        {hasMore && (
                            <Button
                                type="button"
                                className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                onClick={() => setLocation(`/feeds?page=${page + 1}&limit=${limit}`)}
                            >
                                {t('next')}
                                <i className="ri-arrow-right-line ml-1.5"></i>
                            </Button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
