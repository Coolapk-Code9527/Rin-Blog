import React from 'react';
import { useGlassEffect, GLASS_LAYERS } from '../../hooks/useGlassEffect';

interface SidebarSkeletonProps {
  className?: string;
}

/**
 * 统一的侧边栏骨架屏组件
 * 
 * 提供与实际侧边栏组件相同布局结构的骨架屏，确保加载时的视觉一致性
 * 
 * ## 特性
 * - **统一设计**：与实际组件保持相同的布局和间距
 * - **毛玻璃效果**：使用与实际组件相同的毛玻璃样式
 * - **脉冲动画**：提供平滑的加载动画效果
 * - **响应式设计**：适配不同屏幕尺寸
 * 
 * @param className 额外的CSS类名
 */
export function SidebarSkeleton({ className = '' }: SidebarSkeletonProps) {
  const glassClass = useGlassEffect(GLASS_LAYERS.CARD);

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      {/* ProfileCard 骨架屏 */}
      <ProfileCardSkeleton glassClass={glassClass} />
      
      {/* AnnouncementCard 骨架屏 */}
      <AnnouncementCardSkeleton glassClass={glassClass} />
      
      {/* MusicPlayer 骨架屏 */}
      <MusicPlayerSkeleton glassClass={glassClass} />
      
      {/* TagCloud 骨架屏 */}
      <div className="min-h-0">
        <TagCloudSkeleton glassClass={glassClass} />
      </div>
    </div>
  );
}

/**
 * ProfileCard 骨架屏
 */
function ProfileCardSkeleton({ glassClass }: { glassClass: string }) {
  return (
    <div className={`rounded-2xl ${glassClass} shadow-enhanced border border-neutral-200/60 dark:border-neutral-700/60 overflow-hidden animate-pulse`}>
      <div className="p-3">
        {/* 头像和基本信息 */}
        <div className="flex flex-col items-center text-center mb-3">
          {/* 头像 */}
          <div className="w-20 h-20 rounded-full bg-neutral-200 dark:bg-neutral-700 mb-2"></div>
          
          {/* 姓名 */}
          <div className="h-6 bg-neutral-200 dark:bg-neutral-700 rounded w-24 mb-2"></div>
          
          {/* 简介 */}
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-32 mb-3"></div>
        </div>

        {/* 社交媒体链接 */}
        <div className="flex justify-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-neutral-200 dark:bg-neutral-700"></div>
          <div className="w-8 h-8 rounded-lg bg-neutral-200 dark:bg-neutral-700"></div>
          <div className="w-8 h-8 rounded-lg bg-neutral-200 dark:bg-neutral-700"></div>
        </div>

        {/* 音乐播放器控制 */}
        <div className="flex items-center justify-center gap-3">
          <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-700"></div>
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded flex-1"></div>
          <div className="w-6 h-6 rounded bg-neutral-200 dark:bg-neutral-700"></div>
        </div>
      </div>
    </div>
  );
}

/**
 * AnnouncementCard 骨架屏
 */
function AnnouncementCardSkeleton({ glassClass }: { glassClass: string }) {
  return (
    <div className={`rounded-2xl ${glassClass} shadow-enhanced border border-neutral-200/60 dark:border-neutral-700/60 overflow-hidden animate-pulse`}>
      {/* 标题栏 */}
      <div className="px-4 py-3 border-b border-neutral-200/60 dark:border-neutral-700/60">
        <div className="h-6 bg-neutral-200 dark:bg-neutral-700 rounded w-20"></div>
      </div>
      
      {/* 公告内容 */}
      <div className="p-4 space-y-3">
        {/* 重要公告 */}
        <div className="p-3 rounded-lg bg-neutral-100 dark:bg-neutral-800">
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-full mb-1"></div>
          <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-2/3"></div>
        </div>
        
        {/* 普通公告 */}
        <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-2/3 mb-2"></div>
          <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-full mb-1"></div>
          <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4"></div>
        </div>
      </div>
    </div>
  );
}

/**
 * MusicPlayer 骨架屏
 */
function MusicPlayerSkeleton({ glassClass }: { glassClass: string }) {
  return (
    <div className={`rounded-2xl ${glassClass} shadow-enhanced border border-neutral-200/60 dark:border-neutral-700/60 overflow-hidden animate-pulse`}>
      {/* 标题栏 */}
      <div className="px-4 py-3 border-b border-neutral-200/60 dark:border-neutral-700/60">
        <div className="h-6 bg-neutral-200 dark:bg-neutral-700 rounded w-16"></div>
      </div>
      
      {/* 音乐播放器内容 */}
      <div className="p-4">
        {/* 专辑封面 */}
        <div className="w-full aspect-square rounded-xl bg-neutral-200 dark:bg-neutral-700 mb-4"></div>
        
        {/* 歌曲信息 */}
        <div className="text-center mb-4">
          <div className="h-5 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4 mx-auto mb-2"></div>
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2 mx-auto"></div>
        </div>
        
        {/* 进度条 */}
        <div className="mb-4">
          <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full mb-2"></div>
          <div className="flex justify-between text-xs">
            <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-8"></div>
            <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-8"></div>
          </div>
        </div>
        
        {/* 控制按钮 */}
        <div className="flex items-center justify-center gap-4">
          <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-700"></div>
          <div className="w-12 h-12 rounded-full bg-neutral-200 dark:bg-neutral-700"></div>
          <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-700"></div>
        </div>
        
        {/* 音量控制 */}
        <div className="mt-4 flex items-center gap-2">
          <div className="w-4 h-4 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
          <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full flex-1"></div>
          <div className="w-4 h-4 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
        </div>
      </div>
    </div>
  );
}

/**
 * TagCloud 骨架屏
 */
function TagCloudSkeleton({ glassClass }: { glassClass: string }) {
  return (
    <div className={`rounded-2xl ${glassClass} shadow-enhanced border border-neutral-200/60 dark:border-neutral-700/60 overflow-hidden animate-pulse`}>
      {/* 标题栏 */}
      <div className="px-4 py-3 border-b border-neutral-200/60 dark:border-neutral-700/60">
        <div className="h-6 bg-neutral-200 dark:bg-neutral-700 rounded w-24"></div>
      </div>
      
      {/* 标签云内容 */}
      <div className="p-4">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="h-6 bg-neutral-200 dark:bg-neutral-700 rounded-full"
              style={{ width: `${Math.random() * 60 + 40}px` }}
            ></div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 简化版侧边栏骨架屏（用于快速加载场景）
 */
export function SimpleSidebarSkeleton({ className = '' }: SidebarSkeletonProps) {
  const glassClass = useGlassEffect(GLASS_LAYERS.CARD);

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={`rounded-2xl ${glassClass} shadow-enhanced border border-neutral-200/60 dark:border-neutral-700/60 p-4 animate-pulse`}
        >
          <div className="space-y-3">
            <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4"></div>
            <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2"></div>
            <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-2/3"></div>
          </div>
        </div>
      ))}
    </div>
  );
}
