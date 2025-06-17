import React from "react"
import { useEffect, useRef, useState } from "react"
import { Helmet } from 'react-helmet-async'
import { useTranslation } from "react-i18next"
import { Link, useSearch } from "wouter"
import { FeedCard } from "../components/feed_card"
import { Waiting } from "../components/loading"
import { Pagination } from "../components/pagination"
import { client } from "../main"
import { headersWithAuth } from "../utils/auth"
import { siteName } from "../utils/constants"
import { tryInt } from "../utils/int"
import { PageContainer } from "../components/container"
import { useGlassEffect, GLASS_LAYERS } from "../hooks/useGlassEffect"

type FeedsData = {
    size: number,
    data: any[],
    hasNext: boolean
}

export function SearchPage({ keyword }: { keyword: string }) {
    const { t } = useTranslation()
    const query = new URLSearchParams(useSearch());
    const [status, setStatus] = useState<'loading' | 'idle'>('idle')
    const [feeds, setFeeds] = useState<FeedsData>()
    const page = tryInt(1, query.get("page"))
    const limit = tryInt(10, query.get("limit"), process.env.PAGE_SIZE)
    const ref = useRef("")

    // 使用智能毛玻璃效果
    const glassClass = useGlassEffect(GLASS_LAYERS.LIGHT);
    function fetchFeeds() {
        if (!keyword) return
        client.search({ keyword }).get({
            query: {
                page: page,
                limit: limit
            },
            headers: headersWithAuth()
        }).then(({ data }) => {
            if (data && typeof data !== 'string') {
                setFeeds(data)
                setStatus('idle')
            }
        })
    }
    useEffect(() => {
        const key = `${page} ${limit} ${keyword}`
        if (ref.current == key) return
        setStatus('loading')
        fetchFeeds()
        ref.current = key
    }, [page, limit, keyword])
    const title = t('article.search.title$keyword', { keyword })
    return (
        <>
            <Helmet>
                <title>{`${title} - ${process.env.NAME}`}</title>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={title} />
                <meta property="og:image" content={process.env.AVATAR} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={document.URL} />
            </Helmet>
            <PageContainer>
                <Waiting for={status === 'idle'}>
                    <main className="w-full flex flex-col justify-center items-center mb-8">
                        {/* 页面标题区域 - 与文章列表页面保持一致 */}
                        <div className="flex flex-col space-y-3 mb-3">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-2 sm:py-3 gap-3 sm:gap-3">
                                {/* 左侧：标题和搜索结果数量 - 优化移动端布局 */}
                                <div className="flex flex-row items-center gap-2 sm:gap-3 w-full sm:w-auto flex-wrap">
                                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white relative group flex-shrink-0">
                                        {t('article.search.title')}
                                        <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-theme group-hover:w-full transition-all duration-300"></span>
                                    </h1>
                                    <div className={`py-1.5 px-2.5 sm:px-3 ${glassClass} rounded-xl text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 flex items-center font-medium border border-neutral-200/40 dark:border-neutral-700/40 flex-shrink-0`}>
                                        <i className="ri-search-line text-theme text-xs sm:text-sm"></i>
                                        <span className="ml-1 sm:ml-1.5">{t('article.total$count', { count: feeds?.size })}</span>
                                    </div>
                                </div>
                            </div>

                            {/* 上方渐变分割线 */}
                            <div className="w-full mb-2">
                                <hr className="h-0.5 border-0 bg-gradient-to-r from-transparent via-theme/40 dark:via-theme/30 to-transparent" />
                            </div>
                        </div>
                        <Waiting for={status === 'idle'}>
                            <div className="wauto flex flex-col">
                                {feeds?.data.map(({ id, ...feed }: any) => (
                                    <FeedCard key={id} id={id} {...feed} />
                                ))}
                            </div>
                            
                            {(page > 1 || feeds?.hasNext) && (
                                <Pagination 
                                    currentPage={page}
                                    totalPages={Math.ceil(feeds?.size / limit) || 1}
                                    basePath={`/search/${keyword}`}
                                    className="ani-show"
                                />
                            )}
                        </Waiting>


                    </main>
                </Waiting>
            </PageContainer>
        </>
    )
}
