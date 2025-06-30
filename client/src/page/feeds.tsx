import React, { useMemo } from "react"
import { Helmet } from 'react-helmet-async'
import { Link, useSearch, useLocation } from "wouter"
import { FeedCard } from "../components/feed_card"
import { Waiting } from "../components/loading"
import { Pagination } from "../components/pagination"
import { ProfileContext } from "../state/profile"
import { siteName } from "../utils/constants"
import { tryInt } from "../utils/int"
import { useTranslation } from "react-i18next";
import { useGlassEffect, GLASS_LAYERS } from "../hooks/useGlassEffect"
import { useViewMode } from "../components/view_toggle"
import { useContext } from "react"
import { ExtendedConfigContext } from "../context/ConfigContext"
import { ArticleListLayout } from "../components/layout"
import { ArticleManagementTabs, type ListState, type SortType } from '../components/ArticleManagementTabs';
import { ClientConfigContext } from "../state/config"
import { getSidebarConfig } from "../utils/sidebarConfig"
import { useSmartGrid } from "../hooks/useSmartGrid"
import { useFeedsCache, FeedType } from "../hooks/useFeedsCache"

import { generateGradient } from '../utils/placeholderUtils';
import { useSafeCacheInvalidation } from "../hooks/useComponentSafety"
import { ErrorBoundary } from "../components/ErrorBoundary"
import { useFeedCacheInvalidation } from "../hooks/useCacheEvents"

// FeedsData类型由useFeedsCache Hook提供
// FeedType统一使用useFeedsCache中的定义

// FeedsMap类型不再需要，因为使用缓存Hook



