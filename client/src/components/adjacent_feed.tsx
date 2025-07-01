import React, { useState } from "react";
import {client} from "../main.tsx";
import {timeago} from "../utils/timeago.ts";
import {Link} from "wouter";
import {useTranslation} from "react-i18next";
import { useGlassEffect, GLASS_LAYERS } from "../hooks/useGlassEffect";
import { generatePlaceholderProps, PLACEHOLDER_PRESETS } from '../utils/placeholderUtils';
import { useAdjacentFeedsCache } from "../hooks/useFeedsCache";
import { getAdjacentThumbnails } from '../utils/thumbnailUtils';

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

// 移除了复杂的图片提取逻辑，使用统一的缩略图工具函数

export function AdjacentSection({id, setError}: { id: string, setError: (error: string) => void }) {
    // 使用缓存Hook替代直接API调用，避免重复请求
    const { data: adjacentFeeds, loading, error } = useAdjacentFeedsCache(id, !!id);

    // 使用智能毛玻璃效果
    const glassClass = useGlassEffect(GLASS_LAYERS.CARD);

    // 处理错误
    React.useEffect(() => {
        if (error) {
            setError(error);
        }
    }, [error, setError]);

    // 简化：直接使用统一的缩略图工具函数，无需复杂的状态管理
    const thumbnails = React.useMemo(() => {
        if (!adjacentFeeds || loading) return {};
        return getAdjacentThumbnails(adjacentFeeds.previousFeed, adjacentFeeds.nextFeed);
    }, [adjacentFeeds, loading]);
    
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