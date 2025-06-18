import { useEffect, useState } from 'react';
import { useBackground } from '../context/BackgroundContext';

/**
 * 智能毛玻璃效果Hook
 * 根据背景图片状态自动调整毛玻璃类名
 */
export const useGlassEffect = (baseClass: string) => {
  const { state } = useBackground();
  const [glassClass, setGlassClass] = useState(baseClass);

  useEffect(() => {
    if (state.enabled && state.isImageLoaded) {
      // 背景图片激活时使用适配版本
      switch (baseClass) {
        case 'glass-card':
          setGlassClass('glass-layer-2-bg');
          break;
        case 'glass-layer-1':
          setGlassClass('glass-layer-1-bg');
          break;
        case 'glass-layer-2':
          setGlassClass('glass-layer-2-bg');
          break;
        case 'glass-layer-3':
          setGlassClass('glass-layer-3-bg');
          break;
        case 'nav-glass':
          setGlassClass('nav-glass'); // 导航栏在背景图片时保持原样，CSS会自动适配
          break;
        case 'nav-glass-transparent':
          setGlassClass('nav-glass-transparent'); // 透明导航栏保持原样
          break;
        case 'tag-enhanced':
          setGlassClass('tag-enhanced'); // 标签在背景图片时保持原样，CSS会自动适配
          break;
        case 'glass-toast':
          setGlassClass('glass-toast'); // Toast在背景图片时保持原样，CSS会自动适配
          break;
        case 'glass-background-mobile':
          setGlassClass('glass-background-mobile'); // 移动端背景遮罩保持原样
          break;
        case 'glass-background-desktop':
          setGlassClass('glass-background-desktop'); // 桌面端背景遮罩保持原样
          break;
        case 'glass-dropdown':
          setGlassClass('glass-dropdown'); // 下拉菜单保持原样，CSS会自动适配
          break;
        default:
          setGlassClass(baseClass);
      }
    } else {
      // 无背景图片时使用标准版本
      setGlassClass(baseClass);
    }
  }, [state.enabled, state.isImageLoaded, baseClass]);

  return glassClass;
};

/**
 * 毛玻璃层级常量
 */
export const GLASS_LAYERS = {
  LIGHT: 'glass-layer-1',      // 轻量级：90% 透明度，12px 模糊
  MEDIUM: 'glass-layer-2',     // 中等级：85% 透明度，16px 模糊
  STRONG: 'glass-layer-3',     // 强化级：80% 透明度，20px 模糊
  CARD: 'glass-card',          // 卡片：85% 透明度，16px 模糊
  NAV: 'nav-glass',            // 导航：80% 透明度，20px 模糊
  TAG: 'tag-enhanced'          // 标签：90% 透明度，12px 模糊
} as const;

/**
 * 获取推荐的毛玻璃层级
 */
export const getRecommendedGlassLayer = (elementType: 'card' | 'nav' | 'tag' | 'modal' | 'sidebar' | 'button') => {
  switch (elementType) {
    case 'card':
      return GLASS_LAYERS.CARD;
    case 'nav':
      return GLASS_LAYERS.NAV;
    case 'tag':
      return GLASS_LAYERS.TAG;
    case 'modal':
      return GLASS_LAYERS.STRONG;
    case 'sidebar':
      return GLASS_LAYERS.MEDIUM;
    case 'button':
      return GLASS_LAYERS.LIGHT;
    default:
      return GLASS_LAYERS.MEDIUM;
  }
};

/**
 * 性能优化的毛玻璃效果Hook
 * 包含移动端优化和性能监控
 */
export const useOptimizedGlassEffect = (baseClass: string, options?: {
  enableMobileOptimization?: boolean;
  enablePerformanceOptimization?: boolean;
}) => {
  const { state } = useBackground();
  const [glassClass, setGlassClass] = useState(baseClass);
  const { enableMobileOptimization = true, enablePerformanceOptimization = true } = options || {};

  useEffect(() => {
    let finalClass = baseClass;

    // 背景状态适配
    if (state.enabled && state.isImageLoaded) {
      switch (baseClass) {
        case 'glass-card':
          finalClass = 'glass-layer-2-bg';
          break;
        case 'glass-layer-1':
          finalClass = 'glass-layer-1-bg';
          break;
        case 'glass-layer-2':
          finalClass = 'glass-layer-2-bg';
          break;
        case 'glass-layer-3':
          finalClass = 'glass-layer-3-bg';
          break;
        default:
          finalClass = baseClass;
      }
    }

    // 性能优化
    if (enablePerformanceOptimization) {
      finalClass += ' glass-optimized';
    }

    // 移动端优化
    if (enableMobileOptimization && window.innerWidth <= 768 && window.devicePixelRatio <= 1.5) {
      finalClass += ' glass-mobile-optimized';
    }

    setGlassClass(finalClass);
  }, [state.enabled, state.isImageLoaded, baseClass, enableMobileOptimization, enablePerformanceOptimization]);

  return glassClass;
};
