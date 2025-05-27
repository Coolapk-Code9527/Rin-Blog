import { useCallback, useEffect, useState } from "react";
import { useSearch } from "wouter";

export interface CursorPaginationOptions {
  /**
   * 页面标识，用于本地存储区分不同页面
   */
  pageId: string;
  
  /**
   * 初始页码（从1开始）
   */
  initialPage?: number;
  
  /**
   * 是否从URL读取页码
   */
  readFromUrl?: boolean;
  
  /**
   * 是否记住当前页码（本地存储）
   */
  rememberPage?: boolean;
}

/**
 * 游标分页钩子
 * 
 * 管理基于游标的分页状态
 */
export function useCursorPagination({
  pageId,
  initialPage = 1,
  readFromUrl = true,
  rememberPage = true,
}: CursorPaginationOptions) {
  // 存储键
  const pageKey = `cursor_pagination_page_${pageId}`;
  const cursorKey = `cursor_pagination_cursor_${pageId}`;
  
  // 读取URL参数
  const query = useSearch();
  const urlParams = new URLSearchParams(query);
  
  // 获取存储的值
  const getSavedValue = (key: string, defaultValue: string) => {
    if (rememberPage && typeof window !== 'undefined') {
      const saved = localStorage.getItem(key);
      return saved || defaultValue;
    }
    return defaultValue;
  };
  
  // 确定初始页码
  const getInitialPage = () => {
    if (readFromUrl && urlParams.get("page")) {
      const pageFromUrl = parseInt(urlParams.get("page") || "1");
      return isNaN(pageFromUrl) ? initialPage : pageFromUrl;
    }
    
    if (rememberPage) {
      const savedPage = parseInt(getSavedValue(pageKey, initialPage.toString()));
      return isNaN(savedPage) ? initialPage : savedPage;
    }
    
    return initialPage;
  };
  
  // 状态
  const [page, setPage] = useState(getInitialPage());
  const [cursor, setCursor] = useState<string | null>(
    getSavedValue(cursorKey, "")
  );
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  
  // 保存当前页码到本地存储
  useEffect(() => {
    if (rememberPage && typeof window !== 'undefined') {
      localStorage.setItem(pageKey, page.toString());
    }
  }, [page, pageKey, rememberPage]);
  
  // 保存当前游标到本地存储
  useEffect(() => {
    if (rememberPage && typeof window !== 'undefined' && cursor) {
      localStorage.setItem(cursorKey, cursor);
    }
  }, [cursor, cursorKey, rememberPage]);
  
  // 同步URL参数
  useEffect(() => {
    if (readFromUrl) {
      const pageFromUrl = urlParams.get("page");
      if (pageFromUrl) {
        const newPage = parseInt(pageFromUrl);
        if (!isNaN(newPage) && newPage !== page) {
          setPage(newPage);
        }
      }
    }
  }, [query, readFromUrl]);
  
  // 设置游标和相关状态
  const updateCursorState = useCallback((nextCursor: string | null, hasNextPage: boolean) => {
    // 如果有下一页，保存当前游标以支持返回
    if (hasNextPage && cursor) {
      setCursorHistory(prev => {
        // 避免重复添加相同的游标
        if (prev.includes(cursor)) return prev;
        return [...prev, cursor];
      });
    }
    
    setHasNext(hasNextPage);
    setHasPrevious(cursorHistory.length > 0);
    setCursor(nextCursor);
  }, [cursor, cursorHistory]);
  
  // 下一页
  const nextPage = useCallback(() => {
    if (hasNext && cursor) {
      setPage(prev => prev + 1);
    }
  }, [hasNext, cursor]);
  
  // 上一页
  const previousPage = useCallback(() => {
    if (hasPrevious && page > 1) {
      setPage(prev => prev - 1);
      
      // 获取前一个游标
      const previousCursor = cursorHistory.pop();
      setCursorHistory(cursorHistory.slice(0, -1));
      setCursor(previousCursor || null);
      setHasPrevious(cursorHistory.length > 0);
    }
  }, [hasPrevious, page, cursorHistory]);
  
  // 重置到第一页
  const resetToFirstPage = useCallback(() => {
    setPage(1);
    setCursor(null);
    setCursorHistory([]);
    setHasPrevious(false);
  }, []);
  
  return {
    page,
    cursor,
    hasNext,
    hasPrevious,
    nextPage,
    previousPage,
    resetToFirstPage,
    updateCursorState,
  };
} 