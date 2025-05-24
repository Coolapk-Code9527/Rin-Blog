-- SQLite migration to add file management tables

-- 使用 PRAGMA 关闭外键约束
PRAGMA foreign_keys = OFF;

-- 创建文件表
CREATE TABLE IF NOT EXISTS `files` (
  `id` integer PRIMARY KEY NOT NULL,
  `path` text NOT NULL UNIQUE,      -- 存储路径，同时作为唯一标识
  `name` text NOT NULL,             -- 显示名称
  `size` integer NOT NULL,          -- 文件大小
  `mime_type` text NOT NULL,        -- MIME类型
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `modified_at` integer DEFAULT (unixepoch()) NOT NULL,
  `user_id` integer NOT NULL,       -- 所有者
  `thumbnail_hash` text,            -- 缩略图哈希标识
  `access_level` text DEFAULT 'public' NOT NULL, -- public/private/restricted
  `is_folder` integer DEFAULT 0 NOT NULL,    -- 是否是文件夹
  `parent_path` text,               -- 父目录路径
  `hash` text NOT NULL,             -- 文件内容哈希
  
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

-- 创建文件与文章关联表
CREATE TABLE IF NOT EXISTS `feed_files` (
  `feed_id` integer NOT NULL,
  `file_id` integer NOT NULL,
  `relation_type` text DEFAULT 'embed' NOT NULL, -- embed：嵌入，attachment：附件
  `display_order` integer DEFAULT 0 NOT NULL,    -- 显示顺序
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  
  PRIMARY KEY (`feed_id`, `file_id`),
  FOREIGN KEY (`feed_id`) REFERENCES `feeds`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade
);

-- 创建索引
CREATE INDEX IF NOT EXISTS `idx_files_path` ON `files`(`path`);
CREATE INDEX IF NOT EXISTS `idx_files_parent` ON `files`(`parent_path`);
CREATE INDEX IF NOT EXISTS `idx_files_user` ON `files`(`user_id`, `access_level`);
CREATE INDEX IF NOT EXISTS `idx_files_mime` ON `files`(`mime_type`);
CREATE INDEX IF NOT EXISTS `idx_files_hash` ON `files`(`hash`);

-- 重新启用外键约束
PRAGMA foreign_keys = ON; 