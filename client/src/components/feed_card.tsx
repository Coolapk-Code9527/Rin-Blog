import {Link} from "wouter";
import {useTranslation} from "react-i18next";
import {HashTag} from "./hashtag";
import {SimplifiedMarkdown} from "./markdown";
import React from "react";
import { useGlassEffect, GLASS_LAYERS } from "../hooks/useGlassEffect";
import { ViewMode } from "./view_toggle";
import { generateGradient, generateGradientCSS } from '../utils/placeholderUtils';

export function FeedCard({ id, title, avatar, draft, listed, top, summary, hashtags, createdAt, updatedAt, pv, uv, viewMode = 'grid' }:
    {
        id: string, avatar?: string,
        draft?: number, listed?: number, top?: number,
        title: string, summary: string,
        hashtags: { id: number, name: string }[],
        createdAt: Date, updatedAt: Date,
        pv?: number, uv?: number,
        viewMode?: ViewMode
    }) {
    const { t } = useTranslation();
    const [imageLoaded, setImageLoaded] = React.useState(false);
    const [imageError, setImageError] = React.useState(false);

    // 使用智能毛玻璃效果
    const glassClass = useGlassEffect(GLASS_LAYERS.CARD);

    // 移除复杂的动态截断Hook，使用简单可靠的固定行数



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
    
    // 使用统一的渐变生成工具
    const gradientConfig = React.useMemo(() => generateGradient(id, title), [id, title]);

    // CSS变量定义，用于支持渐变遮罩效果
    const cardStyle = {
        '--card-bg': 'white',
        '--card-bg-dark': '#1f2937',
    } as React.CSSProperties;

    // 根据视图模式确定布局类名
    const getLayoutClasses = () => {
        const baseClasses = `group block w-full rounded-2xl overflow-hidden transition-all border ${top === 1
            ? `${glassClass} border-theme/40 dark:border-theme/30 shadow-enhanced-lg ring-2 ring-theme/15`
            : `${glassClass} border-neutral-300/60 dark:border-neutral-600/60 shadow-enhanced hover:border-neutral-400/80 dark:hover:border-neutral-500/80`}
            focus:outline-none focus:ring-2 focus:ring-theme/40 focus:ring-offset-2 dark:focus:ring-offset-gray-900
            view-transition-container view-transition-fade-in
        `;

        if (viewMode === 'list') {
            // 优化列表视图布局：固定高度确保一致性，使用flex布局优化空间分配
            return `${baseClasses} list-view-card flex flex-row h-[160px] sm:h-[180px] md:h-[200px]`;
        } else {
            // 优化网格视图布局：增加移动端高度以适应更高的图片显示
            return `${baseClasses} grid-view-card flex flex-col h-[380px] sm:h-[400px] md:h-[420px]`;
        }
    };

    return (
            <Link href={`/feed/${id}`}
            className={getLayoutClasses()}
            aria-labelledby={`article-title-${id}`}
            onMouseEnter={prefetchArticle}
            style={{
                ...cardStyle,
                boxShadow: top === 1
                    ? '0 4px 20px rgba(0, 122, 255, 0.1), 0 1px 3px rgba(0, 0, 0, 0.1)'
                    : '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
            } as React.CSSProperties}
            replace={false}
        >
            {/* 置顶标识 - 优化为紧凑角标设计 */}
            {top === 1 && (
                <div className="absolute top-2 right-2 z-40 flex items-center justify-center">
                    <div className={`bg-theme text-white font-medium rounded-full shadow-lg flex items-center transition-all duration-200 ${
                        viewMode === 'list'
                            ? 'text-xs px-1.5 py-1 sm:px-2 sm:py-1' // 列表视图更紧凑
                            : 'text-xs px-2 py-1 sm:px-2.5 sm:py-1.5' // 网格视图稍大
                    }`}>
                        <i className="ri-pushpin-line"></i>
                        <span className="ml-1 hidden sm:inline">{t('article.top.title')}</span>
                    </div>
                </div>
            )}

            {/* 图片区域 - 根据视图模式调整布局，优化移动端网格视图图片高度 */}
            <div className={viewMode === 'list'
                ? `w-[140px] sm:w-[160px] md:w-[200px] h-full overflow-hidden rounded-l-xl relative flex-shrink-0`
                : `w-full h-44 xs:h-48 sm:h-52 md:h-56 overflow-hidden rounded-t-xl relative`  // 增加移动端图片高度
            }>
                {/* 动态渐变背景层 - 使用统一工具函数 */}
                <div
                    className="absolute inset-0 w-full h-full z-0"
                    style={{
                        background: `linear-gradient(${gradientConfig.angle}deg, ${gradientConfig.colors.join(', ')})`,
                        opacity: (!avatar || imageError) ? 0.8 : 0,
                        transition: 'opacity 0.3s'
                    }}
                />
                {/* 顶部渐变遮罩层 */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent opacity-50 group-hover:opacity-70 transition-opacity duration-300 z-20"></div>
                {avatar && !imageError && (
                    <>
                        {/* 图片加载状态指示器 */}
                        {!imageLoaded && (
                            <div className="absolute inset-0 flex items-center justify-center z-5">
                                <div className="w-7 h-7 sm:w-8 sm:h-8 border-2 border-white/70 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        )}
                        <img
                            src={avatar}
                            alt={title}
                            loading="lazy"
                            decoding="async"
                            className={`object-cover w-full h-full group-hover:scale-105 transition-all duration-700 ${imageLoaded ? 'opacity-100' : 'opacity-0'} z-10`}
                            onLoad={() => setImageLoaded(true)}
                            onError={() => {
                                setImageError(true);
                                setImageLoaded(true);
                            }}
                        />
                    </>
                )}
                {/* 无图片或图片加载失败时的占位符（统一风格） */}
                {(!avatar || imageError) && (
                    <div className="absolute inset-0 flex items-center justify-center z-20 text-white/90 text-center px-2">
                        {viewMode === 'list' ? (
                            <i className="ri-article-line text-2xl sm:text-3xl drop-shadow-md"></i>
                        ) : (
                            <>
                                <i className="ri-article-line text-3xl sm:text-4xl mb-1 sm:mb-2 drop-shadow-md"></i>
                                <p className="text-xs sm:text-sm font-medium drop-shadow-md">{title.substring(0, 20)}{title.length > 20 ? '...' : ''}</p>
                            </>
                        )}
                    </div>
                )}

                {/* 今日发布标识 */}
                {isToday() && (
                    <div className="absolute top-3 left-3 bg-emerald-500 text-white text-xs font-medium px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-full shadow-md z-30 flex items-center justify-center gap-1">
                        <i className="ri-time-line"></i>
                        <span className="hidden xs:inline">{t('today')}</span>
                    </div>
                )}
            </div>
            
            {/* 卡片内容区域 - 根据视图模式调整布局 */}
            <div className={viewMode === 'list'
                ? "p-3 sm:p-4 flex-1 flex flex-col justify-between min-h-0 overflow-hidden"
                : "p-3 sm:p-4 flex-1 flex flex-col justify-between min-h-0 overflow-hidden"
            }>
                {/* 文章标题 - 智能响应式截断优化 */}
                <h2 id={`article-title-${id}`} className={
                    viewMode === 'list'
                        ? `text-sm sm:text-base font-bold text-gray-800 dark:text-white overflow-hidden mb-1 leading-tight group-hover:text-theme dark:group-hover:text-theme transition-colors duration-300 ${
                            // 列表视图：统一单行截断，给摘要更多空间
                            'line-clamp-1'
                        } ${top === 1 ? 'pr-16 sm:pr-20' : ''}`  // 有置顶标识时预留右侧空间
                        : `text-lg sm:text-xl font-bold text-gray-800 dark:text-white overflow-hidden mb-1 sm:mb-1.5 leading-tight group-hover:text-theme dark:group-hover:text-theme transition-colors duration-300 ${
                            // 网格视图：统一单行截断，给摘要更多空间
                            'line-clamp-1'
                        } ${top === 1 ? 'pr-12 sm:pr-16' : ''}`  // 有置顶标识时预留右侧空间
                }>
                    {title}
                </h2>
                    
                {/* 日期、浏览量和状态区域 - 根据视图模式优化移动端显示 */}
                <div className={viewMode === 'list'
                    ? "flex flex-wrap justify-between items-center gap-1 mb-2 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400"
                    : "flex flex-wrap justify-between items-center gap-1 mb-2 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400"
                }>
                    {/* 左侧日期和浏览量显示 - 优化移动端间距 */}
                    <div className={viewMode === 'list'
                        ? "flex items-center bg-gray-100/80 dark:bg-gray-800/80 rounded-full px-1 py-0.5 sm:px-1.5 text-[10px] sm:text-xs"
                        : "flex items-center bg-gray-100/80 dark:bg-gray-800/80 rounded-full px-1 py-0.5 sm:px-2 text-[10px] sm:text-xs"
                    }>
                        {/* 发布日期 */}
                        <div className="flex items-center">
                            <i className="ri-calendar-line text-blue-500 mr-0.5 sm:mr-1 text-xs sm:text-sm"></i>
                            <span>{formatDate(createdAt)}</span>
                        </div>

                        {/* 更新日期 - 列表视图移动端简化显示 */}
                        {createdAt !== updatedAt && (
                            <div className="flex items-center ml-1.5 sm:ml-2" title={new Date(updatedAt).toLocaleString()}>
                                <i className="ri-history-line text-purple-400 mr-0.5 sm:mr-1 text-xs sm:text-sm"></i>
                                <span>{formatDate(updatedAt)}</span>
                            </div>
                        )}

                        {/* 浏览量信息 - 优化移动端显示 */}
                        {(pv !== undefined || uv !== undefined) && (
                            <div className="flex items-center ml-1.5 sm:ml-2">
                                <i className="ri-eye-line text-green-500 mr-0.5 sm:mr-1 text-xs sm:text-sm"></i>
                                <span>{pv || 0}</span>
                                <i className="ri-user-3-line text-pink-400 ml-1.5 sm:ml-2 mr-0.5 sm:mr-1 text-xs sm:text-sm"></i>
                                <span>{uv || 0}</span>
                            </div>
                        )}
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
                
                {/* 文章摘要 - 使用固定行数截断，简单可靠 */}
                <div className={viewMode === 'list' ? "flex-1 min-h-0 mb-2" : "flex-1 flex flex-col min-h-0"}>
                    <div className={viewMode === 'list'
                        ? "dark:text-gray-300 text-gray-600 text-sm leading-normal group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors duration-300 line-clamp-3 sm:line-clamp-4"
                        : "dark:text-gray-300 text-gray-600 text-sm leading-normal group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors duration-300 line-clamp-4 sm:line-clamp-3 lg:line-clamp-3"
                    }>
                        <SimplifiedMarkdown content={summary} />
                    </div>
                </div>
                    
                {/* 标签区域 - 统一为没标签时的高度，确保摘要区域一致 */}
                <div className={viewMode === 'list'
                    ? "mt-auto pt-1 border-t border-gray-100 dark:border-gray-700/40 flex-shrink-0 h-6"
                    : "mt-auto pt-2 border-t-2 border-gray-100 dark:border-gray-700/40 flex-shrink-0 h-8"
                }>
                    {hashtags.length > 0 ? (
                        <div className={viewMode === 'list'
                            ? "flex flex-row flex-wrap items-center gap-1 h-full"
                            : "flex flex-row flex-wrap items-center gap-1.5 sm:gap-2 h-full"
                        }>
                            {(viewMode === 'list' ? hashtags.slice(0, 2) : hashtags).map(({id, name}) => (
                                <div key={id} className="animate-fadeIn">
                                    <HashTag name={name} />
                                </div>
                            ))}
                            {viewMode === 'list' && hashtags.length > 2 && (
                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                    +{hashtags.length - 2}
                                </span>
                            )}
                        </div>
                    ) : (
                        <div className={viewMode === 'list' ? "h-4" : "h-6"}></div>
                    )}
                </div>
            </div>
        </Link>
    )
}