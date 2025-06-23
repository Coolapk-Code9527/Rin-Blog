/**
 * 鼠标点击特效系统类型定义
 * 
 * 为Rin博客系统提供完整的点击特效类型支持
 */

/**
 * 粒子对象接口
 */
export interface Particle {
  /** 唯一标识符 */
  id: string;
  /** X坐标 */
  x: number;
  /** Y坐标 */
  y: number;
  /** X方向速度 */
  vx: number;
  /** Y方向速度 */
  vy: number;
  /** 粒子半径 */
  radius: number;
  /** 粒子颜色 */
  color: string;
  /** 当前生命值 */
  life: number;
  /** 最大生命值 */
  maxLife: number;
  /** 角度 */
  angle: number;
  /** 速度倍数 */
  multiplier: number;
}

/**
 * 点击特效配置接口
 */
export interface ClickEffectConfig {
  /** 是否启用特效 */
  enabled: boolean;
  /** 普通点击粒子数量范围 */
  normalClickParticles: {
    min: number;
    max: number;
  };
  /** 长按粒子数量范围 */
  longPressParticles: {
    min: number;
    max: number;
  };
  /** 长按触发时间（毫秒） */
  longPressDelay: number;
  /** 最大同时存在粒子数 */
  maxParticles: number;
  /** 粒子大小范围 */
  particleSize: {
    min: number;
    max: number;
  };
  /** 粒子生命周期（帧数） */
  particleLifetime: number;
  /** 是否在移动端启用 */
  enableOnMobile: boolean;
  /** 移动端粒子数量减少比例 */
  mobileReduction: number;
}

/**
 * 主题颜色配置接口
 */
export interface ThemeColors {
  /** 浅色主题粒子颜色 */
  light: string[];
  /** 深色主题粒子颜色 */
  dark: string[];
}

/**
 * 点击特效上下文接口
 */
export interface ClickEffectContextType {
  /** 是否启用特效 */
  enabled: boolean;
  /** 当前主题 */
  theme: 'light' | 'dark';
  /** 配置对象 */
  config: ClickEffectConfig;
  /** 切换特效开关 */
  toggleEffect: (enabled: boolean) => void;
  /** 更新配置 */
  updateConfig: (config: Partial<ClickEffectConfig>) => void;
}

/**
 * Canvas组件属性接口
 */
export interface ClickEffectCanvasProps {
  /** 是否启用特效 */
  enabled: boolean;
  /** 当前主题 */
  theme: 'light' | 'dark';
  /** 配置对象 */
  config: ClickEffectConfig;
  /** 主题颜色配置 */
  themeColors: ThemeColors;
}

/**
 * 性能监控接口
 */
export interface PerformanceMetrics {
  /** 当前FPS */
  fps: number;
  /** 当前粒子数量 */
  particleCount: number;
  /** 渲染时间（毫秒） */
  renderTime: number;
  /** 是否需要降级 */
  shouldDegrade: boolean;
}

/**
 * 事件处理器类型
 */
export type ClickEventHandler = (event: MouseEvent | TouchEvent) => void;
export type ResizeEventHandler = () => void;
export type VisibilityChangeHandler = () => void;

/**
 * 默认配置常量
 */
export const DEFAULT_CLICK_EFFECT_CONFIG: ClickEffectConfig = {
  enabled: false,
  normalClickParticles: {
    min: 8,
    max: 15,
  },
  longPressParticles: {
    min: 20,
    max: 35,
  },
  longPressDelay: 500,
  maxParticles: 100,
  particleSize: {
    min: 4,
    max: 10,
  },
  particleLifetime: 120, // 延长到2秒，更优雅
  enableOnMobile: true,
  mobileReduction: 0.6,
};

/**
 * macOS风格主题颜色
 */
export const MACOS_THEME_COLORS: ThemeColors = {
  light: [
    '#007AFF', // 系统蓝
    '#34C759', // 系统绿
    '#FF9F0A', // 系统橙
    '#FF3B30', // 系统红
    '#5856D6', // 系统紫
    '#00C7BE', // 系统青
  ],
  dark: [
    '#0A84FF', // 深色模式蓝
    '#30D158', // 深色模式绿
    '#FF9F0A', // 深色模式橙
    '#FF453A', // 深色模式红
    '#5E5CE6', // 深色模式紫
    '#64D2FF', // 深色模式青
  ],
};
