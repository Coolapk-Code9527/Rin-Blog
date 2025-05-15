import React from 'react'
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
    const location = window.location.search;
    const query = React.useMemo(() => new URLSearchParams(location), [location]);
    const profile = React.useContext(ProfileContext);
    const [listState, setListState] = React.useState<FeedType>(query.get("type") as FeedType || 'normal')
    const [status, setStatus] = React.useState<'loading' | 'idle'>('idle')
    const [feeds, setFeeds] = React.useState<FeedsMap>({
        draft: { size: 0, data: [], hasNext: false },
        unlisted: { size: 0, data: [], hasNext: false },
        normal: { size: 0, data: [], hasNext: false }
    })
    const page = tryInt(1, query.get("page"))
    const limit = tryInt(10, query.get("limit"), process.env.PAGE_SIZE)
    const ref = React.useRef("")
    
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
    
    React.useEffect(() => {
        const key = `${query.get("page")} ${query.get("type")}`
        if (ref.current == key) return
        const type = query.get("type") as FeedType || 'normal'
        if (type !== listState) {
            setListState(type)
        }
        setStatus('loading')
        fetchFeeds(type)
        ref.current = key
    }, [query.get("page"), query.get("type"), listState])
    
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
                <main className="w-full flex flex-col justify-center items-center mb-12">
                    <div className="wauto text-start w-full max-w-4xl px-4 md:px-0">
                        <div className="py-6 border-b border-gray-100 dark:border-gray-800 mb-6">
                            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
                                {listState === 'draft' ? t('draft_bin') : listState === 'normal' ? t('article.title') : t('unlisted')}
                            </h1>
                            
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-4">
                                <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                                    <i className="ri-article-line mr-2 text-lg text-gray-400 dark:text-gray-500"></i>
                                    {t('article.total$count', { count: feeds[listState]?.size })}
                                </p>
                                
                                {profile?.permission && (
                                    <div className="flex items-center space-x-4 mt-3 sm:mt-0">
                                        <Link 
                                            href={listState === 'draft' ? '/?type=normal' : '/?type=draft'} 
                                            className={`flex items-center text-sm px-3 py-1 rounded-full transition-colors duration-200 ${
                                                listState === 'draft' 
                                                    ? "bg-theme/10 text-theme" 
                                                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                                            }`}
                                        >
                                            <i className="ri-draft-line mr-1.5"></i>
                                            {t('draft_bin')}
                                        </Link>
                                        
                                        <Link 
                                            href={listState === 'unlisted' ? '/?type=normal' : '/?type=unlisted'} 
                                            className={`flex items-center text-sm px-3 py-1 rounded-full transition-colors duration-200 ${
                                                listState === 'unlisted' 
                                                    ? "bg-theme/10 text-theme" 
                                                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                                            }`}
                                        >
                                            <i className="ri-eye-off-line mr-1.5"></i>
                                            {t('unlisted')}
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <Waiting for={status === 'idle'}>
                        <div className="wauto w-full max-w-4xl px-4 md:px-0 animate-fadeIn">
                            {feeds[listState].data.length > 0 ? (
                                <div className="space-y-6">
                                    {feeds[listState].data.map(({ id, ...feed }: any) => (
                                        <FeedCard key={id} id={id} {...feed} />
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <i className="ri-article-line text-5xl text-gray-300 dark:text-gray-600 mb-4"></i>
                                    <p className="text-gray-500 dark:text-gray-400 text-lg mb-2">
                                        {t('article.empty.title')}
                                    </p>
                                    <p className="text-gray-400 dark:text-gray-500 text-sm max-w-md">
                                        {t('article.empty.description')}
                                    </p>
                                </div>
                            )}
                        </div>
                        
                        {(page > 1 || feeds[listState]?.hasNext) && feeds[listState].data.length > 0 && (
                            <div className="mt-8 w-full">
                                <Pagination 
                                    currentPage={page}
                                    totalPages={Math.ceil(feeds[listState]?.size / limit) || 1}
                                    basePath={`/?type=${listState}`}
                                    className="animate-fadeIn"
                                />
                            </div>
                        )}
                    </Waiting>
                </main>
            </Waiting>
        </>
    )
}
