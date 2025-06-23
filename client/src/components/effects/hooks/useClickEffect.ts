/**
 * 鼠标点击特效自定义Hook
 * 
 * 管理点击特效的状态、生命周期和性能优化
 */

import { useEffect, useRef, useState, useCallback, useContext } from 'react';
import { ParticleSystem } from '../utils/particleSystem';
import { ClickEffectConfig, ThemeColors, PerformanceMetrics, DEFAULT_CLICK_EFFECT_CONFIG, MACOS_THEME_COLORS } from '../types/clickEffect';
import { ExtendedConfigContext } from '../../../context/ConfigContext';
import { useThemeOptimization } from '../../../hooks/useThemeOptimization';

/**
 * 点击特效Hook
 */
export const useClickEffect = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particleSystemRef = useRef<ParticleSystem | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    particleCount: 0,
    renderTime: 0,
    shouldDegrade: false,
  });

  // 获取主题信息
  const { themeInfo } = useThemeOptimization();
  const currentTheme = themeInfo.isDark ? 'dark' : 'light';

  // 获取扩展配置上下文（包含加载状态）
  const extendedConfig = useContext(ExtendedConfigContext);
  const config = extendedConfig?.config;
  const configLoaded = extendedConfig?.configLoaded ?? false;
  
  // 构建特效配置 - 修复逻辑错误，直接从配置读取enabled状态
  const effectConfig: ClickEffectConfig = {
    ...DEFAULT_CLICK_EFFECT_CONFIG,
    enabled: configLoaded && (config?.get<boolean>('clickEffect.enabled') ?? false),
    normalClickParticles: {
      min: config?.get<number>('clickEffect.normalClick.min') ?? DEFAULT_CLICK_EFFECT_CONFIG.normalClickParticles.min,
      max: config?.get<number>('clickEffect.normalClick.max') ?? DEFAULT_CLICK_EFFECT_CONFIG.normalClickParticles.max,
    },
    longPressParticles: {
      min: config?.get<number>('clickEffect.longPress.min') ?? DEFAULT_CLICK_EFFECT_CONFIG.longPressParticles.min,
      max: config?.get<number>('clickEffect.longPress.max') ?? DEFAULT_CLICK_EFFECT_CONFIG.longPressParticles.max,
    },
    longPressDelay: config?.get<number>('clickEffect.longPressDelay') ?? DEFAULT_CLICK_EFFECT_CONFIG.longPressDelay,
    maxParticles: config?.get<number>('clickEffect.maxParticles') ?? DEFAULT_CLICK_EFFECT_CONFIG.maxParticles,
    enableOnMobile: config?.get<boolean>('clickEffect.enableOnMobile') ?? DEFAULT_CLICK_EFFECT_CONFIG.enableOnMobile,
    mobileReduction: config?.get<number>('clickEffect.mobileReduction') ?? DEFAULT_CLICK_EFFECT_CONFIG.mobileReduction,
  };

  // 添加调试信息（仅在需要时启用）
  // useEffect(() => {
  //   if (process.env.NODE_ENV === 'development') {
  //     console.log('ClickEffect Debug:', {
  //       configLoaded,
  //       enabled: effectConfig.enabled,
  //       configValue: config?.get<boolean>('clickEffect.enabled'),
  //       isInitialized,
  //     });
  //   }
  // }, [configLoaded, effectConfig.enabled, config, isInitialized]);
  
  /**
   * 初始化粒子系统
   */
  const initializeParticleSystem = useCallback(() => {
    if (!canvasRef.current || particleSystemRef.current) {
      return;
    }

    try {
      const particleSystem = new ParticleSystem(
        canvasRef.current,
        effectConfig,
        MACOS_THEME_COLORS
      );

      particleSystemRef.current = particleSystem;
      setIsInitialized(true);

      // 如果启用，开始动画
      if (effectConfig.enabled) {
        particleSystem.start();
      }
    } catch (error) {
      console.error('Failed to initialize particle system:', error);
    }
  }, [effectConfig.enabled, effectConfig.maxParticles]);
  
  /**
   * 销毁粒子系统
   */
  const destroyParticleSystem = useCallback(() => {
    if (particleSystemRef.current) {
      particleSystemRef.current.destroy();
      particleSystemRef.current = null;
      setIsInitialized(false);
    }
  }, []);
  
  /**
   * 更新性能指标 - 简化版本，移除自动降级警告
   */
  const updateMetrics = useCallback(() => {
    if (particleSystemRef.current) {
      const newMetrics = particleSystemRef.current.getMetrics();
      setMetrics(newMetrics);

      // 移除自动性能降级警告，避免控制台噪音
      // 性能监控现在只用于统计，不做自动调整
    }
  }, [effectConfig.enabled]);
  
  /**
   * 切换特效状态
   */
  const toggleEffect = useCallback((enable: boolean) => {
    if (!particleSystemRef.current) return;
    
    if (enable) {
      particleSystemRef.current.start();
    } else {
      particleSystemRef.current.stop();
    }
  }, []);
  
  /**
   * 更新配置
   */
  const updateConfig = useCallback((newConfig: Partial<ClickEffectConfig>) => {
    if (particleSystemRef.current) {
      const updatedConfig = { ...effectConfig, ...newConfig };
      particleSystemRef.current.updateConfig(updatedConfig);
    }
  }, [effectConfig]);
  
  /**
   * 更新主题
   */
  const updateTheme = useCallback((theme: 'light' | 'dark') => {
    if (particleSystemRef.current) {
      particleSystemRef.current.updateTheme(theme);
    }
  }, []);
  
  // 初始化效果 - 确保配置加载完成后再初始化
  useEffect(() => {
    if (!configLoaded) {
      return;
    }

    if (effectConfig.enabled && !isInitialized && !particleSystemRef.current) {
      initializeParticleSystem();
    } else if (!effectConfig.enabled && isInitialized && particleSystemRef.current) {
      destroyParticleSystem();
    }
  }, [effectConfig.enabled, configLoaded]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (particleSystemRef.current) {
        destroyParticleSystem();
      }
    };
  }, []);
  
  // 主题变化处理
  useEffect(() => {
    if (particleSystemRef.current) {
      updateTheme(currentTheme);
    }
  }, [currentTheme]);

  // 配置变化处理 - 修复移动端开关不生效问题
  useEffect(() => {
    if (particleSystemRef.current) {
      particleSystemRef.current.updateConfig(effectConfig);
    }
  }, [
    effectConfig.enabled,
    effectConfig.enableOnMobile,
    effectConfig.maxParticles,
    effectConfig.normalClickParticles.min,
    effectConfig.normalClickParticles.max,
    effectConfig.longPressParticles.min,
    effectConfig.longPressParticles.max
  ]);
  
  // 性能监控
  useEffect(() => {
    if (!effectConfig.enabled || !isInitialized) return;
    
    const interval = setInterval(updateMetrics, 1000);
    return () => clearInterval(interval);
  }, [effectConfig.enabled, isInitialized, updateMetrics]);
  
  // 页面卸载清理
  useEffect(() => {
    return () => {
      destroyParticleSystem();
    };
  }, [destroyParticleSystem]);
  
  return {
    canvasRef,
    isInitialized,
    metrics,
    config: effectConfig,
    theme: currentTheme,
    toggleEffect,
    updateConfig,
    updateTheme,
  };
};

/**
 * 简化版Hook，仅用于启用/禁用特效
 */
export const useSimpleClickEffect = () => {
  return useClickEffect();
};
