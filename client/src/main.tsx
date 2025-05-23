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
// 在开发环境使用本地服务器，在生产环境使用当前域名
export const endpoint = isDev ? 'http://localhost:11498' : window.location.origin;
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
    interpolation: {
      escapeValue: false // react already safes from xss => https://www.i18next.com/translation-function/interpolation#unescape
    }
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