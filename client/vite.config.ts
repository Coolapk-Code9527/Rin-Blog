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
          // 保守的代码分割策略 - 确保React稳定性
          manualChunks: (id) => {
            // 基于模块路径的保守分割
            if (id.includes('node_modules')) {
              // Monaco编辑器（大型独立组件，安全分割）
              if (id.includes('@monaco-editor') || id.includes('monaco-editor')) {
                return 'monaco-vendor';
              }
              // 图表库（大型独立库，安全分割）
              if (id.includes('mermaid')) {
                return 'chart-vendor';
              }
              // 数学公式库（独立库，安全分割）
              if (id.includes('katex')) {
                return 'math-vendor';
              }
              // 大型文件处理库（独立分割，避免循环依赖）
              if (id.includes('xlsx')) {
                return 'xlsx-vendor';
              }
              if (id.includes('mammoth')) {
                return 'mammoth-vendor';
              }
              // 其他库保持在主vendor中，确保稳定性
              return 'vendor';
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