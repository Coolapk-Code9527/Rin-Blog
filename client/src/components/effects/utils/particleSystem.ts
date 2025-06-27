/**
 * 粒子系统核心逻辑
 *
 * 提供高性能的粒子生成、更新和渲染功能
 */

import { Particle, ClickEffectConfig, ThemeColors, PerformanceMetrics } from '../types/clickEffect';
import { MODAL_Z_INDEX } from '../../../utils/modal-config';

// 全局实例计数器，防止多个实例
let instanceCount = 0;

/**
 * 粒子系统类
 */
export class ParticleSystem {
  private particles: Particle[] = [];
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animationId: number | null = null;
  private lastTime = 0;

  // 简化的性能监控
  private metrics: PerformanceMetrics = {
    fps: 60,
    particleCount: 0,
    renderTime: 0,
    shouldDegrade: false,
  };
  
  // 配置
  private config: ClickEffectConfig;
  private themeColors: ThemeColors;
  private currentTheme: 'light' | 'dark' = 'light';
  
  // 长按状态
  private longPressed = false;
  private longPressTimer: NodeJS.Timeout | null = null;
  private multiplier = 0;

  // 设备信息
  private isMobile = false;
  private devicePixelRatio = 1;

  // 防止重复事件
  private lastEventTime = 0;
  private eventThrottle = 50; // 50ms内的重复事件将被忽略
  private lastEventType = ''; // 记录最后一个事件类型，防止鼠标和触摸冲突

  // 性能统计（仅用于监控，不做自动调整）
  private frameCount = 0; // 帧计数器（用于统计）

  // 预绑定的事件处理器，确保引用一致，解决事件监听器泄漏问题
  private readonly boundHandlers = {
    mouseDown: this.handleMouseDown.bind(this),
    mouseUp: this.handleMouseUp.bind(this),
    touchStart: this.handleTouchStart.bind(this),
    touchEnd: this.handleTouchEnd.bind(this),
    resize: this.handleResize.bind(this),
    visibilityChange: this.handleVisibilityChange.bind(this),
  };
  
  constructor(canvas: HTMLCanvasElement, config: ClickEffectConfig, themeColors: ThemeColors) {
    instanceCount++;
    // console.log(`ClickEffect: Initializing ParticleSystem #${instanceCount}...`, { config, themeColors });

    if (instanceCount > 1) {
      console.warn(`ClickEffect: Multiple ParticleSystem instances detected! Count: ${instanceCount}`);
    }

    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('ClickEffect: Failed to get 2D context from canvas');
    }
    this.ctx = ctx;
    this.config = config;
    this.themeColors = themeColors;

    this.detectDevice();
    this.setupCanvas();
    this.bindEvents();

