import { useContext, useEffect, useRef, useState, useCallback } from "react"
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

// 懒加载Feed卡片组件
function LazyFeedCard({ id, ...props }: any) {
    const [isVisible, setIsVisible] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
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
                <div className="w-full h-[260px] xs:h-[280px] bg-gray-50 dark:bg-gray-800/20 rounded-2xl animate-pulse shadow-sm border border-gray-100 dark:border-gray-700"></div>
            )}
        </div>
    );
}

// 空状态组件 - 提供更友好的空数据显示
function EmptyState({ type }: { type: FeedType }) {
    const { t } = useTranslation();
    
    // 不同类型文章的空状态展示
    const getEmptyStateContent = () => {
        switch(type) {
            case 'draft':
                return {
                    icon: 'ri-draft-line',
                    title: t('no_drafts'),
                    description: t('no_drafts_description') || '你还没有创建任何草稿。开始写作，系统会自动保存你的草稿。'
                };
            case 'unlisted':
                return {
                    icon: 'ri-eye-off-line',
                    title: t('no_unlisted'),
                    description: t('no_unlisted_description') || '你还没有未列出的文章。设置文章为"未列出"可以隐藏它们不在首页显示。'
                };
            default:
                return {
                    icon: 'ri-article-line',
                    title: t('no_articles'),
                    description: t('no_articles_description') || '还没有发布任何文章。发布你的第一篇文章，与世界分享你的想法！'
                };
        }
    };
    
    const content = getEmptyStateContent();
    
    return (
        <div className="col-span-full py-16 sm:py-20 flex flex-col items-center justify-center text-center rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20 animate-fadeIn">
            <div className="w-16 h-16 mb-4 rounded-full bg-gray-100 dark:bg-gray-800/50 flex items-center justify-center">
                <i className={`${content.icon} text-3xl text-gray-400 dark:text-gray-500`}></i>
            </div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">{content.title}</h3>
            <p className="max-w-md text-sm text-gray-500 dark:text-gray-400 mb-6">{content.description}</p>
            
            {type !== 'normal' && (
                <Link href="/?type=normal" className="px-4 py-2 bg-theme/10 text-theme rounded-full text-sm font-medium transition-colors hover:bg-theme/20 focus:outline-none focus:ring-2 focus:ring-theme focus:ring-offset-2 dark:focus:ring-offset-gray-900">
                    <i className="ri-arrow-left-line mr-1"></i>
                    {t('back_to_articles')}
                </Link>
            )}
        </div>
    );
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
    
    // 使用useCallback优化函数
    const fetchFeeds = useCallback((type: FeedType) => {
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
                
                // 预加载下一页数据
                if (data.hasNext) {
                    setTimeout(() => {
                        client.feed.index.get({
                            query: {
                                page: page + 1,
                                limit: limit,
                                type: type
                            },
                            headers: headersWithAuth()
                        });
                    }, 2000);
                }
                
                setStatus('idle')
            }
        })
    }, [page, limit, feeds]);
    
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
    }, [query.get("page"), query.get("type"), fetchFeeds])
    
    // 计算总页数
    const totalPages = Math.ceil(feeds[listState]?.size / limit) || 1;
    
    // 获取类型按钮样式
    const getTypeButtonStyle = (type: FeedType) => {
        return listState === type 
            ? "bg-theme/10 text-theme ring-1 ring-theme/30 shadow-sm" 
            : "bg-gray-100 dark:bg-gray-800/80 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700";
    };
    
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
                        {/* 页面标题和过滤器区域 */}
                        <div className="flex flex-col space-y-4 mb-8 animate-fadeIn">
                            {/* 标题和篇数统计区域 */}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-6 border-b border-gray-200/50 dark:border-gray-700/50">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 mb-4 sm:mb-0">
                                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white relative group">
                                        {listState === 'draft' ? t('draft_bin') : listState === 'normal' ? t('article.title') : t('unlisted')}
                                        <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-theme group-hover:w-full transition-all duration-300"></span>
                                    </h1>
                                    <div className="inline-flex px-3 py-1 mt-2 sm:mt-0 bg-gray-100 dark:bg-gray-800/80 rounded-full text-xs text-gray-500 dark:text-gray-400 font-medium backdrop-blur-sm self-start sm:self-auto items-center">
                                        <i className="ri-article-line mr-1.5"></i>
                                        {t('article.total$count', { count: feeds[listState]?.size })}
                                    </div>
                                </div>
                                
                                {/* 类型筛选按钮组 */}
                                {profile?.permission && (
                                    <div className="flex items-center space-x-2 sm:space-x-3 overflow-x-auto pb-1 hide-scrollbar">
                                        <Link href="/?type=normal" 
                                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center ${getTypeButtonStyle('normal')}`}>
                                            <i className="ri-article-line mr-1.5"></i>
                                            {t('published')}
                                        </Link>
                                        <Link href="/?type=draft" 
                                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center ${getTypeButtonStyle('draft')}`}>
                                            <i className="ri-draft-line mr-1.5"></i>
                                            <span>{t('draft_bin')}</span>
                                        </Link>
                                        <Link href="/?type=unlisted" 
                                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center ${getTypeButtonStyle('unlisted')}`}>
                                            <i className="ri-eye-off-line mr-1.5"></i>
                                            <span>{t('unlisted')}</span>
                                        </Link>
                                    </div>
                                )}
                            </div>
                            
                            {/* 描述和工具栏区域 - 不显示静态文本 */}
                            <div className="flex justify-end items-center flex-wrap gap-2">
                                <div className="flex space-x-2">
                                    {profile?.permission && (
                                        <Link href="/edit" className="inline-flex items-center px-4 py-2 bg-theme text-white rounded-full text-sm font-medium transition-all hover:bg-theme-dark focus:outline-none focus:ring-2 focus:ring-theme focus:ring-offset-2 dark:focus:ring-offset-gray-900">
                                            <i className="ri-add-line mr-1.5"></i>
                                            {t('new_article')}
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        {/* 内容区域 */}
                        <Waiting for={status === 'idle'}>
                            {/* 文章列表 */}
                            {feeds[listState].data.length > 0 ? (
                                <div className="space-y-8 animate-fadeIn">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                                        {feeds[listState].data.map(({ id, ...feed }: any) => (
                                            <LazyFeedCard key={id} id={id} {...feed} />
                                        ))}
                                    </div>
                                    
                                    {/* 分页组件 */}
                                    {(totalPages > 1) && (
                                        <Pagination 
                                            currentPage={page}
                                            totalPages={totalPages}
                                            basePath={`/?type=${listState}`}
                                            className="animate-fadeIn mt-8"
                                        />
                                    )}
                                </div>
                            ) : (
                                <EmptyState type={listState} />
                            )}
                        </Waiting>
                    </div>
                    
                    {/* 添加页脚区域，代替之前的分割线 */}
                    <div className="w-full max-w-6xl mt-12 pt-8 border-t border-gray-100 dark:border-gray-800">
                        <div className="text-center text-xs text-gray-400 dark:text-gray-500">
                            <p>© {new Date().getFullYear()} Rin Blog</p>
                        </div>
                    </div>
                </main>
            </Waiting>
        </>
    )
}
