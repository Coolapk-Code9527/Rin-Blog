import React from 'react';

/**
 * 动画错误边界属性接口
 */
interface AnimationErrorBoundaryProps {
  /** 子组件 */
  children: React.ReactNode;
  /** 错误时的降级组件 */
  fallback?: React.ReactNode;
  /** 错误回调函数 */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** 是否在开发环境显示错误详情 */
  showErrorDetails?: boolean;
}

/**
 * 动画错误边界状态接口
 */
interface AnimationErrorBoundaryState {
  /** 是否有错误 */
  hasError: boolean;
  /** 错误对象 */
  error?: Error;
  /** 错误信息 */
  errorInfo?: React.ErrorInfo;
}

/**
 * 动画错误边界组件
 * 
 * 功能特点：
 * - 捕获动画组件中的JavaScript错误
 * - 提供优雅的降级方案
 * - 支持错误日志记录
 * - 开发环境显示详细错误信息
 * - 生产环境显示用户友好的错误界面
 * 
 * 使用场景：
 * - 包装动画组件防止崩溃
 * - 404页面动画组件的错误处理
 * - 复杂交互组件的错误边界
 */
export class AnimationErrorBoundary extends React.Component<
  AnimationErrorBoundaryProps,
  AnimationErrorBoundaryState
> {
  constructor(props: AnimationErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  /**
   * 捕获错误并更新状态
   */
  static getDerivedStateFromError(error: Error): AnimationErrorBoundaryState {
    return {
      hasError: true,
      error
    };
  }

  /**
   * 错误处理和日志记录
   */
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 更新状态包含错误信息
    this.setState({
      error,
      errorInfo
    });

    // 调用错误回调
    this.props.onError?.(error, errorInfo);

    // 开发环境下输出详细错误信息
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Animation Error Boundary');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Component Stack:', errorInfo.componentStack);
      console.groupEnd();
    }

    // 生产环境下记录错误（可以发送到错误监控服务）
    if (process.env.NODE_ENV === 'production') {
      // 这里可以集成错误监控服务，如 Sentry
      console.warn('Animation component error:', error.message);
    }
  }

  /**
   * 重置错误状态
   */
  resetError = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  /**
   * 渲染方法
   */
  render() {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback, showErrorDetails = false } = this.props;

    if (hasError) {
      // 如果提供了自定义降级组件，使用它
      if (fallback) {
        return fallback;
      }

      // 默认降级UI
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          {/* 错误图标 */}
          <div className="mb-4 text-6xl text-gray-400 dark:text-gray-600">
            <i className="ri-error-warning-line"></i>
          </div>

          {/* 错误标题 */}
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
            动画加载失败
          </h3>

          {/* 错误描述 */}
          <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-md">
            动画组件遇到了问题，已切换到静态模式。页面功能不受影响。
          </p>

          {/* 重试按钮 */}
          <button
            onClick={this.resetError}
            className="px-4 py-2 bg-theme text-white rounded-lg hover:bg-theme-hover transition-colors duration-200 flex items-center gap-2"
          >
            <i className="ri-refresh-line"></i>
            重试加载
          </button>

          {/* 开发环境错误详情 */}
          {showErrorDetails && process.env.NODE_ENV === 'development' && error && (
            <details className="mt-6 w-full max-w-2xl">
              <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                查看错误详情
              </summary>
              <div className="mt-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-left">
                <div className="text-sm font-mono text-red-800 dark:text-red-200">
                  <div className="font-bold mb-2">错误信息:</div>
                  <div className="mb-4">{error.message}</div>
                  
                  <div className="font-bold mb-2">错误堆栈:</div>
                  <pre className="whitespace-pre-wrap text-xs overflow-auto max-h-40">
                    {error.stack}
                  </pre>
                  
                  {errorInfo && (
                    <>
                      <div className="font-bold mb-2 mt-4">组件堆栈:</div>
                      <pre className="whitespace-pre-wrap text-xs overflow-auto max-h-40">
                        {errorInfo.componentStack}
                      </pre>
                    </>
                  )}
                </div>
              </div>
            </details>
          )}
        </div>
      );
    }

    return children;
  }
}

/**
 * 404页面专用错误边界组件
 * 提供更简洁的降级UI，适合404页面使用
 */
export const NotFoundErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  return (
    <AnimationErrorBoundary
      fallback={
        <div className="flex flex-col items-center justify-center">
          {/* 静态404显示 */}
          <div className="mb-6 text-8xl font-bold text-theme">
            404
          </div>
          <div className="text-gray-500 dark:text-gray-400 text-sm">
            动画加载失败，已切换到静态模式
          </div>
        </div>
      }
      onError={(error) => {
        // 404页面动画错误的特殊处理
        console.warn('404 page animation error:', error.message);
      }}
    >
      {children}
    </AnimationErrorBoundary>
  );
};

/**
 * 高阶组件：为组件添加错误边界
 */
export function withAnimationErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: React.ReactNode
) {
  const WithErrorBoundary = (props: P) => {
    return (
      <AnimationErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </AnimationErrorBoundary>
    );
  };

  WithErrorBoundary.displayName = `withAnimationErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithErrorBoundary;
}

/**
 * Hook：在函数组件中使用错误边界
 */
export const useErrorHandler = () => {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const handleError = React.useCallback((error: Error) => {
    setError(error);
    console.error('Component error:', error);
  }, []);

  // 如果有错误，抛出它让错误边界捕获
  if (error) {
    throw error;
  }

  return { handleError, resetError };
};

export default AnimationErrorBoundary;
