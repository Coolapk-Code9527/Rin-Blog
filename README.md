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
22. macOS-style loading animation system with colorful breathing effects and lightweight circular indicators
23. For more features, please refer to https://xeu.life

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
- **Improved accessibility and user experience for code blocks in both dark and light modes**
- **macOS-style Loading System**: Unified loading animation aesthetics with colorful breathing dot animations and lightweight circular spinners
- **Performance-optimized Loading States**: Smart loading component selection based on usage scenarios, balancing visual effects with performance
- **Zero-dependency Animation Implementation**: Pure CSS animations reducing JavaScript overhead and improving overall application performance.

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

## File Manager Text/HTML File Preview Exception Handling

- When previewing txt, md, html and other text files, if R2 returns an HTML error page (such as 404/forbidden), a friendly message will be shown: "File not found or no permission, or R2 returned an error page."
- When previewing HTML file source code, a clear "HTML Source Preview" tip will be shown at the top to avoid user confusion.

## File Manager Utilities (client/src/components/file_manager/utils.ts)

This file provides common utilities for file management:

- `formatFileSize(bytes: number): string`: Format file size and return a string with unit.
- `getFileTypeIcon(mimeTypeOrName: string): string`: Get Remix icon class name by MIME type or file name.
- `EXT_ICON_MAP`: Mapping table for file extension to icon.
- `MIME_ICON_MAP`: Mapping table for common MIME types to icon.

All functions and constants are documented in both Chinese and English for multilingual development and maintenance.

## 2024-xx-xx FileManager Pagination Optimization
- Removed front-end slice logic, pagination is now fully backend-driven.
- Only renders current page data from backend, preventing lag with large file sets.
- Users can customize page size for a smoother experience.

## 2024-xx-xx Code Block Highlight & Interaction Fixes

- Fixed code blocks in some articles showing as all white/gray or without syntax highlight.
- Removed hardcoded color in SyntaxHighlighter, now respects theme colors.
- Optimized CSS: removed color: inherit !important from pre code, hover and button hover no longer override highlight colors.
- Expand/collapse button hover no longer causes code to disappear.
- Code blocks without language marker now default to plaintext and show a user tip.
- Top bar and content area now adapt to dark/light mode.

## 2024-12-xx macOS Design System Implementation

