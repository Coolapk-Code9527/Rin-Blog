/**
 * 统一容器高度配置系统
 * 
 * 提供全局的容器高度管理配置，确保所有页面使用统一的高度标准
 */

/**
 * 容器高度配置常量
 */
export const CONTAINER_HEIGHT_CONFIG = {
  // 基础高度配置
  DESKTOP: {
    HEIGHT: 'calc(100vh - 200px)',
    MIN_HEIGHT: '400px',
    MAX_HEIGHT: 'calc(100vh - 150px)',
    OFFSET: 200,
    MIN_OFFSET: 150
  },
  
  MOBILE: {
    HEIGHT: 'calc(100vh - 180px)',
    MIN_HEIGHT: '350px',
    MAX_HEIGHT: 'calc(100vh - 130px)',
    OFFSET: 180,
    MIN_OFFSET: 130
  },
  
  TABLET: {
    HEIGHT: 'calc(100vh - 190px)',
    MIN_HEIGHT: '375px',
    MAX_HEIGHT: 'calc(100vh - 140px)',
    OFFSET: 190,
    MIN_OFFSET: 140
  },
  
  LARGE_SCREEN: {
    HEIGHT: 'calc(100vh - 220px)',
    MIN_HEIGHT: '450px',
    MAX_HEIGHT: 'calc(100vh - 170px)',
    OFFSET: 220,
    MIN_OFFSET: 170
  },
  
  // 特殊用途高度
  COMPACT: {
    HEIGHT: '400px',
    MIN_HEIGHT: '300px',
    MAX_HEIGHT: '500px'
  },
  
  FULL: {
    HEIGHT: '100vh',
    MIN_HEIGHT: '100vh',
    MAX_HEIGHT: '100vh'
  }
} as const;

/**
 * 响应式断点配置
 */
export const BREAKPOINTS = {
  MOBILE: 640,
  TABLET: 768,
  DESKTOP: 1024,
  LARGE: 1280,
  XLARGE: 1536
} as const;

/**
 * 页面类型与容器高度的映射
 */
export const PAGE_CONTAINER_MAPPING = {
  // 固定高度页面（需要内部滚动）
  TIMELINE: 'responsive',
  HASHTAGS: 'responsive',
  FILES: 'responsive',
  SEARCH: 'responsive',
  
  // 动态高度页面（内容自适应）
  ARTICLE: 'auto',
  HOME: 'auto',
  
  // 工具页面（视口相对高度）
  WRITING: 'responsive',
  SETTINGS: 'responsive'
} as const;

/**
 * 获取当前屏幕尺寸对应的容器配置
 */
export function getContainerConfig(width?: number) {
  const screenWidth = width || (typeof window !== 'undefined' ? window.innerWidth : 1024);
  
  if (screenWidth < BREAKPOINTS.MOBILE) {
    return CONTAINER_HEIGHT_CONFIG.MOBILE;
  } else if (screenWidth < BREAKPOINTS.TABLET) {
    return CONTAINER_HEIGHT_CONFIG.MOBILE;
  } else if (screenWidth < BREAKPOINTS.DESKTOP) {
    return CONTAINER_HEIGHT_CONFIG.TABLET;
  } else if (screenWidth < BREAKPOINTS.LARGE) {
    return CONTAINER_HEIGHT_CONFIG.DESKTOP;
  } else {
    return CONTAINER_HEIGHT_CONFIG.LARGE_SCREEN;
  }
}

/**
 * 计算容器的实际像素高度
 */
export function calculateContainerHeight(
  type: 'desktop' | 'mobile' | 'tablet' | 'large' | 'compact' | 'full' = 'desktop'
): number {
  if (typeof window === 'undefined') {
    return 400; // 服务端渲染默认值
  }
  
  const vh = window.innerHeight;
  
  switch (type) {
    case 'mobile':
      return Math.max(350, Math.min(vh - CONTAINER_HEIGHT_CONFIG.MOBILE.OFFSET, vh - CONTAINER_HEIGHT_CONFIG.MOBILE.MIN_OFFSET));
    case 'tablet':
      return Math.max(375, Math.min(vh - CONTAINER_HEIGHT_CONFIG.TABLET.OFFSET, vh - CONTAINER_HEIGHT_CONFIG.TABLET.MIN_OFFSET));
    case 'desktop':
      return Math.max(400, Math.min(vh - CONTAINER_HEIGHT_CONFIG.DESKTOP.OFFSET, vh - CONTAINER_HEIGHT_CONFIG.DESKTOP.MIN_OFFSET));
    case 'large':
      return Math.max(450, Math.min(vh - CONTAINER_HEIGHT_CONFIG.LARGE_SCREEN.OFFSET, vh - CONTAINER_HEIGHT_CONFIG.LARGE_SCREEN.MIN_OFFSET));
    case 'compact':
      return Math.max(300, Math.min(400, 500));
    case 'full':
      return vh;
    default:
      return Math.max(400, Math.min(vh - 200, vh - 150));
  }
}

