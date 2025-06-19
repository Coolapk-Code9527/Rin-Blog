import React, { useRef, useEffect, useState } from 'react';
import { AnimatedEye, EyePair } from './AnimatedEye';
import { useMouseTracker } from '../hooks/useMouseTracker';

/**
 * 机器人动画组件属性接口
 */
export interface AnimatedRobotProps {
  /** 机器人大小（像素） */
  size?: number;
  /** 自定义CSS类名 */
  className?: string;
  /** 是否启用调试模式 */
  debug?: boolean;
  /** 颜色主题 */
  colorTheme?: 'default' | 'theme' | 'custom';
  /** 自定义颜色配置 */
  customColors?: {
    head?: string;
    eyes?: string;
    accent?: string;
  };
  /** 是否启用入场动画 */
  enableEnterAnimation?: boolean;
  /** 动画延迟时间（毫秒） */
  animationDelay?: number;
}

/**
 * 设备检测Hook
 */
const useDeviceDetection = () => {
  const [deviceInfo, setDeviceInfo] = useState({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    hasTouch: false,
    isLowPerformance: false
  });

  useEffect(() => {
    const checkDevice = () => {
      const userAgent = navigator.userAgent;
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      const isTablet = /iPad|Android(?=.*Tablet)|Tablet/i.test(userAgent);
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      // 简单的性能检测
      const isLowPerformance = 
        navigator.hardwareConcurrency < 4 || 
        window.innerWidth < 768 ||
        /Android.*Chrome\/[1-5][0-9]/i.test(userAgent);

      setDeviceInfo({
        isMobile: isMobile && !isTablet,
        isTablet,
        isDesktop: !isMobile,
        hasTouch,
        isLowPerformance
      });
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  return deviceInfo;
};

/**
 * 动画机器人组件
 * 
 * 功能特点：
 * - 整合双眼动画效果
 * - macOS设计风格的机器人头像
 * - 响应式设计和设备适配
 * - 性能优化和动画降级
 * - 深色模式支持
 * - 入场动画效果
 * 
 * @param props 组件属性
 * @returns 机器人组件JSX
 */
export const AnimatedRobot = ({
  size = 200,
  className = '',
  debug = false,
  colorTheme = 'default',
  customColors = {},
  enableEnterAnimation = true,
  animationDelay = 0
}) => {
  const robotRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(!enableEnterAnimation);
  const deviceInfo = useDeviceDetection();

  // 使用鼠标追踪（仅桌面端）
  const { mousePosition, isSupported } = useMouseTracker({
    targetRef: robotRef,
    enableOptimization: true,
    enableMobile: false // 机器人组件禁用移动端鼠标追踪
  });

  /**
   * 获取颜色配置
   */
  const getColors = () => {
    const defaultColors = {
      head: 'bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800',
      border: 'border-gray-300 dark:border-gray-600',
      shadow: 'shadow-lg',
      accent: 'bg-theme'
    };

    const themeColors = {
      head: 'bg-gradient-to-br from-theme/10 to-theme/20 dark:from-theme/20 dark:to-theme/30',
      border: 'border-theme/30 dark:border-theme/40',
      shadow: 'shadow-theme/20',
      accent: 'bg-theme'
    };

    switch (colorTheme) {
      case 'theme':
        return { ...themeColors, ...customColors };
      case 'custom':
        return { ...defaultColors, ...customColors };
      default:
        return { ...defaultColors, ...customColors };
    }
  };

  const colors = getColors();

  /**
   * 计算响应式尺寸
   */
  const getResponsiveSize = () => {
    if (deviceInfo.isMobile) {
      return Math.min(size * 0.8, 160);
    }
    if (deviceInfo.isTablet) {
      return Math.min(size * 0.9, 180);
    }
    return size;
  };

  const responsiveSize = getResponsiveSize();
  const eyeSize = responsiveSize * 0.35; // 增大眼睛尺寸，从0.25增加到0.35
  const eyeSpacing = responsiveSize * 0.18; // 相应增加眼睛间距

  /**
   * 入场动画控制
   */
  useEffect(() => {
    if (enableEnterAnimation) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, animationDelay);
      return () => clearTimeout(timer);
    }
  }, [enableEnterAnimation, animationDelay]);

  /**
   * 调试信息（仅在开发环境且启用调试时显示）
   */
  useEffect(() => {
    if (debug && process.env.NODE_ENV === 'development') {
      console.log('AnimatedRobot Debug:', {
        deviceInfo,
        mousePosition,
        isSupported,
        responsiveSize,
        eyeSize,
        colors
      });
    }
  }, [debug, deviceInfo, mousePosition, isSupported, responsiveSize, eyeSize, colors]);

  /**
   * 获取动画类名
   */
  const getAnimationClasses = () => {
    const baseClasses = 'transition-all duration-300 ease-out';
    const enterClasses = isVisible ? 'robot-enter' : 'opacity-0 scale-75';
    const hoverClasses = deviceInfo.isDesktop ? 'hover:scale-105' : '';
    
    return `${baseClasses} ${enterClasses} ${hoverClasses}`;
  };

  /**
   * 降级处理：低性能设备显示静态版本
   */
  if (deviceInfo.isLowPerformance && !debug) {
    return (
      <div
        ref={robotRef}
        className={`relative inline-block ${className}`}
        style={{ width: responsiveSize, height: responsiveSize }}
        role="img"
        aria-label="机器人头像"
      >
        <div
          className={`w-full h-full rounded-3xl ${colors.head} ${colors.border} ${colors.shadow} border-2 flex items-center justify-center page-slide-in`}
        >
          {/* 静态眼睛 */}
          <div className="flex items-center justify-center" style={{ gap: eyeSpacing }}>
            <div
              className={`rounded-full border-2 ${colors.border} bg-white dark:bg-gray-800 flex items-center justify-center`}
              style={{ width: eyeSize, height: eyeSize }}
            >
              <div
                className={`rounded-full ${colors.accent}`}
                style={{ width: eyeSize * 0.6, height: eyeSize * 0.6 }}
              />
            </div>
            <div
              className={`rounded-full border-2 ${colors.border} bg-white dark:bg-gray-800 flex items-center justify-center`}
              style={{ width: eyeSize, height: eyeSize }}
            >
              <div
                className={`rounded-full ${colors.accent}`}
                style={{ width: eyeSize * 0.6, height: eyeSize * 0.6 }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={robotRef}
      className={`relative inline-block ${className}`}
      style={{ width: responsiveSize, height: responsiveSize }}
      role="img"
      aria-label="动画机器人头像"
    >
      {/* 机器人头部 - 透明背景，只显示眼睛 */}
      <div
        className={`w-full h-full flex items-center justify-center ${getAnimationClasses()}`}
      >
        {/* 眼睛对 */}
        <EyePair
          size={eyeSize}
          spacing={eyeSpacing}
          colorTheme={colorTheme}
          customColors={customColors}
          animationOptions={{
            maxDistance: eyeSize * 0.2,
            enableBlink: true,
            blinkInterval: deviceInfo.isMobile ? 2000 : 3000,
            enableMobileOptimization: true
          }}
          containerClassName="z-10"
        />




      </div>

      {/* 调试信息覆盖层 */}
      {debug && (
        <div className="absolute -bottom-16 left-0 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap space-y-1">
          <div>Size: {responsiveSize}px</div>
          <div>Device: {deviceInfo.isMobile ? 'Mobile' : deviceInfo.isTablet ? 'Tablet' : 'Desktop'}</div>
          <div>Performance: {deviceInfo.isLowPerformance ? 'Low' : 'Normal'}</div>
          <div>Mouse: ({mousePosition.x.toFixed(1)}, {mousePosition.y.toFixed(1)})</div>
        </div>
      )}
    </div>
  );
};

export default AnimatedRobot;
