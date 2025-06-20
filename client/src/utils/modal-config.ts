/**
 * 弹窗系统统一配置
 * 解决层级混乱、定位不一致、样式不统一等问题
 */
import React from 'react';

// 统一的z-index层级管理
export const MODAL_Z_INDEX = {
  // 基础层级
  BASE: 10000,
  HEADER: 10050,          // 全局导航栏

  // 弹窗层级（按优先级递增）
  TOAST: 10100,           // 轻提示
  DROPDOWN: 10200,        // 下拉菜单
  MODAL: 10300,           // 普通弹窗
  DIALOG: 10400,          // 对话框
  MOBILE_MENU: 10450,     // 移动端菜单
  DRAWER: 10500,          // 抽屉/侧边栏（全局遮罩）
  NESTED_DIALOG: 10600,   // 嵌套弹窗（FileManager内部弹窗）
  PREVIEW: 10700,         // 文件预览
  LIGHTBOX: 10800,        // 图片灯箱
  LOADING: 10900,         // 全局加载
  CRITICAL: 11000,        // 关键弹窗（如错误提示）
} as const;

// 定义z-index联合类型
type ZIndexValue = typeof MODAL_Z_INDEX[keyof typeof MODAL_Z_INDEX] | typeof RESPONSIVE_Z_INDEX.MOBILE[keyof typeof RESPONSIVE_Z_INDEX.MOBILE];

// macOS风格弹窗的统一样式配置
export const macOSModalStyles = {
  content: {
    position: 'static' as const, // 使用static，完全依赖flex容器定位
    padding: '0',
    border: 'none',
    borderRadius: '16px',
    background: 'transparent',
    outline: 'none',
    overflow: 'visible',
    maxWidth: '500px',
    width: '90vw',
    minWidth: '320px',
    maxHeight: '90vh',
    // 移除所有可能影响定位的属性，让动画自然进行
    top: 'auto',
    left: 'auto',
    right: 'auto',
    bottom: 'auto',
    marginRight: '0',
    // 不设置transform，让CSS动画控制
  },
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    // 移除 backdropFilter 避免与内容的毛玻璃效果冲突
    zIndex: MODAL_Z_INDEX.MODAL as ZIndexValue,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    // 确保完全覆盖屏幕
    width: '100vw',
    height: '100vh',
    // 防止滚动
    overflow: 'hidden',
  }
};

// 大尺寸弹窗样式（如文件管理器）
export const macOSLargeModalStyles = {
  ...macOSModalStyles,
  content: {
    ...macOSModalStyles.content,
    maxWidth: '90vw',
    maxHeight: '90vh',
    width: 'auto',
    height: 'auto',
    minWidth: '600px', // 确保文件管理器有足够宽度
  }
};

// 全屏预览样式（如图片预览）
export const macOSFullscreenModalStyles = {
  content: {
    position: 'static' as const,
    padding: '0',
    border: 'none',
    background: 'transparent',
    outline: 'none',
    overflow: 'visible',
    width: '100vw',
    height: '100vh',
    maxWidth: 'none',
    maxHeight: 'none',
    top: 'auto',
    left: 'auto',
    right: 'auto',
    bottom: 'auto',
    marginRight: '0',
    // 不设置transform，让CSS动画控制
  },
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    backdropFilter: 'blur(20px)',
    zIndex: MODAL_Z_INDEX.PREVIEW as ZIndexValue,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
  }
};

// 统一的弹窗容器样式类名
export const MODAL_CONTAINER_CLASSES = {
  // 标准弹窗容器 - 使用统一的毛玻璃系统和自定义动画
  standard: `
    glass-layer-3
    shadow-enhanced-2xl
    rounded-2xl
    p-6
    w-full
    animate-modalEnter
  `,

  // 大尺寸弹窗容器 - 使用统一的毛玻璃系统和自定义动画
  large: `
    glass-layer-3
    rounded-2xl
    shadow-enhanced-2xl
    overflow-hidden
    flex
    flex-col
    animate-modalEnter
  `,

  // 全屏预览容器
  fullscreen: `
    w-full
    h-full
    flex
    items-center
    justify-center
    animate-fadeIn
  `
};

