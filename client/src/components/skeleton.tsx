import React from 'react';

// 文章卡片的骨架屏
export const FeedCardSkeleton = () => {
  return (
    <div className="w-full rounded-2xl bg-white dark:bg-gray-800 h-full overflow-hidden border border-gray-100 dark:border-gray-700 shadow-sm animate-pulse flex flex-col min-h-[260px] xs:min-h-[280px]">
      {/* 图片占位区域 */}
      <div className="w-full h-40 xs:h-44 sm:h-48 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-t-xl relative">
        {/* 顶部通知标识占位 */}
        <div className="absolute top-3 right-3 w-16 h-6 rounded-full bg-gray-300 dark:bg-gray-600"></div>
      </div>
      
      {/* 内容区域 */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col">
        {/* 标题占位 */}
        <div className="h-6 sm:h-7 bg-gray-200 dark:bg-gray-700 rounded-lg mb-2 w-3/4"></div>
        <div className="h-6 sm:h-7 bg-gray-200 dark:bg-gray-700 rounded-lg mb-4 w-1/2"></div>
        
        {/* 日期和标签占位 */}
        <div className="flex justify-between mb-3">
          <div className="h-5 bg-gray-100 dark:bg-gray-800 rounded-full w-24"></div>
          <div className="h-5 bg-gray-100 dark:bg-gray-800 rounded-full w-16"></div>
        </div>
        
        {/* 内容摘要占位 */}
        <div className="space-y-2">
          <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-full"></div>
          <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-full"></div>
          <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-3/4"></div>
        </div>
      </div>
    </div>
  );
};

// 文章列表骨架屏
export const FeedListSkeleton = () => {
  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      {[...Array(6)].map((_, index) => (
        <FeedCardSkeleton key={index} />
      ))}
    </div>
  );
};

// 分页骨架屏
export const PaginationSkeleton = () => {
  return (
    <div className="flex justify-center items-center space-x-2 mt-6 animate-pulse">
      {[...Array(5)].map((_, index) => (
        <div
          key={index}
          className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center"
        ></div>
      ))}
    </div>
  );
};

// 标题骨架屏
export const TitleSkeleton = () => {
  return (
    <div className="animate-pulse">
      <div className="h-7 sm:h-8 bg-gray-200 dark:bg-gray-700 rounded-lg w-1/2 mb-2"></div>
      <div className="h-5 bg-gray-100 dark:bg-gray-800 rounded-lg w-1/3"></div>
    </div>
  );
};

// 骨架屏组合 - 用于文章列表页
export const FeedsPageSkeleton = () => {
  return (
    <div className="space-y-8">
      <TitleSkeleton />
      
      <div className="flex justify-between items-center">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
        <div className="flex space-x-2">
          <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
          <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
        </div>
      </div>
      
      <div className="w-full h-[1px] bg-gradient-to-r from-gray-200 via-theme-light/30 to-gray-200 dark:from-gray-700 dark:via-theme-light/20 dark:to-gray-700"></div>
      
      <FeedListSkeleton />
      <PaginationSkeleton />
    </div>
  );
}; 