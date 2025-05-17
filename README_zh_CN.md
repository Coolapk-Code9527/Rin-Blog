# Rin-Blog

<p align="center">
  <img src="client/public/favicon.svg" width="100" />
</p>

<div align="center">
  
  [![Deploy](https://github.com/iltermon/rin-blog/actions/workflows/deploy.yaml/badge.svg)](https://github.com/iltermon/rin-blog/actions/workflows/deploy.yaml)
  [![License](https://img.shields.io/github/license/iltermon/rin-blog)](https://github.com/iltermon/rin-blog/blob/main/LICENSE)
  [![GitHub Repo stars](https://img.shields.io/github/stars/iltermon/rin-blog?label=stars)](https://github.com/iltermon/rin-blog/stargazers)

</div>

[English](./README.md) | 简体中文

基于 Cloudflare Pages + Workers + D1 + R2 的博客系统

## 特性

- 支持本地开发 / 部署到Cloudflare
- 基于 [Markdown](https://www.markdownguide.org/) 的文章编写
- 支持 [KaTeX](https://katex.org/) 数学公式
- 支持 [Mermaid](https://mermaid-js.github.io/) 图表
- 支持 [Remoji](https://github.com/iltermon/remoji) (类似Discord的表情符号，例如 `:smile:`)
- 支持 RSS 订阅
- 支持多语言 (i18n, 中文 / 英文 / 日文)
- 支持评论 (可匿名评论)
- 支持文章封面图
- 支持文章置顶
- 支持文章标签
- 支持文章统计 (PV/UV)
- 支持 [自定义图标](https://iltermon.github.io/2023/10/rin-blog-favicon/)
- 移动端友好的响应式设计

## 新增阅读优化特性

- **现代化阅读体验**：全新设计的文章页面布局，支持阅读模式，让读者更专注于内容
- **智能文章封面**：自动从文章内容提取首图作为封面，增强视觉吸引力
- **阅读进度指示**：文章顶部进度条实时显示阅读进度，提升用户体验
- **相关文章推荐**：基于文章标签智能匹配相关内容，增强内容探索
- **代码块优化**：改进代码高亮和复制功能，方便技术内容展示
- **图片优化**：支持图片懒加载、点击放大，提升加载速度和浏览体验
- **响应式设计**：针对各种设备尺寸优化的布局，从手机到桌面均有良好体验
- **阅读便利功能**：上一篇/下一篇导航，侧边栏目录，最近文章推荐

## 安装

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/iltermon/rin-blog)

- [部署教程](https://iltermon.github.io/2023/07/rin-blog-deploy/)
- [简易自动部署脚本](https://gist.github.com/iltermon/0c6d0cffdebc3181984106a8c94b53c4)

### 本地开发

> 推荐使用 Node.js v20.x 以上版本
> 本地测试时建议使用 [WSL2](https://learn.microsoft.com/en-us/windows/wsl/install) 或 Linux 系统

1. 克隆仓库

   ```bash
   git clone https://github.com/iltermon/rin-blog.git
   cd rin-blog
   ```

2. 安装依赖

   ```bash
   corepack enable # 启用 corepack
   corepack prepare --activate # 激活 pnpm
   pnpm i # 安装依赖
   ```

3. 拷贝 `.dev.example.vars` 为 `.dev.vars` 并按需修改配置

   ```bash
   cp .dev.example.vars .dev.vars

   # 编辑 .dev.vars 文件
   ```

4. 启动开发服务器

   ```bash
   pnpm dev
   ```

## 配置

参见 `.dev.example.vars` 和 [wrangler.example.toml](./wrangler.example.toml)。

## 多语言 (i18n)

请查看 `/client/public/locales/**/translation.json` 文件。

## 贡献

欢迎贡献代码！请查看 [贡献指南](./CONTRIBUTING_zh_CN.md)。

## 截图

![文章列表](https://github.com/iltermon/rin-blog/assets/36158564/2d63ac43-095c-417e-a1d7-b042bfd9c97f)
![文章详情页面](https://github.com/iltermon/rin-blog/assets/36158564/5c1fef3f-5fc1-4695-a8ea-d9ef6c306838)

### 新增优化截图

![新版文章详情页](client/public/article_page_new.png)
![阅读模式](client/public/reading_mode.png)
![响应式设计](client/public/responsive_design.png)

## 许可协议

MIT
