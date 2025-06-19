/**
 * 页面布局比例配置系统
 * 
 * 统一管理所有页面的标题区域、主内容区域、操作区域的高度比例关系
 */

import type { StandardPageLayoutConfig } from '../components/StandardPageLayout';

/**
 * 页面类型枚举
 */
export enum PageType {
  // 内容浏览页面
  TIMELINE = 'timeline',
  HASHTAGS = 'hashtags',
  ARTICLE = 'article',
  SEARCH = 'search',
  
  // 管理页面
  FILES = 'files',
  WRITING = 'writing',
  SETTINGS = 'settings',
  
  // 特殊页面
  HOME = 'home',
  LOGIN = 'login',
  ERROR = 'error'
}

/**
 * 页面布局配置映射
 */
export const PAGE_LAYOUT_CONFIGS: Record<PageType, StandardPageLayoutConfig> = {
  // 时间轴页面：标准标题 + 滚动内容
  [PageType.TIMELINE]: {
    title: {
      height: 'standard',
      showDivider: true,
      background: false
    },
    content: {
      padding: 'none', // 时间轴有自己的内边距
      scroll: true
    },
    actions: {
      height: 'compact',
      position: 'bottom',
      background: false
    }
  },

  // 标签页面：标准标题 + 滚动内容 + 排序操作
  [PageType.HASHTAGS]: {
    title: {
      height: 'large', // 需要容纳排序控件
      showDivider: true,
      background: false
    },
    content: {
      padding: 'standard',
      scroll: true
    },
    actions: {
      height: 'compact',
      position: 'bottom',
      background: false
    }
  },

  // 文章详情页面：紧凑标题 + 滚动内容
  [PageType.ARTICLE]: {
    title: {
      height: 'compact',
      showDivider: false,
      background: false
    },
    content: {
      padding: 'large',
      scroll: true
    },
    actions: {
      height: 'standard',
      position: 'bottom',
      background: true
    }
  },

  // 搜索页面：大型标题（搜索框） + 滚动结果
  [PageType.SEARCH]: {
    title: {
      height: 'large',
      showDivider: true,
      background: true
    },
    content: {
      padding: 'standard',
      scroll: true
    },
    actions: {
      height: 'compact',
      position: 'bottom',
      background: false
    }
  },

  // 文件管理页面：标准标题 + 工具栏 + 滚动内容
  [PageType.FILES]: {
    title: {
      height: 'standard',
      showDivider: true,
      background: false
    },
    content: {
      padding: 'none', // 文件管理器有自己的布局
      scroll: false // 内部处理滚动
    },
    actions: {
      height: 'standard',
      position: 'both', // 顶部工具栏 + 底部操作
      background: true
    }
  },

  // 写作页面：特殊布局（不使用标准布局）
  [PageType.WRITING]: {
    title: {
      height: 'compact',
      showDivider: false,
      background: false
    },
    content: {
      padding: 'none',
      scroll: false
    },
    actions: {
      height: 'compact',
      position: 'top',
      background: false
    }
  },

  // 设置页面：标准标题 + 滚动内容 + 保存操作
  [PageType.SETTINGS]: {
    title: {
      height: 'standard',
      showDivider: true,
      background: false
    },
    content: {
      padding: 'standard',
      scroll: true
    },
    actions: {
      height: 'standard',
      position: 'bottom',
      background: true
    }
  },

  // 首页：紧凑标题 + 滚动内容
  [PageType.HOME]: {
    title: {
      height: 'compact',
      showDivider: false,
      background: false
    },
    content: {
      padding: 'standard',
      scroll: true
    },
    actions: {
      height: 'compact',
      position: 'bottom',
      background: false
    }
  },

  // 登录页面：无标题 + 居中内容
  [PageType.LOGIN]: {
    title: {
      height: 'compact',
      showDivider: false,
      background: false
    },
    content: {
      padding: 'large',
      scroll: false
    },
    actions: {
      height: 'standard',
      position: 'bottom',
      background: false
    }
  },

  // 错误页面：紧凑标题 + 居中内容
  [PageType.ERROR]: {
    title: {
      height: 'compact',
      showDivider: false,
      background: false
    },
    content: {
      padding: 'large',
      scroll: false
    },
    actions: {
      height: 'standard',
      position: 'bottom',
      background: false
    }
  }
};

