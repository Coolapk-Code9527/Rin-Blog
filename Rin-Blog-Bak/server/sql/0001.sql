CREATE TABLE IF NOT EXISTS `visits` (
	`id` integer PRIMARY KEY NOT NULL,
	`feed_id` integer NOT NULL,
	`ip` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`feed_id`) REFERENCES `feeds`(`id`) ON UPDATE no action ON DELETE cascade
);

-- 由于 SQLite 不支持直接 ALTER TABLE DROP CONSTRAINT，
-- 我们需要创建一个新表并迁移数据
-- 1. 创建一个临时表，结构与原表相同但修改了 user_id 为可空并添加 nickname 列
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

-- 2. 复制原表数据到新表
INSERT INTO `comments_new` SELECT id, feed_id, user_id, NULL as nickname, content, created_at, updated_at FROM `comments`;

-- 3. 删除原表
DROP TABLE `comments`;

-- 4. 重命名新表为原表名
ALTER TABLE `comments_new` RENAME TO `comments`;
