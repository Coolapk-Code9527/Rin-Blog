import {Link} from "wouter";
import {useTranslation} from "react-i18next";
import {timeago} from "../utils/timeago";
import {HashTag} from "./hashtag";
import {SimplifiedMarkdown} from "./markdown";
import React, {useState} from "react";
import {OptimizedImage} from "./optimized-image";

export function FeedCard({ id, title, avatar, draft, listed, top, summary, hashtags, createdAt, updatedAt }:
    {
        id: string, avatar?: string,
        draft?: number, listed?: number, top?: number,
        title: string, summary: string,
        hashtags: { id: number, name: string }[],
        createdAt: Date, updatedAt: Date
    }) {
    const { t } = useTranslation();
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [hovered, setHovered] = useState(false);

    // 预处理 summary，移除 Markdown 图片链接
    const cleanedSummary = summary ? summary.replace(/!\[.*?\]\(.*?\)/g, "").trim() : ""; 

    // 计算阅读时间（假设平均阅读速度为每分钟200字）
    const calculateReadTime = () => {
        if (!cleanedSummary) return 1;
        const wordCount = cleanedSummary.split(/\s+/).length;
        const readTime = Math.ceil(wordCount / 200);
        return Math.max(1, readTime); // 至少1分钟
    };
    
    const readTime = calculateReadTime();

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

    // 预加载文章详情页（当用户悬停卡片时）
    const prefetchArticle = () => {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = `/feed/${id}`;
        document.head.appendChild(link);
    };

    return (
        <Link href={`/feed/${id}`} 
            className={`group block w-full rounded-2xl bg-white dark:bg-gray-800 h-full duration-300 overflow-hidden 
                ${hovered ? 'shadow-xl translate-y-[-4px]' : 'shadow-sm hover:shadow-lg hover:-translate-y-1'} 
                border ${top === 1 
                ? 'border-theme/30 dark:border-theme/20' 
                : 'border-gray-100 dark:border-gray-700'} 
                flex flex-col min-h-[260px] xs:min-h-[280px] focus:outline-none focus:ring-2 focus:ring-theme focus:ring-offset-2 dark:focus:ring-offset-gray-900
                transition-all transform`}
            aria-labelledby={`article-title-${id}`}
            onMouseEnter={() => {
                setHovered(true);
                prefetchArticle();
            }}
            onMouseLeave={() => setHovered(false)}
            onFocus={() => setHovered(true)}
            onBlur={() => setHovered(false)}
        >
            {/* 卡片顶部区域 */}
            {avatar ? (
                <div className="w-full h-40 xs:h-48 overflow-hidden rounded-t-xl relative">
                    <div className={`absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent opacity-40 ${hovered ? 'opacity-60' : 'group-hover:opacity-60'} transition-opacity duration-300 z-10`}></div>
                    
                    {/* 使用优化的图片组件 */}
                    <OptimizedImage 
                        src={avatar} 
                        alt={title}
                        className="w-full h-full"
                        objectFit="cover"
                        lazyLoad={true}
                        blur={false}
                        quality={90}
                        onLoad={() => setImageLoaded(true)}
                        onError={() => setImageError(true)}
                    />
                    
                    {/* 卡片标识和状态指示器容器 - 统一样式并添加毛玻璃效果 */}
                    <div className="absolute top-0 left-0 right-0 flex justify-between items-start p-2 sm:p-3 z-20">
                        {/* 左侧指示器组：今日发布 */}
                        <div className="flex flex-col gap-2">
                            {/* 今日发布标识 */}
                            {isToday() && (
                                <div className="flex items-center px-2 py-0.5 sm:px-2.5 sm:py-1 bg-emerald-500/90 text-white text-xs font-medium rounded-full shadow-sm backdrop-blur-sm">
                                    <i className="ri-time-line mr-1"></i>
                                    <span className="hidden xs:inline">{t('today')}</span>
                                </div>
                            )}
                        </div>
                        
                        {/* 右侧指示器组：置顶、草稿、未列出 */}
                        <div className="flex flex-col gap-2 items-end">
                            {/* 置顶标识 */}
                            {top === 1 && (
                                <div className="flex items-center px-2 py-0.5 sm:px-2.5 sm:py-1 bg-theme/90 text-white text-xs font-medium rounded-full shadow-sm backdrop-blur-sm">
                                    <i className="ri-pushpin-fill mr-1"></i>
                                    <span className="hidden xs:inline">{t('article.top.title')}</span>
                                </div>
                            )}
                            
                            {/* 草稿标识 */}
                            {draft === 1 && (
                                <div className="flex items-center px-2 py-0.5 sm:px-2.5 sm:py-1 bg-amber-500/90 text-white text-xs font-medium rounded-full shadow-sm backdrop-blur-sm">
                                    <i className="ri-draft-line mr-1"></i>
                                    <span className="hidden xs:inline">{t('draft')}</span>
                                </div>
                            )}
                            
                            {/* 未列出标识 */}
                            {listed === 0 && (
                                <div className="flex items-center px-2 py-0.5 sm:px-2.5 sm:py-1 bg-gray-500/90 text-white text-xs font-medium rounded-full shadow-sm backdrop-blur-sm">
                                    <i className="ri-eye-off-line mr-1"></i>
                                    <span className="hidden xs:inline">{t('unlisted')}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className={`h-40 xs:h-48 ${top === 1 
                    ? 'bg-gradient-to-r from-theme/5 via-theme/10 to-theme/5' 
                    : 'bg-gradient-to-b from-gray-100 to-gray-50 dark:from-gray-800/80 dark:to-gray-800/30'} rounded-t-xl flex items-center justify-center relative`}>
                    
                    {/* 卡片标识和状态指示器容器 - 统一样式 */}
                    <div className="absolute top-0 left-0 right-0 flex justify-between items-start p-2 sm:p-3 z-20">
                        {/* 左侧指示器组：今日发布 */}
                        <div className="flex flex-col gap-2">
                            {/* 今日发布标识 */}
                            {isToday() && (
                                <div className="flex items-center px-2 py-0.5 sm:px-2.5 sm:py-1 bg-emerald-500/90 text-white text-xs font-medium rounded-full shadow-sm">
                                    <i className="ri-time-line mr-1"></i>
                                    <span className="hidden xs:inline">{t('today')}</span>
                                </div>
                            )}
                        </div>
                        
                        {/* 右侧指示器组：置顶、草稿、未列出 */}
                        <div className="flex flex-col gap-2 items-end">
                            {/* 置顶标识 */}
                            {top === 1 && (
                                <div className="flex items-center px-2 py-0.5 sm:px-2.5 sm:py-1 bg-theme/90 text-white text-xs font-medium rounded-full shadow-sm">
                                    <i className="ri-pushpin-fill mr-1"></i>
                                    <span className="hidden xs:inline">{t('article.top.title')}</span>
                                </div>
                            )}
                            
                            {/* 草稿标识 */}
                            {draft === 1 && (
                                <div className="flex items-center px-2 py-0.5 sm:px-2.5 sm:py-1 bg-amber-500/90 text-white text-xs font-medium rounded-full shadow-sm backdrop-blur-sm">
                                    <i className="ri-draft-line mr-1"></i>
                                    <span className="hidden xs:inline">{t('draft')}</span>
                                </div>
                            )}
                            
                            {/* 未列出标识 */}
                            {listed === 0 && (
                                <div className="flex items-center px-2 py-0.5 sm:px-2.5 sm:py-1 bg-gray-500/90 text-white text-xs font-medium rounded-full shadow-sm backdrop-blur-sm">
                                    <i className="ri-eye-off-line mr-1"></i>
                                    <span className="hidden xs:inline">{t('unlisted')}</span>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className={`text-gray-400 dark:text-gray-500 ${top === 1 ? 'opacity-30' : 'opacity-20'}`}>
                        <i className="ri-article-line text-3xl"></i>
                    </div>
                </div>
            )}
            
            {/* 卡片内容区域 */}
            <div className="p-4 sm:p-5 flex-1 flex flex-col">
                {/* 文章标题 */}
                <h2 id={`article-title-${id}`} className={`text-lg sm:text-xl font-bold text-gray-800 dark:text-white text-pretty overflow-hidden mb-2 leading-tight 
                    ${hovered ? 'text-theme' : 'group-hover:text-theme'} transition-colors line-clamp-2`}>
                    {title}
                </h2>
                
                {/* 日期区域 - 简化设计，提升可读性 */}
                <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mb-3">
                    <div className="flex items-center mr-3">
                        <i className="ri-calendar-line mr-1"></i>
                        {formatDate(createdAt)}
                    </div>
                    {createdAt !== updatedAt && 
                        <div className="flex items-center" title={new Date(updatedAt).toLocaleString()}>
                            <i className="ri-history-line mr-1"></i>
                            {formatDate(updatedAt)}
                        </div>
                    }
                </div>
                
                {/* 文章摘要 */}
                <div className={`text-pretty overflow-hidden text-gray-600 dark:text-gray-300 text-xs sm:text-sm leading-relaxed line-clamp-3 min-h-[3.6rem] sm:min-h-[4.5rem] 
                    ${hovered ? 'text-gray-800 dark:text-gray-200' : 'group-hover:text-gray-700 dark:group-hover:text-gray-200'} transition-colors`}>
                    <SimplifiedMarkdown content={cleanedSummary || t('no_summary')} />
                </div>
                
                {/* 标签区域 */}
                <div className="mt-auto pt-3 sm:pt-4 border-t border-gray-100 dark:border-gray-700/30 mt-3 sm:mt-4">
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
            
            {/* 卡片状态指示线 - 为不同状态的文章添加视觉区分 */}
            {(top === 1 || draft === 1 || listed === 0) && (
                <div className={`h-1 w-full ${
                    top === 1 ? 'bg-theme' : 
                    draft === 1 ? 'bg-amber-500' : 
                    'bg-gray-500'
                }`}></div>
            )}
        </Link>
    )
}