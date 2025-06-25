import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
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

// Toast队列管理配置
const MAX_TOASTS = 5; // 最大同时显示数量
const DUPLICATE_THRESHOLD = 3000; // 重复消息时间窗口(ms)

export function ToastProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);
  const timeouts = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const recentMessages = useRef<Map<string, number>>(new Map()); // 用于去重

  // 检查重复消息
  const isDuplicateMessage = useCallback((message: string, type: ToastType) => {
    const key = `${type}:${message}`;
    const lastTime = recentMessages.current.get(key);
    const now = Date.now();

    if (lastTime && (now - lastTime) < DUPLICATE_THRESHOLD) {
      return true;
    }

    recentMessages.current.set(key, now);

    // 清理过期的消息记录
    for (const [msgKey, time] of recentMessages.current.entries()) {
      if (now - time > DUPLICATE_THRESHOLD) {
        recentMessages.current.delete(msgKey);
      }
    }

    return false;
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
    // 检查重复消息
    if (isDuplicateMessage(message, type)) {
      return -1; // 返回-1表示被去重
    }

    const id = ++toastId.current;
    const toast: ToastItem = { id, message, type, duration };

    setToasts((prev) => {
      // 限制最大Toast数量
      const newToasts = [...prev, toast];
      if (newToasts.length > MAX_TOASTS) {
        // 移除最旧的非持久化Toast
        const oldestNonPersistent = newToasts.find(t => !t.persistent);
        if (oldestNonPersistent) {
          const timeout = timeouts.current.get(oldestNonPersistent.id);
          if (timeout) {
            clearTimeout(timeout);
            timeouts.current.delete(oldestNonPersistent.id);
          }
          return newToasts.filter(t => t.id !== oldestNonPersistent.id);
        }
        // 如果都是持久化Toast，移除最旧的
        return newToasts.slice(1);
      }
      return newToasts;
    });

    if (duration > 0 && !toast.persistent) {
      const timeout = setTimeout(() => {
        removeToast(id);
      }, duration);
      timeouts.current.set(id, timeout);
    }

    return id;
  }, [isDuplicateMessage]);

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
  const toastRef = useRef<HTMLDivElement>(null);

  // 键盘导航支持
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && toast.persistent) {
        event.preventDefault();
        onRemove(toast.id);
      }
    };

    if (toast.persistent && toastRef.current) {
      // 为持久化Toast添加键盘事件监听
      document.addEventListener('keydown', handleKeyDown);

      // 自动聚焦到Toast（仅限持久化Toast）
      toastRef.current.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [toast.persistent, toast.id, onRemove]);

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

  // 获取ARIA标签
  const getAriaLabel = () => {
    const typeLabels = {
      success: '成功通知',
      error: '错误通知',
      warning: '警告通知',
      info: '信息通知',
      loading: '加载通知',
      progress: '进度通知'
    };
    return `${typeLabels[toast.type || 'info']}: ${toast.message}`;
  };

  // 获取ARIA live属性
  const getAriaLive = () => {
    switch (toast.type) {
      case 'error':
        return 'assertive'; // 错误消息需要立即通知
      case 'warning':
        return 'assertive'; // 警告消息需要立即通知
      default:
        return 'polite'; // 其他消息礼貌通知
    }
  };

  return (
    <div
      ref={toastRef}
      role="alert"
      aria-live={getAriaLive()}
      aria-label={getAriaLabel()}
      tabIndex={toast.persistent ? 0 : -1}
      className={`pointer-events-auto min-w-[220px] max-w-sm rounded-lg shadow-enhanced-lg ${toastGlassClass} text-sm font-medium animate-toastSlideIn transition-all duration-300 hover:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-theme focus:ring-offset-2 ${getToastStyles()}`}
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
              className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 rounded-full transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-theme focus:ring-offset-2"
              onClick={() => onRemove(toast.id)}
              aria-label="关闭通知"
              title="按 ESC 键或点击关闭"
            >
              <i className="ri-close-line text-sm"></i>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}