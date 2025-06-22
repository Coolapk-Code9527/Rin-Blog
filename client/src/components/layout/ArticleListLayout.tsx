import React, { useContext, useEffect, useState, memo } from 'react';
import { SidebarContainer } from '../sidebar/SidebarContainer';
import { ClientConfigContext } from '../../state/config';
import { getSidebarConfig } from '../../utils/sidebarConfig';
import { useExtendedConfig } from '../../context/ConfigContext';

/**
 * 文章列表布局组件属性接口
 */
export interface ArticleListLayoutProps {
  /** 主内容区域 */
  children: React.ReactNode;
  /** 自定义侧边栏内容（可选，默认使用SidebarContainer） */
  sidebarContent?: React.ReactNode;
  /** 额外的CSS类名 */
  className?: string;
  /** 是否启用过渡动画（默认true） */
  enableTransitions?: boolean;
  /** 强制侧边栏状态（可选，用于测试） */
  forceSidebarState?: boolean;
}

/**
 * 获取智能容器宽度
 * @param sidebarEnabled 侧边栏是否启用
 * @param screenWidth 屏幕宽度（可选，用于SSR兼容）
 * @returns CSS类名
 */
function getContainerWidth(sidebarEnabled: boolean, screenWidth?: number): string {
  // 如果提供了屏幕宽度且小于lg断点，统一使用标准宽度
  if (screenWidth && screenWidth < 1024) {
    return 'max-w-6xl';
  }
  
  // 根据侧边栏状态决定容器宽度
  return sidebarEnabled ? 'max-w-7xl' : 'max-w-6xl';
}

/**
 * 文章列表专用布局组件
 *
 * 专门为文章列表页面设计的布局组件，使用CSS Grid实现侧边栏底部对齐。
 *
 * ## 核心特性
 * - **CSS Grid布局**：使用grid-template-rows: 1fr实现内容自然对齐
 * - **智能内容对齐**：侧边栏与文章卡片底部自然对齐，不延伸到页面底部
 * - **智能宽度管理**：侧边栏开启时使用max-w-7xl，关闭时使用max-w-6xl
 * - **响应式设计**：lg断点以下自动隐藏侧边栏，保持布局一致性
 * - **平滑过渡**：支持侧边栏状态变化的CSS动画效果
 * - **系统兼容**：与现有PageContainer布局系统完全兼容
 *
 * ## 布局策略
 * - **Grid布局**：使用CSS Grid替代Flexbox，让侧边栏高度适应主内容
 * - **Sticky定位**：结合self-start实现自然的内容跟随行为
 * - 侧边栏开启：容器max-w-7xl (1280px)，为260px侧边栏 + 24px间距预留空间
 * - 侧边栏关闭：容器max-w-6xl (1152px)，与其他页面保持完全一致
 * - 响应式断点：lg (1024px) 以下自动隐藏侧边栏
 *
 * ## 使用场景
 * 仅用于文章列表页面，其他页面继续使用PageContainer或UnifiedContainer
 *
 * @example
 * ```tsx
 * // 基本使用
 * <ArticleListLayout>
 *   <ArticleList />
 * </ArticleListLayout>
 *
 * // 自定义侧边栏内容
 * <ArticleListLayout sidebarContent={<CustomSidebar />}>
 *   <ArticleList />
 * </ArticleListLayout>
 *
 * // 禁用动画（测试用）
 * <ArticleListLayout enableTransitions={false}>
 *   <ArticleList />
 * </ArticleListLayout>
 * ```
 */
function ArticleListLayoutComponent({
  children,
  sidebarContent,
  className = '',
  enableTransitions = true,
  forceSidebarState
}: ArticleListLayoutProps): JSX.Element {
  // 获取扩展配置上下文（包含加载状态）
  const { config, configLoaded } = useExtendedConfig();
  const sidebarConfig = getSidebarConfig(config);
  
  // 侧边栏启用状态（支持强制状态用于测试）
  const sidebarEnabled = forceSidebarState !== undefined 
    ? forceSidebarState 
    : sidebarConfig.enabled;
  
  // 屏幕宽度状态（用于响应式处理）
  const [screenWidth, setScreenWidth] = useState<number | undefined>(
    typeof window !== 'undefined' ? window.innerWidth : undefined
  );
  
  // 监听屏幕尺寸变化（性能优化：使用防抖）
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let timeoutId: NodeJS.Timeout;

    const handleResize = () => {
      // 防抖处理，避免频繁更新
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setScreenWidth(window.innerWidth);
      }, 100);
    };

    // 初始化屏幕宽度
    setScreenWidth(window.innerWidth);

    // 添加事件监听器
    window.addEventListener('resize', handleResize, { passive: true });

    // 清理函数
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  // 侧边栏布局逻辑 - 分离空间预留和内容显示，添加配置加载状态检查
  const shouldReserveSidebarSpace = configLoaded && sidebarEnabled && screenWidth !== undefined && screenWidth >= 1024;
  const shouldShowSidebarContent = shouldReserveSidebarSpace; // 在预留空间时显示内容

  // 计算容器宽度 - 基于空间预留逻辑
  const containerWidth = getContainerWidth(shouldReserveSidebarSpace, screenWidth);
  
  // 过渡动画类名
  const transitionClass = enableTransitions 
    ? 'transition-all duration-300 ease-in-out' 
    : '';
  
  return (
    <div
      className={`${containerWidth} mx-auto w-full px-4 sm:px-6 md:px-8 ${transitionClass} ${className}`}
      data-sidebar-enabled={sidebarEnabled}
      data-container-width={containerWidth}
    >
      {/* CSS Grid布局 - 侧边栏与内容自然对齐 */}
      <div
        className={`grid gap-6 ${shouldReserveSidebarSpace ? 'grid-cols-[1fr_260px]' : 'grid-cols-1'}`}
        style={{
          gridTemplateRows: '1fr' // 让主内容决定容器高度，侧边栏自然适配
        }}
      >
        {/* 主内容区域 */}
        <main
          className={`min-w-0 ${transitionClass}`}
          role="main"
          aria-label="文章列表主内容"
        >
          {children}
        </main>

        {/* 侧边栏区域 - 与内容自然对齐 */}
        {shouldReserveSidebarSpace && (
          <aside
            className={`hidden lg:block sticky top-[5.5rem] self-start flex flex-col z-20 ${transitionClass}`}
            role="complementary"
            aria-label="侧边栏"
            style={{
              animation: enableTransitions ? 'slideInRight 0.3s ease-out' : undefined
            }}
          >
            {sidebarContent || <SidebarContainer showSkeleton={!shouldShowSidebarContent} />}
          </aside>
        )}
      </div>
    </div>
  );
};

/**
 * 性能优化的文章列表布局组件
 * 使用React.memo避免不必要的重渲染
 */
export const ArticleListLayout = memo(ArticleListLayoutComponent) as typeof ArticleListLayoutComponent;

/**
 * 文章列表布局Hook
 * 提供布局状态和控制方法
 */
export function useArticleListLayout() {
  const config = useContext(ClientConfigContext);
  const sidebarConfig = getSidebarConfig(config);
  
  return {
    sidebarEnabled: sidebarConfig.enabled,
    sidebarConfig,
    containerWidth: getContainerWidth(sidebarConfig.enabled)
  };
}