// 懒加载Feed卡片组件
function LazyFeedCardComponent({ id, viewMode, ...props }: any) {
    const [isVisible, setIsVisible] = React.useState(false);
    const [isIntersecting, setIsIntersecting] = React.useState(false); // 新增状态跟踪元素是否在视口内
    const cardRef = React.useRef<HTMLDivElement>(null);


    // 使用统一的毛玻璃效果
    const glassClass = useGlassEffect(GLASS_LAYERS.CARD);

    // 使用统一的动态彩色占位符系统
    const gradientConfig = useMemo(() => generateGradient(id, props.title || ''), [id, props.title]);

    React.useEffect(() => {
        let timer: NodeJS.Timeout | null = null;
        let observer: IntersectionObserver | null = null;
        let isMounted = true;

        try {
            observer = new IntersectionObserver(
                ([entry]) => {
                    // 检查组件是否仍然挂载
                    if (!isMounted) return;

                    setIsIntersecting(entry.isIntersecting);
                    if (entry.isIntersecting) {
                        timer = setTimeout(() => {
                            if (isMounted) {
                                setIsVisible(true);
                                // 一旦显示就断开观察器，避免不必要的监听
                                if (observer) {
                                    observer.disconnect();
                                    observer = null;
                                }
                            }
                        }, 150);
                    }
                },
                { threshold: 0.1, rootMargin: '50px 0px' } // 减少预加载范围，避免过度渲染
            );

            if (cardRef.current && observer) {
                observer.observe(cardRef.current);
            }
        } catch (error) {
            console.warn('Failed to create IntersectionObserver:', error);
            // 降级：直接显示内容
            setIsVisible(true);
        }

        return () => {
            isMounted = false;

            // 清理定时器
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }

            // 清理观察器
            if (observer) {
                observer.disconnect();
                observer = null;
            }
        };
    }, []);

    return (
        <div ref={cardRef} className="w-full h-full">
            {isVisible ? (
                <FeedCard id={id} viewMode={viewMode} {...props} />
            ) : (
                <div
                    className={`block w-full rounded-2xl ${glassClass} h-full overflow-hidden border border-neutral-300/60 dark:border-neutral-600/60 shadow-enhanced transition-opacity duration-300 ${isIntersecting ? 'opacity-100' : 'opacity-40'} ${viewMode === 'list' ? 'flex flex-row h-[160px] sm:h-[180px] md:h-[200px]' : 'flex flex-col h-[380px] sm:h-[400px] md:h-[420px]'}`}
                    aria-hidden="true"
                    aria-label="文章内容加载中"
                >
                    {/* 骨架屏图片区域 - 使用彩色背景 */}
                    <div
                        className={viewMode === 'list'
                            ? `w-[140px] sm:w-[160px] md:w-[200px] h-full overflow-hidden rounded-l-xl relative animate-pulse flex-shrink-0`
                            : `w-full h-44 xs:h-48 sm:h-52 md:h-56 overflow-hidden rounded-t-xl relative animate-pulse`
                        }
                        style={{
                            background: `linear-gradient(${gradientConfig.angle}deg, ${gradientConfig.colors.join(', ')})`
                        }}>
                    </div>
                    
                    {/* 骨架屏内容区域 - 与普通骨架屏保持一致 */}
                    <div className={viewMode === 'list'
                        ? "p-3 sm:p-4 flex-1 flex flex-col justify-between min-h-0 overflow-hidden"
                        : "p-3 sm:p-4 flex-1 flex flex-col justify-between min-h-0 overflow-hidden"
                    }>
                        {/* 标题占位 - 匹配智能截断逻辑 */}
                        <div className={viewMode === 'list'
                            ? "h-4 sm:h-5 bg-gray-200 dark:bg-gray-700 rounded-md w-3/4 mb-1 animate-pulse"
                            : "h-6 sm:h-7 bg-gray-200 dark:bg-gray-700 rounded-md w-3/4 mb-1 sm:mb-1.5 animate-pulse"
                        }></div>
                        {/* 第二行标题占位 - 与普通骨架屏保持一致 */}
                        <div className={viewMode === 'list'
                            ? "h-3 sm:h-4 bg-gray-200 dark:bg-gray-700 rounded-md w-1/2 mb-2 animate-pulse hidden sm:block"
                            : "h-4 sm:h-5 bg-gray-200 dark:bg-gray-700 rounded-md w-1/2 mb-2 sm:mb-3 animate-pulse"
                        }></div>
                        {/* 第三行标题占位 - 仅网格视图桌面端显示 */}
                        {viewMode === 'grid' && (
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-md w-1/3 mb-2 animate-pulse hidden sm:block"></div>
                        )}

                        {/* 日期和状态占位 */}
                        <div className="flex justify-between mb-2">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-md w-1/4 animate-pulse"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-md w-1/5 animate-pulse"></div>
                        </div>

                        {/* 摘要占位 */}
                        <div className={viewMode === 'list' ? "space-y-1.5 mb-2" : "space-y-1.5 mb-3"}>
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse"></div>
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse"></div>
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/5 animate-pulse"></div>
                        </div>

                        {/* 标签占位 */}
                        <div className={viewMode === 'list'
                            ? "mt-auto pt-1 border-t border-gray-100 dark:border-gray-700/30 flex-shrink-0"
                            : "mt-auto pt-2 border-t border-gray-100 dark:border-gray-700/30"
                        }>
                            <div className="flex gap-2">
                                <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
                                <div className="h-6 w-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// 使用React.memo优化LazyFeedCard组件，避免不必要的重新渲染
const LazyFeedCard: React.ComponentType<any> = React.memo(LazyFeedCardComponent);

export function FeedsPage() {
    const { t } = useTranslation()
    const query = new URLSearchParams(useSearch());
    const [, setLocation] = useLocation();
    const profile = React.useContext(ProfileContext);
    const config = React.useContext(ClientConfigContext);

    // 获取侧边栏配置
    const sidebarConfig = getSidebarConfig(config);

    // 智能响应式网格配置
    const { gridCols, showButtonText } = useSmartGrid(sidebarConfig.enabled);

    const [listState, _setListState] = React.useState<FeedType>(query.get("type") as FeedType || 'normal')
    const [sortType, setSortType] = React.useState<SortType>(query.get("sort") as SortType || 'latest')

    // 统一的分页配置管理
    const page = tryInt(1, query.get("page"))
    const limit = tryInt(10, query.get("limit"), process.env.PAGE_SIZE) // 服务端分页每页显示数量

    // 使用缓存Hook替代直接API调用和本地状态管理
    // 保持批量获取模式以显示全部文章，但需要修复批量获取的预加载问题
    const {
        data: feedsData,
        loading,
        invalidate: invalidateFeedsCache
    } = useFeedsCache({
        type: listState as FeedType,
        limit: 9999, // 保持批量获取模式，确保能看到全部文章
        enabled: true
    })
    const ref = React.useRef("")

    // 使用安全的缓存失效机制
    const safeInvalidateFeedsCache = useSafeCacheInvalidation(invalidateFeedsCache);

    // 使用统一的缓存事件管理器监听文章发布/更新/删除事件
    useFeedCacheInvalidation(safeInvalidateFeedsCache);

    // 获取配置加载状态
    const extendedConfig = useContext(ExtendedConfigContext);
    const initialLoading = extendedConfig?.initialLoading ?? false;
    const configLoaded = extendedConfig?.configLoaded ?? false;

    // 视图模式状态管理
    const { viewMode, setViewMode } = useViewMode();

    // 使用智能毛玻璃效果
    const glassClass = useGlassEffect(GLASS_LAYERS.CARD);
    const tagGlassClass = useGlassEffect('tag-enhanced');

    // 排序处理函数
    const handleSortChange = React.useCallback((newSort: SortType) => {
        setSortType(newSort);
        // 更新URL参数
        const newQuery = new URLSearchParams(query);
        newQuery.set('sort', newSort);
        if (newQuery.get('page') !== '1') {
            newQuery.set('page', '1'); // 切换排序时重置到第一页
        }
        setLocation(`/?${newQuery.toString()}`);
    }, [query, setLocation]);

    // 列表状态切换处理函数
    const handleListStateChange = React.useCallback((newState: ListState) => {
        _setListState(newState as FeedType);
        // 更新URL参数
        const newQuery = new URLSearchParams(query);
        if (newState === 'normal') {
            newQuery.delete('type');
        } else {
            newQuery.set('type', newState);
        }
        if (newQuery.get('page') !== '1') {
            newQuery.set('page', '1'); // 切换状态时重置到第一页
        }
        setLocation(`/?${newQuery.toString()}`);
    }, [query, setLocation]);

    // 恢复前端排序逻辑 - 服务端没有实现复杂排序（特别是热度排序）
    const sortedFeeds = React.useMemo(() => {
        const currentFeeds = feedsData?.data || [];
        if (!currentFeeds.length) return [];

        try {
            // 确保置顶文章始终在最前面
            const pinnedFeeds = currentFeeds.filter(feed => feed.top === 1);
            const normalFeeds = currentFeeds.filter(feed => feed.top !== 1);

            // 对非置顶文章进行排序
            const sorted = [...pinnedFeeds, ...normalFeeds.sort((a, b) => {
                switch (sortType) {
                    case 'latest':
                        // 正序排序：创建时间降序
                        const aTime = new Date(a.createdAt).getTime();
                        const bTime = new Date(b.createdAt).getTime();
                        if (aTime !== bTime) {
                            return bTime - aTime;
                        }
                        // 时间相同时按ID降序
                        return b.id - a.id;

                    case 'popular':
                        // 智能热度排序算法 - 优先使用真实浏览量数据
                        const aPv = a.pv || 0;
                        const bPv = b.pv || 0;
                        const aUv = a.uv || 0;
                        const bUv = b.uv || 0;

                        // 检查是否有任何真实的浏览量数据
                        const hasRealViewData = aPv > 0 || bPv > 0 || aUv > 0 || bUv > 0;

                        if (hasRealViewData) {
                            // 使用真实浏览量数据进行排序
                            const aViews = aPv + aUv * 0.5; // pv权重更高
                            const bViews = bPv + bUv * 0.5;

                            if (Math.abs(aViews - bViews) > 0.1) {
                                return bViews - aViews;
                            }
                            // 浏览量相同时按创建时间排序
                            const aTimeForViews = new Date(a.createdAt).getTime();
                            const bTimeForViews = new Date(b.createdAt).getTime();
                            return bTimeForViews - aTimeForViews;
                        }

                        // 智能热度算法：综合多个指标
                        const aCreated = new Date(a.createdAt).getTime();
                        const bCreated = new Date(b.createdAt).getTime();
                        const aUpdated = new Date(a.updatedAt).getTime();
                        const bUpdated = new Date(b.updatedAt).getTime();

                        // 计算文章活跃度（更新频率）
                        const aActivity = aUpdated - aCreated;
                        const bActivity = bUpdated - bCreated;

                        // 修复热度算法：更合理的计算方式
                        const now = Date.now();

                        // 1. 时间衰减因子（30天内线性衰减）
                        const daysSinceCreated_a = (now - aCreated) / (24 * 60 * 60 * 1000);
                        const daysSinceCreated_b = (now - bCreated) / (24 * 60 * 60 * 1000);
                        const aTimeFactor = Math.max(0, Math.min(1, (30 - daysSinceCreated_a) / 30));
                        const bTimeFactor = Math.max(0, Math.min(1, (30 - daysSinceCreated_b) / 30));

                        // 2. ID权重（归一化到0-1范围）
                        const maxId = Math.max(a.id, b.id, 25); // 假设最大ID约为25
                        const aIdFactor = a.id / maxId;
                        const bIdFactor = b.id / maxId;

                        // 3. 活跃度因子（更新频率，归一化）
                        const maxActivity = 7 * 24 * 60 * 60 * 1000; // 7天
                        const aActivityFactor = Math.min(1, aActivity / maxActivity);
                        const bActivityFactor = Math.min(1, bActivity / maxActivity);

                        // 综合热度分数计算（确保在0-1范围内）
                        const aHotScore = (
                            aTimeFactor * 0.5 +      // 时间新旧程度 50%
                            aIdFactor * 0.3 +        // ID权重 30%
                            aActivityFactor * 0.2    // 活跃度 20%
                        );

                        const bHotScore = (
                            bTimeFactor * 0.5 +
                            bIdFactor * 0.3 +
                            bActivityFactor * 0.2
                        );

                        // 保存热度分数用于调试
                        (a as any)._hotScore = aHotScore.toFixed(3);
                        (b as any)._hotScore = bHotScore.toFixed(3);

                        if (Math.abs(aHotScore - bHotScore) > 0.001) {
                            return bHotScore - aHotScore;
                        }

                        // 分数相同时按ID降序
                        return b.id - a.id;

                    case 'oldest':
                        // 倒序排序：创建时间升序
                        const aTimeOld = new Date(a.createdAt).getTime();
                        const bTimeOld = new Date(b.createdAt).getTime();
                        if (aTimeOld !== bTimeOld) {
                            return aTimeOld - bTimeOld;
                        }
                        // 时间相同时按ID升序
                        return a.id - b.id;

                    default:
                        return 0;
                }
            })];

            return sorted;

        } catch (error) {
            return currentFeeds; // 发生错误时返回原始数据
        }
    }, [feedsData, sortType]);



    // 缓存Hook自动处理数据获取，无需手动fetchFeeds函数

    // 恢复前端分页逻辑 - 对排序后的数据进行分页
    const paginatedFeeds = React.useMemo(() => {
        if (!sortedFeeds.length) return [];

        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedData = sortedFeeds.slice(startIndex, endIndex);

        return paginatedData;
    }, [sortedFeeds, page, limit]);

    // 计算总页数
    const totalPages = React.useMemo(() => {
        if (!sortedFeeds.length) return 1;
        return Math.ceil(sortedFeeds.length / limit);
    }, [sortedFeeds.length, limit]);
    
    React.useEffect(() => {
        const key = `${query.get("type")} ${query.get("sort")}`
        if (ref.current == key) return
        const type = query.get("type") as FeedType || 'normal'
        const sort = query.get("sort") as SortType || 'latest'
        if (type !== listState) {
            _setListState(type)
        }
        if (sort !== sortType) {
            setSortType(sort)
        }
        // 缓存Hook会自动处理数据获取，无需手动调用fetchFeeds
        ref.current = key
    }, [query.get("type"), query.get("sort"), listState, sortType]) // 移除fetchFeeds依赖

    // 单独处理页面变化，不重新获取数据
    React.useEffect(() => {
        // 页面变化时，只需要滚动到顶部
        if (page > 1) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [page])
    
    return (
        <ErrorBoundary
            fallback={
                <div className="flex flex-col items-center justify-center p-8 text-center">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
                        <h2 className="text-lg font-semibold text-red-800 mb-2">
                            文章列表加载出错
                        </h2>
                        <p className="text-red-600 mb-4">
                            页面遇到了一个问题，请刷新页面重试。
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
                        >
                            刷新页面
                        </button>
                    </div>
                </div>
            }
        >
            <Helmet>
                <title>{`${t('article.title')} - ${process.env.NAME}`}</title>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={t('article.title')} />
                <meta property="og:image" content={process.env.AVATAR} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={document.URL} />
            </Helmet>

            {/* 页面标题和工具栏区域 - 移到Waiting外面避免布局跳动 */}
            <div className={`${sidebarConfig.enabled ? 'max-w-7xl' : 'max-w-6xl'} mx-auto w-full px-4 sm:px-6 md:px-8 mb-0 transition-all duration-300`}>
                    <div className="flex flex-col space-y-4 mb-0">
                        {/* 标题行 */}
                        <div className="flex flex-row items-center gap-2 sm:gap-3 py-2">
                            <h1 className="text-2xl font-bold text-gray-800 dark:text-white relative group flex-shrink-0">
                                {listState === 'draft' ? t('draft_bin') : listState === 'normal' ? t('article.title') : t('unlisted')}
                                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-theme group-hover:w-full transition-all duration-300"></span>
                            </h1>
                            <div className={`py-1.5 px-2.5 sm:px-3 ${tagGlassClass} rounded-lg text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 flex items-center font-medium border border-neutral-200/60 dark:border-neutral-700/60 flex-shrink-0`}>
                                <i className="ri-article-line text-theme text-xs sm:text-sm"></i>
                                <span className="ml-1 sm:ml-1.5">
                                    {t('article.total$count', { count: feedsData?.size || 0 })}
                                    {listState === 'draft' && '(仅自己可见)'}
                                    {listState === 'unlisted' && '(有链接才能访问)'}
                                </span>
                            </div>
                        </div>

                        {/* 文章管理标签页 - 独立一行 */}
                        <div className="w-full">
                            <ArticleManagementTabs
                                listState={listState as ListState}
                                viewMode={viewMode}
                                sortType={sortType}
                                onListStateChange={handleListStateChange}
                                onViewModeChange={setViewMode}
                                onSortTypeChange={handleSortChange}
                                hasPermission={!!profile?.permission}
                                showButtonText={showButtonText}
                            />
                        </div>

                        {/* 上方渐变分割线 - 增加粗细 */}
                        <div className="w-full mb-2">
                            <hr className="h-0.5 border-0 bg-gradient-to-r from-transparent via-theme/40 dark:via-theme/30 to-transparent" />
                        </div>

                        <div className="flex justify-between items-center mt-0">
                            <div className="flex space-x-2">
                                {/* 预留位置，可添加其他控件 */}
                            </div>
                        </div>
                    </div>
                </div>

            {/* 等待数据和配置加载完成，避免视图模式跳动 */}
            <Waiting for={!loading && !initialLoading && configLoaded}>
                {/* 主内容布局 - 文章列表与侧边栏 */}
                <ArticleListLayout>
                    {/* 文章列表内容 */}
                    {paginatedFeeds.length > 0 && feedsData ? (
                        <>
                            <div className={viewMode === 'list'
                                ? "flex flex-col gap-3 sm:gap-4 w-full view-transition-container"
                                : `grid ${gridCols} gap-4 sm:gap-5 md:gap-6 w-full view-transition-container`
                            }>
                                {paginatedFeeds.map((feed) => (
                                    <LazyFeedCard key={feed.id} viewMode={viewMode} {...feed} />
                                ))}
                            </div>
                        </>
                    ) : (loading || initialLoading || !configLoaded || !feedsData) ? (
                        // 加载状态显示骨架屏
                        <div className={viewMode === 'list'
                            ? "flex flex-col gap-3 sm:gap-4 w-full"
                            : `grid ${gridCols} gap-4 sm:gap-5 w-full`
                        }>
                            {Array(6).fill(0).map((_, i) => (
                                <div
                                    key={`skeleton-${i}`}
                                    className={`block w-full rounded-2xl ${glassClass} h-full overflow-hidden border border-neutral-300/60 dark:border-neutral-600/60 shadow-enhanced ${viewMode === 'list' ? 'flex flex-row h-[160px] sm:h-[180px] md:h-[200px]' : 'flex flex-col h-[380px] sm:h-[400px] md:h-[420px]'}`}
                                    aria-hidden="true"
                                    aria-label="文章列表加载中"
                                >
                                    {/* 骨架屏图片区域 - 使用彩色背景 */}
                                    <div
                                        className={viewMode === 'list'
                                            ? `w-[140px] sm:w-[160px] md:w-[200px] h-full overflow-hidden rounded-l-xl relative animate-pulse flex-shrink-0`
                                            : `w-full h-44 xs:h-48 sm:h-52 md:h-56 overflow-hidden rounded-t-xl relative animate-pulse`
                                        }
                                        style={{
                                            background: `linear-gradient(${135 + (i * 30) % 360}deg, #667eea 0%, #764ba2 100%)`
                                        }}>
                                    </div>

                                    {/* 骨架屏内容区域 */}
                                    <div className={viewMode === 'list'
                                        ? "p-3 sm:p-4 flex-1 flex flex-col justify-between min-h-0 overflow-hidden"
                                        : "p-3 sm:p-4 flex-1 flex flex-col justify-between min-h-0 overflow-hidden"
                                    }>
                                        {/* 标题占位 - 匹配智能截断逻辑 */}
                                        <div className={viewMode === 'list'
                                            ? "h-4 sm:h-5 bg-gray-200 dark:bg-gray-700 rounded-md w-3/4 mb-1 animate-pulse"
                                            : "h-6 sm:h-7 bg-gray-200 dark:bg-gray-700 rounded-md w-3/4 mb-1 sm:mb-1.5 animate-pulse"
                                        }></div>
                                        {/* 第二行标题占位 - 列表视图在桌面端显示，网格视图始终显示 */}
                                        <div className={viewMode === 'list'
                                            ? "h-3 sm:h-4 bg-gray-200 dark:bg-gray-700 rounded-md w-1/2 mb-2 animate-pulse hidden sm:block"
                                            : "h-4 sm:h-5 bg-gray-200 dark:bg-gray-700 rounded-md w-1/2 mb-2 sm:mb-3 animate-pulse"
                                        }></div>
                                        {/* 第三行标题占位 - 仅网格视图桌面端显示 */}
                                        {viewMode === 'grid' && (
                                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-md w-1/3 mb-2 animate-pulse hidden sm:block"></div>
                                        )}
                                        
                                        {/* 日期和状态占位 */}
                                        <div className="flex justify-between mb-2">
                                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-md w-1/4 animate-pulse"></div>
                                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-md w-1/5 animate-pulse"></div>
                                        </div>
                                        
                                        {/* 摘要占位 */}
                                        <div className={viewMode === 'list' ? "space-y-1.5 mb-2" : "space-y-1.5 mb-3"}>
                                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse"></div>
                                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse"></div>
                                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/5 animate-pulse"></div>
                                        </div>

                                        {/* 标签占位 */}
                                        <div className={viewMode === 'list'
                                            ? "mt-auto pt-1 border-t border-gray-100 dark:border-gray-700/30 flex-shrink-0"
                                            : "mt-auto pt-2 border-t border-gray-100 dark:border-gray-700/30"
                                        }>
                                            <div className="flex gap-2">
                                                <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
                                                <div className="h-6 w-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        // 空状态 - 添加创建文章按钮，使用毛玻璃效果
                        <div className={`w-full py-14 sm:py-20 flex flex-col items-center justify-center text-center space-y-5 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl ${glassClass} shadow-enhanced`}>
                            <div className="text-6xl text-gray-300 dark:text-gray-600">
                                <i className="ri-inbox-2-line"></i>
                            </div>
                            <div className="max-w-md px-4">
                                <h3 className="text-2xl font-bold text-gray-600 dark:text-gray-300 mb-2">{t('empty_list')}</h3>
                                <p className="text-base text-gray-500 dark:text-gray-400">
                                    {listState === 'draft'
                                        ? t('empty_draft_description')
                                        : listState === 'unlisted'
                                            ? t('empty_unlisted_description')
                                            : t('empty_article_description')
                                    }
                                </p>
                            </div>
                            {profile?.permission && (
                                <Link href="/writing/new" className="mt-4 px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ease-out flex items-center justify-center shadow-enhanced bg-theme text-white hover:bg-theme-hover active:bg-theme-active hover:-translate-y-0.5 active:translate-y-0 hover:shadow-enhanced-lg">
                                    <i className="ri-add-line"></i>
                                    <span className="ml-2">{t('create_now')}</span>
                                </Link>
                            )}
                        </div>
                    )}
                </ArticleListLayout>
            </Waiting>

            {/* 分页控制 - 移到ArticleListLayout外部，与侧边栏分离 */}
            {paginatedFeeds.length > 0 && totalPages > 1 && (
                <div className={`${sidebarConfig.enabled ? 'max-w-7xl' : 'max-w-6xl'} mx-auto w-full px-4 sm:px-6 md:px-8 transition-all duration-300`}>
                    <div className="flex justify-center w-full">
                        <Pagination
                            currentPage={page}
                            totalPages={totalPages}
                            basePath={`/?type=${listState}${sortType !== 'latest' ? `&sort=${sortType}` : ''}`}
                            className="gap-2"
                        />
                    </div>
                </div>
            )}
        </ErrorBoundary>
    )
}
