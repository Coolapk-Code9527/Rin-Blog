import React, { useState } from "react";
import {timeago} from "../utils/timeago.ts";
import {Link} from "wouter";
import {useTranslation} from "react-i18next";
import { useGlassEffect, GLASS_LAYERS } from "../hooks/useGlassEffect";
import { generatePlaceholderProps, PLACEHOLDER_PRESETS } from '../utils/placeholderUtils';
import { useAdjacentFeedsCache } from "../hooks/useFeedsCache";
import { AdjacentFeed, AdjacentFeeds } from "../types/api";

// 类型定义已从types/api.ts导入，移除重复定义

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

// fetchFullArticle函数已移除以优化CPU性能
// 相邻文章现在只使用avatar和summary字段获取缩略图
// 如果没有缩略图，将显示占位符

// 默认图片常量已移除，现在使用占位符系统

export function AdjacentSection({id, setError}: { id: string, setError: (error: string) => void }) {
    const {t} = useTranslation();

    // 使用缓存Hook替代直接API调用
    const { data: adjacentFeeds, loading, error } = useAdjacentFeedsCache(id, !!id);

    // 处理错误
    React.useEffect(() => {
        if (error) {
            setError(error);
        }
    }, [error, setError]);

    // 使用智能毛玻璃效果
    const glassClass = useGlassEffect(GLASS_LAYERS.CARD);

    // 为每个相邻文章获取缩略图
    const thumbnails = React.useMemo(() => {
        if (!adjacentFeeds) return {};

        const extractedThumbnails: Record<string, string | null> = {};

        // 处理上一篇文章
        if (adjacentFeeds.previousFeed) {
            let thumbnail = getThumbnailUrl(adjacentFeeds.previousFeed);
            extractedThumbnails[`prev-${adjacentFeeds.previousFeed.id}`] = thumbnail || null;
        }

        // 处理下一篇文章
        if (adjacentFeeds.nextFeed) {
            let thumbnail = getThumbnailUrl(adjacentFeeds.nextFeed);
            extractedThumbnails[`next-${adjacentFeeds.nextFeed.id}`] = thumbnail || null;
        }

        return extractedThumbnails;
    }, [adjacentFeeds]);
    
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
    thumbnail: string | null | undefined,
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
            <div className="w-full block duration-300 flex items-center justify-center h-20 sm:h-32 bg-white/10 dark:bg-black/10 hover:bg-white/20 dark:hover:bg-black/20 transition-colors">
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