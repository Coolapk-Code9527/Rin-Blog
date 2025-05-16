import {Link} from "wouter";
import {useTranslation} from "react-i18next";
import {timeago} from "../utils/timeago";
import {HashTag} from "./hashtag";
import {SimplifiedMarkdown} from "./markdown";
import React, { memo } from "react";
import { FiCalendar } from "react-icons/fi";
import dayjs from "dayjs";

export function FeedCard({ id, title, avatar, draft, listed, top, summary, hashtags, createdAt, updatedAt }:
    {
        id: string, avatar?: string,
        draft?: number, listed?: number, top?: number,
        title: string, summary: string,
        hashtags: { id: number, name: string }[],
        createdAt: Date, updatedAt: Date
    }) {
    const { t } = useTranslation();
    const [imageLoaded, setImageLoaded] = React.useState(false);
    const [imageError, setImageError] = React.useState(false);

    // 预处理 summary，移除 Markdown 图片链接
    const cleanedSummary = summary ? summary.replace(/!\[.*?\]\(.*?\)/g, "") : ""; 

    // 判断是否为"今天"发布的文章
    const isToday = () => {
        const today = new Date();
        const pubDate = new Date(createdAt);
        return today.getDate() === pubDate.getDate() && 
               today.getMonth() === pubDate.getMonth() &&
               today.getFullYear() === pubDate.getFullYear();
    };
    
    // 格式化日期显示
    const formatDate = (date: Date) => {
        const d = new Date(date);
        return `${d.getMonth()+1}-${d.getDate()}`;
    };

    // 预加载文章详情页（当用户悬停卡片时）
    const prefetchArticle = () => {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = `/feed/${id}`;
        document.head.appendChild(link);
    };
    
    // 触觉反馈支持 - 用于移动设备
    const handleTouchStart = () => {
        if ('vibrate' in navigator) {
            navigator.vibrate(5); // 轻微振动5毫秒
        }
    };
    
    // 为文章生成基于标题的稳定渐变背景
    const generateGradient = React.useMemo(() => {
        // 根据文章ID和标题生成一致的颜色
        const getHashCode = (str: string) => {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = ((hash << 5) - hash) + str.charCodeAt(i);
                hash = hash & hash; // 转换为32位整数
            }
            return Math.abs(hash);
        };
        
        const colorPalettes = [
            ['#4158D0', '#C850C0', '#FFCC70'], // 紫蓝到粉
            ['#0093E9', '#80D0C7'], // 蓝到青
            ['#8EC5FC', '#E0C3FC'], // 浅蓝到浅紫
            ['#FFDEE9', '#B5FFFC'], // 粉到青
            ['#FF9A8B', '#FF6A88', '#FF99AC'], // 珊瑚到粉
            ['#FBAB7E', '#F7CE68'], // 橙到黄
            ['#85FFBD', '#FFFB7D'], // 绿到黄
            ['#FF3CAC', '#784BA0', '#2B86C5'], // 粉到紫再到蓝
            ['#D9AFD9', '#97D9E1'], // 浅紫到浅蓝
            ['#0250c5', '#d43f8d'], // 深蓝到玫红
        ];
        
        const hash = getHashCode(`${id}-${title}`);
        const paletteIndex = hash % colorPalettes.length;
        
        return {
            colors: colorPalettes[paletteIndex],
            angle: (hash % 360)
        };
    }, [id, title]);

    return (
        <div
            className={`w-full overflow-hidden ${
                top === 1
                    ? "col-span-full"
                    : ""
            } group transition-transform duration-300 ease-out hover:-translate-y-1`}
        >
            <Link
                href={`/feed/${id}`}
                className={`block h-full rounded-xl border dark:border-gray-800 shadow-sm dark:shadow-none hover:shadow-md dark:bg-gray-800/50 bg-white backdrop-blur-sm transition-all duration-300 ${
                    top === 1 ? "ring-2 ring-pink-500/70 dark:ring-pink-600/50" : ""
                }`}
                onMouseEnter={prefetchArticle}
            >
                {/* 图片区域 - 优化图片显示比例和加载体验 */}
                <div className={`relative overflow-hidden ${avatar ? "h-32 sm:h-40 md:h-48" : "h-0"}`}>
                    {avatar && (
                        <>
                            <div className="absolute inset-0 bg-gradient-to-b from-gray-900/0 to-gray-900/80 z-10"></div>
                            <img 
                                src={avatar} 
                                alt={title}
                                loading="lazy"
                                decoding="async"
                                className={`object-cover h-full w-full transform group-hover:scale-105 transition-transform duration-700 ease-in-out`}
                                onLoad={() => setImageLoaded(true)}
                                onError={() => {
                                    setImageError(true);
                                    setImageLoaded(true);
                                }}
                            />
                            {/* 显示文章日期，添加半透明背景提高辨识度 */}
                            <div className="absolute bottom-2 right-2 z-10 bg-gray-800/80 text-white text-xs px-2 py-1 rounded-md">
                                {createdAt && (
                                    <div className="flex items-center space-x-1">
                                        <FiCalendar className="w-3 h-3" />
                                        <span>
                                            {dayjs(createdAt).format("YYYY-MM-DD")}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                    {/* 置顶标识 - 增强视觉效果 */}
                    {top === 1 && (
                        <div className="absolute top-2 left-2 z-10">
                            <div className={`text-xs px-2 py-1 rounded-md bg-amber-500 text-white`}>
                                {t('article.top.title')}
                            </div>
                        </div>
                    )}
                </div>

                {/* 内容区域 - 优化边距和层次感 */}
                <div className="p-3 sm:p-4 flex flex-col h-[calc(100%-theme(height.32))] sm:h-[calc(100%-theme(height.40))] md:h-[calc(100%-theme(height.48))]">
                    {/* 标题区域 - 优化字体大小和行高 */}
                    <div className="mb-2">
                        <h2 className="text-md sm:text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 line-clamp-2 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors duration-300">
                            {title}
                        </h2>
                    </div>
                    
                    {/* 日期和状态区域 - 移动端紧凑设计 */}
                    <div className="flex flex-wrap justify-between items-center gap-1 mb-3 text-xs text-gray-500 dark:text-gray-400">
                        {/* 左侧日期显示 */}
                        <div className="flex items-center bg-gray-100/80 dark:bg-gray-800/80 rounded-full px-2 py-0.5">
                            <i className="ri-calendar-line mr-1"></i>
                            {formatDate(createdAt)}
                            {createdAt !== updatedAt &&
                                <span className="ml-2 flex items-center" title={new Date(updatedAt).toLocaleString()}>
                                    <i className="ri-history-line mr-1"></i>
                                    {formatDate(updatedAt)}
                                </span>
                            }
                        </div>
                        
                        {/* 右侧状态显示 - 改进草稿和未列出标签样式 */}
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            {draft === 1 && 
                                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-theme/10 text-theme border border-theme/30 dark:bg-theme/20 dark:border-theme/20 shadow-sm">
                                    <i className="ri-draft-line mr-1 text-theme"></i>
                                    <span>{t("draft")}</span>
                                </span>
                            }
                            {listed === 0 && 
                                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-theme/10 text-theme border border-theme/30 dark:bg-theme/20 dark:border-theme/20 shadow-sm">
                                    <i className="ri-eye-off-line mr-1 text-theme"></i>
                                    <span>{t("unlisted")}</span>
                                </span>
                            }
                        </div>
                    </div>
                    
                    {/* 文章摘要 - 完全重写自适应显示逻辑 */}
                    <div className="flex-1 min-h-0 overflow-hidden relative">
                        <div className="h-full text-pretty dark:text-gray-300 text-gray-600 text-xs sm:text-sm leading-relaxed group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors duration-300">
                            <SimplifiedMarkdown content={cleanedSummary} />
                        </div>
                        {/* 渐变遮罩层，创建自然的文本截断效果 */}
                        <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white dark:from-gray-800 to-transparent"></div>
                    </div>
                        
                    {/* 标签区域 - 统一分割线样式和对齐方式 */}
                    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700/30">
                        <div className="flex flex-wrap items-center gap-2">
                            {/* 文章标签 - 提高层次感和可读性 */}
                            {hashtags && hashtags.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {hashtags.map(({id, name}) => (
                                        <div
                                            key={id}
                                            className="text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700/50 px-2 py-0.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                        >
                                            {name}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </Link>
        </div>
    )
}