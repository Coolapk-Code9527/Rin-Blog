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
      // 使用Vite默认的代码分割策略，确保稳定性
      rollupOptions: {
        output: {
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