/**
 * 弹窗系统统一配置
 * 解决层级混乱、定位不一致、样式不统一等问题
 */
import React from 'react';

// 统一的z-index层级管理
export const MODAL_Z_INDEX = {
  // 基础层级
  BASE: 10000,

  // 弹窗层级（按优先级递增）
  TOAST: 10100,           // 轻提示
  DROPDOWN: 10200,        // 下拉菜单
  MODAL: 10300,           // 普通弹窗
  DIALOG: 10400,          // 对话框
  DRAWER: 10500,          // 抽屉/侧边栏（全局遮罩）
  NESTED_DIALOG: 10600,   // 嵌套弹窗（FileManager内部弹窗）
  PREVIEW: 10700,         // 文件预览
  LIGHTBOX: 10800,        // 图片灯箱
  LOADING: 10900,         // 全局加载
  CRITICAL: 11000,        // 关键弹窗（如错误提示）
} as const;

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
    backdropFilter: 'blur(12px)',
    zIndex: MODAL_Z_INDEX.MODAL,
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
    zIndex: MODAL_Z_INDEX.PREVIEW,
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
  // 标准弹窗容器
  standard: `
    bg-white/75 dark:bg-gray-800/75
    backdrop-blur-xl
    shadow-enhanced-2xl
    border border-neutral-200/60 dark:border-neutral-700/60
    rounded-2xl
    p-6
    w-full
    animate-in
    fade-in-0
    zoom-in-flex
    duration-200
    ease-out
  `,

  // 大尺寸弹窗容器
  large: `
    bg-white/80 dark:bg-gray-800/80
    backdrop-blur-xl
    rounded-2xl
    shadow-enhanced-2xl
    border border-neutral-200/60 dark:border-neutral-700/60
    overflow-hidden
    flex
    flex-col
    animate-in
    fade-in-0
    zoom-in-flex
    duration-200
    ease-out
  `,

  // 全屏预览容器
  fullscreen: `
    w-full
    h-full
    flex
    items-center
    justify-center
    animate-in
    fade-in-0
    duration-300
    ease-out
  `
};

// 统一的键盘事件处理
export const useModalKeyboard = (
  isOpen: boolean,
  onClose: () => void,
  onConfirm?: () => void,
  disabled?: boolean
) => {
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen || disabled) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      } else if (event.key === 'Enter' && onConfirm) {
        event.preventDefault();
        event.stopPropagation();
        onConfirm();
      }
    };

    if (isOpen) {
      // 使用捕获阶段确保事件被正确处理
      document.addEventListener('keydown', handleKeyDown, true);
      return () => {
        document.removeEventListener('keydown', handleKeyDown, true);
      };
    }
  }, [isOpen, onClose, onConfirm, disabled]);
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
