# Rin博客系统弹窗统一化指南

## 概述

本文档描述了Rin博客系统弹窗系统的统一化架构，包括设计原则、使用方法和最佳实践。

## 系统架构

### 核心配置文件

所有弹窗相关配置都集中在 `client/src/utils/modal-config.ts` 中：

```typescript
// z-index层级管理
export const MODAL_Z_INDEX = {
  TOAST: 10100,           // 轻提示
  DROPDOWN: 10200,        // 下拉菜单
  MODAL: 10300,           // 普通弹窗
  DIALOG: 10400,          // 对话框
  DRAWER: 10500,          // 抽屉/侧边栏
  NESTED_DIALOG: 10600,   // 嵌套弹窗
  PREVIEW: 10700,         // 文件预览
  LIGHTBOX: 10800,        // 图片灯箱
  LOADING: 10900,         // 全局加载
  CRITICAL: 11000,        // 关键弹窗
}
```

### 统一样式类

```typescript
export const MODAL_CONTAINER_CLASSES = {
  standard: 'glass-layer-3 shadow-enhanced-2xl rounded-2xl p-6 w-full animate-modalEnter',
  large: 'glass-layer-3 rounded-2xl shadow-enhanced-2xl overflow-hidden flex flex-col animate-modalEnter',
  fullscreen: 'w-full h-full flex items-center justify-center animate-fadeIn'
}
```

## 使用方法

### 1. 标准弹窗

```typescript
import Modal from 'react-modal';
import { macOSModalStyles, MODAL_CONTAINER_CLASSES, useModalKeyboard, useModalBodyLock } from '../utils/modal-config';

function MyModal({ isOpen, onClose }) {
  useModalKeyboard(isOpen, onClose);
  useModalBodyLock(isOpen);

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      style={macOSModalStyles}
      ariaHideApp={false}
    >
      <div className={MODAL_CONTAINER_CLASSES.standard}>
        {/* 弹窗内容 */}
      </div>
    </Modal>
  );
}
```

### 2. 响应式弹窗

```typescript
import { ResponsiveModal } from '../components/ResponsiveModal';

function MyResponsiveModal({ isOpen, onClose }) {
  return (
    <ResponsiveModal
      isOpen={isOpen}
      onClose={onClose}
      title="标题"
      size="medium"
    >
      {/* 弹窗内容 */}
    </ResponsiveModal>
  );
}
```

### 3. 通知系统

```typescript
import { useNotification } from '../hooks/useNotification';

function MyComponent() {
  const notification = useNotification();

  const handleUpload = async () => {
    const toastId = notification.loading('正在上传...');
    
    try {
      // 上传逻辑
      notification.success('上传成功');
    } catch (error) {
      notification.error('上传失败', {
        action: {
          label: '重试',
          onClick: handleUpload
        }
      });
    } finally {
      notification.removeToast(toastId);
    }
  };
}
```

## 动画系统

### 可用动画类

- `animate-modalEnter` / `animate-modalExit` - 标准弹窗动画
- `animate-slideDown` / `animate-slideUp` - 下拉菜单动画
- `animate-slideInRight` / `animate-slideOutRight` - 侧边栏动画
- `animate-fadeIn` / `animate-fadeOut` - 淡入淡出动画
- `animate-bounceIn` / `animate-bounceOut` - 弹性动画

### 响应式动画

- 桌面端：中心缩放动画
- 移动端：底部滑入动画
- 自动检测设备类型并适配

## 键盘导航

### 基础功能

- `ESC` - 关闭弹窗
- `Enter` - 确认操作（智能检测上下文）
- `Tab` - 焦点循环（仅在弹窗内）

### 高级功能

```typescript
useModalKeyboard(isOpen, onClose, onConfirm, disabled, {
  enableTabNavigation: true,    // Tab键导航
  enableArrowNavigation: true,  // 箭头键导航
  trapFocus: true              // 焦点陷阱
});
```

## 最佳实践

### 1. 层级选择

- 普通弹窗：`MODAL_Z_INDEX.MODAL`
- 重要对话框：`MODAL_Z_INDEX.DIALOG`
- 嵌套弹窗：`MODAL_Z_INDEX.NESTED_DIALOG`
- 关键提示：`MODAL_Z_INDEX.CRITICAL`

### 2. 样式选择

- 小型弹窗：`MODAL_CONTAINER_CLASSES.standard`
- 大型弹窗：`MODAL_CONTAINER_CLASSES.large`
- 全屏预览：`MODAL_CONTAINER_CLASSES.fullscreen`

### 3. 可访问性

- 始终使用 `useModalKeyboard` 和 `useModalBodyLock`
- 设置正确的 `aria-label` 和 `role` 属性
- 确保键盘导航的完整性

### 4. 性能优化

- 使用 `React.memo` 包装弹窗组件
- 避免在弹窗内使用复杂的动画
- 在移动端使用简化的毛玻璃效果

## 故障排除

### 常见问题

1. **弹窗层级冲突**
   - 检查是否使用了正确的 `MODAL_Z_INDEX`
   - 确认没有硬编码的 z-index 值

2. **键盘导航不工作**
   - 确认使用了 `useModalKeyboard` Hook
   - 检查 `disabled` 参数是否正确设置

3. **动画不流畅**
   - 检查是否导入了 `modal-animations.css`
   - 确认设备是否支持 backdrop-filter

4. **移动端体验差**
   - 使用 `ResponsiveModal` 组件
   - 检查触摸事件是否正确处理

## 更新日志

- v1.0.0: 初始弹窗系统统一化
- v1.1.0: 添加响应式弹窗支持
- v1.2.0: 完善通知系统和动画效果
- v1.3.0: 增强键盘导航和可访问性支持

## 贡献指南

添加新的弹窗组件时，请遵循以下原则：

1. 使用统一的配置系统
2. 遵循 macOS 设计规范
3. 确保完整的键盘导航支持
4. 添加适当的动画效果
5. 考虑移动端体验

---

*本文档随系统更新而持续维护*
