import {useEffect, useState} from "react";
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
        if (!response.error && response.data) {
            console.log(`获取文章 ${id} 的完整信息:`, response.data);
            if (response.data.avatar) {
                return response.data.avatar;
            }
            
            // 如果没有avatar字段，从content中提取第一张图片
            if (response.data.content) {
                return extractImageUrl(response.data.content);
            }
        }
    } catch (error) {
        console.error(`获取文章 ${id} 信息失败:`, error);
    }
    return null;
};

// 默认图片常量
const DEFAULT_THUMBNAIL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='%23ccc' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z'%3E%3C/path%3E%3Cpolyline points='14 2 14 8 20 8'%3E%3C/polyline%3E%3C/svg%3E";

export function AdjacentSection({id, setError}: { id: string, setError: (error: string) => void }) {
    const [adjacentFeeds, setAdjacentFeeds] = useState<AdjacentFeeds>();
    const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState<boolean>(true);
    const {t} = useTranslation();

    useEffect(() => {
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
                    
                    // 处理上一篇文章
                    if (data.previousFeed) {
                        // 先尝试从摘要中提取图片
                        let thumbnail = extractImageUrl(data.previousFeed.summary);
                        
                        // 如果摘要中没有图片，获取完整文章信息
                        if (!thumbnail) {
                            thumbnail = await fetchFullArticle(data.previousFeed.id);
                        }
                        
                        extractedThumbnails[`prev-${data.previousFeed.id}`] = thumbnail || DEFAULT_THUMBNAIL;
                        console.log(`上一篇文章(ID:${data.previousFeed.id})缩略图:`, extractedThumbnails[`prev-${data.previousFeed.id}`]);
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
                        console.log(`下一篇文章(ID:${data.nextFeed.id})缩略图:`, extractedThumbnails[`next-${data.nextFeed.id}`]);
                    }
                    
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
        <div className="w-full mt-4 mb-4">
            <h3 className="text-lg font-medium mb-3 t-primary">
                <span className="flex items-center">
                    <i className="ri-arrow-left-right-line mr-2 text-theme"></i>
                    {t('article.navigation')}
                </span>
            </h3>
            <div className="rounded-2xl overflow-hidden bg-w shadow-sm hover:shadow-md transition-all duration-300 grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100 dark:divide-gray-700">
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
            <div className="w-full p-6 duration-300 bg-gray-50/50 dark:bg-gray-800/20">
                <p className={`t-secondary w-full ${direction} flex items-center ${type === "next" ? "justify-end" : "justify-start"}`}>
                    {type === "previous" ? (
                        <span className="flex items-center"><i className="ri-arrow-left-line mr-1"></i> {t("previous")}</span>
                    ) : (
                        <span className="flex items-center">{t("next")} <i className="ri-arrow-right-line ml-1"></i></span>
                    )}
            </p>
                <h1 className={`text-xl text-gray-700 dark:text-white text-pretty truncate ${direction} mt-1`}>
                {t('no_more')}
            </h1>
            </div>
        );
    }
    
    return (
        <Link href={`/feed/${data.id}`} 
              className={`w-full p-6 duration-300 hover:bg-gray-50 dark:hover:bg-gray-800/40 group`}>
            <p className={`t-secondary w-full ${direction} flex items-center ${type === "next" ? "justify-end" : "justify-start"}`}>
                {type === "previous" ? (
                    <span className="flex items-center"><i className="ri-arrow-left-line mr-1"></i> {t("previous")}</span>
                ) : (
                    <span className="flex items-center">{t("next")} <i className="ri-arrow-right-line ml-1"></i></span>
                )}
            </p>
            <div className={`flex items-center gap-3 mt-2 ${type === "next" ? "flex-row-reverse" : "flex-row"}`}>
                <div className="flex-shrink-0 w-16 h-16">
                    {loading ? (
                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-md flex items-center justify-center animate-pulse">
                            <i className="ri-image-line text-gray-400 dark:text-gray-600 text-xl"></i>
                        </div>
                    ) : thumbnail ? (
                        <img 
                            src={thumbnail} 
                            alt={data.title || ""} 
                            className="w-16 h-16 object-cover rounded-md border border-gray-200 dark:border-gray-700 group-hover:border-theme transition-colors"
                            loading="lazy"
                            onError={(e) => {
                                console.log(`图片加载失败: ${data.id}, 使用默认图标`);
                                const target = e.currentTarget as HTMLImageElement;
                                const container = target.parentElement;
                                if (container) {
                                    container.innerHTML = `
                                        <div class="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-md flex items-center justify-center">
                                            <i class="ri-file-text-line text-gray-400 dark:text-gray-600 text-xl"></i>
                                        </div>
                                    `;
                                }
                            }}
                        />
                    ) : (
                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-md flex items-center justify-center">
                            <i className="ri-file-text-line text-gray-400 dark:text-gray-600 text-xl"></i>
                        </div>
                    )}
                </div>
                <div className={`flex-1 ${direction}`}>
                    <h1 className={`text-xl font-bold text-gray-700 dark:text-white text-pretty truncate group-hover:text-theme transition-colors`}>
                {data.title}
            </h1>
                    <p className={`space-x-2`}>
                <span className="text-gray-400 text-sm" title={new Date(data.createdAt).toLocaleString()}>
                    {data.createdAt === data.updatedAt ? timeago(data.createdAt) : t('feed_card.published$time', {time: timeago(data.createdAt)})}
                </span>
                {data.createdAt !== data.updatedAt &&
                    <span className="text-gray-400 text-sm" title={new Date(data.updatedAt).toLocaleString()}>
                        {t('feed_card.updated$time', {time: timeago(data.updatedAt)})}
                    </span>
                }
            </p>
                </div>
            </div>
        </Link>
    )
}