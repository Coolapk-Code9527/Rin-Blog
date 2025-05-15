# 导航修复

## Wouter 库版本兼容性问题修复

### 问题描述

在项目中，"草稿"和"未列出"按钮点击无效，无法正常切换到相应的视图。经过分析，主要有以下几个原因：

1. **Wouter 库版本升级**：最新版本的 Wouter 库不再导出 `useSearch` 钩子，导致 URL 查询参数无法被正确解析
2. **Link 组件行为变更**：新版 Wouter 的 Link 组件行为有所变化，导致按钮点击无法正确触发导航
3. **TypeScript 类型错误**：由于缺少正确的类型声明，代码中出现了多处类型检查错误

### 修复内容

我们对以下文件进行了修改，以解决导航问题：

1. **client/src/page/feeds.tsx**
   - 使用内联函数代替复杂的处理函数
   - 直接使用 `setLocation` 进行编程式导航

2. **client/src/components/pagination.tsx**
   - 替换 `Link` 组件为原生 `a` 标签
   - 添加点击事件拦截，使用 `setLocation` 实现导航
   - 简化事件处理逻辑，避免 TypeScript 类型错误

3. **client/src/page/search.tsx**
   - 从 Wouter 导入 `useLocation` 代替 `useSearch`
   - 手动解析 URL 查询参数

4. **client/src/page/callback.tsx**
   - 更新导入和 URL 处理逻辑

5. **client/src/hooks/usePaginationState.ts 和 useCursorPagination.ts**
   - 将对 `useSearch` 的依赖更改为使用 `useLocation`
   - 手动解析 URL 查询参数

### 实现方法示例

以下是实现方法的关键代码示例：

#### 1. 手动解析 URL 查询参数

```javascript
const [location] = useLocation();
const searchParams = new URLSearchParams(location.split('?')[1] || '');
```

#### 2. 使用内联函数处理导航

```jsx
<a 
  href={`/?type=${listState === 'draft' ? 'normal' : 'draft'}`}
  onClick={(e) => {
    e.preventDefault();
    setLocation(`/?type=${listState === 'draft' ? 'normal' : 'draft'}`);
  }}
  className={/* ... */}
>
  {/* 按钮内容 */}
</a>
```

#### 3. 分页组件的导航处理

```jsx
<a
  href={pageUrl}
  onClick={(e) => {
    e.preventDefault();
    setLocation(pageUrl);
  }}
  className={fullClasses}
  aria-label={ariaLabel}
  aria-current={isCurrentPage ? "page" : undefined}
>
  {label || pageNumber}
</a>
```

### 后续优化建议

1. **创建统一的 URL 参数处理钩子**：将 URL 参数解析逻辑封装到一个统一的自定义钩子中
   ```javascript
   // 示例：useUrlParams.ts
   export function useUrlParams() {
     const [location] = useLocation();
     const searchParams = new URLSearchParams(location.split('?')[1] || '');
     return searchParams;
   }
   ```

2. **添加正确的 TypeScript 类型声明**：解决 React 钩子的类型错误

3. **优化项目构建配置**：检查并更新 Vite 配置，解决构建错误

4. **添加单元测试**：为导航逻辑添加测试，确保功能稳定性 