### Phase 1: Design System Foundation
- **Unified Color System**: Implemented Apple System Blue (#007AFF) as primary theme color across all components
- **Enhanced Shadow System**: Added 4-tier shadow system (shadow-enhanced, shadow-enhanced-lg, shadow-enhanced-xl, shadow-enhanced-2xl)
- **Glassmorphism Effects**: Applied backdrop-blur and semi-transparent backgrounds throughout the interface
- **Border Standardization**: Unified border colors using neutral-200/60 and neutral-700/60 with consistent transparency

### Phase 2: Core Component Styling
- **Button Components**: Complete redesign with enhanced shadows, micro-interactions, and scale animations
- **Input Components**: Glassmorphism backgrounds, theme-colored borders, and improved focus states
- **Card Components**: Elevated design with enhanced shadows and hover effects
- **Navigation Components**: Unified styling across desktop and mobile interfaces

### Phase 3: Page-Level Consistency
- **Homepage**: Enhanced article cards with improved visual hierarchy and consistent spacing
- **Timeline Page**: Optimized layout with better content organization and visual flow
- **Article Detail**: Improved reading experience with enhanced typography and spacing
- **Writing Interface**: Professional editor design with optimized toolbar and container styling
- **File Manager**: Modern file browsing experience with enhanced card design
- **Settings Page**: Unified setting item cards with consistent visual treatment

### Phase 4: Cross-Device Optimization
- **Mobile Sidebar**: Complete theme color unification and enhanced glassmorphism effects
- **Desktop Search**: Unified search system with consistent theme colors and interactions
- **Login System**: Standardized login/logout buttons with unified visual design
- **Theme Switching**: Enhanced theme toggle with modern button design
- **Icon Buttons**: Lightweight design approach for better visual hierarchy

### Technical Achievements
- **21 Components**: Complete macOS design system implementation across all interface elements
- **100% Design Consistency**: Unified visual language throughout the entire application
- **Professional UX**: Smooth animations, micro-interactions, and enhanced accessibility
- **Dark Mode**: Comprehensive dark theme support with proper contrast and color balance
- **Responsive Design**: Seamless experience across desktop, tablet, and mobile devices
- **Performance**: Optimized CSS implementation with efficient animations and transitions

### Phase 5: macOS-style Loading Component System (2024-12-xx)
- **Unified Loading Aesthetics**: Complete removal of react-loading dependency, implementing pure macOS-style loading animations
- **Colorful Breathing Animation**: Main pages feature 5-color gradient dot breathing effects that are both stunning and elegant
- **Lightweight Circular Indicators**: Small components and frequent operations use performance-optimized rotating indicators
- **Performance-tiered Optimization**: Four different performance levels of loading components based on usage scenarios
- **Comprehensive Component Migration**: 8 major components completed migration including buttons, file manager, settings, etc.
- **Zero-dependency Implementation**: Pure CSS animations reducing bundle size and improving loading performance
- **Multi-layer Transparency Effects**: Breathing animations with multi-layer concentric circle shadows for enhanced visual hierarchy
- **Smart Adaptation**: Automatic adaptation to dark mode, responsive design, and low-performance device optimization

### Design System Features
- **Apple HIG Compliance**: Full adherence to Apple Human Interface Guidelines
- **Color Harmony**: Unified theme color system with semantic color variations
- **Visual Hierarchy**: Clear distinction between interface elements and content areas
- **Accessibility**: Enhanced keyboard navigation, focus states, and screen reader support
- **Modern Aesthetics**: Contemporary design with subtle animations and refined details

### Phase 6: File Management System macOS Optimization (2024-12-xx)

#### FilePreview Component Complete Redesign
- **Button Visibility Fix**: Resolved white transparent buttons merging with white backgrounds (PDF, Word documents, etc.)
- **macOS-style Navigation**: Redesigned close, download, and navigation buttons with dark semi-transparent backgrounds (`bg-black/60`)
- **Unified Container Sizes**: Standardized all file preview containers to 800x600px (desktop) with responsive adaptation
- **Enhanced Visual Hierarchy**: Improved loading states, error displays, and file type indicators with glassmorphism effects
- **Smart Content Scaling**: Implemented `object-fit: contain` for images/videos ensuring proper aspect ratio preservation

#### Button Design System Unification
- **Component Architecture**: Created unified Button, ButtonWithLoading, and IconButton components with consistent styling
- **Animation Standardization**: Replaced mixed scale/translate animations with unified `hover:-translate-y-0.5` macOS-style effects
- **Size Standardization**: Established 40px height standard for all buttons with proper icon centering
- **Variant System**: Implemented 5 semantic color variants (primary, secondary, danger, success, warning)
- **Pagination Enhancement**: Complete redesign of pagination buttons with enhanced shadows and hover effects

#### File Manager Interface Improvements
- **Icon Button Migration**: Replaced custom buttons with unified IconButton components throughout file manager
- **Visual Consistency**: Applied consistent rounded corners (`rounded-xl`), shadows, and spacing across all elements
- **Interaction Feedback**: Enhanced hover states and click animations for better user experience
- **Accessibility**: Improved keyboard navigation and screen reader support for file operations

#### R2 Capacity Display Optimization
- **Accurate Calculation**: Fixed server-side capacity calculation from paginated to full R2 bucket analysis
- **macOS Design Compliance**: Removed pink theme colors, implemented neutral glassmorphism design
- **Precision Formatting**: Enhanced file size formatting to match R2 console display exactly
- **Information Architecture**: Added file count display and optimized information hierarchy
- **Performance**: Optimized API calls with proper error handling and loading states

#### Technical Achievements
- **CSS Conflict Resolution**: Resolved global `.bg-button` style conflicts affecting pagination components
- **Server-side Optimization**: Improved R2 file statistics calculation for accurate capacity reporting
- **Component Reusability**: Established reusable button component system reducing code duplication
- **Type Safety**: Enhanced TypeScript support across all button and file management components
- **Performance**: Optimized file preview rendering with unified container sizing and smart content loading

#### User Experience Enhancements
- **Visual Consistency**: 100% macOS design compliance across all file management interfaces
- **Intuitive Interactions**: Simplified and standardized user interactions throughout the system
- **Error Handling**: Improved error states with clear visual feedback and recovery options
- **Responsive Design**: Enhanced mobile and tablet experience with adaptive layouts
- **Accessibility**: Comprehensive keyboard navigation and screen reader optimization

### Phase 7: macOS Glassmorphism System Enhancement (2024-12-xx)

#### Enhanced Glassmorphism Effects
- **Backdrop-filter Optimization**: Upgraded blur effects from 8px/16px/32px to 12px/20px/40px with enhanced saturation (180%-250%) and brightness (1.1-1.2)
- **Transparency Standardization**: Unified background transparency from 95% to 75% across all components for stronger glass effect
- **Custom Glass Classes**: Added specialized glass-bg-light/medium/strong classes for different visual hierarchy levels
- **Cross-browser Compatibility**: Full WebKit prefix support ensuring perfect Safari and Chrome rendering

#### Component System Unification
- **Button Components**: Complete redesign of Button, IconButton, ToolbarButton with 6 semantic variants (primary, secondary, success, warning, info, purple)
- **Card Components**: Enhanced article cards, setting cards, and friend cards with consistent glassmorphism backgrounds
- **Modal System**: Unified popup styling across language switcher, user menu, search history, and file selector dialogs
- **Navigation Elements**: Standardized header navigation with enhanced nav-glass effects and theme color integration

#### Writing Interface Optimization
- **Toolbar Standardization**: Unified all writing tools (drafts, history, save, file attachment) with consistent height (32px) and colorful semi-transparent backgrounds
- **Template System**: Enhanced content template selector with improved glassmorphism effects
- **Editor Integration**: Seamless Monaco editor integration with macOS-style toolbar and enhanced visual hierarchy
- **Translation Support**: Fixed translation key display issues with proper fallback mechanisms

#### Popup Consistency Enhancement
- **Background Uniformity**: Standardized all popups to 85% transparency with 40px blur for consistent visibility across different scroll positions
- **Enhanced Saturation**: Applied saturate(250%) + brightness(1.2) for vivid glassmorphism effects regardless of background complexity
- **Z-index Optimization**: Proper layering system ensuring consistent popup behavior throughout the application
- **Animation Harmony**: Unified slideDown animations with macOS-style easing curves

#### Theme Color System Restoration
- **CSS Variable Fix**: Added missing `--theme-rgb: 0, 122, 255` variable definition for proper Apple System Blue (#007AFF) rendering
- **Navigation Highlighting**: Restored theme color effects in navigation items, focus states, and interactive elements
- **Brand Consistency**: Unified theme color application across buttons, links, and selection states
- **RGBA Integration**: Proper rgba() function support for various transparency levels of theme color

#### Technical Achievements
- **100% Component Coverage**: All UI components now feature enhanced glassmorphism effects
- **Performance Optimization**: Balanced visual effects with rendering performance using appropriate blur levels
- **Design System Maturity**: Complete macOS design language implementation with professional-grade visual consistency
- **Cross-device Compatibility**: Seamless glassmorphism rendering across desktop, tablet, and mobile devices
- **Accessibility Preservation**: Enhanced visual effects while maintaining full keyboard navigation and screen reader support

#### Visual Impact
- **Professional Aesthetics**: Achieved commercial-grade macOS application visual quality
- **Enhanced Depth**: Clear visual hierarchy through varied glassmorphism intensities
- **Brand Recognition**: Consistent Apple System Blue theme color throughout the interface
- **User Engagement**: Improved visual feedback and micro-interactions for better user experience
- **Modern Appeal**: Contemporary glassmorphism design aligned with current macOS design trends
