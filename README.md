# Rin

English | [简体中文](./README_zh_CN.md)

![Cover](https://repository-images.githubusercontent.com/803866357/958bc2c1-1703-4127-920c-853291495bdc)

![GitHub commit activity](https://img.shields.io/github/commit-activity/w/openRin/Rin?style=for-the-badge)
![GitHub branch check runs](https://img.shields.io/github/check-runs/openRin/Rin/main?style=for-the-badge)
![GitHub top language](https://img.shields.io/github/languages/top/openRin/Rin?style=for-the-badge)
![GitHub License](https://img.shields.io/github/license/openRin/Rin?style=for-the-badge)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/openRin/Rin/deploy.yaml?style=for-the-badge)

[![Discord](https://img.shields.io/badge/Discord-openRin-red?style=for-the-badge&color=%236e7acc)](https://discord.gg/JWbSTHvAPN)
[![Telegram](https://img.shields.io/badge/Telegram-openRin-red?style=for-the-badge&color=%233390EC)](https://t.me/openRin)

# Introduction

Rin is a blog based on Cloudflare Pages + Workers + D1 + R2. It does not require a server to deploy. It can be deployed just with a domain name that resolves to Cloudflare.

## Demo

[xeu.life](https://xeu.life)

## Features
1. Support GitHub OAuth login. By default, the first logged-in user has management privileges, and other users are ordinary users
2. Support article writing and editing
3. Support local real-time saving of modifications/edits to any article without interfering between multiple articles
4. Support setting it as visible only to yourself, which can serve as a draft box for cloud synchronization or record more private content
5. Support dragging/pasting uploaded images to a bucket that supports the S3 protocol and generating links
6. Support setting article aliases, and access articles through links such as https://xeu.life/about
7. Support articles not being listed in the homepage list
8. Support adding links of friends' blog, and the backend regularly checks and updates the accessible status of links every 20 minutes
9. Support replying to comment articles/deleting comments
10. Support sending comment notifications through Webhook
11. Support automatic identification of the first picture in the article and display it as the header image in the article list
12. Support inputting tag texts such as "#Blog #Cloudflare" and automatically parsing them into tags
13. Fully responsive design with enhanced navigation experience across desktop, tablet, and mobile devices
14. Smooth animations and micro-interactions for better user engagement
15. Multi-language support with an intuitive language switching interface
16. Seamless dark mode integration with automatic system preference detection
17. Responsive dual-column article grid layout for desktop with optimized single-column view on mobile devices
18. Enhanced article card design with consistent height, elegant visual style and improved accessibility
19. Smart tag coloring system that automatically assigns visually distinct colors to different tags
20. Rich content metadata with helpful indicators for article freshness, status, and importance
21. Mobile-optimized UI with compact design and adaptive elements
22. For more features, please refer to https://xeu.life

# User Interface
- **Responsive Navigation**: Adapts seamlessly to different screen sizes with optimized layouts for desktop, tablet, and mobile devices
- **Interactive Elements**: Enhanced visual feedback for navigation items, language switcher, and user avatar
- **Micro-animations**: Subtle animations for menu transitions, popups, and interactive elements
- **Accessibility**: Improved keyboard navigation and screen reader support
- **Article Cards**: Visually appealing cards with consistent height, standardized image display, improved typography, and enhanced hover effects
- **Grid Layout**: Efficient use of screen space with dual-column grid on desktop and single column on mobile
- **Unified Design Language**: Consistent spacing, border radius, shadows, and color scheme throughout the interface
- **Flexible Content Display**: Cards intelligently handle varying content lengths (titles, summaries, tags) while maintaining visual consistency
- **Improved Tag Design**: Color-coded tags with intuitive visual hierarchy and pleasing hover animations
- **Empty State Handling**: Graceful display when no articles are available in the current view
- **Enhanced Status Indicators**: Clear visual distinction for pinned, draft, and unlisted articles
- **Semantic HTML Structure**: Properly structured HTML for better SEO and accessibility
- **Visual Hierarchy**: Clear distinction between different sections of the interface
- **Content Freshness Indicators**: Special visual cues for newly published content
- **Interactive Tag System**: Advanced tag interaction with improved usability and visual feedback
- **Optimized Dark Mode**: Carefully tuned dark theme with appropriate contrast and color balance
- **Mobile-First Implementation**: Compact UI elements and simplified interactions for small screens
- **Adaptive Content Presentation**: Dynamic element sizing and spacing based on viewport dimensions
- **Progressive Enhancement**: Feature-rich experience on desktop with essential functionality preserved on mobile

# Documentation
[rin-docs.xeu.life](https://rin-docs.xeu.life)

## Star History

<a href="https://star-history.com/#openRin/Rin&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=openRin/Rin&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=openRin/Rin&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=openRin/Rin&type=Date" />
 </picture>
</a>

# License
```
MIT License

Copyright (c) 2024 Xeu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

# Rin-Blog项目优化总结

## 项目结构

Rin-Blog是一个基于Cloudflare技术栈的博客系统：
- 前端：Cloudflare Pages
- 后端：Cloudflare Workers
- 数据库：Cloudflare D1
- 对象存储：Cloudflare R2

项目采用单体仓库管理前后端代码，通过GitHub Actions实现自动化部署。

## 已完成优化

### 1. 视觉设计统一性优化
- 移除了"公开发布的文章，所有人可见"文本，使界面更简洁
- 统一了文章详情页右上角的操作按钮（置顶、编辑、删除）样式，采用固定尺寸的方形按钮（w-8 h-8）
- 优化了文章列表页的草稿箱和未列出按钮样式，保持与其他操作按钮一致
- 改进了导航栏中的"写作"按钮，使其更加突出和美观

### 2. 功能体验优化
- 添加了更明确的视觉层次结构
- 优化了按钮的可点击区域和视觉反馈
- 确保了各个状态下按钮样式的一致性

## 优化建议

根据2023-2025年的UI设计趋势，我们提出以下优化建议：

### 1. 深色模式完善
深色模式已成为标准功能，而非额外选项。建议完善深色模式下的各组件样式，特别是保证按钮、卡片和文本在暗色背景下的可读性和视觉层次感。

### 2. 微交互优化
- 在按钮和操作元素上添加微动效，增强反馈感
- 为滚动、加载和状态变化设计细致的动画效果
- 优化页面过渡效果，增强整体流畅感

### 3. 引入适度的维度感
- 在卡片和按钮上添加轻微的阴影和深度，增加界面层次感
- 考虑在重要区域使用弥散光效果，强调关键功能
- 探索使用"新拟态"风格，为界面添加柔和质感

### 4. 空间布局优化
- 考虑采用Bento Grid布局组织首页和文章列表，提升内容呈现效率
- 增加内容之间的空间留白，改善阅读体验
- 优化移动端适配，确保响应式设计的一致性

### 5. 插画和视觉元素
- 考虑在空状态页面添加插画风格的图形
- 为不同类型的内容设计差异化的视觉标识
- 使用一致的视觉语言增强品牌辨识度

### 6. AI功能探索
- 考虑集成AI辅助写作功能，帮助用户创建内容
- 添加智能内容推荐功能
- 探索语音交互界面，增加内容消费的便捷性

## 实施建议

1. **优先级排序**：首先完善深色模式和微交互，这些对用户体验影响最直接
2. **渐进式实施**：将大型改动分解为小步骤，逐步实施并收集反馈
3. **A/B测试**：对重要变更进行A/B测试，衡量用户反应
4. **保持一致性**：确保所有优化遵循统一的设计语言和原则
5. **关注性能**：在添加视觉效果时不影响加载速度和性能

## 预期效果

完成以上优化后，Rin-Blog将具有：
- 更加现代化和专业的视觉体验
- 更高的用户参与度和留存率
- 更流畅和直观的交互体验
- 更强的品牌辨识度
- 更好的跨设备兼容性

这些改进将使Rin-Blog在保持简洁实用的同时，提供更具吸引力和沉浸感的博客体验。
