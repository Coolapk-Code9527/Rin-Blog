import { useState, useMemo } from "react";
import { Link } from "wouter";
import { UnifiedContainer } from "./UnifiedContainer";

// 定义组件Props接口 - 避免与HTML元素的onToggle冲突
interface UnifiedTimelineItemProps {
  item: any;
  onToggleItem: (id: string) => void;
  t: any;
  key?: any; // 添加key属性以解决TypeScript错误
}

// UnifiedTimelineItem: 统一的时间轴项目组件（年、月、文章都在同一条线上）
export function UnifiedTimelineItem({ item, onToggleItem, t }: UnifiedTimelineItemProps) {
  const { type, data, isCollapsed } = item;

  // 根据类型设置不同的圆点样式
  const getCircleStyle = () => {
    switch (type) {
      case 'year':
        return 'after:w-4 after:h-4 after:bg-blue-500'; // 年份：大蓝色圆点
      case 'month':
        return 'after:w-3 after:h-3 after:bg-green-500'; // 月份：中绿色圆点
      default:
        return 'after:w-2 after:h-2 after:bg-orange-500'; // 文章：小橙色圆点
    }
  };

  // 根据类型渲染不同的内容
  const renderContent = () => {
    switch (type) {
      case 'year':
        return (
          <button
            onClick={() => onToggleItem?.(data.id)}
            className="flex items-center gap-3 hover:text-theme transition-colors duration-200"
          >
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {data.year}年
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full font-medium">
              {data.count}篇
            </span>
            <i className={`ri-arrow-down-s-line text-gray-400 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}></i>
          </button>
        );

      case 'month':
        return (
          <button
            onClick={() => onToggleItem?.(data.id)}
            className="flex items-center gap-2 hover:text-theme transition-colors duration-200"
          >
            <div className="text-lg font-semibold text-gray-700 dark:text-gray-300">
              {data.month}
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full font-medium">
              {data.count}篇
            </span>
            <i className={`ri-arrow-down-s-line text-gray-400 transition-transform duration-200 text-sm ${isCollapsed ? '-rotate-90' : ''}`}></i>
          </button>
        );

      default: // article
        const date = new Date(data.createdAt);
        const formattedDate = `${date.getDate()}日`;

        return (
          <div className="w-full">
            {/* 日期标签 */}
            <time className="sm:absolute left-0 translate-y-0.5 inline-flex items-center justify-center text-xs font-semibold w-16 h-5 mb-2 sm:mb-0 text-theme bg-theme/10 rounded-full flex-shrink-0">
              {formattedDate}
            </time>

            {/* 移动端：垂直布局 */}
            <div className="sm:hidden">
              {/* 文章标题 - 移动端独占一行 */}
              <Link
                href={`/feed/${data.id}`}
                className="block text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-theme transition-colors duration-200 line-clamp-2 mb-2 break-words"
                style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
              >
                {data.title || t('unlisted')}
              </Link>

              {/* 统计信息 - 移动端在标题下方 */}
              {(data.pv !== undefined || data.uv !== undefined) && (
                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <i className="ri-eye-line text-green-500"></i>
                  <span>{data.pv || 0}</span>
                  <span className="mx-1 text-gray-300 dark:text-gray-600">|</span>
                  <i className="ri-user-3-line text-pink-400"></i>
                  <span>{data.uv || 0}</span>
                </div>
              )}
            </div>

            {/* 桌面端：水平布局 */}
            <div className="hidden sm:flex sm:items-center sm:justify-between">
              {/* 文章标题 - 桌面端与统计信息同行 */}
              <Link
                href={`/feed/${data.id}`}
                className="text-base font-medium text-gray-900 dark:text-gray-100 hover:text-theme transition-colors duration-200 line-clamp-1 break-words flex-1 min-w-0 mr-3"
                style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
              >
                {data.title || t('unlisted')}
              </Link>

              {/* 统计信息 - 桌面端在标题右侧 */}
              {(data.pv !== undefined || data.uv !== undefined) && (
                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                  <i className="ri-eye-line text-green-500"></i>
                  <span>{data.pv || 0}</span>
                  <span className="mx-1 text-gray-300 dark:text-gray-600">|</span>
                  <i className="ri-user-3-line text-pink-400"></i>
                  <span>{data.uv || 0}</span>
                </div>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="relative pl-8 sm:pl-32 py-3 group">
      {/* 统一的Cruip时间轴结构 - 所有项目都在同一条线上 */}
      <div className={`flex flex-col sm:flex-row items-start mb-1 group-last:before:hidden before:absolute before:left-2 sm:before:left-0 before:h-full before:px-px before:bg-theme/30 sm:before:ml-[6.5rem] before:self-start before:-translate-x-1/2 before:translate-y-3 after:absolute after:left-2 sm:after:left-0 ${getCircleStyle()} after:border-4 after:box-content after:border-white dark:after:border-gray-900 after:rounded-full sm:after:ml-[6.5rem] after:-translate-x-1/2 after:translate-y-1.5`}>
        <div className="w-full px-2 sm:px-3">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}





// UnifiedTimeline: 统一的时间轴组件（所有项目在同一条线上）
export function UnifiedTimeline({ feeds, t }: { feeds: any[], t: any }) {
  // 折叠状态管理
  const [collapsedItems, setCollapsedItems] = useState<Set<string>>(new Set());

  // 创建扁平化的时间轴数据结构
  const timelineItems = useMemo(() => {
    const items: any[] = [];

    // 按年份分组
    const yearGroups: { [key: string]: any[] } = {};
    feeds.forEach(feed => {
      const year = new Date(feed.createdAt).getFullYear().toString();
      if (!yearGroups[year]) {
        yearGroups[year] = [];
      }
      yearGroups[year].push(feed);
    });

    // 按年份排序（最新的在前）
    const sortedYears = Object.entries(yearGroups)
      .sort(([a], [b]) => parseInt(b) - parseInt(a));

    sortedYears.forEach(([year, yearFeeds]) => {
      const yearId = `year-${year}`;

      // 添加年份项目
      items.push({
        type: 'year',
        id: yearId,
        data: {
          year,
          count: yearFeeds.length,
          id: yearId
        },
        isCollapsed: collapsedItems.has(yearId)
      });

      // 如果年份未折叠，添加月份和文章
      if (!collapsedItems.has(yearId)) {
        // 按月份分组
        const monthGroups: { [key: string]: any[] } = {};
        yearFeeds.forEach(feed => {
          const date = new Date(feed.createdAt);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          if (!monthGroups[monthKey]) {
            monthGroups[monthKey] = [];
          }
          monthGroups[monthKey].push(feed);
        });

        // 按月份排序（最新的在前）
        const sortedMonths = Object.entries(monthGroups)
          .sort(([a], [b]) => b.localeCompare(a));

        sortedMonths.forEach(([monthKey, monthFeeds]) => {
          const monthId = `month-${monthKey}`;
          const monthName = `${new Date(monthFeeds[0].createdAt).getMonth() + 1}月`;

          // 添加月份项目
          items.push({
            type: 'month',
            id: monthId,
            data: {
              month: monthName,
              count: monthFeeds.length,
              id: monthId
            },
            isCollapsed: collapsedItems.has(monthId)
          });

          // 如果月份未折叠，添加文章
          if (!collapsedItems.has(monthId)) {
            const sortedFeeds = monthFeeds.sort((a, b) => b.createdAt - a.createdAt);
            sortedFeeds.forEach(feed => {
              items.push({
                type: 'article',
                id: `article-${feed.id}`,
                data: feed,
                isCollapsed: false
              });
            });
          }
        });
      }
    });

    return items;
  }, [feeds, collapsedItems]);

  // 切换折叠状态
  const toggleCollapse = (id: string) => {
    const newCollapsed = new Set(collapsedItems);
    if (newCollapsed.has(id)) {
      newCollapsed.delete(id);
    } else {
      newCollapsed.add(id);
    }
    setCollapsedItems(newCollapsed);
  };

  if (!feeds || feeds.length === 0) {
    return (
      <div className="w-full max-w-6xl mx-auto">
        <UnifiedContainer
          heightType="responsive"
          layoutType="default"
          className="flex flex-col items-center justify-center"
          enableScroll={false}
        >
          <i className="ri-time-line text-4xl text-gray-400 mb-4"></i>
          <p className="text-gray-500 dark:text-gray-400">{t('no_articles') || '暂无文章'}</p>
        </UnifiedContainer>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
      <UnifiedContainer
        heightType="responsive"
        layoutType="default"
        className="timeline-card"
        enableScroll={true}
      >
        {/* 统一的Cruip时间轴结构 - 所有项目在同一条连续线上 */}
        <div className="-my-6">
          {timelineItems.map((item) => (
            <UnifiedTimelineItem
              key={item.id}
              item={item}
              onToggleItem={toggleCollapse}
              t={t}
            />
          ))}
        </div>
      </UnifiedContainer>
    </div>
  );
}

// 保持原有的SimpleTimeline作为别名，确保兼容性
export const SimpleTimeline = UnifiedTimeline;
