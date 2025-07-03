# Rin博客系统缓存使用指南

## 📋 概述

本文档提供Rin博客系统缓存的使用指南和最佳实践，帮助开发者正确、高效地使用缓存系统。

## 🏗️ 缓存架构

### 核心组件

1. **SimpleCacheManager** - 统一的缓存管理器
2. **useApiCache** - React Hook，提供SWR模式的API缓存
3. **useFeedsCache** - 专门的文章缓存Hook
4. **CACHE_CONFIG** - 统一的缓存配置

### 存储层级

```
┌─────────────────────────────────────┐
│           应用层                     │
│  useFeedsCache, useTagsCache, etc.  │
├─────────────────────────────────────┤
│           Hook层                    │
│           useApiCache               │
├─────────────────────────────────────┤
│          管理层                      │
│        SimpleCacheManager           │
├─────────────────────────────────────┤
│          存储层                      │
│   sessionStorage / localStorage     │
└─────────────────────────────────────┘
```

## 🎯 使用原则

### 1. 优先使用现有Hook

```typescript
// ✅ 推荐：使用专门的Hook
const { data, isLoading, error } = useFeedsCache({
  type: 'normal',
  page: 0,
  limit: 10
});

// ❌ 不推荐：直接使用useApiCache（除非有特殊需求）
const { data } = useApiCache('feeds_custom', fetcher);
```

### 2. 使用统一的缓存配置

```typescript
// ✅ 推荐：使用CACHE_CONFIG
import { CACHE_CONFIG } from '../utils/cacheConstants';

const cacheOptions = {
  staleTime: CACHE_CONFIG.FEEDS.LIST,
  cacheTime: CACHE_CONFIG.FEEDS.LIST
};

// ❌ 不推荐：硬编码时间
const cacheOptions = {
  staleTime: 15 * 60 * 1000, // 硬编码
  cacheTime: 30 * 60 * 1000
};
```

### 3. 使用标准的缓存键格式

```typescript
// ✅ 推荐：使用CACHE_KEY_PATTERNS
import { CACHE_KEY_PATTERNS } from '../utils/cacheConstants';

const cacheKey = CACHE_KEY_PATTERNS.FEEDS('normal', 0, 10, 'default');
// 结果: "feeds_type:normal_page:0_limit:10_sort:default"

// ❌ 不推荐：手动构造键
const cacheKey = `feeds_${type}_${page}_${limit}`;
```

## 📚 API参考

### SimpleCacheManager

```typescript
import { cache } from '../utils/SimpleCacheManager';

// 基本操作
cache.get<T>(key, options?)          // 获取缓存
cache.set<T>(key, data, options?)    // 设置缓存
cache.remove(key, options?)          // 删除缓存
cache.has(key, options?)             // 检查缓存是否存在

// 批量操作
cache.clearExpired(storage?)         // 清理过期缓存
cache.clearByPattern(pattern, storage?, exact?) // 按模式清理
cache.clearAll(storage?)             // 清理所有缓存

// 监控和统计
cache.getStats(storage?)             // 获取缓存统计
cache.healthCheck(storage?)          // 健康检查
cache.cleanupLegacy()                // 清理历史遗留缓存
```

### useApiCache Hook

```typescript
const {
  data,           // 缓存的数据
  isLoading,      // 是否正在加载
  error,          // 错误信息
  isStale,        // 数据是否过期
  invalidate      // 手动刷新缓存
} = useApiCache(key, fetcher, options);
```

### 配置选项

```typescript
interface ApiCacheConfig {
  staleTime?: number;              // 数据过期时间
  cacheTime?: number;              // 缓存保持时间
  refetchOnWindowFocus?: boolean;  // 窗口聚焦时重新获取
  enabled?: boolean;               // 是否启用缓存
  retryCount?: number;             // 重试次数
  retryDelay?: number;             // 重试延迟
}
```

## 🎨 最佳实践

### 1. 缓存时间设置

