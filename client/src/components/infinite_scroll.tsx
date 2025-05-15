import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface InfiniteScrollProps {
  /**
   * 是否有更多数据可加载
   */
  hasMore: boolean;
  
  /**
   * 加载下一页数据的回调函数
   */
  loadMore: () => void;
  
  /**
   * 是否正在加载数据
   */
  loading?: boolean;
  
  /**
   * 距离底部多远时触发加载（单位：像素）
   */
  threshold?: number;
  
  /**
   * 加载中显示的内容
   */
  loader?: React.ReactNode;
  
  /**
   * 没有更多数据时显示的内容
   */
  endMessage?: React.ReactNode;
  
  /**
   * 内容容器的类名
   */
  className?: string;
  
  /**
   * 内容
   */
  children: React.ReactNode;
}

/**
 * 无限滚动组件
 * 
 * 当用户滚动到接近底部时自动加载更多内容
 */
export function InfiniteScroll({
  hasMore,
  loadMore,
  loading = false,
  threshold = 200,
  loader,
  endMessage,
  className = '',
  children,
}: InfiniteScrollProps) {
  const { t } = useTranslation();
  const [isFetching, setIsFetching] = useState(loading);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 处理滚动事件
  useEffect(() => {
    const handleScroll = () => {
      if (!hasMore || isFetching) return;
      
      if (containerRef.current) {
        const container = containerRef.current;
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight;
        const clientHeight = document.documentElement.clientHeight;
        
        // 当距离底部小于指定阈值时加载更多
        if (scrollHeight - scrollTop - clientHeight < threshold) {
          setIsFetching(true);
          loadMore();
        }
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasMore, isFetching, loadMore, threshold]);
  
  // 同步外部loading状态
  useEffect(() => {
    setIsFetching(loading);
  }, [loading]);
  
  // 默认加载指示器
  const defaultLoader = (
    <div className="w-full py-4 flex justify-center items-center">
      <div className="flex items-center space-x-2">
        <div className="h-5 w-5">
          <i className="ri-loader-4-line animate-spin text-theme"></i>
        </div>
        <p className="text-gray-500 text-sm">{t("loading")}</p>
      </div>
    </div>
  );
  
  // 默认结束消息
  const defaultEndMessage = (
    <div className="w-full py-4 flex justify-center">
      <p className="text-gray-400 text-sm">{t("no_more_data")}</p>
    </div>
  );
  
  return (
    <div ref={containerRef} className={className}>
      {children}
      
      {isFetching && (loader || defaultLoader)}
      
      {!hasMore && !isFetching && (endMessage || defaultEndMessage)}
    </div>
  );
} 