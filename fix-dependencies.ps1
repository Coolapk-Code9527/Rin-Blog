# Windows PowerShell版本

Write-Host "修复React Markdown依赖问题" -ForegroundColor Green
Write-Host "==========================" -ForegroundColor Green

# 安装缺少的依赖（确保不使用--frozen-lockfile）
Write-Host "安装react-markdown和相关依赖..." -ForegroundColor Yellow
bun add react-markdown@latest remark-gfm rehype-raw rehype-katex rehype-slug rehype-autolink-headings remark-math --no-frozen-lockfile

# 安装可能缺少的其他依赖
Write-Host "安装其他可能缺少的依赖..." -ForegroundColor Yellow
cd client
bun add react-router-dom react-redux redux web-vitals --no-frozen-lockfile
cd ..

# 修复导入
Write-Host "检查导入问题已修复..." -ForegroundColor Yellow
Write-Host "import { ReactMarkdown } from 'react-markdown/lib/react-markdown' 已更改为 import ReactMarkdown from 'react-markdown'" -ForegroundColor Cyan

# 清理缓存
Write-Host "清理缓存..." -ForegroundColor Yellow
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue node_modules/.vite

# 重新构建
Write-Host "尝试重新构建..." -ForegroundColor Yellow
bun run build

Write-Host "完成！" -ForegroundColor Green 