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
    
    return null;
};

export function AdjacentSection({id, setError}: { id: string, setError: (error: string) => void }) {
    const [adjacentFeeds, setAdjacentFeeds] = useState<AdjacentFeeds>();
    const [thumbnails, setThumbnails] = useState<Record<string, string | null>>({});

    useEffect(() => {
        client.feed
            .adjacent({id})
            .get()
            .then(({data, error}) => {
                if (error) {
                    setError(error.value as string);
                } else if (data && typeof data !== "string") {
                    setAdjacentFeeds(data);
                    
                    // 为每个相邻文章尝试提取缩略图
                    const extractedThumbnails: Record<string, string | null> = {};
                    
                    // 处理上一篇文章
                    if (data.previousFeed) {
                        extractedThumbnails[`prev-${data.previousFeed.id}`] = 
                            data.previousFeed.avatar || extractImageUrl(data.previousFeed.summary);
                    }
                    
                    // 处理下一篇文章
                    if (data.nextFeed) {
                        extractedThumbnails[`next-${data.nextFeed.id}`] = 
                            data.nextFeed.avatar || extractImageUrl(data.nextFeed.summary);
                    }
                    
                    setThumbnails(extractedThumbnails);
                }
            });
    }, [id, setError]);
    
    return (
        <div className="rounded-2xl bg-w m-2 grid grid-cols-1 sm:grid-cols-2">
            <AdjacentCard 
                data={adjacentFeeds?.previousFeed} 
                type="previous" 
                thumbnail={adjacentFeeds?.previousFeed ? thumbnails[`prev-${adjacentFeeds.previousFeed.id}`] : null}
            />
            <AdjacentCard 
                data={adjacentFeeds?.nextFeed} 
                type="next"
                thumbnail={adjacentFeeds?.nextFeed ? thumbnails[`next-${adjacentFeeds.nextFeed.id}`] : null}
            />
        </div>
    )
}

export function AdjacentCard({
    data, 
    type, 
    thumbnail
}: { 
    data: AdjacentFeed | null | undefined, 
    type: "previous" | "next",
    thumbnail: string | null | undefined
}) {
    const direction = type === "previous" ? "text-start" : "text-end"
    const radius = type === "previous" ? "rounded-t-2xl sm:rounded-none sm:rounded-l-2xl" : "rounded-b-2xl sm:rounded-none sm:rounded-r-2xl"
    const {t} = useTranslation()
    if (!data) {
        return (<div className="w-full p-6 duration-300">
            <p className={`t-secondary w-full ${direction}`}>
                {type === "previous" ? t("previous") : t("next")}
            </p>
            <h1 className={`text-xl text-gray-700 dark:text-white text-pretty truncate ${direction}`}>
                {t('no_more')}
            </h1>
        </div>);
    }
    return (
        <Link href={`/feed/${data.id}`} target="_blank"
              className={`w-full p-6 duration-300 bg-button ${radius}`}>
            <p className={`t-secondary w-full ${direction}`}>
                {type === "previous" ? t("previous") : t("next")}
            </p>
            <div className={`flex items-center gap-3 ${type === "next" ? "flex-row-reverse" : "flex-row"}`}>
                {thumbnail && (
                    <div className="flex-shrink-0">
                        <img 
                            src={thumbnail} 
                            alt={data.title || ""} 
                            className="w-16 h-16 object-cover rounded-md border border-gray-200 dark:border-gray-700"
                            loading="lazy"
                            onError={(e) => {
                                const target = e.currentTarget as HTMLImageElement;
                                target.style.display = "none";
                            }} 
                        />
                    </div>
                )}
                <div className={`flex-1 ${direction}`}>
                    <h1 className={`text-xl font-bold text-gray-700 dark:text-white text-pretty truncate`}>
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