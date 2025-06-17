import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { ConfigWrapper, defaultClientConfig } from '../state/config';
import { client } from '../main';

interface BackgroundState {
  enabled: boolean;
  url: string;
  isLoading: boolean;
  isImageLoaded: boolean;
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
    isImageLoaded: false
  });

  // 预加载图片
  const preloadImage = useCallback((url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!url) {
        resolve();
        return;
      }
      
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = url;
    });
  }, []);

  // 更新背景配置
  const updateConfig = useCallback(async (enabled: boolean, url: string) => {
    setState(prev => ({ ...prev, isLoading: true, isImageLoaded: false }));
    
    try {
      if (enabled && url) {
        await preloadImage(url);
      }
      
      setState({
        enabled,
        url,
        isLoading: false,
        isImageLoaded: enabled && !!url
      });
    } catch (error) {
      console.error('Failed to load background image:', error);
      setState({
        enabled: false,
        url: '',
        isLoading: false,
        isImageLoaded: false
      });
    }
  }, [preloadImage]);

  // 从配置加载背景状态
  const loadFromConfig = useCallback(async (configWrapper: ConfigWrapper) => {
    const enabled = configWrapper.get<boolean>('background.enabled') === true;
    const url = configWrapper.get<string>('background.url') || '';
    await updateConfig(enabled, url);
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
          await loadFromConfig(configWrapper);
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
          await loadFromConfig(configWrapper);
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
          await loadFromConfig(configWrapper);
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
