import { useContext, useEffect, useRef, useState } from "react"
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

export function FeedsPage() {
    const { t } = useTranslation()
    const query = new URLSearchParams(useSearch());
    const profile = useContext(ProfileContext);
    const [listState, _setListState] = useState<FeedType>(query.get("type") as FeedType || 'normal')
    const [status, setStatus] = useState<'loading' | 'idle'>('idle')
    const [feeds, setFeeds] = useState<FeedsMap>({
        draft: { size: 0, data: [], hasNext: false },
        unlisted: { size: 0, data: [], hasNext: false },
        normal: { size: 0, data: [], hasNext: false }
    })
    const page = tryInt(1, query.get("page"))
    const limit = tryInt(10, query.get("limit"), process.env.PAGE_SIZE)
    const ref = useRef("")
    function fetchFeeds(type: FeedType) {
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
    }
    useEffect(() => {
        const key = `${query.get("page")} ${query.get("type")}`
        if (ref.current == key) return
        const type = query.get("type") as FeedType || 'normal'
        if (type !== listState) {
            _setListState(type)
        }
        setStatus('loading')
        fetchFeeds(type)
        ref.current = key
    }, [query.get("page"), query.get("type")])
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
            
            {/* 页面主容器 */}
            <main className="w-full flex flex-col justify-center items-center mb-12 px-4 sm:px-6">
                {/* 页面标题和分类选项 */}
                <div className="wauto w-full max-w-6xl">
                    <div className="py-8">
                        <h1 className="text-3xl font-bold text-gray-800 dark:text-white relative inline-block group">
                            {listState === 'draft' ? t('draft_bin') : listState === 'normal' ? t('article.title') : t('unlisted')}
                            <span className="absolute -bottom-1 left-0 w-1/3 h-1 bg-theme group-hover:w-full transition-all duration-300"></span>
                        </h1>
                        <p className="mt-2 text-gray-600 dark:text-gray-400">
                            {listState === 'draft' 
                                ? t('draft_description') 
                                : listState === 'unlisted' 
                                    ? t('unlisted_description')
                                    : t('articles_description')}
                        </p>
                    </div>
                    
                    {/* 文章分类导航和统计信息 */}
                    <div className="mb-8 flex flex-wrap items-center justify-between">
                        <div className="flex items-center space-x-2 mb-4 sm:mb-0">
                            <Link href="/?type=normal" 
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${listState === 'normal' 
                                ? "bg-theme/10 text-theme dark:bg-theme/30 dark:text-white" 
                                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"}`}>
                                <i className="ri-article-line mr-1.5"></i>
                                {t('all_articles')}
                            </Link>
                            
                            {profile?.permission && (
                                <>
                                    <Link href="/?type=draft" 
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${listState === 'draft' 
                                        ? "bg-theme/10 text-theme dark:bg-theme/30 dark:text-white" 
                                        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"}`}>
                                        <i className="ri-draft-line mr-1.5"></i>
                                        {t('draft_bin')}
                                    </Link>
                                    
                                    <Link href="/?type=unlisted" 
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${listState === 'unlisted' 
                                        ? "bg-theme/10 text-theme dark:bg-theme/30 dark:text-white" 
                                        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"}`}>
                                        <i className="ri-eye-off-line mr-1.5"></i>
                                        {t('unlisted')}
                                    </Link>
                                </>
                            )}
                        </div>
                        
                        {/* 文章数量统计 */}
                        <div className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm text-gray-500 dark:text-gray-400 flex items-center">
                            <i className="ri-file-list-3-line mr-1.5"></i>
                            {t('article.total$count', { count: feeds[listState]?.size })}
                        </div>
                    </div>
                </div>
                
                {/* 文章列表 */}
                <Waiting for={feeds.draft.size + feeds.normal.size + feeds.unlisted.size > 0 || status === 'idle'}>
                    <div className={`wauto grid grid-cols-1 md:grid-cols-2 gap-6 ani-show max-w-6xl w-full ${feeds[listState].data.length === 0 ? '' : 'mb-8'}`}>
                        {status === 'loading' ? (
                            // 加载状态
                            Array(4).fill(0).map((_, index) => (
                                <div key={index} className="rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse h-[280px]"></div>
                            ))
                        ) : feeds[listState].data.length > 0 ? (
                            // 有文章数据
                            feeds[listState].data.map(({ id, ...feed }: any) => (
                                <FeedCard key={id} id={id} {...feed} />
                            ))
                        ) : (
                            // 没有文章数据
                            <div className="col-span-full text-center py-20 bg-gray-50/50 dark:bg-gray-800/20 rounded-xl border border-gray-200/80 dark:border-gray-700/50">
                                <div className="flex flex-col items-center justify-center">
                                    <i className="ri-inbox-line text-5xl mb-4 text-gray-300 dark:text-gray-600"></i>
                                    <p className="text-lg text-gray-500 dark:text-gray-400">{t('no_articles')}</p>
                                    <p className="text-sm mt-2 text-gray-400 dark:text-gray-500 max-w-md">{t('no_articles_description')}</p>
                                    
                                    {profile?.permission && (
                                        <Link href="/writing" className="mt-6 px-4 py-2 bg-theme/10 text-theme dark:bg-theme/30 dark:text-white rounded-lg text-sm font-medium hover:bg-theme/20 dark:hover:bg-theme/40 transition-all">
                                            <i className="ri-edit-line mr-1.5"></i>
                                            {t('create_new_article')}
                                        </Link>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* 分页导航 */}
                    {(page > 1 || feeds[listState]?.hasNext) && feeds[listState].data.length > 0 && (
                        <Pagination 
                            currentPage={page}
                            totalPages={Math.ceil(feeds[listState]?.size / limit) || 1}
                            basePath={`/?type=${listState}`}
                            className="ani-show"
                        />
                    )}
                </Waiting>
            </main>
        </>
    )
}
