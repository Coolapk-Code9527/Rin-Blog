# Rin博客系统缓存重构实施指南

## 📋 执行摘要

### 重构目标
- **精确简化**：重构API数据缓存系统，解决多用户缓存不一致问题
- **保持功能完整**：保留表单缓存、配置缓存等必要功能
- **提升可维护性**：采用TanStack Query标准化缓存管理

### 核心收益
- **代码简化**：API缓存代码减少60%+（1500行→150行）
- **问题解决**：100%解决多用户缓存不一致问题
- **标准化**：采用业界最佳实践，降低维护成本

## 🎯 问题与方案

### 核心问题
**多用户缓存不一致**：A用户删除文章后，B用户仍能看到已删除的文章

**根本原因**：
1. 前端使用sessionStorage，每个用户会话独立
2. 删除操作的缓存失效只在操作用户浏览器中触发
3. 复杂的事件驱动缓存系统难以维护

### 解决方案
**采用TanStack Query + 简化HTTP缓存**：
1. 统一的客户端缓存管理
2. 标准的HTTP缓存控制
3. 内置的缓存失效和同步机制

## 📋 实施任务列表

### 阶段1：基础设施准备（预计1-2天）

#### 任务1.1：安装依赖
- [ ] 执行：`bun add @tanstack/react-query`
- [ ] 验证：package.json中包含@tanstack/react-query依赖
- [ ] 时间：30分钟

#### 任务1.2：创建核心配置文件
- [ ] 创建：`client/src/lib/queryClient.ts`
- [ ] 创建：`client/src/lib/cacheKeys.ts`
- [ ] 验证：文件创建成功，配置正确
- [ ] 时间：1小时

#### 任务1.3：设置QueryClientProvider
- [ ] 修改：`client/src/App.tsx`
- [ ] 添加：QueryClientProvider包装
- [ ] 验证：应用启动正常，无控制台错误
- [ ] 时间：30分钟

### 阶段2：数据获取迁移（预计3-5天）

#### 任务2.1：创建新的数据获取hooks
- [ ] 创建：`client/src/hooks/useQueries.ts`
- [ ] 实现：useFeeds, useFeed, useComments等hooks
- [ ] 验证：新hooks功能正常
- [ ] 时间：1天

#### 任务2.2：迁移feeds页面
- [ ] 修改：`client/src/page/feeds.tsx`
- [ ] 替换：useFeedsCache → useFeeds
- [ ] 验证：页面功能正常，数据加载正确
- [ ] 时间：4小时

#### 任务2.3：迁移writing页面
- [ ] 修改：`client/src/page/writing.tsx`
- [ ] 替换：缓存失效逻辑
- [ ] 验证：文章发布/更新功能正常
- [ ] 时间：4小时

#### 任务2.4：迁移其他页面
- [ ] 修改：search.tsx, comments相关页面
- [ ] 替换：相关缓存hooks
- [ ] 验证：所有页面功能正常
- [ ] 时间：1天

### 阶段3：服务端缓存简化（预计2-3天）

#### 任务3.1：简化clearFeedCache函数
- [ ] 修改：`server/src/services/feed.ts`
- [ ] 简化：8种缓存清理模式→简单HTTP缓存控制
- [ ] 验证：删除操作功能正常
- [ ] 时间：4小时

#### 任务3.2：优化HTTP缓存头
- [ ] 修改：各API路由的缓存头设置
- [ ] 统一：Cache-Control策略
- [ ] 验证：HTTP缓存行为正确
- [ ] 时间：4小时

#### 任务3.3：简化CacheImpl类
- [ ] 修改：`server/src/utils/cache.ts`
- [ ] 移除：复杂的对象池和序列化优化
- [ ] 保留：配置缓存和基础功能
- [ ] 验证：服务端功能正常
- [ ] 时间：1天

### 阶段4：缓存同步优化（预计2-3天）

