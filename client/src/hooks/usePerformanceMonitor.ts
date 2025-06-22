import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * 性能指标接口
 */
export interface PerformanceMetrics {
  /** 帧率 (FPS) */
  fps: number;
  /** 平均帧率 */
  avgFps: number;
  /** 内存使用情况 */
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  /** 动画性能等级 */
  performanceLevel: 'high' | 'medium' | 'low';
  /** 是否建议降级 */
  shouldDegrade: boolean;
}

/**
 * 性能监控配置接口
 */
export interface PerformanceMonitorConfig {
  /** 是否启用监控 */
  enabled?: boolean;
  /** 监控间隔（毫秒） */
  interval?: number;
  /** FPS阈值配置 */
  fpsThresholds?: {
    high: number;
    medium: number;
    low: number;
  };
  /** 内存使用阈值（百分比） */
  memoryThreshold?: number;
  /** 性能回调函数 */
  onPerformanceChange?: (metrics: PerformanceMetrics) => void;
}

/**
 * 性能监控Hook
 * 
 * 功能特点：
 * - 实时监控FPS和内存使用
 * - 自动性能等级评估
 * - 动画降级建议
 * - 性能数据统计
 * - 开发环境性能调试
 * 
 * @param config 监控配置
 * @returns 性能指标和控制方法
 */
