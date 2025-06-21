import * as React from 'react';
import { useGlassEffect, GLASS_LAYERS } from '../../hooks/useGlassEffect';
import { ProfileCard } from './ProfileCard';
import { TagCloud } from './TagCloud';
import { AnnouncementCard } from './AnnouncementCard';
import { MusicPlayer } from './MusicPlayer';
import { ClientConfigContext } from '../../state/config';
import { getSidebarConfig, type SidebarConfig } from '../../utils/sidebarConfig';

interface SidebarContainerProps {
  className?: string;
}

export function SidebarContainer({ className = '' }: SidebarContainerProps) {
  const config = React.useContext(ClientConfigContext);

  // 获取侧边栏配置
  const sidebarConfig = getSidebarConfig(config);

  // 如果侧边栏被禁用，不渲染任何内容
  if (!sidebarConfig.enabled) {
    return null;
  }

  // 组件映射
  const componentMap = {
    profile: ProfileCard,
    tagCloud: TagCloud,
    announcements: AnnouncementCard,
    music: MusicPlayer,
  };

  // 根据配置和顺序渲染组件
  const renderComponents = () => {
    return sidebarConfig.order
      .filter(componentName =>
        sidebarConfig.components[componentName as keyof typeof sidebarConfig.components]
      )
      .map(componentName => {
        const Component = componentMap[componentName as keyof typeof componentMap];
        if (!Component) return null;

        return <Component key={componentName} {...({} as any)} />;
      })
      .filter(Boolean);
  };



  return (
    <aside className={`hidden lg:flex flex-col w-[260px] flex-shrink-0 gap-6 ${className}`}>
      <div className="flex flex-col gap-6">
        {renderComponents()}
      </div>
    </aside>
  );
}

// 侧边栏组件骨架屏
function SidebarComponentSkeleton() {
  const glassClass = useGlassEffect(GLASS_LAYERS.CARD);
  
  return (
    <div className={`rounded-2xl ${glassClass} shadow-enhanced border border-neutral-200/60 dark:border-neutral-700/60 p-4 animate-pulse`}>
      <div className="space-y-3">
        <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4"></div>
        <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2"></div>
        <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-2/3"></div>
      </div>
    </div>
  );
}

// 用于懒加载的高阶组件
export function withLazyLoading<T extends object>(
  Component: React.ComponentType<T>,
  fallback?: React.ReactNode
) {
  return Component; // 简化实现，直接返回组件
}

// 导出类型定义
export type { SidebarConfig };
