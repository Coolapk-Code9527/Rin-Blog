import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { visualizer } from "rollup-plugin-visualizer";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    define: {
      'process.env': JSON.stringify(env)
    },
    plugins: [
      react(),
      visualizer({
        filename: 'dist/stats.html',
        open: false, // 不自动打开，避免干扰
        gzipSize: true,
        brotliSize: true
      })
    ],
    build: {
      // 代码分割优化配置
      rollupOptions: {
        output: {
          // 手动分割代码块
          manualChunks: (id) => {
            // 基于模块路径的智能分割
            if (id.includes('node_modules')) {
              // React核心库
              if (id.includes('react') || id.includes('react-dom')) {
                return 'react-vendor';
              }
              // Monaco编辑器（大型组件）
              if (id.includes('@monaco-editor') || id.includes('monaco-editor')) {
                return 'monaco-vendor';
              }
              // Markdown和语法高亮
              if (id.includes('react-markdown') ||
                  id.includes('react-syntax-highlighter') ||
                  id.includes('remark-') ||
                  id.includes('rehype-')) {
                return 'markdown-vendor';
              }
              // 图片查看器
              if (id.includes('yet-another-react-lightbox')) {
                return 'lightbox-vendor';
              }
              // 图表库
              if (id.includes('mermaid')) {
                return 'chart-vendor';
              }
              // 文件处理库 - 分开处理避免循环依赖
              if (id.includes('jszip')) {
                return 'jszip-vendor';
              }
              if (id.includes('xlsx')) {
                return 'xlsx-vendor';
              }
              if (id.includes('mammoth')) {
                return 'mammoth-vendor';
              }
              if (id.includes('file-saver')) {
                return 'file-saver-vendor';
              }
              // 数学公式库
              if (id.includes('katex')) {
                return 'math-vendor';
              }
              // 国际化库
              if (id.includes('i18next')) {
                return 'i18n-vendor';
              }
              // 日期处理库
              if (id.includes('date-fns')) {
                return 'date-vendor';
              }
              // 其他工具库
              if (id.includes('typescript-cookie') ||
                  id.includes('copy-to-clipboard') ||
                  id.includes('wouter') ||
                  id.includes('react-helmet-async') ||
                  id.includes('react-modal')) {
                return 'utils-vendor';
              }
              // 其他第三方库
              return 'vendor';
            }
            // 页面级分割
            if (id.includes('/page/')) {
              const pageName = id.split('/page/')[1].split('.')[0];
              return `page-${pageName}`;
            }
          },
          // 优化文件名
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]'
        }
      },
      // 设置chunk大小警告阈值
      chunkSizeWarningLimit: 1000,
      // 启用源码映射（开发时）
      sourcemap: false,
      // 压缩配置
      minify: 'esbuild',
      // 目标浏览器
      target: 'es2020'
    }
  }
})