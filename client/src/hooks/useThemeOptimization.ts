import { useState, useEffect, useMemo } from 'react';
import { getCurrentColorMode } from '../utils/darkModeUtils';

/**
 * 主题信息接口
 */
export interface ThemeInfo {
  /** 当前颜色模式 */
  colorMode: 'light' | 'dark';
  /** 是否为深色模式 */
  isDark: boolean;
  /** 是否为浅色模式 */
  isLight: boolean;
  /** 主题色 */
  themeColor: string;
  /** 主题色RGB值 */
  themeColorRGB: string;
}

/**
 * 动画主题配置接口
 */
export interface AnimationThemeConfig {
  /** 眼睛颜色配置 */
  eyeColors: {
    socket: string;
    eyeball: string;
    pupil: string;
    highlight: string;
  };
  /** 机器人颜色配置 */
  robotColors: {
    head: string;
    border: string;
    shadow: string;
    accent: string;
  };
  /** 文本颜色配置 */
  textColors: {
    primary: string;
    secondary: string;
    theme: string;
    error: string;
  };
  /** 背景颜色配置 */
  backgroundColors: {
    primary: string;
    secondary: string;
    overlay: string;
    glass: string;
  };
}

/**
 * 主题优化Hook
 * 
 * 功能特点：
 * - 实时监听主题变化
 * - 提供优化的颜色配置
 * - 支持动画组件的主题适配
 * - 集成项目现有的主题系统
 * 
 * @returns 主题信息和配置
 */
export const useThemeOptimization = () => {
  const [themeInfo, setThemeInfo] = useState<ThemeInfo>({
    colorMode: 'light',
    isDark: false,
    isLight: true,
    themeColor: '#007AFF',
    themeColorRGB: '0, 122, 255'
  });

  /**
   * 更新主题信息
   */
  const updateThemeInfo = () => {
    const colorMode = getCurrentColorMode();
    const isDark = colorMode === 'dark';
    const isLight = colorMode === 'light';

    // 获取CSS变量中的主题色
    const themeColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--primary')
      .trim() || '#007AFF';

    const themeColorRGB = getComputedStyle(document.documentElement)
      .getPropertyValue('--theme-rgb')
      .trim() || '0, 122, 255';

    setThemeInfo({
      colorMode,
      isDark,
      isLight,
      themeColor,
      themeColorRGB
    });
  };

  /**
   * 监听主题变化
   */
  useEffect(() => {
    // 初始化
    updateThemeInfo();

    // 监听主题变化事件
    const handleThemeChange = () => {
      updateThemeInfo();
    };

    window.addEventListener('colorSchemeChange', handleThemeChange);

    // 监听DOM属性变化（备用方案）
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === 'attributes' &&
          (mutation.attributeName === 'data-color-mode' || mutation.attributeName === 'class')
        ) {
          updateThemeInfo();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-color-mode', 'class']
    });

    return () => {
      window.removeEventListener('colorSchemeChange', handleThemeChange);
      observer.disconnect();
    };
  }, []);

  /**
   * 动画主题配置
   */
  const animationThemeConfig = useMemo((): AnimationThemeConfig => {
    const { isDark } = themeInfo;

    return {
      eyeColors: {
        socket: isDark
          ? 'border-gray-600 bg-gray-800'
          : 'border-gray-300 bg-white',
        eyeball: 'bg-theme',
        pupil: isDark
          ? 'bg-white'
          : 'bg-gray-900',
        highlight: isDark
          ? 'bg-gray-200'
          : 'bg-white'
      },
      robotColors: {
        head: isDark
          ? 'bg-gradient-to-br from-gray-700 to-gray-800'
          : 'bg-gradient-to-br from-gray-100 to-gray-200',
        border: isDark
          ? 'border-gray-600'
          : 'border-gray-300',
        shadow: isDark
          ? 'shadow-black/20'
          : 'shadow-gray-400/20',
        accent: 'bg-theme'
      },
      textColors: {
        primary: isDark
          ? 'text-gray-100'
          : 'text-gray-900',
        secondary: isDark
          ? 'text-gray-400'
          : 'text-gray-600',
        theme: 'text-theme',
        error: isDark
          ? 'text-red-400'
          : 'text-red-500'
      },
      backgroundColors: {
        primary: isDark
          ? 'bg-gray-900'
          : 'bg-white',
        secondary: isDark
          ? 'bg-gray-800'
          : 'bg-gray-50',
        overlay: isDark
          ? 'bg-black/50'
          : 'bg-white/50',
        glass: isDark
          ? 'bg-gray-900/80 backdrop-blur-md'
          : 'bg-white/80 backdrop-blur-md'
      }
    };
  }, [themeInfo]);

  /**
   * 获取主题优化的CSS类名
   */
  const getThemeClasses = (type: 'eye' | 'robot' | 'text' | 'background', variant?: string) => {
    const config = animationThemeConfig;

    switch (type) {
      case 'eye':
        return config.eyeColors[variant as keyof typeof config.eyeColors] || '';
      case 'robot':
        return config.robotColors[variant as keyof typeof config.robotColors] || '';
      case 'text':
        return config.textColors[variant as keyof typeof config.textColors] || '';
      case 'background':
        return config.backgroundColors[variant as keyof typeof config.backgroundColors] || '';
      default:
        return '';
    }
  };

  /**
   * 获取主题优化的内联样式
   */
  const getThemeStyles = (type: 'shadow' | 'gradient' | 'border') => {
    const { isDark, themeColor, themeColorRGB } = themeInfo;

    switch (type) {
      case 'shadow':
        return {
          boxShadow: isDark
            ? `0 10px 30px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)`
            : `0 10px 30px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.5)`
        };
      case 'gradient':
        return {
          background: isDark
            ? `linear-gradient(145deg, #2a2a2a, #1a1a1a)`
            : `linear-gradient(145deg, #f0f0f0, #e0e0e0)`
        };
      case 'border':
        return {
          borderColor: `rgba(${themeColorRGB}, ${isDark ? 0.4 : 0.3})`
        };
      default:
        return {};
    }
  };

  /**
   * 检查是否需要高对比度
   */
  const needsHighContrast = () => {
    return window.matchMedia('(prefers-contrast: high)').matches;
  };

  /**
   * 获取可访问性优化的颜色
   */
  const getAccessibleColors = () => {
    const { isDark } = themeInfo;
    const highContrast = needsHighContrast();

    if (highContrast) {
      return {
        text: isDark ? '#FFFFFF' : '#000000',
        background: isDark ? '#000000' : '#FFFFFF',
        border: isDark ? '#FFFFFF' : '#000000'
      };
    }

    return animationThemeConfig;
  };

  return {
    themeInfo,
    animationThemeConfig,
    getThemeClasses,
    getThemeStyles,
    needsHighContrast,
    getAccessibleColors,
    updateThemeInfo
  };
};

