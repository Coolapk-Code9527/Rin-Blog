/// <reference types="tailwindcss/tailwind-config" />

// 扩展CSS模块导入功能
declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

// 添加Tailwind特定类型
interface TailwindConfig {
  content: string[];
  darkMode?: 'media' | 'class';
  theme: {
    extend: {
      colors: {
        theme: {
          DEFAULT: string;
        };
        background: {
          light: string;
          dark: string;
        };
        dark: string;
      };
    };
  };
  plugins: any[];
} 