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

## 最近更新

### 博客文章详情页优化 (2024-11)

基于2024-2025年的博客设计最佳实践，我们对博客文章详情页进行了全面优化：

#### 布局优化
- 重新设计了文章内容区域的宽度，实现了最佳阅读体验
- 优化了响应式布局，在不同设备上提供更好的阅读体验
- 增加了右侧栏宽度，提供更多空间展示目录和相关文章

#### 排版与视觉增强
- 引入了新的排版系统，使用相对单位和clamp()函数实现流畅的字体缩放
- 优化了文章内容的视觉层次，包括标题、段落、引用等元素
- 改进了图片和媒体内容的展示方式，添加圆角和阴影效果

#### 用户体验提升
- 添加了阅读进度指示器，帮助用户了解阅读位置
- 为移动设备添加了目录抽屉组件，方便在小屏幕设备上查看目录
- 优化了目录导航样式，添加了活动状态指示

#### 性能优化
- 改进了图像加载策略，减少页面加载时间
- 优化了CSS结构，提高了渲染性能

这些优化确保了博客文章在各种设备上都能提供出色的阅读体验，符合现代博客设计的最佳实践。
