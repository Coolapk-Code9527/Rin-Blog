import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * 错误边界组件
 * 
 * 捕获子组件中的JavaScript错误，包括DOM操作错误，
 * 防止错误导致整个应用崩溃
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // 更新state以显示错误UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 记录错误信息
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // 特别处理DOM操作错误
    if (error.name === 'NotFoundError' && error.message.includes('removeChild')) {
      console.warn('DOM removeChild error caught by ErrorBoundary - this is likely a component lifecycle issue');
    }
    
    // 调用外部错误处理函数
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      // 显示自定义错误UI或默认错误UI
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <h2 className="text-lg font-semibold text-red-800 mb-2">
              出现了一个错误
            </h2>
            <p className="text-red-600 mb-4">
              页面遇到了一个问题，请刷新页面重试。
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * 高阶组件：为组件添加错误边界
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, errorInfo: ErrorInfo) => void
) {
  const WithErrorBoundaryComponent = (props: P) => (
    <ErrorBoundary fallback={fallback} onError={onError}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  WithErrorBoundaryComponent.displayName = `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithErrorBoundaryComponent;
}

/**
 * Hook：在函数组件中处理错误
 */
export function useErrorHandler() {
  const handleError = React.useCallback((error: Error, context?: string) => {
    console.error(`Error in ${context || 'component'}:`, error);
    
    // 特别处理DOM操作错误
    if (error.name === 'NotFoundError' && error.message.includes('removeChild')) {
      console.warn('DOM removeChild error - attempting to continue gracefully');
      return; // 不抛出错误，让应用继续运行
    }
    
    // 对于其他错误，可以选择是否重新抛出
    // throw error;
  }, []);

  return { handleError };
}

/**
 * 安全的DOM操作包装器
 */
export const safeDOMOperation = {
  /**
   * 安全地移除子节点
   */
  removeChild: (parent: Node, child: Node): boolean => {
    try {
      if (parent && child && parent.contains(child)) {
        parent.removeChild(child);
        return true;
      }
      return false;
    } catch (error) {
      console.warn('Safe removeChild failed:', error);
      return false;
    }
  },

  /**
   * 安全地添加子节点
   */
  appendChild: (parent: Node, child: Node): boolean => {
    try {
      if (parent && child) {
        parent.appendChild(child);
        return true;
      }
      return false;
    } catch (error) {
      console.warn('Safe appendChild failed:', error);
      return false;
    }
  },

  /**
   * 安全地插入节点
   */
  insertBefore: (parent: Node, newNode: Node, referenceNode: Node | null): boolean => {
    try {
      if (parent && newNode) {
        parent.insertBefore(newNode, referenceNode);
        return true;
      }
      return false;
    } catch (error) {
      console.warn('Safe insertBefore failed:', error);
      return false;
    }
  }
};

/**
 * 全局错误处理器
 */
export const setupGlobalErrorHandlers = () => {
  // 捕获未处理的Promise拒绝
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    
    // 防止默认的控制台错误输出
    event.preventDefault();
  });

  // 捕获全局JavaScript错误
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    
    // 特别处理DOM操作错误
    if (event.error?.name === 'NotFoundError' && event.error?.message?.includes('removeChild')) {
      console.warn('Global DOM removeChild error caught - preventing crash');
      event.preventDefault();
    }
  });
};
