import React, { createContext, useContext } from 'react';
import { ConfigWrapper } from '../state/config';

/**
 * 扩展的配置上下文接口
 * 
 * 包含配置对象和加载状态，用于解决配置初始化时序问题
 */
export interface ExtendedConfigContextType {
  /** 配置包装器对象 */
  config: ConfigWrapper;
  /** 配置是否已从服务器加载完成 */
  configLoaded: boolean;
  /** 初始加载状态 - 用于控制首屏渲染 */
  initialLoading?: boolean;
}

/**
 * 扩展的配置上下文
 *
 * 提供配置对象和加载状态，解决侧边栏配置初始化时序问题
 */
export const ExtendedConfigContext = createContext<ExtendedConfigContextType | null>(null);

/**
 * 扩展配置上下文Provider组件
 */
export function ExtendedConfigProvider({ value, children }: {
  value: ExtendedConfigContextType;
  children: React.ReactNode;
}) {
  const Provider = ExtendedConfigContext.Provider as any;
  return (
    <Provider value={value}>
      {children}
    </Provider>
  );
}

/**
 * 使用扩展配置上下文的Hook
 * 
 * @returns 配置对象和加载状态
 * @throws 如果在Provider外使用会抛出错误
 * 
 * @example
 * ```tsx
 * const { config, configLoaded } = useExtendedConfig();
 * 
 * // 只有在配置确定加载后才执行某些操作
 * if (configLoaded) {
 *   const sidebarEnabled = getSidebarConfig(config).enabled;
 *   // ...
 * }
 * ```
 */
export function useExtendedConfig(): ExtendedConfigContextType {
  const context = useContext(ExtendedConfigContext);
  if (!context) {
    throw new Error('useExtendedConfig must be used within ExtendedConfigContext.Provider');
  }
  return context;
}

/**
 * 检查配置是否已确定加载的Hook
 * 
 * 用于组件中快速检查配置状态，避免在配置未确定时进行操作
 * 
 * @returns 配置是否已确定加载
 * 
 * @example
 * ```tsx
 * const isConfigReady = useConfigReady();
 * 
 * if (!isConfigReady) {
 *   return <LoadingSkeleton />;
 * }
 * 
 * // 配置已确定，可以安全使用
 * ```
 */
export function useConfigReady(): boolean {
  const context = useContext(ExtendedConfigContext);
  return context?.configLoaded ?? false;
}