#### 任务4.1：实现多用户缓存同步
- [ ] 添加：页面可见性API监听
- [ ] 配置：refetchOnWindowFocus
- [ ] 验证：多用户场景缓存一致性
- [ ] 时间：1天

#### 任务4.2：优化缓存失效策略
- [ ] 实现：mutation的onSuccess缓存失效
- [ ] 配置：合适的staleTime和gcTime
- [ ] 验证：缓存失效时机正确
- [ ] 时间：4小时

#### 任务4.3：测试缓存一致性
- [ ] 测试：多用户删除文章场景
- [ ] 测试：多用户发布文章场景
- [ ] 验证：缓存同步问题完全解决
- [ ] 时间：4小时

### 阶段5：清理和优化（预计1-2天）

#### 任务5.1：删除旧缓存文件
- [ ] 删除：useFeedsCache.ts, useApiCache.ts等
- [ ] 删除：SimpleCacheManager.ts, CacheEventManager.ts
- [ ] 保留：cache.ts(表单缓存), regex-cache.ts
- [ ] 验证：应用功能完整，无引用错误
- [ ] 时间：4小时

#### 任务5.2：更新组件引用
- [ ] 检查：所有组件的import语句
- [ ] 更新：过时的缓存相关引用
- [ ] 验证：编译无错误，功能正常
- [ ] 时间：2小时

#### 任务5.3：性能测试和优化
- [ ] 测试：页面加载时间
- [ ] 测试：内存使用情况
- [ ] 优化：缓存配置参数
- [ ] 验证：性能指标达标
- [ ] 时间：2小时

## 🔧 技术参考

### 核心配置文件

#### lib/queryClient.ts
```typescript
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,     // 2分钟
      gcTime: 10 * 60 * 1000,      // 10分钟
      refetchOnWindowFocus: true,   // 窗口聚焦时重新获取
      retry: 1
    }
  }
})
```

#### lib/cacheKeys.ts
```typescript
export const CACHE_KEYS = {
  feeds: (type?: string) => ['feeds', type].filter(Boolean),
  feed: (id: string) => ['feed', id],
  comments: (feedId: string) => ['comments', feedId],
  config: (type: string) => ['config', type],
  friends: () => ['friends'],
  tags: () => ['tags']
}
```

### 数据获取示例

#### hooks/useQueries.ts
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CACHE_KEYS } from '../lib/cacheKeys'
import { client } from '../utils/client'

export function useFeeds(type?: string) {
  return useQuery({
    queryKey: CACHE_KEYS.feeds(type),
    queryFn: () => client.feed.index.get()
  })
}

export function useDeleteFeed() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (id: string) => client.feed({ id }).delete(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feeds'] })
    }
  })
}
```

### 组件迁移示例

#### 迁移前（feeds.tsx）
```typescript
const { data: feedsData, loading } = useFeedsCache({
  type: listState as FeedType,
  limit: 9999,
  enabled: true
})
```

#### 迁移后（feeds.tsx）
```typescript
const { data: feedsData, isLoading } = useFeeds(listState)
```

## ✅ 验证标准

### 功能验证
- [ ] 所有页面正常加载和显示
- [ ] 文章发布/更新/删除功能正常
- [ ] 多用户缓存同步问题解决
- [ ] 表单缓存和用户偏好保持正常

### 性能验证
- [ ] 页面加载时间不超过原有水平
- [ ] 内存使用优化30%+
- [ ] 网络请求数量合理

### 代码质量验证
- [ ] 无TypeScript编译错误
- [ ] 无控制台错误或警告
- [ ] 代码覆盖率保持或提升

## 📊 成功指标

### 技术指标
- [ ] API缓存代码减少60%+
- [ ] 缓存相关文件减少70%+
- [ ] 多用户缓存一致性100%解决

### 业务指标
- [ ] 零功能回归
- [ ] 用户体验保持或改善
- [ ] 系统稳定性提升

## 📖 详细实施指导

### 关键迁移步骤

#### 1. App.tsx设置QueryClientProvider
```typescript
// 在App.tsx中添加
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* 现有的应用内容 */}
    </QueryClientProvider>
  )
}
```

#### 2. 服务端缓存清理简化
```typescript
// 旧的复杂清理逻辑（server/src/services/feed.ts）
async function clearFeedCache(id: number, alias: string | null, newAlias: string | null) {
  await cache.deletePrefix('feeds_');
  await cache.deletePrefix('search_');
  await cache.delete(`feed_id:${id}`, false);
  // ... 8种清理模式
}

