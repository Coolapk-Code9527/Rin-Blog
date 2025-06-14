import React from "react"
import { Helmet } from 'react-helmet-async'
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
import { PageContainer } from "../components/container"

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
                <div className={`block w-full rounded-2xl bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm h-full overflow-hidden border border-neutral-200/60 dark:border-neutral-700/60 shadow-enhanced flex flex-col min-h-[260px] xs:min-h-[280px] transition-opacity duration-300 ${isIntersecting ? 'opacity-100' : 'opacity-40'}`}>
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
                        <div className="h-6 sm:h-7 bg-neutral-200 dark:bg-neutral-700 rounded-xl w-3/4 mb-2 animate-pulse"></div>
                        <div className="h-4 sm:h-5 bg-neutral-200 dark:bg-neutral-700 rounded-xl w-1/2 mb-4 animate-pulse"></div>
                        
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
            <PageContainer>
                <div className="flex flex-col space-y-3 mb-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-2 sm:py-3 gap-2 sm:gap-3">
                        {/* 左侧：标题和文章数量 */}
                        <div className="flex items-center gap-2 sm:gap-3">
                            <h1 className="text-2xl font-bold text-gray-800 dark:text-white relative group">
                                {listState === 'draft' ? t('draft_bin') : listState === 'normal' ? t('article.title') : t('unlisted')}
                                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-theme group-hover:w-full transition-all duration-300"></span>
                            </h1>
                            <div className="py-1.5 sm:px-3 sm:py-1.5 bg-neutral-100/80 dark:bg-neutral-800/80 rounded-xl text-sm text-neutral-600 dark:text-neutral-400 flex items-center font-medium backdrop-blur-sm border border-neutral-200/40 dark:border-neutral-700/40">
                                <i className="ri-article-line text-theme"></i>
                                <span className="ml-1.5">{t('article.total$count', { count: feeds[listState]?.size })}</span>
                            </div>
                        </div>
                        
                        {/* 右侧：操作按钮组 */}
                        {profile?.permission && (
                            <div className="flex items-center gap-2 md:gap-3 mt-2 sm:mt-0 w-full sm:w-auto">
                                <Link href="/writing/new"
                                    className="flex-1 sm:flex-none px-3 sm:px-3.5 py-2.5 rounded-xl text-xs md:text-sm font-medium transition-all duration-200 ease-out flex items-center justify-center shadow-enhanced bg-theme text-white hover:bg-theme-hover active:bg-theme-active hover:-translate-y-0.5 active:translate-y-0 hover:shadow-enhanced-lg glow-on-hover btn-enhanced">
                                    <i className="ri-add-line"></i>
                                    <span className="ml-1.5">{t('new_article')}</span>
                                </Link>
                                <div className="flex items-center gap-2">
                                    <Link href={listState === 'draft' ? '/?type=normal' : '/?type=draft'}
                                        className={`flex-1 sm:flex-none h-9 xs:h-auto px-3 py-2.5 rounded-xl text-xs md:text-sm font-medium transition-all duration-200 ease-out flex items-center justify-center shadow-enhanced hover:-translate-y-0.5 active:translate-y-0
                                        ${listState === 'draft'
                                        ? "bg-theme/12 text-theme border border-theme/30 dark:bg-theme/20 dark:border-theme/25 shadow-enhanced-lg backdrop-blur-sm"
                                        : "bg-white/95 dark:bg-gray-800/95 text-neutral-600 dark:text-neutral-300 border border-neutral-200/60 dark:border-neutral-700/60 hover:bg-neutral-50 dark:hover:bg-neutral-750 hover:text-theme dark:hover:text-theme backdrop-blur-sm"}`}>
                                        <i className="ri-draft-line"></i>
                                        <span className="hidden xs:inline ml-1.5 md:ml-2">{t('draft_bin')}</span>
                                    </Link>
                                    <Link href={listState === 'unlisted' ? '/?type=normal' : '/?type=unlisted'}
                                        className={`flex-1 sm:flex-none h-9 xs:h-auto px-3 py-2.5 rounded-xl text-xs md:text-sm font-medium transition-all duration-200 ease-out flex items-center justify-center shadow-enhanced hover:-translate-y-0.5 active:translate-y-0
                                        ${listState === 'unlisted'
                                        ? "bg-theme/12 text-theme border border-theme/30 dark:bg-theme/20 dark:border-theme/25 shadow-enhanced-lg backdrop-blur-sm"
                                        : "bg-white/95 dark:bg-gray-800/95 text-neutral-600 dark:text-neutral-300 border border-neutral-200/60 dark:border-neutral-700/60 hover:bg-neutral-50 dark:hover:bg-neutral-750 hover:text-theme dark:hover:text-theme backdrop-blur-sm"}`}>
                                        <i className="ri-eye-off-line"></i>
                                        <span className="hidden xs:inline ml-1.5 md:ml-2">{t('unlisted')}</span>
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* 上方渐变分割线 */}
                    <div className="w-full mb-2">
                        <hr className="h-px border-0 bg-gradient-to-r from-transparent via-theme/40 dark:via-theme/30 to-transparent" />
                    </div>
                    
                    <div className="flex justify-between items-center -mt-1 sm:mt-0">
                        {(listState === 'draft' || listState === 'unlisted') && (
                            <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 italic px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700/20 max-w-full sm:max-w-md">
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6 w-full mt-2">
                                {feeds[listState].data.map((feed, i) => (
                                    <LazyFeedCard key={`feed-card-${feed.id}-${i}`} {...feed} />
                                ))}
                            </div>
                            
                            {/* 分页控制 - 改进视觉样式和交互 */}
                            <div className="flex justify-center mt-6 mb-2 w-full">
                                <Pagination
                                    currentPage={page}
                                    totalPages={Math.ceil(feeds[listState].size / limit)}
                                    basePath={`/?type=${listState}`}
                                    className="gap-2"
                                />
                            </div>
                            
                            {/* 底部分隔线 */}
                            <div className="w-full mb-6">
                                <hr className="h-px border-0 bg-gradient-to-r from-transparent via-theme/40 dark:via-theme/30 to-transparent" />
                            </div>
                        </>
                    ) : status === 'loading' ? (
                        // 加载状态显示骨架屏
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 w-full">
                            {Array(6).fill(0).map((_, i) => (
                                <div key={`skeleton-${i}`} className="block w-full rounded-2xl bg-white dark:bg-gray-800 h-full overflow-hidden border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col min-h-[250px] xs:min-h-[270px] sm:min-h-[290px]">
                                    {/* 骨架屏卡片顶部 */}
                                    <div className="w-full h-36 xs:h-40 sm:h-44 md:h-48 overflow-hidden rounded-t-xl relative bg-gray-200 dark:bg-gray-700 animate-pulse">
                                    </div>
                                    
                                    {/* 骨架屏卡片内容区域 */}
                                    <div className="p-3 sm:p-4 flex-1 flex flex-col">
                                        {/* 标题占位 */}
                                        <div className="h-6 sm:h-7 bg-gray-200 dark:bg-gray-700 rounded-md w-3/4 mb-1 sm:mb-1.5 animate-pulse"></div>
                                        <div className="h-4 sm:h-5 bg-gray-200 dark:bg-gray-700 rounded-md w-1/2 mb-2 sm:mb-3 animate-pulse"></div>
                                        
                                        {/* 日期和状态占位 */}
                                        <div className="flex justify-between mb-2">
                                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-md w-1/4 animate-pulse"></div>
                                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-md w-1/5 animate-pulse"></div>
                                        </div>
                                        
                                        {/* 摘要占位 */}
                                        <div className="space-y-1.5 mb-3">
                                            <div className="h-3 bg-gray-200 dark:bg-gray-700/70 rounded w-full animate-pulse"></div>
                                            <div className="h-3 bg-gray-200 dark:bg-gray-700/70 rounded w-full animate-pulse"></div>
                                            <div className="h-3 bg-gray-200 dark:bg-gray-700/70 rounded w-4/5 animate-pulse"></div>
                                        </div>
                                        
                                        {/* 标签占位 */}
                                        <div className="mt-auto pt-2 border-t border-gray-100 dark:border-gray-700/30">
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
                        <div className="w-full py-14 sm:py-20 flex flex-col items-center justify-center text-center space-y-5 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-800/50">
                            <div className="text-6xl text-gray-300 dark:text-gray-600">
                                <i className="ri-inbox-2-line"></i>
                            </div>
                            <div className="max-w-md px-4">
                                <h3 className="text-2xl font-bold text-gray-600 dark:text-gray-300 mb-2">{t('empty_list')}</h3>
                                <p className="text-base text-gray-500 dark:text-gray-400">
                                    {listState === 'draft' 
                                        ? t('empty_draft_description') 
                                        : listState === 'unlisted' 
                                            ? t('empty_unlisted_description')
                                            : t('empty_article_description')
                                    }
                                </p>
                            </div>
                            {profile?.permission && (
                                <Link href="/writing/new" className="mt-4 px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ease-out flex items-center justify-center shadow-enhanced bg-theme text-white hover:bg-theme-hover active:bg-theme-active hover:-translate-y-0.5 active:translate-y-0 hover:shadow-enhanced-lg">
                                    <i className="ri-add-line"></i>
                                    <span className="ml-2">{t('create_now')}</span>
                                </Link>
                            )}
                        </div>
                    )}
                </Waiting>
            </PageContainer>
        </>
    )
}
