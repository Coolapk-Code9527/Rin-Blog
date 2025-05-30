import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

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
      <div className="fixed top-5 right-5 z-[12050] flex flex-col gap-3 items-end pointer-events-none select-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto min-w-[220px] max-w-xs px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium animate-fadeIn
              ${toast.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/80 dark:text-green-200' : ''}
              ${toast.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/80 dark:text-red-200' : ''}
              ${toast.type === 'info' ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/80 dark:text-blue-200' : ''}
              ${toast.type === 'warning' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/80 dark:text-yellow-200' : ''}
            `}
            style={{ boxShadow: '0 4px 24px 0 rgba(0,0,0,0.08)' }}
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