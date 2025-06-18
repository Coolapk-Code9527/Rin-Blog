import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { MODAL_Z_INDEX, MODAL_ANIMATIONS } from '../../utils/modal-config';
import { useGlassEffect, GLASS_LAYERS } from '../../hooks/useGlassEffect';

export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'loading' | 'progress';

export interface ToastItem {
  id: number;
  message: string;
  type?: ToastType;
  duration?: number;
  progress?: number; // 进度百分比 (0-100)
  persistent?: boolean; // 是否持久显示，需要手动关闭
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextProps {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  showProgressToast: (message: string, progress: number, id?: number) => number;
  showPersistentToast: (message: string, type?: ToastType, action?: ToastItem['action']) => number;
  updateToast: (id: number, updates: Partial<ToastItem>) => void;
  removeToast: (id: number) => void;
}

export const ToastContext = createContext<ToastContextProps | null>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
};

export function ToastProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);
  const timeouts = useRef<Map<number, NodeJS.Timeout>>(new Map());

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
    const id = ++toastId.current;
    const toast: ToastItem = { id, message, type, duration };

    setToasts((prev) => [...prev, toast]);

    if (duration > 0 && !toast.persistent) {
      const timeout = setTimeout(() => {
        removeToast(id);
      }, duration);
      timeouts.current.set(id, timeout);
    }

    return id;
  }, []);

  const showProgressToast = useCallback((message: string, progress: number, id?: number) => {
    const currentId = id || ++toastId.current;
    const toast: ToastItem = {
      id: currentId,
      message,
      type: 'progress',
      progress: Math.max(0, Math.min(100, progress)),
      persistent: true
    };

    setToasts((prev) => {
      const existing = prev.find(t => t.id === currentId);
      if (existing) {
        return prev.map(t => t.id === currentId ? { ...t, ...toast } : t);
      }
      return [...prev, toast];
    });

    return currentId;
  }, []);

  const showPersistentToast = useCallback((message: string, type: ToastType = 'info', action?: ToastItem['action']) => {
    const id = ++toastId.current;
    const toast: ToastItem = { id, message, type, persistent: true, action };

    setToasts((prev) => [...prev, toast]);
    return id;
  }, []);

  const updateToast = useCallback((id: number, updates: Partial<ToastItem>) => {
    setToasts((prev) => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));

    // 清理定时器
    const timeout = timeouts.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeouts.current.delete(id);
    }
  }, []);

  // @ts-ignore
  return React.createElement(
    ToastContext.Provider as any,
    { value: { showToast, showProgressToast, showPersistentToast, updateToast, removeToast } },
    <>
      {children}
      <div
        className="fixed top-5 right-5 flex flex-col gap-3 items-end pointer-events-none select-none"
        style={{ zIndex: MODAL_Z_INDEX.CRITICAL }}
      >
        {toasts.map((toast) => (
          <ToastItemComponent key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </>
  );
}

// 单个Toast项组件
function ToastItemComponent({ toast, onRemove }: { toast: ToastItem; onRemove: (id: number) => void; key?: number }) {
  // 使用智能毛玻璃效果
  const toastGlassClass = useGlassEffect('glass-toast');

  const getToastStyles = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-green-50/95 text-green-700 border border-green-200/60 dark:bg-green-900/90 dark:text-green-200 dark:border-green-700/60';
      case 'error':
        return 'bg-red-50/95 text-red-700 border border-red-200/60 dark:bg-red-900/90 dark:text-red-200 dark:border-red-700/60';
      case 'warning':
        return 'bg-yellow-50/95 text-yellow-700 border border-yellow-200/60 dark:bg-yellow-900/90 dark:text-yellow-200 dark:border-yellow-700/60';
      case 'loading':
        return 'bg-blue-50/95 text-blue-700 border border-blue-200/60 dark:bg-blue-900/90 dark:text-blue-200 dark:border-blue-700/60';
      case 'progress':
        return 'bg-purple-50/95 text-purple-700 border border-purple-200/60 dark:bg-purple-900/90 dark:text-purple-200 dark:border-purple-700/60';
      default:
        return 'bg-blue-50/95 text-blue-700 border border-blue-200/60 dark:bg-blue-900/90 dark:text-blue-200 dark:border-blue-700/60';
    }
  };

  const getToastIcon = () => {
    switch (toast.type) {
      case 'success':
        return 'ri-checkbox-circle-line';
      case 'error':
        return 'ri-close-circle-line';
      case 'warning':
        return 'ri-error-warning-line';
      case 'loading':
        return 'ri-loader-4-line animate-spin';
      case 'progress':
        return 'ri-download-line';
      default:
        return 'ri-information-line';
    }
  };

  return (
    <div
      className={`pointer-events-auto min-w-[220px] max-w-sm rounded-lg shadow-enhanced-lg ${toastGlassClass} text-sm font-medium animate-toastSlideIn transition-all duration-300 hover:scale-[0.98] ${getToastStyles()}`}
    >
      {/* 进度条（仅在progress类型时显示） */}
      {toast.type === 'progress' && typeof toast.progress === 'number' && (
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-t-lg h-1">
          <div
            className="h-1 bg-purple-500 dark:bg-purple-400 rounded-t-lg transition-all duration-300"
            style={{ width: `${toast.progress}%` }}
          />
        </div>
      )}

      <div className="px-4 py-3 flex items-center gap-2">
        <i className={`${getToastIcon()} text-lg flex-shrink-0`}></i>

        <div className="flex-1 min-w-0">
          <span className="block truncate">{toast.message}</span>
          {toast.type === 'progress' && typeof toast.progress === 'number' && (
            <span className="text-xs opacity-75 mt-1 block">{Math.round(toast.progress)}%</span>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {toast.action && (
            <button
              className="text-xs px-2 py-1 rounded bg-white/20 hover:bg-white/30 dark:bg-black/20 dark:hover:bg-black/30 transition-colors duration-150"
              onClick={toast.action.onClick}
            >
              {toast.action.label}
            </button>
          )}

          {(toast.persistent || toast.action) && (
            <button
              className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 rounded-full transition-colors duration-150"
              onClick={() => onRemove(toast.id)}
              aria-label="关闭"
            >
              <i className="ri-close-line text-sm"></i>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}