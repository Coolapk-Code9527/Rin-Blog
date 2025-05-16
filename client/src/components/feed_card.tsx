import {Link} from "wouter";
import {useTranslation} from "react-i18next";
import {timeago} from "../utils/timeago";
import {HashTag} from "./hashtag";
import {SimplifiedMarkdown} from "./markdown";
import React from "react";

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
            <Link href={`/feed/${id}`} 
            className={`group block w-full rounded-2xl bg-white dark:bg-gray-800 h-full duration-300 overflow-hidden hover:shadow-lg transition-all transform hover:-translate-y-1 border ${top === 1 
                ? 'border-theme/30 dark:border-theme/20 shadow-md' 
                : 'border-gray-100 dark:border-gray-700 shadow-sm'} 
                flex flex-col min-h-[260px] xs:min-h-[280px] focus:outline-none focus:ring-2 focus:ring-theme focus:ring-offset-2 dark:focus:ring-offset-gray-900`}
            aria-labelledby={`article-title-${id}`}
            onMouseEnter={prefetchArticle}
            onTouchStart={handleTouchStart}
        >
            {/* 卡片顶部区域 - 增加图片显示区域高度 */}
            <div className={`w-full h-44 xs:h-52 sm:h-56 md:h-60 overflow-hidden rounded-t-xl relative`}>
                {/* 渐变背景占位 - 根据文章标题生成的稳定渐变色 */}
                <div 
                    className="absolute inset-0 w-full h-full z-0"
                    style={{
                        background: `linear-gradient(${generateGradient.angle}deg, ${generateGradient.colors.join(', ')})`,
                        opacity: avatar && imageLoaded ? 0 : 0.8
                    }}
                />
                
                {/* 顶部渐变遮罩层 */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent opacity-40 group-hover:opacity-60 transition-opacity duration-300 z-10"></div>
                
                {avatar && (
                    <>
                        {/* 图片加载状态指示器 */}
                        {!imageLoaded && !imageError && (
                            <div className="absolute inset-0 flex items-center justify-center z-5">
                                <div className="w-8 h-8 border-2 border-white/70 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        )}
                        
                        {/* 图片加载错误占位符 */}
                        {imageError && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center z-5">
                                <i className="ri-image-line text-3xl text-white/80 mb-2"></i>
                                <span className="text-xs text-white/80 bg-black/30 px-2 py-1 rounded">{t('image_load_error')}</span>
                            </div>
                        )}
                        
                        <img 
                            src={avatar} 
                            alt={title}
                            loading="lazy"
                            decoding="async"
                            className={`object-cover w-full h-full group-hover:scale-105 transition-all duration-700 ${imageLoaded ? 'opacity-100' : 'opacity-0'} z-1`}
                            onLoad={() => setImageLoaded(true)}
                            onError={() => {
                                setImageError(true);
                                setImageLoaded(true);
                            }}
                        />
                    </>
                )}
                
                {/* 无图片时的内容提示 */}
                {!avatar && (
                    <div className="absolute inset-0 flex items-center justify-center z-5">
                        <div className="text-white/90 text-center px-4">
                            <i className="ri-article-line text-4xl mb-2 drop-shadow-md"></i>
                            <p className="text-sm font-medium drop-shadow-md">{title.substring(0, 20)}{title.length > 20 ? '...' : ''}</p>
                        </div>
                    </div>
                )}
                    
                {/* 置顶标识 - 优化位置居中 */}
                {top === 1 && (
                    <div className="absolute top-3 right-3 z-20 flex items-center justify-center">
                        <div className="bg-theme text-white text-xs font-medium px-2.5 py-1.5 rounded-full shadow-md flex items-center">
                            <i className="ri-pushpin-line mr-1"></i>
                            <span>{t('article.top.title')}</span>
                        </div>
                    </div>
                )}
                
                {/* 今日发布标识 */}
                {isToday() && (
                    <div className="absolute top-3 left-3 bg-emerald-500 text-white text-xs font-medium px-2.5 py-1 rounded-full shadow-md z-20 flex items-center justify-center">
                        <i className="ri-time-line mr-1.5"></i>
                        <span className="hidden xs:inline">{t('today')}</span>
                    </div>
                )}
            </div>
            
            {/* 卡片内容区域 */}
            <div className="p-4 sm:p-5 flex-1 flex flex-col">
                {/* 文章标题 */}
                <h2 id={`article-title-${id}`} className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white text-pretty overflow-hidden mb-1 sm:mb-2 leading-tight group-hover:text-theme dark:group-hover:text-theme transition-colors duration-300 line-clamp-2">
                    {title}
                </h2>
                    
                {/* 日期和状态区域 - 移动端紧凑设计 */}
                <div className="flex flex-wrap justify-between items-center gap-1 mb-2 text-xs text-gray-500 dark:text-gray-400">
                    {/* 左侧日期显示 */}
                    <div className="flex items-center">
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
                
                {/* 文章摘要 - 无需显示"文章描述"文字 */}
                <div className="text-pretty overflow-hidden dark:text-gray-300 text-gray-600 text-xs sm:text-sm leading-relaxed line-clamp-3 mb-auto h-[4.5rem] sm:h-[5rem] group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors duration-300">
                    <SimplifiedMarkdown content={cleanedSummary} />
                </div>
                    
                {/* 标签区域 - 统一分割线样式和对齐方式 */}
                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/30">
                    {hashtags.length > 0 ? (
                        <div className="flex flex-row flex-wrap items-center gap-1.5 sm:gap-2">
                            {hashtags.map(({id, name}) => (
                                <div key={id} className="animate-fadeIn">
                                    <HashTag name={name} />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-6"></div> // 占位，保持底部对齐
                    )}
                </div>
            </div>
        </Link>
    )
}