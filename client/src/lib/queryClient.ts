import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,     // 2分钟
      gcTime: 10 * 60 * 1000,      // 10分钟
      refetchOnWindowFocus: true,   // 窗口聚焦时重新获取 - 关键的多用户同步机制
      refetchOnReconnect: true,     // 网络重连时重新获取
      retry: (failureCount, error: any) => {
        // 智能重试：4xx错误不重试，5xx和网络错误重试
        if (error?.status >= 400 && error?.status < 500) {
          return false; // 客户端错误不重试
        }
        return failureCount < 2; // 最多重试2次
      },
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000), // 指数退避
      refetchOnMount: 'always',     // 组件挂载时总是重新获取，确保数据新鲜
    },
    mutations: {
      retry: (failureCount, error: any) => {
        // mutation更保守的重试策略
        if (error?.status >= 400 && error?.status < 500) {
          return false; // 客户端错误不重试
        }
        return failureCount < 1; // 最多重试1次
      },
      retryDelay: 1500, // mutation重试延迟稍长
    }
  }
})
