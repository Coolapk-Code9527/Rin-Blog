import { useLocation } from "wouter";

/**
 * 自定义钩子，用于获取URL中的搜索参数
 * 返回搜索字符串（不包含问号）
 */
export const useSearch = (): string => {
  const [location] = useLocation();
  const searchIndex = location.indexOf('?');
  return searchIndex >= 0 ? location.slice(searchIndex + 1) : '';
}; 