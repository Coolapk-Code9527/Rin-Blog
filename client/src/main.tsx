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
import { siteName } from './utils/constants'
import { listenSystemMode } from './utils/darkModeUtils'
import LanguageDetector from 'i18next-browser-languagedetector';
import { ApiClient } from './types/api';
import { StagewiseToolbar } from '@stagewise/toolbar-react';

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
  console.error('警告: 生产环境中未设置API_URL环境变量，API请求可能无法正常工作');
  console.log('请在Cloudflare Pages中设置API_URL环境变量，指向您的API服务器地址');
}

// OAuth URL同样从API端点派生
export const oauth_url = endpoint + '/user/github';
export const client = treaty<ServerType>(endpoint) as unknown as ApiClient;

// 调试信息
console.log('当前环境:', isDev ? '开发环境' : '生产环境');
console.log('API端点:', endpoint);

listenSystemMode()

// 初始化i18n
// 使用变量中转来避免类型问题
const i18n = i18next;
(i18n as any)
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: ['zh-CN', 'en'], // 优先使用zh-CN
    supportedLngs: ['en', 'zh-CN', 'zh-TW', 'ja'],
    load: 'currentOnly', // 避免自动降级到zh
    backend: {
      loadPath: '/locales/{{lng}}/translation.json',
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  })
  .then(() => {
    console.log('i18n 初始化完成，当前语言:', (i18n as any).language);
  })
  .catch((err) => {
    console.error('i18n 初始化失败:', err);
  });

const helmetContext = {};

// 修复React.StrictMode组件问题
ReactDOM.createRoot(document.getElementById('root')!).render(
  // @ts-ignore - 忽略React.StrictMode的类型检查
  <React.StrictMode>
    <HelmetProvider context={helmetContext}>
      <App />
    </HelmetProvider>
  </React.StrictMode>
)
Modal.setAppElement('#root');

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

// 自动注入 S3_ACCESS_HOST 到 sessionStorage，确保站内文件识别
(async () => {
  try {
    const res = await fetch('/config/client');
    if (res.ok) {
      const config = await res.json();
      if (config.S3_ACCESS_HOST) {
        const old = JSON.parse(window.sessionStorage.getItem('config') || '{}');
        old.S3_ACCESS_HOST = config.S3_ACCESS_HOST;
        window.sessionStorage.setItem('config', JSON.stringify(old));
      } else {
        // 生产环境下无 S3_ACCESS_HOST，输出警告
        if (!isDev) {
          alert('S3_ACCESS_HOST 未注入，部分文件功能可能无法正常使用，请联系管理员检查后端 /config/client 配置。');
        }
        console.warn('S3_ACCESS_HOST 未注入，无法识别站内文件链接，请检查后端 /config/client 配置和前端注入逻辑');
      }
    } else {
      if (!isDev) {
        alert('无法获取 /config/client，部分文件功能可能无法正常使用。');
      }
      console.warn('无法获取 /config/client，S3_ACCESS_HOST 注入失败');
    }
  } catch (e) {
    if (!isDev) {
      alert('S3_ACCESS_HOST 注入异常，部分文件功能可能无法正常使用。');
    }
    console.error('S3_ACCESS_HOST 注入异常', e);
  }
  // 兜底：如果没有S3_ACCESS_HOST，不再写入默认值，输出警告
  const cfg = JSON.parse(window.sessionStorage.getItem('config') || '{}');
  if (!cfg.S3_ACCESS_HOST) {
    if (isDev) {
      console.warn('S3_ACCESS_HOST 未注入，无法识别站内文件链接，请检查后端 /config/client 配置和前端注入逻辑');
    }
    // 不写入默认值，保持 config 为空
  }
})();