```typescript
// 根据数据更新频率选择合适的缓存时间
const CACHE_STRATEGIES = {
  // 静态数据：长时间缓存
  CONFIG: CACHE_CONFIG.CONFIG.CLIENT,        // 30分钟
  
  // 动态数据：中等时间缓存
  FEEDS: CACHE_CONFIG.FEEDS.LIST,            // 15分钟
  
  // 实时数据：短时间缓存
  SEARCH: CACHE_CONFIG.FEEDS.SEARCH,         // 5分钟
  
  // 用户特定数据：会话级缓存
  USER_SETTINGS: CACHE_CONFIG.API.DEFAULT_STALE_TIME
};
```

### 2. 缓存键命名

```typescript
// ✅ 好的命名：描述性强，层次清晰
"feeds_type:normal_page:0_limit:10_sort:default"
"tags_feeds_tag:技术"
"config_type:client"

// ❌ 不好的命名：模糊，难以理解
"data_1_2_3"
"cache_feeds"
"temp_data"
```

### 3. 错误处理

```typescript
const { data, error, isLoading } = useFeedsCache(params);

// ✅ 推荐：优雅的错误处理
if (error) {
  return <ErrorMessage message="加载文章失败，请稍后重试" />;
}

if (isLoading) {
  return <LoadingSpinner />;
}

// ❌ 不推荐：忽略错误
if (data) {
  return <FeedsList data={data} />;
}
```

### 4. 缓存清理

```typescript
// ✅ 推荐：使用统一的清理接口
import { FeedsCacheManager } from '../hooks/useFeedsCache';

// 清理特定类型的文章缓存
FeedsCacheManager.clearFeedsByType('normal');

// 清理所有文章缓存
FeedsCacheManager.clearAllFeeds();

// ❌ 不推荐：直接操作sessionStorage
sessionStorage.removeItem('api_cache_feeds_...');
```

## ⚠️ 注意事项

### 1. 避免的做法

```typescript
// ❌ 不要直接操作存储
sessionStorage.setItem('my_cache', JSON.stringify(data));

// ❌ 不要硬编码缓存时间
const CACHE_TIME = 15 * 60 * 1000;

// ❌ 不要忽略错误处理
const { data } = useApiCache(key, fetcher); // 没有处理error

// ❌ 不要在循环中使用Hook
items.forEach(item => {
  const { data } = useApiCache(item.id, fetcher); // 错误！
});
```

### 2. 性能考虑

```typescript
// ✅ 推荐：合理的缓存粒度
const feedsCache = useFeedsCache({ type: 'normal', page: 0, limit: 10 });

// ❌ 不推荐：过细的缓存粒度
feeds.forEach(feed => {
  const feedCache = useApiCache(`feed_${feed.id}`, () => fetchFeed(feed.id));
});
```

### 3. 内存管理

```typescript
// ✅ 推荐：定期清理过期缓存
useEffect(() => {
  const cleanup = setInterval(() => {
    cache.clearExpired('session');
  }, 5 * 60 * 1000); // 每5分钟清理一次

  return () => clearInterval(cleanup);
}, []);
```

## 🔧 故障排除

### 常见问题

1. **缓存不生效**
   - 检查缓存键是否正确
   - 确认enabled选项为true
   - 验证fetcher函数是否正确

2. **数据不更新**
   - 检查staleTime设置是否过长
   - 使用invalidate()手动刷新
   - 确认refetchOnWindowFocus设置

3. **内存占用过高**
   - 定期清理过期缓存
   - 检查cacheTime设置
   - 使用cache.getStats()监控使用情况

### 调试工具

```typescript
// 获取缓存统计信息
const stats = cache.getStats('session');
console.log('缓存统计:', stats);

// 健康检查
const health = cache.healthCheck('session');
console.log('缓存健康状况:', health);

// 清理历史遗留缓存
const cleaned = cache.cleanupLegacy();
console.log('清理的遗留缓存数量:', cleaned);
```

## 📈 性能优化建议

1. **合理设置缓存时间**：根据数据更新频率调整
2. **使用适当的存储类型**：会话数据用session，持久数据用local
3. **定期清理缓存**：避免内存泄漏
4. **监控缓存效果**：使用统计功能评估缓存效果

---

**更新日期**: 2025-07-03  
**版本**: 1.0.0  
**维护者**: Rin博客系统开发团队
