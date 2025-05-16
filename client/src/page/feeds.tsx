import React from "react"
import { Helmet } from 'react-helmet'
import { Link } from "wouter"
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

export function FeedsPage() {
    const { t } = useTranslation()
    const searchParams = new URLSearchParams(window.location.search);
    const profile = React.useContext(ProfileContext);
    const [listState, _setListState] = React.useState<FeedType>(
        (searchParams.get("type") as FeedType) || 'normal'
    )
    const [status, setStatus] = React.useState<'loading' | 'idle'>('idle')
    const [feeds, setFeeds] = React.useState<FeedsMap>({
        draft: { size: 0, data: [], hasNext: false },
        unlisted: { size: 0, data: [], hasNext: false },
        normal: { size: 0, data: [], hasNext: false }
    })
    const page = tryInt(1, searchParams.get("page"))
    const limit = tryInt(10, searchParams.get("limit"), process.env.PAGE_SIZE)
    const ref = React.useRef("")
    
    const fetchFeeds = (type: FeedType) => {
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
    };
    
    React.useEffect(() => {
        const key = `${searchParams.get("page")} ${searchParams.get("type")}`
        if (ref.current == key) return
        const type = (searchParams.get("type") as FeedType) || 'normal'
        if (type !== listState) {
            _setListState(type)
        }
        setStatus('loading')
        fetchFeeds(type)
        ref.current = key
    }, [page, listState, feeds])
    
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
                <main className="w-full flex flex-col justify-center items-center mb-8 sm:mb-12 px-3 sm:px-6">
                    <div className="w-auto w-full max-w-6xl">
                        <div className="flex flex-col space-y-4 mb-4 sm:mb-6">
                            <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between py-3 sm:py-4 md:py-6">
                                <div className="flex flex-col space-y-2">
                                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white relative group">
                                            {listState === 'draft' ? t('draft_bin') : listState === 'normal' ? t('article.title') : t('unlisted')}
                                            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-theme/70 to-theme-dark/70 group-hover:w-full transition-all duration-300"></span>
                                        </h1>
                                        <div className="px-2 py-0.5 sm:px-3 sm:py-1 bg-gray-100/90 dark:bg-gray-800/80 rounded-full text-xs text-gray-500 dark:text-gray-400 flex items-center font-medium backdrop-blur-sm shadow-sm">
                                            <i className="ri-article-line mr-1"></i>
                                            {t('article.total$count', { count: feeds[listState]?.size })}
                                        </div>
                                    </div>
                                    
                                    {/* 移动端视图下的描述文本 */}
                                    {(listState === 'draft' || listState === 'unlisted') && (
                                        <div className="sm:hidden text-xs text-gray-500 dark:text-gray-400 italic px-2 py-1 bg-gray-50 dark:bg-gray-800/50 rounded-md">
                                            {listState === 'draft' 
                                                ? t('draft_description') 
                                                : t('unlisted_description')
                                            }
                                        </div>
                                    )}
                                </div>
                                
                                {profile?.permission &&
                                    <div className="flex flex-wrap sm:flex-nowrap gap-2 sm:gap-3">
                                        <Link href="/writing/new"
                                            className="flex-shrink-0 px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 flex items-center justify-center shadow-sm bg-theme text-white hover:bg-theme-hover active:bg-theme-active hover:scale-105 hover:shadow-md">
                                            <i className="ri-add-line mr-1.5 sm:mr-2"></i>
                                            <span className="text-xs sm:text-sm">{t('new_article')}</span>
                                        </Link>
                                        <div className="flex gap-2">
                                            <Link href={listState === 'draft' ? '/?type=normal' : '/?type=draft'} 
                                                className={`flex-shrink-0 w-auto min-w-[40px] h-9 sm:px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 flex items-center justify-center shadow-sm
                                                ${listState === 'draft' 
                                                ? "bg-theme/10 text-theme border border-theme/30 dark:bg-theme/20 dark:border-theme/20 shadow" 
                                                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 hover:text-theme dark:hover:text-theme"}`}>
                                                <i className="ri-draft-line sm:mr-2"></i>
                                                <span className="hidden sm:inline text-xs sm:text-sm">{t('draft_bin')}</span>
                                            </Link>
                                            <Link href={listState === 'unlisted' ? '/?type=normal' : '/?type=unlisted'} 
                                                className={`flex-shrink-0 w-auto min-w-[40px] h-9 sm:px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 flex items-center justify-center shadow-sm
                                                ${listState === 'unlisted' 
                                                ? "bg-theme/10 text-theme border border-theme/30 dark:bg-theme/20 dark:border-theme/20 shadow" 
                                                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 hover:text-theme dark:hover:text-theme"}`}>
                                                <i className="ri-eye-off-line sm:mr-2"></i>
                                                <span className="hidden sm:inline text-xs sm:text-sm">{t('unlisted')}</span>
                                            </Link>
                                        </div>
                                    </div>
                                }
                            </div>
                            
                            {/* 桌面端视图下的描述文本 */}
                            {(listState === 'draft' || listState === 'unlisted') && (
                                <div className="hidden sm:block text-sm text-gray-500 dark:text-gray-400 italic px-3 py-1.5 bg-gray-50 dark:bg-gray-800/50 rounded-md">
                                    {listState === 'draft' 
                                        ? t('draft_description') 
                                        : t('unlisted_description')
                                    }
                                </div>
                            )}
                            
                            {/* 上方渐变分割线 */}
                            <div className="w-full">
                                <hr className="h-px border-0 bg-gradient-to-r from-transparent via-theme/40 dark:via-theme/30 to-transparent shadow-sm" />
                            </div>
                            
                            <div className="flex justify-between items-center">
                                <div className="flex space-x-2">
                                    {/* 未来可添加排序按钮、视图切换按钮等 */}
                                </div>
                            </div>
                        </div>
                        
                        <Waiting for={status === 'idle'}>
                            {feeds[listState]?.data?.length > 0 ? (
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 w-full">
                                        {feeds[listState].data.map((feed, i) => (
                                            <FeedCard key={`feed-card-${feed.id}-${i}`} {...feed} />
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
                                    <div className="w-full mt-8 mb-4 sm:mb-8">
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
