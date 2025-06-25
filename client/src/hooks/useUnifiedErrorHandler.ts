/**
 * 统一错误处理Hook
 * 提供一致的错误处理体验，支持错误分级和智能处理
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useGlobalDialog } from '../components/dialog';
import { useNotification } from './useNotification';

// 错误类型定义
export type ErrorType = 'critical' | 'important' | 'warning' | 'info';

// 错误处理选项
export interface ErrorHandlerOptions {
  type?: ErrorType;
  action?: {
    label: string;
    onClick: () => void;
  };
  persistent?: boolean;
  duration?: number;
}

// 预定义错误场景
export interface ErrorScenarios {
  network: (retryFn?: () => void) => void;
  permission: (redirectFn?: () => void) => void;
  validation: (message: string) => void;
  upload: (retryFn?: () => void) => void;
  save: (retryFn?: () => void) => void;
  delete: (retryFn?: () => void) => void;
}

/**
 * 统一错误处理Hook
 */
export function useUnifiedErrorHandler() {
  const { showAlert, showConfirm } = useGlobalDialog();
  const notification = useNotification();
  const { t } = useTranslation();

  /**
   * 核心错误处理方法
   */
  const handleError = useCallback((
    error: string | Error,
    options?: ErrorHandlerOptions
  ) => {
    const message = typeof error === 'string' ? error : error.message;
    const { type = 'important', action, persistent, duration } = options || {};

    switch (type) {
      case 'critical':
        // 关键错误：使用模态弹窗，强制用户关注
        return showAlert(message);

      case 'important':
        // 重要错误：使用持久Toast，可提供操作按钮
        return notification.error(message, {
          action,
          persistent: persistent !== false // 默认持久显示
        });

      case 'warning':
        // 警告：使用自动消失Toast
        return notification.warning(message, {
          action,
          duration: duration || 5000
        });

      case 'info':
        // 信息：使用自动消失Toast
        return notification.info(message, {
          action,
          duration: duration || 3000
        });

      default:
        return notification.error(message, { action, persistent: true });
    }
  }, [showAlert, notification]);

  /**
   * 智能错误类型判断
   */
  const getErrorType = useCallback((error: string | Error): ErrorType => {
    const message = typeof error === 'string' ? error : error.message;
    const lowerMessage = message.toLowerCase();

    // 权限相关错误 -> critical
    if (lowerMessage.includes('unauthorized') || 
        lowerMessage.includes('permission') ||
        lowerMessage.includes('权限') ||
        lowerMessage.includes('登录')) {
      return 'critical';
    }

    // 网络相关错误 -> important
    if (lowerMessage.includes('network') ||
        lowerMessage.includes('fetch') ||
        lowerMessage.includes('网络') ||
        lowerMessage.includes('连接')) {
      return 'important';
    }

    // 验证相关错误 -> warning
    if (lowerMessage.includes('validation') ||
        lowerMessage.includes('invalid') ||
        lowerMessage.includes('验证') ||
        lowerMessage.includes('格式')) {
      return 'warning';
    }

    // 默认为重要错误
    return 'important';
  }, []);

  /**
   * 智能错误处理（自动判断类型）
   */
  const handleSmartError = useCallback((
    error: string | Error,
    options?: Omit<ErrorHandlerOptions, 'type'>
  ) => {
    const errorType = getErrorType(error);
    return handleError(error, { ...options, type: errorType });
  }, [handleError, getErrorType]);

  /**
   * 预定义错误场景处理
   */
  const scenarios: ErrorScenarios = {
    // 网络错误
    network: useCallback((retryFn?: () => void) => {
      return handleError(t('notification.network_error'), {
        type: 'important',
        action: retryFn ? {
          label: t('reload'),
          onClick: retryFn
        } : {
          label: t('reload'),
          onClick: () => window.location.reload()
        }
      });
    }, [handleError, t]),

    // 权限错误
    permission: useCallback((redirectFn?: () => void) => {
      return handleError(t('notification.permission_denied'), {
        type: 'critical'
      });
    }, [handleError, t]),

    // 验证错误
    validation: useCallback((message: string) => {
      return handleError(message, {
        type: 'warning',
        duration: 4000
      });
    }, [handleError]),

    // 上传错误
    upload: useCallback((retryFn?: () => void) => {
      return handleError(t('notification.upload_failed'), {
        type: 'important',
        action: retryFn ? {
          label: t('reload'),
          onClick: retryFn
        } : undefined
      });
    }, [handleError, t]),

    // 保存错误
    save: useCallback((retryFn?: () => void) => {
      return handleError(t('notification.save_failed'), {
        type: 'important',
        action: retryFn ? {
          label: t('reload'),
          onClick: retryFn
        } : undefined
      });
    }, [handleError, t]),

    // 删除错误
    delete: useCallback((retryFn?: () => void) => {
      return handleError(t('notification.delete_failed'), {
        type: 'important',
        action: retryFn ? {
          label: t('reload'),
          onClick: retryFn
        } : undefined
      });
    }, [handleError, t])
  };

  /**
   * 成功反馈
   */
  const handleSuccess = useCallback((message: string, options?: {
    action?: ErrorHandlerOptions['action'];
    duration?: number;
  }) => {
    return notification.success(message, {
      action: options?.action,
      duration: options?.duration || 3000
    });
  }, [notification]);

  return {
    // 核心方法
    handleError,
    handleSmartError,
    handleSuccess,
    
    // 预定义场景
    scenarios,
    
    // 工具方法
    getErrorType,
    
    // 向后兼容（保留原有API）
    showAlert,
    showConfirm,
    notification
  };
}

export default useUnifiedErrorHandler;
