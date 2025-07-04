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
// 初始化智能缓存同步
import './utils/SmartCacheSync'
import LanguageDetector from 'i18next-browser-languagedetector';
import { ApiClient } from './types/api';
import { StagewiseToolbar } from '@stagewise/toolbar-react';
import { setupGlobalErrorHandlers } from './components/ErrorBoundary';

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

// OAuth URL同样从API端点派生，确保endpoint不为空
export const oauth_url = endpoint ? endpoint + '/user/github' : '/user/github';
export const client = treaty<ServerType>(endpoint) as unknown as ApiClient;

// 立即初始化主题，确保在React渲染前应用正确的主题
initializeTheme();

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

// React 19版本的StrictMode存在类型兼容性问题，暂时移除
// 在React 19类型定义修复后可以重新启用
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found. Please ensure there is a div with id="root" in your HTML.');
}
const root = ReactDOM.createRoot(rootElement);

root.render(
  <HelmetProvider context={helmetContext}>
    <App />
  </HelmetProvider>
)
Modal.setAppElement('#root');

// 初始化系统主题监听
listenSystemMode();

// 设置全局错误处理器
setupGlobalErrorHandlers();



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