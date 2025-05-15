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
            <Waiting for={feeds.draft.size + feeds.normal.size + feeds.unlisted.size > 0 || status === 'idle'}>
                <main className="w-full flex flex-col justify-center items-center mb-12 px-4 sm:px-6">
                    <div className="wauto w-full max-w-6xl">
                        <div className="flex flex-col space-y-4 mb-8">
                            <div className="flex items-center justify-between py-6 border-b border-gray-200/50 dark:border-gray-700/50">
                                <div className="flex items-center space-x-4">
                                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white relative group">
                                        {listState === 'draft' ? t('draft_bin') : listState === 'normal' ? t('article.title') : t('unlisted')}
                                        <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-theme group-hover:w-full transition-all duration-300"></span>
                                    </h1>
                                    <div className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800/80 rounded-full text-xs text-gray-500 dark:text-gray-400 flex items-center font-medium backdrop-blur-sm">
                                        <i className="ri-article-line mr-1.5"></i>
                                        {t('article.total$count', { count: feeds[listState]?.size })}
                                    </div>
                                </div>
                                
                                {profile?.permission &&
                                    <div className="flex flex-row space-x-3 items-center">
                                        <Link href={listState === 'draft' ? '/?type=normal' : '/?type=draft'} 
                                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center ${listState === 'draft' 
                                            ? "bg-theme/10 text-theme ring-1 ring-theme/30" 
                                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"}`}>
                                            <i className="ri-draft-line mr-1.5"></i>
                                            {t('draft_bin')}
                                        </Link>
                                        <Link href={listState === 'unlisted' ? '/?type=normal' : '/?type=unlisted'} 
                                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center ${listState === 'unlisted' 
                                            ? "bg-theme/10 text-theme ring-1 ring-theme/30" 
                                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"}`}>
                                            <i className="ri-eye-off-line mr-1.5"></i>
                                            {t('unlisted')}
                                        </Link>
                                    </div>
                                }
                            </div>
                            
                            <div className="flex justify-between items-center">
                                <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                                    {listState === 'draft' 
                                        ? t('draft_description') 
                                        : listState === 'unlisted' 
                                            ? t('unlisted_description') 
                                            : t('article_description')}
                                </div>
                                <div className="flex space-x-2">
                                    {/* 未来可添加排序按钮、视图切换按钮等 */}
                                </div>
                            </div>
                        </div>
                        
                        <Waiting for={status === 'idle'}>
                            <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ani-show w-full ${feeds[listState].data.length === 0 ? '' : 'mb-8'}`}>
                                {feeds[listState].data.length > 0 ? (
                                    feeds[listState].data.map(({ id, ...feed }: any) => (
                                        <FeedCard key={id} id={id} {...feed} />
                                    ))
                                ) : (
                                    <div className="col-span-full text-center py-20 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/20 rounded-2xl border border-gray-100 dark:border-gray-800">
                                        <i className="ri-inbox-line text-5xl mb-4 block opacity-50"></i>
                                        <p className="text-lg">{t('no_articles')}</p>
                                        <p className="text-sm mt-2 text-gray-400 dark:text-gray-500">{t('no_articles_description')}</p>
                                    </div>
                                )}
                            </div>
                            
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
