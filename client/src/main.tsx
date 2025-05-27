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
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    fallbackLng: "en",
    debug: isDev, // 开发环境下开启调试模式
    defaultNS: 'translation', 
    ns: ['translation'],
    keySeparator: '.', // 使用.作为嵌套键的分隔符
    interpolation: {
      escapeValue: false // react already safes from xss => https://www.i18next.com/translation-function/interpolation#unescape
    }
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