// 增强的键盘事件处理
export const useModalKeyboard = (
  isOpen: boolean,
  onClose: () => void,
  onConfirm?: () => void,
  disabled?: boolean,
  options?: {
    enableTabNavigation?: boolean;
    enableArrowNavigation?: boolean;
    trapFocus?: boolean;
  }
) => {
  const {
    enableTabNavigation = true,
    enableArrowNavigation = false,
    trapFocus = true
  } = options || {};

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen || disabled) return;

      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          event.stopPropagation();
          onClose();
          break;

        case 'Enter':
          if (onConfirm && !event.shiftKey && !event.ctrlKey && !event.altKey) {
            // 只有在没有修饰键的情况下才触发确认
            const target = event.target as HTMLElement;
            // 避免在文本区域或可编辑元素中触发
            if (target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
              event.preventDefault();
              event.stopPropagation();
              onConfirm();
            }
          }
          break;

        case 'Tab':
          if (enableTabNavigation && trapFocus) {
            // 焦点陷阱：确保Tab键只在弹窗内循环
            const modal = document.querySelector('[role="dialog"], .ReactModal__Content');
            if (modal) {
              const focusableElements = modal.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
              );
              const firstElement = focusableElements[0] as HTMLElement;
              const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

              if (event.shiftKey) {
                // Shift+Tab：向前导航
                if (document.activeElement === firstElement) {
                  event.preventDefault();
                  lastElement?.focus();
                }
              } else {
                // Tab：向后导航
                if (document.activeElement === lastElement) {
                  event.preventDefault();
                  firstElement?.focus();
                }
              }
            }
          }
          break;

        case 'ArrowUp':
        case 'ArrowDown':
          if (enableArrowNavigation) {
            event.preventDefault();
            // 箭头键导航逻辑
            const focusableElements = Array.from(
              document.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
            ) as HTMLElement[];

            const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement);
            if (currentIndex !== -1) {
              const nextIndex = event.key === 'ArrowDown'
                ? (currentIndex + 1) % focusableElements.length
                : (currentIndex - 1 + focusableElements.length) % focusableElements.length;
              focusableElements[nextIndex]?.focus();
            }
          }
          break;
      }
    };

    if (isOpen) {
      // 使用捕获阶段确保事件被正确处理
      document.addEventListener('keydown', handleKeyDown, true);

      // 设置初始焦点
      if (trapFocus) {
        const modal = document.querySelector('[role="dialog"], .ReactModal__Content');
        const firstFocusable = modal?.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) as HTMLElement;

        // 延迟设置焦点，确保弹窗已完全渲染
        setTimeout(() => {
          firstFocusable?.focus();
        }, 100);
      }

      return () => {
        document.removeEventListener('keydown', handleKeyDown, true);
      };
    }
  }, [isOpen, onClose, onConfirm, disabled, enableTabNavigation, enableArrowNavigation, trapFocus]);
};

// 弹窗打开时的body处理
export const useModalBodyLock = (isOpen: boolean) => {
  React.useEffect(() => {
    if (isOpen) {
      // 防止背景滚动
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      document.body.classList.add('modal-open');
      
      return () => {
        document.body.style.overflow = originalStyle;
        document.body.classList.remove('modal-open');
      };
    }
  }, [isOpen]);
};

// macOS风格的弹窗动画配置
export const MODAL_ANIMATIONS = {
  // 标准弹窗动画（从中心缩放）
  MODAL: {
    enter: 'animate-modalEnter',
    exit: 'animate-modalExit'
  },
  // 下拉菜单动画（从上方滑入）
  DROPDOWN: {
    enter: 'animate-slideDown',
    exit: 'animate-slideUp'
  },
  // 侧边栏动画（从侧边滑入）
  DRAWER: {
    enter: 'animate-slideInRight',
    exit: 'animate-slideOutRight'
  },
  // Toast通知动画（从右侧滑入）
  TOAST: {
    enter: 'animate-slideInRight',
    exit: 'animate-slideOutRight'
  },
  // 淡入淡出动画（用于遮罩层）
  FADE: {
    enter: 'animate-fadeIn',
    exit: 'animate-fadeOut'
  },
  // 弹性动画（用于重要提示）
  BOUNCE: {
    enter: 'animate-bounceIn',
    exit: 'animate-bounceOut'
  }
} as const;

// 动画持续时间配置（毫秒）
export const ANIMATION_DURATION = {
  FAST: 150,
  NORMAL: 250,
  SLOW: 350,
  EXTRA_SLOW: 500
} as const;

// 缓动函数配置
export const EASING = {
  // macOS标准缓动
  EASE_OUT: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  EASE_IN_OUT: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
  // 弹性缓动
  SPRING: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  // 快速缓动
  SHARP: 'cubic-bezier(0.4, 0, 0.2, 1)'
} as const;

// 响应式层级管理配置
export const RESPONSIVE_Z_INDEX = {
  // 移动端专用层级（优化性能，使用较低的z-index值）
  MOBILE: {
    HEADER: 1000,           // 移动端导航栏
    DROPDOWN: 1100,         // 移动端下拉菜单
    MOBILE_MENU: 1200,      // 移动端菜单
    DRAWER: 1300,           // 移动端抽屉
    MODAL: 1400,            // 移动端弹窗
    TOAST: 1500,            // 移动端提示
    LOADING: 1600,          // 移动端加载
    CRITICAL: 1700,         // 移动端关键弹窗
  },

  // 桌面端使用标准层级
  DESKTOP: MODAL_Z_INDEX,

  // 响应式断点
  BREAKPOINTS: {
    MOBILE: 768,            // 小于768px使用移动端层级
    TABLET: 1024,           // 768-1024px使用标准层级
    DESKTOP: 1024,          // 大于1024px使用标准层级
  }
} as const;

// 获取当前设备类型的层级配置
export const getCurrentZIndex = (component: keyof typeof MODAL_Z_INDEX) => {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < RESPONSIVE_Z_INDEX.BREAKPOINTS.MOBILE;

  if (isMobile && component in RESPONSIVE_Z_INDEX.MOBILE) {
    return RESPONSIVE_Z_INDEX.MOBILE[component as keyof typeof RESPONSIVE_Z_INDEX.MOBILE];
  }

  return MODAL_Z_INDEX[component];
};

// 响应式层级管理Hook
export const useResponsiveZIndex = (component: keyof typeof MODAL_Z_INDEX) => {
  const [zIndex, setZIndex] = React.useState(() => getCurrentZIndex(component));

  React.useEffect(() => {
    const updateZIndex = () => {
      setZIndex(getCurrentZIndex(component));
    };

    // 监听窗口大小变化
    window.addEventListener('resize', updateZIndex);
    return () => window.removeEventListener('resize', updateZIndex);
  }, [component]);

  return zIndex;
};
