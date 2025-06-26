/**
 * Service Worker 注册和管理工具
 * 
 * 提供Service Worker的注册、更新检查和缓存管理功能
 */

interface ServiceWorkerConfig {
  enabled: boolean;
  updateCheckInterval: number; // 更新检查间隔（毫秒）
  skipWaiting: boolean; // 是否跳过等待立即激活
}

const DEFAULT_CONFIG: ServiceWorkerConfig = {
  enabled: true,
  updateCheckInterval: 60 * 60 * 1000, // 1小时检查一次更新
  skipWaiting: false
};

let registration: ServiceWorkerRegistration | null = null;
let updateCheckTimer: number | null = null;

/**
 * 注册Service Worker
 * 
 * @param config Service Worker配置
 * @returns Promise<ServiceWorkerRegistration | null>
 */
export async function registerServiceWorker(
  config: Partial<ServiceWorkerConfig> = {}
): Promise<ServiceWorkerRegistration | null> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // 检查浏览器支持
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker not supported in this browser');
    return null;
  }

  // 检查是否启用
  if (!finalConfig.enabled) {
    console.log('Service Worker disabled by configuration');
    return null;
  }

  // 只在生产环境或HTTPS下启用
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
    console.warn('Service Worker requires HTTPS or localhost');
    return null;
  }

  try {
    console.log('Registering Service Worker...');
    
    registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });

    console.log('Service Worker registered successfully:', registration);

    // 设置事件监听器
    setupServiceWorkerListeners(registration, finalConfig);

    // 开始定期检查更新
    if (finalConfig.updateCheckInterval > 0) {
      startUpdateCheck(registration, finalConfig.updateCheckInterval);
    }

    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

/**
 * 设置Service Worker事件监听器
 */
function setupServiceWorkerListeners(
  registration: ServiceWorkerRegistration,
  config: ServiceWorkerConfig
): void {
  // 监听安装事件
  if (registration.installing) {
    console.log('Service Worker installing...');
    trackServiceWorkerState(registration.installing);
  }

  // 监听等待事件
  if (registration.waiting) {
    console.log('Service Worker waiting...');
    showUpdateAvailable(registration.waiting);
  }

  // 监听激活事件
  if (registration.active) {
    console.log('Service Worker active');
  }

  // 监听更新事件
  registration.addEventListener('updatefound', () => {
    console.log('Service Worker update found');
    const newWorker = registration.installing;
    
    if (newWorker) {
      trackServiceWorkerState(newWorker);
    }
  });

  // 监听控制器变化
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('Service Worker controller changed');
    
    // 如果配置了跳过等待，刷新页面
    if (config.skipWaiting) {
      window.location.reload();
    }
  });

  // 监听消息
  navigator.serviceWorker.addEventListener('message', (event) => {
    console.log('Message from Service Worker:', event.data);
    
    if (event.data.type === 'CACHE_UPDATED') {
      console.log('Cache updated for:', event.data.url);
    }
  });
}

/**
 * 跟踪Service Worker状态变化
 */
function trackServiceWorkerState(worker: ServiceWorker): void {
  worker.addEventListener('statechange', () => {
    console.log('Service Worker state changed:', worker.state);
    
    if (worker.state === 'installed') {
      if (navigator.serviceWorker.controller) {
        // 有新版本可用
        console.log('New Service Worker version available');
        showUpdateAvailable(worker);
      } else {
        // 首次安装
        console.log('Service Worker installed for the first time');
        showInstallSuccess();
      }
    }
  });
}

/**
 * 显示更新可用通知
 */
function showUpdateAvailable(worker: ServiceWorker): void {
  // 这里可以显示用户通知，询问是否更新
  console.log('Update available. Call skipWaiting() to update.');
  
  // 可以发送自定义事件给应用
  window.dispatchEvent(new CustomEvent('sw-update-available', {
    detail: { worker }
  }));
}

/**
 * 显示安装成功通知
 */
function showInstallSuccess(): void {
  console.log('App is ready for offline use');
  
  // 发送自定义事件
  window.dispatchEvent(new CustomEvent('sw-installed'));
}

/**
 * 开始定期检查更新
 */
function startUpdateCheck(
  registration: ServiceWorkerRegistration,
  interval: number
): void {
  updateCheckTimer = window.setInterval(() => {
    console.log('Checking for Service Worker updates...');
    registration.update().catch((error) => {
      console.error('Update check failed:', error);
    });
  }, interval);
}

/**
 * 停止更新检查
 */
export function stopUpdateCheck(): void {
  if (updateCheckTimer) {
    clearInterval(updateCheckTimer);
    updateCheckTimer = null;
  }
}

/**
 * 手动检查更新
 */
export async function checkForUpdates(): Promise<boolean> {
  if (!registration) {
    console.warn('Service Worker not registered');
    return false;
  }

  try {
    await registration.update();
    return true;
  } catch (error) {
    console.error('Manual update check failed:', error);
    return false;
  }
}

/**
 * 跳过等待，立即激活新版本
 */
export function skipWaiting(): void {
  if (!registration || !registration.waiting) {
    console.warn('No waiting Service Worker found');
    return;
  }

  // 发送跳过等待消息
  registration.waiting.postMessage({ type: 'SKIP_WAITING' });
}

/**
 * 注销Service Worker
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    
    if (registration) {
      const result = await registration.unregister();
      console.log('Service Worker unregistered:', result);
      return result;
    }
    
    return false;
  } catch (error) {
    console.error('Service Worker unregistration failed:', error);
    return false;
  }
}

/**
 * 清理所有缓存
 */
export async function clearAllCaches(): Promise<void> {
  if (!('caches' in window)) {
    console.warn('Cache API not supported');
    return;
  }

  try {
    const cacheNames = await caches.keys();
    
    await Promise.all(
      cacheNames.map(cacheName => {
        console.log('Deleting cache:', cacheName);
        return caches.delete(cacheName);
      })
    );
    
    console.log('All caches cleared');
  } catch (error) {
    console.error('Failed to clear caches:', error);
  }
}

/**
 * 获取缓存使用情况
 */
export async function getCacheUsage(): Promise<{
  caches: Array<{ name: string; size: number }>;
  totalSize: number;
}> {
  if (!('caches' in window)) {
    return { caches: [], totalSize: 0 };
  }

  try {
    const cacheNames = await caches.keys();
    const cacheInfo = [];
    let totalSize = 0;

    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();
      
      let cacheSize = 0;
      for (const request of requests) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          cacheSize += blob.size;
        }
      }
      
      cacheInfo.push({ name: cacheName, size: cacheSize });
      totalSize += cacheSize;
    }

    return { caches: cacheInfo, totalSize };
  } catch (error) {
    console.error('Failed to get cache usage:', error);
    return { caches: [], totalSize: 0 };
  }
}

/**
 * 格式化字节大小
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
