/**
 * 增强的通知系统Hook
 * 提供各种类型的通知功能，包括进度通知、持久通知等
 */

import { useToast } from '../components/toast/Toast';
import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();

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
      label: t('cancel'),
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
  const networkError = useCallback((message?: string) => {
    const defaultMessage = message || t('notification.network_error');
    return error(defaultMessage, {
      action: {
        label: t('reload'),
        onClick: () => window.location.reload()
      }
    });
  }, [error, t]);

  // 操作确认通知
  const confirm = useCallback((message: string, onConfirm: () => void, onCancel?: () => void) => {
    return showPersistentToast(message, 'warning', {
      label: t('confirm'),
      onClick: () => {
        onConfirm();
        // Toast会在action执行后自动关闭
      }
    });
  }, [showPersistentToast, t]);

  // 文件上传进度通知
  const uploadProgress = useCallback((filename: string, percentage: number, onCancel?: () => void) => {
    return progress(
      `upload_${filename}`,
      t('notification.uploading', { filename }),
      percentage,
      { onCancel, showPercentage: true }
    );
  }, [progress, t]);

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

// 预定义的常用通知消息键名
export const NotificationKeys = {
  UPLOAD_SUCCESS: 'notification.upload_success',
  UPLOAD_FAILED: 'notification.upload_failed',
  SAVE_SUCCESS: 'notification.save_success',
  SAVE_FAILED: 'notification.save_failed',
  DELETE_SUCCESS: 'notification.delete_success',
  DELETE_FAILED: 'notification.delete_failed',
  COPY_SUCCESS: 'notification.copy_success',
  COPY_FAILED: 'notification.copy_failed',
  NETWORK_ERROR: 'notification.network_error',
  PERMISSION_DENIED: 'notification.permission_denied',
  OPERATION_CANCELLED: 'notification.operation_cancelled',
  LOADING: 'notification.loading',
  PROCESSING: 'notification.processing',
} as const;

// 获取国际化通知消息的辅助函数
export const useNotificationMessages = () => {
  const { t } = useTranslation();

  return {
    UPLOAD_SUCCESS: t(NotificationKeys.UPLOAD_SUCCESS),
    UPLOAD_FAILED: t(NotificationKeys.UPLOAD_FAILED),
    SAVE_SUCCESS: t(NotificationKeys.SAVE_SUCCESS),
    SAVE_FAILED: t(NotificationKeys.SAVE_FAILED),
    DELETE_SUCCESS: t(NotificationKeys.DELETE_SUCCESS),
    DELETE_FAILED: t(NotificationKeys.DELETE_FAILED),
    COPY_SUCCESS: t(NotificationKeys.COPY_SUCCESS),
    COPY_FAILED: t(NotificationKeys.COPY_FAILED),
    NETWORK_ERROR: t(NotificationKeys.NETWORK_ERROR),
    PERMISSION_DENIED: t(NotificationKeys.PERMISSION_DENIED),
    OPERATION_CANCELLED: t(NotificationKeys.OPERATION_CANCELLED),
    LOADING: t(NotificationKeys.LOADING),
    PROCESSING: t(NotificationKeys.PROCESSING),
  };
};