/**
 * 响应式布局调整配置
 */
export const RESPONSIVE_LAYOUT_ADJUSTMENTS = {
  // 移动端调整
  mobile: {
    title: {
      height: 'compact' as const, // 移动端使用紧凑标题
      padding: 'small' as const
    },
    content: {
      padding: 'small' as const // 移动端减少内边距
    },
    actions: {
      height: 'large' as const // 移动端操作区域更大，便于触控
    }
  },

  // 平板端调整
  tablet: {
    title: {
      height: 'standard' as const,
      padding: 'standard' as const
    },
    content: {
      padding: 'standard' as const
    },
    actions: {
      height: 'standard' as const
    }
  },

  // 桌面端调整
  desktop: {
    title: {
      height: 'standard' as const,
      padding: 'standard' as const
    },
    content: {
      padding: 'standard' as const
    },
    actions: {
      height: 'standard' as const
    }
  }
};

/**
 * 获取页面布局配置
 */
export function getPageLayoutConfig(
  pageType: PageType,
  screenWidth?: number
): StandardPageLayoutConfig {
  const baseConfig = PAGE_LAYOUT_CONFIGS[pageType];
  
  if (!screenWidth) {
    return baseConfig;
  }

  // 根据屏幕宽度应用响应式调整
  let adjustments;
  if (screenWidth < 768) {
    adjustments = RESPONSIVE_LAYOUT_ADJUSTMENTS.mobile;
  } else if (screenWidth < 1024) {
    adjustments = RESPONSIVE_LAYOUT_ADJUSTMENTS.tablet;
  } else {
    adjustments = RESPONSIVE_LAYOUT_ADJUSTMENTS.desktop;
  }

  // 合并配置
  return {
    title: {
      ...baseConfig.title,
      height: adjustments.title.height
    },
    content: {
      ...baseConfig.content,
      padding: adjustments.content.padding
    },
    actions: {
      ...baseConfig.actions,
      height: adjustments.actions.height
    }
  };
}

/**
 * 页面布局工具函数
 */
export const PageLayoutUtils = {
  /**
   * 检查页面是否需要操作区域
   */
  needsActions: (pageType: PageType): boolean => {
    return ![PageType.ARTICLE, PageType.HOME].includes(pageType);
  },

  /**
   * 检查页面是否需要标题区域
   */
  needsTitle: (pageType: PageType): boolean => {
    return pageType !== PageType.LOGIN;
  },

  /**
   * 获取页面推荐的容器高度类型
   */
  getRecommendedHeightType: (pageType: PageType): 'responsive' | 'auto' => {
    // 内容页面使用自适应高度，管理页面使用响应式高度
    const autoHeightPages = [PageType.ARTICLE, PageType.HOME, PageType.LOGIN, PageType.ERROR];
    return autoHeightPages.includes(pageType) ? 'auto' : 'responsive';
  },

  /**
   * 计算页面内容区域的可用高度
   */
  calculateContentHeight: (
    pageType: PageType,
    containerHeight: number,
    screenWidth?: number
  ): number => {
    const config = getPageLayoutConfig(pageType, screenWidth);
    
    let usedHeight = 0;
    
    // 标题区域高度
    if (PageLayoutUtils.needsTitle(pageType)) {
      const titleHeight = {
        compact: 60,
        standard: 80,
        large: 100
      }[config.title?.height || 'standard'];
      usedHeight += titleHeight;
    }
    
    // 操作区域高度
    if (PageLayoutUtils.needsActions(pageType)) {
      const actionsHeight = {
        compact: 50,
        standard: 60,
        large: 80
      }[config.actions?.height || 'standard'];
      usedHeight += actionsHeight;
    }
    
    return Math.max(200, containerHeight - usedHeight);
  }
};
