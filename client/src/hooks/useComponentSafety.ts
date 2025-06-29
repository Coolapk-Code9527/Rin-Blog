import { useRef, useEffect, useCallback } from 'react';

/**
 * 组件安全Hook
 * 
 * 提供组件挂载状态跟踪和安全操作包装，防止在组件卸载后执行操作导致的DOM错误
 * 
 * 功能特点：
 * - 跟踪组件挂载状态
 * - 提供安全的操作包装函数
 * - 防止内存泄漏和DOM操作错误
 * - 支持异步操作的安全执行
 */

export interface ComponentSafetyHook {
  /** 检查组件是否仍然挂载 */
  isMounted: () => boolean;
  
  /** 安全执行函数，只在组件挂载时执行 */
  safeExecute: <T extends any[], R>(fn: (...args: T) => R) => (...args: T) => R | undefined;
  
  /** 安全执行异步函数，只在组件挂载时执行 */
  safeExecuteAsync: <T extends any[], R>(fn: (...args: T) => Promise<R>) => (...args: T) => Promise<R | undefined>;
  
  /** 创建安全的事件监听器 */
  createSafeEventListener: <T extends Event>(handler: (event: T) => void) => (event: T) => void;
}

/**
 * 组件安全Hook
 * 
 * @returns ComponentSafetyHook 安全操作接口
 */
export function useComponentSafety(): ComponentSafetyHook {
  const isMountedRef = useRef(true);
  
  // 组件卸载时设置标志
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // 检查组件是否仍然挂载
  const isMounted = useCallback(() => {
    return isMountedRef.current;
  }, []);
  
  // 安全执行函数
  const safeExecute = useCallback(<T extends any[], R>(fn: (...args: T) => R) => {
    return (...args: T): R | undefined => {
      if (!isMountedRef.current) {
        console.warn('Attempted to execute function on unmounted component');
        return undefined;
      }
      
      try {
        return fn(...args);
      } catch (error) {
        console.error('Error in safe execution:', error);
        return undefined;
      }
    };
  }, []);
  
  // 安全执行异步函数
  const safeExecuteAsync = useCallback(<T extends any[], R>(fn: (...args: T) => Promise<R>) => {
    return async (...args: T): Promise<R | undefined> => {
      if (!isMountedRef.current) {
        console.warn('Attempted to execute async function on unmounted component');
        return undefined;
      }
      
      try {
        const result = await fn(...args);
        
        // 异步操作完成后再次检查组件状态
        if (!isMountedRef.current) {
          console.warn('Component unmounted during async operation');
          return undefined;
        }
        
        return result;
      } catch (error) {
        console.error('Error in safe async execution:', error);
        return undefined;
      }
    };
  }, []);
  
  // 创建安全的事件监听器
  const createSafeEventListener = useCallback(<T extends Event>(handler: (event: T) => void) => {
    return (event: T): void => {
      if (!isMountedRef.current) {
        console.warn('Event triggered on unmounted component');
        return;
      }
      
      try {
        handler(event);
      } catch (error) {
        console.error('Error in event handler:', error);
      }
    };
  }, []);
  
  return {
    isMounted,
    safeExecute,
    safeExecuteAsync,
    createSafeEventListener
  };
}

/**
 * 安全的缓存失效Hook
 * 
 * 包装缓存失效函数，确保只在组件挂载时执行
 */
export function useSafeCacheInvalidation(invalidateFunction: () => void) {
  const { safeExecute } = useComponentSafety();
  
  return useCallback(() => {
    const safeInvalidate = safeExecute(invalidateFunction);
    safeInvalidate();
  }, [invalidateFunction, safeExecute]);
}

/**
 * 安全的事件监听器Hook
 * 
 * 自动管理事件监听器的添加和清理，确保安全执行
 */
export function useSafeEventListener<T extends keyof WindowEventMap>(
  eventType: T,
  handler: (event: WindowEventMap[T]) => void,
  target: EventTarget = window
) {
  const { createSafeEventListener, isMounted } = useComponentSafety();
  
  useEffect(() => {
    const safeHandler = createSafeEventListener(handler);
    
    target.addEventListener(eventType, safeHandler as EventListener);
    
    return () => {
      // 清理时检查组件状态，避免重复清理
      if (isMounted()) {
        target.removeEventListener(eventType, safeHandler as EventListener);
      }
    };
  }, [eventType, handler, target, createSafeEventListener, isMounted]);
}

/**
 * 防抖安全执行Hook
 * 
 * 结合防抖和组件安全检查
 */
export function useSafeDebounce<T extends any[]>(
  fn: (...args: T) => void,
  delay: number = 300
) {
  const { safeExecute } = useComponentSafety();
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  
  const debouncedFn = useCallback((...args: T) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      const safeFn = safeExecute(fn);
      safeFn(...args);
    }, delay);
  }, [fn, delay, safeExecute]);
  
  // 清理定时器
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return debouncedFn;
}