/**
 * 获取响应式容器高度CSS字符串
 */
export function getResponsiveContainerCSS(): string {
  return `
    height: ${CONTAINER_HEIGHT_CONFIG.MOBILE.HEIGHT};
    min-height: ${CONTAINER_HEIGHT_CONFIG.MOBILE.MIN_HEIGHT};
    max-height: ${CONTAINER_HEIGHT_CONFIG.MOBILE.MAX_HEIGHT};
    
    @media (min-width: ${BREAKPOINTS.TABLET}px) {
      height: ${CONTAINER_HEIGHT_CONFIG.TABLET.HEIGHT};
      min-height: ${CONTAINER_HEIGHT_CONFIG.TABLET.MIN_HEIGHT};
      max-height: ${CONTAINER_HEIGHT_CONFIG.TABLET.MAX_HEIGHT};
    }
    
    @media (min-width: ${BREAKPOINTS.DESKTOP}px) {
      height: ${CONTAINER_HEIGHT_CONFIG.DESKTOP.HEIGHT};
      min-height: ${CONTAINER_HEIGHT_CONFIG.DESKTOP.MIN_HEIGHT};
      max-height: ${CONTAINER_HEIGHT_CONFIG.DESKTOP.MAX_HEIGHT};
    }
    
    @media (min-width: ${BREAKPOINTS.LARGE}px) {
      height: ${CONTAINER_HEIGHT_CONFIG.LARGE_SCREEN.HEIGHT};
      min-height: ${CONTAINER_HEIGHT_CONFIG.LARGE_SCREEN.MIN_HEIGHT};
      max-height: ${CONTAINER_HEIGHT_CONFIG.LARGE_SCREEN.MAX_HEIGHT};
    }
  `;
}

/**
 * 容器高度管理Hook
 */
export function useContainerHeight() {
  const [screenWidth, setScreenWidth] = React.useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleResize = () => {
      setScreenWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const config = getContainerConfig(screenWidth);
  
  const getHeightForType = (type: keyof typeof CONTAINER_HEIGHT_CONFIG) => {
    return CONTAINER_HEIGHT_CONFIG[type];
  };
  
  const getCurrentHeight = () => {
    if (screenWidth < BREAKPOINTS.MOBILE) return 'mobile';
    if (screenWidth < BREAKPOINTS.TABLET) return 'mobile';
    if (screenWidth < BREAKPOINTS.DESKTOP) return 'tablet';
    if (screenWidth < BREAKPOINTS.LARGE) return 'desktop';
    return 'large';
  };
  
  return {
    config,
    screenWidth,
    currentType: getCurrentHeight(),
    getHeightForType,
    calculateHeight: (type?: 'desktop' | 'mobile' | 'tablet' | 'large' | 'compact' | 'full') => 
      calculateContainerHeight(type || getCurrentHeight() as any)
  };
}

/**
 * 页面容器高度工具函数
 */
export const ContainerHeightUtils = {
  /**
   * 检查是否为移动端
   */
  isMobile: (width?: number) => {
    const w = width || (typeof window !== 'undefined' ? window.innerWidth : 1024);
    return w < BREAKPOINTS.TABLET;
  },
  
  /**
   * 检查是否为平板端
   */
  isTablet: (width?: number) => {
    const w = width || (typeof window !== 'undefined' ? window.innerWidth : 1024);
    return w >= BREAKPOINTS.TABLET && w < BREAKPOINTS.DESKTOP;
  },
  
  /**
   * 检查是否为桌面端
   */
  isDesktop: (width?: number) => {
    const w = width || (typeof window !== 'undefined' ? window.innerWidth : 1024);
    return w >= BREAKPOINTS.DESKTOP;
  },
  
  /**
   * 获取页面推荐的容器类型
   */
  getRecommendedType: (pageType: keyof typeof PAGE_CONTAINER_MAPPING) => {
    return PAGE_CONTAINER_MAPPING[pageType];
  }
};

// 导入React用于Hook
import React from 'react';
