-- SQLite migration to add performance optimization indexes for core queries
-- 数据库性能优化索引迁移 - 核心查询优化
-- 创建日期: 2025-06-27
-- 目标: 优化文章列表、访问统计、搜索等核心功能的查询性能

-- 添加 feeds 表复合索引，优化文章列表查询性能
-- 优化查询: SELECT * FROM feeds WHERE draft = 0 AND listed = 1 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS `idx_feeds_list_query` ON `feeds`(`draft`, `listed`, `created_at` DESC);

-- 添加 feeds 表置顶和时间复合索引，优化置顶文章查询
-- 优化查询: SELECT * FROM feeds WHERE draft = 0 AND listed = 1 ORDER BY top DESC, created_at DESC
CREATE INDEX IF NOT EXISTS `idx_feeds_top_time` ON `feeds`(`draft`, `listed`, `top` DESC, `created_at` DESC);

-- 添加 feeds 表搜索优化索引
-- 优化搜索查询性能
CREATE INDEX IF NOT EXISTS `idx_feeds_title_search` ON `feeds`(`title`);

-- 添加 visits 表复合索引，优化访问统计查询性能
-- 优化查询: SELECT feed_id, COUNT(*) FROM visits WHERE created_at > ? GROUP BY feed_id
CREATE INDEX IF NOT EXISTS `idx_visits_stats` ON `visits`(`feed_id`, `created_at`);

-- 添加 visits 表UV统计索引，优化去重查询
-- 优化查询: SELECT COUNT(DISTINCT ip) FROM visits WHERE feed_id = ?
CREATE INDEX IF NOT EXISTS `idx_visits_uv` ON `visits`(`feed_id`, `ip`);
