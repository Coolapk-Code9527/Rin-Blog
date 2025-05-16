import React, { useState, useEffect } from "react"
import {Helmet} from 'react-helmet'
import {Link, useLocation} from "wouter"
import {Waiting} from "../components/loading"
import {client} from "../main"
import {headersWithAuth} from "../utils/auth"
import {siteName} from "../utils/constants"
import {useTranslation} from "react-i18next";


export function TimelinePage() {
    const [feeds, setFeeds] = useState<Partial<Record<number, { id: number; title: string | null; createdAt: Date; }[]>>>()
    const [length, setLength] = useState(0)
    const { t } = useTranslation()
    const [location] = useLocation();
    const [error, setError] = useState<string | null>(null);

    function fetchFeeds() {
        setError(null);
        client.feed.timeline.get({
            headers: headersWithAuth()
        }).then(({ data }) => {
            if (data && typeof data !== 'string') {
                setLength(data.length)
                const groups = Object.groupBy(data, ({ createdAt }) => new Date(createdAt).getFullYear())
                setFeeds(groups)
                setError(null);
            } else if (data === null || (typeof data === 'object' && Object.keys(data).length === 0)) {
                setLength(0);
                setFeeds({});
                setError(null);
            }
        }).catch(error => {
            console.error("Error fetching timeline feeds:", error);
            setLength(0);
            setFeeds({});
            setError(t('load_failed') || '加载失败');
        })
    }

    useEffect(() => {
        fetchFeeds()
    }, [location[0]])

    return (
        <>
            <Helmet>
                <title>{`${t('timeline')} - ${process.env.NAME}`}</title>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={t('timeline')} />
                <meta property="og:image" content={process.env.AVATAR} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={document.URL} />
            </Helmet>
            <Waiting for={feeds}>
                <main className="w-full flex flex-col justify-center items-center mb-8 ani-show">
                    <div className="wauto text-start text-black dark:text-white py-4 text-4xl font-bold">
                        <p>
                            {t('timeline')}
                        </p>
                        <div className="flex flex-row justify-between">
                            <p className="text-sm mt-4 text-neutral-500 font-normal">
                                {t('article.total$count', { count: length })}
                            </p>
                        </div>
                        {error && (
                          <div className="mt-2 mb-4 flex flex-col items-start">
                            <span className="text-red-500 text-sm mb-2">{error}</span>
                            <button 
                                onClick={fetchFeeds} 
                                className="px-4 py-2 bg-theme text-white rounded hover:bg-theme-dark dark:bg-theme-dark dark:hover:bg-theme-light focus:outline-none focus:ring-2 focus:ring-theme-focus"
                                aria-label={t('reload') || "Reload"}
                            >
                                {t('reload')}
                            </button>
                          </div>
                        )}
                    </div>
                    {feeds && Object.keys(feeds).sort((a, b) => parseInt(b) - parseInt(a)).map(year => (
                        <div key={year} className="wauto flex flex-col justify-center items-start">
                            <h1 className="flex flex-row items-center space-x-2">
                                <span className="text-2xl font-bold t-primary ">
                                    {t('year$year', { year: year })}
                                </span>
                                <span className="text-sm t-secondary">
                                    {t('article.total_short$count', { count: feeds[+year]?.length })}
                                    </span>
                            </h1>
                            <div className="w-full flex flex-col justify-center items-start my-4">
                                {feeds[+year]?.map(({ id, title, createdAt }) => (
                                    <FeedItem key={id} id={id.toString()} title={title || t('unlisted')} createdAt={new Date(createdAt)} />
                                ))}
                            </div>
                        </div>
                    ))}
                </main>
            </Waiting>
        </>
    )
}

export function FeedItem({ id, title, createdAt }: { id: string, title: string, createdAt: Date }) {
    const { t } = useTranslation();
    const locale = t('date_format.month_day', { returnObjects: true });
    const formatter = new Intl.DateTimeFormat(undefined, { day: '2-digit', month: '2-digit', year: undefined });
    return (
        <div className="flex flex-row pl-8">
            <div className="flex flex-row items-center">
                <div className="w-2 h-2 bg-theme rounded-full"></div>
            </div>
            <div className="flex-1 rounded-2xl m-2 duration-300 flex flex-row items-center space-x-4   ">
                <span className="t-secondary text-sm" title={new Date(createdAt).toLocaleString()}>
                    {formatter.format(new Date(createdAt))}
                </span>
                <Link href={`/feed/${id}`} target="_blank" className="text-base t-primary hover:text-theme text-pretty overflow-hidden">
                    {title}
                </Link>
            </div>
        </div>
    )
}