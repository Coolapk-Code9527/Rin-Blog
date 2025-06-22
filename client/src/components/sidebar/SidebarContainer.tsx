import * as React from 'react';
import { ProfileCard } from './ProfileCard';
import { TagCloud } from './TagCloud';
import { AnnouncementCard } from './AnnouncementCard';
import { MusicPlayer } from './MusicPlayer';
import { SidebarSkeleton } from './SidebarSkeleton';
import { ClientConfigContext } from '../../state/config';
import { getSidebarConfig, type SidebarConfig } from '../../utils/sidebarConfig';

interface SidebarContainerProps {
  className?: string;
  showSkeleton?: boolean;
}

export function SidebarContainer({ className = '', showSkeleton = false }: SidebarContainerProps) {
  const config = React.useContext(ClientConfigContext);
  const [isLoading, setIsLoading] = React.useState(true);

  // 获取侧边栏配置
  const sidebarConfig = getSidebarConfig(config);

  // 如果侧边栏被禁用，不渲染任何内容
  if (!sidebarConfig.enabled) {
    return null;
  }

  // 模拟加载时间（实际项目中应该基于数据加载状态）
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800); // 800ms的加载时间，确保平滑过渡

    return () => clearTimeout(timer);
  }, []);

  // 如果正在加载或强制显示骨架屏，显示骨架屏
  if (isLoading || showSkeleton) {
    return <SidebarSkeleton className={className} />;
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



  const components = renderComponents();

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      {/* 固定高度组件 */}
      {components.slice(0, -1)}

      {/* 最后一个组件（通常是TagCloud）*/}
      <div className="min-h-0">
        {components.slice(-1)}
      </div>
    </div>
  );
}



// 用于懒加载的高阶组件（保留用于未来扩展）
export function withLazyLoading<T extends object>(
  Component: React.ComponentType<T>,
  _fallback?: React.ReactNode
) {
  return Component; // 简化实现，直接返回组件
}

// 导出类型定义
export type { SidebarConfig };
