import { useState, useEffect, useMemo } from 'react';

/**
 * 设备信息接口
 */
export interface DeviceInfo {
  /** 是否为移动设备 */
  isMobile: boolean;
  /** 是否为平板设备 */
  isTablet: boolean;
  /** 是否为桌面设备 */
  isDesktop: boolean;
  /** 是否支持触摸 */
  hasTouch: boolean;
  /** 是否为低性能设备 */
  isLowPerformance: boolean;
  /** 是否为高分辨率设备 */
  isHighDPI: boolean;
  /** 屏幕尺寸类别 */
  screenSize: 'small' | 'medium' | 'large' | 'xlarge';
  /** 网络连接类型 */
  connectionType: 'slow' | 'fast' | 'unknown';
  /** 是否偏好减少动画 */
  prefersReducedMotion: boolean;
}

/**
 * 动画优化配置接口
 */
export interface AnimationOptimization {
  /** 是否启用完整动画 */
  enableFullAnimation: boolean;
  /** 是否启用简化动画 */
  enableSimplifiedAnimation: boolean;
  /** 是否完全禁用动画 */
  disableAnimation: boolean;
  /** 动画持续时间倍数 */
  durationMultiplier: number;
  /** 是否启用GPU加速 */
  enableGPUAcceleration: boolean;
  /** 最大并发动画数量 */
  maxConcurrentAnimations: number;
}

/**
 * 设备优化Hook
 * 
 * 功能特点：
 * - 全面的设备检测
 * - 性能评估和动画优化建议
 * - 网络状况检测
 * - 用户偏好检测
 * - 响应式断点管理
 * 
 * @returns 设备信息和优化配置
 */
