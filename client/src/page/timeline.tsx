import React, { useState, useEffect } from "react"
import {Helmet} from 'react-helmet-async'
import {Link, useLocation} from "wouter"
import {Waiting} from "../components/loading"
import {client} from "../main"
import {headersWithAuth} from "../utils/auth"
import {siteName} from "../utils/constants"
import {useTranslation} from "react-i18next";
import { PageContainer } from "../components/container";
import { Timeline } from "../components/timeline";
import {useGlassEffect} from "../hooks/useGlassEffect";

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
    const [feeds, setFeeds] = useState<Partial<Record<number, any[]>>>();
    const [length, setLength] = useState(0);
    const { t } = useTranslation();

    // 使用智能毛玻璃效果
    const tagGlassClass = useGlassEffect('tag-enhanced');
    const [location] = useLocation();
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    function fetchFeeds() {
        setError(null);
        setLoading(true);
        // 获取完整文章列表（含摘要、标签、图片等）
        client.feed.index.get({
            query: { page: 1, limit: 9999 },
            headers: headersWithAuth()
        }).then(({ data, error: apiError }) => {
            setLoading(false);
            if (apiError) {
                setError(apiError.value as string);
                setFeeds({});
                return;
            }
            if (data && typeof data !== 'string') {
                setLength(data.size || data.data.length);
                // 按年份分组
                const groups = (Object.groupBy as any)(
                  data.data,
                  (item: any, idx: number, array: any) => new Date(item.createdAt).getFullYear()
                );
                setFeeds(groups);
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
        });
    }

    useEffect(() => {
        fetchFeeds();
    }, [location[0]]);

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
                        {/* 页面标题区域 - 与文章列表页面保持一致 */}
                        <div className="flex flex-col space-y-3 mb-3">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-2 sm:py-3 gap-3 sm:gap-3">
                                {/* 左侧：标题和文章数量 - 优化移动端布局 */}
                                <div className="flex flex-row items-center gap-2 sm:gap-3 w-full sm:w-auto flex-wrap">
                                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white relative group flex-shrink-0">
                                        {t('timeline')}
                                        <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-theme group-hover:w-full transition-all duration-300"></span>
                                    </h1>
                                    <div className={`py-1.5 px-2.5 sm:px-3 ${tagGlassClass} rounded-xl text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 flex items-center font-medium border border-neutral-200/60 dark:border-neutral-700/60 flex-shrink-0`}>
                                        <i className="ri-time-line text-theme text-xs sm:text-sm"></i>
                                        <span className="ml-1 sm:ml-1.5">{t('article.total$count', { count: length })}</span>
                                    </div>
                                </div>
                            </div>

                            {/* 上方渐变分割线 */}
                            <div className="w-full mb-2">
                                <hr className="h-0.5 border-0 bg-gradient-to-r from-transparent via-theme/40 dark:via-theme/30 to-transparent" />
                            </div>
                        </div>

                        {error && (
                          <div className="mt-2 mb-4 flex flex-col items-start">
                            <span className="text-red-500 text-sm mb-2">{error}</span>
                            <button
                              onClick={fetchFeeds}
                              className="px-4 py-2.5 bg-theme text-white rounded-xl hover:bg-theme-hover active:bg-theme-active focus:outline-none focus:ring-2 focus:ring-theme/30 focus:ring-offset-2 dark:focus:ring-offset-gray-900 shadow-enhanced hover:shadow-enhanced-lg transition-all duration-200 ease-out transform hover:scale-[0.98] active:scale-[0.96] disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
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
                        {/* 使用Timeline组件渲染分组数据，内容丰富、响应式、交互体验升级 */}
                        <Timeline feeds={feeds} error={error} t={t} />


                    </PageContainer>
                </main>
            </Waiting>
        </>
    );
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