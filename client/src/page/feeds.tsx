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
import { useFeedsCache, FeedType as CacheFeedType } from "../hooks/useFeedsCache"
import { useSafeCacheInvalidation } from "../hooks/useComponentSafety"

// FeedsData类型由useFeedsCache Hook提供

type FeedType = 'draft' | 'unlisted' | 'normal'

// FeedsMap类型不再需要，因为使用缓存Hook



// 懒加载Feed卡片组件
function LazyFeedCardComponent({ id, viewMode, ...props }: any) {
    const [isVisible, setIsVisible] = React.useState(false);
    const [isIntersecting, setIsIntersecting] = React.useState(false); // 新增状态跟踪元素是否在视口内
    const cardRef = React.useRef<HTMLDivElement>(null);


    // 使用智能毛玻璃效果
    const glassClass = useGlassEffect(GLASS_LAYERS.CARD);
    
    // 为占位符生成渐变背景 - 使用useMemo缓存计算结果
    const placeholderGradient = useMemo(() => {
        // 使用ID保持一致的随机颜色
        const getHashCode = (str: string) => {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = ((hash << 5) - hash) + str.charCodeAt(i);
                hash = hash & hash; // 转换为32位整数
            }
            return Math.abs(hash);
        };

        const gradients = [
            'from-blue-100 to-purple-200 dark:from-blue-900/40 dark:to-purple-900/40',
            'from-green-100 to-blue-200 dark:from-green-900/40 dark:to-blue-900/40',
            'from-purple-100 to-pink-200 dark:from-purple-900/40 dark:to-pink-900/40',
            'from-yellow-100 to-red-200 dark:from-yellow-900/40 dark:to-red-900/40',
            'from-pink-100 to-rose-200 dark:from-pink-900/40 dark:to-rose-900/40',
            'from-indigo-100 to-blue-200 dark:from-indigo-900/40 dark:to-blue-900/40'
        ];

        const hash = getHashCode(id);
        return gradients[hash % gradients.length];
    }, [id]);

    React.useEffect(() => {
        let timer: NodeJS.Timeout | null = null;

        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsIntersecting(entry.isIntersecting); // 更新元素是否在视口内的状态
                if (entry.isIntersecting) {
                    // 当元素进入视口时，设置一个短暂延迟后显示实际内容，以便平滑过渡
                    timer = setTimeout(() => {
                        setIsVisible(true);
                        observer.disconnect();
                    }, 150); // 添加一个短暂延迟以实现错落有致的加载效果
                }
            },
            { threshold: 0.1, rootMargin: '200px 0px' }
        );

        if (cardRef.current) {
            observer.observe(cardRef.current);
        }

        return () => {
            // 清理定时器和观察器
            if (timer) {
                clearTimeout(timer);
            }
            observer.disconnect();
        };
    }, []);

    return (
        <div ref={cardRef} className="w-full h-full">
            {isVisible ? (
                <FeedCard id={id} viewMode={viewMode} {...props} />
            ) : (
                <div className={`block w-full rounded-2xl ${glassClass} h-full overflow-hidden border border-neutral-200/60 dark:border-neutral-700/60 shadow-enhanced transition-opacity duration-300 ${isIntersecting ? 'opacity-100' : 'opacity-40'} ${viewMode === 'list' ? 'flex flex-row h-[160px] sm:h-[180px] md:h-[200px]' : 'flex flex-col h-[380px] sm:h-[400px] md:h-[420px]'}`}>
                    {/* 占位符图片区域 - 匹配FeedCard的图片高度 */}
                    <div className={viewMode === 'list'
                        ? `w-[140px] sm:w-[160px] md:w-[200px] h-full overflow-hidden rounded-l-xl relative bg-gradient-to-r ${placeholderGradient} animate-pulse flex-shrink-0`
                        : `w-full h-44 xs:h-48 sm:h-52 md:h-56 overflow-hidden rounded-t-xl relative bg-gradient-to-r ${placeholderGradient} animate-pulse`  // 匹配FeedCard的图片高度
                    }>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-10 h-10 rounded-full bg-white/20 dark:bg-gray-700/30 flex items-center justify-center">
                                <i className="ri-image-line text-white/50 dark:text-gray-500/70 text-xl"></i>
                            </div>
                        </div>
                    </div>
                    
                    {/* 占位符内容区域 */}
                    <div className={viewMode === 'list'
                        ? "p-3 sm:p-4 flex-1 flex flex-col justify-between min-h-0 overflow-hidden"
                        : "p-4 sm:p-5 flex-1 flex flex-col"
                    }>
                        {/* 标题占位 - 匹配智能截断逻辑 */}
                        <div className={viewMode === 'list'
                            ? "h-4 sm:h-5 bg-neutral-200 dark:bg-neutral-700 rounded-xl w-3/4 mb-1 animate-pulse"
                            : "h-6 sm:h-7 bg-neutral-200 dark:bg-neutral-700 rounded-xl w-3/4 mb-2 animate-pulse"
                        }></div>
                        {/* 第二行标题占位 - 列表视图在桌面端显示，网格视图始终显示 */}
                        <div className={viewMode === 'list'
                            ? "h-3 sm:h-4 bg-neutral-200 dark:bg-neutral-700 rounded-xl w-1/2 mb-2 animate-pulse hidden sm:block"
                            : "h-4 sm:h-5 bg-neutral-200 dark:bg-neutral-700 rounded-xl w-1/2 mb-4 animate-pulse"
                        }></div>
                        {/* 第三行标题占位 - 仅网格视图桌面端显示 */}
                        {viewMode === 'grid' && (
                            <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded-xl w-1/3 mb-2 animate-pulse hidden sm:block"></div>
                        )}
                        
                        {/* 日期和状态占位 */}
                        <div className="flex justify-between mb-3">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-md w-1/4 animate-pulse"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-md w-1/5 animate-pulse"></div>
                        </div>
                        
                        {/* 摘要占位 */}
                        <div className={viewMode === 'list' ? "space-y-1.5 mb-2" : "space-y-2 mb-4"}>
                            <div className="h-3 bg-gray-200 dark:bg-gray-700/70 rounded w-full animate-pulse"></div>
                            <div className="h-3 bg-gray-200 dark:bg-gray-700/70 rounded w-full animate-pulse"></div>
                            <div className="h-3 bg-gray-200 dark:bg-gray-700/70 rounded w-4/5 animate-pulse"></div>
                        </div>
                        
                        {/* 标签占位 */}
                        <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-700/30">
                            <div className="flex gap-2">
                                <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700/70 rounded-full animate-pulse"></div>
                                <div className="h-6 w-10 bg-gray-200 dark:bg-gray-700/70 rounded-full animate-pulse"></div>
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

    // 使用缓存Hook替代直接API调用和本地状态管理
    const {
        data: feedsData,
        loading,
        invalidate: invalidateFeedsCache
    } = useFeedsCache({
        type: listState as CacheFeedType,
        enabled: true
    })
    const page = tryInt(1, query.get("page"))
    const limit = tryInt(10, query.get("limit"), process.env.PAGE_SIZE)
    const ref = React.useRef("")

    // 使用安全的缓存失效机制
    const safeInvalidateFeedsCache = useSafeCacheInvalidation(invalidateFeedsCache);

    // 监听文章发布/更新事件，失效缓存
    React.useEffect(() => {
        const handleFeedPublished = () => {
            safeInvalidateFeedsCache();
        };

        const handleFeedUpdated = () => {
            safeInvalidateFeedsCache();
        };

        window.addEventListener('feed-published', handleFeedPublished);
        window.addEventListener('feed-updated', handleFeedUpdated);

        return () => {
            window.removeEventListener('feed-published', handleFeedPublished);
            window.removeEventListener('feed-updated', handleFeedUpdated);
        };
    }, [safeInvalidateFeedsCache]); // 使用安全的缓存失效函数

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

    // 智能热度排序算法 - 深度修复版本
    const sortedFeeds = React.useMemo(() => {
        if (!feedsData?.data) return [];
        const currentFeeds = [...feedsData.data];



        try {
            const sorted = currentFeeds.sort((a, b) => {
                // 第一优先级：置顶文章始终在前（这是最重要的）
                const aTop = a.top || 0;
                const bTop = b.top || 0;
                if (aTop !== bTop) {
                    return bTop - aTop; // 置顶值大的在前
                }

                // 为置顶文章也计算热度分数（用于调试显示）
                if (aTop > 0 || bTop > 0) {
                    const aPv = a.pv || 0;
                    const bPv = b.pv || 0;
                    const aUv = a.uv || 0;
                    const bUv = b.uv || 0;

                    if (aPv > 0 || bPv > 0 || aUv > 0 || bUv > 0) {
                        const aViews = aPv + aUv * 0.5;
                        const bViews = bPv + bUv * 0.5;
                        (a as any)._hotScore = aViews.toFixed(1);
                        (b as any)._hotScore = bViews.toFixed(1);

                        // 置顶文章内部按热度排序
                        if (aTop === bTop && Math.abs(aViews - bViews) > 0.1) {
                            return bViews - aViews;
                        }
                    }
                }

                // 第二优先级：根据排序类型进行排序
                switch (sortType) {
                    case 'latest':
                        // 最新排序：创建时间降序
                        const aTime = new Date(a.createdAt).getTime();
                        const bTime = new Date(b.createdAt).getTime();
                        if (aTime !== bTime) {
                            return bTime - aTime;
                        }
                        // 时间相同时按ID降序
                        return b.id - a.id;

                    case 'popular':
                        // 智能热度排序算法 - 优先使用真实浏览量数据
                        // 1. 检查是否有真实的浏览量数据
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

                        // 2. 智能热度算法：综合多个指标
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
            });


            return sorted;

        } catch (error) {
            return currentFeeds; // 发生错误时返回原始数据
        }
    }, [feedsData, listState, sortType]);

    // 缓存Hook自动处理数据获取，无需手动fetchFeeds函数

    // 前端分页逻辑 - 对排序后的数据进行分页
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
        <>
            <Helmet>
                <title>{`${t('article.title')} - ${process.env.NAME}`}</title>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={t('article.title')} />
                <meta property="og:image" content={process.env.AVATAR} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={document.URL} />
            </Helmet>

            {/* 等待数据和配置加载完成，避免视图模式跳动 */}
            <Waiting for={!loading && !initialLoading && configLoaded}>
                {/* 页面标题和工具栏区域 */}
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

                {/* 主内容布局 - 文章列表与侧边栏 */}
                <ArticleListLayout>
                    {/* 文章列表内容 */}
                    {paginatedFeeds.length > 0 ? (
                        <>
                            <div className={viewMode === 'list'
                                ? "flex flex-col gap-3 sm:gap-4 w-full view-transition-container"
                                : `grid ${gridCols} gap-4 sm:gap-5 md:gap-6 w-full view-transition-container`
                            }>
                                {paginatedFeeds.map((feed, i) => (
                                    <LazyFeedCard key={`feed-card-${feed.id}-${i}-${sortType}-${viewMode}`} viewMode={viewMode} {...feed} />
                                ))}
                            </div>
                        </>
                    ) : loading ? (
                        // 加载状态显示骨架屏
                        <div className={viewMode === 'list'
                            ? "flex flex-col gap-3 sm:gap-4 w-full"
                            : `grid ${gridCols} gap-4 sm:gap-5 w-full`
                        }>
                            {Array(6).fill(0).map((_, i) => (
                                <div key={`skeleton-${i}`} className={`block w-full rounded-2xl ${glassClass} h-full overflow-hidden border border-neutral-200/60 dark:border-neutral-700/60 shadow-enhanced ${viewMode === 'list' ? 'flex flex-row h-[160px] sm:h-[180px] md:h-[200px]' : 'flex flex-col h-[380px] sm:h-[400px] md:h-[420px]'}`}>
                                    {/* 骨架屏图片区域 - 匹配FeedCard的图片高度 */}
                                    <div className={viewMode === 'list'
                                        ? "w-[140px] sm:w-[160px] md:w-[200px] h-full overflow-hidden rounded-l-xl relative bg-gray-200 dark:bg-gray-700 animate-pulse flex-shrink-0"
                                        : "w-full h-44 xs:h-48 sm:h-52 md:h-56 overflow-hidden rounded-t-xl relative bg-gray-200 dark:bg-gray-700 animate-pulse"  // 匹配FeedCard的图片高度
                                    }>
                                    </div>

                                    {/* 骨架屏内容区域 */}
                                    <div className={viewMode === 'list'
                                        ? "p-3 sm:p-4 flex-1 flex flex-col justify-between min-h-0 overflow-hidden"
                                        : "p-3 sm:p-4 flex-1 flex flex-col"
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
                                            <div className="h-3 bg-gray-200 dark:bg-gray-700/70 rounded w-full animate-pulse"></div>
                                            <div className="h-3 bg-gray-200 dark:bg-gray-700/70 rounded w-full animate-pulse"></div>
                                            <div className="h-3 bg-gray-200 dark:bg-gray-700/70 rounded w-4/5 animate-pulse"></div>
                                        </div>

                                        {/* 标签占位 */}
                                        <div className={viewMode === 'list'
                                            ? "mt-auto pt-1 border-t border-gray-100 dark:border-gray-700/30 flex-shrink-0"
                                            : "mt-auto pt-2 border-t border-gray-100 dark:border-gray-700/30"
                                        }>
                                            <div className="flex gap-2">
                                                <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700/70 rounded-full animate-pulse"></div>
                                                <div className="h-6 w-10 bg-gray-200 dark:bg-gray-700/70 rounded-full animate-pulse"></div>
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
        </>
    )
}
