import { useEffect, useState } from "react";
import { useSearch } from "wouter";
import { tryInt } from "../utils/int";

interface PaginationConfig {
  /**
   * 页面标识符，用于存储用户偏好
   */
  pageId: string;
  
  /**
   * 默认页码（从1开始）
   */
  defaultPage?: number;
  
  /**
   * 每页默认条数
   */
  defaultLimit?: number;
  
  /**
   * 是否自动从URL读取参数
   */
  readFromUrl?: boolean;
  
  /**
   * 是否记住用户偏好
   */
  rememberPreferences?: boolean;
}

/**
 * 分页状态钩子
 * 
 * 管理分页状态，支持从URL读取状态、本地存储用户偏好
 */
export function usePaginationState({
  pageId,
  defaultPage = 1,
  defaultLimit = parseInt(process.env.PAGE_SIZE || "10"),
  readFromUrl = true,
  rememberPreferences = true,
}: PaginationConfig) {
  // 生成存储键
  const pageKey = `pagination_page_${pageId}`;
  const limitKey = `pagination_limit_${pageId}`;
  
  // 尝试从本地存储获取用户偏好
  const getSavedPreference = (key: string, defaultValue: number) => {
    if (rememberPreferences && typeof window !== 'undefined') {
      const saved = localStorage.getItem(key);
      return saved ? parseInt(saved) : defaultValue;
    }
    return defaultValue;
  };
  
  // 读取URL参数
  const query = useSearch();
  const urlParams = new URLSearchParams(query);
  
  // 确定初始页码和每页条数
  const initialPage = readFromUrl && urlParams.get("page") 
    ? tryInt(defaultPage, urlParams.get("page")) 
    : getSavedPreference(pageKey, defaultPage);
    
  const initialLimit = readFromUrl && urlParams.get("limit") 
    ? tryInt(defaultLimit, urlParams.get("limit")) 
    : getSavedPreference(limitKey, defaultLimit);
  
  // 状态
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  
  // 保存用户偏好
  useEffect(() => {
    if (rememberPreferences && typeof window !== 'undefined') {
      localStorage.setItem(pageKey, String(page));
    }
  }, [page, pageKey, rememberPreferences]);
  
  useEffect(() => {
    if (rememberPreferences && typeof window !== 'undefined') {
      localStorage.setItem(limitKey, String(limit));
    }
  }, [limit, limitKey, rememberPreferences]);
  
  // 同步URL变化
  useEffect(() => {
    if (readFromUrl) {
      const urlPage = urlParams.get("page");
      if (urlPage) {
        const newPage = tryInt(defaultPage, urlPage);
        if (newPage !== page) {
          setPage(newPage);
        }
      }
      
      const urlLimit = urlParams.get("limit");
      if (urlLimit) {
        const newLimit = tryInt(defaultLimit, urlLimit);
        if (newLimit !== limit) {
          setLimit(newLimit);
        }
      }
    }
  }, [query]);
  
  return {
    page,
    setPage,
    limit,
    setLimit,
    /**
     * 重置为第一页
     */
    resetPage: () => setPage(1),
    /**
     * 重置为默认分页大小
     */
    resetLimit: () => setLimit(defaultLimit),
    /**
     * 重置所有分页状态
     */
    resetAll: () => {
      setPage(1);
      setLimit(defaultLimit);
    }
  };
} 