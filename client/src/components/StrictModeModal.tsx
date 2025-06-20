import React, { useEffect, useRef, useState } from 'react';
import Modal from 'react-modal';

interface StrictModeModalProps {
  isOpen: boolean;
  onRequestClose?: () => void;
  shouldCloseOnOverlayClick?: boolean;
  shouldCloseOnEsc?: boolean;
  style?: any;
  contentLabel?: string;
  ariaHideApp?: boolean;
  children: React.ReactNode;
}

/**
 * React严格模式兼容的Modal包装器
 * 解决React.StrictMode下的Modal重复注册问题
 */
export function StrictModeModal({
  isOpen,
  onRequestClose,
  shouldCloseOnOverlayClick = true,
  shouldCloseOnEsc = true,
  style,
  contentLabel,
  ariaHideApp = false,
  children,
  ...props
}: StrictModeModalProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isFirstRender = useRef(true);
  const mountedRef = useRef(false);

  // 延迟打开Modal，避免React严格模式的双重挂载问题
  useEffect(() => {
    if (isOpen && !internalIsOpen) {
      // 使用setTimeout确保在React严格模式的双重挂载完成后再打开Modal
      const timer = setTimeout(() => {
        if (mountedRef.current) {
          setInternalIsOpen(true);
        }
      }, 0);
      
      return () => clearTimeout(timer);
    } else if (!isOpen && internalIsOpen) {
      setInternalIsOpen(false);
    }
  }, [isOpen, internalIsOpen]);

  // 组件挂载状态跟踪
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // 处理关闭事件
  const handleRequestClose = () => {
    setInternalIsOpen(false);
    onRequestClose?.();
  };

  // 在React严格模式下，第一次渲染时不显示Modal
  if (isFirstRender.current) {
    isFirstRender.current = false;
    if (process.env.NODE_ENV === 'development') {
      // 在开发环境中延迟一帧再渲染
      setTimeout(() => {
        if (mountedRef.current && isOpen) {
          setInternalIsOpen(true);
        }
      }, 16);
      return null;
    }
  }

  return (
    <Modal
      isOpen={internalIsOpen}
      onRequestClose={handleRequestClose}
      shouldCloseOnOverlayClick={shouldCloseOnOverlayClick}
      shouldCloseOnEsc={shouldCloseOnEsc}
      style={style}
      contentLabel={contentLabel}
      ariaHideApp={ariaHideApp}
      {...props}
    >
      {children}
    </Modal>
  );
}
