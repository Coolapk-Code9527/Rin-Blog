/**
 * 鼠标点击特效Canvas组件
 * 
 * 提供高性能的点击特效渲染，支持主题适配和性能优化
 */

import { useEffect, useRef } from 'react';
import { useClickEffect } from './hooks/useClickEffect';
import { ClickEffectCanvasProps } from './types/clickEffect';

/**
 * 点击特效Canvas组件
 */
export const ClickEffectCanvas = ({
  enabled,
  theme,
  config,
  themeColors,
}) => {
  const { canvasRef, isInitialized, metrics } = useClickEffect();
  
  // 移除调试代码，保持简洁
  
  // 如果特效未启用，不渲染Canvas
  if (!enabled) {
    return null;
  }
  
  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 99999,
      }}
      aria-hidden="true"
      role="presentation"
    />
  );
};

/**
 * 简化版点击特效组件
 * 
 * 自动从配置中读取设置，无需手动传递参数
 */
export const SimpleClickEffectCanvas = () => {
  const { canvasRef, config, theme, isInitialized } = useClickEffect();
  
  if (!config.enabled) {
    return null;
  }
  
  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 99999,
      }}
      aria-hidden="true"
      role="presentation"
    />
  );
};

export default ClickEffectCanvas;
