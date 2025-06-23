import React from 'react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useGlassEffect, GLASS_LAYERS } from '../hooks/useGlassEffect';
import type { ViewMode } from './view_toggle';

export type ListState = 'normal' | 'draft' | 'unlisted';
export type SortType = 'latest' | 'popular' | 'oldest';

interface ArticleManagementTabsProps {
  // 状态
  listState: ListState;
  viewMode: ViewMode;
  sortType: SortType;

  // 事件处理
  onListStateChange: (state: ListState) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onSortTypeChange: (sort: SortType) => void;

  // 权限控制
  hasPermission?: boolean;

  // 样式控制
  className?: string;
  showButtonText?: boolean;
}

/**
 * 文章管理标签页组件
 * 
 * 整合文章列表页面的所有管理功能到统一的标签页界面：
 * - 新建文章
 * - 草稿箱
 * - 未列出
 * - 视图切换（网格/列表）
 * - 排序控制（最新/热度/倒序）
 * 
 * 采用设置页面相同的标签页样式，确保设计一致性
 */
export function ArticleManagementTabs({
  listState,
  viewMode,
  sortType,
  onListStateChange,
  onViewModeChange,
  onSortTypeChange,
  hasPermission = false,
  className = '',
  showButtonText = true
}: ArticleManagementTabsProps) {
  const { t } = useTranslation();
  const glassClass = useGlassEffect(GLASS_LAYERS.CARD);

  // 标签页配置 - 只显示有权限的按钮
  const tabs = React.useMemo(() => {
    const allTabs = [
      // 新建文章 - 只有权限用户可见
      {
        id: 'new',
        title: t('new_article', { defaultValue: '新建文章' }),
        shortTitle: t('new', { defaultValue: '新建' }),
        icon: 'ri-add-line',
        type: 'link' as const,
        href: '/writing/new',
        active: false,
        requiresPermission: true
      },

      // 文章状态切换 - 只有管理员可见
      {
        id: 'normal',
        title: t('all_articles', { defaultValue: '全部文章' }),
        shortTitle: t('all', { defaultValue: '全部' }),
        icon: 'ri-article-line',
        type: 'state' as const,
        active: listState === 'normal',
        onClick: () => onListStateChange('normal'),
        requiresPermission: true
      },
      {
        id: 'draft',
        title: t('draft_bin', { defaultValue: '草稿箱' }),
        shortTitle: t('draft', { defaultValue: '草稿' }),
        icon: 'ri-draft-line',
        type: 'state' as const,
        active: listState === 'draft',
        onClick: () => onListStateChange('draft'),
        requiresPermission: true
      },
      {
        id: 'unlisted',
        title: t('unlisted', { defaultValue: '未列出' }),
        shortTitle: t('unlisted_short', { defaultValue: '未列出' }),
        icon: 'ri-eye-off-line',
        type: 'state' as const,
        active: listState === 'unlisted',
        onClick: () => onListStateChange('unlisted'),
        requiresPermission: true
      },

      // 视图切换
      {
        id: 'view-grid',
        title: t('view.grid', { defaultValue: '网格视图' }),
        shortTitle: t('view.grid', { defaultValue: '网格' }),
        icon: 'ri-grid-line',
        type: 'view' as const,
        active: viewMode === 'grid',
        onClick: () => onViewModeChange('grid')
      },
      {
        id: 'view-list',
        title: t('view.list', { defaultValue: '列表视图' }),
        shortTitle: t('view.list', { defaultValue: '列表' }),
        icon: 'ri-list-unordered',
        type: 'view' as const,
        active: viewMode === 'list',
        onClick: () => onViewModeChange('list')
      },

      // 排序控制
      {
        id: 'sort-latest',
        title: t('sort.latest', { defaultValue: '最新' }),
        shortTitle: t('sort.latest', { defaultValue: '最新' }),
        icon: 'ri-time-line',
        type: 'sort' as const,
        active: sortType === 'latest',
        onClick: () => onSortTypeChange('latest')
      },
      {
        id: 'sort-popular',
        title: t('sort.popular', { defaultValue: '热度' }),
        shortTitle: t('sort.popular', { defaultValue: '热度' }),
        icon: 'ri-fire-line',
        type: 'sort' as const,
        active: sortType === 'popular',
        onClick: () => onSortTypeChange('popular')
      },
      {
        id: 'sort-oldest',
        title: t('sort.oldest', { defaultValue: '倒序' }),
        shortTitle: t('sort.oldest', { defaultValue: '倒序' }),
        icon: 'ri-history-line',
        type: 'sort' as const,
        active: sortType === 'oldest',
        onClick: () => onSortTypeChange('oldest')
      }
    ];

    // 根据权限过滤标签页
    return allTabs.filter(tab => !tab.requiresPermission || hasPermission);
  }, [listState, viewMode, sortType, onListStateChange, onViewModeChange, onSortTypeChange, hasPermission, t]);

  return (
    <div className={`w-full ${className}`}>
      {/* 标签页容器 - 移动端紧凑布局 */}
      <div className={`
        ${glassClass}
        border border-neutral-200/60 dark:border-neutral-700/60
        rounded-xl p-2 sm:p-3
        grid gap-1.5 sm:gap-2
        shadow-enhanced
        ${tabs.length <= 6
          ? 'grid-cols-5 sm:grid-cols-6'
          : tabs.length <= 9
            ? 'grid-cols-5 sm:grid-cols-6 md:grid-cols-9'
            : 'grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-9'
        }
      `}>
        {tabs.map((tab) => {
          // 根据类型渲染不同的元素
          if (tab.type === 'link') {
            return (
              <Link
                key={tab.id}
                href={tab.href!}
                className={`
                  flex items-center justify-center gap-1 px-1.5 py-2 sm:px-2 sm:py-2.5 rounded-lg text-sm font-medium
                  transition-all duration-200 ease-out
                  hover:scale-[0.98] active:scale-[0.96]
                  bg-transparent text-neutral-600 dark:text-neutral-300
                  border border-neutral-300/70 dark:border-neutral-600/70
                  hover:bg-neutral-50/80 dark:hover:bg-neutral-750/80
                  hover:text-theme dark:hover:text-theme
                  hover:border-theme/50 dark:hover:border-theme/50
                  shadow-sm hover:shadow-md
                  min-h-[36px] sm:min-h-[44px] w-full
                `}
              >
                <i className={`${tab.icon} text-sm flex-shrink-0`}></i>
                {showButtonText && (
                  <span className="hidden sm:inline text-xs lg:text-sm truncate">
                    {tab.shortTitle}
                  </span>
                )}
              </Link>
            );
          }

          // 状态、视图、排序按钮
          return (
            <button
              key={tab.id}
              onClick={tab.onClick}
              className={`
                flex items-center justify-center gap-1 px-1.5 py-2 sm:px-2 sm:py-2.5 rounded-lg text-sm font-medium
                transition-all duration-200 ease-out
                hover:scale-[0.98] active:scale-[0.96]
                min-h-[36px] sm:min-h-[44px] w-full
                ${tab.active
                  ? 'bg-transparent text-theme shadow-md border-2 border-theme/60 dark:border-theme/50'
                  : 'bg-transparent text-neutral-600 dark:text-neutral-300 border border-neutral-300/70 dark:border-neutral-600/70 hover:bg-neutral-50/80 dark:hover:bg-neutral-750/80 hover:text-theme dark:hover:text-theme hover:border-theme/50 dark:hover:border-theme/50 shadow-sm hover:shadow-md'
                }
              `}
              title={tab.title}
            >
              <i className={`${tab.icon} text-sm flex-shrink-0`}></i>
              {showButtonText && (
                <span className="hidden sm:inline text-xs lg:text-sm truncate">
                  {tab.shortTitle}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 响应式文字显示Hook
 * 根据屏幕尺寸决定显示完整文字还是简短文字
 */
export function useResponsiveText() {
  const [showFullText, setShowFullText] = React.useState(true);

  React.useEffect(() => {
    const checkScreenSize = () => {
      setShowFullText(window.innerWidth >= 1024); // lg断点
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  return showFullText;
}
