# Rin-Blog 文件/文章管理功能实施任务清单

## 项目概述

本文档详细规划了 Rin-Blog 文件/文章管理功能的实施步骤，按阶段划分任务，方便团队按进度实施。

## 总体目标

在 Rin-Blog 中添加全面的文件/文章管理功能，使管理员能够：
- 管理已发布的文章和上传的文件
- 支持多种文件类型上传、管理和操作
- 实现文件夹功能和权限控制
- 支持文章附件下载及在线视频播放功能

## 第一阶段：基础设施与文件管理核心功能 (7-10天)

### 任务 1-1: 数据库扩展 (1-2天)

**目标**：创建所需的数据库表结构，支持文件元数据存储

- [ ] 设计并创建 `files` 表
  ```sql
  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY, 
    path TEXT NOT NULL UNIQUE,      -- 存储路径，同时作为唯一标识
    name TEXT NOT NULL,             -- 显示名称
    size INTEGER NOT NULL,          -- 文件大小
    mime_type TEXT NOT NULL,        -- MIME类型
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER NOT NULL,       -- 所有者
    thumbnail_hash TEXT,            -- 缩略图哈希标识
    access_level TEXT DEFAULT 'public', -- public/private/restricted
    is_folder INTEGER DEFAULT 0,    -- 是否是文件夹
    parent_path TEXT,               -- 父目录路径
    hash TEXT,                      -- 文件内容哈希
    
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
  ```
- [ ] 创建 `feed_files` 关联表
  ```sql
  CREATE TABLE IF NOT EXISTS feed_files (
    feed_id INTEGER NOT NULL,
    file_id INTEGER NOT NULL,
    relation_type TEXT DEFAULT 'embed', -- embed：嵌入，attachment：附件
    
    PRIMARY KEY(feed_id, file_id),
    FOREIGN KEY(feed_id) REFERENCES feeds(id),
    FOREIGN KEY(file_id) REFERENCES files(id)
  );
  ```
- [ ] 添加必要索引
  ```sql
  CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
  CREATE INDEX IF NOT EXISTS idx_files_parent ON files(parent_path);
  CREATE INDEX IF NOT EXISTS idx_files_user ON files(user_id, access_level);
  CREATE INDEX IF NOT EXISTS idx_files_mime ON files(mime_type);
  ```
- [ ] 编写数据迁移脚本，迁移现有图片数据到新表
- [ ] 测试数据库操作，确保CRUD功能正常

**完成标准**：
- 数据库表创建成功
- 能通过D1查询工具正常操作所有表
- 现有图片数据成功迁移到新表结构中

### 任务 1-2: 扩展存储服务API (2-3天)

**目标**：创建和扩展后端API，支持文件操作基本功能

- [ ] 扩展 `storage.ts` 服务，添加以下端点：
  - [ ] `GET /api/storage/files?path=&type=&search=` - 获取文件列表
  - [ ] `POST /api/storage/files` - 上传文件(扩展现有API)
  - [ ] `DELETE /api/storage/files/:id` - 删除文件或文件夹
  - [ ] `PATCH /api/storage/files/:id` - 重命名/修改文件属性
  - [ ] `GET /api/storage/files/:id` - 获取文件信息/下载文件
- [ ] 实现以下核心功能：
  - [ ] 文件上传并保存元数据
  - [ ] 文件夹创建功能
  - [ ] 文件列表查询与筛选
  - [ ] 基本权限检查
- [ ] 确保数据一致性，添加事务处理
- [ ] 实现文件路径解析和验证
- [ ] 添加基本错误处理和日志记录

**文件更改**：
- 新建/修改 `server/src/services/files.ts`
- 扩展 `server/src/services/storage.ts`
- 调整 `server/src/utils/s3.ts`

**完成标准**：
- 所有API端点能正常工作
- API响应符合RESTful规范
- 基本权限检查正确执行
- 文件操作正确反映到R2存储和数据库

### 任务 1-3: 前端基础文件管理界面 (3-4天)

**目标**：创建基础的文件管理界面，实现文件展示和基本操作

- [ ] 创建文件管理页面组件
  - [ ] `FilesPage.tsx` - 主页面
  - [ ] `FileManager.tsx` - 文件管理器组件
  - [ ] `FileList.tsx` / `FileGrid.tsx` - 文件列表/网格视图
  - [ ] `FileItem.tsx` - 单个文件项组件
- [ ] 实现基础UI功能：
  - [ ] 列表/网格视图切换
  - [ ] 文件排序和过滤
  - [ ] 面包屑导航
  - [ ] 上传按钮和上传进度显示
  - [ ] 基本的文件操作菜单（删除、重命名）
