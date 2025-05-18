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

// 确保API端点始终指向本地服务器
export const endpoint = 'http://localhost:11498'
export const oauth_url = endpoint + '/user/github'
export const client = treaty<ServerType>(endpoint) as unknown as ApiClient;

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