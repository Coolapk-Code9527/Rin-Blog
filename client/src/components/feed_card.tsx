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
                className="group block w-full rounded-2xl bg-w h-full duration-300 bg-button overflow-hidden hover:shadow-lg transition-all transform hover:-translate-y-1 border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col min-h-[280px] focus:outline-none focus:ring-2 focus:ring-theme focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                aria-labelledby={`article-title-${id}`}
            >
                {avatar ? (
                    <div className="w-full h-48 overflow-hidden rounded-t-2xl relative">
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10"></div>
                        <img src={avatar} alt={title}
                            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-700" 
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                        />
                    </div>
                ) : (
                    <div className="h-3"></div>
                )}
                <div className="p-5 flex-1 flex flex-col">
                    {/* 文章状态指示 */}
                    {(top === 1 || draft === 1 || listed === 0) && 
                        <div className="flex flex-wrap gap-2 mb-2">
                            {top === 1 && 
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-theme/10 text-theme">
                                    <i className="ri-thumb-up-fill mr-1"></i>
                                    {t('article.top.title')}
                                </span>
                            }
                            {draft === 1 && 
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                                    <i className="ri-draft-line mr-1"></i>
                                    {t("draft")}
                                </span>
                            }
                            {listed === 0 && 
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                                    <i className="ri-eye-off-line mr-1"></i>
                                    {t("unlisted")}
                                </span>
                            }
                        </div>
                    }
                    
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
                    <div className="text-pretty overflow-hidden dark:text-gray-300 text-gray-600 text-sm mb-3 leading-relaxed line-clamp-3 min-h-[4.5rem]">
                        <SimplifiedMarkdown content={cleanedSummary} />
                    </div>
                    
                    {/* 标签 - 使用mt-auto将标签推到底部 */}
                    {hashtags.length > 0 &&
                        <div className="mt-auto pt-3 flex flex-row flex-wrap items-center gap-2 border-t border-gray-100 dark:border-gray-800">
                            {hashtags.map(({id, name}) => (
                                <div key={id} className="animate-fadeIn">
                                    <HashTag name={name} />
                                </div>
                            ))}
                        </div>
                    }
                </div>
            </Link>
        </>
    )
}