import { client } from '../main';
import { headersWithAuth } from './auth';

/**
 * 配置更新管理器
 * 
 * 提供智能防抖和批量更新机制，解决设置页面CPU超时问题
 * 
 * 功能特点：
 * - 防抖机制：避免频繁的网络请求
 * - 批量更新：合并多个配置变更
 * - 错误处理：完善的错误恢复机制
 * - 实时同步：保持客户端状态同步
 */
export class ConfigUpdateManager {
  private static instance: ConfigUpdateManager;
  
  // 更新队列
  private clientQueue: Map<string, any> = new Map();
  private serverQueue: Map<string, any> = new Map();
  
  // 防抖定时器
  private clientTimeout: NodeJS.Timeout | null = null;
  private serverTimeout: NodeJS.Timeout | null = null;
  
  // 配置
  private readonly DEBOUNCE_DELAY = 800; // 800ms防抖延迟，优化性能减少配置保存频率
  private readonly MAX_QUEUE_SIZE = 50; // 最大队列大小
  
  // 回调函数
  private onSuccess?: (type: 'client' | 'server', updates: Record<string, any>) => void;
  private onError?: (type: 'client' | 'server', error: string, updates: Record<string, any>) => void;
  
  private constructor() {}
  
  /**
   * 获取单例实例
   */
  static getInstance(): ConfigUpdateManager {
    if (!ConfigUpdateManager.instance) {
      ConfigUpdateManager.instance = new ConfigUpdateManager();
    }
    return ConfigUpdateManager.instance;
  }
  
  /**
   * 设置回调函数
   */
  setCallbacks(
    onSuccess?: (type: 'client' | 'server', updates: Record<string, any>) => void,
    onError?: (type: 'client' | 'server', error: string, updates: Record<string, any>) => void
  ) {
    this.onSuccess = onSuccess;
    this.onError = onError;
  }
  
  /**
   * 添加配置更新到队列
   * 
   * @param type 配置类型
   * @param key 配置键
   * @param value 配置值
   * @param immediate 是否立即更新（跳过防抖）
   */
  enqueueUpdate(
    type: 'client' | 'server',
    key: string,
    value: any,
    immediate: boolean = false
  ): void {
    const queue = type === 'client' ? this.clientQueue : this.serverQueue;
    const timeout = type === 'client' ? this.clientTimeout : this.serverTimeout;
    
    // 检查队列大小
    if (queue.size >= this.MAX_QUEUE_SIZE) {
      console.warn(`Config queue for ${type} is full, forcing flush`);
      this.flushQueue(type);
    }
    
    // 添加到队列
    queue.set(key, value);
    
    // 立即更新或防抖更新
    if (immediate) {
      this.flushQueue(type);
    } else {
      this.scheduleFlush(type);
    }
  }
  
  /**
   * 调度队列刷新
   */
  private scheduleFlush(type: 'client' | 'server'): void {
    const timeout = type === 'client' ? this.clientTimeout : this.serverTimeout;
    
    // 清除现有定时器
    if (timeout) {
      clearTimeout(timeout);
    }
    
    // 设置新的定时器
    const newTimeout = setTimeout(() => {
      this.flushQueue(type);
    }, this.DEBOUNCE_DELAY);
    
    if (type === 'client') {
      this.clientTimeout = newTimeout;
    } else {
      this.serverTimeout = newTimeout;
    }
  }
  
  /**
   * 刷新队列，执行批量更新
   */
  private async flushQueue(type: 'client' | 'server'): Promise<void> {
    const queue = type === 'client' ? this.clientQueue : this.serverQueue;
    
    if (queue.size === 0) return;
    
    // 复制并清空队列，优化序列化性能
    const updates = Object.fromEntries(queue);
    queue.clear();
    
    // 清除定时器
    if (type === 'client' && this.clientTimeout) {
      clearTimeout(this.clientTimeout);
      this.clientTimeout = null;
    } else if (type === 'server' && this.serverTimeout) {
      clearTimeout(this.serverTimeout);
      this.serverTimeout = null;
    }
    
    try {
      // 执行批量更新
      const response = await client.config({ type }).post(updates, {
        headers: headersWithAuth()
      });
      
      if (response.error) {
        throw new Error(String(response.error.value));
      }
      
      // 更新客户端状态
      if (type === 'client') {
        this.updateClientStorage(updates);
      }
      
      // 成功回调
      this.onSuccess?.(type, updates);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to update ${type} config:`, errorMessage);
      
      // 错误回调
      this.onError?.(type, errorMessage, updates);
      
      // 重新入队（可选，避免数据丢失）
      // for (const [key, value] of Object.entries(updates)) {
      //   queue.set(key, value);
      // }
    }
  }
  
  /**
   * 更新客户端存储
   */
  private updateClientStorage(updates: Record<string, any>): void {
    try {
      const config = sessionStorage.getItem('config');
      const newConfig = config ? 
        { ...JSON.parse(config), ...updates } : 
        updates;
      
      sessionStorage.setItem('config', JSON.stringify(newConfig));
      
      // 触发全局配置更新事件
      window.dispatchEvent(new Event('configUpdated'));
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'config',
        newValue: JSON.stringify(newConfig),
        oldValue: config,
        storageArea: sessionStorage
      }));
    } catch (error) {
      console.error('Failed to update client storage:', error);
    }
  }
  
  /**
   * 立即刷新所有队列
   */
  flushAll(): Promise<void[]> {
    return Promise.all([
      this.flushQueue('client'),
      this.flushQueue('server')
    ]);
  }
  
  /**
   * 清空所有队列
   */
  clearAll(): void {
    this.clientQueue.clear();
    this.serverQueue.clear();
    
    if (this.clientTimeout) {
      clearTimeout(this.clientTimeout);
      this.clientTimeout = null;
    }
    
    if (this.serverTimeout) {
      clearTimeout(this.serverTimeout);
      this.serverTimeout = null;
    }
  }
  
  /**
   * 获取队列状态
   */
  getQueueStatus(): {
    client: { size: number; pending: boolean };
    server: { size: number; pending: boolean };
  } {
    return {
      client: {
        size: this.clientQueue.size,
        pending: this.clientTimeout !== null
      },
      server: {
        size: this.serverQueue.size,
        pending: this.serverTimeout !== null
      }
    };
  }
}

// 导出单例实例
export const configUpdateManager = ConfigUpdateManager.getInstance();