- [ ] 集成路由，添加到管理员导航
- [ ] 添加基本的拖放上传
- [ ] 实现基本的文件预览（图片）

**文件更改**：
- 新建 `client/src/page/files.tsx`
- 新建 `client/src/components/file_manager/`目录及相关组件

**完成标准**：
- 文件管理界面可通过管理菜单访问
- 能够显示文件和文件夹，并能导航到子文件夹
- 支持基本的文件上传和删除操作
- UI风格与Rin-Blog现有界面保持一致

## 第二阶段：高级功能与编辑器集成 (7-10天)

### 任务 2-1: 文件预览与处理 (2-3天)

**目标**：实现不同类型文件的预览和处理功能

- [ ] 实现图片预览
  - [ ] 缩略图自动生成
  - [ ] 图片查看器组件
  - [ ] 基本裁剪/调整功能(可选)
- [ ] 实现视频/音频预览
  - [ ] 视频播放器组件集成
  - [ ] 视频缩略图自动生成
  - [ ] 支持常见格式如MP4, WebM等
- [ ] 实现其他文件类型处理
  - [ ] PDF预览(如有可能)
  - [ ] 文本文件预览
  - [ ] 其他文件的下载功能
- [ ] 优化预览性能
  - [ ] 懒加载预览
  - [ ] 合适大小的缩略图生成

**文件更改**：
- 新建 `client/src/components/file_manager/preview/`目录
- 新建 `server/src/utils/thumbnails.ts`

**完成标准**：
- 各类型文件能正确预览
- 缩略图自动生成并显示
- 预览操作流畅，无明显性能问题

### 任务 2-2: 高级文件操作 (2-3天)

**目标**：实现更复杂的文件管理功能

- [ ] 实现批量操作功能
  - [ ] 多选文件
  - [ ] 批量删除
  - [ ] 批量移动
- [ ] 增强文件夹管理
  - [ ] 创建子文件夹
  - [ ] 移动文件夹
  - [ ] 计算文件夹大小
- [ ] 实现拖拽功能
  - [ ] 拖放上传改进
  - [ ] 拖拽移动文件/文件夹
  - [ ] 拖拽排序
- [ ] 优化上传体验
  - [ ] 暂停/继续上传
  - [ ] 上传队列管理
  - [ ] 上传状态清晰显示

**文件更改**：
- 修改 `client/src/components/file_manager/*.tsx`
- 扩展 `server/src/services/files.ts`

**完成标准**：
- 批量操作功能正常工作
- 文件夹创建与管理功能完善
- 拖拽操作流畅且符合直觉
- 文件上传体验良好

### 任务 2-3: 文章编辑器集成 (2-3天)

**目标**：将文件管理器与文章编辑器集成

- [ ] 创建编辑器文件选择器
  - [ ] 在编辑器工具栏添加文件选择按钮
  - [ ] 弹窗文件选择器组件
  - [ ] 不同文件类型的插入处理
- [ ] 实现从编辑器到文件的引用跟踪
  - [ ] 解析文章内容中的文件引用
  - [ ] 更新feed_files关联
  - [ ] 处理文件删除时的引用检查
- [ ] 支持拖拽文件到编辑器
  - [ ] 编辑器拖放区域
  - [ ] 文件拖放处理
- [ ] 集成现有上传功能
  - [ ] 与当前图片上传功能整合
  - [ ] 保持兼容性

**文件更改**：
- 修改 `client/src/page/writing.tsx`
- 新建 `client/src/components/file_manager/file_selector.tsx`
- 新建 `client/src/hooks/useFileSelection.ts`

**完成标准**：
- 编辑器工具栏包含文件选择按钮
- 能够从文件管理器选择文件并插入到编辑器
- 文章与文件引用关系正确建立
- 拖放文件到编辑器功能正常

### 任务 2-4: 权限系统集成 (1-2天)

**目标**：实现文件访问权限控制，与文章权限联动

- [ ] 设计并实现文件权限模型
  - [ ] 基本权限级别定义
  - [ ] 与用户角色系统集成
- [ ] 实现权限检查逻辑
  - [ ] API访问权限控制
  - [ ] 前端权限显示
- [ ] 文章与文件权限联动
  - [ ] 私密文章引用的文件自动设为私密
  - [ ] 文章删除时处理关联文件
- [ ] 权限管理界面
  - [ ] 文件权限设置UI
  - [ ] 批量权限修改

**文件更改**：
- 修改 `server/src/services/files.ts`
- 新建 `server/src/utils/permissions.ts`
- 修改 `client/src/components/file_manager/*.tsx`

**完成标准**：
- 文件权限控制正确执行
- 未授权用户无法访问私密文件
- 文章与文件权限联动正确
- 权限设置界面可用

