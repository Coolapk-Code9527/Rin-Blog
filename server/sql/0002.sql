-- SQLite migration to fix comments table

-- 使用 PRAGMA 关闭外键约束
PRAGMA foreign_keys = OFF;

-- 创建新表
CREATE TABLE `comments_new` (
	`id` integer PRIMARY KEY NOT NULL,
	`feed_id` integer NOT NULL,
	`user_id` integer,
	`nickname` text,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`feed_id`) REFERENCES `feeds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

-- 复制数据
INSERT INTO `comments_new` SELECT id, feed_id, user_id, NULL, content, created_at, updated_at FROM `comments`;

-- 删除旧表
DROP TABLE `comments`;

-- 重命名新表
ALTER TABLE `comments_new` RENAME TO `comments`;

-- 重新启用外键约束
PRAGMA foreign_keys = ON; 