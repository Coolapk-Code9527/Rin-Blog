import React from 'react';
import { useGlassEffect, GLASS_LAYERS } from '../hooks/useGlassEffect';

/**
 * 统一容器高度类型
 */
export type ContainerHeightType = 
  | 'standard'      // 标准高度：calc(100vh - 200px)
  | 'mobile'        // 移动端优化：calc(100vh - 180px)
  | 'responsive'    // 响应式：自动适配不同屏幕
  | 'compact'       // 紧凑型：较小的高度
  | 'full';         // 全高度：占满可用空间

/**
 * 统一容器布局类型
 */
export type ContainerLayoutType = 
  | 'default'       // 默认布局：简单容器
  | 'with-header'   // 带标题：标题 + 内容
  | 'with-footer'   // 带底部：内容 + 底部
  | 'full-layout'; // 完整布局：标题 + 内容 + 底部

/**
 * 统一容器组件属性
 */
export interface UnifiedContainerProps {
  children: React.ReactNode;
  className?: string;
  heightType?: ContainerHeightType;
  layoutType?: ContainerLayoutType;
  title?: React.ReactNode;
  footer?: React.ReactNode;
  enableScroll?: boolean;
  glassEffect?: boolean;
  disablePadding?: boolean;
  onScroll?: (e: UIEvent) => void;
}

/**
 * 获取容器高度CSS类名
 */
function getHeightClassName(heightType: ContainerHeightType): string {
  switch (heightType) {
    case 'standard':
      return 'unified-container-height';
    case 'mobile':
      return 'unified-container-height-mobile';
    case 'responsive':
      return 'unified-container-responsive';
    case 'compact':
      return 'h-[400px] min-h-[300px] max-h-[500px]';
    case 'full':
      return 'h-full min-h-full';
    default:
      return 'unified-container-responsive';
  }
}

/**
 * 统一容器组件
 * 
 * 提供统一的容器高度管理，支持响应式设计和多种布局模式
 * 
 * @example
 * ```tsx
 * // 基础用法
 * <UnifiedContainer heightType="responsive">
 *   <div>内容</div>
 * </UnifiedContainer>
 * 
 * // 带标题和底部
 * <UnifiedContainer 
 *   heightType="responsive"
 *   layoutType="full-layout"
 *   title={<h2>页面标题</h2>}
 *   footer={<div>底部操作</div>}
 * >
 *   <div>主要内容</div>
 * </UnifiedContainer>
 * ```
 */
export function UnifiedContainer({
  children,
  className = '',
  heightType = 'responsive',
  layoutType = 'default',
  title,
  footer,
  enableScroll = true,
  glassEffect = true,
  disablePadding = false,
  onScroll
}: UnifiedContainerProps) {
  // 获取毛玻璃效果
  const glassClass = useGlassEffect(GLASS_LAYERS.CARD);
  
  // 构建容器CSS类名
  const heightClass = getHeightClassName(heightType);
  const containerClasses = [
    heightClass,
    'relative',
    'rounded-2xl',
    'shadow-enhanced',
    'border',
    'border-gray-200/60',
    'dark:border-gray-700/60',
    'overflow-hidden',
    glassEffect ? glassClass : '',
    className
  ].filter(Boolean).join(' ');

  // 渲染默认布局
  if (layoutType === 'default') {
    return (
      <div className={containerClasses}>
        {enableScroll ? (
          <div 
            className="unified-container-scroll custom-scrollbar"
            onScroll={onScroll}
          >
            <div className="p-6">
              {children}
            </div>
          </div>
        ) : (
          <div className="unified-container-content p-6">
            {children}
          </div>
        )}
      </div>
    );
  }

  // 渲染带标题布局
  if (layoutType === 'with-header') {
    return (
      <div className={containerClasses}>
        <div className="unified-container-content">
          {title && (
            <div className="unified-container-header">
              {title}
            </div>
          )}
          <div className="unified-container-body">
            {enableScroll ? (
              <div 
                className="unified-container-scroll custom-scrollbar p-6"
                onScroll={onScroll}
              >
                {children}
              </div>
            ) : (
              <div className="p-6 h-full">
                {children}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 渲染带底部布局
  if (layoutType === 'with-footer') {
    const paddingClass = disablePadding ? '' : 'p-6';
    return (
      <div className={containerClasses}>
        <div className="unified-container-content">
          <div className="unified-container-body">
            {enableScroll ? (
              <div
                className={`unified-container-scroll custom-scrollbar ${paddingClass}`}
                onScroll={onScroll}
              >
                {children}
              </div>
            ) : (
              <div className={`${paddingClass} h-full`}>
                {children}
              </div>
            )}
          </div>
          {footer && (
            <div className="unified-container-footer">
              {footer}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 渲染完整布局
  if (layoutType === 'full-layout') {
    return (
      <div className={containerClasses}>
        <div className="unified-container-content">
          {title && (
            <div className="unified-container-header">
              {title}
            </div>
          )}
          <div className="unified-container-body">
            {enableScroll ? (
              <div 
                className="unified-container-scroll custom-scrollbar p-6"
                onScroll={onScroll}
              >
                {children}
              </div>
            ) : (
              <div className="p-6 h-full">
                {children}
              </div>
            )}
          </div>
          {footer && (
            <div className="unified-container-footer">
              {footer}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 默认返回基础布局
  return (
    <div className={containerClasses}>
      {enableScroll ? (
        <div 
          className="unified-container-scroll custom-scrollbar"
          onScroll={onScroll}
        >
          <div className="p-6">
            {children}
          </div>
        </div>
      ) : (
        <div className="unified-container-content p-6">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * 统一容器高度Hook
 * 
 * 提供容器高度相关的工具函数和状态管理
 */
export function useUnifiedContainer() {
  // 获取当前屏幕尺寸对应的最佳高度类型
  const getOptimalHeightType = (): ContainerHeightType => {
    if (typeof window === 'undefined') return 'responsive';
    
    const width = window.innerWidth;
    if (width < 640) return 'mobile';
    if (width < 1280) return 'standard';
    return 'responsive';
  };

  // 计算容器实际高度
  const calculateContainerHeight = (heightType: ContainerHeightType): number => {
    if (typeof window === 'undefined') return 400;
    
    const vh = window.innerHeight;
    switch (heightType) {
      case 'standard':
        return Math.max(400, Math.min(vh - 200, vh - 150));
      case 'mobile':
        return Math.max(350, Math.min(vh - 180, vh - 130));
      case 'responsive':
        return getOptimalHeightType() === 'mobile' 
          ? Math.max(350, Math.min(vh - 180, vh - 130))
          : Math.max(400, Math.min(vh - 200, vh - 150));
      case 'compact':
        return Math.max(300, Math.min(400, 500));
      case 'full':
        return vh;
      default:
        return 400;
    }
  };

  return {
    getOptimalHeightType,
    calculateContainerHeight
  };
}
