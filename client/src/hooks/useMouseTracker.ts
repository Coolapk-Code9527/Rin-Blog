import { useEffect, useState, useCallback, useRef } from 'react';

/**
 * 鼠标位置数据接口
 */
export interface MousePosition {
  x: number;
  y: number;
  isActive: boolean;
}

/**
 * Hook配置选项
 */
export interface MouseTrackerOptions {
  /** 防抖延迟时间（毫秒） */
  debounceMs?: number;
  /** 是否启用移动端支持 */
  enableMobile?: boolean;
  /** 是否启用性能优化 */
  enableOptimization?: boolean;
  /** 目标元素引用（用于计算相对位置） */
  targetRef?: React.RefObject<HTMLElement>;
}

/**
 * 鼠标位置追踪Hook
 * 
 * 功能特点：
 * - 实时追踪鼠标位置
 * - 支持防抖优化
 * - 移动端触摸事件支持
 * - 性能优化和内存管理
 * - 相对位置计算
 * 
 * @param options 配置选项
 * @returns 鼠标位置数据和控制方法
 */
export const useMouseTracker = (options: MouseTrackerOptions = {}) => {
  const {
    debounceMs = 16, // 约60fps
    enableMobile = true,
    enableOptimization = true,
    targetRef
  } = options;

  const [mousePosition, setMousePosition] = useState<MousePosition>({
    x: 0,
    y: 0,
    isActive: false
  });

  const [isSupported, setIsSupported] = useState(true);
  const debounceRef = useRef<number>();
  const lastUpdateRef = useRef<number>(0);

  /**
   * 计算相对于目标元素的位置
   */
  const calculateRelativePosition = useCallback((clientX: number, clientY: number) => {
    if (!targetRef?.current) {
      return { x: clientX, y: clientY };
    }

    const rect = targetRef.current.getBoundingClientRect();
    return {
      x: clientX - rect.left - rect.width / 2,
      y: clientY - rect.top - rect.height / 2
    };
  }, [targetRef]);

  /**
   * 更新鼠标位置（带性能优化）
   */
  const updatePosition = useCallback((clientX: number, clientY: number) => {
    const now = performance.now();
    
    // 性能优化：限制更新频率
    if (enableOptimization && now - lastUpdateRef.current < debounceMs) {
      return;
    }

    const position = calculateRelativePosition(clientX, clientY);
    
    setMousePosition(prev => ({
      ...prev,
      x: position.x,
      y: position.y,
      isActive: true
    }));

    lastUpdateRef.current = now;
  }, [calculateRelativePosition, debounceMs, enableOptimization]);

  /**
   * 防抖更新位置
   */
  const debouncedUpdate = useCallback((clientX: number, clientY: number) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(() => {
      updatePosition(clientX, clientY);
    }, debounceMs);
  }, [updatePosition, debounceMs]);

  /**
   * 鼠标移动事件处理
   */
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (enableOptimization) {
      // 使用requestAnimationFrame优化性能
      requestAnimationFrame(() => {
        updatePosition(event.clientX, event.clientY);
      });
    } else {
      debouncedUpdate(event.clientX, event.clientY);
    }
  }, [updatePosition, debouncedUpdate, enableOptimization]);

  /**
   * 触摸移动事件处理（移动端）
   */
  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (!enableMobile || event.touches.length === 0) return;
    
    const touch = event.touches[0];
    updatePosition(touch.clientX, touch.clientY);
  }, [updatePosition, enableMobile]);

  /**
   * 鼠标离开事件处理
   */
  const handleMouseLeave = useCallback(() => {
    setMousePosition(prev => ({
      ...prev,
      isActive: false
    }));
  }, []);

  /**
   * 检测设备支持
   */
  useEffect(() => {
    const hasPointerEvents = 'onpointermove' in window;
    const hasMouseEvents = 'onmousemove' in window;
    const hasTouchEvents = 'ontouchmove' in window;
    
    setIsSupported(hasPointerEvents || hasMouseEvents || (enableMobile && hasTouchEvents));
  }, [enableMobile]);

  /**
   * 设置事件监听器
   */
  useEffect(() => {
    if (!isSupported) return;

    // 添加鼠标事件监听器
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave, { passive: true });

    // 添加移动端触摸事件监听器
    if (enableMobile) {
      document.addEventListener('touchmove', handleTouchMove, { passive: true });
      document.addEventListener('touchend', handleMouseLeave, { passive: true });
    }

    // 清理函数
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      
      if (enableMobile) {
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleMouseLeave);
      }

      // 清理防抖定时器
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [handleMouseMove, handleTouchMove, handleMouseLeave, enableMobile, isSupported]);

  /**
   * 手动重置位置
   */
  const resetPosition = useCallback(() => {
    setMousePosition({
      x: 0,
      y: 0,
      isActive: false
    });
  }, []);

  /**
   * 暂停/恢复追踪
   */
  const toggleTracking = useCallback((enabled: boolean) => {
    setMousePosition(prev => ({
      ...prev,
      isActive: enabled ? prev.isActive : false
    }));
  }, []);

  return {
    mousePosition,
    isSupported,
    resetPosition,
    toggleTracking
  };
};

/**
 * 简化版鼠标追踪Hook（仅返回位置）
 */
export const useSimpleMouseTracker = (targetRef?: React.RefObject<HTMLElement>) => {
  const { mousePosition } = useMouseTracker({ targetRef });
  return mousePosition;
};