export const useDeviceOptimization = () => {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    hasTouch: false,
    isLowPerformance: false,
    isHighDPI: false,
    screenSize: 'large',
    connectionType: 'unknown',
    prefersReducedMotion: false
  });

  const [performanceMetrics, setPerformanceMetrics] = useState({
    memoryUsage: 0,
    cpuCores: 4,
    deviceMemory: 4,
    connectionSpeed: 'unknown'
  });

  /**
   * 检测设备类型和基本信息
   */
  const detectDevice = () => {
    const userAgent = navigator.userAgent;
    const width = window.innerWidth;
    const height = window.innerHeight;

    // 设备类型检测
    const isMobile = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) && width < 768;
    const isTablet = /iPad|Android(?=.*Tablet)|Tablet/i.test(userAgent) || (width >= 768 && width < 1024);
    const isDesktop = !isMobile && !isTablet;

    // 触摸支持检测
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // 高分辨率检测
    const isHighDPI = window.devicePixelRatio > 1.5;

    // 屏幕尺寸分类
    let screenSize: DeviceInfo['screenSize'] = 'medium';
    if (width < 640) screenSize = 'small';
    else if (width < 1024) screenSize = 'medium';
    else if (width < 1536) screenSize = 'large';
    else screenSize = 'xlarge';

    // 用户偏好检测
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    return {
      isMobile,
      isTablet,
      isDesktop,
      hasTouch,
      isHighDPI,
      screenSize,
      prefersReducedMotion
    };
  };

  /**
   * 检测设备性能
   */
  const detectPerformance = () => {
    // CPU核心数检测
    const cpuCores = navigator.hardwareConcurrency || 4;

    // 内存检测（如果支持）
    const deviceMemory = (navigator as any).deviceMemory || 4;

    // 简单的性能评估
    const isLowPerformance = 
      cpuCores < 4 || 
      deviceMemory < 4 || 
      window.innerWidth < 768 ||
      /Android.*Chrome\/[1-5][0-9]/i.test(navigator.userAgent) ||
      /iPhone.*OS [1-9]_/i.test(navigator.userAgent);

    return {
      cpuCores,
      deviceMemory,
      isLowPerformance
    };
  };

  /**
   * 检测网络连接
   */
  const detectConnection = (): DeviceInfo['connectionType'] => {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    
    if (!connection) return 'unknown';

    const effectiveType = connection.effectiveType;
    const downlink = connection.downlink;

    if (effectiveType === 'slow-2g' || effectiveType === '2g' || downlink < 1) {
      return 'slow';
    }
    
    if (effectiveType === '4g' || downlink > 5) {
      return 'fast';
    }

    return 'unknown';
  };

  /**
   * 更新设备信息
   */
  const updateDeviceInfo = () => {
    const basicInfo = detectDevice();
    const performanceInfo = detectPerformance();
    const connectionType = detectConnection();

    setDeviceInfo(prev => ({
      ...prev,
      ...basicInfo,
      isLowPerformance: performanceInfo.isLowPerformance,
      connectionType
    }));

    setPerformanceMetrics(prev => ({
      ...prev,
      cpuCores: performanceInfo.cpuCores,
      deviceMemory: performanceInfo.deviceMemory
    }));
  };

  /**
   * 计算动画优化配置
   */
  const animationOptimization = useMemo((): AnimationOptimization => {
    const {
      isLowPerformance,
      prefersReducedMotion,
      isMobile,
      connectionType
    } = deviceInfo;

    // 完全禁用动画的条件
    if (prefersReducedMotion) {
      return {
        enableFullAnimation: false,
        enableSimplifiedAnimation: false,
        disableAnimation: true,
        durationMultiplier: 0,
        enableGPUAcceleration: false,
        maxConcurrentAnimations: 0
      };
    }

    // 低性能设备优化
    if (isLowPerformance || connectionType === 'slow') {
      return {
        enableFullAnimation: false,
        enableSimplifiedAnimation: true,
        disableAnimation: false,
        durationMultiplier: 0.5,
        enableGPUAcceleration: true,
        maxConcurrentAnimations: 2
      };
    }

    // 移动设备优化
    if (isMobile) {
      return {
        enableFullAnimation: true,
        enableSimplifiedAnimation: false,
        disableAnimation: false,
        durationMultiplier: 0.8,
        enableGPUAcceleration: true,
        maxConcurrentAnimations: 3
      };
    }

    // 桌面设备完整体验
    return {
      enableFullAnimation: true,
      enableSimplifiedAnimation: false,
      disableAnimation: false,
      durationMultiplier: 1,
      enableGPUAcceleration: true,
      maxConcurrentAnimations: 5
    };
  }, [deviceInfo]);

  /**
   * 获取响应式断点
   */
  const breakpoints = useMemo(() => ({
    sm: deviceInfo.screenSize === 'small',
    md: deviceInfo.screenSize === 'medium',
    lg: deviceInfo.screenSize === 'large',
    xl: deviceInfo.screenSize === 'xlarge',
    mobile: deviceInfo.isMobile,
    tablet: deviceInfo.isTablet,
    desktop: deviceInfo.isDesktop
  }), [deviceInfo]);

  /**
   * 获取优化建议
   */
  const getOptimizationSuggestions = () => {
    const suggestions: string[] = [];

    if (deviceInfo.isLowPerformance) {
      suggestions.push('使用简化动画以提升性能');
    }

    if (deviceInfo.connectionType === 'slow') {
      suggestions.push('减少网络请求和资源加载');
    }

    if (deviceInfo.isMobile) {
      suggestions.push('优化触摸交互和移动端体验');
    }

    if (deviceInfo.prefersReducedMotion) {
      suggestions.push('用户偏好减少动画，建议禁用动效');
    }

    return suggestions;
  };

  /**
   * 初始化和事件监听
   */
  useEffect(() => {
    updateDeviceInfo();

    // 监听窗口大小变化
    const handleResize = () => {
      updateDeviceInfo();
    };

    // 监听网络状态变化
    const handleConnectionChange = () => {
      updateDeviceInfo();
    };

    window.addEventListener('resize', handleResize);
    
    // 网络状态监听（如果支持）
    const connection = (navigator as any).connection;
    if (connection) {
      connection.addEventListener('change', handleConnectionChange);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (connection) {
        connection.removeEventListener('change', handleConnectionChange);
      }
    };
  }, []);

  return {
    deviceInfo,
    performanceMetrics,
    animationOptimization,
    breakpoints,
    getOptimizationSuggestions,
    updateDeviceInfo
  };
};

/**
 * 简化版设备检测Hook
 * 仅返回基本的设备信息
 */
export const useSimpleDeviceDetection = () => {
  const { deviceInfo, breakpoints } = useDeviceOptimization();
  
  return {
    isMobile: deviceInfo.isMobile,
    isTablet: deviceInfo.isTablet,
    isDesktop: deviceInfo.isDesktop,
    isLowPerformance: deviceInfo.isLowPerformance,
    prefersReducedMotion: deviceInfo.prefersReducedMotion,
    ...breakpoints
  };
};

export default useDeviceOptimization;
