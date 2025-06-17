# Rin博客系统 - 统一毛玻璃效果系统

## 概述

Rin博客系统采用了统一的毛玻璃效果(Glassmorphism)设计系统，基于Apple macOS Big Sur的设计语言，提供了一致的视觉体验和智能的背景适配功能。

## 系统架构

### 1. 分层毛玻璃系统

系统提供了三个主要的毛玻璃层级（高透明度层级，重叠效果明显）：

- **glass-layer-1**: 轻量级 (70%透明度, 12px模糊)
- **glass-layer-2**: 中等级 (60%透明度, 16px模糊)
- **glass-layer-3**: 强化级 (50%透明度, 20px模糊)

### 2. 专用毛玻璃类

- **glass-card**: 卡片专用 (60%透明度, 16px模糊)
- **nav-glass**: 导航栏专用 (55%透明度, 20px模糊)
- **tag-enhanced**: 标签专用 (70%透明度, 12px模糊)

### 3. 智能背景适配

当背景图片开启时，系统自动切换到更高不透明度的适配版本（确保可读性）：
- **glass-layer-1-bg**: 80%透明度（背景激活时）
- **glass-layer-2-bg**: 75%透明度（背景激活时）
- **glass-layer-3-bg**: 70%透明度（背景激活时）

## 使用方法

### 基础用法

```tsx
import { useGlassEffect, GLASS_LAYERS } from '../hooks/useGlassEffect';

function MyComponent() {
  const glassClass = useGlassEffect(GLASS_LAYERS.CARD);
  
  return (
    <div className={`${glassClass} rounded-2xl p-4`}>
      内容
    </div>
  );
}
```

### 性能优化用法

```tsx
import { useOptimizedGlassEffect, GLASS_LAYERS } from '../hooks/useGlassEffect';

function MyComponent() {
  const glassClass = useOptimizedGlassEffect(GLASS_LAYERS.CARD, {
    enableMobileOptimization: true,
    enablePerformanceOptimization: true
  });
  
  return (
    <div className={`${glassClass} rounded-2xl p-4`}>
      内容
    </div>
  );
}
```

### 推荐层级选择

```tsx
import { getRecommendedGlassLayer } from '../hooks/useGlassEffect';

// 自动选择合适的毛玻璃层级
const cardGlass = getRecommendedGlassLayer('card');     // glass-card
const modalGlass = getRecommendedGlassLayer('modal');   // glass-layer-3
const buttonGlass = getRecommendedGlassLayer('button'); // glass-layer-1
```

## 层级指南

### 组件类型对应层级

| 组件类型 | 推荐层级 | 用途 |
|---------|---------|------|
| 卡片组件 | glass-card | 文章卡片、设置卡片等 |
| 导航栏 | nav-glass | 顶部导航栏 |
| 标签 | tag-enhanced | 标签、徽章等小元素 |
| 模态框 | glass-layer-3 | 弹窗、对话框 |
| 侧边栏 | glass-layer-2 | 侧边栏、面板 |
| 按钮 | glass-layer-1 | 次要按钮 |

## 性能优化

### 1. 移动端优化
- 在低端设备上自动使用简化的毛玻璃效果
- 减少模糊强度以提升性能

### 2. 性能优化类
- `glass-optimized`: 启用硬件加速
- `glass-disabled`: 完全禁用毛玻璃效果
- `glass-mobile-optimized`: 移动端专用优化

### 3. 最佳实践
- 避免在滚动容器上使用毛玻璃效果
- 限制同时使用的毛玻璃元素数量
- 在性能敏感的区域使用 `glass-disabled` 类

## 背景适配机制

系统通过CSS变量 `--background-active` 自动检测背景图片状态：

```css
:root[style*="--background-active: 1"] .glass-card {
  background: rgba(255, 255, 255, 0.90) !important;
}
```

当背景图片激活时，所有毛玻璃组件自动提升透明度，确保内容可读性。

## 深色模式支持

所有毛玻璃效果都完全支持深色模式，自动适配不同的背景色和边框色：

```css
[data-color-mode="dark"] .glass-card {
  background: rgba(13, 17, 23, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.15);
}
```

## 注意事项

1. **性能考虑**: backdrop-filter是性能密集型属性，请谨慎使用
2. **浏览器兼容性**: 确保目标浏览器支持backdrop-filter
3. **可访问性**: 确保毛玻璃效果不影响内容的可读性
4. **一致性**: 在同一页面中保持毛玻璃层级的一致性

## 更新日志

- v1.0.0: 初始版本，基础毛玻璃系统
- v1.1.0: 添加智能背景适配功能
- v1.2.0: 添加性能优化和移动端优化
- v1.3.0: 统一模态框和时间线组件的毛玻璃效果
- v1.3.1: 调整透明度层级，使重叠效果更加明显和清晰
- v1.3.2: 进一步提升透明度，优化重叠时的视觉层次效果
