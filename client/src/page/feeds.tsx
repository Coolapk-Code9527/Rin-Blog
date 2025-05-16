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
                    <div className="w-auto w-full max-w-6xl">
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
                                        <Link href="/writing/new"
                                            className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-all duration-300 flex items-center justify-center shadow-sm bg-theme text-white hover:bg-theme-hover active:bg-theme-active hover:scale-105 hover:shadow-md">
                                            <i className="ri-add-line sm:mr-2"></i>
                                            <span className="hidden sm:inline">{t('new_article')}</span>
                                        </Link>
                                        <Link href={listState === 'draft' ? '/?type=normal' : '/?type=draft'} 
                                            className={`w-8 h-8 sm:w-auto sm:h-auto px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-all duration-300 flex items-center justify-center sm:justify-start shadow-sm
                                            ${listState === 'draft' 
                                            ? "bg-theme/10 text-theme border border-theme/30 dark:bg-theme/20 dark:border-theme/20 shadow" 
                                            : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 hover:text-theme dark:hover:text-theme"}`}>
                                            <i className="ri-draft-line sm:mr-2"></i>
                                            <span className="hidden sm:inline">{t('draft_bin')}</span>
                                    </Link>
                                        <Link href={listState === 'unlisted' ? '/?type=normal' : '/?type=unlisted'} 
                                            className={`w-8 h-8 sm:w-auto sm:h-auto px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-all duration-300 flex items-center justify-center sm:justify-start shadow-sm
                                            ${listState === 'unlisted' 
                                            ? "bg-theme/10 text-theme border border-theme/30 dark:bg-theme/20 dark:border-theme/20 shadow" 
                                            : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 hover:text-theme dark:hover:text-theme"}`}>
                                            <i className="ri-eye-off-line sm:mr-2"></i>
                                            <span className="hidden sm:inline">{t('unlisted')}</span>
                                    </Link>
                                </div>
                            }
                            </div>
                            
                            <div className="flex justify-between items-center -mt-2 sm:mt-0">
                                {(listState === 'draft' || listState === 'unlisted') && (
                                    <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 italic px-2 py-1 bg-gray-50 dark:bg-gray-800/50 rounded-md">
                                        {listState === 'draft' 
                                            ? t('draft_description')
                                            : t('unlisted_description')
                                        }
                                    </div>
                                )}
                                <div className="flex space-x-2">
                                    {/* 未来可添加排序按钮、视图切换按钮等 */}
                                </div>
                            </div>
                        </div>
                        
                        <Waiting for={status === 'idle'}>
                            {feeds[listState]?.data?.length > 0 ? (
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 w-full">
                                        {feeds[listState].data.map((feed, i) => (
                                            <LazyFeedCard key={`feed-card-${feed.id}-${i}`} {...feed} />
                                        ))}
                                    </div>
                                    
                                    {/* 分页控制 - 改进视觉样式和交互 */}
                                    <div className="flex justify-center mt-8 w-full">
                                        <Pagination
                                            current={page}
                                            total={Math.ceil(feeds[listState].size / limit)}
                                            baseUrl={`/?type=${listState}`}
                                            linkClassName="w-9 h-9 flex items-center justify-center rounded-full text-sm font-medium transition-all duration-300 hover:scale-105"
                                            activeClassName="bg-theme text-white shadow-md hover:shadow-lg"
                                            inactiveClassName="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-theme hover:text-theme dark:hover:border-theme dark:hover:text-theme"
                                            prevNextClassName="bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-theme hover:text-theme dark:hover:border-theme dark:hover:text-theme"
                                            ellipsisClassName="text-gray-400 dark:text-gray-500"
                                        />
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
                                    {profile?.permission && (
                                        <Link href="/writing/new" className="mt-4 px-5 py-2.5 rounded-md text-sm font-medium transition-all duration-300 flex items-center justify-center shadow-sm bg-theme text-white hover:bg-theme-hover active:bg-theme-active hover:scale-105 hover:shadow-md">
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