## 第三阶段：优化与完善 (7-9天)

### 任务 3-1: 性能优化 (2-3天)

**目标**：提高文件管理系统的性能和用户体验

- [ ] 实现大文件分块上传
  - [ ] 客户端分块逻辑
  - [ ] 服务端分块合并
  - [ ] 断点续传支持
- [ ] 优化文件列表显示
  - [ ] 虚拟滚动实现
  - [ ] 懒加载优化
  - [ ] 预加载相邻目录
- [ ] API响应优化
  - [ ] 增加适当缓存策略
  - [ ] 数据分页加载
  - [ ] 按需加载详细信息
- [ ] 批量操作优化
  - [ ] 并行处理
  - [ ] 进度反馈

**文件更改**：
- 修改 `client/src/components/file_manager/*.tsx`
- 扩展 `server/src/services/files.ts`
- 新建 `client/src/utils/upload_manager.ts`

**完成标准**：
- 大文件上传流畅且支持断点续传
- 大量文件显示无明显性能问题
- API响应速度达到目标水平
- 批量操作执行效率高

### 任务 3-2: 用户体验优化 (2天)

**目标**：提升文件管理器的用户体验

- [ ] 添加键盘快捷键支持
  - [ ] 常用操作快捷键
  - [ ] 快捷键提示
- [ ] 优化拖放交互
  - [ ] 拖放视觉反馈
  - [ ] 拖放目标高亮
- [ ] 完善进度指示
  - [ ] 更详细的上传进度
  - [ ] 操作状态反馈
- [ ] 错误处理与提示
  - [ ] 友好的错误信息
  - [ ] 操作撤销支持
  - [ ] 批量操作失败处理

**文件更改**：
- 修改 `client/src/components/file_manager/*.tsx`
- 新建 `client/src/hooks/useHotkeys.ts`
- 修改 `client/src/components/dialog.tsx`

**完成标准**：
- 键盘快捷键支持完善且有提示
- 拖放操作有清晰的视觉反馈
- 进度指示器提供准确信息
- 错误信息友好且有解决建议

### 任务 3-3: 多语言支持 (1天)

**目标**：确保文件管理功能支持多语言

- [ ] 提取所有UI文本到语言文件
  - [ ] 英语翻译
  - [ ] 中文翻译(简体/繁体)
  - [ ] 日语翻译
- [ ] 确保动态内容支持翻译
  - [ ] 错误信息
  - [ ] 操作提示
- [ ] 测试不同语言环境
  - [ ] 验证UI布局在不同语言下的适应性
  - [ ] 检查字符编码问题

**文件更改**：
- 修改 `client/public/locales/*/translation.json`
- 确保所有组件使用i18n

**完成标准**：
- 所有UI文本支持多语言切换
- 不同语言下UI布局正常
- 所有动态内容正确翻译

### 任务 3-4: 测试与文档 (2天)

**目标**：确保功能质量并提供完善的文档

- [ ] 编写单元测试
  - [ ] API端点测试
  - [ ] 组件单元测试
- [ ] 执行集成测试
  - [ ] 端到端功能测试
  - [ ] 多场景测试
- [ ] 编写API文档
  - [ ] 详细的端点说明
  - [ ] 请求/响应示例
- [ ] 编写用户指南
  - [ ] 基本操作说明
  - [ ] 高级功能指南
  - [ ] 常见问题解答

**文件更改**：
- 新建 `server/src/tests/services/files.test.ts`
- 新建 `client/src/components/file_manager/__tests__/`
- 新建/修改项目文档

**完成标准**：
- 测试覆盖主要功能点
- 测试通过率达到预期标准
- API文档完整且准确
- 用户指南覆盖所有功能

## 技术依赖和先决条件

- Cloudflare Workers环境
- R2对象存储
- D1数据库
- React和TypeScript环境
- 必要的npm包:
  - 可能需要添加文件预览相关库
  - 可能需要添加拖放功能增强库

## 验收标准

1. **功能完整性**
   - 所有规划的功能都已实现
   - 没有明显的功能缺失或错误

2. **用户体验**
   - 界面美观且符合现有设计风格
   - 操作流畅，无明显延迟
   - 反馈机制清晰

3. **技术性能**
   - 大文件上传性能良好
   - 大量文件显示不卡顿
   - 内存使用合理

4. **代码质量**
   - 代码结构清晰
   - 注释完善
   - 遵循项目编码规范

5. **兼容性**
   - 与现有功能无冲突
   - 主流浏览器兼容性良好

## 注意事项

- 定期与团队同步进度
- 关键功能点提前测试验证
- 保持频繁提交，避免大规模合并冲突
- 优先实现核心功能，次要功能可延后 