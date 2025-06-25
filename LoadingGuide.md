# macOS风格Loading组件使用指南

> ✅ **迁移完成状态**: 所有组件已成功迁移到macOS风格，react-loading依赖已移除

本项目提供了完整的macOS风格loading组件系统，统一了设计美学并针对不同场景进行了性能优化。

## 组件类型

### 1. 主要页面Loading - `Waiting`
**用途**: 页面级别的loading状态
**特点**: 
- 彩色呼吸点状动画
- 视觉效果丰富
- 适合主要内容加载

```tsx
import { Waiting } from './components/loading';

<Waiting for={data}>
  <YourContent />
</Waiting>
```

### 2. 轻量级Loading - `LightWaiting`
**用途**: 小区域、组件级loading
**特点**:
- 简单的圆形旋转指示器
- 性能开销小
- 适合频繁使用的场景

```tsx
import { LightWaiting } from './components/loading';

<LightWaiting for={comments} spinnerSize="small" className="py-4">
  <CommentsList />
</LightWaiting>
```

### 3. 圆形旋转指示器 - `MacOSSpinner`
**用途**: 独立的loading指示器
**特点**:
- 纯macOS风格设计
- 三种尺寸可选
- 可自定义样式

```tsx
import { MacOSSpinner } from './components/loading';

<MacOSSpinner size="medium" className="my-4" />
```

### 4. 内联Spinner - `InlineSpinner`
**用途**: 按钮内部、文本旁边
**特点**:
- 专为内联使用设计
- 自动适配文本颜色
- 最小性能开销

```tsx
import { InlineSpinner } from './components/loading';

<button>
  {loading && <InlineSpinner size="small" />}
  提交
</button>
```

## 使用建议

### 性能优先场景
- 无限滚动: `MacOSSpinner`
- 按钮loading: `InlineSpinner`
- 评论加载: `LightWaiting`
- 搜索结果: `LightWaiting`

### 用户体验优先场景
- 页面首次加载: `Waiting`
- 文章内容加载: `Waiting`
- 重要操作反馈: `Waiting`

### 尺寸选择
- `small`: 按钮内部、小组件
- `medium`: 一般组件、卡片
- `large`: 重要区域、主要内容

## 响应式设计
所有组件都支持:
- 深色模式自动适配
- 移动端优化
- 低性能设备优化
- 减少动画偏好支持

## 迁移指南

### ✅ 已完成迁移的组件
所有项目组件已成功迁移到macOS风格loading：

- **ButtonWithLoading** → `InlineSpinner`
- **InfiniteScroll** → `MacOSSpinner`
- **FileManager** → `MacOSSpinner`
- **Settings页面** → `InlineSpinner`
- **Feed页面** → `InlineSpinner` + `MacOSSpinner`
- **RecentPosts** → `MacOSSpinner`
- **Markdown组件** → `MacOSSpinner`
- **Writing页面** → `InlineSpinner`

### 迁移对照表
```tsx
// 旧代码 → 新代码

// 按钮内loading
<ReactLoading type="spin" width="1em" height="1em" />
→ <InlineSpinner size="small" />

// 页面loading
<ReactLoading type="cylon" color="#FC466B" />
→ <MacOSSpinner size="medium" />

// 图标loading
<i className="ri-loader-4-line animate-spin"></i>
→ <MacOSSpinner size="small" />

// 页面级等待
<ReactLoading type="spin" color="#007AFF" />
→ <Waiting for={data}>...</Waiting>
```

## 性能对比

### 旧方案 (react-loading)
- 📦 额外依赖包体积
- 🎨 单一动画类型
- ⚡ 固定性能开销

### 新方案 (macOS风格)
- 🚀 纯CSS动画，零依赖
- 🎯 多种尺寸和场景优化
- 📱 响应式和深色模式支持
- ⚡ 性能分级优化

## 最佳实践

### 1. 选择合适的组件
```tsx
// ❌ 错误：在按钮中使用重型动画
<button>
  <Waiting for={loading}>提交</Waiting>
</button>

// ✅ 正确：使用轻量级内联spinner
<button>
  {loading && <InlineSpinner size="small" />}
  提交
</button>
```

### 2. 合理的尺寸选择
```tsx
// 小组件、按钮内部
<InlineSpinner size="small" />

// 卡片、列表项
<MacOSSpinner size="medium" />

// 主要内容区域
<MacOSSpinner size="large" />
```

### 3. 性能优化建议
```tsx
// 频繁更新的组件使用轻量级版本
<LightWaiting for={comments} spinnerSize="small">
  <CommentsList />
</LightWaiting>

// 重要页面使用丰富动画
<Waiting for={articleData}>
  <ArticleContent />
</Waiting>
```
