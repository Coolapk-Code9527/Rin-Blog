// Rin博客系统 Service Worker
// 提供离线缓存、资源预缓存和智能缓存策略

const CACHE_NAME = 'rin-blog-v1';
const API_CACHE_NAME = 'rin-blog-api-v1';
const STATIC_CACHE_NAME = 'rin-blog-static-v1';

// 需要预缓存的静态资源
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  // 字体文件
  '/assets/InterVariable-CWi-zmRD.woff2',
  '/assets/InterVariable-Italic-d6KXgdvN.woff2',
  // 图标文件
  '/assets/codicon-DCmgc-ay.ttf'
];

// API缓存策略配置
const API_CACHE_CONFIG = {
  // 长期缓存的API（1小时）
  longTerm: [
    '/api/tag/index',
    '/api/config'
  ],
  // 中期缓存的API（15分钟）
  mediumTerm: [
    '/api/feed/'
  ],
  // 短期缓存的API（5分钟）
  shortTerm: [
    '/api/feed/comment'
  ]
};

// 简化的缓存持续时间（毫秒）
const CACHE_DURATIONS = {
  longTerm: 30 * 60 * 1000,    // 30分钟，减少缓存时间
  mediumTerm: 10 * 60 * 1000,  // 10分钟
  shortTerm: 3 * 60 * 1000     // 3分钟
};

/**
 * Service Worker安装事件
 */
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    Promise.all([
      // 预缓存静态资源
      caches.open(STATIC_CACHE_NAME).then((cache) => {
        console.log('Precaching static assets...');
        return cache.addAll(STATIC_ASSETS);
      }),
      // 跳过等待，立即激活
      self.skipWaiting()
    ])
  );
});

/**
 * Service Worker激活事件
 */
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    Promise.all([
      // 清理旧缓存
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && 
                cacheName !== API_CACHE_NAME && 
                cacheName !== STATIC_CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // 立即控制所有客户端
      self.clients.claim()
    ])
  );
});

/**
 * 网络请求拦截
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 只处理同源请求
  if (url.origin !== location.origin) {
    return;
  }

  // API请求缓存策略
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // 静态资源缓存策略
  if (isStaticAsset(url.pathname)) {
    event.respondWith(handleStaticAsset(request));
    return;
  }

  // HTML页面缓存策略
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }
});

/**
 * 处理API请求
 */
async function handleApiRequest(request) {
  const url = new URL(request.url);
  const cacheName = API_CACHE_NAME;
  
  try {
    // 确定缓存策略
    const cacheStrategy = getCacheStrategy(url.pathname);
    
    if (cacheStrategy === 'no-cache') {
      // 不缓存的请求直接从网络获取
      return await fetch(request);
    }

    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    // 检查缓存是否有效
    if (cachedResponse && isCacheValid(cachedResponse, cacheStrategy)) {
      console.log('Serving API from cache:', url.pathname);
      return cachedResponse;
    }

    // 从网络获取
    const networkResponse = await fetch(request);
    
    // 只缓存成功的GET请求
    if (request.method === 'GET' && networkResponse.ok) {
      const responseToCache = networkResponse.clone();
      
      // 添加缓存时间戳
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cached-at', Date.now().toString());
      
      const cachedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers
      });
      
      await cache.put(request, cachedResponse);
      console.log('Cached API response:', url.pathname);
    }

    return networkResponse;
  } catch (error) {
    console.error('API request failed:', error);
    
    // 如果网络失败，尝试返回缓存的响应
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('Serving stale API cache due to network error:', url.pathname);
      return cachedResponse;
    }
    
    throw error;
  }
}

/**
 * 处理静态资源
 */
async function handleStaticAsset(request) {
  const cache = await caches.open(STATIC_CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    console.log('Serving static asset from cache:', request.url);
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
      console.log('Cached static asset:', request.url);
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Static asset request failed:', error);
    throw error;
  }
}

/**
 * 处理页面导航
 */
async function handleNavigation(request) {
  try {
    // 优先从网络获取最新的HTML
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, networkResponse.clone());
      return networkResponse;
    }
  } catch (error) {
    console.log('Network failed, trying cache...');
  }

  // 网络失败时从缓存获取
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    console.log('Serving page from cache:', request.url);
    return cachedResponse;
  }

  // 如果都没有，返回离线页面
  return new Response('Offline', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'text/plain' }
  });
}

/**
 * 获取缓存策略
 */
function getCacheStrategy(pathname) {
  // 检查长期缓存
  if (API_CACHE_CONFIG.longTerm.some(pattern => pathname.includes(pattern))) {
    return 'longTerm';
  }
  
  // 检查中期缓存
  if (API_CACHE_CONFIG.mediumTerm.some(pattern => pathname.includes(pattern))) {
    return 'mediumTerm';
  }
  
  // 检查短期缓存
  if (API_CACHE_CONFIG.shortTerm.some(pattern => pathname.includes(pattern))) {
    return 'shortTerm';
  }
  
  // 默认不缓存
  return 'no-cache';
}

/**
 * 检查缓存是否有效
 */
function isCacheValid(response, strategy) {
  const cachedAt = response.headers.get('sw-cached-at');
  
  if (!cachedAt) {
    return false;
  }
  
  const cacheAge = Date.now() - parseInt(cachedAt);
  const maxAge = CACHE_DURATIONS[strategy] || 0;
  
  return cacheAge < maxAge;
}

/**
 * 判断是否为静态资源
 */
function isStaticAsset(pathname) {
  const staticExtensions = ['.js', '.css', '.woff', '.woff2', '.ttf', '.ico', '.png', '.jpg', '.jpeg', '.svg'];
  return staticExtensions.some(ext => pathname.endsWith(ext)) || pathname.startsWith('/assets/');
}
