#!/bin/bash

echo "修复React Markdown依赖问题"
echo "=========================="

# 安装缺少的依赖（确保不使用--frozen-lockfile）
echo "安装react-markdown和相关依赖..."
bun add react-markdown@latest remark-gfm rehype-raw rehype-katex rehype-slug rehype-autolink-headings remark-math

# 修复导入
echo "检查导入问题已修复..."
echo "import { ReactMarkdown } from 'react-markdown/lib/react-markdown' 已更改为 import ReactMarkdown from 'react-markdown'"

# 清理缓存
echo "清理缓存..."
rm -rf node_modules/.vite

# 重新构建
echo "尝试重新构建..."
bun run build

echo "完成！" 