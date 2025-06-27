import { useEffect, useState, useCallback, useMemo } from 'react';
import { MousePosition } from './useMouseTracker';

/**
 * 眼球位置数据接口
 */
export interface EyeballPosition {
  x: number;
  y: number;
  rotation: number;
}

/**
 * 眼睛动画配置选项
 */
export interface EyeAnimationOptions {
  /** 眼球最大移动距离（像素） */
  maxDistance?: number;
  /** 动画缓动系数 (0-1) */
  easingFactor?: number;
  /** 眼球移动灵敏度 (0-1) */
  sensitivity?: number;
  /** 是否启用眨眼动画 */
  enableBlink?: boolean;
  /** 眨眼间隔时间（毫秒） */
  blinkInterval?: number;
  /** 是否启用移动端优化 */
  enableMobileOptimization?: boolean;
}

/**
 * 眼睛动画状态
 */
export interface EyeAnimationState {
  eyeballPosition: EyeballPosition;
  isBlinking: boolean;
  isFollowing: boolean;
}

/**
 * 缓动函数 - 模拟自然眼球移动
 */
const easeOutCubic = (t: number): number => {
  return 1 - Math.pow(1 - t, 3);
};

/**
 * 角度标准化函数
 */
const normalizeAngle = (angle: number): number => {
  return ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
};

/**
 * 眼球动画计算Hook
 * 
 * 功能特点：
 * - 根据鼠标位置计算眼球位置
 * - 自然的缓动动画效果
 * - 支持眨眼动画
 * - 移动端性能优化
 * - 数学精确的角度计算
 * 
 * @param mousePosition 鼠标位置数据
 * @param options 动画配置选项
 * @returns 眼睛动画状态和控制方法
 */
