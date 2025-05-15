# UI 改进与问题修复

## 草稿箱与未列出文章按钮修复

### 问题描述
在原有实现中，草稿箱和未列出文章按钮点击无效，无法正常切换到相应的视图。主要原因是wouter库升级后，`useSearch`钩子不再被导出，导致URL查询参数无法被正确解析。

### 解决方案
1. 创建了一个自定义的`useSearch`钩子函数，兼容wouter的最新版本：
```typescript
// 创建自定义useSearch hook以兼容wouter的最新版本
const useSearch = () => {
    const [location] = useLocation();
    return location.includes('?') ? location.split('?')[1] : '';
};
```

2. 修改了原有的导入语句，使用`useLocation`代替`useSearch`：
```typescript
import { Link, useLocation } from "wouter"
```

### 样式优化
为了使草稿箱和未列出文章按钮更契合整体设计，我们优化了按钮样式：

1. **草稿箱按钮**
   - 使用琥珀色调（amber），与草稿标签保持一致
   - 添加了更细腻的边框和背景效果
   - 优化了暗色主题下的显示效果

2. **未列出文章按钮**
   - 使用靛蓝色调（indigo），与未列出标签保持一致
   - 添加了更细腻的边框和背景效果
   - 优化了暗色主题下的显示效果

3. **共同优化**
   - 改进了按钮的悬停效果，使交互更加流畅
   - 保持了响应式设计，在小屏幕设备上隐藏文本，只显示图标
   - 使用了一致的圆角和内边距，与网站其他UI元素保持一致

### 代码变更
修改了`feeds.tsx`文件中的按钮样式：

```jsx
<Link href="/?type=draft" 
    className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 flex items-center ${listState === 'draft' 
    ? "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 ring-1 ring-amber-500/30 hover:bg-amber-100 dark:hover:bg-amber-800/30" 
    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"}`}>
    <i className="ri-draft-line mr-1 sm:mr-1.5"></i>
    <span className="hidden xs:inline">{t('draft_bin')}</span>
</Link>

<Link href="/?type=unlisted" 
    className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 flex items-center ${listState === 'unlisted' 
    ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 ring-1 ring-indigo-500/30 hover:bg-indigo-100 dark:hover:bg-indigo-800/30" 
    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"}`}>
    <i className="ri-eye-off-line mr-1 sm:mr-1.5"></i>
    <span className="hidden xs:inline">{t('unlisted')}</span>
</Link>
```

## 继续优化建议

1. **性能优化**
   - 在`feeds.tsx`中使用React.memo包装组件，避免不必要的重新渲染
   - 继续优化`useCallback`和`useMemo`的使用

2. **用户体验提升**
   - 考虑添加更明显的加载状态指示
   - 添加简单的转场动画，使页面切换更加流畅

3. **可访问性改进**
   - 为按钮添加`aria-current="page"`属性，提高屏幕阅读器的可用性
   - 确保颜色对比度符合WCAG标准

4. **代码重构**
   - 考虑将自定义`useSearch`钩子提取到单独的hooks文件中
   - 设计一个通用的按钮组件，减少重复代码 