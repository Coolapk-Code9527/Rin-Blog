import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { MODAL_Z_INDEX } from '../../utils/modal-config';

export type ToastType = 'success' | 'error' | 'info' | 'warning';
export interface ToastItem {
  id: number;
  message: string;
  type?: ToastType;
  duration?: number;
}

interface ToastContextProps {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
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

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, message, type, duration }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // @ts-ignore
  return React.createElement(
    ToastContext.Provider as any,
    { value: { showToast } },
    <>
      {children}
      <div
        className="fixed top-5 right-5 flex flex-col gap-3 items-end pointer-events-none select-none"
        style={{ zIndex: MODAL_Z_INDEX.CRITICAL }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto min-w-[220px] max-w-xs px-4 py-3 rounded-lg shadow-enhanced-lg backdrop-blur-md flex items-center gap-2 text-sm font-medium animate-fadeIn transition-all duration-300 hover:scale-[0.98]
              ${toast.type === 'success' ? 'bg-green-50/95 text-green-700 border border-green-200/60 dark:bg-green-900/90 dark:text-green-200 dark:border-green-700/60' : ''}
              ${toast.type === 'error' ? 'bg-red-50/95 text-red-700 border border-red-200/60 dark:bg-red-900/90 dark:text-red-200 dark:border-red-700/60' : ''}
              ${toast.type === 'info' ? 'bg-blue-50/95 text-blue-700 border border-blue-200/60 dark:bg-blue-900/90 dark:text-blue-200 dark:border-blue-700/60' : ''}
              ${toast.type === 'warning' ? 'bg-yellow-50/95 text-yellow-700 border border-yellow-200/60 dark:bg-yellow-900/90 dark:text-yellow-200 dark:border-yellow-700/60' : ''}
            `}
          >
            <i className={`ri-${toast.type === 'success' ? 'checkbox-circle-line' : toast.type === 'error' ? 'close-circle-line' : toast.type === 'warning' ? 'error-warning-line' : 'information-line'} text-lg`}></i>
            <span className="flex-1 truncate">{toast.message}</span>
            <button
              className="ml-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 rounded-full pointer-events-auto"
              onClick={() => removeToast(toast.id)}
              aria-label="关闭"
            >
              <i className="ri-close-line"></i>
            </button>
          </div>
        ))}
      </div>
    </>
  );
} 