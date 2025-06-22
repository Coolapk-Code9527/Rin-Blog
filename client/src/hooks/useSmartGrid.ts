import { useState, useEffect, useMemo } from 'react';

/**
 * 智能网格配置类型
 */
export interface SmartGridConfig {
  /** 网格列数CSS类名 */
  gridCols: string;
  /** 是否显示工具栏按钮文字 */
  showButtonText: boolean;
  /** 当前屏幕尺寸分类 */
  screenSize: 'small' | 'medium' | 'large' | 'xlarge';
  /** 是否为移动端 */
  isMobile: boolean;
}

/**
 * 智能响应式网格Hook
 * 
 * 基于侧边栏状态和屏幕尺寸智能计算最佳的网格列数和UI显示模式
 * 
 * ## 核心特性
 * - **侧边栏感知**：根据侧边栏开启状态调整网格列数
 * - **智能断点**：考虑实际可用宽度而非仅屏幕宽度
 * - **性能优化**：使用useMemo和防抖避免频繁计算
 * - **工具栏优化**：智能控制按钮文字显示
 * 
 * ## 网格策略
 * 
 * ### 无侧边栏模式
 * - 小屏幕 (<640px): 1列
 * - 中等屏幕 (640px-1024px): 2列
 * - 大屏幕 (≥1024px): 3列
 *
 * ### 有侧边栏模式
 * - 小屏幕 (<1024px): 侧边栏隐藏，1-2列
 * - 中等屏幕 (1024px-1280px): 2列（避免过窄）
 * - 大屏幕 (≥1280px): 3列
 * 
 * ## 工具栏策略
 * - 小屏幕 (<768px): 只显示图标
 * - 中等屏幕 (768px-1024px): 只显示图标（避免重叠）
 * - 大屏幕 (≥1024px): 显示图标+文字
 * 
 * @param sidebarEnabled 侧边栏是否启用
 * @returns 智能网格配置
 * 
 * @example
 * ```tsx
 * const { gridCols, showButtonText, screenSize } = useSmartGrid(sidebarEnabled);
 * 
 * // 在网格容器中使用
 * <div className={`grid ${gridCols} gap-4`}>
 *   {articles.map(article => <ArticleCard key={article.id} {...article} />)}
 * </div>
 * 
 * // 在工具栏按钮中使用
 * <button>
 *   <i className="ri-add-line" />
 *   {showButtonText && <span>新建文章</span>}
 * </button>
 * ```
 */
export function useSmartGrid(sidebarEnabled: boolean = false): SmartGridConfig {
  // 屏幕宽度状态（防抖优化）
  const [screenWidth, setScreenWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth;
    }
    return 1024; // SSR默认值
  });

  // 监听屏幕尺寸变化（防抖处理）
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let timeoutId: NodeJS.Timeout;

    const handleResize = () => {
      // 防抖处理，避免频繁更新
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setScreenWidth(window.innerWidth);
      }, 150); // 150ms防抖
    };

    // 初始化屏幕宽度
    setScreenWidth(window.innerWidth);

    // 添加事件监听器
    window.addEventListener('resize', handleResize, { passive: true });

    // 清理函数
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // 智能网格配置计算（性能优化）
  const gridConfig = useMemo((): SmartGridConfig => {
    // 屏幕尺寸分类
    let screenSize: SmartGridConfig['screenSize'];
    if (screenWidth < 640) {
      screenSize = 'small';
    } else if (screenWidth < 1024) {
      screenSize = 'medium';
    } else if (screenWidth < 1536) {
      screenSize = 'large';
    } else {
      screenSize = 'xlarge';
    }

    // 移动端判断
    const isMobile = screenWidth < 768;

    // 计算实际可用宽度（考虑侧边栏）
    const sidebarWidth = 260; // 侧边栏固定宽度
    const sidebarGap = 24; // 侧边栏间距
    const containerPadding = screenWidth < 640 ? 32 : screenWidth < 768 ? 48 : 64; // 容器内边距
    
    const availableWidth = sidebarEnabled && screenWidth >= 1024 
      ? screenWidth - sidebarWidth - sidebarGap - containerPadding
      : screenWidth - containerPadding;

    // 智能网格列数计算
    let gridCols: string;
    
    if (sidebarEnabled && screenWidth >= 1024) {
      // 有侧边栏模式
      if (availableWidth < 600) {
        gridCols = 'grid-cols-1'; // 1列
      } else if (availableWidth < 900) {
        gridCols = 'grid-cols-2'; // 2列
      } else {
        gridCols = 'grid-cols-3'; // 3列（最大3列）
      }
    } else {
      // 无侧边栏模式或小屏幕
      if (screenWidth < 640) {
        gridCols = 'grid-cols-1'; // 1列
      } else if (screenWidth < 1024) {
        gridCols = 'grid-cols-2'; // 2列
      } else {
        gridCols = 'grid-cols-3'; // 3列（最大3列）
      }
    }

    // 工具栏按钮文字显示策略
    const showButtonText = screenWidth >= 1024; // lg断点及以上显示文字

    return {
      gridCols,
      showButtonText,
      screenSize,
      isMobile
    };
  }, [screenWidth, sidebarEnabled]);

  return gridConfig;
}

/**
 * 获取响应式网格类名（简化版本）
 * 
 * @param sidebarEnabled 侧边栏是否启用
 * @returns 网格CSS类名
 */
export function getSmartGridClasses(sidebarEnabled: boolean = false): string {
  const { gridCols } = useSmartGrid(sidebarEnabled);
  return gridCols;
}

/**
 * 检查是否应该显示按钮文字（简化版本）
 * 
 * @returns 是否显示按钮文字
 */
export function shouldShowButtonText(): boolean {
  const { showButtonText } = useSmartGrid();
  return showButtonText;
}
