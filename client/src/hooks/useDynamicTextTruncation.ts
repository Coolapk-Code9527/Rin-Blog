import { useEffect, useRef, useCallback } from 'react';

interface TruncationOptions {
  minLines?: number;
  maxLines?: number;
  padding?: number;
  debounceMs?: number;
}

/**
 * 动态文本截断Hook
 * 基于容器实际可用空间动态计算并应用line-clamp值
 * 解决标题换行、侧边栏开启/关闭等动态布局问题
 */
export function useDynamicTextTruncation(options: TruncationOptions = {}) {
  const {
    minLines = 1,
    maxLines = 10,
    padding = 40,
    debounceMs = 100
  } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const calculateTruncation = useCallback(() => {
    if (!containerRef.current || !summaryRef.current) return;

    const container = containerRef.current;
    const summary = summaryRef.current;

    try {
      // 找到摘要元素的父容器（flex-1的容器）
      const summaryContainer = summary.parentElement;
      if (!summaryContainer) return;

      // 新方法：直接获取摘要容器的实际高度
      // 这样可以让flex布局自然处理空间分配
      const summaryContainerHeight = summaryContainer.offsetHeight;

      // 计算摘要元素本身的padding和margin
      const summaryStyle = getComputedStyle(summary);
      const summaryContainerStyle = getComputedStyle(summaryContainer);

      const summaryPadding = parseInt(summaryStyle.paddingTop) +
                            parseInt(summaryStyle.paddingBottom);
      const summaryMargin = parseInt(summaryStyle.marginTop) +
                           parseInt(summaryStyle.marginBottom);
      const containerPadding = parseInt(summaryContainerStyle.paddingTop) +
                              parseInt(summaryContainerStyle.paddingBottom);

      // 计算摘要文本的实际可用高度
      const availableHeight = Math.max(0, summaryContainerHeight - summaryPadding - summaryMargin - containerPadding);

      // 获取行高 - 更准确的计算
      let lineHeight = parseInt(summaryStyle.lineHeight);

      // 如果lineHeight是normal或无效值，使用fontSize计算
      if (isNaN(lineHeight) || lineHeight === 0) {
        const fontSize = parseInt(summaryStyle.fontSize);
        lineHeight = Math.round(fontSize * 1.5); // leading-normal对应1.5倍行高
      }

      // 计算最大行数
      const calculatedLines = Math.floor(availableHeight / lineHeight);

      // 应用最小和最大行数限制
      let finalLines = Math.max(minLines, Math.min(maxLines, calculatedLines));

      // 额外保护：如果计算出的高度太小，确保至少显示最小行数
      if (availableHeight < lineHeight * minLines) {
        finalLines = minLines;
      }

      // 应用截断
      summary.style.webkitLineClamp = finalLines.toString();
      summary.style.display = '-webkit-box';
      summary.style.webkitBoxOrient = 'vertical';
      summary.style.overflow = 'hidden';
      summary.style.textOverflow = 'ellipsis';

      // 调试信息（开发环境）- 增强版
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Dynamic truncation (flex-aware):', {
          summaryContainerHeight,
          summaryPadding,
          summaryMargin,
          containerPadding,
          availableHeight,
          lineHeight,
          calculatedLines,
          finalLines,
          minLines,
          maxLines,
          containerElement: container.className,
          summaryElement: summary.className,
          appliedLineClamp: summary.style.webkitLineClamp
        });
      }
    } catch (error) {
      console.error('Dynamic truncation error:', error);
      // 发生错误时回退到默认行数
      if (summaryRef.current) {
        summaryRef.current.style.webkitLineClamp = Math.max(minLines, 3).toString();
      }
    }
  }, [minLines, maxLines]);

  const debouncedCalculate = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(calculateTruncation, debounceMs);
  }, [calculateTruncation, debounceMs]);

  useEffect(() => {
    if (!containerRef.current) return;

    // 检查ResizeObserver支持
    if (typeof ResizeObserver === 'undefined') {
      console.warn('ResizeObserver not supported, falling back to static truncation');
      // 设置默认截断
      if (summaryRef.current) {
        summaryRef.current.style.webkitLineClamp = Math.max(minLines, 3).toString();
        summaryRef.current.style.display = '-webkit-box';
        summaryRef.current.style.webkitBoxOrient = 'vertical';
        summaryRef.current.style.overflow = 'hidden';
        summaryRef.current.style.textOverflow = 'ellipsis';
      }
      return;
    }

    // 创建ResizeObserver
    resizeObserverRef.current = new ResizeObserver(debouncedCalculate);

    // 观察整个容器的变化
    resizeObserverRef.current.observe(containerRef.current);

    // 也观察摘要容器的变化（如果存在）
    if (summaryRef.current?.parentElement) {
      resizeObserverRef.current.observe(summaryRef.current.parentElement);
    }

    // 延迟初始计算，确保DOM完全渲染
    const initialTimer = setTimeout(() => {
      calculateTruncation();
    }, 100);

    // 额外延迟计算，处理可能的CSS动画和字体加载
    const secondaryTimer = setTimeout(() => {
      calculateTruncation();
    }, 300);

    // 监听窗口大小变化（作为额外保障）
    window.addEventListener('resize', debouncedCalculate);

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      clearTimeout(initialTimer);
      clearTimeout(secondaryTimer);
      window.removeEventListener('resize', debouncedCalculate);
    };
  }, [calculateTruncation, debouncedCalculate, minLines]);

  // 手动重新计算的方法
  const recalculate = useCallback(() => {
    calculateTruncation();
  }, [calculateTruncation]);

  return {
    containerRef,
    summaryRef,
    recalculate
  };
}
