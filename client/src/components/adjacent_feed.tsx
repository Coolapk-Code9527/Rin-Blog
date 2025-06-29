import React, { useState } from "react";
import {client} from "../main.tsx";
import {timeago} from "../utils/timeago.ts";
import {Link} from "wouter";
import {useTranslation} from "react-i18next";
import { useGlassEffect, GLASS_LAYERS } from "../hooks/useGlassEffect";
import { generatePlaceholderProps, PLACEHOLDER_PRESETS } from '../utils/placeholderUtils';

export type AdjacentFeed = {
    id: number;
    title: string | null;
    summary: string;
    hashtags: {
        id: number;
        name: string;
    }[];
    createdAt: Date;
    updatedAt: Date;
    avatar?: string;
};
export type AdjacentFeeds = {
    nextFeed: AdjacentFeed | null;
    previousFeed: AdjacentFeed | null;
};

// 获取文章缩略图的优先级逻辑（功能恢复版本）
const getThumbnailUrl = (article: any): string | null => {
    // 1. 优先使用专门的缩略图URL（如果API提供）
    if (article.thumbUrl) {
        return article.thumbUrl;
    }

    // 2. 使用API提供的avatar字段（保持性能优化）
    if (article.avatar) {
        return article.avatar;
    }

    // 3. 从完整摘要中提取图片（恢复完整搜索范围）
    if (article.summary) {
        const summaryImage = extractImageUrl(article.summary);
        if (summaryImage) {
            return summaryImage;
        }
    }

    return null; // 暂时不恢复fetchFullArticle，先测试基本功能
};

