import React from "react";
import {client} from "../main.tsx";
import {timeago} from "../utils/timeago.ts";
import {Link} from "wouter";
import {useTranslation} from "react-i18next";
import { useGlassEffect, GLASS_LAYERS } from "../hooks/useGlassEffect";

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

// 提取图片URL的辅助函数
const extractImageUrl = (content: string): string | null => {
    if (!content) return null;
    
    try {
        // 尝试从Markdown格式提取
        const markdownRegex = /!\[.*?\]\((.*?)\)/;
        const markdownMatch = markdownRegex.exec(content);
        if (markdownMatch && markdownMatch[1]) {
            console.log("从Markdown提取图片URL:", markdownMatch[1]);
            return markdownMatch[1];
        }
        
        // 尝试从HTML格式提取
        const htmlRegex = /<img.*?src=["'](.*?)["']/;
        const htmlMatch = htmlRegex.exec(content);
        if (htmlMatch && htmlMatch[1]) {
            console.log("从HTML提取图片URL:", htmlMatch[1]);
            return htmlMatch[1];
        }
    } catch (error) {
        console.error("提取图片URL时出错:", error);
    }
    
    return null;
};

// 获取完整文章信息以获取avatar字段
const fetchFullArticle = async (id: number): Promise<string | null> => {
    try {
        const response = await client.feed({ id: id.toString() }).get();
        if (!response.error && response.data && typeof response.data !== "string") {
            // 检查数据是否包含avatar字段
            if ('avatar' in response.data) {
                return response.data.avatar as string;
            }
            
            // 如果没有avatar字段，从content中提取第一张图片
            if ('content' in response.data) {
                return extractImageUrl(response.data.content as string);
            }
        }
    } catch (error) {
        console.error(`Failed to fetch article ${id}:`, error);
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
                    
                    // 优化：并发获取相邻文章缩略图，减少API调用
                    const extractedThumbnails: Record<string, string> = {};

                    // 并发处理上一篇和下一篇文章
                    const thumbnailPromises: Promise<void>[] = [];

                    if (data.previousFeed) {
                        thumbnailPromises.push(
                            (async () => {
                                // 先尝试从摘要中提取图片
                                let thumbnail = extractImageUrl(data.previousFeed.summary);

                                // 如果摘要中没有图片，获取完整文章信息
                                if (!thumbnail) {
                                    thumbnail = await fetchFullArticle(data.previousFeed.id);
                                }

                                extractedThumbnails[`prev-${data.previousFeed.id}`] = thumbnail || DEFAULT_THUMBNAIL;
                                console.log(`Previous article (ID:${data.previousFeed.id}) thumbnail:`, extractedThumbnails[`prev-${data.previousFeed.id}`]);
                            })()
                        );
                    }

                    if (data.nextFeed) {
                        thumbnailPromises.push(
                            (async () => {
                                // 先尝试从摘要中提取图片
                                let thumbnail = extractImageUrl(data.nextFeed.summary);

                                // 如果摘要中没有图片，获取完整文章信息
                                if (!thumbnail) {
                                    thumbnail = await fetchFullArticle(data.nextFeed.id);
                                }

                                extractedThumbnails[`next-${data.nextFeed.id}`] = thumbnail || DEFAULT_THUMBNAIL;
                                console.log(`Next article (ID:${data.nextFeed.id}) thumbnail:`, extractedThumbnails[`next-${data.nextFeed.id}`]);
                            })()
                        );
                    }

                    // 等待所有缩略图获取完成
                    await Promise.all(thumbnailPromises);
                    
                    setThumbnails(extractedThumbnails);
                }
                setLoading(false);
            })
            .catch((err) => {
                console.error("获取相邻文章信息失败:", err);
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
    
    if (!data) {
        return (
            <div className="h-full w-full block p-4 sm:p-6 duration-300 bg-neutral-50/80 dark:bg-neutral-800/40 backdrop-blur-sm flex items-center justify-center min-h-[5.5rem] sm:min-h-[8rem]">
                <span className="text-xs sm:text-sm text-neutral-400 dark:text-neutral-500 font-medium">{t('no_more')}</span>
            </div>
        );
    }
    
    return (
        <Link href={`/feed/${data.id}`}
              className={`h-full w-full block p-0 duration-300 hover:bg-neutral-50/80 dark:hover:bg-neutral-800/60 relative group overflow-hidden backdrop-blur-sm transition-all ease-out ${type === "previous" ? "rounded-l-2xl" : "rounded-r-2xl"}`}>
            <div className={`flex flex-row ${type === "next" ? "flex-row-reverse" : "flex-row"} items-stretch w-full h-20 sm:h-32`}>
                {/* 图片区 */}
                <div className={`flex-shrink-0 w-16 sm:w-32 h-full overflow-hidden bg-gray-200 dark:bg-gray-700 relative ${type === "previous" ? "rounded-l-2xl" : "rounded-r-2xl"}`}>
                    {loading ? (
                        <div className="w-full h-full flex items-center justify-center animate-pulse">
                            <i className="ri-image-line text-gray-400 dark:text-gray-300 text-2xl sm:text-3xl opacity-90"></i>
                        </div>
                    ) : thumbnail ? (
                        <img 
                            src={thumbnail} 
                            alt={data.title || ""} 
                            className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-105 bg-gray-200 dark:bg-gray-700 ${type === "previous" ? "rounded-l-2xl" : "rounded-r-2xl"}`}
                            loading="lazy"
                            style={{height:'100%'}}
                            onError={(e) => {
                                const target = e.currentTarget as HTMLImageElement;
                                target.style.display = 'none';
                                const container = target.parentElement;
                                if (container) {
                                    container.innerHTML = `
                                        <div class='w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-700'>
                                            <i class='ri-file-text-line text-gray-400 dark:text-gray-300 text-2xl sm:text-3xl opacity-90'></i>
                                        </div>
                                    `;
                                }
                            }}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-700">
                            <i className="ri-file-text-line text-gray-400 dark:text-gray-300 text-2xl sm:text-3xl opacity-90"></i>
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