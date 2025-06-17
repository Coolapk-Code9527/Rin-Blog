/**
 * 增强的通知系统Hook
 * 提供各种类型的通知功能，包括进度通知、持久通知等
 */

import { useToast } from '../components/toast/Toast';
import { useCallback, useRef } from 'react';

export interface NotificationOptions {
  duration?: number;
  persistent?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ProgressNotificationOptions {
  onCancel?: () => void;
  showPercentage?: boolean;
}

export function useNotification() {
  const { showToast, showProgressToast, showPersistentToast, updateToast, removeToast } = useToast();
  const progressToasts = useRef<Map<string, number>>(new Map());

  // 基础通知
  const notify = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', options?: NotificationOptions) => {
    if (options?.persistent) {
      return showPersistentToast(message, type, options.action);
    }
    return showToast(message, type, options?.duration);
  }, [showToast, showPersistentToast]);

  // 成功通知
  const success = useCallback((message: string, options?: NotificationOptions) => {
    return notify(message, 'success', options);
  }, [notify]);

  // 错误通知
  const error = useCallback((message: string, options?: NotificationOptions) => {
    return notify(message, 'error', { ...options, persistent: true });
  }, [notify]);

  // 警告通知
  const warning = useCallback((message: string, options?: NotificationOptions) => {
    return notify(message, 'warning', options);
  }, [notify]);

  // 信息通知
  const info = useCallback((message: string, options?: NotificationOptions) => {
    return notify(message, 'info', options);
  }, [notify]);

  // 加载通知
  const loading = useCallback((message: string) => {
    return showPersistentToast(message, 'loading');
  }, [showPersistentToast]);

  // 进度通知
  const progress = useCallback((
    key: string, 
    message: string, 
    percentage: number, 
    options?: ProgressNotificationOptions
  ) => {
    const existingId = progressToasts.current.get(key);
    const action = options?.onCancel ? {
      label: '取消',
      onClick: options.onCancel
    } : undefined;

    const fullMessage = options?.showPercentage !== false 
      ? `${message} (${Math.round(percentage)}%)`
      : message;

    const toastId = showProgressToast(fullMessage, percentage, existingId);
    progressToasts.current.set(key, toastId);

    if (action && existingId) {
      updateToast(existingId, { action });
    }

    // 完成时自动移除
    if (percentage >= 100) {
      setTimeout(() => {
        removeToast(toastId);
        progressToasts.current.delete(key);
      }, 1000);
    }

    return toastId;
  }, [showProgressToast, updateToast, removeToast]);

  // 网络状态通知
  const networkError = useCallback((message: string = '网络连接失败，请检查网络设置') => {
    return error(message, {
      action: {
        label: '重试',
        onClick: () => window.location.reload()
      }
    });
  }, [error]);

  // 操作确认通知
  const confirm = useCallback((message: string, onConfirm: () => void, onCancel?: () => void) => {
    return showPersistentToast(message, 'warning', {
      label: '确认',
      onClick: () => {
        onConfirm();
        // Toast会在action执行后自动关闭
      }
    });
  }, [showPersistentToast]);

  // 文件上传进度通知
  const uploadProgress = useCallback((filename: string, percentage: number, onCancel?: () => void) => {
    return progress(
      `upload_${filename}`, 
      `正在上传 ${filename}`, 
      percentage,
      { onCancel, showPercentage: true }
    );
  }, [progress]);

  // 批量操作进度通知
  const batchProgress = useCallback((
    operation: string, 
    current: number, 
    total: number, 
    onCancel?: () => void
  ) => {
    const percentage = (current / total) * 100;
    return progress(
      `batch_${operation}`, 
      `${operation} (${current}/${total})`, 
      percentage,
      { onCancel, showPercentage: false }
    );
  }, [progress]);

  // 清理指定进度通知
  const clearProgress = useCallback((key: string) => {
    const toastId = progressToasts.current.get(key);
    if (toastId) {
      removeToast(toastId);
      progressToasts.current.delete(key);
    }
  }, [removeToast]);

  // 清理所有进度通知
  const clearAllProgress = useCallback(() => {
    progressToasts.current.forEach((toastId) => {
      removeToast(toastId);
    });
    progressToasts.current.clear();
  }, [removeToast]);

  return {
    // 基础通知
    notify,
    success,
    error,
    warning,
    info,
    loading,
    
    // 进度通知
    progress,
    uploadProgress,
    batchProgress,
    clearProgress,
    clearAllProgress,
    
    // 特殊通知
    networkError,
    confirm,
    
    // 底层控制
    updateToast,
    removeToast
  };
}

// 预定义的常用通知消息
export const NotificationMessages = {
  UPLOAD_SUCCESS: '文件上传成功',
  UPLOAD_FAILED: '文件上传失败',
  SAVE_SUCCESS: '保存成功',
  SAVE_FAILED: '保存失败',
  DELETE_SUCCESS: '删除成功',
  DELETE_FAILED: '删除失败',
  COPY_SUCCESS: '复制成功',
  COPY_FAILED: '复制失败',
  NETWORK_ERROR: '网络连接失败',
  PERMISSION_DENIED: '权限不足',
  OPERATION_CANCELLED: '操作已取消',
  LOADING: '正在加载...',
  PROCESSING: '正在处理...',
} as const;
