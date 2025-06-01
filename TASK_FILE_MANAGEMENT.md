1.总体目标
文件管理界面支持图片、视频、音频、PDF、文本等主流类型的缩略图与预览。
支持缩略图/首帧/波形等自动生成与懒加载，提升大批量文件管理体验。
预览弹窗支持多语言、深色模式、移动端适配，交互统一。
2. 前端实施方案
2.1 组件设计
2.1.1 新增 FilePreview/Viewer 组件
支持类型：图片（jpg/png/webp/svg/gif）、视频（mp4/webm）、音频（mp3/wav）、PDF、纯文本/Markdown。
统一弹窗（Modal）展示，支持左右切换、全屏、下载、关闭等操作。
图片支持缩放、旋转、原图/缩略图切换。
视频/音频支持播放/暂停、进度条、音量、全屏。
PDF 支持多页浏览、缩放。
文本支持高亮、换行、复制。
2.1.2 FileManager 网格/列表视图改造
文件项根据类型显示：
图片：显示缩略图。
视频：显示首帧。
音频：显示波形/专辑图。
PDF：显示首页缩略图。
文本：显示文件类型图标。
点击文件项弹出 FilePreview 组件预览。
批量缩略图使用 loading="lazy" 或 IntersectionObserver 懒加载。
2.1.3 适配与优化
预览弹窗适配深色模式、移动端。
支持键盘快捷键（如ESC关闭、左右切换）。
多语言支持。
2.2 代码结构建议
client/src/components/file_manager/FilePreview.tsx（新建）
client/src/components/file_manager/FileManager.tsx（改造）
client/src/components/file_manager/utils.ts（工具函数扩展）
3. 后端实施方案
3.1 缩略图/首帧/波形生成
3.1.1 图片
上传图片时自动生成缩略图
缩略图存储到 R2，hash 写入 thumbnailHash 字段。
3.1.2 视频
上传视频时自动提取首帧，生成缩略图
存储到 R2，hash 写入 thumbnailHash 字段。
3.1.3 音频
上传音频时生成波形图
存储到 R2，hash 写入 thumbnailHash 字段。
3.1.4 PDF
上传PDF时渲染首页为图片缩略图。
存储到 R2，hash 写入 thumbnailHash 字段。
3.1.5 文本
仅生成类型图标，无需缩略图。
3.2 建议
生成失败时降级为类型图标。
4. 分步开发计划
阶段一：基础能力
[ ] 后端图片缩略图生成与接口
[ ] 前端 FilePreview 组件（图片/视频/音频/PDF/文本基本预览）
[ ] FileManager 网格/列表缩略图展示与点击预览
[ ] 懒加载与多语言/深色模式适配
阶段二：高级体验
[ ] 后端视频首帧、音频波形、PDF首页缩略图生成
[ ] 前端 FilePreview 组件多类型细节优化（如PDF多页、音频波形）
[ ] 批量文件高性能懒加载（IntersectionObserver）
[ ] 预览弹窗交互优化（全屏、切换、快捷键）
阶段三：完善与文档
[ ] 代码重构与冗余清理
[ ] 相关文档与多语言补充
[ ] 兼容性与移动端适配测试