    // console.log(`ClickEffect: ParticleSystem #${instanceCount} initialized successfully`);
  }
  
  /**
   * 检测设备类型
   */
  private detectDevice(): void {
    // 更准确的移动端检测
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                   ('ontouchstart' in window) ||
                   (window.innerWidth <= 768);

    this.devicePixelRatio = window.devicePixelRatio || 1;

    // 移动端初始优化（较轻微）
    if (this.isMobile) {
      this.eventThrottle = 80; // 移动端稍长的节流时间
      // console.log('ClickEffect: Mobile device detected, will monitor performance');
    }
  }
  
  /**
   * 设置Canvas
   */
  private setupCanvas(): void {
    this.updateCanvasSize();

    // 设置Canvas样式 - 使用正确的z-index常量
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = String(MODAL_Z_INDEX.CRITICAL);

    // 预热Canvas，减少第一次渲染的延迟
    this.warmupCanvas();

    // console.log('ClickEffect: Canvas setup completed with z-index:', MODAL_Z_INDEX.CRITICAL);
  }

  /**
   * 预热Canvas，减少第一次渲染的延迟
   */
  private warmupCanvas(): void {
    this.ctx.save();

    // 预先设置一些常用的Canvas状态
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    // 执行多次渲染操作，充分预热Canvas和GPU
    for (let i = 0; i < 5; i++) {
      this.ctx.globalAlpha = 0.5;
      this.ctx.fillStyle = '#007AFF';
      this.ctx.beginPath();
      this.ctx.arc(i * 10, i * 10, 5, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();

    // 清空预热内容
    this.clearCanvas();

    // 预启动动画循环，但不渲染任何内容
    this.lastTime = performance.now();
  }
  
  /**
   * 更新Canvas尺寸
   */
  private updateCanvasSize(): void {
    // 重置变换矩阵，防止缩放累积
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);

    const width = window.innerWidth;
    const height = window.innerHeight;

    this.canvas.width = width * this.devicePixelRatio;
    this.canvas.height = height * this.devicePixelRatio;
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';

    // 重新应用缩放变换
    this.ctx.scale(this.devicePixelRatio, this.devicePixelRatio);

    // console.log('ClickEffect: Canvas size updated', {
    //   width,
    //   height,
    //   devicePixelRatio: this.devicePixelRatio,
    //   canvasWidth: this.canvas.width,
    //   canvasHeight: this.canvas.height
    // });
  }
  
  /**
   * 绑定事件 - 使用预绑定的处理器，确保可以正确移除
   */
  private bindEvents(): void {
    // console.log('ClickEffect: Binding events...');

    // 鼠标事件
    document.addEventListener('mousedown', this.boundHandlers.mouseDown);
    document.addEventListener('mouseup', this.boundHandlers.mouseUp);

    // 触摸事件
    document.addEventListener('touchstart', this.boundHandlers.touchStart);
    document.addEventListener('touchend', this.boundHandlers.touchEnd);

    // 窗口大小变化
    window.addEventListener('resize', this.boundHandlers.resize);

    // 页面可见性变化
    document.addEventListener('visibilitychange', this.boundHandlers.visibilityChange);

    // console.log('ClickEffect: Events bound successfully');
  }
  
  /**
   * 处理鼠标按下
   */
  private handleMouseDown(event: MouseEvent): void {
    if (!this.config.enabled) {
      // console.log('ClickEffect: Mouse down ignored - effect disabled');
      return;
    }

    // 防止重复事件和鼠标触摸冲突
    const now = Date.now();
    if (now - this.lastEventTime < this.eventThrottle) {
      // console.log('ClickEffect: Mouse down throttled');
      return;
    }

    // 如果最近有触摸事件，忽略鼠标事件
    if (this.lastEventType === 'touch' && now - this.lastEventTime < 300) {
      // console.log('ClickEffect: Mouse down ignored - recent touch event');
      return;
    }

    this.lastEventTime = now;
    this.lastEventType = 'mouse';

    // console.log('ClickEffect: Mouse down at', event.clientX, event.clientY);
    this.startLongPressTimer();
    this.createParticles(event.clientX, event.clientY, false);
  }
  
  /**
   * 处理鼠标抬起
   */
  private handleMouseUp(event: MouseEvent): void {
    if (!this.config.enabled) return;
    
    this.clearLongPressTimer();
    
    if (this.longPressed) {
      this.createParticles(event.clientX, event.clientY, true);
      this.longPressed = false;
    }
  }
  
  /**
   * 处理触摸开始
   */
  private handleTouchStart(event: TouchEvent): void {
    // console.log('ClickEffect: Touch start event', {
    //   enabled: this.config.enabled,
    //   enableOnMobile: this.config.enableOnMobile,
    //   isMobile: this.isMobile
    // });

    if (!this.config.enabled) {
      // console.log('ClickEffect: Touch ignored - effect disabled');
      return;
    }

    if (!this.config.enableOnMobile) {
      // console.log('ClickEffect: Touch ignored - mobile disabled');
      return;
    }

    // 防止重复事件
    const now = Date.now();
    if (now - this.lastEventTime < this.eventThrottle) {
      // console.log('ClickEffect: Touch start throttled');
      return;
    }

    this.lastEventTime = now;
    this.lastEventType = 'touch';

    const touch = event.touches[0];
    if (touch) {
      // console.log('ClickEffect: Touch start at', touch.clientX, touch.clientY);
      this.startLongPressTimer();
      this.createParticles(touch.clientX, touch.clientY, false);
    }
  }
  
  /**
   * 处理触摸结束
   */
  private handleTouchEnd(event: TouchEvent): void {
    if (!this.config.enabled || !this.config.enableOnMobile) return;
    
    this.clearLongPressTimer();
    
    if (this.longPressed) {
      const touch = event.changedTouches[0];
      if (touch) {
        this.createParticles(touch.clientX, touch.clientY, true);
      }
      this.longPressed = false;
    }
  }
  
  /**
   * 开始长按计时器
   */
  private startLongPressTimer(): void {
    this.longPressTimer = setTimeout(() => {
      this.longPressed = true;
    }, this.config.longPressDelay);
  }
  
  /**
   * 清除长按计时器
   */
  private clearLongPressTimer(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }
  
  /**
   * 创建粒子 - 优化版本，减少第一次创建的计算开销
   */
  private createParticles(x: number, y: number, isLongPress: boolean): void {
    // 预先计算常用值，减少重复计算
    const colors = this.themeColors[this.currentTheme];
    const particleRange = isLongPress ? this.config.longPressParticles : this.config.normalClickParticles;
    let count = this.randomBetween(particleRange.min, particleRange.max);

    // 移动端减少粒子数量
    if (this.isMobile) {
      count = Math.floor(count * this.config.mobileReduction);
    }

    // 检查粒子数量限制
    if (this.particles.length + count > this.config.maxParticles) {
      count = Math.max(0, this.config.maxParticles - this.particles.length);
    }

    // 预计算移动端优化值
    const sizeMin = this.isMobile ? Math.max(3, this.config.particleSize.min - 1) : this.config.particleSize.min;
    const sizeMax = this.isMobile ? Math.max(7, this.config.particleSize.max - 2) : this.config.particleSize.max;
    const speedMultiplier = this.isMobile ? 0.85 : 1.0;
    const baseMultiplier = isLongPress ?
      this.randomBetween(5 + this.multiplier * 0.5, 10 + this.multiplier * 0.5) :
      this.randomBetween(3, 7);

    // 批量创建粒子，减少数组操作
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.PI * 2 * Math.random();
      const multiplier = baseMultiplier * speedMultiplier;
      const radius = this.randomBetween(sizeMin, sizeMax);

      const particle: Particle = {
        id: `${Date.now()}-${i}`, // 简化ID生成
        x,
        y,
        angle,
        multiplier,
        vx: (multiplier + Math.random() * 0.5) * Math.cos(angle),
        vy: (multiplier + Math.random() * 0.5) * Math.sin(angle),
        radius,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: this.config.particleLifetime,
        maxLife: this.config.particleLifetime,
      };

      newParticles.push(particle);
    }

    // 一次性添加所有粒子
    this.particles.push(...newParticles);

    // 如果动画已暂停且现在有粒子，重新启动动画
    if (!this.animationId && this.particles.length > 0) {
      this.start();
    }
  }
  
  /**
   * 生成随机数
   */
  private randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  
  /**
   * 处理窗口大小变化
   */
  private handleResize(): void {
    this.updateCanvasSize();
  }
  
  /**
   * 处理页面可见性变化 - 简化版本
   */
  private handleVisibilityChange(): void {
    if (document.hidden) {
      this.pause();
    } else {
      // 清理可能存在的过期粒子，但保留有效粒子
      this.particles = this.particles.filter(particle =>
        particle.life > 0 && particle.radius > 0
      );

      // 如果有粒子，恢复动画；否则等待下次点击
      if (this.particles.length > 0) {
        this.resume();
      }
    }
  }
  
  /**
   * 开始动画循环
   */
  start(): void {
    if (this.animationId) {
      // 生产环境移除调试输出
      return;
    }

    // 生产环境移除调试输出
    this.lastTime = performance.now();
    this.animate();
  }
  
  /**
   * 暂停动画
   */
  pause(): void {
    if (this.animationId) {
      // console.log('ClickEffect: Pausing animation');
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
  
  /**
   * 恢复动画 - 优化版本
   */
  resume(): void {
    if (!this.animationId) {
      // 重置时间戳，避免大的时间跳跃
      this.lastTime = performance.now();
      this.start();
    }
  }
  
  /**
   * 停止动画并清理
   */
  stop(): void {
    this.pause();
    this.particles = [];
    this.clearCanvas();
    this.clearLongPressTimer();
  }
  
  /**
   * 动画循环 - 优化版本，简化性能监控
   */
  private animate(): void {
    const currentTime = performance.now();

    // 更新粒子
    this.updateParticles();

    // 如果没有粒子，暂停动画以节省性能
    if (this.particles.length === 0) {
      this.animationId = null;
      return;
    }

    // 渲染
    this.render();

    // 简化的性能检查（只做粒子数量控制）
    this.checkPerformance();

    this.lastTime = currentTime;
    this.animationId = requestAnimationFrame(() => this.animate());
  }
  

  
  /**
   * 更新粒子
   */
  private updateParticles(): void {
    // 性能优化：批量处理粒子更新
    const toRemove: number[] = [];

    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];

      // 更新位置
      particle.x += particle.vx;
      particle.y += particle.vy;

      // 更新生命值和大小 - 平衡的衰减速度
      particle.life--;
      particle.radius -= this.isMobile ? 0.08 : 0.1; // 稍微加快衰减

      // 确保半径不会变成负数
      if (particle.radius < 0) {
        particle.radius = 0;
      }

      // 添加轻微的重力效果，让粒子运动更自然
      particle.vy += 0.06; // 轻微向下的重力

      // 应用阻力（移动端更强的阻力以减少计算）
      const friction = this.isMobile ? 0.94 : 0.96; // 稍微增加阻力
      particle.vx *= friction;
      particle.vy *= friction;

      // 更严格的粒子移除条件
      if (particle.life <= 0 || particle.radius <= 0.05 || this.isOutOfBounds(particle)) {
        toRemove.push(i);
      }
    }

    // 批量移除过期粒子（从后往前移除避免索引问题）
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.particles.splice(toRemove[i], 1);
    }

    // 更新长按倍数
    if (this.longPressed) {
      this.multiplier += 0.2;
    } else if (this.multiplier > 0) {
      this.multiplier -= 0.4;
    }
  }
  
  /**
   * 检查粒子是否超出边界
   */
  private isOutOfBounds(particle: Particle): boolean {
    const margin = 50;
    return (
      particle.x < -margin ||
      particle.x > window.innerWidth + margin ||
      particle.y < -margin ||
      particle.y > window.innerHeight + margin
    );
  }
  
  /**
   * 渲染粒子
   */
  private render(): void {
    this.clearCanvas();

    if (this.particles.length === 0) return;

    for (const particle of this.particles) {
      // 严格检查粒子有效性
      if (particle.radius <= 0 || particle.life <= 0) {
        continue;
      }

      // 使用平方根缓动函数计算透明度，更自然的淡出效果
      const progress = particle.life / particle.maxLife;
      const alpha = Math.pow(progress, 0.5); // 平方根缓动，更优雅

      if (alpha <= 0.01 || alpha > 1) {
        continue; // 跳过无效透明度的粒子
      }

      // 检查粒子位置是否有效
      if (!isFinite(particle.x) || !isFinite(particle.y) || !isFinite(particle.radius)) {
        continue;
      }

      // 优化Canvas状态管理，减少save/restore调用
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = particle.color;

      // 绘制粒子
      this.ctx.beginPath();
      this.ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
  
  /**
   * 清空Canvas
   */
  private clearCanvas(): void {
    // 保存当前状态
    this.ctx.save();

    // 重置变换矩阵到标准状态
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);

    // 清空整个Canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 恢复之前的状态（包括缩放变换）
    this.ctx.restore();
  }
  
  /**
   * 检查性能 - 简化版本，只做基本的粒子数量控制
   */
  private checkPerformance(): void {
    // 只做简单的粒子数量控制，避免过多粒子
    if (this.particles.length > this.config.maxParticles) {
      const removeCount = this.particles.length - this.config.maxParticles;
      this.particles.splice(0, removeCount);
    }

    // 简化性能指标更新
    this.metrics.particleCount = this.particles.length;
  }
  
  /**
   * 更新配置
   */
  updateConfig(config: ClickEffectConfig): void {
    // console.log('ClickEffect: ParticleSystem config updated', {
    //   oldEnabled: this.config.enabled,
    //   newEnabled: config.enabled,
    //   oldEnableOnMobile: this.config.enableOnMobile,
    //   newEnableOnMobile: config.enableOnMobile,
    //   isMobile: this.isMobile
    // });
    this.config = config;
  }
  
  /**
   * 更新主题
   */
  updateTheme(theme: 'light' | 'dark'): void {
    this.currentTheme = theme;
  }
  
  /**
   * 获取性能指标
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }
  
  /**
   * 销毁粒子系统 - 修复事件监听器泄漏问题
   */
  destroy(): void {
    instanceCount--;

    this.stop();

    // 正确移除事件监听器 - 使用预绑定的处理器
    document.removeEventListener('mousedown', this.boundHandlers.mouseDown);
    document.removeEventListener('mouseup', this.boundHandlers.mouseUp);
    document.removeEventListener('touchstart', this.boundHandlers.touchStart);
    document.removeEventListener('touchend', this.boundHandlers.touchEnd);
    window.removeEventListener('resize', this.boundHandlers.resize);
    document.removeEventListener('visibilitychange', this.boundHandlers.visibilityChange);
  }
}
