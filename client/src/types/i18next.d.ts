declare module 'react-i18next' {
  export const initReactI18next: any;
  
  export interface UseTranslationResponse {
    t: (key: string, options?: object) => string;
    i18n: any;
    use: any;
    language: string;
  }
  
  export function useTranslation(): UseTranslationResponse;
}

declare module 'i18next' {
  export function t(key: string, options?: object): string;
  
  export interface i18n {
    t: (key: string, options?: object) => string;
    use: any;
    language: string;
  }
  
  export default {
    t,
    use: (plugin: any) => any,
    init: (options: any) => Promise<any>,
    language: string, // 类型安全修复：添加缺失的language属性
  } as any;
}

// 添加i18next-http-backend模块声明
declare module 'i18next-http-backend' {
  const Backend: any;
  export default Backend;
}

// 添加i18next-browser-languagedetector模块声明
declare module 'i18next-browser-languagedetector' {
  const LanguageDetector: any;
  export default LanguageDetector;
} 