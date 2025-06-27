import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { ConfigWrapper, defaultClientConfig } from '../state/config';
import { client } from '../main';

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
          // 图片加载成功，更新状态
          setState(prev => ({
            ...prev,
            isImageLoaded: true
          }));
        })
        .catch((error) => {
          console.warn('Background image load failed:', error.message);
          // 图片加载失败，记录错误但不影响用户体验
          setState(prev => ({
            ...prev,
            isImageLoaded: false,
            error: error.message,
            retryCount: (prev.retryCount || 0) + 1
          }));

          // 可选：尝试降级到默认背景
          // 这里可以设置一个默认的背景图片URL作为fallback
        });
    }
  }, [preloadImage]);

  // 从配置加载背景状态 - 异步优化
  const loadFromConfig = useCallback((configWrapper: ConfigWrapper) => {
    const enabled = configWrapper.get<boolean>('background.enabled') === true;
    const url = configWrapper.get<string>('background.url') || '';
    updateConfig(enabled, url); // 不再等待，立即返回
  }, [updateConfig]);

  // 初始化配置加载
  useEffect(() => {
    const loadConfig = async () => {
      const config = sessionStorage.getItem('config');
      if (config) {
        try {
          const configObj = JSON.parse(config);
          if (!('background.enabled' in configObj)) configObj['background.enabled'] = false;
          if (!('background.url' in configObj)) configObj['background.url'] = '';
          const configWrapper = new ConfigWrapper(configObj, defaultClientConfig);
          loadFromConfig(configWrapper);
        } catch (error) {
          console.error('Failed to parse config:', error);
          loadFromServer();
        }
      } else {
        loadFromServer();
      }
    };

    const loadFromServer = async () => {
      try {
        const { data } = await client.config({ type: "client" }).get();
        if (data && typeof data !== 'string') {
          if (!('background.enabled' in data)) data['background.enabled'] = false;
          if (!('background.url' in data)) data['background.url'] = '';
          sessionStorage.setItem('config', JSON.stringify(data));
          const configWrapper = new ConfigWrapper(data, defaultClientConfig);
          loadFromConfig(configWrapper);
        }
      } catch (error) {
        console.error('Failed to load config from server:', error);
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };

    loadConfig();
  }, [loadFromConfig]);

  // 监听配置更新事件
  useEffect(() => {
    const handleConfigUpdate = async () => {
      const config = sessionStorage.getItem('config');
      if (config) {
        try {
          const configObj = JSON.parse(config);
          const configWrapper = new ConfigWrapper(configObj, defaultClientConfig);
          loadFromConfig(configWrapper);
        } catch (error) {
          console.error('Failed to handle config update:', error);
        }
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'config') {
        handleConfigUpdate();
      }
    };

    window.addEventListener('configUpdated', handleConfigUpdate);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('configUpdated', handleConfigUpdate);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [loadFromConfig]);

  const Provider = BackgroundContext.Provider as any;
  return (
    <Provider value={{ state, updateConfig }}>
      {children}
    </Provider>
  );
};
