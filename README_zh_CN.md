# Rin

[English](./README.md) | 简体中文


![封面](https://repository-images.githubusercontent.com/803866357/958bc2c1-1703-4127-920c-853291495bdc)

![GitHub commit activity](https://img.shields.io/github/commit-activity/w/openRin/Rin?style=for-the-badge)
![GitHub branch check runs](https://img.shields.io/github/check-runs/openRin/Rin/main?style=for-the-badge)
![GitHub top language](https://img.shields.io/github/languages/top/openRin/Rin?style=for-the-badge)
![GitHub License](https://img.shields.io/github/license/openRin/Rin?style=for-the-badge)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/openRin/Rin/deploy.yaml?style=for-the-badge)

[![Discord](https://img.shields.io/badge/Discord-openRin-red?style=for-the-badge&color=%236e7acc)](https://discord.gg/JWbSTHvAPN)
[![Telegram](https://img.shields.io/badge/Telegram-openRin-red?style=for-the-badge&color=%233390EC)](https://t.me/openRin)

# 介绍

Rin 是一个基于 Cloudflare Pages + Workers + D1 + R2 全家桶的博客，无需服务器无需备案，只需要一个解析到 Cloudflare 的域名即可部署。

## 演示地址

[xeu.life](https://xeu.life)


## 特性
1. 支持 Github OAuth 登录，默认第一个登录的用户拥有管理权限，其他用户均为普通用户
2. 支持文章的写作与编辑
3. 支持本地实时保存对任意文章的修改/编辑且多篇文章互不干扰
4. 支持设置为仅自己可见，可以充当云端同步的草稿箱或者记录隐私性较强的内容
5. 支持拖拽/粘贴上传图片到支持 S3 协议的存储桶并生成链接
6. 支持设置文章别名，可通过形如 https://xeu.life/about 链接访问文章
7. 支持文章不列出在首页列表中
8. 支持添加友链，同时后端每间隔 20 分钟定期检查更新友链可访问状态
9. 支持回复评论文章/删除评论
10. 支持通过 Webhook 发送评论通知
11. 支持自动识别文章中的第一张图片并作为头图展示在文章列表中
12. 支持输入形如"#博客 #部署 #Cloudflare"之类的标签文本并自动解析为标签
13. 全响应式设计，在桌面端、平板和移动设备上提供增强的导航体验
14. 流畅的动画和微交互，提升用户体验
15. 多语言支持，直观的语言切换界面
16. 无缝深色模式集成，自动检测系统偏好
17. 响应式双列文章网格布局，在桌面端显示双列，在移动设备上优化为单列视图
18. 优化的文章卡片设计，具有一致的高度、优雅的视觉风格和改进的可访问性
19. 智能标签着色系统，自动为不同标签分配视觉上独特的颜色
20. 丰富的内容元数据，包含文章新鲜度、状态和重要性的有用指示器
21. 移动端优化UI，紧凑设计和自适应元素
22. 更多特性请参考 https://xeu.life

# 用户界面
- **响应式导航**：无缝适配不同屏幕尺寸，为桌面端、平板和移动设备优化布局
- **交互元素**：导航项、语言切换器和用户头像的增强视觉反馈
- **微动画**：菜单过渡、弹出窗口和交互元素的精细动画
- **无障碍设计**：改进的键盘导航和屏幕阅读器支持
- **文章卡片**：视觉吸引力强的卡片，具有一致的高度、标准化的图片显示、改进的排版和增强的悬停效果
- **网格布局**：高效利用屏幕空间，桌面端双列网格，移动端单列显示
- **统一设计语言**：整个界面保持一致的间距、圆角、阴影和配色方案
- **灵活的内容显示**：卡片智能处理不同长度的内容（标题、摘要、标签），同时保持视觉一致性
- **改进的标签设计**：色彩编码的标签，具有直观的视觉层次结构和令人愉悦的悬停动画
- **空状态处理**：当当前视图中没有文章时，优雅地显示提示信息
- **增强的状态指示器**：为置顶、草稿和未列出的文章提供清晰的视觉区分
- **语义化HTML结构**：结构合理的HTML代码，提升SEO和无障碍性
- **视觉层次结构**：界面不同部分之间的清晰区分
- **内容新鲜度指示器**：为新发布的内容提供特殊的视觉提示
- **交互式标签系统**：具有改进的可用性和视觉反馈的高级标签交互
- **优化的暗色模式**：精心调整的暗色主题，具有适当的对比度和颜色平衡
- **移动优先实现**：小屏幕上的紧凑UI元素和简化交互
- **自适应内容呈现**：基于视口尺寸的动态元素大小和间距
- **渐进增强**：桌面端提供功能丰富的体验，移动端保留基本功能

# 文档

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

- 文件列表接口每个文件项包含：
  - url：原图访问地址，格式为 `${S3_ACCESS_HOST}${file.path}`，用于图片/文件原图访问与下载
  - thumbUrl：缩略图访问地址，格式为 `${S3_ACCESS_HOST}${parentPath}/thumb_${thumbnailHash}`，用于图片缩略图懒加载展示
- 前端 FileManager 组件优先用 thumbUrl 渲染缩略图，点击弹窗 FilePreview 用 url 加载原图，体验与主流云盘一致
- 文件管理支持图片、视频、音频、PDF、文本等类型的在线预览，点击文件自动弹窗预览，体验与主流云盘一致
- 文本/代码/Markdown/JSON等文件预览通过后端代理接口 /api/proxy 解决 CORS 问题，无需配置 R2/S3 CORS，安全高效