/**
 * 简化版主题Hook
 * 仅返回基本的主题信息
 */
export const useSimpleTheme = () => {
  const { themeInfo } = useThemeOptimization();
  return {
    isDark: themeInfo.isDark,
    isLight: themeInfo.isLight,
    colorMode: themeInfo.colorMode,
    themeColor: themeInfo.themeColor
  };
};

/**
 * 404页面专用主题Hook
 * 提供404页面动画组件的优化配置
 */
export const use404Theme = () => {
  const { themeInfo, animationThemeConfig, getThemeClasses, getThemeStyles } = useThemeOptimization();

  const config404 = useMemo(() => ({
    robot: {
      size: themeInfo.isDark ? 180 : 200, // 深色模式稍小
      colors: {
        head: getThemeClasses('robot', 'head'),
        border: getThemeClasses('robot', 'border'),
        accent: getThemeClasses('robot', 'accent')
      },
      styles: getThemeStyles('shadow')
    },
    eyes: {
      size: themeInfo.isDark ? 45 : 50,
      colors: {
        socket: getThemeClasses('eye', 'socket'),
        eyeball: getThemeClasses('eye', 'eyeball'),
        pupil: getThemeClasses('eye', 'pupil'),
        highlight: getThemeClasses('eye', 'highlight')
      }
    },
    text: {
      primary: getThemeClasses('text', 'primary'),
      theme: getThemeClasses('text', 'theme'),
      secondary: getThemeClasses('text', 'secondary')
    },
    background: {
      primary: getThemeClasses('background', 'primary'),
      glass: getThemeClasses('background', 'glass')
    }
  }), [themeInfo, animationThemeConfig, getThemeClasses, getThemeStyles]);

  return {
    ...themeInfo,
    config404
  };
};

export default useThemeOptimization;
