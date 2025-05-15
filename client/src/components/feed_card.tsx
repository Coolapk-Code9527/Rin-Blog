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

    // 判断是否为"今天"发布的文章
    const isToday = () => {
        const today = new Date();
        const pubDate = new Date(createdAt);
        return today.getDate() === pubDate.getDate() && 
               today.getMonth() === pubDate.getMonth() &&
               today.getFullYear() === pubDate.getFullYear();
    };
    
    // 格式化日期显示
    const formatDate = (date: Date) => {
        const d = new Date(date);
        return `${d.getMonth()+1}-${d.getDate()}`;
    };

    return (
        <Link href={`/feed/${id}`} 
            className={`group block w-full rounded-2xl bg-white dark:bg-gray-800 h-full duration-300 overflow-hidden hover:shadow-lg transition-all transform hover:-translate-y-1 border ${top === 1 
                ? 'border-theme/30 dark:border-theme/20 shadow-md' 
                : 'border-gray-100 dark:border-gray-700 shadow-sm'} 
                flex flex-col min-h-[260px] xs:min-h-[280px] focus:outline-none focus:ring-2 focus:ring-theme focus:ring-offset-2 dark:focus:ring-offset-gray-900`}
            aria-labelledby={`article-title-${id}`}
        >
            {/* 卡片顶部区域 */}
            {avatar ? (
                <div className="w-full h-40 xs:h-48 overflow-hidden rounded-t-xl relative">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent opacity-40 group-hover:opacity-60 transition-opacity duration-300 z-10"></div>
                    <img src={avatar} alt={title}
                        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-700" 
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                        }}
                    />
                    {/* 置顶标识 */}
                    {top === 1 && (
                        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-theme text-white text-xs font-medium px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full shadow-md z-20 flex items-center">
                            <i className="ri-pushpin-fill mr-1"></i>
                            <span className="hidden xs:inline">{t('article.top.title')}</span>
                        </div>
                    )}
                    
                    {/* 今日发布标识 */}
                    {isToday() && (
                        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-emerald-500 text-white text-xs font-medium px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full shadow-md z-20 flex items-center">
                            <i className="ri-time-line mr-1"></i>
                            <span className="hidden xs:inline">{t('today')}</span>
                        </div>
                    )}
                </div>
            ) : (
                <div className={`h-16 sm:h-20 ${top === 1 
                    ? 'bg-gradient-to-r from-theme/5 via-theme/10 to-theme/5' 
                    : 'bg-gray-50 dark:bg-gray-800/40'} rounded-t-xl flex items-center justify-center relative`}>
                    {/* 置顶标识 */}
                    {top === 1 && (
                        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-theme text-white text-xs font-medium px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full shadow-md z-20 flex items-center">
                            <i className="ri-pushpin-fill mr-1"></i>
                            <span className="hidden xs:inline">{t('article.top.title')}</span>
                        </div>
                    )}
                    
                    {/* 今日发布标识 */}
                    {isToday() && (
                        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-emerald-500 text-white text-xs font-medium px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full shadow-md z-20 flex items-center">
                            <i className="ri-time-line mr-1"></i>
                            <span className="hidden xs:inline">{t('today')}</span>
                        </div>
                    )}
                    
                    <div className={`text-gray-400 dark:text-gray-500 ${top === 1 ? 'opacity-30' : 'opacity-20'}`}>
                        <i className="ri-article-line text-3xl"></i>
                    </div>
                </div>
            )}
            
            {/* 卡片内容区域 */}
            <div className="p-4 sm:p-5 flex-1 flex flex-col">
                {/* 文章标题 */}
                <h2 id={`article-title-${id}`} className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white text-pretty overflow-hidden mb-1 sm:mb-2 leading-tight group-hover:text-theme dark:group-hover:text-theme transition-colors line-clamp-2">
                    {title}
                </h2>
                
                {/* 日期和状态区域 - 移动端紧凑设计 */}
                <div className="flex flex-wrap justify-between items-center gap-1 mb-2 text-xs text-gray-500 dark:text-gray-400">
                    {/* 左侧日期显示 */}
                    <div className="flex items-center">
                        <i className="ri-calendar-line mr-1"></i>
                        {formatDate(createdAt)}
                        {createdAt !== updatedAt && 
                            <span className="ml-2 flex items-center" title={new Date(updatedAt).toLocaleString()}>
                                <i className="ri-history-line mr-1"></i>
                                {formatDate(updatedAt)}
                            </span>
                        }
                    </div>
                    
                    {/* 右侧状态显示 */}
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                        {draft === 1 && 
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700/80 text-gray-600 dark:text-gray-300">
                                <i className="ri-draft-line mr-0.5 sm:mr-1"></i>
                                <span className="hidden xs:inline">{t("draft")}</span>
                            </span>
                        }
                        {listed === 0 && 
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700/80 text-gray-600 dark:text-gray-300">
                                <i className="ri-eye-off-line mr-0.5 sm:mr-1"></i>
                                <span className="hidden xs:inline">{t("unlisted")}</span>
                            </span>
                        }
                    </div>
                </div>
                
                {/* 文章摘要 */}
                <div className="text-pretty overflow-hidden dark:text-gray-300 text-gray-600 text-xs sm:text-sm leading-relaxed line-clamp-3 min-h-[3.6rem] sm:min-h-[4.5rem] group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors">
                    <SimplifiedMarkdown content={cleanedSummary} />
                </div>
                
                {/* 标签区域 */}
                <div className="mt-auto pt-2 sm:pt-3 border-t border-gray-100 dark:border-gray-700/30 mt-2 sm:mt-4">
                    {hashtags.length > 0 ? (
                        <div className="flex flex-row flex-wrap items-center gap-1.5 sm:gap-2">
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
            </div>
        </Link>
    )
}