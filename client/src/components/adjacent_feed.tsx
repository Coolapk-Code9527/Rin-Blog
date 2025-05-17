import React from "react";
import {client} from "../main.tsx";
import {timeago} from "../utils/timeago.ts";
import {Link} from "wouter";
import {useTranslation} from "react-i18next";

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
            return markdownMatch[1];
        }
        
        // 尝试从HTML格式提取
        const htmlRegex = /<img.*?src=["'](.*?)["']/;
        const htmlMatch = htmlRegex.exec(content);
        if (htmlMatch && htmlMatch[1]) {
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
        console.error(`获取文章 ${id} 信息失败:`, error);
    }
    return null;
};

// 默认图片常量
const DEFAULT_THUMBNAIL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='%23ccc' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z'%3E%3C/path%3E%3Cpolyline points='14 2 14 8 20 8'%3E%3C/polyline%3E%3C/svg%3E";

export function AdjacentSection({id}: { id: string }) {
    const [adjacentFeeds, setAdjacentFeeds] = React.useState<AdjacentFeeds>();
    const [thumbnails, setThumbnails] = React.useState<Record<string, string>>({});
    const [loading, setLoading] = React.useState<boolean>(true);
    const {t} = useTranslation();

    React.useEffect(() => {
        setLoading(true);
        client.feed
            .adjacent({id})
            .get()
            .then(async ({data, error}) => {
                if (error) {
                    console.error("获取相邻文章失败:", error);
                    setLoading(false);
                } else if (data && typeof data !== "string") {
                    setAdjacentFeeds(data);
                    
                    // 为每个相邻文章获取缩略图
                    const extractedThumbnails: Record<string, string> = {};
                    
                    // 处理上一篇文章
                    if (data.previousFeed) {
                        // 先尝试从摘要中提取图片
                        let thumbnail = extractImageUrl(data.previousFeed.summary);
                        
                        // 如果摘要中没有图片，获取完整文章信息
                        if (!thumbnail) {
                            thumbnail = await fetchFullArticle(data.previousFeed.id);
                        }
                        
                        extractedThumbnails[`prev-${data.previousFeed.id}`] = thumbnail || DEFAULT_THUMBNAIL;
                    }
                    
                    // 处理下一篇文章
                    if (data.nextFeed) {
                        // 先尝试从摘要中提取图片
                        let thumbnail = extractImageUrl(data.nextFeed.summary);
                        
                        // 如果摘要中没有图片，获取完整文章信息
                        if (!thumbnail) {
                            thumbnail = await fetchFullArticle(data.nextFeed.id);
                        }
                        
                        extractedThumbnails[`next-${data.nextFeed.id}`] = thumbnail || DEFAULT_THUMBNAIL;
                    }
                    
                    setThumbnails(extractedThumbnails);
                }
                setLoading(false);
            })
            .catch((err) => {
                console.error("获取相邻文章信息失败:", err);
                setLoading(false);
            });
    }, [id]);
    
    // 没有相邻文章时不渲染组件
    if (loading === false && !adjacentFeeds?.previousFeed && !adjacentFeeds?.nextFeed) {
        return null;
    }
    
    return (
        <div className="w-full pb-2">
            <h3 className="text-lg font-medium mb-3 flex items-center">
                <i className="ri-article-line mr-2 text-blue-500"></i>
                {t("article.navigation")}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
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
    
    if (loading) {
        return (
            <div className="rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-800/30 shadow-sm animate-pulse h-24">
                <div className="h-full w-full flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                </div>
            </div>
        );
    }
    
    if (!data) {
        return (
            <div className="rounded-xl overflow-hidden bg-gray-50/70 dark:bg-gray-800/20 flex items-center justify-center h-24 border border-dashed border-gray-200 dark:border-gray-700">
                <span className="text-sm text-gray-400 flex items-center">
                    {type === "previous" ? (
                        <><i className="ri-arrow-left-line mr-1.5"></i>{t('no_previous_article')}</>
                    ) : (
                        <>{t('no_next_article')}<i className="ri-arrow-right-line ml-1.5"></i></>
                    )}
                </span>
            </div>
        );
    }
    
    return (
        <Link href={`/feed/${data.id}`} 
              className={`rounded-xl overflow-hidden bg-w border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all duration-300 flex ${type === "next" ? "flex-row-reverse" : "flex-row"}`}>
            {/* 缩略图部分 */}
            <div className="w-24 sm:w-32 h-24 relative overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-800">
                {thumbnail ? (
                    <img 
                        src={thumbnail} 
                        alt={data.title || ""} 
                        className="w-full h-full object-cover transition-all duration-500 hover:scale-110"
                        loading="lazy"
                        onError={(e) => {
                            const target = e.currentTarget;
                            target.style.display = "none";
                            target.parentElement!.innerHTML = `
                                <div class="w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                    <i class="ri-file-text-line text-gray-400 dark:text-gray-600 text-2xl"></i>
                                </div>
                            `;
                        }}
                    />
                ) : (
                    <div className="w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                        <i className="ri-file-text-line text-gray-400 dark:text-gray-600 text-2xl"></i>
                    </div>
                )}
            </div>
            
            {/* 内容部分 */}
            <div className={`flex-1 p-3 flex flex-col justify-between ${type === "next" ? "text-right pr-4" : "text-left pl-4"}`}>
                <h4 className="font-medium text-gray-800 dark:text-gray-100 line-clamp-2">
                    {data.title || t("unnamed")}
                </h4>
                
                <div className={`flex items-center text-sm text-gray-500 space-x-2 mt-1.5 ${type === "next" ? "justify-end" : "justify-start"}`}>
                    {type === "previous" ? (
                        <span className="flex items-center text-blue-500">
                            <i className="ri-arrow-left-line mr-1.5 text-sm"></i>{t("previous_article")}
                        </span>
                    ) : (
                        <span className="flex items-center text-blue-500">
                            {t("next_article")}<i className="ri-arrow-right-line ml-1.5 text-sm"></i>
                        </span>
                    )}
                </div>
            </div>
        </Link>
    )
}