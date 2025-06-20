/**
 * 响应式弹窗组件
 * 在桌面端显示为标准弹窗，在移动端显示为底部抽屉
 */

import React, { useEffect, useState } from 'react';
import Modal from 'react-modal';
import {
  macOSModalStyles,
  MODAL_Z_INDEX,
  useModalKeyboard,
  useModalBodyLock,
  MODAL_ANIMATIONS,
  useResponsiveZIndex
} from '../utils/modal-config';

interface ResponsiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'small' | 'medium' | 'large' | 'fullscreen';
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  disabled?: boolean;
  className?: string;
}

export function ResponsiveModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  children,
  size = 'medium',
  showCloseButton = true,
  closeOnOverlayClick = true,
  disabled = false,
  className = ''
}: ResponsiveModalProps) {
  const [isMobile, setIsMobile] = useState(false);

  // 使用响应式层级管理
  const modalZIndex = useResponsiveZIndex('MODAL');

  // 检测移动端
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 键盘事件处理
  useModalKeyboard(isOpen, onClose, onConfirm, disabled);
  
  // Body锁定
  useModalBodyLock(isOpen);

  // 获取弹窗样式
  const getModalStyles = () => {
    const baseStyles = { ...macOSModalStyles };

    // 使用响应式层级
    baseStyles.overlay.zIndex = modalZIndex;

    if (isMobile) {
      // 移动端样式：底部抽屉
      return {
        ...baseStyles,
        content: {
          ...baseStyles.content,
          position: 'fixed' as const,
          bottom: 0,
          left: 0,
          right: 0,
          top: 'auto',
          maxWidth: '100vw',
          width: '100vw',
          maxHeight: '90vh',
          borderRadius: '16px 16px 0 0',
          transform: 'none'
        },
        overlay: {
          ...baseStyles.overlay,
          alignItems: 'flex-end',
          justifyContent: 'center',
          zIndex: modalZIndex
        }
      };
    }

    // 桌面端样式
    switch (size) {
      case 'small':
        return {
          ...baseStyles,
          content: {
            ...baseStyles.content,
            maxWidth: '400px',
            minWidth: '300px'
          }
        };
      case 'large':
        return {
          ...baseStyles,
          content: {
            ...baseStyles.content,
            maxWidth: '800px',
            minWidth: '600px'
          }
        };
      case 'fullscreen':
        return {
          ...baseStyles,
          content: {
            ...baseStyles.content,
            maxWidth: '95vw',
            maxHeight: '95vh',
            minWidth: '80vw'
          }
        };
      default:
        return baseStyles;
    }
  };

  // 获取容器类名
  const getContainerClassName = () => {
    const baseClasses = [
      'glass-layer-3',
      'shadow-enhanced-2xl',
      'w-full',
      'flex',
      'flex-col'
    ];

    if (isMobile) {
      baseClasses.push(
        'rounded-t-2xl',
        'animate-slideInUp',
        'max-h-[90vh]',
        'overflow-hidden'
      );
    } else {
      baseClasses.push(
        'rounded-2xl',
        'animate-modalEnter'
      );
    }

    return baseClasses.join(' ') + (className ? ` ${className}` : '');
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={closeOnOverlayClick ? onClose : undefined}
      style={getModalStyles()}
      contentLabel={title || 'Modal'}
      ariaHideApp={false}
      shouldCloseOnOverlayClick={closeOnOverlayClick && !disabled}
      shouldCloseOnEsc={!disabled}
    >
      <div className={getContainerClassName()}>
        {/* 移动端拖拽指示器 */}
        {isMobile && (
          <div className="flex justify-center py-2 px-4">
            <div className="w-8 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
          </div>
        )}

        {/* 标题栏 */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-4 border-b border-gray-200/60 dark:border-gray-700/60">
            {title && (
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                disabled={disabled}
                className="ml-auto p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="关闭"
              >
                <i className="ri-close-line text-xl text-gray-500 dark:text-gray-400"></i>
              </button>
            )}
          </div>
        )}

        {/* 内容区域 */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </Modal>
  );
}

// 移动端底部抽屉动画
const mobileDrawerStyles = `
  @keyframes slideInUp {
    from {
      transform: translateY(100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  @keyframes slideOutDown {
    from {
      transform: translateY(0);
      opacity: 1;
    }
    to {
      transform: translateY(100%);
      opacity: 0;
    }
  }

  .animate-slideInUp {
    animation: slideInUp 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
  }

  .animate-slideOutDown {
    animation: slideOutDown 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }
`;

// 将样式注入到页面中
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = mobileDrawerStyles;
  document.head.appendChild(styleElement);
}

export default ResponsiveModal;
