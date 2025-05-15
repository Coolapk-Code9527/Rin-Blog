import {Link} from "wouter";
import {useTranslation} from "react-i18next";
import {timeago} from "../utils/timeago";
import {HashTag} from "./hashtag";
import {SimplifiedMarkdown} from "./markdown";

export function FeedCard({ id, title, avatar, draft, listed, top, summary, hashtags, createdAt, updatedAt }:
    {
        id: string, avatar?: string,
        draft?: number, listed?: number, top?: number,
        title: string, summary: string,
        hashtags: { id: number, name: string }[],
        createdAt: Date, updatedAt: Date
    }) {
    const { t } = useTranslation()

    // 预处理 summary，移除 Markdown 图片链接
    const cleanedSummary = summary ? summary.replace(/!\[.*?\]\(.*?\)/g, "") : ""; 

    return (
        <>
            <Link href={`/feed/${id}`} 
                className={`group block w-full rounded-xl bg-white dark:bg-gray-800 h-full duration-300 overflow-hidden hover:shadow-lg transition-all transform hover:-translate-y-1 border border-gray-200/80 dark:border-gray-700/80 shadow-sm flex flex-col min-h-[280px] focus:outline-none focus:ring-2 focus:ring-theme focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${top === 1 ? 'ring-2 ring-theme/50 dark:ring-theme/70' : ''}`}
                aria-labelledby={`article-title-${id}`}
            >
                {/* 置顶标记 - 如果是置顶文章，在卡片右上角显示一个徽章 */}
                {top === 1 && (
                    <div className="absolute top-3 right-3 z-30 px-2 py-1 bg-theme text-white text-xs rounded-full shadow-md flex items-center">
                        <i className="ri-pushpin-fill mr-1"></i>
                        {t('article.top.title')}
                    </div>
                )}
                
                {/* 卡片顶部区域 */}
                <div className="relative">
                    {avatar ? (
                        <div className="w-full h-48 overflow-hidden relative">
                            {/* 图片上方渐变叠加层，增强阅读体验 */}
                            <div className="absolute inset-0 bg-gradient-to-t from-gray-900/40 via-transparent to-transparent opacity-70 z-10"></div>
                            <img src={avatar} alt={title}
                                className="object-cover w-full h-full transform group-hover:scale-105 transition-transform duration-700" 
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                        </div>
                    ) : (
                        <div className={`h-16 ${top === 1 ? 'bg-gradient-to-r from-theme/5 to-theme/10 dark:from-theme/20 dark:to-theme/30' : 'bg-gray-50 dark:bg-gray-700/30'} flex items-center justify-center`}>
                            {/* 无图片时显示图标 */}
                            <div className="text-gray-400 dark:text-gray-500 opacity-40">
                                <i className="ri-article-line text-3xl"></i>
                            </div>
                        </div>
                    )}
                </div>
                
                {/* 卡片内容区域 */}
                <div className="p-5 flex-1 flex flex-col relative">
                    {/* 文章状态指示 */}
                    <div className="flex flex-wrap gap-2 mb-3">
                        {draft === 1 && 
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-700/50">
                                <i className="ri-draft-line mr-1"></i>
                                {t("draft")}
                            </span>
                        }
                        {listed === 0 && 
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600/50">
                                <i className="ri-eye-off-line mr-1"></i>
                                {t("unlisted")}
                            </span>
                        }
                    </div>
                    
                    {/* 文章标题 */}
                    <h2 id={`article-title-${id}`} className="text-xl font-bold text-gray-800 dark:text-white text-pretty overflow-hidden mb-2 leading-tight group-hover:text-theme dark:group-hover:text-theme transition-colors line-clamp-2">
                        {title}
                    </h2>
                    
                    {/* 时间信息 */}
                    <div className="flex flex-wrap items-center gap-x-3 text-xs text-gray-500 dark:text-gray-400 mb-3">
                        <span className="flex items-center" title={new Date(createdAt).toLocaleString()}>
                            <i className="ri-calendar-line mr-1.5"></i>
                            {createdAt === updatedAt 
                                ? timeago(createdAt) 
                                : t('feed_card.published$time', { time: timeago(createdAt) })}
                        </span>
                        {createdAt !== updatedAt &&
                            <span className="flex items-center" title={new Date(updatedAt).toLocaleString()}>
                                <i className="ri-history-line mr-1.5"></i>
                                {t('feed_card.updated$time', { time: timeago(updatedAt) })}
                            </span>
                        }
                    </div>
                    
                    {/* 文章摘要 */}
                    <div className="text-pretty overflow-hidden dark:text-gray-300 text-gray-600 text-sm leading-relaxed line-clamp-3 min-h-[4.5rem]">
                        <SimplifiedMarkdown content={cleanedSummary} />
                    </div>
                    
                    {/* 标签 - 重新设计标签区域 */}
                    <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-700/50 mt-4">
                        {hashtags.length > 0 ? (
                            <div className="flex flex-row flex-wrap items-center gap-2">
                                {hashtags.map(({id, name}) => (
                                    <div key={id} className="animate-fadeIn">
                                        <HashTag name={name} />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="h-6"></div> // 占位，保持底部对齐
                        )}
                    </div>
                    
                    {/* 悬停时显示的阅读更多指示器 */}
                    <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <span className="text-xs text-theme flex items-center font-medium">
                            {t('read_more')} 
                            <i className="ri-arrow-right-line ml-1"></i>
                        </span>
                    </div>
                </div>
            </Link>
        </>
    )
}