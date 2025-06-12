import React, { useState, useEffect } from "react"
import {Helmet} from 'react-helmet-async'
import {Link, useLocation} from "wouter"
import {Waiting} from "../components/loading"
import {client} from "../main"
import {headersWithAuth} from "../utils/auth"
import {siteName} from "../utils/constants"
import {useTranslation} from "react-i18next";
import { PageContainer } from "../components/container";

// Object.groupBy polyfill（如原生不支持则自动挂载）
if (!Object.groupBy) {
    Object.groupBy = function <T, K extends PropertyKey>(array: Iterable<T>, keySelector: (item: T, index: number, array?: Iterable<T>) => K): Partial<Record<K, T[]>> {
        const result: Partial<Record<K, T[]>> = {};
        let idx = 0;
        for (const item of array) {
            const key = keySelector(item, idx++, array);
            (result[key] = result[key] || []).push(item);
        }
        return result;
    } as any;
}

export function TimelinePage() {
    const [feeds, setFeeds] = useState<Partial<Record<number, { id: number; title: string | null; createdAt: number; }[]>>>()
    const [length, setLength] = useState(0)
    const { t } = useTranslation()
    const [location] = useLocation();
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    function fetchFeeds() {
        setError(null);
        setLoading(true);
        client.feed.timeline.get({
            headers: headersWithAuth()
        }).then(({ data, error: apiError }) => {
            setLoading(false);
            if (apiError) {
                setError(apiError.value as string);
                setFeeds({});
                return;
            }
            
            if (data && typeof data !== 'string') {
                setLength(data.length)
                const groups = (Object.groupBy as any)(
                  data,
                  (item: any, idx: number, array: any) => new Date(item.createdAt).getFullYear()
                );
                setFeeds(groups)
                setError(null);
            } else if (data === null || (typeof data === 'object' && Object.keys(data).length === 0)) {
                setLength(0);
                setFeeds({});
                setError(null);
            }
        }).catch(err => {
            console.error("Error fetching timeline feeds:", err);
            setLoading(false);
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
                    <PageContainer>
                        <div className="wauto text-start text-black dark:text-white py-4 text-2xl font-bold">
                            <p>
                                {t('timeline')}
                            </p>
                            <div className="flex flex-row justify-between">
                                <p className="text-base font-medium t-secondary">
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
                                  disabled={loading}
                                >
                                  {loading ? 
                                    <span className="flex items-center">
                                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                      </svg>
                                      {t('loading')}
                                    </span> : 
                                    t('reload')
                                  }
                                </button>
                              </div>
                            )}
                        </div>
                        {feeds && Object.keys(feeds).length > 0 ? (
                          Object.keys(feeds).sort((a, b) => parseInt(b) - parseInt(a)).map(year => (
                            <div key={year} className="wauto flex flex-col justify-center items-start">
                              <h1 className="flex flex-row items-center space-x-2">
                                <span className="text-2xl font-bold t-primary ">
                                  {t('year$year', { year: year })}
                                </span>
                                <span className="text-base font-medium t-secondary">
                                  {t('article.total_short$count', { count: feeds[+year]?.length })}
                                </span>
                              </h1>
                              <div className="w-full flex flex-col justify-center items-start my-4">
                                {feeds[+year]?.map((feed) => (
                                  <FeedItem key={feed.id} id={feed.id.toString()} title={feed.title || t('unlisted')} createdAt={feed.createdAt} />
                                ))}
                              </div>
                            </div>
                          ))
                        ) : !error && (
                          <div className="mt-8 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm text-center">
                            <div className="w-12 h-12 mx-auto bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3">
                              <i className="ri-calendar-line text-xl text-gray-500"></i>
                            </div>
                            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">
                              {t('no_more')}
                            </h3>
                          </div>
                        )}
                    </PageContainer>
                </main>
            </Waiting>
        </>
    )
}

export function FeedItem({ id, title, createdAt, ...rest }: { id: string, title: string, createdAt: number } & Record<string, any>) {
    const { t } = useTranslation();
    const locale = t('date_format.month_day', { returnObjects: true });
    const formatter = new Intl.DateTimeFormat(undefined, { day: '2-digit', month: '2-digit', year: undefined });
    return (
        <div className="flex flex-row pl-8" {...rest}>
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