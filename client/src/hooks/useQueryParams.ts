import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';

/**
 * 自定义钩子，用于处理URL查询参数
 * 解决了Wouter中对查询参数处理不足的问题
 */
export function useQueryParams<T extends Record<string, string>>() {
  const [location] = useLocation();
  const [params, setParams] = useState<T>({} as T);
  
  // 解析URL中的查询参数
  const parseQueryParams = useCallback(() => {
    // 查找查询参数部分 ('?'后面的内容)
    const queryIndex = location.indexOf('?');
    if (queryIndex === -1) {
      setParams({} as T);
      return;
    }
    
    const queryString = location.substring(queryIndex + 1);
    const searchParams = new URLSearchParams(queryString);
    const parsedParams: Record<string, string> = {};
    
    searchParams.forEach((value, key) => {
      parsedParams[key] = value;
    });
    
    setParams(parsedParams as T);
  }, [location]);
  
  // 当URL变化时更新参数
  useEffect(() => {
    parseQueryParams();
  }, [location, parseQueryParams]);
  
  // 生成带有新参数的URL
  const getUrlWithParams = useCallback((newParams: Partial<T>) => {
    const queryIndex = location.indexOf('?');
    const basePath = queryIndex === -1 ? location : location.substring(0, queryIndex);
    
    const currentParams = { ...params };
    
    // 更新参数
    Object.entries(newParams).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        delete currentParams[key as keyof T];
      } else {
        currentParams[key as keyof T] = value as any;
      }
    });
    
    const searchParams = new URLSearchParams();
    Object.entries(currentParams).forEach(([key, value]) => {
      searchParams.append(key, value as string);
    });
    
    const queryString = searchParams.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  }, [location, params]);
  
  return {
    params,
    getUrlWithParams
  };
} 