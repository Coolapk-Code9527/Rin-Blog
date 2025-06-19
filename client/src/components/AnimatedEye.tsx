import React, { useRef, useEffect } from 'react';
import { useMouseTracker } from '../hooks/useMouseTracker';
import { useEyeAnimation, EyeAnimationOptions } from '../hooks/useEyeAnimation';
import { useGlassEffect, GLASS_LAYERS } from '../hooks/useGlassEffect';

/**
 * 眼睛组件属性接口
 */
export interface AnimatedEyeProps {
  /** 眼睛大小（像素） */
  size?: number;
  /** 眼球大小比例 (0-1) */
  eyeballScale?: number;
  /** 自定义CSS类名 */
  className?: string;
  /** 动画配置选项 */
  animationOptions?: EyeAnimationOptions;
  /** 是否启用调试模式 */
  debug?: boolean;
  /** 眼睛颜色主题 */
  colorTheme?: 'default' | 'theme' | 'custom';
  /** 自定义颜色配置 */
  customColors?: {
    eyeSocket?: string;
    eyeball?: string;
    pupil?: string;
    highlight?: string;
  };
}

/**
 * 动画眼睛组件
 * 
 * 功能特点：
 * - 眼睛跟随鼠标移动
 * - 自动眨眼动画
 * - 支持深色模式
 * - 响应式设计
 * - macOS设计风格
 * - 性能优化
 * 
 * @param props 组件属性
 * @returns 眼睛组件JSX
 */
export const AnimatedEye = ({
  size = 60,
  eyeballScale = 0.6,
  className = '',
  animationOptions = {},
  debug = false,
  colorTheme = 'default',
  customColors = {}
}) => {
  const eyeRef = useRef<HTMLDivElement>(null);

  // 使用毛玻璃效果
  const glassClass = useGlassEffect(GLASS_LAYERS.MEDIUM);
  
  // 使用鼠标追踪Hook
  const { mousePosition, isSupported } = useMouseTracker({
    targetRef: eyeRef,
    enableOptimization: true,
    enableMobile: true
  });

  // 使用眼睛动画Hook
  const {
    animationState,
    isMobile,
    getEyeballTransform,
    getEyeContainerClasses
  } = useEyeAnimation(mousePosition, {
    maxDistance: size * 0.2, // 根据眼睛大小调整最大移动距离
    ...animationOptions
  });

  /**
   * 获取颜色配置
   */
  const getColors = () => {
    const defaultColors = {
      eyeSocket: 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800',
      eyeball: `${glassClass} border border-gray-200/60 dark:border-gray-700/60`,
      pupil: 'bg-gray-900 dark:bg-white',
      highlight: 'bg-white dark:bg-gray-200'
    };

    const themeColors = {
      eyeSocket: 'border-theme/30 bg-theme/5 dark:bg-theme/10',
      eyeball: `${glassClass} border border-theme/30 dark:border-theme/40`,
      pupil: 'bg-gray-900 dark:bg-white',
      highlight: 'bg-white dark:bg-gray-200'
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
   * 计算组件尺寸
   */
  const eyeballSize = size * eyeballScale;
  const pupilSize = eyeballSize * 0.4;
  const highlightSize = pupilSize * 0.3;

  /**
   * 调试信息显示（仅在开发环境且启用调试时显示）
   */
  useEffect(() => {
    if (debug && process.env.NODE_ENV === 'development') {
      console.log('AnimatedEye Debug:', {
        mousePosition,
        animationState,
        isSupported,
        isMobile,
        size,
        eyeballSize
      });
    }
  }, [debug, mousePosition, animationState, isSupported, isMobile, size, eyeballSize]);

  /**
   * 降级处理：不支持动画时显示静态眼睛
   */
  if (!isSupported) {
    return (
      <div
        className={`relative inline-block ${className}`}
        style={{ width: size, height: size }}
      >
        <div
          className={`w-full h-full rounded-full border-2 ${colors.eyeSocket} flex items-center justify-center`}
        >
          <div
            className={`rounded-full ${colors.eyeball} flex items-center justify-center shadow-enhanced`}
            style={{ width: eyeballSize, height: eyeballSize }}
          >
            <div
              className={`rounded-full ${colors.pupil}`}
              style={{ width: pupilSize, height: pupilSize }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={eyeRef}
      className={`relative inline-block ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label="动画眼睛"
    >
      {/* 眼眶 */}
      <div
        className={`w-full h-full rounded-full border-2 ${colors.eyeSocket} overflow-hidden relative ${getEyeContainerClasses()}`}
        style={{
          boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.1)'
        }}
      >
        {/* 眼球 */}
        <div
          className={`absolute rounded-full ${colors.eyeball} flex items-center justify-center transition-transform duration-100 ease-out shadow-enhanced`}
          style={{
            width: eyeballSize,
            height: eyeballSize,
            left: '50%',
            top: '50%',
            marginLeft: -eyeballSize / 2,
            marginTop: -eyeballSize / 2,
            transform: getEyeballTransform()
          }}
        >
          {/* 瞳孔 */}
          <div
            className={`absolute rounded-full ${colors.pupil}`}
            style={{
              width: pupilSize,
              height: pupilSize,
              boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.3)'
            }}
          >
            {/* 高光 */}
            <div
              className={`absolute rounded-full ${colors.highlight} opacity-80`}
              style={{
                width: highlightSize,
                height: highlightSize,
                top: '20%',
                left: '30%',
                boxShadow: '0 0 2px rgba(255, 255, 255, 0.5)'
              }}
            />
          </div>
        </div>

        {/* 移动端眨眼动画指示器 */}
        {isMobile && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-1 h-1 bg-theme rounded-full animate-pulse opacity-50" />
          </div>
        )}
      </div>

      {/* 调试信息覆盖层 */}
      {debug && (
        <div className="absolute -bottom-8 left-0 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
          <div>Mouse: ({mousePosition.x.toFixed(1)}, {mousePosition.y.toFixed(1)})</div>
          <div>Active: {mousePosition.isActive ? 'Yes' : 'No'}</div>
          <div>Mobile: {isMobile ? 'Yes' : 'No'}</div>
        </div>
      )}
    </div>
  );
};

/**
 * 眼睛对组件
 * 渲染一对眼睛，自动处理间距和对称性
 */
export interface EyePairProps extends Omit<AnimatedEyeProps, 'className'> {
  /** 眼睛间距（像素） */
  spacing?: number;
  /** 容器CSS类名 */
  containerClassName?: string;
  /** 单个眼睛CSS类名 */
  eyeClassName?: string;
}

export const EyePair = ({
  spacing = 20,
  containerClassName = '',
  eyeClassName = '',
  ...eyeProps
}) => {
  return (
    <div 
      className={`flex items-center justify-center ${containerClassName}`}
      style={{ gap: spacing }}
    >
      <AnimatedEye {...eyeProps} className={eyeClassName} />
      <AnimatedEye {...eyeProps} className={eyeClassName} />
    </div>
  );
};

export default AnimatedEye;
