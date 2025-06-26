import { treaty } from '@elysiajs/eden'
import i18next from "i18next"
import React from 'react'
import ReactDOM from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import Backend from 'i18next-http-backend';
import { initReactI18next } from "react-i18next"
import Modal from 'react-modal'
import App from './App'
import './index.css'
import './components.css'
import { listenSystemMode, initializeTheme } from './utils/darkModeUtils'
import LanguageDetector from 'i18next-browser-languagedetector';
import { ApiClient } from './types/api';
import { StagewiseToolbar } from '@stagewise/toolbar-react';
import { registerServiceWorker } from './utils/serviceWorker';
import { clearExpiredCache } from './hooks/useApiCache';
import { initializeComputeCache } from './hooks/useComputedCache';
// import { enhanceTreatyWithCache } from './utils/apiCacheInterceptor';

// 模拟API服务器类型，临时替代 'rin-server/src/server' 模块
// 在实际使用中，应该导入正确的服务器类型
type ServerType = any;

// 根据环境动态选择API端点
const isDev = import.meta.env.DEV;

// Cloudflare Pages环境变量访问
// 在开发环境使用本地服务器
// 在生产环境从Cloudflare Pages环境变量中读取API_URL
// 注意: Cloudflare Pages环境变量可以直接通过全局变量process.env访问
export const endpoint = isDev 
  ? 'http://localhost:11498' 
  : (process.env.API_URL || '');

// 如果在生产环境中没有设置API_URL，在控制台发出警告
if (!isDev && !endpoint) {
  console.error('Warning: API_URL environment variable not set in production, API requests may not work properly');
}

// OAuth URL同样从API端点派生
export const oauth_url = endpoint + '/user/github';

// 创建treaty客户端（暂时不使用缓存增强，避免运行时错误）
export const client = treaty<ServerType>(endpoint) as unknown as ApiClient;

// TODO: 在后续版本中重新启用缓存增强
// const baseClient = treaty<ServerType>(endpoint) as unknown as ApiClient;
// export const client = enhanceTreatyWithCache(baseClient, {
//   enabled: true,
//   defaultTTL: 5 * 60 * 1000,
//   useConditionalRequests: true,
//   cacheStrategies: {
//     '/api/tag/index': 'API_LONG_TERM',
//     '/api/config': 'API_LONG_TERM',
//     '/api/feed/index': 'API_MEDIUM_TERM',
//     '/api/feed/': 'API_MEDIUM_TERM',
//     '/api/feed/comment': 'API_SHORT_TERM',
//     '/api/search': 'API_SHORT_TERM'
//   }
// });

// 立即初始化主题，确保在React渲染前应用正确的主题
initializeTheme();

// 清理过期缓存
clearExpiredCache();

// 初始化计算缓存
initializeComputeCache();

// 注册Service Worker（仅在生产环境）
if (import.meta.env.PROD) {
  registerServiceWorker({
    enabled: true,
    updateCheckInterval: 60 * 60 * 1000, // 1小时检查一次更新
    skipWaiting: false
  }).then((registration) => {
    if (registration) {
      console.log('Service Worker registered successfully');
    }
  }).catch((error) => {
    console.error('Service Worker registration failed:', error);
  });
}

// 初始化i18n
// 使用变量中转来避免类型问题
const i18n = i18next;
(i18n as any)
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    fallbackLng: "en",
    interpolation: {
      escapeValue: false
    }
  });

const helmetContext = {};

// 重新启用React.StrictMode进行深入分析
ReactDOM.createRoot(document.getElementById('root')!).render(
  // @ts-ignore - 忽略React.StrictMode的类型检查
  <React.StrictMode>
    <HelmetProvider context={helmetContext}>
      <App />
    </HelmetProvider>
  </React.StrictMode>
)
Modal.setAppElement('#root');

// 初始化系统主题监听
listenSystemMode();



// 开发环境下挂载stagewise工具栏
if (isDev) {
  const toolbarConfig = { plugins: [] };
  let toolbarRoot = document.getElementById('stagewise-toolbar-root');
  if (!toolbarRoot) {
    toolbarRoot = document.createElement('div');
    toolbarRoot.id = 'stagewise-toolbar-root';
    document.body.appendChild(toolbarRoot);
  }
  ReactDOM.createRoot(toolbarRoot).render(
    <StagewiseToolbar config={toolbarConfig} />
  );
}