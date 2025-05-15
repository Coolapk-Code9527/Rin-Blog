import {Link} from "wouter";
import {useTranslation} from "react-i18next";
import {timeago} from "../utils/timeago";
import {HashTag} from "./hashtag";
import React from "react";
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
                className="block w-full rounded-lg bg-w mb-2 duration-300 bg-button overflow-hidden hover:shadow-md transition-all transform hover:-translate-y-1 border border-gray-100 dark:border-gray-800 shadow-sm"
            >
                {avatar &&
                    <div className="w-full h-auto overflow-hidden rounded-t-lg">
                        <img src={avatar} alt={title}
                            className="object-cover w-full h-auto max-h-48 hover:scale-105 transition-transform duration-700" />
                    </div>}
                <div className="p-3 md:p-4">
                    {/* 文章状态指示 */}
                    {(top === 1 || draft === 1 || listed === 0) && 
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                            {top === 1 && 
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-theme/10 text-theme">
                                    <i className="ri-thumb-up-fill mr-1"></i>
                                    {t('article.top.title')}
                                </span>
                            }
                            {draft === 1 && 
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                                    <i className="ri-draft-line mr-1"></i>
                                    {t("draft")}
                                </span>
                            }
                            {listed === 0 && 
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                                    <i className="ri-eye-off-line mr-1"></i>
                                    {t("unlisted")}
                                </span>
                            }
                        </div>
                    }
                    
                    {/* 文章标题 */}
                    <h1 className="text-base md:text-lg font-bold text-gray-800 dark:text-white text-pretty overflow-hidden mb-1 leading-tight hover:text-theme dark:hover:text-theme transition-colors">
                        {title}
                    </h1>
                    
                    {/* 时间信息 */}
                    <div className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                        <span className="flex items-center" title={new Date(createdAt).toLocaleString()}>
                            <i className="ri-calendar-line mr-1"></i>
                            {createdAt === updatedAt 
                                ? timeago(createdAt) 
                                : t('feed_card.published$time', { time: timeago(createdAt) })}
                        </span>
                        {createdAt !== updatedAt &&
                            <span className="flex items-center" title={new Date(updatedAt).toLocaleString()}>
                                <i className="ri-history-line mr-1"></i>
                                {t('feed_card.updated$time', { time: timeago(updatedAt) })}
                            </span>
                        }
                    </div>
                    
                    {/* 文章摘要 */}
                    <div className="text-pretty overflow-hidden dark:text-gray-300 text-gray-600 text-xs mb-1.5 leading-relaxed line-clamp-2">
                        <SimplifiedMarkdown content={cleanedSummary} />
                    </div>
                    
                    {/* 标签 */}
                    {hashtags.length > 0 &&
                        <div className="mt-1.5 flex flex-row flex-wrap items-center gap-1">
                            {hashtags.map(({ name, id }, index) => (
                                <HashTag key={id || index} name={name} />
                            ))}
                        </div>
                    }
                </div>
            </Link>
        </>
    )
}