export const usePerformanceMonitor = (config: PerformanceMonitorConfig = {}) => {
  const {
    enabled = true,
    interval = 1000,
    fpsThresholds = { high: 55, medium: 30, low: 15 },
    memoryThreshold = 80,
    onPerformanceChange
  } = config;

  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    avgFps: 60,
    memory: { used: 0, total: 0, percentage: 0 },
    performanceLevel: 'high',
    shouldDegrade: false
  });

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const fpsHistoryRef = useRef<number[]>([]);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined);

  /**
   * 计算FPS
   */
  const calculateFPS = useCallback(() => {
    const now = performance.now();
    const delta = now - lastTimeRef.current;
    
    if (delta >= 1000) {
      const fps = Math.round((frameCountRef.current * 1000) / delta);
      
      // 更新FPS历史
      fpsHistoryRef.current.push(fps);
      if (fpsHistoryRef.current.length > 10) {
        fpsHistoryRef.current.shift();
      }
      
      // 计算平均FPS
      const avgFps = Math.round(
        fpsHistoryRef.current.reduce((sum, f) => sum + f, 0) / fpsHistoryRef.current.length
      );
      
      frameCountRef.current = 0;
      lastTimeRef.current = now;
      
      return { fps, avgFps };
    }
    
    return null;
  }, []);

  /**
   * 获取内存使用情况
   */
  const getMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const used = Math.round(memory.usedJSHeapSize / 1024 / 1024); // MB
      const total = Math.round(memory.totalJSHeapSize / 1024 / 1024); // MB
      const percentage = Math.round((used / total) * 100);
      
      return { used, total, percentage };
    }
    
    return { used: 0, total: 0, percentage: 0 };
  }, []);

  /**
   * 评估性能等级
   */
  const evaluatePerformanceLevel = useCallback((fps: number, memoryPercentage: number) => {
    let level: PerformanceMetrics['performanceLevel'] = 'high';
    let shouldDegrade = false;

    if (fps < fpsThresholds.low || memoryPercentage > memoryThreshold) {
      level = 'low';
      shouldDegrade = true;
    } else if (fps < fpsThresholds.medium || memoryPercentage > memoryThreshold * 0.7) {
      level = 'medium';
      shouldDegrade = false;
    } else if (fps >= fpsThresholds.high && memoryPercentage < memoryThreshold * 0.5) {
      level = 'high';
      shouldDegrade = false;
    }

    return { level, shouldDegrade };
  }, [fpsThresholds, memoryThreshold]);

  /**
   * 帧计数器
   */
  const frameCounter = useCallback(() => {
    frameCountRef.current++;
    
    const fpsData = calculateFPS();
    if (fpsData) {
      const memory = getMemoryUsage();
      const { level, shouldDegrade } = evaluatePerformanceLevel(fpsData.avgFps, memory.percentage);
      
      const newMetrics: PerformanceMetrics = {
        fps: fpsData.fps,
        avgFps: fpsData.avgFps,
        memory,
        performanceLevel: level,
        shouldDegrade
      };
      
      setMetrics(newMetrics);
      onPerformanceChange?.(newMetrics);
    }
    
    if (enabled) {
      animationFrameRef.current = requestAnimationFrame(frameCounter);
    }
  }, [enabled, calculateFPS, getMemoryUsage, evaluatePerformanceLevel, onPerformanceChange]);

  /**
   * 开始监控
   */
  const startMonitoring = useCallback(() => {
    if (!enabled) return;
    
    // 启动帧计数器
    animationFrameRef.current = requestAnimationFrame(frameCounter);
    
    // 定期更新内存信息
    intervalRef.current = setInterval(() => {
      const memory = getMemoryUsage();
      setMetrics(prev => ({
        ...prev,
        memory
      }));
    }, interval);
  }, [enabled, frameCounter, getMemoryUsage, interval]);

  /**
   * 停止监控
   */
  const stopMonitoring = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  }, []);

  /**
   * 重置统计数据
   */
  const resetMetrics = useCallback(() => {
    frameCountRef.current = 0;
    lastTimeRef.current = performance.now();
    fpsHistoryRef.current = [];
    setMetrics({
      fps: 60,
      avgFps: 60,
      memory: { used: 0, total: 0, percentage: 0 },
      performanceLevel: 'high',
      shouldDegrade: false
    });
  }, []);

  /**
   * 获取性能建议
   */
  const getPerformanceAdvice = useCallback(() => {
    const { performanceLevel, fps, memory } = metrics;
    const advice: string[] = [];

    if (performanceLevel === 'low') {
      advice.push('建议禁用复杂动画以提升性能');
      if (fps < 20) advice.push('帧率过低，建议使用静态界面');
      if (memory.percentage > 90) advice.push('内存使用过高，建议刷新页面');
    } else if (performanceLevel === 'medium') {
      advice.push('建议使用简化动画');
      if (fps < 40) advice.push('可以降低动画复杂度');
    } else {
      advice.push('性能良好，可以使用完整动画效果');
    }

    return advice;
  }, [metrics]);

  /**
   * 初始化和清理
   */
  useEffect(() => {
    if (enabled) {
      startMonitoring();
    }

    return () => {
      stopMonitoring();
    };
  }, [enabled, startMonitoring, stopMonitoring]);

  /**
   * 开发环境性能日志（仅在开发环境且启用调试时显示）
   */
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && enabled && process.env.REACT_APP_DEBUG_PERFORMANCE) {
      const logInterval = setInterval(() => {
        console.group('🔍 Performance Monitor');
        console.log('FPS:', metrics.fps, '| Avg:', metrics.avgFps);
        console.log('Memory:', `${metrics.memory.used}MB / ${metrics.memory.total}MB (${metrics.memory.percentage}%)`);
        console.log('Level:', metrics.performanceLevel);
        console.log('Should Degrade:', metrics.shouldDegrade);
        console.groupEnd();
      }, 5000);

      return () => clearInterval(logInterval);
    }
  }, [metrics, enabled]);

  return {
    metrics,
    startMonitoring,
    stopMonitoring,
    resetMetrics,
    getPerformanceAdvice,
    isMonitoring: enabled && !!animationFrameRef.current
  };
};

/**
 * 简化版性能监控Hook
 * 仅返回基本的性能状态
 */
export const useSimplePerformanceMonitor = () => {
  const { metrics } = usePerformanceMonitor({
    enabled: true,
    interval: 2000
  });

  return {
    fps: metrics.fps,
    performanceLevel: metrics.performanceLevel,
    shouldDegrade: metrics.shouldDegrade
  };
};

/**
 * 动画性能优化Hook
 * 根据性能自动调整动画配置
 */
export const useAnimationOptimization = () => {
  const { metrics } = usePerformanceMonitor();

  const getOptimizedConfig = useCallback(() => {
    const { performanceLevel, shouldDegrade } = metrics;

    return {
      enableFullAnimation: performanceLevel === 'high',
      enableSimplifiedAnimation: performanceLevel === 'medium',
      disableAnimation: shouldDegrade,
      animationDuration: performanceLevel === 'high' ? 1 : performanceLevel === 'medium' ? 0.7 : 0.3,
      maxConcurrentAnimations: performanceLevel === 'high' ? 5 : performanceLevel === 'medium' ? 3 : 1
    };
  }, [metrics]);

  return {
    ...metrics,
    optimizedConfig: getOptimizedConfig()
  };
};

export default usePerformanceMonitor;
