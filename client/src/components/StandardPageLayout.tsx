import React from 'react';
import { UnifiedContainer, ContainerHeightType, ContainerLayoutType } from './UnifiedContainer';

/**
 * 标准页面布局配置
 */
export interface StandardPageLayoutConfig {
  // 标题区域配置
  title?: {
    height?: 'compact' | 'standard' | 'large'; // 紧凑(60px) | 标准(80px) | 大型(100px)
    showDivider?: boolean; // 是否显示分隔线
    background?: boolean; // 是否显示背景色
  };
  
  // 主内容区域配置
  content?: {
    padding?: 'none' | 'small' | 'standard' | 'large'; // 内边距大小
    scroll?: boolean; // 是否启用滚动
  };
  
  // 操作区域配置
  actions?: {
    height?: 'compact' | 'standard' | 'large'; // 紧凑(50px) | 标准(60px) | 大型(80px)
    position?: 'bottom' | 'top' | 'both'; // 位置
    background?: boolean; // 是否显示背景色
  };
}

/**
 * 标准页面布局属性
 */
export interface StandardPageLayoutProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  actions?: React.ReactNode;
  topActions?: React.ReactNode;
  className?: string;
  heightType?: ContainerHeightType;
  config?: StandardPageLayoutConfig;
  onScroll?: (e: UIEvent) => void;
}

/**
 * 获取标题区域高度类名
 */
function getTitleHeightClass(height: 'compact' | 'standard' | 'large' = 'standard'): string {
  switch (height) {
    case 'compact':
      return 'h-[60px] min-h-[60px]';
    case 'standard':
      return 'h-[80px] min-h-[80px]';
    case 'large':
      return 'h-[100px] min-h-[100px]';
    default:
      return 'h-[80px] min-h-[80px]';
  }
}

/**
 * 获取操作区域高度类名
 */
function getActionsHeightClass(height: 'compact' | 'standard' | 'large' = 'standard'): string {
  switch (height) {
    case 'compact':
      return 'h-[50px] min-h-[50px]';
    case 'standard':
      return 'h-[60px] min-h-[60px]';
    case 'large':
      return 'h-[80px] min-h-[80px]';
    default:
      return 'h-[60px] min-h-[60px]';
  }
}

/**
 * 获取内容区域内边距类名
 */
function getContentPaddingClass(padding: 'none' | 'small' | 'standard' | 'large' = 'standard'): string {
  switch (padding) {
    case 'none':
      return '';
    case 'small':
      return 'p-3';
    case 'standard':
      return 'p-6';
    case 'large':
      return 'p-8';
    default:
      return 'p-6';
  }
}

/**
 * 标准页面布局组件
 * 
 * 提供统一的页面布局结构，确保所有页面的标题区域、主内容区域、操作区域
 * 具有一致的高度比例关系和视觉效果
 * 
 * @example
 * ```tsx
 * <StandardPageLayout
 *   title={<h1>页面标题</h1>}
 *   actions={<button>操作按钮</button>}
 *   heightType="responsive"
 *   config={{
 *     title: { height: 'standard', showDivider: true },
 *     content: { padding: 'standard', scroll: true },
 *     actions: { height: 'standard', position: 'bottom' }
 *   }}
 * >
 *   <div>页面内容</div>
 * </StandardPageLayout>
 * ```
 */
export function StandardPageLayout({
  children,
  title,
  actions,
  topActions,
  className = '',
  heightType = 'responsive',
  config = {},
  onScroll
}: StandardPageLayoutProps) {
  // 默认配置
  const defaultConfig: Required<StandardPageLayoutConfig> = {
    title: {
      height: 'standard',
      showDivider: true,
      background: false
    },
    content: {
      padding: 'standard',
      scroll: true
    },
    actions: {
      height: 'standard',
      position: 'bottom',
      background: false
    }
  };

  // 合并配置
  const finalConfig = {
    title: { ...defaultConfig.title, ...config.title },
    content: { ...defaultConfig.content, ...config.content },
    actions: { ...defaultConfig.actions, ...config.actions }
  };

  // 构建布局类型
  let layoutType: ContainerLayoutType = 'default';
  if (title && actions) {
    layoutType = 'full-layout';
  } else if (title) {
    layoutType = 'with-header';
  } else if (actions) {
    layoutType = 'with-footer';
  }

  // 标题区域内容
  const titleContent = title && (
    <div className={`
      ${getTitleHeightClass(finalConfig.title.height)}
      ${finalConfig.title.background ? 'bg-gray-50/50 dark:bg-gray-800/50' : ''}
      flex items-center justify-between px-6
      ${finalConfig.title.showDivider ? 'border-b border-gray-200/60 dark:border-gray-700/60' : ''}
    `}>
      <div className="flex-1 min-w-0">
        {title}
      </div>
      {topActions && (
        <div className="flex-shrink-0 ml-4">
          {topActions}
        </div>
      )}
    </div>
  );

  // 操作区域内容
  const actionsContent = actions && (
    <div className={`
      ${getActionsHeightClass(finalConfig.actions.height)}
      ${finalConfig.actions.background ? 'bg-gray-50/50 dark:bg-gray-800/50' : ''}
      flex items-center justify-between px-6
      border-t border-gray-200/60 dark:border-gray-700/60
    `}>
      {actions}
    </div>
  );

  // 内容区域
  const contentArea = (
    <div className={`
      flex-1 min-h-0 overflow-hidden
      ${getContentPaddingClass(finalConfig.content.padding)}
    `}>
      {finalConfig.content.scroll ? (
        <div 
          className="h-full overflow-y-auto custom-scrollbar"
          onScroll={onScroll}
        >
          {children}
        </div>
      ) : (
        <div className="h-full">
          {children}
        </div>
      )}
    </div>
  );

  return (
    <UnifiedContainer
      heightType={heightType}
      layoutType="default"
      className={className}
      enableScroll={false}
    >
      <div className="h-full flex flex-col">
        {/* 顶部操作区域 */}
        {finalConfig.actions.position === 'top' && actionsContent}
        {finalConfig.actions.position === 'both' && topActions && (
          <div className={`
            ${getActionsHeightClass(finalConfig.actions.height)}
            ${finalConfig.actions.background ? 'bg-gray-50/50 dark:bg-gray-800/50' : ''}
            flex items-center justify-between px-6
            border-b border-gray-200/60 dark:border-gray-700/60
          `}>
            {topActions}
          </div>
        )}
        
        {/* 标题区域 */}
        {titleContent}
        
        {/* 主内容区域 */}
        {contentArea}
        
        {/* 底部操作区域 */}
        {(finalConfig.actions.position === 'bottom' || finalConfig.actions.position === 'both') && actionsContent}
      </div>
    </UnifiedContainer>
  );
}

/**
 * 页面标题组件
 * 
 * 提供标准化的页面标题样式
 */
export function PageTitle({ 
  children, 
  icon, 
  subtitle,
  className = '' 
}: { 
  children: React.ReactNode;
  icon?: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center ${className}`}>
      {icon && (
        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mr-3">
          <i className={`${icon} text-blue-600 dark:text-blue-400`}></i>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white truncate">
          {children}
        </h1>
        {subtitle && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * 页面操作按钮组
 * 
 * 提供标准化的操作按钮布局
 */
export function PageActions({ 
  children, 
  align = 'right',
  className = '' 
}: { 
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right' | 'between';
  className?: string;
}) {
  const alignClass = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
    between: 'justify-between'
  }[align];

  return (
    <div className={`flex items-center gap-3 ${alignClass} ${className}`}>
      {children}
    </div>
  );
}
