import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { timeago } from "../utils/timeago";
import { HashTag } from "./hashtag";
import React from 'react';
import { SimplifiedMarkdown } from "./markdown";

export function FeedCard({ id, title, avatar, draft, listed, top, summary, hashtags, createdAt, updatedAt }:
    {
        id: string, avatar?: string,
        draft?: number, listed?: number, top?: number,
        title: string, summary: string,
        hashtags: { id: number, name: string }[],
        createdAt: Date, updatedAt: Date
    }) {
    const { t } = useTranslation();
    
    // 预处理 summary，移除 Markdown 图片链接
    const cleanedSummary = summary ? summary.replace(/!\[.*?\]\(.*?\)/g, "") : ""; 
    
    return (
        <Link href={`/feed/${id}`} 
            className="w-full block rounded-2xl bg-white dark:bg-gray-800/90 my-4 duration-300 overflow-hidden shadow-sm hover:shadow-md dark:shadow-gray-900/30 transition-all transform hover:translate-y-[-2px] border border-gray-100 dark:border-gray-700/50"
        >
            {avatar && (
                <div className="w-full h-auto overflow-hidden group">
                    <img src={avatar} alt={title}
                        className="object-cover w-full h-auto transform transition-transform duration-500 hover:scale-105" />
                </div>
            )}
            <div className="p-6">
                {/* 标题和置顶标记 */}
                <div className="flex items-start justify-between mb-2">
                    <h1 className="text-xl font-bold text-gray-800 dark:text-white text-pretty overflow-hidden group-hover:text-theme transition-colors duration-200">
                        {title}
                    </h1>
                    {top === 1 && (
                        <span className="flex items-center text-theme text-sm font-medium bg-theme/10 px-2 py-0.5 rounded-full ml-2">
                            <i className="ri-pushpin-line mr-1"></i>
                            {t('article.top.title')}
                        </span>
                    )}
                </div>
                
                {/* 状态标签 */}
                <div className="flex flex-wrap gap-2 mb-3">
                    {draft === 1 && (
                        <span className="inline-flex items-center text-gray-500 text-xs bg-gray-100 dark:bg-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full">
                            <i className="ri-draft-line mr-1"></i>
                            {t("draft")}
                        </span>
                    )}
                    {listed === 0 && (
                        <span className="inline-flex items-center text-gray-500 text-xs bg-gray-100 dark:bg-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full">
                            <i className="ri-eye-off-line mr-1"></i>
                            {t("unlisted")}
                        </span>
                    )}
                </div>
                
                {/* 文章摘要 */}
                <div className="text-pretty overflow-hidden text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-3">
                    <SimplifiedMarkdown content={cleanedSummary} />
                </div>
                
                {/* 底部信息区域 */}
                <div className="flex flex-wrap justify-between items-center mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/50">
                    {/* 标签 */}
                    <div className="flex flex-wrap gap-2 mb-2 sm:mb-0">
                        {hashtags.length > 0 && hashtags.map(({ name }, index) => (
                            <HashTag key={index} name={name} />
                        ))}
                    </div>
                    
                    {/* 时间信息 */}
                    <div className="flex items-center text-gray-400 text-xs">
                        <span className="flex items-center" title={new Date(createdAt).toLocaleString()}>
                            <i className="ri-time-line mr-1"></i>
                            {createdAt === updatedAt 
                                ? timeago(createdAt) 
                                : t('feed_card.published$time', { time: timeago(createdAt) })
                            }
                        </span>
                        {createdAt !== updatedAt && (
                            <span className="ml-2 flex items-center" title={new Date(updatedAt).toLocaleString()}>
                                <i className="ri-refresh-line mr-1"></i>
                                {t('feed_card.updated$time', { time: timeago(updatedAt) })}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </Link>
    );
}