// 提取图片URL的辅助函数（功能恢复版本）
const extractImageUrl = (content: string): string | null => {
    if (!content) return null;

    try {
        // 恢复原始的、经过验证的Markdown正则表达式
        const markdownRegex = /!\[.*?\]\((.*?)\)/;
        const markdownMatch = markdownRegex.exec(content);
        if (markdownMatch && markdownMatch[1]) {
            return markdownMatch[1];
        }

        // 恢复HTML支持作为fallback
        const htmlRegex = /<img.*?src=["'](.*?)["']/;
        const htmlMatch = htmlRegex.exec(content);
        if (htmlMatch && htmlMatch[1]) {
            return htmlMatch[1];
        }
    } catch (error) {
        // 保留错误处理，但不输出调试信息
        return null;
    }

    return null;
};

// 智能fallback：有条件地获取完整文章信息
const fetchFullArticle = async (id: number): Promise<string | null> => {
    try {
        const response = await client.feed({ id: id.toString() }).get();
        if (!response.error && response.data && typeof response.data !== "string") {
            // 检查数据是否包含avatar字段
            if ('avatar' in response.data && response.data.avatar) {
                return response.data.avatar as string;
            }

            // 如果没有avatar字段，从content中提取第一张图片
            if ('content' in response.data) {
                return extractImageUrl(response.data.content as string);
            }
        }
    } catch (error) {
        // 静默处理错误，避免影响用户体验
        return null;
    }
    return null;
};

// 默认图片常量
const DEFAULT_THUMBNAIL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='%23ccc' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z'%3E%3C/path%3E%3Cpolyline points='14 2 14 8 20 8'%3E%3C/polyline%3E%3C/svg%3E";

export function AdjacentSection({id, setError}: { id: string, setError: (error: string) => void }) {
    const [adjacentFeeds, setAdjacentFeeds] = React.useState<AdjacentFeeds>();
    const [thumbnails, setThumbnails] = React.useState<Record<string, string>>({});
    const [loading, setLoading] = React.useState<boolean>(true);
    const {t} = useTranslation();

    // 使用智能毛玻璃效果
    const glassClass = useGlassEffect(GLASS_LAYERS.CARD);

    React.useEffect(() => {
        setLoading(true);
        client.feed
            .adjacent({id})
            .get()
            .then(async ({data, error}) => {
                if (error) {
                    setError(error.value as string);
                    setLoading(false);
                } else if (data && typeof data !== "string") {
                    setAdjacentFeeds(data);
                    
                    // 为每个相邻文章获取缩略图
                    const extractedThumbnails: Record<string, string> = {};
                    
                    // 处理上一篇文章（智能fallback恢复）
                    if (data.previousFeed) {
                        let thumbnail = getThumbnailUrl(data.previousFeed);

                        // 只在avatar和summary都没有图片时才调用fetchFullArticle
                        if (!thumbnail) {
                            thumbnail = await fetchFullArticle(data.previousFeed.id);
                        }

                        extractedThumbnails[`prev-${data.previousFeed.id}`] = thumbnail || null;
                    }
                    
                    // 处理下一篇文章（智能fallback恢复）
                    if (data.nextFeed) {
                        let thumbnail = getThumbnailUrl(data.nextFeed);

                        // 只在avatar和summary都没有图片时才调用fetchFullArticle
                        if (!thumbnail) {
                            thumbnail = await fetchFullArticle(data.nextFeed.id);
                        }

                        extractedThumbnails[`next-${data.nextFeed.id}`] = thumbnail || null;
                    }
                    
                    setThumbnails(extractedThumbnails);
                }
                setLoading(false);
            })
            .catch((err) => {
                setError("获取相邻文章信息失败");
                setLoading(false);
            });
    }, [id, setError]);
    
    return (
        <div className="w-full mt-6 mb-6">
            <div className={`rounded-2xl overflow-hidden ${glassClass} shadow-enhanced hover:shadow-enhanced-lg transition-all duration-300 grid grid-cols-2 divide-x divide-neutral-200/60 dark:divide-neutral-700/60 border border-neutral-200/60 dark:border-neutral-700/60`}>
                <AdjacentCard 
                    data={adjacentFeeds?.previousFeed}
                    type="previous"
                    thumbnail={adjacentFeeds?.previousFeed && !loading ? thumbnails[`prev-${adjacentFeeds.previousFeed.id}`] : undefined}
                    loading={loading}
                />
                <AdjacentCard 
                    data={adjacentFeeds?.nextFeed}
                    type="next"
                    thumbnail={adjacentFeeds?.nextFeed && !loading ? thumbnails[`next-${adjacentFeeds.nextFeed.id}`] : undefined}
                    loading={loading}
                />
            </div>
        </div>
    )
}

export function AdjacentCard({
    data,
    type,
    thumbnail,
    loading
}: {
    data: AdjacentFeed | null | undefined,
    type: "previous" | "next",
    thumbnail: string | undefined,
    loading: boolean
}) {
    const direction = type === "previous" ? "text-start" : "text-end";
    const {t} = useTranslation();

    // 添加图片错误状态管理
    const [imageError, setImageError] = useState(false);

    // 注意：父容器已经有毛玻璃效果，子组件不需要重复添加
    // 避免双重毛玻璃效果冲突

    if (!data) {
        return (
            <div className="h-full w-full block p-4 sm:p-6 duration-300 flex items-center justify-center min-h-[5.5rem] sm:min-h-[8rem] bg-white/10 dark:bg-black/10 hover:bg-white/20 dark:hover:bg-black/20 transition-colors">
                <span className="text-xs sm:text-sm text-neutral-400 dark:text-neutral-500 font-medium">{t('no_more')}</span>
            </div>
        );
    }

    return (
        <Link href={`/feed/${data.id}`}
              className={`h-full w-full block p-0 duration-300 hover:bg-white/10 dark:hover:bg-black/10 relative group overflow-hidden transition-all ease-out ${type === "previous" ? "rounded-l-2xl" : "rounded-r-2xl"}`}>
            <div className={`flex flex-row ${type === "next" ? "flex-row-reverse" : "flex-row"} items-stretch w-full h-20 sm:h-32`}>
                {/* 图片区 */}
                <div className={`flex-shrink-0 w-16 sm:w-32 h-full overflow-hidden relative ${type === "previous" ? "rounded-l-2xl" : "rounded-r-2xl"}`}
                     style={generatePlaceholderProps(data.id, data.title || '', PLACEHOLDER_PRESETS.NAVIGATION_CARD).style}>
                    {loading ? (
                        <div className="w-full h-full flex items-center justify-center animate-pulse">
                            <i className="ri-article-line text-white/90 text-2xl sm:text-3xl"></i>
                        </div>
                    ) : thumbnail && !imageError ? (
                        <img
                            src={thumbnail}
                            alt={data.title || ""}
                            className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-105 ${type === "previous" ? "rounded-l-2xl" : "rounded-r-2xl"}`}
                            loading="lazy"
                            style={{height:'100%'}}
                            onError={() => {
                                // 使用React状态管理而不是直接DOM操作
                                setImageError(true);
                            }}
                        />
                    ) : (
                        <div
                            className="w-full h-full flex items-center justify-center"
                            style={generatePlaceholderProps(data.id, data.title || '', PLACEHOLDER_PRESETS.NAVIGATION_CARD).style}
                        >
                            <i className="ri-article-line text-white/90 text-2xl sm:text-3xl"></i>
                        </div>
                    )}
                </div>
                {/* 内容区 */}
                <div className={`flex-1 h-full flex flex-col justify-center min-h-0 overflow-hidden px-2 sm:px-4 ${type === "next" ? "items-end text-end" : "items-start text-start"}`}>
                    <h2 className="text-xs sm:text-base font-semibold text-neutral-700 dark:text-neutral-100 truncate max-w-[90%] group-hover:text-theme transition-colors duration-200 mb-1.5 leading-tight">
                        {data.title}
                    </h2>
                    <div className={`flex items-center text-[11px] sm:text-sm text-neutral-500 dark:text-neutral-400 w-full min-h-0 overflow-hidden whitespace-nowrap max-w-[80%] ${type === "next" ? "justify-end" : "justify-start"}`}>
                        {type === "previous" ? (
                            <span className="flex items-center transition-all duration-200 group-hover:-translate-x-1 whitespace-nowrap truncate font-medium">
                                <i className="ri-arrow-left-line mr-1.5 text-theme group-hover:text-theme-hover"></i> {t("previous")}
                            </span>
                        ) : (
                            <span className="flex items-center transition-all duration-200 group-hover:translate-x-1 whitespace-nowrap truncate font-medium">
                                {t("next")} <i className="ri-arrow-right-line ml-1.5 text-theme group-hover:text-theme-hover"></i>
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </Link>
    )
}