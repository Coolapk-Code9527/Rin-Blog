import React from "react"
import { Helmet } from 'react-helmet'
import { Link, useLocation } from "wouter"
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
    const [location] = useLocation();
    // 获取查询字符串部分
    const searchPart = location.indexOf('?') > -1 ? location.substring(location.indexOf('?')) : "";
    const query = new URLSearchParams(searchPart);

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
    }, [location])
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
                <main className="w-full flex flex-col justify-center items-center mb-8">
                    <div className="wauto max-w-screen-xl w-full text-start text-black dark:text-white py-3 px-4">
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">
                            {listState === 'draft' ? t('draft_bin') : listState === 'normal' ? t('article.title') : t('unlisted')}
                        </h1>
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mt-2">
                            <p className="text-sm text-neutral-500 font-normal">
                                {t('article.total$count', { count: feeds[listState]?.size })}
                            </p>
                            {profile?.permission &&
                                <div className="flex flex-row space-x-4 mt-2 sm:mt-0">
                                    <Link href={listState === 'draft' ? '/?type=normal' : '/?type=draft'} className={`text-sm text-neutral-500 font-normal ${listState === 'draft' ? "text-theme" : ""}`}>
                                        {t('draft_bin')}
                                    </Link>
                                    <Link href={listState === 'unlisted' ? '/?type=normal' : '/?type=unlisted'} className={`text-sm text-neutral-500 font-normal ${listState === 'unlisted' ? "text-theme" : ""}`}>
                                        {t('unlisted')}
                                    </Link>
                                </div>
                            }
                        </div>
                    </div>
                    
                    <Waiting for={status === 'idle'}>
                        <div className="wauto max-w-screen-xl w-full px-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 ani-show">
                                {feeds[listState].data.map(({ id, ...feed }: any) => (
                                    <FeedCard key={id} id={id} {...feed} />
                                ))}
                            </div>
                            
                            {(page > 1 || feeds[listState]?.hasNext) && (
                                <Pagination 
                                    currentPage={page}
                                    totalPages={Math.ceil(feeds[listState]?.size / limit) || 1}
                                    basePath={`/?type=${listState}`}
                                    className="ani-show mt-6"
                                />
                            )}
                        </div>
                    </Waiting>
                </main>
            </Waiting>
        </>
    )
}
