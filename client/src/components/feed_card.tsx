import {Link} from "wouter";
import {useTranslation} from "react-i18next";
import {timeago} from "../utils/timeago";
import {HashTag} from "./hashtag";
import {SimplifiedMarkdown} from "./markdown";
import React, { useMemo } from "react";
import { useLocation } from "wouter";
import { ClientConfigContext } from "../state/config";
import { ProfileContext } from "../state/profile";
import { extractContent } from "../utils/content";

export type Feed = {
    id: number;
    title: string | null;
    content: string;
    hashtags: {
        id: number;
        name: string;
    }[];
    user: {
        id: number;
        username: string;
        avatar: string | null;
    };
    createdAt: Date;
    updatedAt: Date;
    pv: number;
    uv: number;
    top: number;
};

export function FeedCard({ feed }: { feed: Feed }) {
    const { t } = useTranslation();
    const config = React.useContext(ClientConfigContext);
    const counterEnabled = config.get<boolean>("counter.enabled");
    const profile = React.useContext(ProfileContext);

    // 检测 Markdown 中的第一张图片作为封面图
    const [coverImage, setCoverImage] = React.useState<string | null>(null);
    
    React.useEffect(() => {
        const imgRegex = /!\[.*?\]\((.*?)\)/;
        const imgMatch = imgRegex.exec(feed.content);
        if (imgMatch && imgMatch[1]) {
            setCoverImage(imgMatch[1]);
        }
    }, [feed.content]);

    // 提取没有 Markdown 符号的纯文本预览
    const contentPreview = React.useMemo(() => {
        const plainText = feed.content
            .replace(/!\[.*?\]\(.*?\)/g, '') // 移除图片
            .replace(/\[.*?\]\(.*?\)/g, '$1') // 将链接替换为链接文本
            .replace(/#{1,6}\s+/g, '') // 移除标题标记
            .replace(/(`{1,3}).*?\1/g, '') // 移除代码块
            .replace(/\*\*|__|\*|_/g, '') // 移除加粗/斜体
            .trim();
        
        return plainText.length > 150 ? plainText.substring(0, 150) + '...' : plainText;
    }, [feed.content]);

    // 是否有特色封面
    const hasCover = !!coverImage;

    return (
        <Link
            href={`/feed/${feed.id}`}
            className="block w-full h-full"
        >
            <article
                className="bg-w rounded-2xl transition-all shadow-sm hover:shadow-md p-0 h-full flex flex-col overflow-hidden group"
            >
                {/* 置顶标记 */}
                {feed.top > 0 && (
                    <div className="absolute top-0 right-0 z-10">
                        <div className="bg-theme text-white font-medium text-xs px-2 py-1 rounded-bl-lg flex items-center gap-1 shadow-sm">
                            <i className="ri-pin-fill"></i>
                            {t("pinned")}
                        </div>
                    </div>
                )}
                
                {/* 文章封面图 */}
                {hasCover && (
                    <div className="relative w-full pt-[50%] overflow-hidden">
                        <img
                            src={coverImage}
                            alt={feed.title || "Cover"}
                            className="absolute top-0 left-0 w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-105"
                            loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/30"></div>
                    </div>
                )}
                
                {/* 文章主体内容 */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col">
                    {/* 文章标题 */}
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2 line-clamp-2 group-hover:text-theme transition-colors">
                        {feed.title || t('unnamed')}
                    </h2>
                    
                    {/* 文章预览摘要 */}
                    <p className="text-gray-600 dark:text-gray-300 text-sm mb-3 line-clamp-2">
                        {contentPreview}
                    </p>
                    
                    {/* 标签列表 */}
                    {feed.hashtags.length > 0 && (
                        <div className="mt-auto mb-3 flex flex-wrap gap-1.5">
                            {feed.hashtags.map(({ name }, index) => (
                                <span
                                    key={`hashtag-${name}-${index}`}
                                    onClick={(e) => e.preventDefault()}
                                >
                                    <HashTag name={name} size="small" />
                                </span>
                            ))}
                        </div>
                    )}
                    
                    {/* 文章元数据 */}
                    <div className="mt-1 flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                        <div className="flex items-center space-x-4">
                            {/* 作者 */}
                            <div className="flex items-center">
                                <img 
                                    src={feed.user.avatar || "/avatar.png"} 
                                    alt={feed.user.username}
                                    className="w-5 h-5 rounded-full mr-1.5"
                                />
                                <span>{feed.user.username}</span>
                            </div>
                            
                            {/* 发布时间 */}
                            <span className="flex items-center">
                                <i className="ri-calendar-line mr-1"></i>
                                {timeago(feed.createdAt)}
                            </span>
                        </div>
                        
                        {/* 阅读量 */}
                        {counterEnabled && (
                            <span className="flex items-center">
                                <i className="ri-eye-line mr-1"></i>
                                {feed.pv}
                            </span>
                        )}
                    </div>
                </div>
            </article>
        </Link>
    );
}