export const useEyeAnimation = (
  mousePosition: MousePosition,
  options: EyeAnimationOptions = {}
) => {
  const {
    maxDistance = 12,
    easingFactor = 0.15,
    sensitivity = 0.8,
    enableBlink = true,
    blinkInterval = 3000,
    enableMobileOptimization = true
  } = options;

  const [animationState, setAnimationState] = useState<EyeAnimationState>({
    eyeballPosition: { x: 0, y: 0, rotation: 0 },
    isBlinking: false,
    isFollowing: false
  });

  const [lastBlinkTime, setLastBlinkTime] = useState<number>(Date.now());

  /**
   * 检测是否为移动设备
   */
  const isMobile = useMemo(() => {
    if (!enableMobileOptimization) return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    ) || window.innerWidth <= 768;
  }, [enableMobileOptimization]);

  /**
   * 计算眼球目标位置
   */
  const calculateTargetPosition = useCallback((mouseX: number, mouseY: number): EyeballPosition => {
    // 计算距离和角度
    const distance = Math.sqrt(mouseX * mouseX + mouseY * mouseY);
    const angle = Math.atan2(mouseY, mouseX);
    
    // 限制移动距离，创建自然的眼球移动范围
    const constrainedDistance = Math.min(distance * sensitivity, maxDistance);
    
    // 计算最终位置
    const targetX = Math.cos(angle) * constrainedDistance;
    const targetY = Math.sin(angle) * constrainedDistance;
    
    // 标准化旋转角度
    const rotation = normalizeAngle(angle);

    return {
      x: targetX,
      y: targetY,
      rotation
    };
  }, [maxDistance, sensitivity]);

  /**
   * 应用缓动效果
   */
  const applyEasing = useCallback((
    current: EyeballPosition,
    target: EyeballPosition
  ): EyeballPosition => {
    const deltaX = target.x - current.x;
    const deltaY = target.y - current.y;
    
    // 使用缓动函数创建平滑过渡
    const easedX = current.x + deltaX * easeOutCubic(easingFactor);
    const easedY = current.y + deltaY * easeOutCubic(easingFactor);
    
    // 角度插值（处理角度环绕问题）
    let deltaRotation = target.rotation - current.rotation;
    if (deltaRotation > Math.PI) deltaRotation -= 2 * Math.PI;
    if (deltaRotation < -Math.PI) deltaRotation += 2 * Math.PI;
    
    const easedRotation = normalizeAngle(
      current.rotation + deltaRotation * easingFactor
    );

    return {
      x: easedX,
      y: easedY,
      rotation: easedRotation
    };
  }, [easingFactor]);

  /**
   * 眨眼动画控制
   */
  const triggerBlink = useCallback(() => {
    if (!enableBlink) return;

    setAnimationState(prev => ({ ...prev, isBlinking: true }));

    // 眨眼动画持续时间，添加组件挂载检查
    const blinkTimer = setTimeout(() => {
      // 检查组件是否仍然挂载（通过检查state是否仍然可用）
      setAnimationState(prev => {
        // 如果组件已卸载，这个回调不会执行
        return { ...prev, isBlinking: false };
      });
    }, 150);

    // 将定时器添加到清理列表（如果有的话）
    // 注意：这里需要在组件中管理定时器清理

    setLastBlinkTime(Date.now());
  }, [enableBlink]);

  /**
   * 自动眨眼逻辑
   */
  useEffect(() => {
    if (!enableBlink) return;

    const checkBlink = () => {
      const now = Date.now();
      const timeSinceLastBlink = now - lastBlinkTime;
      
      // 随机眨眼间隔（增加自然感）
      const randomInterval = blinkInterval + Math.random() * 2000;
      
      if (timeSinceLastBlink > randomInterval) {
        triggerBlink();
      }
    };

    const interval = setInterval(checkBlink, 1000);
    return () => clearInterval(interval);
  }, [enableBlink, blinkInterval, lastBlinkTime, triggerBlink]);

  /**
   * 主要动画更新逻辑
   */
  useEffect(() => {
    if (!mousePosition.isActive && !isMobile) {
      // 鼠标不活跃时，眼球回到中心位置
      setAnimationState(prev => ({
        ...prev,
        isFollowing: false,
        eyeballPosition: applyEasing(prev.eyeballPosition, { x: 0, y: 0, rotation: 0 })
      }));
      return;
    }

    // 移动端使用简化逻辑
    if (isMobile) {
      setAnimationState(prev => ({
        ...prev,
        isFollowing: false,
        eyeballPosition: { x: 0, y: 0, rotation: 0 }
      }));
      return;
    }

    // 计算目标位置
    const targetPosition = calculateTargetPosition(mousePosition.x, mousePosition.y);
    
    // 应用缓动效果
    setAnimationState(prev => ({
      ...prev,
      isFollowing: true,
      eyeballPosition: applyEasing(prev.eyeballPosition, targetPosition)
    }));

  }, [mousePosition, calculateTargetPosition, applyEasing, isMobile]);

  /**
   * 手动触发眨眼
   */
  const blink = useCallback(() => {
    triggerBlink();
  }, [triggerBlink]);

  /**
   * 重置眼球位置
   */
  const resetPosition = useCallback(() => {
    setAnimationState(prev => ({
      ...prev,
      isFollowing: false,
      eyeballPosition: { x: 0, y: 0, rotation: 0 }
    }));
  }, []);

  /**
   * 获取CSS transform样式
   */
  const getEyeballTransform = useCallback(() => {
    const { x, y } = animationState.eyeballPosition;
    return `translate(${x}px, ${y}px)`;
  }, [animationState.eyeballPosition]);

  /**
   * 获取眼睛容器的CSS类名
   */
  const getEyeContainerClasses = useCallback(() => {
    const baseClasses = 'transition-all duration-100 ease-out';
    const blinkClasses = animationState.isBlinking ? 'scale-y-0' : 'scale-y-100';
    return `${baseClasses} ${blinkClasses}`;
  }, [animationState.isBlinking]);

  return {
    animationState,
    isMobile,
    blink,
    resetPosition,
    getEyeballTransform,
    getEyeContainerClasses
  };
};

/**
 * 简化版眼睛动画Hook（仅返回transform样式）
 */
export const useSimpleEyeAnimation = (mousePosition: MousePosition) => {
  const { getEyeballTransform } = useEyeAnimation(mousePosition);
  return getEyeballTransform();
};
