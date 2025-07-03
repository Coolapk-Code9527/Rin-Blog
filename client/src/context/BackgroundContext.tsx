import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { ClientConfigContext } from '../state/config';
import { getBackgroundConfig } from '../utils/sidebarConfig';

interface BackgroundState {
  enabled: boolean;
  url: string;
  isLoading: boolean;
  isImageLoaded: boolean;
  error?: string; // 添加错误信息
  retryCount?: number; // 添加重试计数
}

interface BackgroundContextType {
  state: BackgroundState;
  updateConfig: (enabled: boolean, url: string) => void;
}

interface BackgroundProviderProps {
  children: ReactNode;
}

const BackgroundContext = createContext<BackgroundContextType | undefined>(undefined);

export const useBackground = () => {
  const context = useContext(BackgroundContext);
  if (!context) {
    throw new Error('useBackground must be used within BackgroundProvider');
  }
  return context;
};

export const BackgroundProvider = ({ children }: BackgroundProviderProps) => {
  const [state, setState] = useState<BackgroundState>({
    enabled: false,
    url: '',
    isLoading: true,
    isImageLoaded: false,
    error: undefined,
    retryCount: 0
  });

  // 添加组件卸载检查，防止内存泄漏
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 预加载图片 - 修复重试机制
  const preloadImage = useCallback((url: string, retryCount = 0): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!url) {
        resolve();
        return;
      }

      const img = new Image();
      let isResolved = false;

      // 设置超时
      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          img.onload = null;
          img.onerror = null;

          const maxRetries = 2;
          if (retryCount < maxRetries) {
            // 超时重试
            const delay = (retryCount + 1) * 1500; // 递增延迟
            setTimeout(() => {
              preloadImage(url, retryCount + 1)
                .then(resolve)
                .catch(reject);
            }, delay);
          } else {
            reject(new Error(`Background image load timeout after ${maxRetries + 1} attempts`));
          }
        }
      }, 8000); // 8秒超时，给网络更多时间

      img.onload = () => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeout);
          resolve();
        }
      };

      img.onerror = () => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeout);

          const maxRetries = 2;
          if (retryCount < maxRetries) {
            // 错误重试，延迟递增
            const delay = (retryCount + 1) * 1000;
            setTimeout(() => {
              preloadImage(url, retryCount + 1)
                .then(resolve)
                .catch(reject);
            }, delay);
          } else {
            reject(new Error(`Failed to load background image after ${maxRetries + 1} attempts`));
          }
        }
      };

      img.src = url;
    });
  }, []);

  // 更新背景配置 - 异步预加载优化
  const updateConfig = useCallback((enabled: boolean, url: string) => {
    // 立即更新状态，不等待图片加载
    setState({
      enabled,
      url,
      isLoading: false,
      isImageLoaded: false, // 初始设为false，图片加载完成后更新
      error: undefined,
      retryCount: 0
    });

    // 异步预加载图片，不阻塞主流程
    if (enabled && url) {
      preloadImage(url)
        .then(() => {
          // 图片加载成功，更新状态（检查组件是否仍然挂载）
          if (isMountedRef.current) {
            setState(prev => ({
              ...prev,
              isImageLoaded: true
            }));
          }
        })
        .catch((error) => {
          console.warn('Background image load failed:', error.message);
          // 图片加载失败，记录错误但不影响用户体验（检查组件是否仍然挂载）
          if (isMountedRef.current) {
            setState(prev => ({
              ...prev,
              isImageLoaded: false,
              error: error.message,
              retryCount: (prev.retryCount || 0) + 1
            }));
          }

          // 可选：尝试降级到默认背景
          // 这里可以设置一个默认的背景图片URL作为fallback
        });
    }
  }, [preloadImage]);

  // 使用标准的配置获取模式，与其他Context保持一致
  const config = useContext(ClientConfigContext);
  const backgroundConfig = getBackgroundConfig(config);

  // 从配置加载背景状态 - 使用标准模式
  const loadFromConfig = useCallback(() => {
    // 直接调用updateConfig，它会正确处理isLoading状态
    updateConfig(backgroundConfig.enabled, backgroundConfig.url);
  }, [backgroundConfig.enabled, backgroundConfig.url, updateConfig]);

  // 监听配置变化，自动更新背景状态
  useEffect(() => {
    loadFromConfig();
  }, [loadFromConfig]);

  // 配置更新现在由ExtendedConfigContext自动处理，无需手动监听

  const Provider = BackgroundContext.Provider as any;
  return (
    <Provider value={{ state, updateConfig }}>
      {children}
    </Provider>
  );
};