// 新的简化逻辑
app.delete('/feed/:id', async (c) => {
  await db.delete(feeds).where(eq(feeds.id, id))

  // 简单的HTTP缓存控制
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate')
  c.header('Pragma', 'no-cache')
  c.header('Expires', '0')

  return { success: true }
})
```

#### 3. 多用户缓存同步实现
```typescript
// 在主要组件中添加页面可见性监听
useEffect(() => {
  const handleVisibilityChange = () => {
    if (!document.hidden) {
      // 页面变为可见时，重新验证关键数据
      queryClient.invalidateQueries({ queryKey: ['feeds'] })
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
}, [])
```

### 保留的文件和功能

#### 必须保留的缓存系统
- `client/src/utils/cache.ts` - 表单缓存（文章编辑草稿）
- `client/src/utils/history.ts` - 编辑历史记录
- `server/src/utils/regex-cache.ts` - 正则表达式缓存优化
- 配置缓存（ClientConfig/ServerConfig）

#### 删除的文件清单
- `client/src/utils/cacheConstants.ts`
- `client/src/utils/SimpleCacheManager.ts`
- `client/src/utils/CacheEventManager.ts`
- `client/src/hooks/useFeedsCache.ts`
- `client/src/hooks/useApiCache.ts`
- `client/src/hooks/useCacheEvents.ts`
- `client/src/hooks/useEnhancedCacheInvalidation.ts`
- `client/src/hooks/useTagsWithCache.ts`
- `server/src/utils/cacheConstants.ts`

### 测试验证清单

#### 多用户缓存一致性测试
1. **测试场景1**：A用户删除文章，B用户刷新页面
   - 预期：B用户看不到已删除的文章

2. **测试场景2**：A用户发布文章，B用户切换标签页回来
   - 预期：B用户能看到新发布的文章

3. **测试场景3**：A用户更新文章，B用户在无痕模式下访问
   - 预期：B用户看到更新后的内容

#### 功能完整性测试
- [ ] 文章编辑草稿保存功能正常
- [ ] 用户偏好设置保持正常
- [ ] 搜索历史记录正常
- [ ] 评论功能正常
- [ ] 友情链接管理正常

### 常见问题和解决方案

#### Q1: TanStack Query与现有Context冲突？
**A**: 不会冲突。Context管理全局状态，TanStack Query管理服务端状态，职责不同。

#### Q2: 表单缓存会被影响吗？
**A**: 不会。表单缓存（Cache类）完全保留，用于文章编辑草稿等功能。

#### Q3: 性能会下降吗？
**A**: 不会。TanStack Query有内置优化，且减少了复杂的自定义缓存逻辑。

#### Q4: 如何确保缓存一致性？
**A**: 通过HTTP缓存控制头 + TanStack Query的自动重新验证机制。

### 应急处理

#### 如果出现严重问题
1. **立即回滚**：切换到备份分支
2. **问题定位**：检查控制台错误和网络请求
3. **快速修复**：针对具体问题进行修复
4. **重新验证**：确保修复后功能正常

#### 联系支持
- 技术问题：查看TanStack Query官方文档
- 实施问题：参考本文档的详细步骤
- 紧急情况：优先保证系统稳定，后续再优化

---

**实施提醒**：
1. 严格按照阶段顺序执行，不要跳跃
2. 每个任务完成后立即验证
3. 保持Git提交的原子性，便于回滚
4. 遇到问题及时记录和解决
5. 重视用户数据安全，确保不丢失草稿等重要信息
